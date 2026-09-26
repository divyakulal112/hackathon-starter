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
    <span className="inline-flex items-center gap-1.5 font-bold">
      <Wifi className="h-3.5 w-3.5 text-emerald-300" />
      ONLINE
    </span>
  );
  let badgeStyle = "border-emerald-400/60 text-emerald-50 hover:bg-emerald-600/50";

  if (syncState === "OFFLINE" || showOffline) {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 font-bold text-amber-200">
        <WifiOff className="h-3.5 w-3.5" />
        OFFLINE
      </span>
    );
    badgeStyle = "border-amber-300 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30";
  } else if (syncState === "SYNCING") {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 font-bold text-sky-200">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        SYNCING
      </span>
    );
    badgeStyle = "border-sky-300 bg-sky-500/20 text-sky-100";
  } else if (syncState === "SYNCED") {
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
        SYNCED
      </span>
    );
    badgeStyle = "border-emerald-300 bg-emerald-500/20 text-emerald-100";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-800/40 bg-emerald-700 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Sprout className="h-6 w-6" aria-hidden />
          <span className="text-lg font-extrabold tracking-tight">{t("appName")}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Global role switcher — visible on every page */}
          <RoleSwitcher />

          {/* Language selector */}
          <div
            role="group"
            aria-label={t("language")}
            className="flex overflow-hidden rounded-lg border border-emerald-500/60"
          >
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  language === l.code
                    ? "bg-white text-emerald-800"
                    : "text-emerald-100 hover:bg-emerald-600"
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
        <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-amber-950">
          ⚠️ {t("offlineBanner")} · {t("offlineStatus")}
        </div>
      )}
      {syncState === "SYNCING" && (
        <div className="flex items-center justify-center gap-2 bg-sky-600 px-4 py-1.5 text-center text-xs font-bold text-white">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {t("syncingStatus")}
        </div>
      )}
      {syncState === "SYNCED" && (
        <div className="flex items-center justify-center gap-2 bg-emerald-600 px-4 py-1.5 text-center text-xs font-bold text-white">
          <CheckCircle2 className="h-3 w-3" />
          {t("syncedStatus")}
        </div>
      )}
    </header>
  );
}
