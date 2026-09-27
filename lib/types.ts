/**
 * KisanSync — Shared domain types.
 * These types are the contract between mock data today and Supabase tables later.
 * Keep them stable; the UI should never invent ad-hoc shapes.
 */

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export interface Location {
  id: string;
  name: string;
  normalizedName: string;
  state?: string;
  district?: string;
  subdistrict?: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  featureClass?: string;
  featureCode?: string;
  population?: number;
  source?: string;
  externalId?: string;
}

// ---------------------------------------------------------------------------
// Centre
// ---------------------------------------------------------------------------

export type CentreStatus = "optimal" | "busy" | "congested";

export interface Centre {
  id: string;
  name: string;
  canonicalName?: string;
  state?: string;
  district?: string;
  subdistrict?: string;
  latitude: number;
  longitude: number;
  source?: string;
  externalId?: string;
  centreType?: "apmc_mandi" | "sub_yard" | "msp_procurement_hub" | "cooperative_society" | "collection_centre";
  address?: string;
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
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Farmer location + request
// ---------------------------------------------------------------------------

/**
 * A structured, geocoded farmer location (village/town/city).
 * Selected from a list in the request form so the engine receives real
 * coordinates instead of free text — this is what makes recommendations
 * location-aware.
 */
export interface FarmerLocation {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
}

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
  /** Free-text village/taluk location used for display (derived from locationId). */
  village: string;
}

export interface FarmerProfile {
  id: string;
  phone: string;
  name: string;
  village: string;
  location: string;
  preferredLanguage: "en" | "kn" | "hi";
}

export interface FarmerSession {
  phone: string;
  profile: FarmerProfile | null;
  authenticatedAt: number;
}


export interface DemoFarmerProfile {
  name: string;
  village: string;
}

export interface DemoCentreProfile {
  centreId: string;
  name: string;
  address: string;
  village: string;
  district: string;
  state: string;
  agency: string;
  supportedCrops: string[];
  dailyCapacity: number;
  dailyCapacityKg: number;
  processingRatePerHour: number;
  operatingHours: {
    opening: string;
    closing: string;
  };
  isSetupComplete: boolean;
}


export interface CentreProfile {
  id: string;
  centreId: string;
  name: string;
  address: string;
  village: string;
  district: string;
  state: string;
  agency: string;
  supportedCrops: string[];
  operatingHours: {
    opening: string;
    closing: string;
  };
}

export interface CentreOperations {
  centreId: string;
  dailyCapacity: number;
  availableCapacity: number;
  processingRatePerHour: number;
  queueCount: number;
  availableSlots: number;
}

export interface CentreSession {
  centreId: string;
  phone: string;
  profile: CentreProfile | null;
  operations: CentreOperations | null;
  authenticatedAt: number;
}


export interface ProcurementRequest {
  crop: Crop;
  quantityQuintals: number;
  /** Human-readable location name kept for appointment records/SMS. */
  village: string;
  /** Canonical location ID from the locations dataset */
  locationId?: string;
  /** Geographic latitude */
  latitude?: number;
  /** Geographic longitude */
  longitude?: number;
  /** Preferred arrival period (morning/afternoon/evening). */
  preferredTime: PreferredTime;
  /** Preferred procurement date (ISO yyyy-mm-dd, optional — display only in demo). */
  preferredDate?: string;
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
  /** Amount computed from real Government modal price (₹ per quintal × quantity), or null if unavailable. */
  estimatedAmountInr: number | null;
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

/**
 * One "why this centre?" checklist row. `key` is a translation key;
 * `detail` is pre-formatted data (never translated) that backs the claim.
 */
export interface WhyChecklistItem {
  key: string;
  passed: boolean;
  detail?: string;
}

export interface CentreEvaluation {
  centre: Centre;
  eligibility: CentreEligibility;
  /** Distance from the farmer's selected location, km (haversine, 1 decimal). */
  distanceKm: number;
  /** True when distanceKm ≤ SERVICE_RADIUS_KM. */
  withinServiceArea: boolean;
  /** Percentage of daily capacity already used. */
  capacityPct: number;
  estimatedWaitMinutes: number;
  remainingCapacity: number;
  /** True if centre is within the configurable service radius (default 50 km). */
  isWithinServiceRadius: boolean;
  /** ISO-style "HH:mm" recommended arrival start. */
  arrivalWindowStart: string;
  arrivalWindowEnd: string;
  /** Human-readable, e.g. "2:15 PM – 2:35 PM". */
  arrivalWindowLabel: string;
  score: CentreScore;
  /** Per-factor explanation lines for transparency. */
  reasons: string[];
  /** Data-backed "why this centre?" checklist. */
  checklist: WhyChecklistItem[];
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

export interface FarmerLocation {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
}

export interface RecommendationResult {
  /**
   * The recommended centre — ONLY ever a centre that accepts the crop AND
   * sits within the service radius. Null when no in-area eligible centre
   * exists (the UI then shows alternatives, never a fake recommendation).
   */
  best: CentreEvaluation | null;
  /** All centres evaluated, sorted best-first (ineligible last). */
  evaluations: CentreEvaluation[];
  /** Centres within the configurable service radius. */
  nearbyEvaluations: CentreEvaluation[];
  /** Centres outside the service radius, sorted by distance. */
  distantAlternatives: CentreEvaluation[];
  /** Other eligible centres (excluding best), best-first — capped for UI. */
  alternatives?: CentreEvaluation[];
  /** True only when a valid in-area recommendation exists. */
  withinServiceArea?: boolean;
  /** The farmer location the evaluation was computed against. */
  farmerLocation?: FarmerLocation | Location | null;
  /** English fallback explanation (use explanationFragments + composeExplanation for localized text). */
  explanation: string;
  /** Translation-key fragments for language-aware composition in the UI. */
  explanationFragments: ExplanationFragments | null;
  /** True when the farmer's location was successfully resolved from the canonical dataset. */
  locationSupported?: boolean;
  /** Resolved canonical location object. */
  resolvedLocation?: Location | null;
  /** Reason message when no suitable centre is available within the service area. */
  noSuitableCentreReason?: string;
}

// ---------------------------------------------------------------------------
// SMS simulator
// ---------------------------------------------------------------------------

export interface SmsMessage {
  id: string;
  /** Epoch millis — rendered relative to now in the drawer. */
  createdAt: number;
  kind: "booking" | "status" | "payment";
  /** Message delivery state: 'received' or 'pending' */
  deliveryStatus?: "received" | "pending";
  /** Structured payload; the drawer renders it in the active language. */
  tokenNumber: string;
  centreName: string;
  /** Crop name and quantity for context */
  crop?: string;
  quantityQuintals?: number;
  farmerId?: string;
  /** Translation key of the tracking stage (status/payment SMS). */
  stageKey?: string;
  arrivalWindow?: string;
  amountInr?: number | null;
  paymentRef?: string;
}
