"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, WifiOff, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";
import type { CentreEvaluation, ProcurementRequest } from "@/lib/types";
import { getMarketPrice, calculateEstimatedValue } from "@/lib/marketPrices/marketPriceService";
import type { MarketPriceResult } from "@/lib/marketPrices/types";

/**
 * BookingModal — confirm-before-book dialog.
 * Supports both online direct booking and offline-first queueing.
 */
export default function BookingModal({
  evaluation,
  request,
  onConfirm,
  onClose,
}: {
  evaluation: CentreEvaluation;
  request: ProcurementRequest;
  onConfirm: (modalPrice?: number | null) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { isOffline } = useAppState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceResult, setPriceResult] = useState<MarketPriceResult | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  // Fetch real Government market price
  useEffect(() => {
    let isMounted = true;
    setPriceLoading(true);

    getMarketPrice(
      {
        crop: request.crop,
        state: evaluation.centre.state,
        district: evaluation.centre.district,
        market: evaluation.centre.name,
        centreId: evaluation.centre.id,
      },
      isOffline,
    )
      .then((res) => {
        if (isMounted) {
          setPriceResult(res);
          setPriceLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPriceResult({
            record: null,
            modalPrice: null,
            priceUnit: "₹/Quintal",
            source: "DATA_GOV_IN",
            status: "UNAVAILABLE",
            matchType: "UNAVAILABLE",
            isFallback: false,
            message: isOffline
              ? t("marketPriceUnavailableOffline")
              : t("priceUnavailableDesc"),
            fetchedAt: Date.now(),
          });
          setPriceLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    request.crop,
    evaluation.centre.state,
    evaluation.centre.district,
    evaluation.centre.name,
    isOffline,
  ]);

  // Clear any pending timer when the modal unmounts so no late callback
  // can flip state after the dialog is gone.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const modalPrice = priceResult?.modalPrice ?? null;
  const estimatedAmount = calculateEstimatedValue(
    modalPrice,
    request.quantityQuintals,
  );

  function handleConfirm() {
    if (submitting) return; // double-click guard
    setError(null);
    setSubmitting(true);
    timerRef.current = window.setTimeout(() => {
      try {
        onConfirm(modalPrice);
        // Parent closes the modal on success; resetting state here is still
        // safe if it stays mounted for another booking.
      } catch (err) {
        setError(err instanceof Error ? err.message : t("bookingError"));
      } finally {
        setSubmitting(false); // ALWAYS resolves the loading state
      }
    }, 350);
  }

  // Portal to document.body so ancestor overflow/transform can never clip
  // or misposition the overlay (a real click-reliability hazard).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("confirmBooking")}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        role="document"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold text-gray-900">{t("confirmBooking")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <Row label={t("centreLabel")} value={evaluation.centre.name} strong />
          <Row label={t("windowLabel")} value={evaluation.arrivalWindowLabel} strong />
          <Row label={t("crop")} value={request.crop} />
          <Row
            label={t("quantityLabel")}
            value={`${request.quantityQuintals} ${t("quintals")}`}
          />
          <Row
            label={t("marketRate")}
            value={
              priceLoading
                ? t("loadingMarketPrice")
                : modalPrice != null
                ? `₹${modalPrice.toLocaleString("en-IN")} / ${t("quintals")}`
                : t("priceUnavailable")
            }
          />
          <Row
            label={t("estimatedAmount")}
            value={
              priceLoading
                ? "…"
                : estimatedAmount != null
                ? `₹${estimatedAmount.toLocaleString("en-IN")}`
                : t("priceUnavailable")
            }
            strong
          />
        </dl>

        {priceResult?.record ? (
          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-950">
            <div className="flex items-center justify-between font-semibold text-emerald-900">
              <span>
                {isOffline || priceResult.status === "STALE"
                  ? t("lastKnownMarketRate")
                  : t("mandiPriceLabel")}
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                {priceResult.matchType === "EXACT_MARKET"
                  ? "Mandi Match"
                  : priceResult.matchType === "DISTRICT_FALLBACK"
                  ? "District Rate"
                  : "State Rate"}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-emerald-800">
              <div>
                <span className="text-emerald-600">Mandi: </span>
                {priceResult.record.market}
              </div>
              <div>
                <span className="text-emerald-600">Date: </span>
                {priceResult.record.arrivalDate}
              </div>
            </div>
            <div className="mt-1 text-[10px] text-emerald-700/80">
              {t("govSourceNotice")}
            </div>
          </div>
        ) : !priceLoading ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-600">
            <p className="font-medium text-gray-700">{t("priceUnavailable")}</p>
            <p className="mt-0.5 text-[11px]">
              {priceResult?.message || t("priceUnavailableDesc")}
            </p>
          </div>
        ) : null}

        {isOffline && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p>{t("offlineModalNotice")}</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                onClick={handleConfirm}
                className="mt-1 min-h-9 rounded-lg border border-red-300 bg-white px-3 text-xs font-bold text-red-800 hover:bg-red-100"
              >
                {t("retry")}
              </button>
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">{t("poweredBy")}</p>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-12 flex-1 rounded-xl border border-gray-300 bg-white px-4 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`min-h-12 flex-1 rounded-xl px-4 font-semibold text-white disabled:cursor-wait disabled:opacity-60 ${
              isOffline
                ? "bg-amber-600 hover:bg-amber-700 active:bg-amber-800"
                : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
            }`}
          >
            {submitting ? "…" : isOffline ? t("saveOfflineBtn") : t("confirmAndBook")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={strong ? "font-bold text-gray-900" : "text-gray-800"}>{value}</dd>
    </div>
  );
}
