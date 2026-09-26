"use client";

/**
 * LanguageContext — active language + translation helper.
 * The selection persists to localStorage (see STORAGE_KEYS.language).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LANGUAGES,
  TRANSLATIONS,
  type Language,
  type TranslationKey,
} from "@/lib/translations";
import { STORAGE_KEYS } from "@/lib/constants";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translate a key with English fallback. */
  t: (key: TranslationKey) => string;
  /** BCP-47 locale for speech synthesis, e.g. "kn-IN". */
  locale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Load persisted selection after mount (SSR-safe).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEYS.language);
    if (saved === "en" || saved === "kn" || saved === "hi") {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEYS.language, lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key],
    [language],
  );

  const locale = useMemo(
    () => LANGUAGES.find((l) => l.code === language)?.locale ?? "en-IN",
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, locale }),
    [language, setLanguage, t, locale],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}
