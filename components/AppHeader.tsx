"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw, Sprout, Wifi, WifiOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGES } from "@/lib/translations";
import { useAppState } from "@/context/AppStateContext";
import RoleSwitcher from "./RoleSwitcher";

/**
 * AppHeader — brand, global role switcher, language selector and
 * offline-first connectivity state (ONLINE, OFFLINE, SYNCING, SYNCED).
 */
export default function AppHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { isOffline, usingCachedData, syncState, setOfflineDemo } = useAppState();

  const showOffline = isOffline || usingCachedData;

  let statusBadge = (
    <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700">
      <Wifi className="h-3.5 w-3.5 text-emerald-600" />
      ONLINE
    </span>
  );
  let badgeStyle = "border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700";

  if (syncState === "OFFLINE" || showOffline) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
        <WifiOff className="h-3.5 w-3.5 text-amber-600" />
        OFFLINE
      </span>
    );
    badgeStyle = "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  } else if (syncState === "SYNCING") {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-sky-800">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600" />
        SYNCING
      </span>
    );
    badgeStyle = "border-sky-200 bg-sky-50 text-sky-800";
  } else if (syncState === "SYNCED") {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        SYNCED
      </span>
    );
    badgeStyle = "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur-xs text-stone-900 shadow-2xs">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100">
            <Sprout className="h-4.5 w-4.5" aria-hidden />
          </span>
          <span className="text-base font-bold tracking-tight text-stone-900">{t("appName")}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Global role switcher — visible on every page */}
          <RoleSwitcher />

          {/* Language selector */}
          <div
            role="group"
            aria-label={t("language")}
            className="flex overflow-hidden rounded-lg border border-stone-200 bg-stone-50/80 p-0.5"
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
                  language === l.code
                    ? "bg-white text-stone-900 shadow-2xs font-semibold"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Online / offline / syncing / synced indicator (clickable demo toggle) */}
          <button
            type="button"
            onClick={() => setOfflineDemo(!showOffline)}
            title={
              showOffline
                ? "Demo: click to reconnect & trigger automatic sync"
                : "Demo: click to simulate offline mode"
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${badgeStyle}`}
          >
            {statusBadge}
          </button>
        </div>
      </div>

      {/* Dynamic Connectivity Banners */}
      {(syncState === "OFFLINE" || showOffline) && (
        <div className="border-t border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          ⚠️ {t("offlineBanner")} · {t("offlineStatus")}
        </div>
      )}
      {syncState === "SYNCING" && (
        <div className="flex items-center justify-center gap-2 border-t border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-center text-xs font-medium text-sky-900">
          <RefreshCw className="h-3 w-3 animate-spin text-sky-600" />
          {t("syncingStatus")}
        </div>
      )}
      {syncState === "SYNCED" && (
        <div className="flex items-center justify-center gap-2 border-t border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-xs font-medium text-emerald-900">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          {t("syncedStatus")}
        </div>
      )}
    </header>
  );
}
