/**
 * KisanSync — Farmer Authentication Abstraction
 *
 * Provides phone number + OTP authentication for farmers.
 * Designed with a clean interface so Demo Mode can seamlessly
 * be replaced by Supabase Phone Auth in the future without
 * changing UI components.
 */

import type { FarmerProfile, FarmerSession } from "@/lib/types";

export const AUTH_STORAGE_KEYS = {
  SESSION: "kisansync_farmer_session",
  PROFILES: "kisansync_farmer_profiles",
  PENDING_OTP: "kisansync_demo_pending_otp",
} as const;

export interface SendOtpResult {
  success: boolean;
  message?: string;
  demoOtp?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  profile?: FarmerProfile | null;
  error?: string;
}

/**
 * Validates and normalizes a 10-digit Indian mobile number.
 */
export function validateIndianPhone(rawPhone: string): {
  valid: boolean;
  normalizedPhone: string;
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { valid: false, normalizedPhone: "", error: "Please enter a mobile number" };
  }

  // Remove spaces, hyphens, and leading +91 / 0
  let cleaned = rawPhone.trim().replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, normalizedPhone: cleaned, error: "Mobile number must contain digits only" };
  }

  if (cleaned.length !== 10) {
    return {
      valid: false,
      normalizedPhone: cleaned,
      error: `Mobile number must be exactly 10 digits (entered ${cleaned.length})`,
    };
  }

  if (!/^[6-9]/.test(cleaned)) {
    return {
      valid: false,
      normalizedPhone: cleaned,
      error: "Indian mobile numbers must start with 6, 7, 8, or 9",
    };
  }

  return { valid: true, normalizedPhone: cleaned };
}

/**
 * Helper to safely read from localStorage
 */
function getStorageItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Helper to safely write to localStorage
 */
function setStorageItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    console.error(`[farmerAuth] Failed to write to localStorage: ${key}`, e);
  }
}

/**
 * Helper to safely remove from localStorage
 */
function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

/**
 * Load all registered profiles map (phone -> profile)
 */
function getStoredProfiles(): Record<string, FarmerProfile> {
  const data = getStorageItem(AUTH_STORAGE_KEYS.PROFILES);
  if (!data) return {};
  try {
    return JSON.parse(data) || {};
  } catch {
    return {};
  }
}

/**
 * 1. Send OTP to farmer mobile number.
 * In Demo mode, generates a 6-digit OTP and stores it temporarily.
 */
export async function sendOtp(rawPhone: string): Promise<SendOtpResult> {
  const validation = validateIndianPhone(rawPhone);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const phone = validation.normalizedPhone;

  // Demo mode OTP generation (standard 123456 or 6-digit code)
  const demoOtp = "123456";
  const pendingData = {
    phone,
    otp: demoOtp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    createdAt: Date.now(),
  };

  setStorageItem(AUTH_STORAGE_KEYS.PENDING_OTP, JSON.stringify(pendingData));

  // Simulated async network delay for realism
  await new Promise((resolve) => setTimeout(resolve, 350));

  return {
    success: true,
    message: `Demo OTP sent to +91 ${phone}`,
    demoOtp,
  };
}

/**
 * 2. Verify 6-digit OTP.
 * On success, creates session and returns any existing profile.
 */
export async function verifyOtp(rawPhone: string, otp: string): Promise<VerifyOtpResult> {
  const validation = validateIndianPhone(rawPhone);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const phone = validation.normalizedPhone;
  const cleanOtp = (otp || "").trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    return { success: false, error: "Please enter a valid 6-digit numeric OTP" };
  }

  // Check pending OTP in Demo mode
  const pendingStr = getStorageItem(AUTH_STORAGE_KEYS.PENDING_OTP);
  let isValid = false;

  if (cleanOtp === "123456") {
    // Master demo OTP always accepted for smooth judging / testing
    isValid = true;
  } else if (pendingStr) {
    try {
      const pending = JSON.parse(pendingStr);
      if (pending && pending.phone === phone && pending.otp === cleanOtp) {
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
    return { success: false, error: "Invalid OTP. Please check and try again (Demo OTP is 123456)." };
  }

  // Clear pending OTP
  removeStorageItem(AUTH_STORAGE_KEYS.PENDING_OTP);

  // Check if profile exists for this phone
  const profiles = getStoredProfiles();
  const existingProfile = profiles[phone] || null;

  const session: FarmerSession = {
    phone,
    profile: existingProfile,
    authenticatedAt: Date.now(),
  };

  setStorageItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(session));

  // If profile exists, also keep legacy farmerProfile synced for existing components
  if (existingProfile) {
    setStorageItem(
      "farmerProfile",
      JSON.stringify({ name: existingProfile.name, village: existingProfile.village })
    );
  }

  // Simulated async network delay
  await new Promise((resolve) => setTimeout(resolve, 250));

  return {
    success: true,
    profile: existingProfile,
  };
}

/**
 * 3. Get currently authenticated farmer session.
 */
export function getFarmerSession(): FarmerSession | null {
  const sessionStr = getStorageItem(AUTH_STORAGE_KEYS.SESSION);
  if (!sessionStr) return null;
  try {
    const session = JSON.parse(sessionStr);
    if (session && typeof session.phone === "string" && session.phone) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 4. Save/update farmer onboarding profile.
 */
export async function saveFarmerProfile(
  profileInput: Omit<FarmerProfile, "id" | "phone">
): Promise<FarmerProfile> {
  const session = getFarmerSession();
  if (!session || !session.phone) {
    throw new Error("No active farmer session found. Please log in first.");
  }

  const name = profileInput.name.trim();
  const village = profileInput.village.trim();
  const location = profileInput.location.trim() || village;
  const preferredLanguage = profileInput.preferredLanguage || "en";

  if (!name) {
    throw new Error("Full name is required");
  }
  if (!village) {
    throw new Error("Village / Town is required");
  }

  const profile: FarmerProfile = {
    id: `farmer-${session.phone}`,
    phone: session.phone,
    name,
    village,
    location,
    preferredLanguage,
  };

  // Update profiles database in storage
  const profiles = getStoredProfiles();
  profiles[session.phone] = profile;
  setStorageItem(AUTH_STORAGE_KEYS.PROFILES, JSON.stringify(profiles));

  // Update active session
  session.profile = profile;
  setStorageItem(AUTH_STORAGE_KEYS.SESSION, JSON.stringify(session));

  // Sync legacy farmerProfile key
  setStorageItem("farmerProfile", JSON.stringify({ name: profile.name, village: profile.village }));

  await new Promise((resolve) => setTimeout(resolve, 200));
  return profile;
}

/**
 * 5. Logout farmer and clear session.
 */
export async function logoutFarmer(): Promise<void> {
  removeStorageItem(AUTH_STORAGE_KEYS.SESSION);
  removeStorageItem(AUTH_STORAGE_KEYS.PENDING_OTP);
  await new Promise((resolve) => setTimeout(resolve, 100));
}
