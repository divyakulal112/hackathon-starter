/**
 * KisanSync — Shared domain types.
 * These types are the contract between mock data today and Supabase tables later.
 * Keep them stable; the UI should never invent ad-hoc shapes.
 */

// ---------------------------------------------------------------------------
// Centre
// ---------------------------------------------------------------------------

export type CentreStatus = "optimal" | "busy" | "congested";

export interface Centre {
  id: string;
  name: string;
  /** Distance from the demo farmer's location, in km. */
  distanceKm: number;
  /** Farmers currently waiting in the live queue. */
  queueCount: number;
  /** Farmers the centre can process per hour (simulated operational data). */
  processingRatePerHour: number;
  /** Total farmers the centre can handle per day. */
  capacityPerDay: number;
  /** Booked appointments for today. */
  bookedToday: number;
  /** Crops this centre is eligible/authorised to procure. */
  eligibleCrops: string[];
  /** Comma-separated village localities served — helps the explanation text. */
  location: string;
  /** Operating hours of the centre (24h). */
  opensAt: string;
  closesAt: string;
}

// ---------------------------------------------------------------------------
// Farmer + request
// ---------------------------------------------------------------------------

/** The ten supported crop types (labels shown verbatim in the UI). */
export type Crop =
  | "Paddy / Rice"
  | "Maize"
  | "Coconut"
  | "Arecanut"
  | "Groundnut"
  | "Chilli"
  | "Tomato"
  | "Potato"
  | "Black Gram"
  | "Green Gram";

export interface Farmer {
  id: string;
  name: string;
  /** Free-text village/taluk location used for distance checks. */
  village: string;
}

export interface ProcurementRequest {
  crop: Crop;
  quantityQuintals: number;
  village: string;
  /** "morning" | "afternoon" | "evening" — preferred arrival period. */
  preferredTime: PreferredTime;
}

export type PreferredTime = "morning" | "afternoon" | "evening";

// ---------------------------------------------------------------------------
// Appointment + booking
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | "slot_booked"
  | "arrived"
  | "weighed"
  | "quality_verified"
  | "procurement_completed"
  | "payment_initiated"
  | "payment_received"
  | "cancelled";

export interface Appointment {
  id: string;
  tokenNumber: string; // e.g. KS-104
  farmerId: string;
  farmerName: string;
  centreId: string;
  centreName: string;
  crop: Crop;
  quantityQuintals: number;
  village: string;
  /** Human-readable arrival window, e.g. "2:15 PM – 2:35 PM". */
  arrivalWindow: string;
  /** ISO timestamp when the slot was booked. */
  bookedAt: string;
  status: AppointmentStatus;
  /** Current stage of the 8-stage tracker (index into TRACKING_STAGES). */
  stageIndex: number;
  /** Amount computed at weighment (₹ per quintal × quantity). */
  estimatedAmountInr: number;
  /** Payment reference shown once payment is received. */
  paymentRef?: string;
  /** Archived appointments keep centre history but unlock the farmer's form. */
  archived?: boolean;
}

// ---------------------------------------------------------------------------
// Coordination engine
// ---------------------------------------------------------------------------

export type CentreEligibility = "eligible" | "ineligible";

export interface CentreScore {
  distanceScore: number;
  queueScore: number;
  waitScore: number;
  capacityScore: number;
  eligibilityScore: number;
  totalScore: number;
}

export interface CentreEvaluation {
  centre: Centre;
  eligibility: CentreEligibility;
  estimatedWaitMinutes: number;
  remainingCapacity: number;
  /** ISO-style "HH:mm" recommended arrival start. */
  arrivalWindowStart: string;
  arrivalWindowEnd: string;
  /** Human-readable, e.g. "2:15 PM – 2:35 PM". */
  arrivalWindowLabel: string;
  score: CentreScore;
  /** Per-factor explanation lines for transparency. */
  reasons: string[];
}

/**
 * Translation-key fragments explaining the engine's choice. The UI composes
 * them through the language context so explanations render in the active
 * language. Keys exist in lib/translations.ts.
 */
export type ExplanationQueueKey =
  | "explainShortQueue"
  | "explainManageableWait"
  | "explainShortestWait";
export type ExplanationCapacityKey =
  | "explainPlentyCapacity"
  | "explainSufficientCapacity";
export type ExplanationDistanceKey =
  | "explainReasonableDistance"
  | "explainReasonableOption";

export interface ExplanationFragments {
  queue: ExplanationQueueKey;
  capacity: ExplanationCapacityKey;
  distance: ExplanationDistanceKey;
}

export interface RecommendationResult {
  best: CentreEvaluation | null;
  /** All centres evaluated, sorted best-first (ineligible last). */
  evaluations: CentreEvaluation[];
  /** English fallback explanation (use explanationFragments + composeExplanation for localized text). */
  explanation: string;
  /** Translation-key fragments for language-aware composition in the UI. */
  explanationFragments: ExplanationFragments | null;
}

// ---------------------------------------------------------------------------
// SMS simulator
// ---------------------------------------------------------------------------

export interface SmsMessage {
  id: string;
  /** Epoch millis — rendered relative to now in the drawer. */
  createdAt: number;
  kind: "booking" | "status" | "payment";
  /** Structured payload; the drawer renders it in the active language. */
  tokenNumber: string;
  centreName: string;
  /** Translation key of the tracking stage (status/payment SMS). */
  stageKey?: string;
  arrivalWindow?: string;
  amountInr?: number;
  paymentRef?: string;
}

