/**
 * KisanSync — Automatic Synchronisation & Validation Engine
 *
 * Coordinates between persistent offline queue and the live Data Access Layer.
 * Validates backend constraints (capacity, queue, eligibility) dynamically upon
 * reconnection and prevents duplicate submissions using unique client request IDs.
 */

import type { Appointment, Centre, SmsMessage } from "@/lib/types";
import type { QueuedOfflineRequest } from "./types";
import {
  getQueuedRequests,
  updateQueuedRequest,
} from "./offlineStorage";

export interface SyncResult {
  succeeded: QueuedOfflineRequest[];
  rejected: QueuedOfflineRequest[];
  failed: QueuedOfflineRequest[];
}

export interface SyncHandlers {
  /** Retrieves latest live centres from backend */
  getCentres: () => Centre[];
  /** Retrieves existing appointments to ensure idempotency */
  getAppointments: () => Appointment[];
  /** Dispatches confirmed booking into live application state and DAL */
  bookConfirmedToken: (params: {
    requestId: string;
    centreId: string;
    request: {
      crop: import("@/lib/types").Crop;
      quantityQuintals: number;
      village: string;
      preferredTime: import("@/lib/types").PreferredTime;
    };
    arrivalWindow: string;
    modalPrice?: number | null;
  }) => Appointment;
}

const MAX_RETRY_COUNT = 3;

let isSyncing = false;

export async function processOfflineQueue(handlers: SyncHandlers): Promise<SyncResult> {
  if (isSyncing) {
    return { succeeded: [], rejected: [], failed: [] };
  }

  isSyncing = true;
  const result: SyncResult = { succeeded: [], rejected: [], failed: [] };

  try {
    const queue = await getQueuedRequests();
    const pending = queue.filter(
      (req) => req.status === "PENDING_OFFLINE" || (req.status === "FAILED" && req.retryCount < MAX_RETRY_COUNT),
    );

    for (const item of pending) {
      await updateQueuedRequest(item.requestId, { status: "SYNCING" });

      try {
        // -------------------------------------------------------------------
        // 1. Idempotency Guard (Duplicate Prevention)
        // -------------------------------------------------------------------
        const existingAppointments = handlers.getAppointments();
        const alreadyBooked = existingAppointments.find(
          (apt) => apt.id.includes(item.requestId) || (item.confirmedAppointmentId && apt.id === item.confirmedAppointmentId),
        );

        if (alreadyBooked) {
          const syncedItem: QueuedOfflineRequest = {
            ...item,
            status: "CONFIRMED",
            confirmedTokenNumber: alreadyBooked.tokenNumber,
            confirmedAppointmentId: alreadyBooked.id,
            updatedAt: Date.now(),
          };
          await updateQueuedRequest(item.requestId, syncedItem);
          result.succeeded.push(syncedItem);
          continue;
        }

        // -------------------------------------------------------------------
        // 2. Validate against live backend source of truth
        // -------------------------------------------------------------------
        const centres = handlers.getCentres();
        const targetCentre = item.payload.targetCentreId
          ? centres.find((c) => c.id === item.payload.targetCentreId)
          : centres[0];

        if (!targetCentre) {
          const rejectedItem: QueuedOfflineRequest = {
            ...item,
            status: "REQUIRES_ATTENTION",
            rejectionReason: "Selected procurement centre is no longer active or reachable.",
            updatedAt: Date.now(),
          };
          await updateQueuedRequest(item.requestId, rejectedItem);
          result.rejected.push(rejectedItem);
          continue;
        }

        // Check crop eligibility
        const isEligible =
          Array.isArray(targetCentre.eligibleCrops) &&
          targetCentre.eligibleCrops.includes(item.payload.crop);

        if (!isEligible) {
          const rejectedItem: QueuedOfflineRequest = {
            ...item,
            status: "REQUIRES_ATTENTION",
            rejectionReason: `${targetCentre.name} no longer procures ${item.payload.crop}. Please select an eligible centre.`,
            updatedAt: Date.now(),
          };
          await updateQueuedRequest(item.requestId, rejectedItem);
          result.rejected.push(rejectedItem);
          continue;
        }

        // Check live capacity constraint
        const remainingCapacity = Math.max(0, targetCentre.capacityPerDay - targetCentre.bookedToday);
        if (remainingCapacity < 1) {
          const rejectedItem: QueuedOfflineRequest = {
            ...item,
            status: "REQUIRES_ATTENTION",
            rejectionReason: `${targetCentre.name} reached daily intake quota while offline. Please select another centre or next day slot.`,
            updatedAt: Date.now(),
          };
          await updateQueuedRequest(item.requestId, rejectedItem);
          result.rejected.push(rejectedItem);
          continue;
        }

        // -------------------------------------------------------------------
        // 3. Confirm booking & generate token through standard pipeline
        // -------------------------------------------------------------------
        const appointment = handlers.bookConfirmedToken({
          requestId: item.requestId,
          centreId: targetCentre.id,
          request: {
            crop: item.payload.crop,
            quantityQuintals: item.payload.quantityQuintals,
            village: item.payload.village,
            preferredTime: item.payload.preferredTime,
          },
          arrivalWindow: item.payload.targetArrivalWindow || "10:00 AM – 10:20 AM",
          modalPrice: item.payload.modalPrice,
        });

        const confirmedItem: QueuedOfflineRequest = {
          ...item,
          status: "CONFIRMED",
          confirmedTokenNumber: appointment.tokenNumber,
          confirmedAppointmentId: appointment.id,
          updatedAt: Date.now(),
        };

        await updateQueuedRequest(item.requestId, confirmedItem);
        result.succeeded.push(confirmedItem);
      } catch (err) {
        // Transient network or persistence error during sync
        const nextRetry = item.retryCount + 1;
        const failedItem: QueuedOfflineRequest = {
          ...item,
          status: nextRetry >= MAX_RETRY_COUNT ? "FAILED" : "PENDING_OFFLINE",
          retryCount: nextRetry,
          lastError: err instanceof Error ? err.message : "Sync error",
          updatedAt: Date.now(),
        };
        await updateQueuedRequest(item.requestId, failedItem);
        result.failed.push(failedItem);
      }
    }
  } finally {
    isSyncing = false;
  }

  return result;
}
