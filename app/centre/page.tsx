"use client";

import { useMemo, useState } from "react";
import { Warehouse, Search, RotateCcw, CheckCircle2, CircleDashed, MessageSquareText } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import NetworkLoadSimulator from "@/components/NetworkLoadSimulator";
import SmsSimulatorDrawer from "@/components/SmsSimulatorDrawer";
import StatusBadge from "@/components/StatusBadge";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";
import { centreLoadStatus } from "@/lib/recommendationEngine";
import { CENTRE_STATUS_FLOW } from "@/lib/constants";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import type { TranslationKey } from "@/lib/translations";

// ---------------------------------------------------------------------------
// Pipeline: the five one-click operational actions in order.
// ---------------------------------------------------------------------------

const PIPELINE: { status: AppointmentStatus; labelKey: TranslationKey }[] = [
  { status: "arrived", labelKey: "markArrived" },
  { status: "weighed", labelKey: "weighProduce" },
  { status: "quality_verified", labelKey: "verifyQuality" },
  { status: "procurement_completed", labelKey: "completeProcurement" },
  { status: "payment_initiated", labelKey: "releasePayment" },
];

/** Maps a pipeline status to the next one (used for one-click advance). */
function nextPipelineStatus(current: AppointmentStatus): AppointmentStatus | null {
  const idx = PIPELINE.findIndex((p) => p.status === current);
  // slot_booked behaves as "pre-arrival"; payment_initiated's next is payment_received.
  if (current === "slot_booked") return PIPELINE[0].status;
  if (current === "payment_initiated") return "payment_received";
  if (idx >= 0 && idx < PIPELINE.length - 1) return PIPELINE[idx + 1].status;
  return null;
}

export default function CentreDashboard() {
  const { t } = useLanguage();
  const {
    centres,
    appointments,
    smsOutbox,
    advanceAppointment,
    surgeQueue,
    resetDemoData,
  } = useAppState();

  const [selectedCentreId, setSelectedCentreId] = useState<string>("");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupToken, setLookupToken] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);

  const centre = useMemo(
    () => centres.find((c) => c.id === selectedCentreId) ?? centres[0] ?? null,
    [centres, selectedCentreId],
  );

  const centreAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.centreId === centre?.id)
        .sort((a, b) => a.tokenNumber.localeCompare(b.tokenNumber)),
    [appointments, centre?.id],
  );

  // Recovery UI instead of a blank page if centre data is momentarily empty.
  if (!centre) {
    return (
      <div className="min-h-svh">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-10 text-center">
          <p className="text-sm text-gray-600">{t("noCentreData")}</p>
          <button
            type="button"
            onClick={resetDemoData}
            className="mt-4 min-h-12 rounded-xl bg-emerald-600 px-6 font-bold text-white hover:bg-emerald-700"
          >
            {t("resetDemo")}
          </button>
        </main>
      </div>
    );
  }

  const remaining = Math.max(0, centre.capacityPerDay - centre.bookedToday);
  const loadStatus = centreLoadStatus(centre);
  const quotaPct = Math.min(
    100,
    Math.round((centre.bookedToday / centre.capacityPerDay) * 100),
  );
  const waitingCount = centreAppointments.filter(
    (a) => a.status === "slot_booked",
  ).length;

  // ---- Intake terminal: derive the looked-up appointment REACTIVELY ----------
  // The card re-derives from live state on every change, so after advancing
  // (or after a cross-tab sync) the card always shows the current stage.
  const lookedUp = useMemo(() => {
    if (!lookupToken || !centre) return null;
    const token = lookupToken.toUpperCase();
    return (
      appointments.find(
        (a) => a.centreId === centre.id && a.tokenNumber.toUpperCase() === token,
      ) ?? null
    );
  }, [lookupToken, appointments, centre]);

  const lookedUpNext = lookedUp ? nextPipelineStatus(lookedUp.status) : null;

  // "Not found" derives from live state too — computed after lookedUp.
  const showNotFound = lookupToken !== null && !lookedUp && !lookupError;

  function doLookup(rawValue: string) {
    const token = rawValue.trim();
    if (!token) return;
    setLookupError(null);
    setLookupToken(token);
  }

  return (
    <div className="min-h-svh pb-28">
      <AppHeader />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {/* Centre selector + reset */}
        <div className="flex flex-wrap items-center gap-2">
          <Warehouse className="h-5 w-5 text-emerald-700" />
          <select
            value={centre.id}
            onChange={(e) => {
              setSelectedCentreId(e.target.value);
              setLookupToken(null);
              setLookupError(null);
              setLookupInput("");
            }}
            aria-label={t("selectCentre")}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-bold text-gray-900"
          >
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <StatusBadge variant={loadStatus} />
          <button
            type="button"
            onClick={resetDemoData}
            title={t("resetDemoHint")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200"
          >
            <RotateCcw className="h-4 w-4" />
            {t("resetDemo")}
          </button>
        </div>

        {/* Operations bar */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              {t("capacityQuota")}
            </h2>
            <span className="text-xs font-bold text-gray-600">
              {centre.bookedToday} / {centre.capacityPerDay} ·{" "}
              {remaining} {t("remainingCapacity")}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={quotaPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100"
          >
            <div
              className={`h-full rounded-full transition-all ${
                quotaPct >= 90 ? "bg-red-500" : quotaPct >= 70 ? "bg-amber-400" : "bg-emerald-500"
              }`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <OpStat label={t("currentQueue")} value={centre.queueCount} />
            <OpStat
              label={t("processingRate")}
              value={`${centre.processingRatePerHour} ${t("farmersPerHour")}`}
            />
            <OpStat label={t("congestionStatus")} badge={<StatusBadge variant={loadStatus} />} />
            <OpStat label={t("waitingFarmers")} value={waitingCount} />
          </div>
        </section>

        {/* Live intake terminal */}
        <section className="rounded-2xl border border-gray-300 bg-gray-900 p-4 text-white shadow-md">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
            {t("liveIntakeTerminal")}
          </h2>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => {
                setLookupInput(e.target.value);
                setLookupToken(null);
                setLookupError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && doLookup(lookupInput)}
              placeholder={t("lookupToken")}
              aria-label={t("lookupToken")}
              className="min-h-11 flex-1 rounded-xl border border-gray-600 bg-gray-800 px-3 font-mono text-sm uppercase text-emerald-200 placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => doLookup(lookupInput)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500 active:bg-emerald-700"
            >
              <Search className="h-4 w-4" aria-hidden />
              {t("lookup")}
            </button>
          </div>

          {showNotFound && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-950/60 px-3 py-2 text-xs font-semibold text-red-300"
            >
              {t("tokenNotFound")}
            </p>
          )}

          {lookedUp && (
            <div className="mt-3 rounded-xl border border-gray-700 bg-gray-800 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-emerald-600 px-2 py-0.5 font-mono text-xs font-extrabold">
                  {lookedUp.tokenNumber}
                </span>
                <span className="font-bold">{lookedUp.farmerName}</span>
                <span className="text-xs text-gray-400">
                  {lookedUp.crop} · {lookedUp.quantityQuintals} q ·{" "}
                  ₹{lookedUp.estimatedAmountInr.toLocaleString("en-IN")}
                </span>
                <StatusBadge
                  variant={lookedUp.status === "cancelled" ? "bad" : lookedUpNext === null ? "good" : "busy"}
                  label={t(stageKeyFor(lookedUp.status))}
                />
              </div>

              <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {t("nextAction")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {lookedUp.status === "cancelled" ? (
                  <span className="text-xs text-red-300">{t("cancelled")}</span>
                ) : lookedUpNext === null ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("pipelineDone")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => advanceAppointment(lookedUp.id)}
                    className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold hover:bg-emerald-500 active:bg-emerald-700"
                  >
                    {lookedUp.status === "payment_initiated"
                      ? t("paymentReceived")
                      : t(PIPELINE.find((p) => p.status === lookedUpNext)!.labelKey)}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Live queue table */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500">
            {t("liveQueue")}
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-800">
              {centreAppointments.length}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2.5 font-bold">{t("yourToken")}</th>
                  <th className="px-3 py-2.5 font-bold">{t("farmerCol")}</th>
                  <th className="px-3 py-2.5 font-bold">{t("cropCol")}</th>
                  <th className="px-3 py-2.5 font-bold">{t("qtyCol")}</th>
                  <th className="px-3 py-2.5 font-bold">{t("stageCol")}</th>
                  <th className="px-3 py-2.5 text-right font-bold">{t("actionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {centreAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                      {t("smsEmpty")}
                    </td>
                  </tr>
                ) : (
                  centreAppointments.map((a) => {
                    const next = nextPipelineStatus(a.status);
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-emerald-50/40"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs font-extrabold text-emerald-800">
                          {a.tokenNumber}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">
                          {a.farmerName}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{a.crop}</td>
                        <td className="px-3 py-2.5 text-gray-700">{a.quantityQuintals}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge
                            variant={a.status === "cancelled" ? "bad" : next === null ? "good" : "busy"}
                            label={t(stageKeyFor(a.status))}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {next === null || a.status === "cancelled" ? (
                            <CircleDashed className="ml-auto h-4 w-4 text-gray-300" aria-hidden />
                          ) : (
                            <button
                              type="button"
                              onClick={() => advanceAppointment(a.id)}
                              className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 active:bg-emerald-700"
                            >
                              {t(stageKeyFor(next))}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={() => setSmsOpen(true)}
        className="fixed bottom-4 right-4 z-30 min-h-12 rounded-full bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg ring-1 ring-gray-700 hover:bg-gray-800"
      >
        <span className="inline-flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
          {t("viewSms")}
        </span>
      </button>

      <SmsSimulatorDrawer
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        messages={smsOutbox}
      />
      <NetworkLoadSimulator />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers + small components
// ---------------------------------------------------------------------------

function stageKeyFor(status: AppointmentStatus): TranslationKey {
  return (
    {
      slot_booked: "waiting",
      arrived: "arrived",
      weighed: "weighed",
      quality_verified: "qualityVerified",
      procurement_completed: "procurementCompleted",
      payment_initiated: "paymentInitiated",
      payment_received: "paymentReceived",
      cancelled: "cancelled",
    } as const
  )[status];
}

function OpStat({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string | number;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-extrabold text-gray-900">{value ?? badge}</p>
    </div>
  );
}
