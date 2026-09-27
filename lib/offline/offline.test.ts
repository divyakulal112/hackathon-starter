import { describe, it, expect, beforeEach } from "vitest";
import type { Centre, Appointment, ProcurementRequest } from "@/lib/types";
import type { QueuedOfflineRequest } from "./types";
import {
  getQueuedRequests,
  saveQueuedRequest,
  updateQueuedRequest,
  deleteQueuedRequest,
  getLastKnownSyncTime,
  setLastKnownSyncTime,
} from "./offlineStorage";
import { processOfflineQueue } from "./syncManager";

const MOCK_CENTRE: Centre = {
  id: "centre-moodbidri",
  name: "Moodbidri APMC Yard",
  location: "Moodbidri",
  district: "Dakshina Kannada",
  state: "Karnataka",
  latitude: 13.0694,
  longitude: 74.9961,
  capacityPerDay: 50,
  bookedToday: 10,
  queueCount: 4,
  processingRatePerHour: 12,
  eligibleCrops: ["Paddy / Rice", "Arecanut", "Maize"],
  distanceKm: 8,
  opensAt: "06:00",
  closesAt: "18:00",
};

describe("Offline-First Connectivity Layer", () => {
  beforeEach(async () => {
    // Clear storage before each test
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
    const current = await getQueuedRequests();
    for (const req of current) {
      await deleteQueuedRequest(req.requestId);
    }
  });

  describe("Scenario 1: Offline request creation (No fake live data)", () => {
    it("creates a queued offline request with PENDING_OFFLINE and no fake token", async () => {
      const requestId = `req-off-${Date.now()}-abc1`;
      const queuedItem: QueuedOfflineRequest = {
        requestId,
        operationType: "book_token",
        payload: {
          crop: "Paddy / Rice",
          quantityQuintals: 15,
          village: "Belvai",
          preferredTime: "afternoon",
          targetCentreId: MOCK_CENTRE.id,
          targetCentreName: MOCK_CENTRE.name,
          targetArrivalWindow: "10:00 AM – 10:20 AM",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      };

      await saveQueuedRequest(queuedItem);

      // Verify no fake token is generated
      expect(queuedItem.confirmedTokenNumber).toBeUndefined();
      expect(queuedItem.confirmedAppointmentId).toBeUndefined();
      expect(queuedItem.status).toBe("PENDING_OFFLINE");

      // Verify saved in storage
      const stored = await getQueuedRequests();
      expect(stored.length).toBe(1);
      expect(stored[0].requestId).toBe(requestId);
      expect(stored[0].payload.crop).toBe("Paddy / Rice");
    });
  });

  describe("Scenario 2: Persistent queue across reloads", () => {
    it("persists queued requests across simulated page reloads and browser sessions", async () => {
      const requestId1 = `req-off-1`;
      const requestId2 = `req-off-2`;

      await saveQueuedRequest({
        requestId: requestId1,
        operationType: "book_token",
        payload: {
          crop: "Paddy / Rice",
          quantityQuintals: 10,
          village: "Belvai",
          preferredTime: "morning",
        },
        createdAt: 1000,
        updatedAt: 1000,
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      await saveQueuedRequest({
        requestId: requestId2,
        operationType: "book_token",
        payload: {
          crop: "Arecanut",
          quantityQuintals: 20,
          village: "Karkala",
          preferredTime: "evening",
        },
        createdAt: 2000,
        updatedAt: 2000,
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      // Simulate browser reload by reading from storage
      const reloaded = await getQueuedRequests();
      expect(reloaded.length).toBe(2);
      expect(reloaded[0].requestId).toBe(requestId1);
      expect(reloaded[0].payload.village).toBe("Belvai");
      expect(reloaded[1].requestId).toBe(requestId2);
      expect(reloaded[1].payload.village).toBe("Karkala");

      // Test cancel/deletion
      await deleteQueuedRequest(requestId1);
      const afterDelete = await getQueuedRequests();
      expect(afterDelete.length).toBe(1);
      expect(afterDelete[0].requestId).toBe(requestId2);
    });

    it("persists and retrieves last known sync timestamp", () => {
      const timestamp = 1711500000000;
      setLastKnownSyncTime(timestamp);
      expect(getLastKnownSyncTime()).toBe(timestamp);
    });
  });

  describe("Scenario 3: Automatic sync on reconnection", () => {
    it("synchronizes pending requests and assigns real token and appointment", async () => {
      const requestId = `req-off-sync-1`;
      await saveQueuedRequest({
        requestId,
        operationType: "book_token",
        payload: {
          crop: "Paddy / Rice",
          quantityQuintals: 15,
          village: "Belvai",
          preferredTime: "afternoon",
          targetCentreId: MOCK_CENTRE.id,
          targetCentreName: MOCK_CENTRE.name,
          targetArrivalWindow: "02:00 PM – 02:20 PM",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      const backendCentres = [{ ...MOCK_CENTRE }];
      const backendAppointments: Appointment[] = [];
      let smsDispatched = false;

      const result = await processOfflineQueue({
        getCentres: () => backendCentres,
        getAppointments: () => backendAppointments,
        bookConfirmedToken: ({ requestId, centreId, request, arrivalWindow }) => {
          const appointment: Appointment = {
            id: `apt-ks-105-${requestId}`,
            tokenNumber: "KS-105",
            farmerId: "farmer-ramesh",
            farmerName: "Ramesh Gowda",
            centreId,
            centreName: MOCK_CENTRE.name,
            crop: request.crop,
            quantityQuintals: request.quantityQuintals,
            village: request.village,
            arrivalWindow,
            bookedAt: new Date().toISOString(),
            status: "slot_booked",
            stageIndex: 0,
            estimatedAmountInr: 33000,
          };
          backendAppointments.push(appointment);
          smsDispatched = true;
          return appointment;
        },
      });

      expect(result.succeeded.length).toBe(1);
      expect(result.succeeded[0].status).toBe("CONFIRMED");
      expect(result.succeeded[0].confirmedTokenNumber).toBe("KS-105");
      expect(result.succeeded[0].confirmedAppointmentId).toBe(`apt-ks-105-${requestId}`);
      expect(smsDispatched).toBe(true);

      // Verify updated in storage
      const stored = await getQueuedRequests();
      expect(stored[0].status).toBe("CONFIRMED");
      expect(stored[0].confirmedTokenNumber).toBe("KS-105");
    });
  });

  describe("Scenario 4: Capacity check & rejection handling", () => {
    it("marks request as REQUIRES_ATTENTION if centre capacity is full at sync time", async () => {
      const requestId = `req-off-capacity-full`;
      await saveQueuedRequest({
        requestId,
        operationType: "book_token",
        payload: {
          crop: "Paddy / Rice",
          quantityQuintals: 15,
          village: "Belvai",
          preferredTime: "afternoon",
          targetCentreId: MOCK_CENTRE.id,
          targetCentreName: MOCK_CENTRE.name,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      // Centre has reached daily quota
      const fullCentre = { ...MOCK_CENTRE, bookedToday: 50, capacityPerDay: 50 };
      const backendAppointments: Appointment[] = [];

      const result = await processOfflineQueue({
        getCentres: () => [fullCentre],
        getAppointments: () => backendAppointments,
        bookConfirmedToken: () => {
          throw new Error("Should not be called when capacity is full");
        },
      });

      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0].status).toBe("REQUIRES_ATTENTION");
      expect(result.rejected[0].rejectionReason).toContain("reached daily intake quota");
      expect(backendAppointments.length).toBe(0);

      const stored = await getQueuedRequests();
      expect(stored[0].status).toBe("REQUIRES_ATTENTION");
      expect(stored[0].rejectionReason).toBeDefined();
    });

    it("marks request as REQUIRES_ATTENTION if crop is not eligible at sync time", async () => {
      const requestId = `req-off-ineligible`;
      await saveQueuedRequest({
        requestId,
        operationType: "book_token",
        payload: {
          crop: "Wheat" as any, // Not eligible at Moodbidri
          quantityQuintals: 10,
          village: "Belvai",
          preferredTime: "morning",
          targetCentreId: MOCK_CENTRE.id,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      const result = await processOfflineQueue({
        getCentres: () => [MOCK_CENTRE],
        getAppointments: () => [],
        bookConfirmedToken: () => {
          throw new Error("Should not be called when crop ineligible");
        },
      });

      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0].status).toBe("REQUIRES_ATTENTION");
      expect(result.rejected[0].rejectionReason).toContain("no longer procures Wheat");
    });
  });

  describe("Scenario 5: Duplicate prevention (Idempotency key)", () => {
    it("does not create a duplicate booking if sync is retried after appointment exists", async () => {
      const requestId = `req-off-idempotency-test`;
      await saveQueuedRequest({
        requestId,
        operationType: "book_token",
        payload: {
          crop: "Paddy / Rice",
          quantityQuintals: 15,
          village: "Belvai",
          preferredTime: "afternoon",
          targetCentreId: MOCK_CENTRE.id,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      // Pre-existing appointment already contains this requestId
      const existingAppointment: Appointment = {
        id: `apt-ks-108-${requestId}`,
        tokenNumber: "KS-108",
        farmerId: "farmer-ramesh",
        farmerName: "Ramesh Gowda",
        centreId: MOCK_CENTRE.id,
        centreName: MOCK_CENTRE.name,
        crop: "Paddy / Rice",
        quantityQuintals: 15,
        village: "Belvai",
        arrivalWindow: "10:00 AM – 10:20 AM",
        bookedAt: new Date().toISOString(),
        status: "slot_booked",
        stageIndex: 0,
        estimatedAmountInr: 33000,
      };

      let bookingCallCount = 0;

      const result = await processOfflineQueue({
        getCentres: () => [MOCK_CENTRE],
        getAppointments: () => [existingAppointment],
        bookConfirmedToken: () => {
          bookingCallCount++;
          throw new Error("Duplicate booking call should not happen");
        },
      });

      expect(bookingCallCount).toBe(0);
      expect(result.succeeded.length).toBe(1);
      expect(result.succeeded[0].status).toBe("CONFIRMED");
      expect(result.succeeded[0].confirmedTokenNumber).toBe("KS-108");
      expect(result.succeeded[0].confirmedAppointmentId).toBe(existingAppointment.id);
    });
  });

  describe("Scenario 6: Confirmed booking triggers existing SMS simulation", () => {
    it("triggers SMS confirmation notification upon sync completion with dynamic data", async () => {
      const requestId = `req-off-sms-test`;
      await saveQueuedRequest({
        requestId,
        operationType: "book_token",
        payload: {
          crop: "Paddy / Rice",
          quantityQuintals: 15,
          village: "Belvai",
          preferredTime: "afternoon",
          targetCentreId: MOCK_CENTRE.id,
          targetCentreName: MOCK_CENTRE.name,
          targetArrivalWindow: "10:00 AM – 10:20 AM",
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "PENDING_OFFLINE",
        retryCount: 0,
      });

      const smsOutbox: any[] = [];

      await processOfflineQueue({
        getCentres: () => [MOCK_CENTRE],
        getAppointments: () => [],
        bookConfirmedToken: ({ requestId, centreId, request, arrivalWindow }) => {
          const token = "KS-109";
          const apt: Appointment = {
            id: `apt-${token.toLowerCase()}-${requestId}`,
            tokenNumber: token,
            farmerId: "farmer-ramesh",
            farmerName: "Ramesh Gowda",
            centreId,
            centreName: MOCK_CENTRE.name,
            crop: request.crop,
            quantityQuintals: request.quantityQuintals,
            village: request.village,
            arrivalWindow,
            bookedAt: new Date().toISOString(),
            status: "slot_booked",
            stageIndex: 0,
            estimatedAmountInr: 33000,
          };

          // Mimics makeSms inside AppStateContext
          smsOutbox.push({
            id: `sms-${Date.now()}`,
            kind: "booking",
            tokenNumber: token,
            centreName: MOCK_CENTRE.name,
            crop: request.crop,
            quantityQuintals: request.quantityQuintals,
            farmerId: "farmer-ramesh",
            arrivalWindow,
            deliveryStatus: "received",
            createdAt: Date.now(),
          });

          return apt;
        },
      });

      expect(smsOutbox.length).toBe(1);
      expect(smsOutbox[0].tokenNumber).toBe("KS-109");
      expect(smsOutbox[0].centreName).toBe("Moodbidri APMC Yard");
      expect(smsOutbox[0].crop).toBe("Paddy / Rice");
      expect(smsOutbox[0].quantityQuintals).toBe(15);
      expect(smsOutbox[0].arrivalWindow).toBe("10:00 AM – 10:20 AM");
    });
  });
});
