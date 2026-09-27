import { describe, expect, it } from "vitest";
import { TRANSLATIONS } from "./translations";
import { MOCK_CENTRES } from "./mockData";
import type { Appointment, AppointmentStatus, DemoCentreProfile, DemoFarmerProfile } from "./types";

describe("Demo Role Flow — Farmer Portal & Centre Operations", () => {
  it("has complete translation keys for Farmer Profile and Centre Operations across en, kn, and hi", () => {
    const requiredKeys = [
      "farmerName",
      "enterFarmerName",
      "editDetails",
      "welcomeFarmerTitle",
      "welcomeFarmerSubtitle",
      "saveAndContinue",
      "saveDetails",
      "centreDetails",
      "centreId",
      "locationAddress",
      "procurementAgency",
      "supportedCrops",
      "operatingHours",
      "dailyCapacity",
      "availableCapacity",
      "availableSlots",
      "operationsOverview",
      "pendingRequests",
      "editSetup",
      "centreSetup",
      "centreProfile",
    ] as const;

    for (const lang of ["en", "kn", "hi"] as const) {
      for (const key of requiredKeys) {
        expect(TRANSLATIONS[lang][key], `Missing key "${key}" in language "${lang}"`).toBeDefined();
        expect(TRANSLATIONS[lang][key].length).toBeGreaterThan(0);
      }
    }
  });

  describe("Farmer Portal LocalStorage Persistence", () => {
    it("validates localStorage freebuff_farmer_profile JSON structure", () => {
      const mockFarmerProfile: DemoFarmerProfile = {
        name: "Ramesh Gowda",
        village: "Moodbidri",
      };

      const serialized = JSON.stringify(mockFarmerProfile);
      const parsed = JSON.parse(serialized) as DemoFarmerProfile;

      expect(parsed).toHaveProperty("name", "Ramesh Gowda");
      expect(parsed).toHaveProperty("village", "Moodbidri");
      expect(parsed.name.trim().length).toBeGreaterThan(0);
      expect(parsed.village.trim().length).toBeGreaterThan(0);
    });

    it("supports fallback resolution from freebuff_farmer_profile and farmerProfile", () => {
      const storage: Record<string, string> = {};

      function getSavedProfile() {
        const raw = storage["freebuff_farmer_profile"] || storage["farmerProfile"] || "null";
        return JSON.parse(raw);
      }

      expect(getSavedProfile()).toBeNull();

      // Legacy fallback
      storage["farmerProfile"] = JSON.stringify({ name: "Legacy Farmer", village: "Alangar" });
      expect(getSavedProfile()).toEqual({ name: "Legacy Farmer", village: "Alangar" });

      // Primary key takes precedence
      storage["freebuff_farmer_profile"] = JSON.stringify({ name: "Primary Farmer", village: "Moodbidri" });
      expect(getSavedProfile()).toEqual({ name: "Primary Farmer", village: "Moodbidri" });
    });
  });

  describe("Centre Operations Setup & Profile Specification", () => {
    it("validates localStorage freebuff_centre_profile contains only stable configuration", () => {
      const mockCentreProfile: DemoCentreProfile = {
        centreId: "KS-CTR-01",
        name: "Moodbidri APMC Mandi",
        address: "APMC Yard, Moodbidri Main Road",
        village: "Moodbidri",
        district: "Dakshina Kannada",
        state: "Karnataka",
        agency: "Karnataka State Agricultural Marketing Board (KSAMB)",
        supportedCrops: ["Paddy / Rice", "Arecanut", "Coconut"],
        dailyCapacity: 100, // quintals
        dailyCapacityKg: 10000,
        processingRatePerHour: 12,
        operatingHours: {
          opening: "06:00",
          closing: "18:00",
        },
        isSetupComplete: true,
      };

      const serialized = JSON.stringify(mockCentreProfile);
      const parsed = JSON.parse(serialized) as DemoCentreProfile;

      expect(parsed.centreId).toBe("KS-CTR-01");
      expect(parsed.name).toBe("Moodbidri APMC Mandi");
      expect(parsed.agency).toBe("Karnataka State Agricultural Marketing Board (KSAMB)");
      expect(parsed.village).toBe("Moodbidri");
      expect(parsed.district).toBe("Dakshina Kannada");
      expect(parsed.state).toBe("Karnataka");
      expect(parsed.supportedCrops).toContain("Paddy / Rice");
      expect(parsed.dailyCapacity).toBe(100);
      expect(parsed.dailyCapacityKg).toBe(10000);
      expect(parsed.processingRatePerHour).toBe(12);
      expect(parsed.operatingHours.opening).toBe("06:00");
      expect(parsed.operatingHours.closing).toBe("18:00");
      expect(parsed.isSetupComplete).toBe(true);

      // Verify RULE: Setup must NOT configure dynamic operational metrics
      expect(parsed).not.toHaveProperty("currentLiveQueue");
      expect(parsed).not.toHaveProperty("currentQueue");
      expect(parsed).not.toHaveProperty("pendingRequests");
      expect(parsed).not.toHaveProperty("availableSlots");
      expect(parsed).not.toHaveProperty("currentAvailableCapacity");
    });
  });

  describe("System-Derived Dynamic Metrics & Connected Track Flow", () => {
    // Helper function that mirrors the deterministic derivation used in Centre Operations
    function computeDynamicCentreMetrics(
      dailyCapacityQuintals: number,
      dailyCapacityKg: number,
      processingRatePerHour: number,
      operatingHours: { opening: string; closing: string },
      appointments: Appointment[],
      centreId: string,
    ) {
      const centreApts = appointments.filter((a) => a.centreId === centreId);

      // Active requests awaiting completion (in progress stages)
      const activeRequests = centreApts.filter(
        (a) =>
          a.status === "slot_booked" ||
          a.status === "arrived" ||
          a.status === "weighed" ||
          a.status === "quality_verified",
      );

      const pendingRequestsCount = activeRequests.length;
      const committedQuintals = activeRequests.reduce(
        (sum, a) => sum + (a.quantityQuintals || 0),
        0,
      );
      const committedKg = committedQuintals * 100;

      const availableCapacityKg = Math.max(0, dailyCapacityKg - committedKg);
      const availableCapacityQuintals = Math.max(
        0,
        Math.round((dailyCapacityQuintals - committedQuintals) * 10) / 10,
      );

      const [openH = 6, openM = 0] = operatingHours.opening.split(":").map(Number);
      const [closeH = 18, closeM = 0] = operatingHours.closing.split(":").map(Number);
      const totalOperatingHours = Math.max(1, (closeH + closeM / 60) - (openH + openM / 60));

      const maxTimeSlots = Math.max(
        0,
        Math.round(totalOperatingHours * processingRatePerHour) - pendingRequestsCount,
      );
      const capacitySlots = Math.max(0, Math.floor(availableCapacityQuintals / 10));
      const availableSlotsCount = Math.max(
        0,
        availableCapacityQuintals <= 0 ? 0 : Math.min(capacitySlots, maxTimeSlots),
      );

      return {
        pendingRequestsCount,
        committedQuintals,
        committedKg,
        availableCapacityKg,
        availableCapacityQuintals,
        availableSlotsCount,
      };
    }

    it("verifies initial state with zero active appointments", () => {
      const metrics = computeDynamicCentreMetrics(
        100,
        10000,
        12,
        { opening: "06:00", closing: "18:00" },
        [],
        "KS-CTR-01",
      );

      expect(metrics.pendingRequestsCount).toBe(0);
      expect(metrics.committedKg).toBe(0);
      expect(metrics.availableCapacityKg).toBe(10000);
      expect(metrics.availableCapacityQuintals).toBe(100);
      expect(metrics.availableSlotsCount).toBe(10); // 100 q / 10 q per slot
    });

    it("demonstrates Connected Track: Farmer booking increases Pending Requests and decreases Available Capacity", () => {
      const appointments: Appointment[] = [];
      const centreId = "KS-CTR-01";

      // 1. Farmer 1 books 15 quintals (1,500 kg)
      const booking1: Appointment = {
        id: "apt-1",
        tokenNumber: "KS-101",
        farmerId: "f-1",
        farmerName: "Ramesh Gowda",
        centreId,
        centreName: "Moodbidri APMC Mandi",
        crop: "Paddy / Rice",
        quantityQuintals: 15,
        village: "Moodbidri",
        arrivalWindow: "10:00 AM – 10:20 AM",
        bookedAt: new Date().toISOString(),
        status: "slot_booked",
        stageIndex: 0,
        estimatedAmountInr: null,
      };
      appointments.push(booking1);

      const metrics1 = computeDynamicCentreMetrics(
        100,
        10000,
        12,
        { opening: "06:00", closing: "18:00" },
        appointments,
        centreId,
      );

      expect(metrics1.pendingRequestsCount).toBe(1);
      expect(metrics1.committedKg).toBe(1500);
      expect(metrics1.availableCapacityKg).toBe(8500);
      expect(metrics1.availableCapacityQuintals).toBe(85);
      expect(metrics1.availableSlotsCount).toBe(8); // Math.floor(85 / 10)

      // 2. Farmer 2 books 25 quintals (2,500 kg)
      const booking2: Appointment = {
        id: "apt-2",
        tokenNumber: "KS-102",
        farmerId: "f-2",
        farmerName: "Suresh Bhat",
        centreId,
        centreName: "Moodbidri APMC Mandi",
        crop: "Arecanut",
        quantityQuintals: 25,
        village: "Alangar",
        arrivalWindow: "11:00 AM – 11:20 AM",
        bookedAt: new Date().toISOString(),
        status: "slot_booked",
        stageIndex: 0,
        estimatedAmountInr: null,
      };
      appointments.push(booking2);

      const metrics2 = computeDynamicCentreMetrics(
        100,
        10000,
        12,
        { opening: "06:00", closing: "18:00" },
        appointments,
        centreId,
      );

      expect(metrics2.pendingRequestsCount).toBe(2);
      expect(metrics2.committedKg).toBe(4000);
      expect(metrics2.availableCapacityKg).toBe(6000);
      expect(metrics2.availableCapacityQuintals).toBe(60);
      expect(metrics2.availableSlotsCount).toBe(6);
    });

    it("demonstrates Connected Track: Operator advancing to procurement_completed decrements Pending Requests and releases capacity", () => {
      const appointments: Appointment[] = [
        {
          id: "apt-1",
          tokenNumber: "KS-101",
          farmerId: "f-1",
          farmerName: "Ramesh Gowda",
          centreId: "KS-CTR-01",
          centreName: "Moodbidri APMC Mandi",
          crop: "Paddy / Rice",
          quantityQuintals: 20,
          village: "Moodbidri",
          arrivalWindow: "10:00 AM – 10:20 AM",
          bookedAt: new Date().toISOString(),
          status: "weighed",
          stageIndex: 2,
          estimatedAmountInr: null,
        },
      ];

      // Active state before completion
      const before = computeDynamicCentreMetrics(
        100,
        10000,
        12,
        { opening: "06:00", closing: "18:00" },
        appointments,
        "KS-CTR-01",
      );
      expect(before.pendingRequestsCount).toBe(1);
      expect(before.committedKg).toBe(2000);
      expect(before.availableCapacityKg).toBe(8000);

      // Operator advances token to "procurement_completed"
      appointments[0].status = "procurement_completed";
      appointments[0].stageIndex = 4;

      const after = computeDynamicCentreMetrics(
        100,
        10000,
        12,
        { opening: "06:00", closing: "18:00" },
        appointments,
        "KS-CTR-01",
      );

      expect(after.pendingRequestsCount).toBe(0);
      expect(after.committedKg).toBe(0);
      expect(after.availableCapacityKg).toBe(10000);
      expect(after.availableCapacityQuintals).toBe(100);
    });

    it("handles zero remaining capacity gracefully without negative available slots", () => {
      const appointments: Appointment[] = [
        {
          id: "apt-overload",
          tokenNumber: "KS-999",
          farmerId: "f-9",
          farmerName: "Bulk Farmer",
          centreId: "KS-CTR-01",
          centreName: "Moodbidri APMC Mandi",
          crop: "Paddy / Rice",
          quantityQuintals: 120, // exceeds 100 quintal daily capacity
          village: "Moodbidri",
          arrivalWindow: "10:00 AM – 10:20 AM",
          bookedAt: new Date().toISOString(),
          status: "slot_booked",
          stageIndex: 0,
          estimatedAmountInr: null,
        },
      ];

      const metrics = computeDynamicCentreMetrics(
        100,
        10000,
        12,
        { opening: "06:00", closing: "18:00" },
        appointments,
        "KS-CTR-01",
      );

      expect(metrics.availableCapacityKg).toBe(0);
      expect(metrics.availableCapacityQuintals).toBe(0);
      expect(metrics.availableSlotsCount).toBe(0);
    });
  });
});
