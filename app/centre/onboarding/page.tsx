"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Warehouse,
  MapPin,
  Clock,
  Wheat,
  Scale,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  Layers,
  Gauge,
  Users,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCentreAuth } from "@/context/CentreAuthContext";
import RoleSwitcher from "@/components/RoleSwitcher";
import { DEMO_CROPS } from "@/lib/mockData";

const ALL_CROPS = [
  "Paddy / Rice",
  "Wheat",
  "Maize",
  "Pulses",
  "Oilseeds",
  "Cotton",
  "Coconut",
  "Arecanut",
  "Groundnut",
  "Chilli",
  "Tomato",
  "Potato",
];

const AGENCIES = [
  "Karnataka State Agricultural Marketing Board (KSAMB)",
  "Food Corporation of India (FCI)",
  "Delhi Agricultural Marketing Board (DAMB)",
  "Vegetable & Fruit Promotion Council Keralam (VFPCK)",
  "Maharashtra State Agricultural Marketing Board (MSAMB)",
  "Telangana State Agricultural Marketing Department",
  "State APMC & Department of Agriculture",
];

export default function CentreOnboardingPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { session, profile, operations, isAuthenticated, isLoading, saveProfileAndOperations } =
    useCentreAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Step 1 (Identity)
  const [name, setName] = useState(profile?.name || "");

  // Step 2 (Location & Agency)
  const [address, setAddress] = useState(profile?.address || "");
  const [village, setVillage] = useState(profile?.village || "");
  const [district, setDistrict] = useState(profile?.district || "Dakshina Kannada");
  const [state, setState] = useState(profile?.state || "Karnataka");
  const [agency, setAgency] = useState(profile?.agency || AGENCIES[0]);

  // Step 3 (Crops & Hours)
  const [supportedCrops, setSupportedCrops] = useState<string[]>(
    profile?.supportedCrops?.length ? profile.supportedCrops : ["Paddy / Rice", "Arecanut", "Coconut"]
  );
  const [openingTime, setOpeningTime] = useState(profile?.operatingHours?.opening || "06:00");
  const [closingTime, setClosingTime] = useState(profile?.operatingHours?.closing || "18:00");

  // Step 4 (Operational Capacity)
  const [dailyCapacity, setDailyCapacity] = useState<number>(operations?.dailyCapacity || 100);
  const [availableCapacity, setAvailableCapacity] = useState<number>(
    operations?.availableCapacity || 68
  );
  const [processingRatePerHour, setProcessingRatePerHour] = useState<number>(
    operations?.processingRatePerHour || 12
  );
  const [queueCount, setQueueCount] = useState<number>(operations?.queueCount || 5);
  const [availableSlots, setAvailableSlots] = useState<number>(operations?.availableSlots || 68);

  // Auth Guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/centre/login");
    }
  }, [isLoading, isAuthenticated, router]);

  function handleCropToggle(crop: string) {
    setSupportedCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop]
    );
    if (error) setError(null);
  }

  function validateStep(step: number): boolean {
    setError(null);
    if (step === 1) {
      if (!name.trim()) {
        setError("Centre Name is required");
        return false;
      }
    } else if (step === 2) {
      if (!district.trim()) {
        setError("District is required");
        return false;
      }
      if (!state.trim()) {
        setError("State is required");
        return false;
      }
    } else if (step === 3) {
      if (supportedCrops.length === 0) {
        setError("Please select at least one supported crop");
        return false;
      }
    } else if (step === 4) {
      if (dailyCapacity <= 0 || Number.isNaN(dailyCapacity)) {
        setError("Daily capacity must be greater than 0");
        return false;
      }
      if (availableCapacity < 0 || Number.isNaN(availableCapacity)) {
        setError("Available capacity cannot be negative");
        return false;
      }
      if (availableCapacity > dailyCapacity) {
        setError("Available capacity cannot exceed daily capacity");
        return false;
      }
      if (processingRatePerHour <= 0 || Number.isNaN(processingRatePerHour)) {
        setError("Processing rate per hour must be greater than 0");
        return false;
      }
      if (queueCount < 0 || Number.isNaN(queueCount)) {
        setError("Current queue cannot be negative");
        return false;
      }
      if (availableSlots < 0 || Number.isNaN(availableSlots)) {
        setError("Available slots cannot be negative");
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
    }
  }

  function handleBack() {
    setError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  async function handleFinish() {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await saveProfileAndOperations(
        {
          centreId: session?.centreId || "KS-CTR-01",
          name: name.trim(),
          address: address.trim() || village.trim() || district.trim(),
          village: village.trim() || district.trim(),
          district: district.trim(),
          state: state.trim(),
          agency: agency.trim(),
          supportedCrops,
          operatingHours: {
            opening: openingTime,
            closing: closingTime,
          },
        },
        {
          dailyCapacity,
          availableCapacity,
          processingRatePerHour,
          queueCount,
          availableSlots,
        }
      );

      router.push("/centre/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to save centre setup.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-emerald-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-xs font-semibold text-emerald-800">Checking centre authentication…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-emerald-50/60 via-white to-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/30 bg-emerald-700 text-white">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            <span className="font-extrabold text-sm">{t("appName")} · Centre Setup</span>
          </div>
          <RoleSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-900/5 sm:p-8">
          {/* Header Title */}
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
                {t("centreOnboardingTitle")}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Centre ID: <strong className="font-mono text-emerald-800">{session?.centreId}</strong>
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
              {t("stepIndicator")} {currentStep} / 5
            </span>
          </div>

          {/* 5-Step Progress Indicator */}
          <div className="mt-4">
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex flex-col items-center">
                  <div
                    className={`h-2 w-full rounded-full transition-all ${
                      s <= currentStep ? "bg-emerald-600" : "bg-gray-100"
                    }`}
                  />
                  <span
                    className={`mt-1 text-[10px] hidden sm:block ${
                      s === currentStep ? "font-bold text-emerald-800" : "text-gray-400"
                    }`}
                  >
                    {s === 1 && "Identity"}
                    {s === 2 && "Location"}
                    {s === 3 && "Crops"}
                    {s === 4 && "Capacity"}
                    {s === 5 && "Review"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 animate-in fade-in"
            >
              ⚠️ {error}
            </div>
          )}

          {/* Form Content Steps */}
          <div className="mt-6">
            {/* ----------------- STEP 1: Centre Identity ----------------- */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Building2 className="h-4 w-4" />
                  <h2>{t("step1Title")}</h2>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    {t("centreIdLabel")}
                  </label>
                  <input
                    type="text"
                    value={session?.centreId || ""}
                    disabled
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-100 py-2.5 px-3 font-mono text-xs font-bold text-gray-600"
                  />
                </div>

                <div>
                  <label htmlFor="centre-name" className="block text-xs font-bold text-gray-700">
                    {t("centreNameLabel")} <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    id="centre-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={t("enterCentreName")}
                    required
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* ----------------- STEP 2: Location & Agency ----------------- */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <MapPin className="h-4 w-4" />
                  <h2>{t("step2Title")}</h2>
                </div>

                <div>
                  <label htmlFor="centre-address" className="block text-xs font-bold text-gray-700">
                    {t("addressLabel")}
                  </label>
                  <input
                    id="centre-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t("enterAddress")}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="centre-village" className="block text-xs font-bold text-gray-700">
                      {t("villageTown")}
                    </label>
                    <input
                      id="centre-village"
                      type="text"
                      value={village}
                      onChange={(e) => setVillage(e.target.value)}
                      placeholder="e.g. Moodbidri"
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="centre-district" className="block text-xs font-bold text-gray-700">
                      {t("districtLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="centre-district"
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="e.g. Dakshina Kannada"
                      required
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="centre-state" className="block text-xs font-bold text-gray-700">
                      {t("stateLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="centre-state"
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      required
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="centre-agency" className="block text-xs font-bold text-gray-700">
                      {t("agencyLabel")}
                    </label>
                    <select
                      id="centre-agency"
                      value={agency}
                      onChange={(e) => setAgency(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 text-xs font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    >
                      {AGENCIES.map((ag) => (
                        <option key={ag} value={ag}>
                          {ag}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP 3: Supported Crops & Hours ----------------- */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Wheat className="h-4 w-4" />
                  <h2>{t("step3Title")}</h2>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    {t("supportedCrops")} (Select all that apply) <span className="text-emerald-600">*</span>
                  </label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ALL_CROPS.map((crop) => {
                      const selected = supportedCrops.includes(crop);
                      return (
                        <button
                          key={crop}
                          type="button"
                          onClick={() => handleCropToggle(crop)}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all ${
                            selected
                              ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-600"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-md border text-[10px] ${
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-gray-300"
                            }`}
                          >
                            {selected && "✓"}
                          </span>
                          <span>{crop}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label htmlFor="opening-time" className="block text-xs font-bold text-gray-700">
                      {t("openingTime")}
                    </label>
                    <input
                      id="opening-time"
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2 px-3 text-sm font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="closing-time" className="block text-xs font-bold text-gray-700">
                      {t("closingTime")}
                    </label>
                    <input
                      id="closing-time"
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2 px-3 text-sm font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP 4: Operational Capacity ----------------- */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <Scale className="h-4 w-4" />
                  <h2>{t("step4Title")}</h2>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="daily-cap" className="block text-xs font-bold text-gray-700">
                      {t("dailyCapacityLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="daily-cap"
                      type="number"
                      min={1}
                      value={dailyCapacity}
                      onChange={(e) => setDailyCapacity(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">= {(dailyCapacity * 100).toLocaleString("en-IN")} kg/day</p>
                  </div>

                  <div>
                    <label htmlFor="avail-cap" className="block text-xs font-bold text-gray-700">
                      {t("availableCapacityLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="avail-cap"
                      type="number"
                      min={0}
                      max={dailyCapacity}
                      value={availableCapacity}
                      onChange={(e) => setAvailableCapacity(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">= {(availableCapacity * 100).toLocaleString("en-IN")} kg remaining</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="rate-hour" className="block text-xs font-bold text-gray-700">
                      {t("processingRateLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="rate-hour"
                      type="number"
                      min={1}
                      value={processingRatePerHour}
                      onChange={(e) => setProcessingRatePerHour(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="queue-count" className="block text-xs font-bold text-gray-700">
                      {t("queueCountLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="queue-count"
                      type="number"
                      min={0}
                      value={queueCount}
                      onChange={(e) => setQueueCount(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="avail-slots" className="block text-xs font-bold text-gray-700">
                      {t("availableSlotsLabel")} <span className="text-emerald-600">*</span>
                    </label>
                    <input
                      id="avail-slots"
                      type="number"
                      min={0}
                      value={availableSlots}
                      onChange={(e) => setAvailableSlots(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ----------------- STEP 5: Review & Finish ----------------- */}
            {currentStep === 5 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <h2>{t("step5Title")}</h2>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 space-y-3 text-xs">
                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500">Centre:</span>
                    <span className="font-extrabold text-gray-900">{name} ({session?.centreId})</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500">Location:</span>
                    <span className="font-bold text-gray-800">{village ? `${village}, ` : ""}{district}, {state}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500">Agency:</span>
                    <span className="font-bold text-gray-800">{agency}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500">Operating Hours:</span>
                    <span className="font-bold text-gray-800">{openingTime} – {closingTime}</span>
                  </div>

                  <div className="border-b border-gray-200 pb-2">
                    <span className="font-bold text-gray-500">Supported Crops:</span>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {supportedCrops.map((c) => (
                        <span key={c} className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900 text-[11px]">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                    <div className="rounded-lg bg-white p-2 border border-gray-200">
                      <p className="text-[10px] text-gray-500">Daily Capacity</p>
                      <p className="font-extrabold text-gray-900">{dailyCapacity} q ({dailyCapacity * 100} kg)</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-gray-200">
                      <p className="text-[10px] text-gray-500">Available Capacity</p>
                      <p className="font-extrabold text-gray-900">{availableCapacity} q ({availableCapacity * 100} kg)</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-gray-200">
                      <p className="text-[10px] text-gray-500">Processing Rate</p>
                      <p className="font-extrabold text-gray-900">{processingRatePerHour} farmers/hr</p>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-gray-200">
                      <p className="text-[10px] text-gray-500">Live Queue & Slots</p>
                      <p className="font-extrabold text-gray-900">{queueCount} waiting · {availableSlots} slots</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-4">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t("previousStep")}</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99]"
              >
                <span>{t("nextStep")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{t("finishSetup")}</span>
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/80 py-3 text-center text-xs text-gray-500">
        KisanSync · {t("tagline")}
      </footer>
    </div>
  );
}
