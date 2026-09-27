"use client";

import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
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
          className="mb-2 w-72 rounded-xl border border-stone-800 bg-stone-900/95 backdrop-blur-xs p-3.5 text-white shadow-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            ⚙️ {t("judgeDemo")}
          </p>

          <button
            type="button"
            onClick={() => surgeQueue("centre-moodbidri", 15)}
            className="mt-2.5 min-h-10 w-full rounded-lg bg-rose-600 px-3 py-2 text-left text-xs font-semibold hover:bg-rose-500 active:bg-rose-700 transition-colors"
          >
            {t("surgeTrucks")}
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            className="mt-2 min-h-10 w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-left text-xs font-semibold text-stone-200 hover:bg-stone-700 transition-colors"
          >
            {t("resetCongestionBtn")}
          </button>

          {congested && (
            <p className="mt-2 rounded-lg bg-rose-950/80 border border-rose-800/60 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300">
              Moodbidri APMC: 🔴 Congested
            </p>
          )}

          <p className="mt-2.5 text-[11px] leading-snug text-stone-400">
            {t("simulatorCallout")}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-stone-800 hover:bg-stone-800 transition-colors"
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
