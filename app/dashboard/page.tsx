"use client";

import { useMemo, useState, useEffect } from "react";
import { MessageSquareText, Sprout, MapPin, AlertCircle, Compass, Edit3 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import RecommendationCard from "@/components/RecommendationCard";
import CentreCard from "@/components/CentreCard";
import BookingModal from "@/components/BookingModal";
import TrackingStepper from "@/components/TrackingStepper";
import StatusBadge from "@/components/StatusBadge";
import SmsSimulatorDrawer from "@/components/SmsSimulatorDrawer";
import NetworkLoadSimulator from "@/components/NetworkLoadSimulator";
import FarmerProfileModal from "@/components/FarmerProfileModal";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";
import {
  calculateCentreRecommendation,
  composeExplanation,
} from "@/lib/recommendationEngine";
import {
  DEFAULT_LOCATION_ID,
  DEMO_CROPS,
  DEMO_FARMER_PROFILE,
  LOCATIONS,
  MOCK_LOCATIONS,
  getFarmerLocation,
} from "@/lib/mockData";
import {
  DEMO_FARMER,
  RECOMMENDATION_CONFIG,
  stageKeyFor,
  statusDescriptionKeyFor,
} from "@/lib/constants";
import { resolveLocation } from "@/lib/geo";
import type {
  Appointment,
  CentreEvaluation,
  Crop,
  Location,
  PreferredTime,
  ProcurementRequest,
} from "@/lib/types";

export default function FarmerDashboard() {
  const { t } = useLanguage();
  const {
    centres,
    appointments,
    smsOutbox,
    isOffline,
    queuedRequests,
    saveOfflineBooking,
    cancelOfflineRequest,
    retryOfflineRequest,
    bookToken,
    advanceAppointment,
    cancelBooking,
    archiveAppointment,
  } = useAppState();

  const initialLocation = getFarmerLocation(DEFAULT_LOCATION_ID);

  const [profile, setProfile] = useState<{ name: string; village: string } | null>(null);
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [request, setRequest] = useState<ProcurementRequest>({
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    village: initialLocation.name,
    locationId: initialLocation.id,
    preferredTime: "afternoon",
  });
  const [bookingTarget, setBookingTarget] = useState<CentreEvaluation | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);

  // Load saved farmer profile on mount
  useEffect(() => {
    try {
      const saved =
        localStorage.getItem("freebuff_farmer_profile") ||
        localStorage.getItem("farmerProfile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed.name === "string" &&
          typeof parsed.village === "string" &&
          parsed.name.trim()
        ) {
          const loaded = { name: parsed.name.trim(), village: parsed.village.trim() };
          setProfile(loaded);
          setRequest((prev) => {
            const loc = LOCATIONS.find(
              (l) => l.name.toLowerCase() === loaded.village.toLowerCase(),
            );
            return {
              ...prev,
              village: loaded.village,
              locationId: loc ? loc.id : prev.locationId,
            };
          });
        }
      }
    } catch (e) {
      console.error("Failed to load farmer profile from localStorage", e);
    } finally {
      setIsProfileReady(true);
    }
  }, []);

  function handleSaveProfile(name: string, village: string) {
    const trimmedName = name.trim() || DEMO_FARMER.name;
    const trimmedVillage = village.trim() || initialLocation.name;
    const newProfile = { name: trimmedName, village: trimmedVillage };
    try {
      localStorage.setItem("freebuff_farmer_profile", JSON.stringify(newProfile));
      localStorage.setItem("farmerProfile", JSON.stringify(newProfile));
    } catch (e) {
      console.error("Failed to save farmer profile to localStorage", e);
    }
    setProfile(newProfile);
    setIsEditingProfile(false);

    const matchedLoc = LOCATIONS.find(
      (l) => l.name.toLowerCase() === trimmedVillage.toLowerCase(),
    );
    setRequest((prev) => ({
      ...prev,
      village: trimmedVillage,
      locationId: matchedLoc ? matchedLoc.id : prev.locationId,
    }));
  }

  // ---- Resolve location from canonical geocoded dataset ----
  const resolvedLocation: Location | null = useMemo(() => {
    if (request.locationId) {
      const loc = LOCATIONS.find((l) => l.id === request.locationId);
      if (loc) return loc;
    }
    return resolveLocation(request.village, LOCATIONS);
  }, [request.locationId, request.village]);

  // ---- Coordination Engine output (recomputed on every data change) ----
  const recommendation = useMemo(
    () => calculateCentreRecommendation(request, centres, resolvedLocation),
    [request, centres, resolvedLocation],
  );

  const selectedLocation = resolvedLocation || initialLocation;

  // The demo farmer's most recent live (non-archived) appointment.
  const myAppointment: Appointment | undefined = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            a.farmerId === DEMO_FARMER.id && a.status !== "cancelled" && !a.archived,
        )
        .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))[0],
    [appointments],
  );

  // Active pending/syncing/attention queued requests
  const activeQueuedRequest = useMemo(
    () =>
      queuedRequests
        .filter((r) => r.status !== "CONFIRMED")
        .sort((a, b) => b.createdAt - a.createdAt)[0],
    [queuedRequests],
  );

  const allStagesDone =
    myAppointment !== undefined && myAppointment.stageIndex >= 6;

  // Localized explanation composed from engine fragments.
  const localizedExplanation = useMemo(() => {
    if (!recommendation.explanationFragments) return "";
    return composeExplanation(recommendation.explanationFragments, (key) =>
      t(key as Parameters<typeof t>[0]),
    );
  }, [recommendation.explanationFragments, t]);

  async function confirmBooking(modalPrice?: number | null) {
    if (!bookingTarget) return;
    if (isOffline) {
      await saveOfflineBooking({
        centreId: bookingTarget.centre.id,
        centreName: bookingTarget.centre.name,
        arrivalWindow: bookingTarget.arrivalWindowLabel,
        request,
        modalPrice,
      });
    } else {
      bookToken({
        centreId: bookingTarget.centre.id,
        request,
        arrivalWindow: bookingTarget.arrivalWindowLabel,
        modalPrice,
        farmerName: profile?.name,
        farmerVillage: profile?.village,
      });
    }
    setBookingTarget(null);
  }

  async function handleSaveOffline() {
    await saveOfflineBooking({
      centreId: recommendation.best?.centre.id,
      centreName: recommendation.best?.centre.name,
      arrivalWindow:
        recommendation.best?.arrivalWindowLabel || "10:00 AM – 10:20 AM",
      request,
    });
  }

  function startNewRequest() {
    if (!myAppointment) return;
    archiveAppointment(myAppointment.id);
  }

  return (
    <div className="min-h-svh pb-24 bg-stone-50/50">
      <AppHeader />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {/* Farmer identity & location banner */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold shadow-2xs">
              <Sprout className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-stone-900">
                {profile?.name || DEMO_FARMER_PROFILE.name}
              </h1>
              <p className="flex items-center gap-1 truncate text-xs font-medium text-stone-500">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                {selectedLocation.name}, {selectedLocation.district}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditingProfile(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-2xs"
            >
              <Edit3 className="h-3.5 w-3.5 text-stone-400" />
              {t("editDetails")}
            </button>
            <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-1.5 text-xs text-stone-600 font-medium flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-stone-400" />
              <span>{RECOMMENDATION_CONFIG.serviceRadiusKm} km {t("checklistWithinServiceArea")}</span>
            </div>
          </div>
        </section>

        {/* Procurement request form */}
        <RequestForm
          request={request}
          resolvedLocation={resolvedLocation}
          onChange={setRequest}
          disabled={Boolean(myAppointment || activeQueuedRequest)}
          isOffline={isOffline}
          onSaveOffline={handleSaveOffline}
        />

        {/* Offline Queued Request View */}
        {activeQueuedRequest && !myAppointment && (
          <section
            aria-label="Offline Request Status"
            className="rounded-2xl border-2 border-amber-400 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      activeQueuedRequest.status === "PENDING_OFFLINE"
                        ? "border border-amber-400 bg-amber-100 text-amber-900"
                        : activeQueuedRequest.status === "SYNCING"
                        ? "border border-sky-400 bg-sky-100 text-sky-900"
                        : "border border-red-400 bg-red-100 text-red-900"
                    }`}
                  >
                    {activeQueuedRequest.status === "PENDING_OFFLINE"
                      ? t("pendingOffline")
                      : activeQueuedRequest.status === "SYNCING"
                      ? "SYNCING"
                      : t("requiresAttention")}
                  </span>
                  <span suppressHydrationWarning className="text-xs text-gray-500">
                    {new Date(activeQueuedRequest.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="mt-2 text-2xl font-extrabold text-gray-900">
                  {activeQueuedRequest.status === "REQUIRES_ATTENTION"
                    ? t("requiresAttention")
                    : "Token: Pending Confirmation"}
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  {activeQueuedRequest.payload.crop} · {activeQueuedRequest.payload.quantityQuintals} {t("quintals")}
                </p>
                <p className="text-sm text-gray-600">
                  {activeQueuedRequest.payload.targetCentreName || "Nearest Centre"} ·{" "}
                  {activeQueuedRequest.payload.targetArrivalWindow || "Arrival Window Pending"}
                </p>
              </div>

              <div className="text-right">
                <span className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-600">
                  ID: {activeQueuedRequest.requestId.slice(0, 16)}...
                </span>
              </div>
            </div>

            {/* Offline sync explanation */}
            {activeQueuedRequest.status === "PENDING_OFFLINE" && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
                <p className="font-bold">📡 {t("savedOffline")}</p>
                <p className="mt-0.5">{t("offlineSyncNotice")}</p>
              </div>
            )}

            {/* Syncing state */}
            {activeQueuedRequest.status === "SYNCING" && (
              <div className="mt-4 rounded-xl border border-sky-300 bg-sky-50 p-3 text-xs leading-relaxed text-sky-950">
                <p className="font-bold">🔄 {t("syncingStatus")}</p>
                <p className="mt-0.5">Validating live centre capacity, queue size, and eligibility...</p>
              </div>
            )}

            {/* Rejection / Attention Notice */}
            {activeQueuedRequest.status === "REQUIRES_ATTENTION" && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs leading-relaxed text-red-950">
                <p className="font-bold">⚠️ Revalidation Warning</p>
                <p className="mt-1">
                  {activeQueuedRequest.rejectionReason ||
                    "This procurement centre is currently at maximum daily intake quota or ineligible. Please select another centre."}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {activeQueuedRequest.status === "REQUIRES_ATTENTION" && (
                <button
                  type="button"
                  onClick={() => retryOfflineRequest(activeQueuedRequest.requestId)}
                  className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700"
                >
                  {t("retry")}
                </button>
              )}
              <button
                type="button"
                onClick={() => cancelOfflineRequest(activeQueuedRequest.requestId)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
              >
                {t("cancelRequest")}
              </button>
            </div>
          </section>
        )}

        {/* Location unsupported state */}
        {!myAppointment && !activeQueuedRequest && !resolvedLocation && (
          <section
            role="alert"
            className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"
          >
            <p className="font-bold">⚠️ Location &ldquo;{request.village}&rdquo; is not recognized.</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Please select a valid location from the search list (e.g. Moodbidri, Belvai, Karkala, Mangaluru, Bengaluru, Kochi, Hyderabad, Delhi) to resolve coordinates and evaluate nearby centres.
            </p>
          </section>
        )}

        {/* No suitable centre within service radius */}
        {!myAppointment && !activeQueuedRequest && resolvedLocation && !recommendation.best && (
          <section
            role="alert"
            className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📍</span>
              <p className="font-bold text-sm text-amber-950">
                {recommendation.noSuitableCentreReason || `No suitable procurement centre found within the available service area (${RECOMMENDATION_CONFIG.serviceRadiusKm} km).`}
              </p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Centres outside the {RECOMMENDATION_CONFIG.serviceRadiusKm} km service radius are listed below for informational purposes only.
            </p>
          </section>
        )}

        {/* Recommendation (hidden while a token is active to keep focus) */}
        {!myAppointment && recommendation.best && (
          <RecommendationCard
            best={recommendation.best}
            explanation={localizedExplanation || recommendation.explanation}
            onBook={() => setBookingTarget(recommendation.best!)}
          />
        )}

        {/* Nearby centres within service radius */}
        {!myAppointment && !activeQueuedRequest && recommendation.nearbyEvaluations.length > 0 && (
          <section aria-label={t("nearbyCentres")}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">
              {t("nearbyCentres")} ({RECOMMENDATION_CONFIG.serviceRadiusKm} km radius)
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recommendation.nearbyEvaluations.map((ev) => (
                <CentreCard
                  key={ev.centre.id}
                  evaluation={ev}
                  recommended={recommendation.best?.centre.id === ev.centre.id}
                  onSelect={() => setBookingTarget(ev)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Alternative centres outside service area */}
        {!myAppointment && !activeQueuedRequest && recommendation.distantAlternatives.length > 0 && (
          <section aria-label="Alternative Centres Outside Service Area">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-400">
              Alternative Centres (Outside Service Area &gt; {RECOMMENDATION_CONFIG.serviceRadiusKm} km)
            </h2>
            <div className="grid gap-3 opacity-80 md:grid-cols-2 xl:grid-cols-3">
              {recommendation.distantAlternatives.map((ev) => (
                <CentreCard
                  key={ev.centre.id}
                  evaluation={ev}
                  recommended={false}
                  onSelect={() => setBookingTarget(ev)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Active booking + tracking stepper */}
        {myAppointment && (
          <section className="rounded-xl border border-stone-200/90 bg-white p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  {t("yourToken")}
                </p>
                <p className="text-2xl font-bold tracking-tight text-stone-900">
                  {myAppointment.tokenNumber}
                </p>
                <p className="text-sm font-medium text-stone-700 mt-0.5">
                  {myAppointment.crop} · {myAppointment.quantityQuintals} {t("quintals")}
                </p>
                <p className="text-xs text-stone-500">
                  {myAppointment.centreName} · <span suppressHydrationWarning>{myAppointment.arrivalWindow}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-500">{t("estimatedAmount")}</p>
                <p className="text-lg font-bold text-stone-900">
                  {myAppointment.estimatedAmountInr != null
                    ? `₹${myAppointment.estimatedAmountInr.toLocaleString("en-IN")}`
                    : t("priceUnavailable")}
                </p>
                {myAppointment.paymentRef && (
                  <p className="text-xs text-stone-500">
                    {t("paymentRef")}: {myAppointment.paymentRef}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {t("procurementTracker")}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("liveCentreUpdates")}
              </span>
            </div>

            <TrackingStepper
              stageIndex={myAppointment.stageIndex}
              cancelled={myAppointment.status === "cancelled"}
            />

            {/* Current Stage Live Centre Operational Status */}
            <div className="mt-4 rounded-lg border border-stone-200/90 bg-stone-50/70 p-3.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge
                  variant={myAppointment.status === "cancelled" ? "bad" : allStagesDone ? "good" : "busy"}
                  label={t(stageKeyFor(myAppointment.status))}
                />
                <span className="font-medium text-stone-600 truncate">
                  {myAppointment.centreName}
                </span>
              </div>
              <p className="mt-2 text-stone-700 leading-relaxed font-normal">
                {t(statusDescriptionKeyFor(myAppointment.status))}
              </p>
            </div>

            {allStagesDone && (
              <button
                type="button"
                onClick={startNewRequest}
                className="mt-3 min-h-11 w-full rounded-lg border border-emerald-600 bg-emerald-50 px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
              >
                {t("startNewRequest")}
              </button>
            )}

            {!allStagesDone && (
              <div className="mt-3">
                <CancelBookingButton
                  onConfirm={() => cancelBooking(myAppointment.id)}
                />
              </div>
            )}

            {/* Demo Simulation Helper (discrete, non-primary dev tool for single-screen testing) */}
            {!allStagesDone && (
              <details className="mt-4 rounded-lg border border-dashed border-stone-300 bg-white p-2.5 text-xs">
                <summary className="cursor-pointer font-medium text-stone-500 select-none hover:text-stone-700">
                  🛠️ {t("demoAdvanceCentreAction")}
                </summary>
                <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    {t("demoAdvanceCentreHint")}
                  </p>
                  <button
                    type="button"
                    onClick={() => advanceAppointment(myAppointment.id)}
                    className="min-h-8 w-full rounded-md bg-stone-800 px-3 text-xs font-medium text-white hover:bg-stone-700 active:bg-stone-900 transition-colors"
                  >
                    {t("nextStage")}: {myAppointment.tokenNumber}
                  </button>
                </div>
              </details>
            )}
          </section>
        )}
      </main>

      {/* Floating SMS simulator button */}
      <button
        type="button"
        onClick={() => setSmsOpen(true)}
        className="fixed bottom-4 right-4 z-30 min-h-10 rounded-full bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-stone-800 hover:bg-stone-800 active:scale-95 transition-all"
      >
        <span className="inline-flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-emerald-400" />
          {t("viewSms")}
        </span>
      </button>

      {bookingTarget && (
        <BookingModal
          evaluation={bookingTarget}
          request={request}
          onConfirm={confirmBooking}
          onClose={() => setBookingTarget(null)}
        />
      )}
      <SmsSimulatorDrawer
        open={smsOpen}
        onClose={() => setSmsOpen(false)}
        messages={smsOutbox}
      />
      <NetworkLoadSimulator />

      {/* First-time onboarding modal */}
      {isProfileReady && !profile && (
        <FarmerProfileModal
          isOpen={true}
          isEdit={false}
          initialName=""
          initialVillage={selectedLocation.name}
          onSave={handleSaveProfile}
        />
      )}

      {/* Edit Profile modal */}
      {isEditingProfile && (
        <FarmerProfileModal
          isOpen={true}
          isEdit={true}
          initialName={profile?.name || DEMO_FARMER_PROFILE.name}
          initialVillage={profile?.village || selectedLocation.name}
          onSave={handleSaveProfile}
          onClose={() => setIsEditingProfile(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request form with location selection
// ---------------------------------------------------------------------------

function RequestForm({
  request,
  resolvedLocation,
  onChange,
  disabled,
  isOffline,
  onSaveOffline,
}: {
  request: ProcurementRequest;
  resolvedLocation: Location | null;
  onChange: (r: ProcurementRequest) => void;
  disabled?: boolean;
  isOffline?: boolean;
  onSaveOffline?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="rounded-xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-2xs">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
        {t("yourRequest")}
      </h2>
      <div className="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Location selector */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-stone-700">
            {t("selectLocation")}
          </span>
          <select
            value={request.locationId}
            disabled={disabled}
            onChange={(e) => {
              const loc = getFarmerLocation(e.target.value);
              onChange({
                ...request,
                locationId: loc.id,
                village: loc.name,
              });
            }}
            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm font-medium text-stone-900 disabled:bg-stone-100 disabled:text-stone-400 shadow-2xs focus:bg-white focus:border-stone-400 focus:outline-hidden transition-colors"
          >
            {MOCK_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.district})
              </option>
            ))}
          </select>
        </label>

        {/* Crop selector */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-stone-700">
            {t("crop")}
          </span>
          <select
            value={request.crop}
            disabled={disabled}
            onChange={(e) => onChange({ ...request, crop: e.target.value as Crop })}
            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm font-medium text-stone-900 disabled:bg-stone-100 disabled:text-stone-400 shadow-2xs focus:bg-white focus:border-stone-400 focus:outline-hidden transition-colors"
          >
            {DEMO_CROPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {/* Quantity selector */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-stone-700">
            {t("quantity")} ({t("quintals")})
          </span>
          <input
            type="number"
            min={1}
            max={100}
            value={request.quantityQuintals}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...request,
                quantityQuintals: Math.max(1, Number(e.target.value) || 1),
              })
            }
            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm font-medium text-stone-900 disabled:bg-stone-100 disabled:text-stone-400 shadow-2xs focus:bg-white focus:border-stone-400 focus:outline-hidden transition-colors"
          />
        </label>

        {/* Preferred time selector */}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-stone-700">
            {t("preferredTime")}
          </span>
          <select
            value={request.preferredTime}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...request, preferredTime: e.target.value as PreferredTime })
            }
            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-3 py-2 text-sm font-medium text-stone-900 disabled:bg-stone-100 disabled:text-stone-400 shadow-2xs focus:bg-white focus:border-stone-400 focus:outline-hidden transition-colors"
          >
            <option value="morning">{t("morning")}</option>
            <option value="afternoon">{t("afternoon")}</option>
            <option value="evening">{t("evening")}</option>
          </select>
        </label>
      </div>

      {resolvedLocation ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2 text-xs font-medium text-stone-700">
          <span>📍 {resolvedLocation.name}, {resolvedLocation.district}, {resolvedLocation.state}</span>
          <span className="rounded bg-stone-200/80 px-1.5 py-0.5 font-mono text-[10px] text-stone-700">
            {resolvedLocation.latitude.toFixed(4)}° N, {resolvedLocation.longitude.toFixed(4)}° E
          </span>
        </div>
      ) : (
        <div className="mt-3.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          ⚠️ &ldquo;{request.village}&rdquo; not recognized. Select a supported town (e.g., Moodbidri, Belvai, Karkala, Mangaluru, Bengaluru, Kozhikode) to calculate real distance.
        </div>
      )}

      {isOffline && !disabled && (
        <div className="mt-3.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">📡 {t("offlineStatus")}</p>
          <p className="mt-0.5 text-stone-600">{t("offlineSyncNotice")}</p>
          {onSaveOffline && (
            <button
              type="button"
              onClick={onSaveOffline}
              className="mt-2.5 min-h-9 w-full rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              💾 {t("saveOfflineBtn")}
            </button>
          )}
        </div>
      )}

      {disabled && (
        <p className="mt-2.5 text-xs font-semibold text-emerald-700">
          {t("alreadyBooked")} — {t("viewTracking")}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cancel booking
// ---------------------------------------------------------------------------

function CancelBookingButton({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useLanguage();
  const [armed, setArmed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 3000);
        }
      }}
      className={`mt-2.5 min-h-11 w-full rounded-xl border px-4 text-sm font-bold transition-colors ${armed
          ? "border-red-700 bg-red-600 text-white hover:bg-red-700"
          : "border-red-300 bg-white text-red-700 hover:bg-red-50"
        }`}
    >
      {armed ? t("cancelConfirm") : t("cancel")}
    </button>
  );
}
