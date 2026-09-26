/**
 * KisanSync — Location-Aware Coordination Engine.
 *
 * Transparent, rule-based scoring. No black-box AI/ML — every point is traceable:
 *
 *   totalScore = distanceScore + queueScore + waitScore +
 *                capacityScore + eligibilityScore
 * Configuration and weights live in lib/constants.ts (RECOMMENDATION_CONFIG / ENGINE_WEIGHTS).
 * Location calculation uses the Haversine formula from the farmer's selected
 * location to each procurement centre.
 */

import {
  ARRIVAL_WINDOW_MINUTES,
  ENGINE_WEIGHTS,
  LOAD_BUSY,
  LOAD_OPTIMAL,
  RECOMMENDATION_CONFIG,
  SERVICE_RADIUS_KM,
} from "./constants";
import { getFarmerLocation } from "./mockData";
import { calculateWaitMinutes, formatWaitMinutes } from "./waitTime";
import { calculateHaversineDistanceKm } from "./geo";
import type {
  Centre,
  CentreEvaluation,
  ExplanationFragments,
  FarmerLocation,
  Location,
  ProcurementRequest,
  RecommendationResult,
  WhyChecklistItem,
} from "./types";

/**
 * Calculates great-circle distance between two geo-coordinates in kilometres
 * using the Haversine formula. Rounded to 1 decimal place.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return 999;
  }
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return round1(R * c);
}

/** Composes a localized explanation from engine fragments. */
export function composeExplanation(
  fragments: ExplanationFragments,
  translate: (key: string) => string,
): string {
  return `${translate("explainPrefix")} ${translate(fragments.queue)}, ${translate(
    fragments.capacity,
  )}, ${translate(fragments.distance)}.`;
}

/** Normalises a value from [best, worst] to a 0..1 score (best → 1, worst → 0). */
function normalise(value: number, best: number, worst: number): number {
  if (worst === best) return 1;
  const clamped = Math.min(Math.max(value, Math.min(best, worst)), Math.max(best, worst));
  return (worst - clamped) / (worst - best);
}

/** "14:20" → "2:20 PM" (12-hour label used in UI + SMS). */
export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${suffix}`;
}

/** Adds minutes to a "HH:mm" string, returning "HH:mm". */
function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const total = (h || 0) * 60 + (m || 0) + safeMinutes;
  const rem = total % 1440;
  const hh = String(Math.floor(rem / 60)).padStart(2, "0");
  const mm = String(rem % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Validates whether coordinates are valid finite numbers within earthly bounds. */
function isValidCoordinate(lat?: number, lon?: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** The reusable Coordination Engine entry point. */
export function calculateCentreRecommendation(
  request: ProcurementRequest,
  centres: Centre[],
  farmerLocation?: Location | null,
): RecommendationResult {
  // If location not passed, resolve from locationId or village
  if (farmerLocation === undefined) {
    if (request.locationId) {
      farmerLocation = getFarmerLocation(request.locationId);
    } else if (request.village) {
      farmerLocation = getFarmerLocation(request.village);
    }
  }

  // If location was explicitly given as null (unsupported/unresolved location)
  if (farmerLocation === null) {
    return {
      best: null,
      evaluations: [],
      nearbyEvaluations: [],
      distantAlternatives: [],
      explanation: "",
      explanationFragments: null,
      locationSupported: false,
      resolvedLocation: null,
      noSuitableCentreReason: "Location not recognized. Please select a valid location from the search list.",
    };
  }

  // If farmer location is provided but coordinates are invalid or out of range
  if (
    farmerLocation !== undefined &&
    !isValidCoordinate(farmerLocation.latitude, farmerLocation.longitude)
  ) {
    return {
      best: null,
      evaluations: [],
      nearbyEvaluations: [],
      distantAlternatives: [],
      explanation: "",
      explanationFragments: null,
      locationSupported: false,
      resolvedLocation: farmerLocation,
      noSuitableCentreReason: "Invalid geographic coordinates for location.",
    };
  }

  const hasValidFarmerCoords =
    farmerLocation !== undefined &&
    isValidCoordinate(farmerLocation.latitude, farmerLocation.longitude);

  if (!centres || centres.length === 0) {
    return {
      best: null,
      evaluations: [],
      nearbyEvaluations: [],
      distantAlternatives: [],
      explanation: "",
      explanationFragments: null,
      locationSupported: true,
      resolvedLocation: farmerLocation ?? null,
      noSuitableCentreReason: "No procurement centres currently available.",
    };
  }

  const allEvaluations: CentreEvaluation[] = centres.map((centre) => {
    // If coordinates are valid for both farmer and centre, calculate exact Haversine distance
    const hasValidCentreCoords = isValidCoordinate(centre.latitude, centre.longitude);

    let distanceKm: number;
    if (hasValidFarmerCoords && hasValidCentreCoords) {
      distanceKm = round1(
        calculateHaversineDistanceKm(
          farmerLocation!.latitude,
          farmerLocation!.longitude,
          centre.latitude,
          centre.longitude,
        ),
      );
    } else {
      distanceKm = typeof centre.distanceKm === "number" && Number.isFinite(centre.distanceKm)
        ? centre.distanceKm
        : 999;
    }

    const isWithinServiceRadius = distanceKm <= RECOMMENDATION_CONFIG.serviceRadiusKm;

    const dynamicCentre: Centre = {
      ...centre,
      distanceKm,
    };

    return evaluateCentre(dynamicCentre, request, isWithinServiceRadius);
  });

  // Separate nearby eligible/evaluated centres from distant alternatives
  const nearbyEvaluations = allEvaluations
    .filter((e) => e.isWithinServiceRadius)
    .sort((a, b) => {
      // 1. Eligible comes before ineligible
      if (a.eligibility !== b.eligibility) {
        return a.eligibility === "eligible" ? -1 : 1;
      }

      // 2. Higher total score wins
      return b.score.totalScore - a.score.totalScore;
    });

  const distantAlternatives = allEvaluations
    .filter((e) => !e.isWithinServiceRadius)
    .sort((a, b) => a.centre.distanceKm - b.centre.distanceKm);

  // Combined sorted list: nearby first, then distant
  const evaluations = [...nearbyEvaluations, ...distantAlternatives];

  // Primary recommendation: MUST be within service radius, eligible, and have capacity
  const eligibleNearby = nearbyEvaluations.filter(
    (e) => e.eligibility === "eligible" && e.remainingCapacity > 0 && e.centre.processingRatePerHour > 0,
  );

  const best = eligibleNearby.length > 0 ? eligibleNearby[0] : null;

  const alternatives = evaluations
    .filter((e) => e !== best && e.eligibility === "eligible")
    .slice(0, 5);

  let noSuitableCentreReason: string | undefined;
  if (!best) {
    if (nearbyEvaluations.length === 0) {
      noSuitableCentreReason = `No suitable procurement centre found within the available service area (${RECOMMENDATION_CONFIG.serviceRadiusKm} km).`;
    } else if (!nearbyEvaluations.some((e) => e.eligibility === "eligible")) {
      noSuitableCentreReason = `No procurement centre within the service area (${RECOMMENDATION_CONFIG.serviceRadiusKm} km) currently accepts ${request.crop}.`;
    } else {
      noSuitableCentreReason = `All eligible procurement centres within the service area (${RECOMMENDATION_CONFIG.serviceRadiusKm} km) are currently at full capacity.`;
    }
  }

  return {
    best,
    evaluations,
    nearbyEvaluations,
    distantAlternatives,
    alternatives,
    withinServiceArea: best !== null,
    farmerLocation,
    explanation: best ? composeEnglishFallback(best) : (noSuitableCentreReason ?? ""),
    explanationFragments: best ? buildExplanationFragments(best) : null,
    locationSupported: true,
    resolvedLocation: farmerLocation ?? null,
    noSuitableCentreReason,
  };
}

/** English fallback sentence (the UI uses composeExplanation for localization). */
function composeEnglishFallback(best: CentreEvaluation): string {
  const f = buildExplanationFragments(best);
  const queueText =
    f.queue === "explainShortQueue"
      ? "a short queue"
      : f.queue === "explainManageableWait"
        ? "a manageable wait"
        : "the shortest wait available right now";
  const capacityText =
    f.capacity === "explainPlentyCapacity"
      ? "plenty of remaining capacity"
      : "sufficient capacity";
  const distanceText =
    f.distance === "explainReasonableDistance"
      ? "and it is within a reasonable distance"
      : "while remaining a reasonable option for travel";
  return `Recommended because of ${queueText}, ${capacityText}, ${distanceText}.`;
}

/** Scores one centre against the farmer's location and request. */
function evaluateCentre(
  centre: Centre,
  request: ProcurementRequest,
  isWithinServiceRadius: boolean,
): CentreEvaluation {
  const distanceKm =
    typeof centre.distanceKm === "number" && Number.isFinite(centre.distanceKm)
      ? centre.distanceKm
      : 999;
  const withinServiceArea = isWithinServiceRadius;
  const processingRate = Math.max(0, centre.processingRatePerHour || 0);
  const wait =
    processingRate > 0
      ? calculateWaitMinutes(centre.queueCount, processingRate)
      : Infinity;
  const capacityPerDay = Math.max(0, centre.capacityPerDay || 0);
  const bookedToday = Math.max(0, centre.bookedToday || 0);
  const remainingCapacity = Math.max(0, capacityPerDay - bookedToday);
  const capacityPct =
    capacityPerDay > 0
      ? Math.round((bookedToday / capacityPerDay) * 100)
      : 100;
  const eligible =
    Array.isArray(centre.eligibleCrops) && centre.eligibleCrops.includes(request.crop);

  // Each factor is normalised against fixed reference ranges (0..1),
  // then multiplied by its weight.
  const distanceNorm = isWithinServiceRadius
    ? normalise(distanceKm, 0, RECOMMENDATION_CONFIG.referenceDistanceMaxKm)
    : 0;
  const queueNorm = normalise(Math.max(0, centre.queueCount || 0), 0, 30); // 0 queue great, 30 bad
  const waitNorm = Number.isFinite(wait) ? normalise(wait, 0, 240) : 0; // 4 hr wait worst
  const capacityNorm = normalise(remainingCapacity, 0, Math.max(1, capacityPerDay)); // more remaining is better

  const score = {
    distanceScore: round1(distanceNorm * RECOMMENDATION_CONFIG.distanceWeight),
    queueScore: round1(queueNorm * RECOMMENDATION_CONFIG.queueWeight),
    waitScore: round1(waitNorm * RECOMMENDATION_CONFIG.waitTimeWeight),
    capacityScore: round1(capacityNorm * RECOMMENDATION_CONFIG.capacityWeight),
    eligibilityScore: eligible ? RECOMMENDATION_CONFIG.eligibilityWeight : 0,
    totalScore: 0,
  };

  score.totalScore = round1(
    score.distanceScore +
      score.queueScore +
      score.waitScore +
      score.capacityScore +
      score.eligibilityScore,
  );

  // ---- Recommended arrival window: now + wait (kept inside centre hours).
  const waitMinutes = Number.isFinite(wait) ? wait : 0;
  const closingMin = toMinutes(centre.closesAt || "18:00");
  const openingMin = toMinutes(centre.opensAt || "08:00");
  const rawStart = toMinutes(addMinutes(nowRoundedTo5(), waitMinutes));
  const startMin = Math.max(openingMin, Math.min(rawStart, Math.max(openingMin, closingMin - ARRIVAL_WINDOW_MINUTES)));
  const endMin = startMin + ARRIVAL_WINDOW_MINUTES;
  const start = formatHHMM(startMin);
  const end = formatHHMM(endMin);
  const arrivalWindowLabel = `${formatTime12h(start)} – ${formatTime12h(end)}`;

  const checklist: WhyChecklistItem[] = [
    {
      key: "checklistAcceptsCrop",
      passed: eligible,
      detail: eligible ? request.crop : undefined,
    },
    {
      key: "checklistWithinServiceArea",
      passed: withinServiceArea,
      detail: `${distanceKm} km (max ${RECOMMENDATION_CONFIG.serviceRadiusKm} km)`,
    },
    {
      key: "checklistLowQueue",
      passed: centre.queueCount <= 15,
      detail: `${centre.queueCount} in queue (~${formatWaitMinutes(wait)})`,
    },
    {
      key: "checklistCapacityAvailable",
      passed: remainingCapacity > 0,
      detail: `${remainingCapacity} slots left`,
    },
  ];

  const reasons = buildReasons(centre, request, distanceKm, {
    wait,
    remainingCapacity,
    eligible,
    isWithinServiceRadius,
    distanceScore: score.distanceScore,
    queueScore: score.queueScore,
    waitScore: score.waitScore,
    capacityScore: score.capacityScore,
  });

  return {
    centre,
    eligibility: eligible ? "eligible" : "ineligible",
    distanceKm,
    withinServiceArea,
    capacityPct,
    estimatedWaitMinutes: wait,
    remainingCapacity,
    isWithinServiceRadius,
    arrivalWindowStart: start,
    arrivalWindowEnd: end,
    arrivalWindowLabel,
    score,
    reasons,
    checklist,
  };
}

interface ReasonInput {
  wait: number;
  remainingCapacity: number;
  eligible: boolean;
  isWithinServiceRadius: boolean;
  distanceScore: number;
  queueScore: number;
  waitScore: number;
  capacityScore: number;
}

function buildReasons(
  centre: Centre,
  request: ProcurementRequest,
  distanceKm: number,
  r: ReasonInput,
): string[] {
  const reasons: string[] = [];
  reasons.push(
    `${distanceKm} km away (${r.isWithinServiceRadius ? "within service radius" : "outside service radius"}) — distance score ${r.distanceScore}/${ENGINE_WEIGHTS.distanceWeight}.`,
  );
  reasons.push(
    Number.isFinite(r.wait)
      ? `${centre.queueCount} farmers in queue, ~${formatWaitMinutes(r.wait)} wait — wait score ${r.waitScore}/${ENGINE_WEIGHTS.waitTimeWeight}.`
      : `Centre is currently not processing arrivals (rate: 0).`,
  );
  reasons.push(
    `${r.remainingCapacity} of ${centre.capacityPerDay} slots remaining — capacity score ${r.capacityScore}/${ENGINE_WEIGHTS.capacityWeight}.`,
  );
  reasons.push(
    r.eligible
      ? `Accepts ${request.crop} — eligibility score ${ENGINE_WEIGHTS.eligibilityWeight}/${ENGINE_WEIGHTS.eligibilityWeight}.`
      : `Does NOT accept ${request.crop}.`,
  );
  return reasons;
}

/**
 * Builds translation-key fragments explaining why `best` won. The UI composes
 * them through the language context, so explanations render in English,
 * Kannada or Hindi.
 */
function buildExplanationFragments(best: CentreEvaluation): ExplanationFragments {
  const c = best.centre;
  return {
    queue:
      c.queueCount <= 6
        ? "explainShortQueue"
        : best.estimatedWaitMinutes < 120
          ? "explainManageableWait"
          : "explainShortestWait",
    capacity:
      best.remainingCapacity > 20
        ? "explainPlentyCapacity"
        : "explainSufficientCapacity",
    distance:
      best.distanceKm <= 10 ? "explainReasonableDistance" : "explainReasonableOption",
  };
}

/** Rounds to 1 decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Rounds the current time to the next 5-minute mark, as "HH:mm". */
function nowRoundedTo5(): string {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(total / 5) * 5;
  const hh = String(Math.floor((rounded % 1440) / 60)).padStart(2, "0");
  const mm = String(rounded % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "HH:mm" → minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since midnight → "HH:mm" (clamped to 23:59). */
function formatHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Convenience: is this centre currently "optimal", "busy" or "congested"? */
export function centreLoadStatus(centre: Centre): "optimal" | "busy" | "congested" {
  const ratio =
    centre.processingRatePerHour > 0
      ? centre.queueCount / centre.processingRatePerHour
      : Infinity;
  if (ratio <= LOAD_OPTIMAL) return "optimal";
  if (ratio <= LOAD_BUSY) return "busy";
  return "congested";
}
