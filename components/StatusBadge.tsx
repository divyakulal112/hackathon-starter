import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

type BadgeVariant = "optimal" | "busy" | "congested" | "neutral" | "good" | "warn" | "bad";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  optimal: "bg-emerald-100 text-emerald-800 border-emerald-300",
  good: "bg-emerald-100 text-emerald-800 border-emerald-300",
  busy: "bg-amber-100 text-amber-800 border-amber-300",
  warn: "bg-amber-100 text-amber-800 border-amber-300",
  congested: "bg-red-100 text-red-800 border-red-300",
  bad: "bg-red-100 text-red-800 border-red-300",
  neutral: "bg-gray-100 text-gray-700 border-gray-300",
};

const VARIANT_KEY: Record<string, TranslationKey> = {
  optimal: "optimal",
  busy: "busy",
  congested: "congested",
};

export default function StatusBadge({
  variant,
  label,
}: {
  variant: BadgeVariant;
  /** Optional explicit label; otherwise translated from the variant name. */
  label?: string;
}) {
  const { t } = useLanguage();
  const text =
    label ?? (VARIANT_KEY[variant] ? t(VARIANT_KEY[variant]) : variant);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${VARIANT_STYLES[variant]}`}
    >
      {text}
    </span>
  );
}
