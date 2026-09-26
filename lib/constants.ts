/**
 * KisanSync — centralised constants.
 * Judges can tune these knobs live; nothing in the UI hardcodes them.
 */

import type { AppointmentStatus } from "./types";

// ---------------------------------------------------------------------------
// Coordination Engine weights (transparent, rule-based)
// Each factor contributes 0..weight points; total max = sum of weights.
// ---------------------------------------------------------------------------

export const ENGINE_WEIGHTS = {
  /** Up to 30 pts — nearer centres score higher. */
  distance: 30,
  /** Up to 25 pts — shorter queues score higher. */
  queue: 25,
  /** Up to 25 pts — lower estimated wait scores higher. */
  wait: 25,
  /** Up to 10 pts — more remaining daily capacity scores higher. */
  capacity: 10,
  /** 20 pts or 0 — crop eligibility is a hard requirement multiplier. */
  eligibility: 20,
} as const;

/** Maximum possible total score, derived — do not hardcode elsewhere. */
export const MAX_TOTAL_SCORE =
  ENGINE_WEIGHTS.distance +
  ENGINE_WEIGHTS.queue +
  ENGINE_WEIGHTS.wait +
  ENGINE_WEIGHTS.capacity +
  ENGINE_WEIGHTS.eligibility;

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
// Demo farmer + MSP reference rates (₹ per quintal, simulated values)
// ---------------------------------------------------------------------------

export const DEMO_FARMER = {
  id: "farmer-ramesh",
  name: "Ramesh Gowda",
  village: "Belvai, Moodbidri Taluk",
} as const;

export const CROP_RATES_INR_PER_QUINTAL: Record<string, number> = {
  "Paddy / Rice": 2300,
  Maize: 2050,
  Coconut: 1800,
  Arecanut: 3200,
  Groundnut: 2650,
  Chilli: 3500,
  Tomato: 1200,
  Potato: 1400,
  "Black Gram": 2700,
  "Green Gram": 2800,
};

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

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  /** Cached centre snapshot for offline demo. */
  cachedCentres: "kisansync_cached_centres",
  /** Selected language persists across reloads. */
  language: "kisansync_language",
  /** Live demo state (centres + appointments) shared across role tabs. */
  /** v3: renamed to kisansync_shared_state per Phase 2 spec — old keys ignored. */
  demoState: "kisansync_shared_state",
  /** Active role ("farmer" | "centre") for the landing switcher. */
  role: "kisansync_role",
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
