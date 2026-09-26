"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { SMS_TEMPLATES, type TranslationKey } from "@/lib/translations";
import type { SmsMessage } from "@/lib/types";

/**
 * SmsSimulatorDrawer — mock feature-phone SMS feed.
 *
 * Messages are stored as structured events and rendered
 * in the ACTIVE language.
 *
 * Demo only — no real SMS provider is used.
 */
export default function SmsSimulatorDrawer({
  open,
  onClose,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  messages: SmsMessage[];
}) {
  const { t, language } = useLanguage();

  const templates = SMS_TEMPLATES[language];

  function renderBody(sms: SmsMessage): string {
    if (sms.kind === "booking") {
      return templates.booking(
        sms.tokenNumber,
        sms.centreName,
        sms.arrivalWindow ?? ""
      );
    }

    if (sms.kind === "payment") {
      return templates.payment(
        sms.tokenNumber,
        sms.centreName,
        `₹${(sms.amountInr ?? 0).toLocaleString("en-IN")}`,
        sms.paymentRef ?? "—"
      );
    }

    const stageLabel = sms.stageKey
      ? t(sms.stageKey as TranslationKey)
      : "";

    return templates.status(
      sms.tokenNumber,
      sms.centreName,
      stageLabel
    );
  }

  // Portal to document.body — same clipping/stacking protection as the modal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Background overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm transform bg-gray-100 shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("smsTitle")}
      >
        {/* Header */}
        <header className="flex items-center justify-between bg-emerald-700 px-4 py-3 text-white">
          <h2 className="text-sm font-bold">
            {t("smsTitle")}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded-lg p-1.5 hover:bg-emerald-800"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Phone mockup */}
        <div className="mx-auto mt-4 w-70 overflow-hidden rounded-3xl border-4 border-gray-800 bg-[#c9d6c3] shadow-xl">
          
          {/* Phone top bar */}
          <div className="flex items-center justify-between bg-gray-900 px-3 py-1 text-[10px] text-gray-300">
            <span className="font-bold">
              INBOX
            </span>

            <span>
              {messages.length}
            </span>
          </div>

          {/* SMS list */}
          <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-700">
                {t("smsEmpty")}
              </p>
            ) : (
              [...messages]
                .reverse()
                .map((sms) => (
                  <div
                    key={sms.id}
                    className="rounded-md border border-gray-500 bg-[#eef3ea] p-2 text-[11px] leading-snug text-gray-900 shadow-sm"
                  >
                    {/* SMS header */}
                    <div className="mb-1 flex justify-between text-[9px] font-semibold text-gray-600">
                      <span>
                        KisanSync
                      </span>

                      <span>
                        {sms.kind === "booking"
                          ? t("smsBooking")
                          : sms.kind === "payment"
                            ? t("smsPayment")
                            : t("smsStatus")}
                      </span>
                    </div>

                    {/* SMS content */}
                    {renderBody(sms)}
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Simulation message */}
        <p className="mx-auto mt-3 w-70 text-center text-[10px] text-gray-500">
          {t("smsSimulated")}
        </p>
      </aside>
    </>,
    document.body,
  );
}