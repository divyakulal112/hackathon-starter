"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Warehouse } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * RoleSwitcher — persistent global navigation between the two role apps.
 * Highlights the tab matching the current pathname.
 */
export default function RoleSwitcher() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const tabs = [
    { href: "/dashboard", label: t("farmerApp"), icon: User },
    { href: "/centre", label: t("centreOps"), icon: Warehouse },
  ];

  return (
    <nav
      aria-label={t("role")}
      className="flex overflow-hidden rounded-lg border border-emerald-500/60"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors ${
              active
                ? "bg-white text-emerald-800"
                : "text-emerald-50 hover:bg-emerald-600"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
