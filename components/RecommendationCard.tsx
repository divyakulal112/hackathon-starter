"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, Clock, Navigation, CheckCircle2, XCircle, MapPin, Gauge } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
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
  const [showBreakdown, setShowBreakdown] = useState(false);
  const c = best.centre;

  // Voice sentence, composed from the active recommendation + language.
  const voiceSentence = `${t("recommendedForYou")}: ${c.name}. ${best.distanceKm} ${t("kmAway")}. ${t("estimatedWait")}: ${formatWaitMinutes(
    best.estimatedWaitMinutes,
  )}. ${t("arrivalWindow")}: ${best.arrivalWindowLabel}.`;

  return (
    <section
      aria-label={t("recommendedForYou")}
      className="rounded-2xl border-2 border-emerald-600 bg-linear-to-br from-emerald-700 via-emerald-800 to-emerald-900 p-5 text-white shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
          <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
          {t("recommendedForYou")}
        </span>
        <StatusBadge
          variant={best.eligibility === "eligible" ? "good" : "bad"}
          label={`${t("score")} ${best.score.totalScore}/${MAX_TOTAL_SCORE}`}
        />
      </div>

      <div className="mt-3">
        <h2 className="text-2xl font-black leading-tight tracking-tight">{c.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-emerald-200">
          <MapPin className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>
            {best.distanceKm} {t("kmAway")} · {c.location} ({c.district})
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs">
          <div className="flex items-center gap-1 text-emerald-200">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t("estimatedWait")}</span>
          </div>
          <p className="mt-1 text-lg font-extrabold">
            {formatWaitMinutes(best.estimatedWaitMinutes)}
          </p>
        </div>

        <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs">
          <div className="flex items-center gap-1 text-emerald-200">
            <Navigation className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t("arrivalWindow")}</span>
          </div>
          <p className="mt-1 text-base font-extrabold">{best.arrivalWindowLabel}</p>
        </div>

        <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs">
          <div className="flex items-center gap-1 text-emerald-200">
            <Gauge className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t("queue")}</span>
          </div>
          <p className="mt-1 text-lg font-extrabold">
            {c.queueCount} {t("inQueue")}
          </p>
        </div>

        <div className="rounded-xl bg-white/10 p-3 backdrop-blur-xs">
          <div className="flex items-center gap-1 text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t("remainingCapacity")}</span>
          </div>
          <p className="mt-1 text-lg font-extrabold">
            {best.remainingCapacity} {t("of")} {c.capacityPerDay}
          </p>
        </div>
      </div>

      {/* Why this centre checklist */}
      <div className="mt-4 rounded-xl bg-emerald-950/50 p-3.5 border border-emerald-600/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
          {t("whyRecommended")}
        </h3>
        <p className="mt-1 text-sm text-emerald-50 leading-relaxed font-medium">
          {explanation}
        </p>

        {best.checklist && best.checklist.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 pt-2.5 border-t border-emerald-800/60 text-xs">
            {best.checklist.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                {item.passed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold text-emerald-100">
                    {t(item.key as Parameters<typeof t>[0]) || item.key}
                  </span>
                  {item.detail && (
                    <span className="block text-[11px] text-emerald-300/80">
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
          className="min-h-12 flex-1 rounded-xl bg-white px-5 font-extrabold text-emerald-900 shadow-md hover:bg-emerald-50 active:bg-emerald-100 transition-all text-base"
        >
          {t("bookThisSlot")}
        </button>
        <VoiceAssistButton sentence={voiceSentence} />
      </div>

      {/* How scored accordion */}
      <button
        type="button"
        onClick={() => setShowBreakdown((s) => !s)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-emerald-900/40 px-3.5 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-900/60 transition-colors"
        aria-expanded={showBreakdown}
      >
        <span>{t("howScored")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${showBreakdown ? "rotate-180" : ""}`}
        />
      </button>

      {showBreakdown && (
        <dl className="mt-2 space-y-2 rounded-xl bg-emerald-950/60 p-3.5 text-sm border border-emerald-800/40">
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
          <div className="mt-2 flex justify-between border-t border-emerald-700/60 pt-2.5 font-black text-sm">
            <dt className="text-emerald-100">{t("score")}</dt>
            <dd className="text-emerald-300">
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
        <dt className="text-emerald-200">{label}</dt>
        <dd className="font-bold text-emerald-50">
          {value} / {max}
        </dd>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-emerald-900/80">
        <div className="h-full rounded-full bg-emerald-400 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
