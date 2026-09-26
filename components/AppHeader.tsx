"use client";

import Link from "next/link";
import { Sprout, Wifi, WifiOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LANGUAGES } from "@/lib/translations";
import { useAppState } from "@/context/AppStateContext";
import RoleSwitcher from "./RoleSwitcher";

/**
 * AppHeader — brand, global role switcher, language selector and
 * online/offline state. Persistent frame for both role apps.
 */
export default function AppHeader() {
  const { language, setLanguage, t } = useLanguage();
  const { isOffline, usingCachedData, setOfflineDemo } = useAppState();

  const showOffline = isOffline || usingCachedData;

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

          {/* Online / offline indicator (clickable demo toggle). */}
          {/* Clicking it never replaces live data — banner only. */}
          <button
            type="button"
            onClick={() => setOfflineDemo(!showOffline)}
            title={
              showOffline
                ? "Demo: click to go back online"
                : "Demo: click to simulate offline mode"
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
              showOffline
                ? "border-amber-300 bg-amber-400/20 text-amber-100"
                : "border-emerald-400/60 text-emerald-50"
            }`}
          >
            {showOffline ? (
              <WifiOff className="h-3.5 w-3.5" />
            ) : (
              <Wifi className="h-3.5 w-3.5" />
            )}
            {showOffline ? t("offline") : t("online")}
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {showOffline && (
        <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-amber-950">
          {t("offlineBanner")}
        </div>
      )}
    </header>
  );
}
