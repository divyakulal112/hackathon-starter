"use client";

import { useState } from "react";
import Link from "next/link";
import { Sprout, User, Warehouse, ArrowRight, Sparkles, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import RoleSwitcher from "@/components/RoleSwitcher";
import NetworkLoadSimulator from "@/components/NetworkLoadSimulator";

export default function LandingPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"demo" | "auth">("demo");

  return (
    <main className="flex min-h-svh flex-col bg-stone-50/50">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur-xs text-stone-900 shadow-2xs">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <span className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Sprout className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight text-stone-900">
              {t("appName")}
            </span>
          </span>
          <RoleSwitcher />
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-12 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1 text-xs font-medium text-stone-600 shadow-2xs mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          KisanSync Procurement Platform
        </div>
        <h1 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl md:text-5xl">
          Know when to go.<br />
          <span className="text-emerald-700">Know where to go.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-stone-600 sm:text-lg">
          Smart procurement coordination for farmers and procurement centres.
        </p>

        {/* Mode Selector Tabs: Demo Role vs Verified Phone Auth */}
        <div className="mx-auto mt-8 inline-flex rounded-xl border border-stone-200 bg-stone-100/80 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("demo")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "demo"
                ? "bg-white text-stone-900 shadow-2xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Demo Role (Instant Access)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("auth")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "auth"
                ? "bg-white text-stone-900 shadow-2xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-stone-500" />
            Verified Login (Phone OTP)
          </button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        {activeTab === "demo" ? (
          <div>
            <div className="mb-6 text-center">
              <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/80">
                Interactive Two-Track Demo Experience
              </span>
              <p className="mt-1.5 text-xs text-stone-500">
                Choose a track to test independent data flow, slot bookings, and live capacity updates.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <RoleCard
                href="/dashboard"
                badge="Track 1: Farmer"
                icon={<User className="h-5 w-5" />}
                title={t("farmerPortal")}
                hint="Personalized mandi recommendations, slot token booking, and live tracking with instant profile setup."
                cta="Launch Farmer Portal"
              />
              <RoleCard
                href="/centre"
                badge="Track 2: Centre"
                icon={<Warehouse className="h-5 w-5" />}
                title={t("centreOps")}
                hint="Procurement centre configuration, live farmer intake terminal, weight verification, and payment execution."
                cta="Launch Centre Operations"
              />
            </div>
            <p className="mt-6 text-center text-xs text-stone-500">
              {t("demoCredentialsNote")}
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-6 text-center">
              <span className="inline-block rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 border border-sky-200/80">
                Official Multi-Factor Phone Authentication
              </span>
              <p className="mt-1.5 text-xs text-stone-500">
                Secure 10-digit mobile number + OTP verification for registered farmers and procurement staff.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <RoleCard
                href="/farmer/login"
                badge="Farmer Auth"
                icon={<User className="h-5 w-5" />}
                title={t("farmerLoginTitle")}
                hint={t("farmerLoginSubtitle")}
                cta="Farmer Login"
              />
              <RoleCard
                href="/centre/login"
                badge="Staff Auth"
                icon={<Warehouse className="h-5 w-5" />}
                title={t("centreLoginTitle")}
                hint={t("centreLoginSubtitle")}
                cta="Centre Login"
              />
            </div>
          </div>
        )}
      </section>

      <footer className="border-t border-stone-200 bg-white px-4 py-3.5 text-center text-xs text-stone-500">
        {t("poweredBy")}
      </footer>

      <NetworkLoadSimulator />
    </main>
  );
}

function RoleCard({
  href,
  badge,
  icon,
  title,
  hint,
  cta,
}: {
  href: string;
  badge?: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-xl border border-stone-200/80 bg-white p-6 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-stone-100 text-stone-700 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
          {icon}
        </span>
        {badge && (
          <span className="rounded-full bg-stone-50 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 border border-stone-200">
            {badge}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-bold text-stone-900">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-stone-600">{hint}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 group-hover:text-emerald-800">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}