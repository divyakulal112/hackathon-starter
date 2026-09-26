"use client";

import { useEffect, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * VoiceAssistButton — reads the active recommendation aloud using
 * window.speechSynthesis. Locale follows the selected language
 * (en-IN / kn-IN / hi-IN). Gracefully degrades when unsupported.
 */
export default function VoiceAssistButton({
  sentence,
}: {
  /** Fully composed, already-translated sentence to speak. */
  sentence: string;
}) {
  const { locale, t } = useLanguage();
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleSpeak() {
    if (!("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = locale;
    // Prefer a voice matching the locale; fall back to any voice.
    const voices = window.speechSynthesis.getVoices();
    const match =
      voices.find((v) => v.lang.toLowerCase() === locale.toLowerCase()) ??
      voices.find((v) => v.lang.toLowerCase().startsWith(locale.slice(0, 2)));
    if (match) utterance.voice = match;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title={t("voiceUnavailable")}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-400"
      >
        <Volume2 className="h-4 w-4" />
        {t("voiceUnavailable")}
      </button>
      );
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={t("voiceAssist")}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
        speaking
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      {speaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {speaking ? t("voiceStop") : t("voiceAssist")}
    </button>
  );
}
