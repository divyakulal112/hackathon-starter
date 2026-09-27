"use client";

import { useState } from "react";
import { User, MapPin, Check, X, Sprout } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { LOCATIONS, DEFAULT_LOCATION_ID, getFarmerLocation } from "@/lib/mockData";

interface FarmerProfileModalProps {
  isOpen: boolean;
  isEdit?: boolean;
  initialName?: string;
  initialVillage?: string;
  onSave: (name: string, village: string) => void;
  onClose?: () => void;
}

export default function FarmerProfileModal({
  isOpen,
  isEdit = false,
  initialName = "",
  initialVillage = "",
  onSave,
  onClose,
}: FarmerProfileModalProps) {
  const { t } = useLanguage();
  const defaultLoc = getFarmerLocation(DEFAULT_LOCATION_ID);

  const [name, setName] = useState(initialName || "");
  const [village, setVillage] = useState(initialVillage || defaultLoc.name);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedVillage = village.trim();

    if (!trimmedName) {
      setError("Please enter your name");
      return;
    }
    if (!trimmedVillage) {
      setError("Please select or enter your village / town");
      return;
    }

    setError(null);
    onSave(trimmedName, trimmedVillage);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-stone-200/80 bg-white p-6 shadow-2xl transition-all sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Sprout className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="profile-modal-title"
                className="text-base font-bold text-stone-900"
              >
                {isEdit ? t("editDetails") : t("welcomeFarmerTitle")}
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                {t("farmerPortal")} · KisanSync
              </p>
            </div>
          </div>

          {isEdit && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Subtitle */}
        <p className="mt-3 text-xs leading-relaxed text-stone-600">
          {t("welcomeFarmerSubtitle")}
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Farmer Name */}
          <div>
            <label className="block text-xs font-semibold text-stone-700">
              {t("farmerName")} <span className="text-emerald-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("enterFarmerName")}
                required
                className="w-full rounded-lg border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-3 text-sm font-medium text-stone-900 shadow-2xs transition-colors focus:bg-white focus:border-stone-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Village / Town */}
          <div>
            <label className="block text-xs font-semibold text-stone-700">
              {t("selectLocation")} <span className="text-emerald-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-400">
                <MapPin className="h-4 w-4" />
              </span>
              <select
                value={village}
                onChange={(e) => {
                  setVillage(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full rounded-lg border border-stone-200 bg-stone-50/50 py-2 pl-9 pr-3 text-sm font-medium text-stone-900 shadow-2xs transition-colors focus:bg-white focus:border-stone-400 focus:outline-hidden"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name} ({loc.district}, {loc.state})
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-stone-400">
              Used by the engine to calculate real distances to nearby procurement centres.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
            {isEdit && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 flex-1 rounded-lg border border-stone-200 bg-white px-4 text-xs font-semibold text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              >
                {t("cancel")}
              </button>
            )}
            <button
              type="submit"
              className="min-h-10 flex-1 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {isEdit ? t("saveDetails") : t("saveAndContinue")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
