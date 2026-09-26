/**
 * KisanSync — Coordination Engine.
 *
 * Transparent, rule-based scoring. No AI/ML — every point is traceable:
 *
 *   totalScore = distanceScore + queueScore + waitScore +
 *                capacityScore + eligibilityScore
 *
 * Weights live in lib/constants.ts (ENGINE_WEIGHTS) so judges can tune them.
 */

import { ARRIVAL_WINDOW_MINUTES, ENGINE_WEIGHTS, LOAD_BUSY, LOAD_OPTIMAL } from "./constants";
import { calculateWaitMinutes, formatWaitMinutes } from "./waitTime";
import type {
  Centre,
  CentreEvaluation,
  ExplanationFragments,
  ProcurementRequest,
  RecommendationResult,
} from "./types";

/** Composes a localized explanation from engine fragments. */
export function composeExplanation(
  fragments: ExplanationFragments,
  translate: (key: string) => string,
): string {
  return `${translate("explainPrefix")} ${translate(fragments.queue)}, ${translate(
    fragments.capacity,
  )}, ${translate(fragments.distance)}.`;
}

/** Normalises a value from [best, worst] to a 0..1 score (best → 1). */
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
  const total = h * 60 + m + minutes;
  const day = Math.floor(total / 1440);
  const rem = total % 1440;
  const hh = String(Math.floor(rem / 60)).padStart(2, "0");
  const mm = String(rem % 60).padStart(2, "0");
  return day > 0 ? "23:59" : `${hh}:${mm}`;
}

/** The reusable Coordination Engine entry point. */
export function calculateCentreRecommendation(
  request: ProcurementRequest,
  centres: Centre[],
): RecommendationResult {
  const evaluations = centres
    .map((centre) => evaluateCentre(centre, request))
    .sort((a, b) => {
      if (a.eligibility !== b.eligibility) {
        return a.eligibility === "eligible" ? -1 : 1;
      }
      return b.score.totalScore - a.score.totalScore;
    });

  const best = evaluations.find((e) => e.eligibility === "eligible") ?? null;
  return {
    best,
    evaluations,
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

/** Scores one centre against the farmer's request. */
function evaluateCentre(
  centre: Centre,
  request: ProcurementRequest,
): CentreEvaluation {
  const wait = calculateWaitMinutes(centre.queueCount, centre.processingRatePerHour);
  const remainingCapacity = Math.max(0, centre.capacityPerDay - centre.bookedToday);
  const eligible = centre.eligibleCrops.includes(request.crop);

  // Each factor is normalised against fixed reference ranges (0..1),
  // then multiplied by its weight. Reference ranges are documented inline.
  const distanceNorm = normalise(centre.distanceKm, 2, 40); // 2 km great, 40 km bad
  const queueNorm = normalise(centre.queueCount, 0, 30); // 0 queue great, 30 bad
  const waitNorm = Number.isFinite(wait) ? normalise(wait, 0, 240) : 0; // 4 hr wait worst
  const capacityNorm = normalise(remainingCapacity, 0, 60); // more remaining is better

  const score = {
    distanceScore: round1(distanceNorm * ENGINE_WEIGHTS.distance),
    queueScore: round1(queueNorm * ENGINE_WEIGHTS.queue),
    waitScore: round1(waitNorm * ENGINE_WEIGHTS.wait),
    capacityScore: round1(capacityNorm * ENGINE_WEIGHTS.capacity),
    eligibilityScore: eligible ? ENGINE_WEIGHTS.eligibility : 0,
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
  // If the queue pushes past closing time, the window back-ends from closing
  // so it always stays ARRIVAL_WINDOW_MINUTES wide and start < end.
  const waitMinutes = Number.isFinite(wait) ? wait : 0;
  const closingMin = toMinutes(centre.closesAt);
  const openingMin = toMinutes(centre.opensAt);
  const rawStart = toMinutes(addMinutes(nowRoundedTo5(), waitMinutes));
  const startMin = Math.max(openingMin, Math.min(rawStart, closingMin - ARRIVAL_WINDOW_MINUTES));
  const endMin = startMin + ARRIVAL_WINDOW_MINUTES;
  const start = formatHHMM(startMin);
  const end = formatHHMM(endMin);
  const arrivalWindowLabel = `${formatTime12h(start)} – ${formatTime12h(end)}`;

  const reasons = buildReasons(centre, request, {
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
    estimatedWaitMinutes: wait,
    remainingCapacity,
    arrivalWindowStart: start,
    arrivalWindowEnd: end,
    arrivalWindowLabel,
    score,
    reasons,
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
  r: ReasonInput,
): string[] {
  const reasons: string[] = [];
  reasons.push(
    `${centre.distanceKm} km away — distance score ${r.distanceScore}/${ENGINE_WEIGHTS.distance}.`,
  );
  reasons.push(
    `${centre.queueCount} farmers in queue, ~${formatWaitMinutes(r.wait)} wait — wait score ${r.waitScore}/${ENGINE_WEIGHTS.wait}.`,
  );
  reasons.push(
    `${r.remainingCapacity} of ${centre.capacityPerDay} slots remaining — capacity score ${r.capacityScore}/${ENGINE_WEIGHTS.capacity}.`,
  );
  reasons.push(
    r.eligible
      ? `Accepts ${request.crop} — eligibility score ${ENGINE_WEIGHTS.eligibility}/${ENGINE_WEIGHTS.eligibility}.`
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
      c.distanceKm <= 10 ? "explainReasonableDistance" : "explainReasonableOption",
  };
}

/** Rounds to 1 decimal so scores stay readable in the UI. */
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

/** Clamps an "HH:mm" into the centre's operating hours. */
function clampToHours(hhmm: string, centre: Centre): string {
  if (hhmm < centre.opensAt) return centre.opensAt;
  if (hhmm > centre.closesAt) return centre.closesAt;
  return hhmm;
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
  const ratio = centre.processingRatePerHour > 0
    ? centre.queueCount / centre.processingRatePerHour
    : Infinity;
  if (ratio <= LOAD_OPTIMAL) return "optimal";
  if (ratio <= LOAD_BUSY) return "busy";
  return "congested";
}
