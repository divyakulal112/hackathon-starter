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
      className="flex overflow-hidden rounded-lg border border-stone-200 bg-stone-50/80 p-0.5"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              active
                ? "bg-white text-stone-900 shadow-2xs font-semibold"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5 text-stone-400 group-hover:text-stone-600" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
