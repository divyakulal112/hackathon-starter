"use client";

import { Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { TRACKING_STAGES } from "@/lib/constants";
import type { TranslationKey } from "@/lib/translations";

/**
 * TrackingStepper — the 8-stage procurement/payment tracker.
 * Stage 8 ("cancelled") is rendered as a separate alert, not a step.
 */
export default function TrackingStepper({
  stageIndex,
  cancelled = false,
}: {
  stageIndex: number;
  cancelled?: boolean;
}) {
  const { t } = useLanguage();
  const steps = TRACKING_STAGES.slice(0, 7); // stages 1–7

  if (cancelled) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
        {t("cancelled")}
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {steps.map((stage, i) => {
        const done = i < stageIndex;
        const active = i === stageIndex;
        const isLast = i === steps.length - 1;
        const labelKey = stage.key as TranslationKey;

        return (
          <li key={stage.key} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={`absolute left-[11px] top-6 h-[calc(100%-24px)] w-0.5 ${
                  done ? "bg-emerald-600" : "bg-stone-200"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                done
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : active
                    ? "border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-500/15"
                    : "border-stone-200 bg-white text-stone-400"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={`text-sm leading-6 ${
                active
                  ? "font-semibold text-stone-900"
                  : done
                    ? "font-medium text-stone-700"
                    : "text-stone-400"
              }`}
            >
              {t(labelKey)}
              {active && (
                <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  ●
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
