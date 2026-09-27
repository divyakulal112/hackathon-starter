import { describe, expect, it, beforeEach } from "vitest";
import {
  validateIndianPhone,
  sendOtp,
  verifyOtp,
  getFarmerSession,
  saveFarmerProfile,
  logoutFarmer,
  AUTH_STORAGE_KEYS,
} from "./farmerAuth";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const memoryStorage = new MemoryStorage();
(globalThis as any).window = {
  localStorage: memoryStorage,
};
(globalThis as any).localStorage = memoryStorage;

describe("Farmer Phone & OTP Authentication Flow", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  describe("1. Indian Mobile Number Validation", () => {
    it("accepts valid 10-digit Indian numbers starting with 6, 7, 8, or 9", () => {
      expect(validateIndianPhone("9876543210").valid).toBe(true);
      expect(validateIndianPhone("8123456789").valid).toBe(true);
      expect(validateIndianPhone("7000012345").valid).toBe(true);
      expect(validateIndianPhone("6361234567").valid).toBe(true);
    });

    it("normalizes numbers with spaces, dashes, +91 prefix or leading zeros", () => {
      const res1 = validateIndianPhone("+91 98765 43210");
      expect(res1.valid).toBe(true);
      expect(res1.normalizedPhone).toBe("9876543210");

      const res2 = validateIndianPhone("09876543210");
      expect(res2.valid).toBe(true);
      expect(res2.normalizedPhone).toBe("9876543210");

      const res3 = validateIndianPhone("91-98765-43210");
      expect(res3.valid).toBe(true);
      expect(res3.normalizedPhone).toBe("9876543210");
    });

    it("rejects numbers starting with digits other than 6, 7, 8, 9", () => {
      const res = validateIndianPhone("5123456789");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Indian mobile numbers must start with 6, 7, 8, or 9");
    });

    it("rejects numbers with length other than 10 digits", () => {
      expect(validateIndianPhone("987654321").valid).toBe(false);
      expect(validateIndianPhone("98765432100").valid).toBe(false);
      expect(validateIndianPhone("").valid).toBe(false);
    });

    it("rejects non-numeric inputs", () => {
      expect(validateIndianPhone("98765abcde").valid).toBe(false);
    });
  });

  describe("2. Demo OTP Generation & Verification", () => {
    it("sends OTP for a valid phone number", async () => {
      const result = await sendOtp("9876543210");
      expect(result.success).toBe(true);
      expect(result.demoOtp).toBe("123456");

      const pending = localStorage.getItem(AUTH_STORAGE_KEYS.PENDING_OTP);
      expect(pending).not.toBeNull();
      const parsed = JSON.parse(pending!);
      expect(parsed.phone).toBe("9876543210");
    });

    it("rejects sendOtp for invalid phone numbers", async () => {
      const result = await sendOtp("12345");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("verifies master demo OTP 123456 and creates farmer session", async () => {
      await sendOtp("9876543210");
      const verifyRes = await verifyOtp("9876543210", "123456");

      expect(verifyRes.success).toBe(true);
      const session = getFarmerSession();
      expect(session).not.toBeNull();
      expect(session?.phone).toBe("9876543210");
      expect(session?.profile).toBeNull(); // No profile saved yet
    });

    it("rejects incorrect OTPs", async () => {
      await sendOtp("9876543210");
      const verifyRes = await verifyOtp("9876543210", "000000");

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain("Invalid OTP");
    });

    it("rejects malformed / non-6-digit OTPs", async () => {
      const res1 = await verifyOtp("9876543210", "123");
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("6-digit");
    });
  });

  describe("3. Farmer Profile Onboarding & Persistence", () => {
    it("saves farmer profile and persists to session and profiles store", async () => {
      // 1. Authenticate first
      await sendOtp("9876543210");
      await verifyOtp("9876543210", "123456");

      // 2. Save Profile
      const savedProfile = await saveFarmerProfile({
        name: "Ramesh Gowda",
        village: "Moodbidri",
        location: "Dakshina Kannada, Karnataka",
        preferredLanguage: "kn",
      });

      expect(savedProfile.id).toBe("farmer-9876543210");
      expect(savedProfile.name).toBe("Ramesh Gowda");
      expect(savedProfile.village).toBe("Moodbidri");
      expect(savedProfile.preferredLanguage).toBe("kn");

      // 3. Verify active session contains profile
      const activeSession = getFarmerSession();
      expect(activeSession?.profile?.name).toBe("Ramesh Gowda");
      expect(activeSession?.profile?.village).toBe("Moodbidri");
    });

    it("retrieves existing profile upon subsequent login with the same phone", async () => {
      // 1. Setup profile
      await sendOtp("9876543210");
      await verifyOtp("9876543210", "123456");
      await saveFarmerProfile({
        name: "Suresh Patil",
        village: "Bantwal",
        location: "Dakshina Kannada, Karnataka",
        preferredLanguage: "en",
      });

      // 2. Logout
      await logoutFarmer();
      expect(getFarmerSession()).toBeNull();

      // 3. Login again with same number
      await sendOtp("9876543210");
      const verifyRes = await verifyOtp("9876543210", "123456");

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.profile).not.toBeNull();
      expect(verifyRes.profile?.name).toBe("Suresh Patil");
      expect(verifyRes.profile?.village).toBe("Bantwal");
    });

    it("clears session on logout", async () => {
      await sendOtp("9876543210");
      await verifyOtp("9876543210", "123456");
      expect(getFarmerSession()).not.toBeNull();

      await logoutFarmer();
      expect(getFarmerSession()).toBeNull();
    });
  });
});
