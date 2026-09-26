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
      className={`rounded-xl border-2 bg-white p-4 shadow-sm transition-colors ${
        recommended ? "border-emerald-600 ring-2 ring-emerald-600/30" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-700" aria-hidden />
            <h3 className="text-base font-bold text-gray-900">{c.name}</h3>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {evaluation.distanceKm} {t("kmAway")} · {c.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isOffline && (
            <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              📡 {t("lastKnownInfo")}
            </span>
          )}
          <StatusBadge variant={loadStatus} />
          <StatusBadge
            variant={evaluation.eligibility === "eligible" ? "good" : "bad"}
            label={evaluation.eligibility === "eligible" ? t("eligible") : t("notEligible")}
          />
          {!evaluation.isWithinServiceRadius && (
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              Outside radius
            </span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
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
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="font-semibold">{t("arrivalWindow")}:</span>{" "}
          {evaluation.arrivalWindowLabel}
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
          className="mt-3 min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300"
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
      <span className="text-gray-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="truncate font-semibold text-gray-900">{value}</dd>
      </div>
    </div>
  );
}


