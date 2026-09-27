"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  MapPin,
  Globe,
  ArrowRight,
  Sprout,
  CheckCircle2,
  Building,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useFarmerAuth } from "@/context/FarmerAuthContext";
import { LOCATIONS, DEFAULT_LOCATION_ID, getFarmerLocation } from "@/lib/mockData";
import RoleSwitcher from "@/components/RoleSwitcher";
import type { Language } from "@/lib/translations";

export default function FarmerOnboardingPage() {
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const { session, profile, isAuthenticated, isLoading, saveProfile } = useFarmerAuth();

  const defaultLoc = getFarmerLocation(DEFAULT_LOCATION_ID);

  const [name, setName] = useState(profile?.name || "");
  const [village, setVillage] = useState(profile?.village || defaultLoc.name);
  const [location, setLocation] = useState(
    profile?.location || `${defaultLoc.district}, ${defaultLoc.state}`
  );
  const [preferredLang, setPreferredLang] = useState<Language>(
    (profile?.preferredLanguage as Language) || language || "en"
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth Guard: If not authenticated, redirect to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/farmer/login");
    }
  }, [isLoading, isAuthenticated, router]);

  function handleVillageSelect(selectedVillageName: string) {
    setVillage(selectedVillageName);
    const matched = LOCATIONS.find((l) => l.name.toLowerCase() === selectedVillageName.toLowerCase());
    if (matched) {
      setLocation(`${matched.district}, ${matched.state}`);
    }
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedVillage = village.trim();
    const trimmedLocation = location.trim();

    if (!trimmedName) {
      setError("Please enter your full name");
      return;
    }
    if (!trimmedVillage) {
      setError("Please enter or select your village / town");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await saveProfile({
        name: trimmedName,
        village: trimmedVillage,
        location: trimmedLocation || trimmedVillage,
        preferredLanguage: preferredLang,
      });

      // Update app language if different
      if (preferredLang !== language) {
        setLanguage(preferredLang);
      }

      router.push("/farmer/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-emerald-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-xs font-semibold text-emerald-800">Checking authentication…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-emerald-50/60 via-white to-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/30 bg-emerald-700 text-white">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4 py-3 sm:max-w-xl">
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5" />
            <span className="font-extrabold text-sm">{t("appName")}</span>
          </div>
          <RoleSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:max-w-lg">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-900/5 sm:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
              <User className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
                {t("farmerProfileSetupTitle")}
              </h1>
              <p className="text-xs font-semibold text-emerald-700">
                {session?.phone ? `+91 ${session.phone}` : "Verified Account"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-gray-600">
            {t("farmerProfileSetupSubtitle")}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 animate-in fade-in"
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* 1. Full Name */}
            <div>
              <label htmlFor="farmer-fullname" className="block text-xs font-bold text-gray-700">
                {t("fullName")} <span className="text-emerald-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  id="farmer-fullname"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t("enterFullName")}
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 2. Village / Town */}
            <div>
              <label htmlFor="farmer-village" className="block text-xs font-bold text-gray-700">
                {t("villageTown")} <span className="text-emerald-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <MapPin className="h-4 w-4" />
                </span>
                <select
                  id="farmer-village"
                  value={village}
                  onChange={(e) => handleVillageSelect(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name} ({loc.district}, {loc.state})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Location / District */}
            <div>
              <label htmlFor="farmer-district" className="block text-xs font-bold text-gray-700">
                {t("districtLocation")} <span className="text-emerald-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Building className="h-4 w-4" />
                </span>
                <input
                  id="farmer-district"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="District, State (e.g. Dakshina Kannada, Karnataka)"
                  required
                  className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 4. Preferred Language */}
            <div>
              <label className="block text-xs font-bold text-gray-700">
                {t("preferredLanguage")} <span className="text-emerald-600">*</span>
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { code: "en" as const, label: "English", native: "English" },
                  { code: "kn" as const, label: "Kannada", native: "ಕನ್ನಡ" },
                  { code: "hi" as const, label: "Hindi", native: "हिन्दी" },
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setPreferredLang(item.code)}
                    className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                      preferredLang === item.code
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/30 font-bold"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium"
                    }`}
                  >
                    <span className="text-sm font-extrabold">{item.native}</span>
                    <span className="text-[10px] text-gray-500">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 font-bold text-white shadow-md shadow-emerald-700/20 transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{t("completeProfile")}</span>
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/80 py-3 text-center text-xs text-gray-500">
        KisanSync · {t("tagline")}
      </footer>
    </div>
  );
}
