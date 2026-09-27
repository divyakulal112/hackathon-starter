"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Warehouse,
  Search,
  RotateCcw,
  CheckCircle2,
  CircleDashed,
  MessageSquareText,
  MapPin,
  Clock,
  Building2,
  Wheat,
  Scale,
  Users,
  Layers,
  Gauge,
  User,
  Edit3,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import NetworkLoadSimulator from "@/components/NetworkLoadSimulator";
import SmsSimulatorDrawer from "@/components/SmsSimulatorDrawer";
import StatusBadge from "@/components/StatusBadge";
import CentreSetupModal from "@/components/CentreSetupModal";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";
import { centreLoadStatus } from "@/lib/recommendationEngine";
import { stageKeyFor, actionLabelForStatus } from "@/lib/constants";
import type { Appointment, AppointmentStatus, DemoCentreProfile } from "@/lib/types";
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
  if (current === "slot_booked") return PIPELINE[0].status;
  if (current === "payment_initiated") return "payment_received";
  if (idx >= 0 && idx < PIPELINE.length - 1) return PIPELINE[idx + 1].status;
  return null;
}

function getProcurementAgency(source?: string): string {
  switch (source?.toLowerCase()) {
    case "ksamb":
      return "Karnataka State Agricultural Marketing Board (KSAMB)";
    case "fci":
      return "Food Corporation of India (FCI)";
    case "damb":
      return "Delhi Agricultural Marketing Board (DAMB)";
    case "vfpck":
      return "Vegetable & Fruit Promotion Council Keralam (VFPCK)";
    case "msamb":
      return "Maharashtra State Agricultural Marketing Board (MSAMB)";
    case "ts_marketing":
      return "Telangana State Agricultural Marketing Department";
    default:
      return "State APMC & Department of Agriculture";
  }
}

function formatCentreType(type?: string): string {
  switch (type) {
    case "apmc_mandi":
      return "APMC Mandi";
    case "sub_yard":
      return "Sub-Market Yard";
    case "msp_procurement_hub":
      return "MSP Procurement Hub";
    case "cooperative_society":
      return "Cooperative Society / PACS";
    case "collection_centre":
      return "Primary Collection Centre";
    default:
      return "Procurement Hub";
  }
}

export default function CentreDashboard() {
  const { t } = useLanguage();
  const {
    centres,
    appointments,
    smsOutbox,
    advanceAppointment,
    resetDemoData,
  } = useAppState();

  const [selectedCentreId, setSelectedCentreId] = useState<string>("");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupToken, setLookupToken] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);

  // Centre Setup Profile State
  const [centreProfile, setCentreProfile] = useState<DemoCentreProfile | null>(null);
  const [isCentreProfileReady, setIsCentreProfileReady] = useState(false);
  const [isEditingCentreProfile, setIsEditingCentreProfile] = useState(false);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem("freebuff_centre_profile") ||
        localStorage.getItem("centreProfile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.isSetupComplete || parsed.name || parsed.centreId)) {
          setCentreProfile(parsed);
          if (parsed.centreId) {
            setSelectedCentreId(parsed.centreId);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load centre profile from localStorage:", err);
    } finally {
      setIsCentreProfileReady(true);
    }
  }, []);

  function handleSaveCentreProfile(newProfile: DemoCentreProfile) {
    setCentreProfile(newProfile);
    setSelectedCentreId(newProfile.centreId);
    setIsEditingCentreProfile(false);
    try {
      localStorage.setItem("freebuff_centre_profile", JSON.stringify(newProfile));
      localStorage.setItem("centreProfile", JSON.stringify(newProfile));
    } catch (err) {
      console.error("Failed to save centre profile to localStorage:", err);
    }
  }

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

  // Derive custom profile overrides if centre matches profile
  const isMatchingProfile = Boolean(
    centreProfile && (centreProfile.centreId === centre.id || !selectedCentreId),
  );

  const displayName = isMatchingProfile && centreProfile?.name ? centreProfile.name : centre.name;
  const displayAgency = isMatchingProfile && centreProfile?.agency
    ? centreProfile.agency
    : getProcurementAgency(centre.source);
  const displayAddress = isMatchingProfile && centreProfile?.address
    ? centreProfile.address
    : (centre.address || centre.location);
  const displayDistrictState = isMatchingProfile && (centreProfile?.district || centreProfile?.state)
    ? `${centreProfile?.district || "Dakshina Kannada"}, ${centreProfile?.state || "Karnataka"}`
    : centre.district
    ? `${centre.district}, ${centre.state || "Karnataka"}`
    : centre.location;
  const displayHours = isMatchingProfile && centreProfile?.operatingHours
    ? `${centreProfile.operatingHours.opening} – ${centreProfile.operatingHours.closing}`
    : `${centre.opensAt} – ${centre.closesAt}`;
  const displayCrops = isMatchingProfile && centreProfile?.supportedCrops?.length
    ? centreProfile.supportedCrops
    : centre.eligibleCrops;

  // Capacity & Operations configuration
  const dailyCapacityQuintals = isMatchingProfile && centreProfile?.dailyCapacity
    ? centreProfile.dailyCapacity
    : centre.capacityPerDay;
  const dailyCapacityKg = isMatchingProfile && centreProfile?.dailyCapacityKg
    ? centreProfile.dailyCapacityKg
    : dailyCapacityQuintals * 100;
  const processingRatePerHour = isMatchingProfile && centreProfile?.processingRatePerHour
    ? centreProfile.processingRatePerHour
    : centre.processingRatePerHour;

  // System-derived dynamic metrics:
  // Active requests awaiting completion (in pipeline before procurement is completed)
  const activeRequests = centreAppointments.filter(
    (a) =>
      a.status === "slot_booked" ||
      a.status === "arrived" ||
      a.status === "weighed" ||
      a.status === "quality_verified",
  );

  const pendingRequestsCount = activeRequests.length;

  // Committed capacity from active requests
  const committedQuintals = activeRequests.reduce(
    (sum, a) => sum + (a.quantityQuintals || 0),
    0,
  );
  const committedKg = committedQuintals * 100;

  // Available Capacity: Daily Capacity - committed capacity from active requests
  const availableCapacityKg = Math.max(0, dailyCapacityKg - committedKg);
  const availableCapacityQuintals = Math.max(
    0,
    Math.round((dailyCapacityQuintals - committedQuintals) * 10) / 10,
  );

  // Total operating hours
  const openingStr = isMatchingProfile && centreProfile?.operatingHours?.opening
    ? centreProfile.operatingHours.opening
    : centre.opensAt;
  const closingStr = isMatchingProfile && centreProfile?.operatingHours?.closing
    ? centreProfile.operatingHours.closing
    : centre.closesAt;
  const [openH = 6, openM = 0] = (openingStr || "06:00").split(":").map(Number);
  const [closeH = 18, closeM = 0] = (closingStr || "18:00").split(":").map(Number);
  const totalOperatingHours = Math.max(1, (closeH + closeM / 60) - (openH + openM / 60));

  // Available slots: deterministic calculation based on remaining capacity and throughput
  const maxTimeSlots = Math.max(
    0,
    Math.round(totalOperatingHours * processingRatePerHour) - pendingRequestsCount,
  );
  const capacitySlots = Math.max(0, Math.floor(availableCapacityQuintals / 10));
  const availableSlotsCount = Math.max(
    0,
    availableCapacityQuintals <= 0 ? 0 : Math.min(capacitySlots, maxTimeSlots),
  );

  const quotaPct = dailyCapacityKg > 0
    ? Math.min(100, Math.round((committedKg / dailyCapacityKg) * 100))
    : 0;

  const loadStatus = centreLoadStatus(centre);

  // Intake terminal: derive looked up appointment
  const lookedUp = useMemo(() => {
    if (!lookupToken || !centre) return null;
    const token = lookupToken.toUpperCase();
    const localMatch = appointments.find(
      (a) => a.centreId === centre.id && a.tokenNumber.toUpperCase() === token,
    );
    if (localMatch) return localMatch;
    return appointments.find((a) => a.tokenNumber.toUpperCase() === token) ?? null;
  }, [lookupToken, appointments, centre]);

  const lookedUpNext = lookedUp ? nextPipelineStatus(lookedUp.status) : null;
  const showNotFound = lookupToken !== null && !lookedUp && !lookupError;

  function doLookup(rawValue: string) {
    const token = rawValue.trim();
    if (!token) return;
    setLookupError(null);
    setLookupToken(token);
  }

  return (
    <div className="min-h-svh pb-28 bg-stone-50/50">
      <AppHeader />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {/* Centre Profile & Identity Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/90 bg-white px-4 py-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shadow-2xs">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {t("centreSetup")}
                </span>
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 border border-stone-200">
                  {centreProfile?.isSetupComplete ? "Setup Complete" : "Demo Preset"}
                </span>
              </div>
              <p className="text-sm font-bold text-stone-900">
                {displayName} · {displayAgency}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingCentreProfile(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <Edit3 className="h-3.5 w-3.5 text-stone-400" />
            {t("editSetup")}
          </button>
        </div>

        {/* Centre selector + reset */}
        <div className="flex flex-wrap items-center gap-2">
          <Warehouse className="h-4 w-4 text-emerald-600" />
          <select
            value={centre.id}
            onChange={(e) => {
              setSelectedCentreId(e.target.value);
              setLookupToken(null);
              setLookupError(null);
              setLookupInput("");
            }}
            aria-label={t("selectCentre")}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-2xs focus:border-stone-400 focus:outline-hidden"
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
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 text-stone-400" />
            {t("resetDemo")}
          </button>
        </div>

        {/* 1. Centre Profile & Information Card */}
        <section className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-stone-900">{displayName}</h2>
                <span className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-xs font-medium text-stone-600">
                  {t("centreId")}: {centre.id}
                </span>
                <span className="rounded-full bg-stone-100 border border-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                  {formatCentreType(centre.centreType)}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                <MapPin className="h-3.5 w-3.5 text-stone-400" />
                <span>{displayAddress}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingCentreProfile(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors shadow-2xs"
            >
              <Edit3 className="h-3.5 w-3.5 text-stone-400" />
              {t("centreProfile")}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <Building2 className="h-3.5 w-3.5 text-stone-400" />
                {t("procurementAgency")}
              </span>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {displayAgency}
              </p>
            </div>

            <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <MapPin className="h-3.5 w-3.5 text-stone-400" />
                {t("locationAddress")}
              </span>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {displayDistrictState}
              </p>
            </div>

            <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                <Clock className="h-3.5 w-3.5 text-stone-400" />
                {t("operatingHours")}
              </span>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {displayHours}
              </p>
            </div>
          </div>

          {/* Supported Crops */}
          <div className="mt-4 border-t border-stone-100 pt-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              <Wheat className="h-3.5 w-3.5 text-emerald-600" />
              {t("supportedCrops")}
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {displayCrops.map((crop) => (
                <span
                  key={crop}
                  className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-700"
                >
                  {crop}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Operations Overview & Capacity Quota */}
        <section className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {t("operationsOverview")}
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {t("capacityQuota")}: {committedQuintals} / {dailyCapacityQuintals} q (
                {committedKg.toLocaleString("en-IN")} /{" "}
                {dailyCapacityKg.toLocaleString("en-IN")} kg)
              </p>
            </div>
            <span className="text-xs font-medium text-stone-700">
              {availableCapacityQuintals} q ({availableCapacityKg.toLocaleString("en-IN")} kg) {t("remainingCapacity")}
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={quotaPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-100"
          >
            <div
              className={`h-full rounded-full transition-all ${
                quotaPct >= 90 ? "bg-rose-500" : quotaPct >= 70 ? "bg-amber-400" : "bg-emerald-500"
              }`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            <OpStatCard
              icon={<Scale className="h-4 w-4 text-emerald-600" />}
              label={t("dailyCapacity")}
              mainValue={`${dailyCapacityKg.toLocaleString("en-IN")} kg`}
              subValue={`${dailyCapacityQuintals} quintals/day`}
            />
            <OpStatCard
              icon={<Gauge className="h-4 w-4 text-sky-600" />}
              label={t("availableCapacity")}
              mainValue={`${availableCapacityKg.toLocaleString("en-IN")} kg`}
              subValue={`${availableCapacityQuintals} quintals remaining`}
            />
            <OpStatCard
              icon={<Layers className="h-4 w-4 text-purple-600" />}
              label={t("processingRate")}
              mainValue={`${processingRatePerHour} farmers/hr`}
              subValue={`~${processingRatePerHour * 100} kg/hr throughput`}
            />
            <OpStatCard
              icon={<Users className="h-4 w-4 text-amber-600" />}
              label={t("pendingRequests")}
              mainValue={`${pendingRequestsCount} active`}
              subValue={`${pendingRequestsCount} awaiting completion`}
            />
            <OpStatCard
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              label={t("availableSlots")}
              mainValue={`${availableSlotsCount}`}
              subValue="slots remaining today"
            />
          </div>
        </section>

        {/* 3. Live intake terminal */}
        <section className="rounded-xl border border-stone-800 bg-stone-900/95 backdrop-blur-xs p-4 text-white shadow-xl">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
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
              className="min-h-10 flex-1 rounded-lg border border-stone-700 bg-stone-800/80 px-3 font-mono text-sm uppercase text-stone-100 placeholder:text-stone-500 focus:border-stone-500 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => doLookup(lookupInput)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
            >
              <Search className="h-4 w-4" aria-hidden />
              {t("lookup")}
            </button>
          </div>

          {showNotFound && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-rose-950/80 border border-rose-800/60 px-3 py-2 text-xs font-medium text-rose-300"
            >
              {t("tokenNotFound")}
            </p>
          )}

          {lookedUp && (
            <div className="mt-3 rounded-lg border border-stone-800 bg-stone-800/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-emerald-650 px-2 py-0.5 font-mono text-xs font-semibold text-white">
                  {lookedUp.tokenNumber}
                </span>
                <span className="font-semibold text-stone-100">{lookedUp.farmerName}</span>
                <span className="text-xs text-stone-400">
                  {lookedUp.crop} · {lookedUp.quantityQuintals} q
                  {lookedUp.estimatedAmountInr != null
                    ? ` · ₹${lookedUp.estimatedAmountInr.toLocaleString("en-IN")}`
                    : ""}
                </span>
                <StatusBadge
                  variant={lookedUp.status === "cancelled" ? "bad" : lookedUpNext === null ? "good" : "busy"}
                  label={t(stageKeyFor(lookedUp.status))}
                />
              </div>

              <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                {t("nextAction")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {lookedUp.status === "cancelled" ? (
                  <span className="text-xs text-rose-300">{t("cancelled")}</span>
                ) : lookedUpNext === null ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("pipelineDone")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => advanceAppointment(lookedUp.id)}
                    className="min-h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 active:bg-emerald-700 transition-colors"
                  >
                    {t(actionLabelForStatus(lookedUpNext))}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 4. Live queue table */}
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            {t("liveQueue")}
            <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-xs font-semibold text-stone-700">
              {centreAppointments.length}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-stone-200/90 bg-white shadow-2xs">
            <table className="w-full min-w-160 text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="px-3.5 py-2.5 font-semibold">{t("yourToken")}</th>
                  <th className="px-3.5 py-2.5 font-semibold">{t("farmerCol")}</th>
                  <th className="px-3.5 py-2.5 font-semibold">{t("cropCol")}</th>
                  <th className="px-3.5 py-2.5 font-semibold">{t("qtyCol")}</th>
                  <th className="px-3.5 py-2.5 font-semibold">{t("stageCol")}</th>
                  <th className="px-3.5 py-2.5 text-right font-semibold">{t("actionCol")}</th>
                </tr>
              </thead>
              <tbody>
                {centreAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-stone-400">
                      {t("smsEmpty")}
                    </td>
                  </tr>
                ) : (
                  centreAppointments.map((a) => {
                    const next = nextPipelineStatus(a.status);
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-stone-100 last:border-0 hover:bg-stone-50/70 transition-colors"
                      >
                        <td className="px-3.5 py-2.5 font-mono text-xs font-semibold text-stone-900">
                          {a.tokenNumber}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-stone-900">
                          {a.farmerName}
                        </td>
                        <td className="px-3.5 py-2.5 text-stone-600 text-xs">{a.crop}</td>
                        <td className="px-3.5 py-2.5 text-stone-600 text-xs">{a.quantityQuintals}</td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge
                            variant={a.status === "cancelled" ? "bad" : next === null ? "good" : "busy"}
                            label={t(stageKeyFor(a.status))}
                          />
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {next === null || a.status === "cancelled" ? (
                            <CircleDashed className="ml-auto h-4 w-4 text-stone-300" aria-hidden />
                          ) : (
                            <button
                              type="button"
                              onClick={() => advanceAppointment(a.id)}
                              className="min-h-8 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                            >
                              {t(actionLabelForStatus(next))}
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

      {/* Centre Setup Onboarding & Edit Modal */}
      {isCentreProfileReady && (
        <CentreSetupModal
          isOpen={!centreProfile || isEditingCentreProfile}
          isEdit={Boolean(centreProfile && isEditingCentreProfile)}
          initialProfile={centreProfile}
          onSave={handleSaveCentreProfile}
          onClose={centreProfile ? () => setIsEditingCentreProfile(false) : undefined}
        />
      )}

      <button
        type="button"
        onClick={() => setSmsOpen(true)}
        className="fixed bottom-4 right-4 z-30 min-h-10 rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-stone-800 hover:bg-stone-800 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-emerald-400" />
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

function OpStatCard({
  icon,
  label,
  mainValue,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  mainValue: string;
  subValue: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-stone-100 bg-stone-50/80 p-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
          {label}
        </span>
        <span className="rounded-md bg-white p-1 shadow-2xs ring-1 ring-stone-200/60">
          {icon}
        </span>
      </div>
      <div className="mt-2.5">
        <p className="text-base font-bold tracking-tight text-stone-900">{mainValue}</p>
        <p className="text-[11px] font-normal text-stone-500 mt-0.5">{subValue}</p>
      </div>
    </div>
  );
}
