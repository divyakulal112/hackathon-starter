"use client";

import Link from "next/link";
import { Sprout, User, Warehouse, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import RoleSwitcher from "@/components/RoleSwitcher";
import NetworkLoadSimulator from "@/components/NetworkLoadSimulator";

export default function LandingPage() {
const { t } = useLanguage();

return (
<main className="flex min-h-svh flex-col bg-gradient-to- from-emerald-50 via-white to-white">
<header className="sticky top-0 z-30 border-b border-emerald-800/40 bg-emerald-700 text-white">
<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3">
<span className="flex items-center gap-2">
<Sprout className="h-6 w-6" aria-hidden />
<span className="text-lg font-extrabold tracking-tight">
{t("appName")}
</span>
</span>
<RoleSwitcher />
</div>
</header>

<section className="mx-auto w-full max-w-5xl px-4 pb-6 pt-10 text-center">  
    <h1 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl">  
      KisanSync — {t("tagline")}  
    </h1>  
    <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-600">  
      {t("welcomeSubtitle")}  
    </p>  
  </section>  

  <section className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">  
    <h2 className="text-center text-sm font-bold uppercase tracking-wider text-gray-500">  
      {t("chooseRole")}  
    </h2>  
    <div className="mt-4 grid gap-4 sm:grid-cols-2">  
      <RoleCard  
        href="/dashboard"  
        icon={<User className="h-6 w-6" />}  
        title={t("farmerPortal")}  
        hint={t("farmerPortalDesc")}  
        cta={t("openDashboard")}  
      />  
      <RoleCard  
        href="/centre"  
        icon={<Warehouse className="h-6 w-6" />}  
        title={t("centreOps")}  
        hint={t("centrePortalDesc")}  
        cta={t("openDashboard")}  
      />  
    </div>  
    <p className="mt-6 text-center text-xs text-gray-500">  
      {t("demoCredentialsNote")}  
    </p>  
  </section>  

  <footer className="border-t border-gray-200 bg-emerald-50/60 px-4 py-3 text-center text-xs text-gray-500">  
    {t("poweredBy")}  
  </footer>  

  <NetworkLoadSimulator />  
</main>

);
}

function RoleCard({
href,
icon,
title,
hint,
cta,
}: {
href: string;
icon: React.ReactNode;
title: string;
hint: string;
cta: string;
}) {
return (
<Link  
href={href}  
className="group flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md"  
>
<span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
{icon}
</span>
<h3 className="mt-3 text-lg font-bold text-gray-900">{title}</h3>
<p className="mt-1 flex-1 text-sm leading-snug text-gray-600">{hint}</p>
<span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
{cta}
<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
</span>
</Link>
);
}