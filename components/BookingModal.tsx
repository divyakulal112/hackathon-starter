"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { CentreEvaluation, ProcurementRequest } from "@/lib/types";
import { CROP_RATES_INR_PER_QUINTAL } from "@/lib/constants";

/**
 * BookingModal — confirm-before-book dialog.
 *
 * Reliability contract (Phase 1.5):
 * - `submitting` is ALWAYS cleared, even if onConfirm throws (finally block).
 * - A timer leak guard clears the timeout on unmount.
 * - Double-clicks during submission are ignored.
 * - Failures show a retryable error instead of a stuck disabled button.
 */
export default function BookingModal({
  evaluation,
  request,
  onConfirm,
  onClose,
}: {
  evaluation: CentreEvaluation;
  request: ProcurementRequest;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Clear any pending timer when the modal unmounts so no late callback
  // can flip state after the dialog is gone.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const rate = CROP_RATES_INR_PER_QUINTAL[request.crop] ?? 2000;
  const amount = rate * request.quantityQuintals;

  function handleConfirm() {
    if (submitting) return; // double-click guard
    setError(null);
    setSubmitting(true);
    timerRef.current = window.setTimeout(() => {
      try {
        onConfirm();
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
            label={t("estimatedAmount")}
            value={`₹${amount.toLocaleString("en-IN")}`}
            strong
          />
        </dl>

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
            className="min-h-12 flex-1 rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "…" : t("confirmAndBook")}
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
