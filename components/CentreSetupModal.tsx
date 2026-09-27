"use client";

import { useState } from "react";
import {
  Warehouse,
  Building2,
  MapPin,
  Wheat,
  Scale,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LOCATIONS, MOCK_CENTRES } from "@/lib/mockData";
import type { DemoCentreProfile } from "@/lib/types";

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
  "Other",
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

export const DEMO_CENTRE_STORAGE_KEY = "freebuff_centre_profile";

interface CentreSetupModalProps {
  isOpen: boolean;
  isEdit?: boolean;
  initialProfile?: DemoCentreProfile | null;
  onSave: (profile: DemoCentreProfile) => void;
  onClose?: () => void;
}

export default function CentreSetupModal({
  isOpen,
  isEdit = false,
  initialProfile,
  onSave,
  onClose,
}: CentreSetupModalProps) {
  const { t } = useLanguage();

  const defaultCentre = MOCK_CENTRES[0];

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Identity
  const [centreId, setCentreId] = useState(initialProfile?.centreId || defaultCentre?.id || "KS-CTR-01");
  const [name, setName] = useState(initialProfile?.name || defaultCentre?.name || "Moodbidri APMC Mandi");
  const [agency, setAgency] = useState(
    initialProfile?.agency || AGENCIES[0]
  );

  // Step 2: Location
  const [address, setAddress] = useState(
    initialProfile?.address || defaultCentre?.address || "APMC Yard, Moodbidri Main Road"
  );
  const [village, setVillage] = useState(
    initialProfile?.village || defaultCentre?.location || "Moodbidri"
  );
  const [district, setDistrict] = useState(
    initialProfile?.district || defaultCentre?.district || "Dakshina Kannada"
  );
  const [state, setState] = useState(
    initialProfile?.state || defaultCentre?.state || "Karnataka"
  );

  // Step 3: Crops
  const [supportedCrops, setSupportedCrops] = useState<string[]>(
    initialProfile?.supportedCrops?.length
      ? initialProfile.supportedCrops
      : defaultCentre?.eligibleCrops?.length
      ? defaultCentre.eligibleCrops
      : ["Paddy / Rice", "Arecanut", "Coconut"]
  );

  // Step 4: Capacity & Operations
  const [dailyCapacity, setDailyCapacity] = useState<number>(
    initialProfile?.dailyCapacity || defaultCentre?.capacityPerDay || 100
  );
  const [processingRatePerHour, setProcessingRatePerHour] = useState<number>(
    initialProfile?.processingRatePerHour || defaultCentre?.processingRatePerHour || 12
  );
  const [openingTime, setOpeningTime] = useState(
    initialProfile?.operatingHours?.opening || defaultCentre?.opensAt || "06:00"
  );
  const [closingTime, setClosingTime] = useState(
    initialProfile?.operatingHours?.closing || defaultCentre?.closesAt || "18:00"
  );

  if (!isOpen) return null;

  function handleQuickCentreSelect(cId: string) {
    const found = MOCK_CENTRES.find((c) => c.id === cId);
    if (found) {
      setCentreId(found.id);
      setName(found.name);
      setAddress(found.address || found.location);
      setVillage(found.location);
      setDistrict(found.district || "Dakshina Kannada");
      setState(found.state || "Karnataka");
      setSupportedCrops(found.eligibleCrops);
      setDailyCapacity(found.capacityPerDay);
      setProcessingRatePerHour(found.processingRatePerHour);
      setOpeningTime(found.opensAt);
      setClosingTime(found.closesAt);
    }
  }

  function handleCropToggle(crop: string) {
    setSupportedCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop]
    );
    if (error) setError(null);
  }

  function handleVillageSelect(vName: string) {
    setVillage(vName);
    const loc = LOCATIONS.find((l) => l.name.toLowerCase() === vName.toLowerCase());
    if (loc) {
      setDistrict(loc.district || "Dakshina Kannada");
      setState(loc.state || "Karnataka");
      setAddress(`APMC Main Yard, ${vName}`);
    }
  }

  function validateStep(step: number): boolean {
    setError(null);
    if (step === 1) {
      if (!centreId.trim()) {
        setError("Centre ID is required");
        return false;
      }
      if (!name.trim()) {
        setError("Centre Name is required");
        return false;
      }
      if (!agency.trim()) {
        setError("Procurement Agency is required");
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
      if (Number.isNaN(dailyCapacity) || dailyCapacity <= 0) {
        setError("Daily procurement capacity must be greater than 0 quintals");
        return false;
      }
      if (Number.isNaN(processingRatePerHour) || processingRatePerHour <= 0) {
        setError("Processing rate must be greater than 0 farmers/hour");
        return false;
      }
      if (!openingTime || !closingTime) {
        setError("Please configure valid operating hours (opening & closing time)");
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

  function handleCompleteSetup() {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    const dailyCap = Number(dailyCapacity);
    const profile: DemoCentreProfile = {
      centreId: centreId.trim(),
      name: name.trim(),
      address: address.trim() || village.trim() || district.trim(),
      village: village.trim() || district.trim(),
      district: district.trim(),
      state: state.trim(),
      agency: agency.trim(),
      supportedCrops,
      dailyCapacity: dailyCap,
      dailyCapacityKg: dailyCap * 100,
      processingRatePerHour: Number(processingRatePerHour),
      operatingHours: {
        opening: openingTime,
        closing: closingTime,
      },
      isSetupComplete: true,
    };

    onSave(profile);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="centre-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative my-8 w-full max-w-xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl transition-all sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
              <Warehouse className="h-6 w-6" />
            </span>
            <div>
              <h2 id="centre-setup-title" className="text-lg font-black text-gray-900 sm:text-xl">
                {isEdit ? "Edit Centre Configuration" : "Procurement Centre Setup"}
              </h2>
              <p className="text-xs font-semibold text-emerald-700">
                Centre Operations · Demo Track
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
              Step {currentStep} / 5
            </span>
            {isEdit && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
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
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-800 animate-in fade-in"
          >
            ⚠️ {error}
          </div>
        )}

        {/* Step Contents */}
        <div className="mt-5 min-h-64">
          {/* ---------------- STEP 1: IDENTITY ---------------- */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Step 1 — Centre Identity
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  Select an authoritative statutory facility or enter custom centre parameters.
                </p>
              </div>

              {/* Quick Preset Selector */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Quick Presets (Demo Centres):
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MOCK_CENTRES.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleQuickCentreSelect(c.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                        centreId === c.id
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600"
                          : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Centre ID <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  value={centreId}
                  onChange={(e) => {
                    setCentreId(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. KS-CTR-01"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono text-xs font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Centre Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Moodbidri APMC Mandi"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Procurement Agency <span className="text-emerald-600">*</span>
                </label>
                <select
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
          )}

          {/* ---------------- STEP 2: LOCATION ---------------- */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  Step 2 — Centre Location
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  Specify the physical location and regional operational catchment.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Village / Town (Canonical geocoded dataset)
                </label>
                <select
                  value={village}
                  onChange={(e) => handleVillageSelect(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name} ({loc.district}, {loc.state})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700">
                  Location / Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. APMC Yard, Moodbidri Main Road"
                  className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    District <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Dakshina Kannada"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    State <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 3: CROPS ---------------- */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Wheat className="h-4 w-4" />
                  Step 3 — Supported Crops
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  Select all agricultural commodities authorized for procurement at this centre.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          )}

          {/* ---------------- STEP 4: CAPACITY & OPERATIONS ---------------- */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Scale className="h-4 w-4" />
                  Step 4 — Capacity & Operations
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  Configure stable centre capability values. Dynamic metrics (Pending Requests & Available Capacity) will be calculated automatically by the system.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    Daily Procurement Capacity (quintals) <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={dailyCapacity}
                    onChange={(e) => setDailyCapacity(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                    = {(dailyCapacity * 100).toLocaleString("en-IN")} kg/day
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    Processing Rate (Farmers per hour) <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={processingRatePerHour}
                    onChange={(e) => setProcessingRatePerHour(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2.5 px-3 font-mono font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] font-semibold text-gray-500">
                    ~{(processingRatePerHour * 100).toLocaleString("en-IN")} kg/hour
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    Opening Time <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="time"
                    value={openingTime}
                    onChange={(e) => setOpeningTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2 px-3 text-sm font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700">
                    Closing Time <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="time"
                    value={closingTime}
                    onChange={(e) => setClosingTime(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white py-2 px-3 text-sm font-semibold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 5: REVIEW & FINISH ---------------- */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Step 5 — Review Configuration
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  Verify the centre parameters before finalizing your setup.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-500">Identity:</span>
                  <span className="font-extrabold text-gray-900 text-right">
                    {name} <span className="font-mono text-emerald-800">({centreId})</span>
                    <br />
                    <span className="text-[11px] font-semibold text-gray-600">{agency}</span>
                  </span>
                </div>

                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-500">Location:</span>
                  <span className="font-bold text-gray-800 text-right">
                    {address}
                    <br />
                    <span className="text-[11px] text-gray-600">{village}, {district}, {state}</span>
                  </span>
                </div>

                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-500">Operating Hours:</span>
                  <span className="font-extrabold text-gray-800">{openingTime} – {closingTime}</span>
                </div>

                <div className="border-b border-gray-200 pb-2">
                  <span className="font-bold text-gray-500">Supported Crops ({supportedCrops.length}):</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {supportedCrops.map((c) => (
                      <span key={c} className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                  <div className="rounded-xl border border-gray-200 bg-white p-2.5">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Daily Capacity</p>
                    <p className="font-black text-gray-900 text-sm">{dailyCapacity} q</p>
                    <p className="text-[10px] text-emerald-700 font-semibold">= {(dailyCapacity * 100).toLocaleString("en-IN")} kg</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-2.5">
                    <p className="text-[10px] uppercase font-bold text-gray-500">Processing Rate</p>
                    <p className="font-black text-gray-900 text-sm">{processingRatePerHour} farmers/hr</p>
                    <p className="text-[10px] text-gray-500">~{(processingRatePerHour * 100).toLocaleString("en-IN")} kg/hr</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
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
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteSetup}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.99]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Complete Setup</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
