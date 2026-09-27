"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  MapPin,
  Globe,
  Phone,
  LogOut,
  ArrowRight,
  Sprout,
  Edit3,
  ShieldCheck,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useFarmerAuth } from "@/context/FarmerAuthContext";
import RoleSwitcher from "@/components/RoleSwitcher";

export default function FarmerDashboardLanding() {
  const { t } = useLanguage();
  const router = useRouter();
  const { session, profile, isAuthenticated, isLoading, logout } = useFarmerAuth();

  // Auth Guard
  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace("/farmer/login");
      } else if (!profile || !profile.name || !profile.village) {
        router.replace("/farmer/onboarding");
      }
    }
  }, [isLoading, isAuthenticated, profile, router]);

  async function handleLogout() {
    await logout();
    router.push("/farmer/login");
  }

  if (isLoading || !isAuthenticated || !profile) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-emerald-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-xs font-semibold text-emerald-800">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const langNames = {
    en: "English",
    kn: "ಕನ್ನಡ (Kannada)",
    hi: "हिन्दी (Hindi)",
  };

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
                <span>{t("authenticatedPhone")}: +91 {profile.phone}</span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                {t("welcomeFarmerGreeting")}, {profile.name}!
              </h1>
              <p className="mt-1 text-xs text-emerald-200 sm:text-sm">
                {t("welcomeFarmerDashboard")}
              </p>
            </div>

            <Link
              href="/farmer/onboarding"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-400/40 bg-emerald-700/70 px-4 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-600 active:bg-emerald-800 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>{t("editProfile")}</span>
            </Link>
          </div>

          {/* Profile Quick Details */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-200">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  {t("villageTown")}
                </p>
                <p className="text-sm font-extrabold text-white">{profile.village}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-200">
                <User className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  {t("districtLocation")}
                </p>
                <p className="text-sm font-extrabold text-white">{profile.location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur-xs">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-200">
                <Globe className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  {t("preferredLanguage")}
                </p>
                <p className="text-sm font-extrabold text-white">
                  {langNames[profile.preferredLanguage] || profile.preferredLanguage}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Placeholder Section */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 shadow-inner">
              <Warehouse className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-gray-900">
              {t("welcomeFarmerDashboard")}
            </h2>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              {t("dashboardPlaceholderNotice")}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-6 font-bold text-white shadow-md shadow-emerald-700/20 hover:bg-emerald-700 active:scale-[0.99] transition-all"
              >
                <Warehouse className="h-4 w-4" />
                <span>{t("openProcurementServices")}</span>
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
