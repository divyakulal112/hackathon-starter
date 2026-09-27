import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/lib/translations";

type BadgeVariant = "optimal" | "busy" | "congested" | "neutral" | "good" | "warn" | "bad";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  optimal: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  good: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  busy: "bg-amber-50 text-amber-700 border-amber-200/80",
  warn: "bg-amber-50 text-amber-700 border-amber-200/80",
  congested: "bg-rose-50 text-rose-700 border-rose-200/80",
  bad: "bg-rose-50 text-rose-700 border-rose-200/80",
  neutral: "bg-stone-50 text-stone-600 border-stone-200/80",
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
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${VARIANT_STYLES[variant]}`}
    >
      {text}
    </span>
  );
}
