"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, Clock, Navigation } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { ENGINE_WEIGHTS, MAX_TOTAL_SCORE } from "@/lib/constants";
import { formatWaitMinutes } from "@/lib/waitTime";
import type { CentreEvaluation } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import VoiceAssistButton from "./VoiceAssistButton";

/**
 * RecommendationCard — the Coordination Engine's output, front and centre.
 * Shows the winning centre, the transparent score breakdown and the
 * "why" explanation, plus voice assist and booking actions.
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
  const voiceSentence = `${t("recommendedForYou")}: ${c.name}. ${t("estimatedWait")}: ${formatWaitMinutes(
    best.estimatedWaitMinutes,
  )}. ${t("arrivalWindow")}: ${best.arrivalWindowLabel}.`;

  return (
    <section
      aria-label={t("recommendedForYou")}
      className="rounded-2xl border-2 border-emerald-600 bg-linear-to-br from-emerald-700 to-emerald-800 p-4 text-white shadow-lg"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
          <Sparkles className="h-4 w-4" />
          {t("recommendedForYou")}
        </span>
        <StatusBadge
          variant={best.eligibility === "eligible" ? "good" : "bad"}
          label={`${t("score")} ${best.score.totalScore}/${MAX_TOTAL_SCORE}`}
        />
      </div>

      <h2 className="mt-2 text-2xl font-extrabold leading-tight">{c.name}</h2>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white/10 px-3 py-2">
          <div className="flex items-center gap-1 text-emerald-200">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs">{t("estimatedWait")}</span>
          </div>
          <p className="mt-0.5 text-lg font-bold">
            {formatWaitMinutes(best.estimatedWaitMinutes)}
          </p>
        </div>
        <div className="rounded-xl bg-white/10 px-3 py-2">
          <div className="flex items-center gap-1 text-emerald-200">
            <Navigation className="h-3.5 w-3.5" />
            <span className="text-xs">{t("arrivalWindow")}</span>
          </div>
          <p className="mt-0.5 text-lg font-bold">{best.arrivalWindowLabel}</p>
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-emerald-950/40 px-3 py-2 text-sm leading-snug text-emerald-50">
        <span className="font-semibold">{t("whyRecommended")} </span>
        {explanation}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBook}
          className="min-h-12 flex-1 rounded-xl bg-white px-4 font-bold text-emerald-800 shadow hover:bg-emerald-50 active:bg-emerald-100"
        >
          {t("bookThisSlot")}
        </button>
        <VoiceAssistButton sentence={voiceSentence} />
      </div>

      <button
        type="button"
        onClick={() => setShowBreakdown((s) => !s)}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-emerald-900/40 px-3 py-2 text-sm font-semibold text-emerald-100"
        aria-expanded={showBreakdown}
      >
        <span>{t("howScored")}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showBreakdown ? "rotate-180" : ""}`}
        />
      </button>

      {showBreakdown && (
        <dl className="mt-2 space-y-1.5 rounded-xl bg-emerald-950/40 px-3 py-2.5 text-sm">
          <BreakdownRow
            label={t("distance")}
            value={best.score.distanceScore}
            max={ENGINE_WEIGHTS.distance}
          />
          <BreakdownRow
            label={t("queue")}
            value={best.score.queueScore}
            max={ENGINE_WEIGHTS.queue}
          />
          <BreakdownRow
            label={t("estimatedWait")}
            value={best.score.waitScore}
            max={ENGINE_WEIGHTS.wait}
          />
          <BreakdownRow
            label={t("remainingCapacity")}
            value={best.score.capacityScore}
            max={ENGINE_WEIGHTS.capacity}
          />
          <BreakdownRow
            label={t("eligible")}
            value={best.score.eligibilityScore}
            max={ENGINE_WEIGHTS.eligibility}
          />
          <div className="mt-1 flex justify-between border-t border-emerald-700/60 pt-2 font-bold">
            <dt>{t("score")}</dt>
            <dd>
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
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <dt className="text-emerald-100">{label}</dt>
        <dd className="font-semibold text-emerald-50">
          {value} / {max}
        </dd>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/60">
        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
