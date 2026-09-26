/**
 * KisanSync — Offline-First Domain Types
 * Defines the contract for offline queuing, synchronisation states,
 * and idempotency guarantees.
 */

import type { Crop, PreferredTime } from "@/lib/types";

export type OfflineRequestStatus =
  | "DRAFT"
  | "PENDING_OFFLINE"
  | "SYNCING"
  | "SUBMITTED"
  | "CONFIRMED"
  | "REQUIRES_ATTENTION"
  | "FAILED";

export type SyncState = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNCED";

export interface OfflineProcurementPayload {
  crop: Crop;
  quantityQuintals: number;
  village: string;
  preferredTime: PreferredTime;
  targetCentreId?: string;
  targetCentreName?: string;
  targetArrivalWindow?: string;
  modalPrice?: number | null;
}

export interface QueuedOfflineRequest {
  /** Unique client idempotency key generated at request creation time */
  requestId: string;
  operationType: "book_token";
  payload: OfflineProcurementPayload;
  createdAt: number;
  updatedAt: number;
  status: OfflineRequestStatus;
  retryCount: number;
  lastError?: string;
  rejectionReason?: string;
  confirmedTokenNumber?: string;
  confirmedAppointmentId?: string;
}
