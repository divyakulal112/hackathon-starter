"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, Clock, Navigation, CheckCircle2, XCircle, MapPin, Gauge } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";
import { ENGINE_WEIGHTS, MAX_TOTAL_SCORE } from "@/lib/constants";
import { formatWaitMinutes } from "@/lib/waitTime";
import type { CentreEvaluation } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import VoiceAssistButton from "./VoiceAssistButton";

/**
 * RecommendationCard — the Coordination Engine's output, front and centre.
 * Shows the winning centre, the transparent score breakdown, the
 * "why this centre" checklist, voice assist and booking actions.
 */
export default function RecommendationCard({
  best,
  explanation,
  onBook,
}: {
  best: CentreEvaluation;
  explanation: string;
  onBook: () => void;
}) {
  const { t } = useLanguage();
  const { isOffline, lastKnownSyncTime } = useAppState();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const c = best.centre;

  // Voice sentence, composed from the active recommendation + language.
  const voiceSentence = `${t("recommendedForYou")}: ${c.name}. ${best.distanceKm} ${t("kmAway")}. ${t("estimatedWait")}: ${formatWaitMinutes(
    best.estimatedWaitMinutes,
  )}. ${t("arrivalWindow")}: ${best.arrivalWindowLabel}.`;

  return (
    <section
      aria-label={t("recommendedForYou")}
      className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-2xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200/80">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          {t("recommendedForYou")}
        </span>
        <div className="flex items-center gap-2">
          {isOffline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">
              📡 {t("lastKnownInfo")}
            </span>
          )}
          <StatusBadge
            variant={best.eligibility === "eligible" ? "good" : "bad"}
            label={`${t("score")} ${best.score.totalScore}/${MAX_TOTAL_SCORE}`}
          />
        </div>
      </div>

      <div className="mt-3">
        <h2 className="text-xl font-bold tracking-tight text-stone-900">{c.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          <span>
            {best.distanceKm} {t("kmAway")} · {c.location}
            {c.district && c.district !== c.location ? ` (${c.district})` : ""}
            {c.state ? `, ${c.state}` : ""}
          </span>
        </div>
      </div>

      {isOffline && (
        <div suppressHydrationWarning className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
          <span>📡</span>
          <span suppressHydrationWarning>
            {t("lastKnownInfo")}
            {lastKnownSyncTime > 0
              ? ` (${new Date(lastKnownSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
              : ""}
          </span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
        <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
          <div className="flex items-center gap-1.5 text-stone-500">
            <Clock className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-xs font-medium">{t("estimatedWait")}</span>
          </div>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-stone-900">
            {formatWaitMinutes(best.estimatedWaitMinutes)}
          </p>
        </div>

        <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
          <div className="flex items-center gap-1.5 text-stone-500">
            <Navigation className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-xs font-medium">{t("arrivalWindow")}</span>
          </div>
          <p className="mt-1.5 text-sm font-bold tracking-tight text-stone-900 truncate" suppressHydrationWarning>{best.arrivalWindowLabel}</p>
        </div>

        <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
          <div className="flex items-center gap-1.5 text-stone-500">
            <Gauge className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-xs font-medium">{t("queue")}</span>
          </div>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-stone-900">
            {c.queueCount} <span className="text-xs font-normal text-stone-500">{t("inQueue")}</span>
          </p>
        </div>

        <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
          <div className="flex items-center gap-1.5 text-stone-500">
            <Sparkles className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-xs font-medium">{t("remainingCapacity")}</span>
          </div>
          <p className="mt-1.5 text-lg font-bold tracking-tight text-stone-900">
            {best.remainingCapacity} <span className="text-xs font-normal text-stone-500">{t("of")} {c.capacityPerDay}</span>
          </p>
        </div>
      </div>

      {/* Why this centre checklist */}
      <div className="mt-4 rounded-lg border border-stone-200/80 bg-stone-50/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {t("whyRecommended")}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
          {explanation}
        </p>

        {best.checklist && best.checklist.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 pt-3 border-t border-stone-200/70 text-xs">
            {best.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                {item.passed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                )}
                <div>
                  <span className="font-medium text-stone-800">
                    {t(item.key as Parameters<typeof t>[0]) || item.key}
                  </span>
                  {item.detail && (
                    <span className="block text-[11px] text-stone-500">
                      {item.detail}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onBook}
          className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-5 font-semibold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors text-sm"
        >
          {t("bookThisSlot")}
        </button>
        <VoiceAssistButton sentence={voiceSentence} />
      </div>

      {/* How scored accordion */}
      <button
        type="button"
        onClick={() => setShowBreakdown((s) => !s)}
        className="mt-3 flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        aria-expanded={showBreakdown}
      >
        <span>{t("howScored")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${showBreakdown ? "rotate-180" : ""}`}
        />
      </button>

      {showBreakdown && (
        <dl className="mt-2 space-y-2.5 rounded-lg border border-stone-200 bg-stone-50/60 p-3.5 text-sm">
          <BreakdownRow
            label={`${t("distance")} (${best.distanceKm} km)`}
            value={best.score.distanceScore}
            max={ENGINE_WEIGHTS.distanceWeight}
          />
          <BreakdownRow
            label={`${t("queue")} (${c.queueCount} ${t("inQueue")})`}
            value={best.score.queueScore}
            max={ENGINE_WEIGHTS.queueWeight}
          />
          <BreakdownRow
            label={`${t("estimatedWait")} (~${formatWaitMinutes(best.estimatedWaitMinutes)})`}
            value={best.score.waitScore}
            max={ENGINE_WEIGHTS.waitTimeWeight}
          />
          <BreakdownRow
            label={`${t("remainingCapacity")} (${best.remainingCapacity}/${c.capacityPerDay})`}
            value={best.score.capacityScore}
            max={ENGINE_WEIGHTS.capacityWeight}
          />
          <BreakdownRow
            label={`${t("eligible")} (${best.eligibility === "eligible" ? "Yes" : "No"})`}
            value={best.score.eligibilityScore}
            max={ENGINE_WEIGHTS.eligibilityWeight}
          />
          <div className="mt-2.5 flex justify-between border-t border-stone-200 pt-2.5 font-bold text-sm">
            <dt className="text-stone-700">{t("score")}</dt>
            <dd className="text-emerald-700">
              {best.score.totalScore} / {MAX_TOTAL_SCORE}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function BreakdownRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <dt className="text-stone-600">{label}</dt>
        <dd className="font-medium text-stone-900">
          {value} / {max}
        </dd>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
