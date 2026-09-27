import { describe, expect, it, beforeEach } from "vitest";
import {
  sendCentreOtp,
  verifyCentreOtp,
  getCentreSession,
  saveCentreProfileAndOperations,
  logoutCentre,
  CENTRE_AUTH_STORAGE_KEYS,
} from "./centreAuth";
import { getFarmerSession, sendOtp as sendFarmerOtp, verifyOtp as verifyFarmerOtp } from "./farmerAuth";

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

describe("Procurement Centre Authentication & Onboarding Flow", () => {
  beforeEach(() => {
    memoryStorage.clear();
  });

  describe("1. Centre Login & OTP Dispatch", () => {
    it("sends OTP when valid Centre ID and 10-digit mobile number are provided", async () => {
      const res = await sendCentreOtp("KS-CTR-01", "9876543210");
      expect(res.success).toBe(true);
      expect(res.demoOtp).toBe("123456");

      const pending = memoryStorage.getItem(CENTRE_AUTH_STORAGE_KEYS.PENDING_OTP);
      expect(pending).not.toBeNull();
      const parsed = JSON.parse(pending!);
      expect(parsed.centreId).toBe("KS-CTR-01");
      expect(parsed.phone).toBe("9876543210");
    });

    it("rejects login if Centre ID is missing or empty", async () => {
      const res = await sendCentreOtp("", "9876543210");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Centre ID");
    });

    it("rejects login if phone number is invalid", async () => {
      const res = await sendCentreOtp("KS-CTR-01", "12345");
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe("2. Centre OTP Verification", () => {
    it("verifies 6-digit Demo OTP and establishes CentreSession", async () => {
      await sendCentreOtp("KS-CTR-01", "9876543210");
      const verifyRes = await verifyCentreOtp("KS-CTR-01", "9876543210", "123456");

      expect(verifyRes.success).toBe(true);
      const session = getCentreSession();
      expect(session).not.toBeNull();
      expect(session?.centreId).toBe("KS-CTR-01");
      expect(session?.phone).toBe("9876543210");
      expect(session?.profile).toBeNull();
      expect(session?.operations).toBeNull();
    });

    it("rejects incorrect OTPs", async () => {
      await sendCentreOtp("KS-CTR-01", "9876543210");
      const verifyRes = await verifyCentreOtp("KS-CTR-01", "9876543210", "999999");
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error).toContain("Invalid OTP");
    });
  });

  describe("3. Centre Profile & Operational Capacity Validation", () => {
    it("validates and saves comprehensive centre profile and operations data", async () => {
      // 1. Authenticate
      await sendCentreOtp("KS-CTR-01", "9876543210");
      await verifyCentreOtp("KS-CTR-01", "9876543210", "123456");

      // 2. Save profile & operations
      const result = await saveCentreProfileAndOperations(
        {
          centreId: "KS-CTR-01",
          name: "Moodbidri APMC Mandi",
          address: "APMC Yard, Moodbidri Main Road",
          village: "Moodbidri",
          district: "Dakshina Kannada",
          state: "Karnataka",
          agency: "Karnataka State Agricultural Marketing Board (KSAMB)",
          supportedCrops: ["Paddy / Rice", "Arecanut", "Coconut"],
          operatingHours: {
            opening: "06:00",
            closing: "18:00",
          },
        },
        {
          dailyCapacity: 500,
          availableCapacity: 320,
          processingRatePerHour: 25,
          queueCount: 18,
          availableSlots: 20,
        }
      );

      expect(result.profile.name).toBe("Moodbidri APMC Mandi");
      expect(result.profile.supportedCrops).toContain("Paddy / Rice");
      expect(result.operations.dailyCapacity).toBe(500);
      expect(result.operations.availableCapacity).toBe(320);
      expect(result.operations.processingRatePerHour).toBe(25);

      // 3. Verify session was updated
      const session = getCentreSession();
      expect(session?.profile?.name).toBe("Moodbidri APMC Mandi");
      expect(session?.operations?.dailyCapacity).toBe(500);
    });

    it("rejects invalid operational capacity configurations", async () => {
      await sendCentreOtp("KS-CTR-01", "9876543210");
      await verifyCentreOtp("KS-CTR-01", "9876543210", "123456");

      // Available capacity exceeding daily capacity
      await expect(
        saveCentreProfileAndOperations(
          {
            centreId: "KS-CTR-01",
            name: "Test Mandi",
            address: "Test Address",
            village: "Test Village",
            district: "Test District",
            state: "Karnataka",
            agency: "State APMC",
            supportedCrops: ["Paddy / Rice"],
            operatingHours: { opening: "06:00", closing: "18:00" },
          },
          {
            dailyCapacity: 100,
            availableCapacity: 150, // Invalid: exceeds 100
            processingRatePerHour: 10,
            queueCount: 0,
            availableSlots: 10,
          }
        )
      ).rejects.toThrow("cannot exceed daily capacity");
    });
  });

  describe("4. Role Isolation: Farmer vs Centre Sessions", () => {
    it("maintains separate sessions for Farmer and Centre without collision", async () => {
      // 1. Login Farmer
      await sendFarmerOtp("9876543210");
      await verifyFarmerOtp("9876543210", "123456");

      // 2. Login Centre
      await sendCentreOtp("KS-CTR-01", "8888888888");
      await verifyCentreOtp("KS-CTR-01", "8888888888", "123456");

      const farmerSession = getFarmerSession();
      const centreSession = getCentreSession();

      expect(farmerSession?.phone).toBe("9876543210");
      expect(centreSession?.centreId).toBe("KS-CTR-01");
      expect(centreSession?.phone).toBe("8888888888");

      // 3. Logout Centre - farmer session stays intact
      await logoutCentre();
      expect(getCentreSession()).toBeNull();
      expect(getFarmerSession()?.phone).toBe("9876543210");
    });
  });
});
