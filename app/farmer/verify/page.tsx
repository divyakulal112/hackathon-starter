"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Edit2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useFarmerAuth } from "@/context/FarmerAuthContext";
import RoleSwitcher from "@/components/RoleSwitcher";

export default function FarmerVerifyOtpPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pendingPhone, verifyOtp, sendOtp } = useFarmerAuth();

  const phoneParam = searchParams.get("phone") || pendingPhone || "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // If no phone is present, redirect to login
  useEffect(() => {
    if (!phoneParam) {
      router.replace("/farmer/login");
    }
  }, [phoneParam, router]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  function handleOtpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(val);
    if (error) setError(null);
  }

  async function handleResend() {
    if (resendCooldown > 0 || !phoneParam) return;
    setError(null);
    setResendMessage(null);
    try {
      const res = await sendOtp(phoneParam);
      if (res.success) {
        setResendCooldown(30);
        setResendMessage(res.message || "New Demo OTP sent: 123456");
      } else {
        setError(res.error || "Failed to resend OTP");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to resend OTP");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await verifyOtp(phoneParam, otp);
      if (res.success) {
        if (res.profile && res.profile.name && res.profile.village) {
          router.push("/farmer/dashboard");
        } else {
          router.push("/farmer/onboarding");
        }
      } else {
        setError(res.error || "Invalid OTP. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-emerald-50/60 via-white to-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-800/30 bg-emerald-700 text-white">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4 py-3 sm:max-w-xl">
          <Link
            href="/farmer/login"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-100 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t("changeMobileNumber")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <RoleSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:max-w-lg">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-900/5 sm:p-8">
          {/* Badge & Icon */}
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-xs">
              <KeyRound className="h-6 w-6" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              {t("demoModeBadge")}
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t("otpVerification")}
          </h1>
          <p className="mt-1.5 text-xs text-gray-600 sm:text-sm">
            {t("otpSentTo")}{" "}
            <span className="font-extrabold text-gray-900">+91 {phoneParam}</span>
          </p>

          <div className="mt-2">
            <Link
              href="/farmer/login"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
            >
              <Edit2 className="h-3 w-3" />
              <span>{t("changeMobileNumber")}</span>
            </Link>
          </div>

          {resendMessage && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
            >
              ✅ {resendMessage}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 animate-in fade-in"
            >
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="farmer-otp" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                {t("enterOtp")} <span className="text-emerald-600">*</span>
              </label>

              <div className="mt-2">
                <input
                  id="farmer-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="• • • • • •"
                  maxLength={6}
                  className="min-h-14 w-full rounded-2xl border border-gray-300 bg-white px-4 text-center font-mono text-2xl font-extrabold tracking-[0.5em] text-gray-900 shadow-xs focus:border-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
              <p className="mt-2 text-center text-[11px] font-medium text-gray-500">
                Tip: Enter the 6-digit Demo OTP <strong className="text-emerald-700">123456</strong>
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 font-bold text-white shadow-md shadow-emerald-700/20 transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{t("verifyingOtp")}</span>
              ) : (
                <>
                  <span>{t("verifyAndProceed")}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Resend Section */}
          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4 text-xs">
            <span className="text-gray-500">Didn't receive the code?</span>
            {resendCooldown > 0 ? (
              <span className="font-semibold text-gray-400">
                {t("resendOtpIn")} {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t("resendOtp")}</span>
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4 text-center">
            <p className="flex items-center justify-center gap-1 text-[11px] font-medium text-gray-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Secure Government-Compliant Agricultural Access
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
