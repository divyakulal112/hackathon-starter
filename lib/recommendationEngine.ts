/**
 * KisanSync — Location-Aware Coordination Engine.
 *
 * Transparent, rule-based scoring. No black-box AI/ML — every point is traceable:
 *
 *   totalScore = distanceScore + queueScore + waitScore +
 *                capacityScore + eligibilityScore
 *
 * Weights live in lib/constants.ts (ENGINE_WEIGHTS) so judges can tune them.
 * Location calculation uses the Haversine formula from the farmer's selected
 * location (village / taluk / district coordinates) to each procurement centre.
 */

import {
  ARRIVAL_WINDOW_MINUTES,
  DISTANCE_BEST_KM,
  DISTANCE_WORST_KM,
  ENGINE_WEIGHTS,
  LOAD_BUSY,
  LOAD_OPTIMAL,
  MAX_ALTERNATIVES,
  SERVICE_RADIUS_KM,
} from "./constants";
import { getFarmerLocation } from "./mockData";
import { calculateWaitMinutes, formatWaitMinutes } from "./waitTime";
import type {
  Centre,
  CentreEvaluation,
  ExplanationFragments,
  FarmerLocation,
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
  const total = (h || 0) * 60 + (m || 0) + minutes;
  const rem = total % 1440;
  const hh = String(Math.floor(rem / 60)).padStart(2, "0");
  const mm = String(rem % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** The reusable Coordination Engine entry point. */
export function calculateCentreRecommendation(
  request: ProcurementRequest,
  centres: Centre[],
): RecommendationResult {
  const farmerLocation = getFarmerLocation(request.locationId);

  const evaluations = centres
    .map((centre) => evaluateCentre(centre, request, farmerLocation))
    .sort((a, b) => {
      // 1. Eligible + in service area comes first
      const aInArea = a.eligibility === "eligible" && a.withinServiceArea;
      const bInArea = b.eligibility === "eligible" && b.withinServiceArea;
      if (aInArea !== bInArea) return aInArea ? -1 : 1;

      // 2. Eligible comes before ineligible
      if (a.eligibility !== b.eligibility) {
        return a.eligibility === "eligible" ? -1 : 1;
      }

      // 3. Higher total score wins
      return b.score.totalScore - a.score.totalScore;
    });

  // Recommended centre MUST be eligible AND within the regional service area
  const best =
    evaluations.find((e) => e.eligibility === "eligible" && e.withinServiceArea) ?? null;

  const alternatives = evaluations
    .filter((e) => e !== best && e.eligibility === "eligible")
    .slice(0, MAX_ALTERNATIVES);

  return {
    best,
    evaluations,
    alternatives,
    withinServiceArea: best !== null,
    farmerLocation,
    explanation: best ? composeEnglishFallback(best) : "",
    explanationFragments: best ? buildExplanationFragments(best) : null,
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
  farmerLocation: FarmerLocation,
): CentreEvaluation {
  const distanceKm = haversineDistanceKm(
    farmerLocation.latitude,
    farmerLocation.longitude,
    centre.latitude,
    centre.longitude,
  );
  const withinServiceArea = distanceKm <= SERVICE_RADIUS_KM;

  const wait = calculateWaitMinutes(centre.queueCount, centre.processingRatePerHour);
  const remainingCapacity = Math.max(0, centre.capacityPerDay - centre.bookedToday);
  const capacityPct =
    centre.capacityPerDay > 0
      ? Math.round((centre.bookedToday / centre.capacityPerDay) * 100)
      : 100;
  const eligible = centre.eligibleCrops.includes(request.crop);

  // Normalise each factor against centralized reference bands (0..1)
  const distanceNorm = normalise(distanceKm, DISTANCE_BEST_KM, DISTANCE_WORST_KM);
  const queueNorm = normalise(centre.queueCount, 0, 30);
  const waitNorm = Number.isFinite(wait) ? normalise(wait, 0, 240) : 0;
  const capacityNorm = normalise(remainingCapacity, 0, 60);

  const score = {
    distanceScore: round1(distanceNorm * ENGINE_WEIGHTS.distanceWeight),
    queueScore: round1(queueNorm * ENGINE_WEIGHTS.queueWeight),
    waitScore: round1(waitNorm * ENGINE_WEIGHTS.waitTimeWeight),
    capacityScore: round1(capacityNorm * ENGINE_WEIGHTS.capacityWeight),
    eligibilityScore: eligible ? ENGINE_WEIGHTS.eligibilityWeight : 0,
    totalScore: 0,
  };
  score.totalScore = round1(
    score.distanceScore +
      score.queueScore +
      score.waitScore +
      score.capacityScore +
      score.eligibilityScore,
  );

  // Recommended arrival window: current time + wait clamped to centre hours
  const waitMinutes = Number.isFinite(wait) ? wait : 0;
  const closingMin = toMinutes(centre.closesAt);
  const openingMin = toMinutes(centre.opensAt);
  const rawStart = toMinutes(addMinutes(nowRoundedTo5(), waitMinutes));
  const startMin = Math.max(openingMin, Math.min(rawStart, closingMin - ARRIVAL_WINDOW_MINUTES));
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
      detail: `${distanceKm} km (max ${SERVICE_RADIUS_KM} km)`,
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
    `${distanceKm} km away — distance score ${r.distanceScore}/${ENGINE_WEIGHTS.distanceWeight}.`,
  );
  reasons.push(
    `${centre.queueCount} farmers in queue, ~${formatWaitMinutes(r.wait)} wait — wait score ${r.waitScore}/${ENGINE_WEIGHTS.waitTimeWeight}.`,
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
  const [h, m] = hhmm.split(":").map(Number);
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
