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
  const [filter, setFilter] = useState<"all" | "received" | "pending">("all");

  const templates = SMS_TEMPLATES[language];

  function renderBody(sms: SmsMessage): string {
    if (sms.kind === "booking") {
      return templates.booking(
        sms.tokenNumber,
        sms.centreName,
        sms.arrivalWindow ?? "",
        sms.crop,
        sms.quantityQuintals,
      );
    }

    if (sms.kind === "payment") {
      const amountFormatted =
        sms.amountInr != null
          ? `₹${sms.amountInr.toLocaleString("en-IN")}`
          : "—";
      return templates.payment(
        sms.tokenNumber,
        sms.centreName,
        amountFormatted,
        sms.paymentRef ?? "—",
      );
    }

    const stageLabel = sms.stageKey
      ? t(sms.stageKey as TranslationKey)
      : "";

    return templates.status(
      sms.tokenNumber,
      sms.centreName,
      stageLabel,
      sms.crop,
    );
  }

  // Portal to document.body — same clipping/stacking protection as the modal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const receivedCount = messages.filter(
    (m) => (m.deliveryStatus ?? "received") === "received",
  ).length;
  const pendingCount = messages.filter(
    (m) => m.deliveryStatus === "pending",
  ).length;

  const filteredMessages = messages.filter((m) => {
    if (filter === "all") return true;
    const status = m.deliveryStatus ?? "received";
    return status === filter;
  });

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
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 text-stone-900">
          <h2 className="text-sm font-bold">
            {t("smsTitle")}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Phone mockup */}
        <div className="mx-auto mt-4 w-72 overflow-hidden rounded-3xl border-4 border-gray-800 bg-[#c9d6c3] shadow-xl">
          
          {/* Phone top bar */}
          <div className="flex items-center justify-between bg-gray-900 px-3 py-1.5 text-[10px] text-gray-300">
            <span className="font-bold tracking-wider">
              INBOX
            </span>
            <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
              {messages.length} MSG
            </span>
          </div>

          {/* Status category sub-bar */}
          <div className="flex border-b border-gray-700 bg-gray-800 text-[9px] font-semibold text-gray-400">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex-1 py-1 text-center transition-colors ${
                filter === "all"
                  ? "bg-gray-700 font-bold text-emerald-300"
                  : "hover:text-gray-200"
              }`}
            >
              {t("smsAll")} ({messages.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("received")}
              className={`flex-1 py-1 text-center transition-colors ${
                filter === "received"
                  ? "bg-gray-700 font-bold text-emerald-300"
                  : "hover:text-gray-200"
              }`}
            >
              {t("smsReceived")} ({receivedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`flex-1 py-1 text-center transition-colors ${
                filter === "pending"
                  ? "bg-gray-700 font-bold text-emerald-300"
                  : "hover:text-gray-200"
              }`}
            >
              {t("smsPending")} ({pendingCount})
            </button>
          </div>

          {/* SMS list */}
          <div className="max-h-[58vh] space-y-2.5 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs leading-relaxed text-gray-700">
                  {t("smsEmpty")}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 inline-flex items-center rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-800 active:bg-emerald-900"
                >
                  {t("smsBookAction")}
                </button>
              </div>
            ) : filteredMessages.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-700">
                {filter === "pending" ? t("smsNoPending") : t("smsEmpty")}
              </p>
            ) : (
              [...filteredMessages]
                .reverse()
                .map((sms) => {
                  const isReceived =
                    (sms.deliveryStatus ?? "received") === "received";
                  const timeStr = new Date(sms.createdAt).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" },
                  );

                  return (
                    <div
                      key={sms.id}
                      className="rounded-lg border border-gray-400 bg-[#eef3ea] p-2.5 text-[11px] leading-snug text-gray-900 shadow-sm"
                    >
                      {/* SMS header */}
                      <div className="mb-1.5 flex items-center justify-between text-[9px] font-semibold text-gray-600">
                        <span className="flex items-center gap-1">
                          <span className="font-extrabold text-gray-900">
                            KisanSync
                          </span>
                          <span className="rounded bg-gray-200 px-1 py-0.5 text-[8px] font-medium text-gray-700">
                            {sms.kind === "booking"
                              ? t("smsBooking")
                              : sms.kind === "payment"
                                ? t("smsPayment")
                                : t("smsStatus")}
                          </span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[8px] font-bold ${
                            isReceived
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isReceived
                            ? `✓ ${t("smsReceived")}`
                            : `⏳ ${t("smsPending")}`}
                        </span>
                      </div>

                      {/* SMS content */}
                      <p className="text-[11px] leading-relaxed text-gray-800">
                        {renderBody(sms)}
                      </p>

                      {/* SMS metadata footer */}
                      <div className="mt-2 flex items-center justify-between border-t border-gray-300/70 pt-1 text-[9px] text-gray-500">
                        <span suppressHydrationWarning>{timeStr}</span>
                        {sms.crop && (
                          <span className="font-medium text-emerald-800">
                            {sms.crop}
                            {sms.quantityQuintals
                              ? ` · ${sms.quantityQuintals} q`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Simulation message */}
        <p className="mx-auto mt-3 w-72 text-center text-[10px] text-gray-500">
          {t("smsSimulated")}
        </p>
      </aside>
    </>,
    document.body,
  );
}