/**
 * KisanSync — Procurement Centre Authentication & Onboarding Abstraction
 *
 * Provides Centre ID + phone number + OTP authentication for centres.
 * Designed with a clean interface so Demo Mode can seamlessly
 * be replaced by Supabase Phone Auth in the future without
 * changing UI components.
 */

import type { CentreOperations, CentreProfile, CentreSession } from "@/lib/types";
import { validateIndianPhone } from "./farmerAuth";

export const CENTRE_AUTH_STORAGE_KEYS = {
  SESSION: "kisansync_centre_session",
  PROFILES: "kisansync_centre_profiles",
  OPERATIONS: "kisansync_centre_operations",
  PENDING_OTP: "kisansync_demo_centre_pending_otp",
} as const;

export interface SendCentreOtpResult {
  success: boolean;
  message?: string;
  demoOtp?: string;
  error?: string;
}

export interface VerifyCentreOtpResult {
  success: boolean;
  profile?: CentreProfile | null;
  operations?: CentreOperations | null;
  error?: string;
}

function getStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.error(`[centreAuth] Failed to write to localStorage: ${key}`, e);
  }
}

function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function getStoredCentreProfiles(): Record<string, CentreProfile> {
  const data = getStorageItem(CENTRE_AUTH_STORAGE_KEYS.PROFILES);
  if (!data) return {};
  try {
    return JSON.parse(data) || {};
  } catch {
    return {};
  }
}

function getStoredCentreOperations(): Record<string, CentreOperations> {
  const data = getStorageItem(CENTRE_AUTH_STORAGE_KEYS.OPERATIONS);
  if (!data) return {};
  try {
    return JSON.parse(data) || {};
  } catch {
    return {};
  }
}

/**
 * 1. Send OTP to Procurement Centre registered mobile number.
 */
export async function sendCentreOtp(
  rawCentreId: string,
  rawPhone: string
): Promise<SendCentreOtpResult> {
  const centreId = (rawCentreId || "").trim();
  if (!centreId) {
    return { success: false, error: "Please enter your Centre ID" };
  }

  const validation = validateIndianPhone(rawPhone);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const phone = validation.normalizedPhone;
  const demoOtp = "123456";

  const pendingData = {
    centreId,
    phone,
    otp: demoOtp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    createdAt: Date.now(),
  };

  setStorageItem(CENTRE_AUTH_STORAGE_KEYS.PENDING_OTP, JSON.stringify(pendingData));

  // Simulated async network delay for realism
  await new Promise((resolve) => setTimeout(resolve, 350));

  return {
    success: true,
    message: `Demo OTP sent to +91 ${phone}`,
    demoOtp,
  };
}

/**
 * 2. Verify 6-digit OTP for Procurement Centre.
 */
export async function verifyCentreOtp(
  rawCentreId: string,
  rawPhone: string,
  otp: string
): Promise<VerifyCentreOtpResult> {
  const centreId = (rawCentreId || "").trim();
  if (!centreId) {
    return { success: false, error: "Centre ID is required" };
  }

  const validation = validateIndianPhone(rawPhone);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const phone = validation.normalizedPhone;
  const cleanOtp = (otp || "").trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    return { success: false, error: "Please enter a valid 6-digit numeric OTP" };
  }

  let isValid = false;
  const pendingStr = getStorageItem(CENTRE_AUTH_STORAGE_KEYS.PENDING_OTP);

  if (cleanOtp === "123456") {
    isValid = true;
  } else if (pendingStr) {
    try {
      const pending = JSON.parse(pendingStr);
      if (
        pending &&
        pending.centreId.toLowerCase() === centreId.toLowerCase() &&
        pending.phone === phone &&
        pending.otp === cleanOtp
      ) {
        if (Date.now() <= pending.expiresAt) {
          isValid = true;
        } else {
          return { success: false, error: "OTP has expired. Please request a new one." };
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!isValid) {
    return {
      success: false,
      error: "Invalid OTP. Please check and try again (Demo OTP is 123456).",
    };
  }

  removeStorageItem(CENTRE_AUTH_STORAGE_KEYS.PENDING_OTP);

  const profiles = getStoredCentreProfiles();
  const operations = getStoredCentreOperations();

  const existingProfile = profiles[centreId] || null;
  const existingOps = operations[centreId] || null;

  const session: CentreSession = {
    centreId,
    phone,
    profile: existingProfile,
    operations: existingOps,
    authenticatedAt: Date.now(),
  };

  setStorageItem(CENTRE_AUTH_STORAGE_KEYS.SESSION, JSON.stringify(session));

  await new Promise((resolve) => setTimeout(resolve, 250));

  return {
    success: true,
    profile: existingProfile,
    operations: existingOps,
  };
}

/**
 * 3. Get currently authenticated centre session.
 */
export function getCentreSession(): CentreSession | null {
  const sessionStr = getStorageItem(CENTRE_AUTH_STORAGE_KEYS.SESSION);
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(sessionStr);
    if (session && typeof session.centreId === "string" && session.centreId) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 4. Save/update centre profile & operational capacity.
 */
export async function saveCentreProfileAndOperations(
  profileInput: Omit<CentreProfile, "id">,
  operationsInput: Omit<CentreOperations, "centreId">
): Promise<{ profile: CentreProfile; operations: CentreOperations }> {
  const session = getCentreSession();
  if (!session || !session.centreId) {
    throw new Error("No active centre session found. Please log in first.");
  }

  const centreId = session.centreId;
  const name = (profileInput.name || "").trim();
  const address = (profileInput.address || "").trim();
  const village = (profileInput.village || "").trim();
  const district = (profileInput.district || "").trim();
  const state = (profileInput.state || "").trim();
  const agency = (profileInput.agency || "").trim();
  const supportedCrops = Array.isArray(profileInput.supportedCrops)
    ? profileInput.supportedCrops.filter(Boolean)
    : [];

  const opening = (profileInput.operatingHours?.opening || "06:00").trim();
  const closing = (profileInput.operatingHours?.closing || "18:00").trim();

  // Validations
  if (!name) throw new Error("Centre Name is required");
  if (!district) throw new Error("District is required");
  if (!state) throw new Error("State is required");
  if (supportedCrops.length === 0) throw new Error("Please select at least one supported crop");

  const dailyCapacity = Number(operationsInput.dailyCapacity);
  const availableCapacity = Number(operationsInput.availableCapacity);
  const processingRatePerHour = Number(operationsInput.processingRatePerHour);
  const queueCount = Number(operationsInput.queueCount);
  const availableSlots = Number(operationsInput.availableSlots);

  if (Number.isNaN(dailyCapacity) || dailyCapacity <= 0) {
    throw new Error("Daily capacity must be a positive number");
  }
  if (Number.isNaN(availableCapacity) || availableCapacity < 0) {
    throw new Error("Available capacity must be a positive number or zero");
  }
  if (availableCapacity > dailyCapacity) {
    throw new Error("Available capacity cannot exceed daily capacity");
  }
  if (Number.isNaN(processingRatePerHour) || processingRatePerHour <= 0) {
    throw new Error("Processing rate per hour must be a positive number");
  }
  if (Number.isNaN(queueCount) || queueCount < 0) {
    throw new Error("Queue count must be zero or a positive number");
  }
  if (Number.isNaN(availableSlots) || availableSlots < 0) {
    throw new Error("Available slots must be zero or a positive number");
  }

  const profile: CentreProfile = {
    id: `centre-profile-${centreId}`,
    centreId,
    name,
    address,
    village,
    district,
    state,
    agency,
    supportedCrops,
    operatingHours: {
      opening,
      closing,
    },
  };

  const operations: CentreOperations = {
    centreId,
    dailyCapacity,
    availableCapacity,
    processingRatePerHour,
    queueCount,
    availableSlots,
  };

  // Persist to storage
  const profiles = getStoredCentreProfiles();
  profiles[centreId] = profile;
  setStorageItem(CENTRE_AUTH_STORAGE_KEYS.PROFILES, JSON.stringify(profiles));

  const allOps = getStoredCentreOperations();
  allOps[centreId] = operations;
  setStorageItem(CENTRE_AUTH_STORAGE_KEYS.OPERATIONS, JSON.stringify(allOps));

  // Update session
  session.profile = profile;
  session.operations = operations;
  setStorageItem(CENTRE_AUTH_STORAGE_KEYS.SESSION, JSON.stringify(session));

  await new Promise((resolve) => setTimeout(resolve, 200));

  return { profile, operations };
}

/**
 * 5. Logout centre and clear session.
 */
export async function logoutCentre(): Promise<void> {
  removeStorageItem(CENTRE_AUTH_STORAGE_KEYS.SESSION);
  removeStorageItem(CENTRE_AUTH_STORAGE_KEYS.PENDING_OTP);
  await new Promise((resolve) => setTimeout(resolve, 100));
}
