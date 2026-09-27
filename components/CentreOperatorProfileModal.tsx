"use client";

import { useState } from "react";
import { User, Warehouse, Check, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { Centre } from "@/lib/types";

interface CentreOperatorProfileModalProps {
  isOpen: boolean;
  isEdit?: boolean;
  initialName?: string;
  initialCentreId?: string;
  centres: Centre[];
  onSave: (name: string, centreId: string) => void;
  onClose?: () => void;
}

export default function CentreOperatorProfileModal({
  isOpen,
  isEdit = false,
  initialName = "",
  initialCentreId = "",
  centres,
  onSave,
  onClose,
}: CentreOperatorProfileModalProps) {
  const { t } = useLanguage();

  const [name, setName] = useState(initialName || "");
  const [centreId, setCentreId] = useState(initialCentreId || centres[0]?.id || "");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const selectedCentre = centreId.trim() || centres[0]?.id || "";

    if (!trimmedName) {
      setError("Please enter operator / officer name");
      return;
    }
    if (!selectedCentre) {
      setError("Please select your assigned procurement centre");
      return;
    }

    setError(null);
    onSave(trimmedName, selectedCentre);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="operator-profile-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-6 shadow-2xl transition-all sm:p-7">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs">
              <Warehouse className="h-6 w-6" />
            </span>
            <div>
              <h2
                id="operator-profile-modal-title"
                className="text-lg font-extrabold text-gray-900 sm:text-xl"
              >
                {isEdit ? t("editDetails") : t("welcomeOperatorTitle")}
              </h2>
              <p className="text-xs text-emerald-700 font-medium">
                {t("centreOps")} · KisanSync
              </p>
            </div>
          </div>

          {isEdit && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              aria-label={t("close")}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Subtitle */}
        <p className="mt-3 text-xs leading-relaxed text-gray-600">
          {t("welcomeOperatorSubtitle")}
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Operator Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700">
              {t("operatorName")} <span className="text-emerald-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("enterOperatorName")}
                required
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-semibold text-gray-900 shadow-2xs transition-colors focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Assigned Centre Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700">
              {t("selectAssignedCentre")} <span className="text-emerald-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                <Warehouse className="h-4 w-4" />
              </span>
              <select
                value={centreId}
                onChange={(e) => {
                  setCentreId(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 font-semibold text-gray-900 shadow-2xs transition-colors focus:border-emerald-600 focus:outline-hidden"
              >
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.district || c.location})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-2 pt-2">
            {isEdit && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              >
                {t("cancel")}
              </button>
            )}
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
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
