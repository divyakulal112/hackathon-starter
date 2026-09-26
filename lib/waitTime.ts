/**
 * KisanSync — transparent wait-time calculation.
 *
 *   estimatedWaitMinutes = (queueCount / processingRatePerHour) × 60
 *
 * This is a simple, explainable operational estimate for the demo —
 * NOT a real-time prediction model.
 */

/**
 * Returns the estimated wait in minutes.
 * Returns Infinity for zero/negative/invalid processing rates
 * (treated as "not processing today"), and 0 for invalid queue counts.
 */
export function calculateWaitMinutes(
  queueCount: number,
  processingRatePerHour: number,
): number {
  if (
    !Number.isFinite(queueCount) ||
    !Number.isFinite(processingRatePerHour) ||
    processingRatePerHour <= 0
  ) {
    return queueCount > 0 ? Infinity : 0;
  }
  if (queueCount <= 0) return 0;
  return (queueCount / processingRatePerHour) * 60;
}

/** Formats minutes as a readable label, e.g. "48 min" or "1 hr 5 min". */
export function formatWaitMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return "—";
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} hr` : `${h} hr ${rem} min`;
}
