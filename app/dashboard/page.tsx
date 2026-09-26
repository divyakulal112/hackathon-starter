"use client";

import { useMemo, useState } from "react";
import { MessageSquareText, Sprout } from "lucide-react";
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
import { DEMO_CROPS, DEMO_FARMER_PROFILE } from "@/lib/mockData";
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

  const [request, setRequest] = useState<ProcurementRequest>({
    crop: "Paddy / Rice",
    quantityQuintals: 15,
    village: DEMO_FARMER.village,
    preferredTime: "afternoon",
  });
  const [bookingTarget, setBookingTarget] = useState<CentreEvaluation | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);

  // ---- Coordination Engine output (recomputed on every data change) ----
  const recommendation = useMemo(
    () => calculateCentreRecommendation(request, centres),
    [request, centres],
  );

  // The demo farmer's most recent live (non-archived) appointment.
  // Archived appointments keep centre history but unlock the request form.
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

  return (
    <div className="min-h-svh pb-24">
      <AppHeader />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        {/* Farmer identity */}
        <section className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Sprout className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900">
              {DEMO_FARMER_PROFILE.name}
            </h1>
            <p className="truncate text-sm text-gray-500">
              {DEMO_FARMER_PROFILE.village}
            </p>
          </div>
        </section>

        {/* Offline notice for actions (banner itself lives in the header) */}

        {/* Procurement request */}
        <RequestForm
          request={request}
          onChange={setRequest}
          disabled={Boolean(myAppointment)}
        />

        {/* Recommendation (hidden while a token is active to keep focus) */}
        {!myAppointment && recommendation.best && (
          <RecommendationCard
            best={recommendation.best}
            explanation={localizedExplanation || recommendation.explanation}
            onBook={() => setBookingTarget(recommendation.best!)}
          />
        )}

        {/* Nearby centres */}
        {!myAppointment && (
          <section aria-label={t("nearbyCentres")}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">
              {t("nearbyCentres")}
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recommendation.evaluations.map((ev) => (
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

        {/* Active booking + tracking */}
        {myAppointment && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      {t("yourToken")}
                    </p>
                    <p className="text-2xl font-extrabold text-gray-900">
                      {myAppointment.tokenNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      {myAppointment.crop} · {myAppointment.quantityQuintals} {t("quintals")}
                    </p>
                    <p className="text-sm text-gray-600">
                      {myAppointment.centreName} · {myAppointment.arrivalWindow}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{t("estimatedAmount")}</p>
                    <p className="text-lg font-bold text-gray-900">
                      ₹{myAppointment.estimatedAmountInr.toLocaleString("en-IN")}
                    </p>
                    {myAppointment.paymentRef && (
                      <p className="text-xs text-gray-500">
                        {t("paymentRef")}: {myAppointment.paymentRef}
                      </p>
                    )}
                  </div>
                </div>

                <h2 className="mt-4 mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
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
                  className="mt-2 min-h-12 w-full rounded-xl bg-emerald-600 px-4 font-bold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {t("nextStage")}
                </button>
                <p className="mt-1.5 text-center text-xs text-gray-500">
                  {t("congestionNote")}
                </p>
                {allStagesDone && (
                  <button
                    type="button"
                    onClick={startNewRequest}
                    className="mt-2 min-h-12 w-full rounded-xl border border-emerald-600 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200"
                  >
                    {t("startNewRequest")}
                  </button>
                )}
                {!allStagesDone && (
                  <CancelBookingButton
                    onConfirm={() => cancelBooking(myAppointment.id)}
                  />
                )}
              </>
          </section>
        )}
      </main>

      {/* Floating SMS button */}
      <button
        type="button"
        onClick={() => setSmsOpen(true)}
        className="fixed bottom-4 right-4 z-30 min-h-12 rounded-full bg-gray-900 px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-gray-800"
      >
        <span className="inline-flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" />
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
// Request form
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
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
        {t("yourRequest")}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {t("crop")}
          </span>
          <select
            value={request.crop}
            disabled={disabled}
            onChange={(e) => onChange({ ...request, crop: e.target.value as Crop })}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 disabled:bg-gray-100"
          >
            {DEMO_CROPS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
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
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 disabled:bg-gray-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {t("village")}
          </span>
          <input
            type="text"
            value={request.village}
            disabled={disabled}
            onChange={(e) => onChange({ ...request, village: e.target.value })}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 disabled:bg-gray-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-gray-600">
            {t("preferredTime")}
          </span>
          <select
            value={request.preferredTime}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...request, preferredTime: e.target.value as PreferredTime })
            }
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 disabled:bg-gray-100"
          >
            <option value="morning">{t("morning")}</option>
            <option value="afternoon">{t("afternoon")}</option>
            <option value="evening">{t("evening")}</option>
          </select>
        </label>
      </div>
      {disabled && (
        <p className="mt-2 text-xs font-semibold text-emerald-700">
          {t("alreadyBooked")} — {t("viewTracking")}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cancel booking (two-tap confirm — stage 8 of the tracker)
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
          // Auto-disarm so a stray tap can't leave a destructive button hot.
          window.setTimeout(() => setArmed(false), 3000);
        }
      }}
      className={`mt-2 min-h-11 w-full rounded-xl border px-4 text-sm font-bold transition-colors ${
        armed
          ? "border-red-700 bg-red-600 text-white hover:bg-red-700"
          : "border-red-300 bg-white text-red-700 hover:bg-red-50"
      }`}
    >
      {armed ? t("cancelConfirm") : t("cancel")}
    </button>
  );
}
