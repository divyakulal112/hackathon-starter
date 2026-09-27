/**
 * KisanSync — centralised constants.
 * Judges can tune these knobs live; nothing in the UI hardcodes them.
 */

import type { AppointmentStatus } from "./types";
import type { TranslationKey } from "./translations";

// ---------------------------------------------------------------------------
// Recommendation Configuration & Weights (Transparent, configurable)
// ---------------------------------------------------------------------------

export const RECOMMENDATION_CONFIG = {
  /** Maximum service radius in km for primary recommendations. Centres beyond this are treated as outside service area. */
  serviceRadiusKm: 50,
  /** Reference distance for normalisation (km). */
  referenceDistanceMaxKm: 50,
  /** Up to 30 pts — nearer centres score higher. */
  distanceWeight: 30,
  /** Up to 25 pts — shorter queues score higher. */
  queueWeight: 25,
  /** Up to 25 pts — lower estimated wait scores higher. */
  waitTimeWeight: 25,
  /** Up to 10 pts — more remaining daily capacity scores higher. */
  capacityWeight: 10,
  /** 20 pts or 0 — crop eligibility is a hard requirement multiplier. */
  eligibilityWeight: 20,

  // Compatibility aliases
  distance: 30,
  queue: 25,
  wait: 25,
  capacity: 10,
  eligibility: 20,
} as const;

export const ENGINE_WEIGHTS = {
  distance: RECOMMENDATION_CONFIG.distanceWeight,
  queue: RECOMMENDATION_CONFIG.queueWeight,
  wait: RECOMMENDATION_CONFIG.waitTimeWeight,
  capacity: RECOMMENDATION_CONFIG.capacityWeight,
  eligibility: RECOMMENDATION_CONFIG.eligibilityWeight,
  distanceWeight: RECOMMENDATION_CONFIG.distanceWeight,
  queueWeight: RECOMMENDATION_CONFIG.queueWeight,
  waitTimeWeight: RECOMMENDATION_CONFIG.waitTimeWeight,
  capacityWeight: RECOMMENDATION_CONFIG.capacityWeight,
  eligibilityWeight: RECOMMENDATION_CONFIG.eligibilityWeight,
} as const;

/** Maximum possible total score, derived — do not hardcode elsewhere. */
export const MAX_TOTAL_SCORE =
  ENGINE_WEIGHTS.distanceWeight +
  ENGINE_WEIGHTS.queueWeight +
  ENGINE_WEIGHTS.waitTimeWeight +
  ENGINE_WEIGHTS.capacityWeight +
  ENGINE_WEIGHTS.eligibilityWeight;

// ---------------------------------------------------------------------------
// Location-aware scoring reference bands
// Distances in km; wait times in minutes. best → scores 1, worst → scores 0.
// ---------------------------------------------------------------------------

/** Reference bands used to normalise the haversine distance into a score. */
export const DISTANCE_BEST_KM = 2;
export const DISTANCE_WORST_KM = 30;

/** Max number of alternative centres surfaced under the recommendation. */
export const MAX_ALTERNATIVES = 6;

/**
 * Service radius: the engine only recommends centres within this distance of
 * the farmer's selected location. Beyond it → "no suitable centre" state.
 */
export const SERVICE_RADIUS_KM = 25;

// ---------------------------------------------------------------------------
// Load-status thresholds (applied to queue / processing-rate ratio)
// ---------------------------------------------------------------------------

/** queueCount / processingRatePerHour ≤ LOAD_OPTIMAL → "optimal". */
export const LOAD_OPTIMAL = 1.5;
/** ≤ LOAD_BUSY → "busy", otherwise "congested". */
export const LOAD_BUSY = 3;

/** Arrival windows are this many minutes wide. */
export const ARRIVAL_WINDOW_MINUTES = 20;

// ---------------------------------------------------------------------------
export const DEMO_FARMER = {
  id: "farmer-ramesh",
  name: "Ramesh Gowda",
  village: "Belvai, Moodbidri Taluk",
} as const;

// ---------------------------------------------------------------------------
// 8-stage procurement tracker
// ---------------------------------------------------------------------------

export const TRACKING_STAGES: { key: string; status: AppointmentStatus }[] = [
  { key: "slotBooked", status: "slot_booked" },
  { key: "arrived", status: "arrived" },
  { key: "weighed", status: "weighed" },
  { key: "qualityVerified", status: "quality_verified" },
  { key: "procurementCompleted", status: "procurement_completed" },
  { key: "paymentInitiated", status: "payment_initiated" },
  { key: "paymentReceived", status: "payment_received" },
  { key: "cancelled", status: "cancelled" },
];

/** Ordered progression used by centre staff to advance a farmer. */
export const CENTRE_STATUS_FLOW: AppointmentStatus[] = [
  "slot_booked",
  "arrived",
  "weighed",
  "quality_verified",
  "procurement_completed",
  "payment_initiated",
  "payment_received",
];

export function stageKeyFor(status: AppointmentStatus): TranslationKey {
  switch (status) {
    case "slot_booked":
      return "slotBooked";
    case "arrived":
      return "arrived";
    case "weighed":
      return "weighed";
    case "quality_verified":
      return "qualityVerified";
    case "procurement_completed":
      return "procurementCompleted";
    case "payment_initiated":
      return "paymentInitiated";
    case "payment_received":
      return "paymentReceived";
    case "cancelled":
      return "cancelled";
  }
}

export function actionLabelForStatus(nextStatus: AppointmentStatus): TranslationKey {
  switch (nextStatus) {
    case "arrived":
      return "markArrived";
    case "weighed":
      return "weighProduce";
    case "quality_verified":
      return "verifyQuality";
    case "procurement_completed":
      return "completeProcurement";
    case "payment_initiated":
      return "releasePayment";
    case "payment_received":
      return "paymentReceived";
    default:
      return "advance";
  }
}

export function statusDescriptionKeyFor(status: AppointmentStatus): TranslationKey {
  switch (status) {
    case "slot_booked":
      return "statusSlotBookedDesc";
    case "arrived":
      return "statusArrivedDesc";
    case "weighed":
      return "statusWeighedDesc";
    case "quality_verified":
      return "statusQualityVerifiedDesc";
    case "procurement_completed":
      return "statusProcurementCompletedDesc";
    case "payment_initiated":
      return "statusPaymentInitiatedDesc";
    case "payment_received":
      return "statusPaymentReceivedDesc";
    case "cancelled":
      return "cancelled";
  }
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  /** Cached centre snapshot for offline demo. */
  cachedCentres: "kisansync_cached_centres_v4",
  /** Selected language persists across reloads. */
  language: "kisansync_language",
  /** Live demo state (centres + appointments) shared across role tabs. */
  /** v4: refreshed to 50 verified national centres with geocoded coordinates. */
  demoState: "kisansync_shared_state_v4",
  /** Active role ("farmer" | "centre") for the landing switcher. */
  role: "kisansync_role",
  /** SMS outbox when running on Supabase (SMS stays client-local in both modes). */
  smsOutbox: "kisansync_sms_outbox",
} as const;

// ---------------------------------------------------------------------------
// Slot windows offered per preferred time (24h "HH:mm")
// ---------------------------------------------------------------------------

export const SLOT_WINDOWS: Record<
  "morning" | "afternoon" | "evening",
  { start: string; end: string }
> = {
  morning: { start: "08:00", end: "11:00" },
  afternoon: { start: "12:30", end: "16:30" },
  evening: { start: "16:30", end: "19:00" },
};
