"use client";

import { useState } from "react";
import { ChevronDown, Settings2, TrendingUp, RotateCcw } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAppState } from "@/context/AppStateContext";

/**
 * NetworkLoadSimulator — floating "LIVE CHAOS" demo widget.
 * Surge floods Moodbidri APMC's queue (flipping it to Red/Congested);
 * reset restores its seed queue. Farmer dashboards in other tabs
 * re-recommend instantly via the storage-event sync.
 */
export default function NetworkLoadSimulator() {
  const { t } = useLanguage();
  const { centres, surgeQueue, resetDemoData } = useAppState();
  const [open, setOpen] = useState(false);

  const moodbidri = centres.find((c) => c.id === "centre-moodbidri");
  const congested = moodbidri
    ? moodbidri.queueCount / Math.max(1, moodbidri.processingRatePerHour) > 3
    : false;

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden">
      {open && (
        <div
          role="region"
          aria-label={t("judgeDemo")}
          className="mb-2 w-72 rounded-2xl border border-gray-700 bg-gray-900 p-3 text-white shadow-2xl"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            ⚙️ {t("judgeDemo")}
          </p>

          <button
            type="button"
            onClick={() => surgeQueue("centre-moodbidri", 15)}
            className="mt-2 min-h-11 w-full rounded-xl bg-red-600 px-3 py-2 text-left text-xs font-bold hover:bg-red-500 active:bg-red-700"
          >
            {t("surgeTrucks")}
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            className="mt-2 min-h-11 w-full rounded-xl border border-emerald-500 bg-emerald-900/40 px-3 py-2 text-left text-xs font-bold text-emerald-200 hover:bg-emerald-900/70"
          >
            {t("resetCongestionBtn")}
          </button>

          {congested && (
            <p className="mt-2 rounded-lg bg-red-950/60 px-2.5 py-1.5 text-[11px] font-bold text-red-300">
              Moodbidri APMC: 🔴 Congested
            </p>
          )}

          <p className="mt-2 text-[11px] leading-snug text-gray-300">
            {t("simulatorCallout")}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl ring-1 ring-gray-700 hover:bg-gray-800"
      >
        <Settings2 className="h-4 w-4" aria-hidden />
        {t("judgeDemo")}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
