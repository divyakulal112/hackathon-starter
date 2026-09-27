"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Warehouse, ArrowRight, ArrowLeft, ShieldCheck, Sparkles, Building2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useCentreAuth } from "@/context/CentreAuthContext";
import { validateIndianPhone } from "@/lib/auth/farmerAuth";
import RoleSwitcher from "@/components/RoleSwitcher";
import { MOCK_CENTRES } from "@/lib/mockData";

export default function CentreLoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { sendOtp, setPendingCredentials } = useCentreAuth();

  const [centreId, setCentreId] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(val);
    if (error) setError(null);
  }

  function handleQuickCentreSelect(id: string) {
    setCentreId(id);
    if (!phone) {
      setPhone("9876543210");
    }
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCentreId = centreId.trim();
    if (!cleanCentreId) {
      setError("Please enter your Centre ID");
      return;
    }

    const validation = validateIndianPhone(phone);
    if (!validation.valid) {
      setError(validation.error || "Please enter a valid 10-digit registered mobile number");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await sendOtp(cleanCentreId, validation.normalizedPhone);
      if (res.success) {
        setPendingCredentials(cleanCentreId, validation.normalizedPhone);
        router.push(
          `/centre/verify?centreId=${encodeURIComponent(cleanCentreId)}&phone=${validation.normalizedPhone}`
        );
      } else {
        setError(res.error || "Failed to send OTP. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-stone-50/50 text-stone-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur-xs text-stone-900 shadow-2xs">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4 py-2.5 sm:max-w-xl">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t("home")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <RoleSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:max-w-lg">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xl sm:p-8">
          {/* Badge & Icon */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shadow-2xs">
              <Warehouse className="h-5 w-5" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
              <Sparkles className="h-3 w-3 text-emerald-600" />
              {t("demoModeBadge")}
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t("centreLoginTitle")}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600 sm:text-sm">
            {t("centreLoginSubtitle")}
          </p>

          {/* Quick Demo Centre ID Chips */}
          <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Demo Statutory Centres:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MOCK_CENTRES.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleQuickCentreSelect(c.id)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                >
                  {c.id}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 animate-in fade-in"
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* 1. Centre ID */}
            <div>
              <label htmlFor="centre-id" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("centreIdLabel")} <span className="text-emerald-600">*</span>
              </label>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <input
                  id="centre-id"
                  type="text"
                  value={centreId}
                  onChange={(e) => {
                    setCentreId(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={t("enterCentreId")}
                  required
                  className="w-full rounded-2xl border border-gray-300 bg-white py-3 pl-10 pr-3 font-mono text-sm font-bold text-gray-900 shadow-2xs focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            {/* 2. Registered Mobile Number */}
            <div>
              <label htmlFor="centre-phone" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("mobileNumber")} <span className="text-emerald-600">*</span>
              </label>

              <div className="relative mt-1.5 flex rounded-2xl border border-gray-300 bg-white shadow-xs focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/20">
                <span className="inline-flex items-center gap-1.5 rounded-l-2xl border-r border-gray-200 bg-gray-50 px-3.5 text-sm font-extrabold text-gray-700">
                  <span className="text-base">🇮🇳</span> +91
                </span>
                <input
                  id="centre-phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={t("enterMobileNumber")}
                  maxLength={10}
                  className="min-h-12 w-full rounded-r-2xl bg-transparent px-3 font-mono text-base font-bold tracking-wider text-gray-900 placeholder:font-sans placeholder:text-xs placeholder:font-normal placeholder:text-gray-400 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !centreId.trim() || phone.length !== 10}
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 font-bold text-white shadow-md shadow-emerald-700/20 transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{t("sendingOtp")}</span>
              ) : (
                <>
                  <span>{t("sendOtp")}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="flex items-center justify-center gap-1 text-[11px] font-medium text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Statutory Procurement Network Portal
            </p>
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
