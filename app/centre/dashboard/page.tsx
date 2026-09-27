"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Warehouse,
  Users,
  Gauge,
  Layers,
  LogOut,
  ArrowRight,
  Sprout,
  Edit3,
  ShieldCheck,
  Building2,
  Clock,
  Wheat,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCentreAuth } from "@/context/CentreAuthContext";
import RoleSwitcher from "@/components/RoleSwitcher";

export default function CentreDashboardLanding() {
  const { t } = useLanguage();
  const router = useRouter();
  const { session, profile, operations, isAuthenticated, isLoading, logout } = useCentreAuth();

  // Auth Guard & Role Guard: Ensure user is an authenticated Centre with completed profile
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/centre/login");
      } else if (!profile || !operations || !profile.name) {
        router.replace("/centre/onboarding");
      }
    }
  }, [isLoading, isAuthenticated, profile, operations, router]);

  async function handleLogout() {
    await logout();
    router.push("/centre/login");
  }

  if (isLoading || !isAuthenticated || !profile || !operations) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-emerald-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-xs font-semibold text-emerald-800">Loading centre operations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-emerald-50/60 via-white to-gray-50 text-gray-900">
      {/* App Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/30 bg-emerald-700 text-white shadow-xs">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-emerald-200" />
            <span className="text-base font-extrabold tracking-tight sm:text-lg">
              {t("appName")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <RoleSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-800/80 px-3 py-1.5 text-xs font-bold text-emerald-100 hover:bg-emerald-900 active:bg-emerald-950 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t("logout")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        {/* Welcome Banner */}
        <section className="rounded-3xl border border-emerald-200 bg-emerald-800 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700/80 px-3 py-1 text-xs font-bold text-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                <span>Centre ID: {profile.centreId}</span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                {t("welcomeFarmerGreeting")}, {profile.name}
              </h1>
              <p className="mt-1 text-xs text-emerald-200 sm:text-sm">
                {t("centreDashboardTitle")} · {profile.agency}
              </p>
            </div>

            <Link
              href="/centre/onboarding"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-400/40 bg-emerald-700/70 px-4 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-600 active:bg-emerald-800 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{t("editProfile")}</span>
            </Link>
          </div>

          {/* Operational Metrics Cards */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-emerald-200">
                <Users className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Current Queue</span>
              </div>
              <p className="mt-2 text-xl font-black text-white sm:text-2xl">
                {operations.queueCount}
              </p>
              <p className="text-[11px] text-emerald-300">farmers waiting</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-emerald-200">
                <Gauge className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Available Capacity</span>
              </div>
              <p className="mt-2 text-xl font-black text-white sm:text-2xl">
                {operations.availableCapacity} q
              </p>
              <p className="text-[11px] text-emerald-300">of {operations.dailyCapacity} q daily</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-emerald-200">
                <Layers className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Processing Rate</span>
              </div>
              <p className="mt-2 text-xl font-black text-white sm:text-2xl">
                {operations.processingRatePerHour}/hr
              </p>
              <p className="text-[11px] text-emerald-300">farmers per hour</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <div className="flex items-center gap-1.5 text-emerald-200">
                <Clock className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Available Slots</span>
              </div>
              <p className="mt-2 text-xl font-black text-white sm:text-2xl">
                {operations.availableSlots}
              </p>
              <p className="text-[11px] text-emerald-300">slots today</p>
            </div>
          </div>
        </section>

        {/* Dashboard Placeholder Notice Section */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 shadow-inner">
              <Warehouse className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              {t("centreDashboardTitle")}
            </h2>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              {t("centreDashboardNotice")}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/centre"
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-6 font-bold text-white shadow-md shadow-emerald-700/20 hover:bg-emerald-700 active:scale-[0.99] transition-all"
              >
                <Warehouse className="h-4 w-4" />
                <span>{t("openLiveIntake")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
        KisanSync · {t("tagline")}
      </footer>
    </div>
  );
}
