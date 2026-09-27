"use client";

import { Clock, Users, Zap, MapPin, Gauge } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";
import { formatWaitMinutes } from "@/lib/waitTime";
import { centreLoadStatus } from "@/lib/recommendationEngine";
import type { CentreEvaluation } from "@/lib/types";
import StatusBadge from "./StatusBadge";

/**
 * CentreCard — one nearby procurement centre with live operational metrics.
 * Shows the engine evaluation (score, window) and crop eligibility for the
 * farmer's currently selected crop.
 */
export default function CentreCard({
  evaluation,
  recommended = false,
  onSelect,
}: {
  evaluation: CentreEvaluation;
  recommended?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useLanguage();
  const { isOffline } = useAppState();
  const { centre: c } = evaluation;
  const loadStatus = centreLoadStatus(c);
  const eligible = evaluation.eligibility === "eligible";
  // A centre is only bookable when it accepts the crop AND has slots left.
  const bookable = eligible && evaluation.remainingCapacity > 0;

  return (
    <div
      className={`rounded-xl bg-white p-4 shadow-2xs transition-all ${
        recommended
          ? "border-2 border-emerald-600 ring-2 ring-emerald-600/10"
          : "border border-stone-200/90 hover:border-stone-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
            <h3 className="text-base font-bold text-stone-900">{c.name}</h3>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {evaluation.distanceKm} {t("kmAway")} · {c.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isOffline && (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              📡 {t("lastKnownInfo")}
            </span>
          )}
          <StatusBadge variant={loadStatus} />
          <StatusBadge
            variant={evaluation.eligibility === "eligible" ? "good" : "bad"}
            label={evaluation.eligibility === "eligible" ? t("eligible") : t("notEligible")}
          />
          {!evaluation.isWithinServiceRadius && (
            <span className="inline-flex rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
              Outside radius
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Metric
          icon={<Users className="h-4 w-4" />}
          label={t("queue")}
          value={`${c.queueCount} ${t("inQueue")}`}
        />
        <Metric
          icon={<Clock className="h-4 w-4" />}
          label={t("estimatedWait")}
          value={formatWaitMinutes(evaluation.estimatedWaitMinutes)}
        />
        <Metric
          icon={<Zap className="h-4 w-4" />}
          label={t("processingRate")}
          value={`${c.processingRatePerHour} ${t("farmersPerHour")}`}
        />
        <Metric
          icon={<Gauge className="h-4 w-4" />}
          label={t("remainingCapacity")}
          value={`${evaluation.remainingCapacity} / ${c.capacityPerDay}`}
        />
      </dl>

      {recommended && (
        <p suppressHydrationWarning className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
          <span className="font-semibold">{t("arrivalWindow")}:</span>{" "}
          <span suppressHydrationWarning>{evaluation.arrivalWindowLabel}</span>
        </p>
      )}

      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          disabled={!bookable}
          title={
            eligible
              ? undefined
              : `${t("notEligible")}: ${c.name}`
          }
          className="mt-3.5 min-h-10 w-full rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 disabled:border disabled:border-stone-200 transition-colors"
        >
          {t("bookToken")}
        </button>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-stone-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-stone-500">{label}</dt>
        <dd className="truncate font-semibold text-stone-900 text-sm">{value}</dd>
      </div>
    </div>
  );
}
