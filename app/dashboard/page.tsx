"use client";

import { useMemo, useState } from "react";
import { MessageSquareText, Sprout, MapPin, AlertCircle, Compass } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import RecommendationCard from "@/components/RecommendationCard";
import CentreCard from "@/components/CentreCard";
import BookingModal from "@/components/BookingModal";
import TrackingStepper from "@/components/TrackingStepper";
import SmsSimulatorDrawer from "@/components/SmsSimulatorDrawer";
import NetworkLoadSimulator from "@/components/NetworkLoadSimulator";
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
  MOCK_LOCATIONS,
  getFarmerLocation,
} from "@/lib/mockData";
import { DEMO_FARMER } from "@/lib/constants";
import type {
  Appointment,
  CentreEvaluation,
  Crop,
  PreferredTime,
  ProcurementRequest,
} from "@/lib/types";

export default function FarmerDashboard() {
  const { t } = useLanguage();
  const {
    centres,
    appointments,
    smsOutbox,
    bookToken,
    advanceAppointment,
    cancelBooking,
    archiveAppointment,
  } = useAppState();

  const initialLocation = getFarmerLocation(DEFAULT_LOCATION_ID);

  const [request, setRequest] = useState<ProcurementRequest>({
    crop: "Paddy / Rice",
    quantityQuintals: 4, // 4 quintals = 400 kg
    village: initialLocation.name,
    locationId: initialLocation.id,
    preferredTime: "afternoon",
  });
  const [bookingTarget, setBookingTarget] = useState<CentreEvaluation | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);

  // ---- Location-Aware Coordination Engine output (recomputed reactively) ----
  const recommendation = useMemo(
    () => calculateCentreRecommendation(request, centres),
    [request, centres],
  );

  const selectedLocation = useMemo(
    () => getFarmerLocation(request.locationId),
    [request.locationId],
  );

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

  const allStagesDone =
    myAppointment !== undefined && myAppointment.stageIndex >= 6;

  // Localized explanation composed from engine fragments.
  const localizedExplanation = useMemo(() => {
    if (!recommendation.explanationFragments) return "";
    return composeExplanation(recommendation.explanationFragments, (key) =>
      t(key as Parameters<typeof t>[0]),
    );
  }, [recommendation.explanationFragments, t]);

  function confirmBooking() {
    if (!bookingTarget) return;
    bookToken({
      centreId: bookingTarget.centre.id,
      request,
      arrivalWindow: bookingTarget.arrivalWindowLabel,
    });
    setBookingTarget(null);
  }

  function startNewRequest() {
    if (!myAppointment) return;
    archiveAppointment(myAppointment.id);
  }

  // Separate centres into in-service-area vs alternatives
  const inAreaCentres = recommendation.evaluations.filter((e) => e.withinServiceArea);
  const otherCentres = recommendation.evaluations.filter((e) => !e.withinServiceArea);

  return (
    <div className="min-h-svh pb-24 bg-gray-50/50">
      <AppHeader />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        {/* Farmer identity & location banner */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 font-bold shadow-xs">
              <Sprout className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-gray-900">
                {DEMO_FARMER_PROFILE.name}
              </h1>
              <p className="flex items-center gap-1 truncate text-xs font-semibold text-emerald-800">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                {selectedLocation.name}, {selectedLocation.district}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-emerald-600" />
            <span>25 km {t("checklistWithinServiceArea")}</span>
          </div>
        </section>

        {/* Procurement request form */}
        <RequestForm
          request={request}
          onChange={setRequest}
          disabled={Boolean(myAppointment)}
        />

        {/* Recommended Centre Card (hidden while a token is active) */}
        {!myAppointment && recommendation.best && (
          <RecommendationCard
            best={recommendation.best}
            explanation={localizedExplanation || recommendation.explanation}
            onBook={() => setBookingTarget(recommendation.best!)}
          />
        )}

        {/* If no centre in service radius accepts this crop */}
        {!myAppointment && !recommendation.best && (
          <section className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-5 text-amber-900 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-amber-950">
                  {t("noEligibleInRadius")}
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  {t("locationRadiusNote")}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Nearby Centres within Service Area */}
        {!myAppointment && (
          <section aria-label={t("nearbyCentres")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">
                {t("nearbyCentres")} ({inAreaCentres.length})
              </h2>
              <span className="text-xs text-gray-500 font-medium">
                {t("locationRadiusNote")}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {inAreaCentres.map((ev) => (
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

        {/* Alternative Centres beyond service radius */}
        {!myAppointment && otherCentres.length > 0 && (
          <section aria-label={t("alternativeCentres")} className="pt-2">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
              {t("alternativeCentres")} (&gt;25 km)
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {otherCentres.map((ev) => (
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
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {t("yourToken")}
                </p>
                <p className="text-3xl font-black text-gray-900 tracking-tight">
                  {myAppointment.tokenNumber}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-700">
                  {myAppointment.crop} · {myAppointment.quantityQuintals} {t("quintals")}
                </p>
                <p className="text-xs text-gray-500 font-medium">
                  {myAppointment.centreName} · {myAppointment.arrivalWindow}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-500">{t("estimatedAmount")}</p>
                <p className="text-2xl font-extrabold text-emerald-700">
                  ₹{myAppointment.estimatedAmountInr.toLocaleString("en-IN")}
                </p>
                {myAppointment.paymentRef && (
                  <p className="text-xs font-mono font-bold text-gray-500 mt-0.5">
                    {t("paymentRef")}: {myAppointment.paymentRef}
                  </p>
                )}
              </div>
            </div>

            <h2 className="mt-4 mb-3 text-sm font-bold uppercase tracking-wider text-gray-600">
              {t("procurementTracker")}
            </h2>
            <TrackingStepper
              stageIndex={myAppointment.stageIndex}
              cancelled={myAppointment.status === "cancelled"}
            />

            <button
              type="button"
              onClick={() => advanceAppointment(myAppointment.id)}
              disabled={allStagesDone}
              className="mt-4 min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-extrabold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300 transition-colors"
            >
              {t("nextStage")}
            </button>
            <p className="mt-2 text-center text-xs text-gray-500">
              {t("congestionNote")}
            </p>
            {allStagesDone && (
              <button
                type="button"
                onClick={startNewRequest}
                className="mt-3 min-h-12 w-full rounded-xl border-2 border-emerald-600 bg-emerald-50 px-4 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
              >
                {t("startNewRequest")}
              </button>
            )}
            {!allStagesDone && (
              <CancelBookingButton
                onConfirm={() => cancelBooking(myAppointment.id)}
              />
            )}
          </section>
        )}
      </main>

      {/* Floating SMS simulator button */}
      <button
        type="button"
        onClick={() => setSmsOpen(true)}
        className="fixed bottom-4 right-4 z-30 min-h-12 rounded-full bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-xl hover:bg-gray-800 active:scale-95 transition-all"
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Request form with location selection
// ---------------------------------------------------------------------------

function RequestForm({
  request,
  onChange,
  disabled,
}: {
  request: ProcurementRequest;
  onChange: (r: ProcurementRequest) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">
        {t("yourRequest")}
      </h2>
      <div className="mt-3 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Location selector */}
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-gray-700">
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
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-semibold text-gray-900 disabled:bg-gray-100 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
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
          <span className="mb-1 block text-xs font-bold text-gray-700">
            {t("crop")}
          </span>
          <select
            value={request.crop}
            disabled={disabled}
            onChange={(e) => onChange({ ...request, crop: e.target.value as Crop })}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-semibold text-gray-900 disabled:bg-gray-100 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
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
          <span className="mb-1 block text-xs font-bold text-gray-700">
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
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-semibold text-gray-900 disabled:bg-gray-100 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
          />
        </label>

        {/* Preferred time selector */}
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-gray-700">
            {t("preferredTime")}
          </span>
          <select
            value={request.preferredTime}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...request, preferredTime: e.target.value as PreferredTime })
            }
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-semibold text-gray-900 disabled:bg-gray-100 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
          >
            <option value="morning">{t("morning")}</option>
            <option value="afternoon">{t("afternoon")}</option>
            <option value="evening">{t("evening")}</option>
          </select>
        </label>
      </div>
      {disabled && (
        <p className="mt-2.5 text-xs font-bold text-emerald-700">
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
