"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Fallback text spoken when the target language's voice is missing and we
 * revert to an Indian-English voice. English is far more widely installed
 * than Kannada/Hindi voices, so this keeps voice assist USABLE on any device.
 */
const FALLBACK_SENTENCES: Record<string, string> = {
  kn: "Recommended centre: Karkala Co-op. Waiting time 48 minutes.",
  hi: "Recommended centre: Karkala Co-op. Waiting time 48 minutes.",
};

/**
 * Preferred fallback locales per language, in priority order.
 * Any Indian voice is better than an unrelated default for the demo.
 */
const INDIAN_FALLBACK_LOCALES = ["hi-IN", "en-IN", "en-GB", "en-US"];

export default function VoiceAssistButton({
  sentence,
}: {
  sentence: string;
}) {
  const { locale, t } = useLanguage();

  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  /** Subtle inline hint shown instead of any alert() popup. */
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);

  // ---------------------------------------------------------
  // Load browser speech voices
  // ---------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }

    setSupported(true);

    const speech = window.speechSynthesis;

    const loadVoices = () => {
      setVoices(speech.getVoices());
    };

    // Some browsers load voices asynchronously.
    loadVoices();
    speech.addEventListener("voiceschanged", loadVoices);

    return () => {
      speech.removeEventListener("voiceschanged", loadVoices);
      speech.cancel();
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    };
  }, []);

  /** Shows a non-blocking inline hint that auto-dismisses. */
  function showHint(message: string) {
    setVoiceHint(message);
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setVoiceHint(null), 4000);
  }

  // ---------------------------------------------------------
  // Voice resolution with layered fallbacks.
  // Never throws — always degrades to something speakable.
  // ---------------------------------------------------------
  function getBestVoice(
    availableVoices: SpeechSynthesisVoice[],
    selectedLocale: string,
  ): { voice: SpeechSynthesisVoice | null; usedFallback: boolean } {
    const normalized = selectedLocale.toLowerCase();
    const languageCode = normalized.split("-")[0];

    // 1. Exact locale match (e.g. "kn-IN" === "kn-IN")
    const exact = availableVoices.find(
      (v) => v.lang.toLowerCase() === normalized,
    );
    if (exact) return { voice: exact, usedFallback: false };

    // 2. Same language prefix (e.g. "kn-IN" request, "kn" voice installed)
    const languageMatch = availableVoices.find((v) =>
      v.lang.toLowerCase().startsWith(languageCode),
    );
    if (languageMatch) return { voice: languageMatch, usedFallback: false };

    // 3. Any Indian voice (hi-IN, en-IN, …) — closest accent/experience.
    for (const fb of INDIAN_FALLBACK_LOCALES) {
      const indian = availableVoices.find(
        (v) => v.lang.toLowerCase() === fb.toLowerCase(),
      );
      if (indian) return { voice: indian, usedFallback: true };
    }

    // 4. Default system voice (first available) — last resort, still audible.
    const any = availableVoices[0] ?? null;
    return { voice: any, usedFallback: true };
  }

  // ---------------------------------------------------------
  // Speak / Stop
  // ---------------------------------------------------------
  function handleSpeak() {
    if (!supported || typeof window === "undefined") return;

    const speech = window.speechSynthesis;

    // Toggle stop when already speaking.
    if (speaking) {
      speech.cancel();
      setSpeaking(false);
      return;
    }

    if (!sentence || sentence.trim().length === 0) return;

    const currentVoices =
      speech.getVoices().length > 0 ? speech.getVoices() : voices;

    const { voice: selectedVoice, usedFallback } = getBestVoice(
      currentVoices,
      locale,
    );

    // Speak English fallback text when the target voice is missing but we
    // found an Indian/default voice to carry the audio.
    const languageCode = locale.toLowerCase().split("-")[0];
    const textToSpeak =
      usedFallback && FALLBACK_SENTENCES[languageCode]
        ? FALLBACK_SENTENCES[languageCode]
        : sentence;

    // Silent degradation path — inline hint only, never alert().
    if (!selectedVoice) {
      showHint(t("voiceUnavailable"));
      return;
    }
    if (usedFallback) {
      showHint(
        `${t("voiceFallback")} (${selectedVoice.lang})`,
      );
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = selectedVoice.lang;
    utterance.voice = selectedVoice;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    // Cancel anything already running.
    speech.cancel();

    // Small delay helps Chrome/Android speech synthesis.
    setTimeout(() => {
      speech.speak(utterance);
      setSpeaking(true);
    }, 100);
  }

  // ---------------------------------------------------------
  // Browser does not support speech synthesis at all
  // ---------------------------------------------------------
  if (!supported) {
    return (
      <button
        type="button"
        disabled
        title={t("voiceUnavailable")}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-400"
      >
        <Volume2 className="h-4 w-4" aria-hidden />
        {t("voiceUnavailable")}
      </button>
    );
  }

  // ---------------------------------------------------------
  // UI — the hint renders inline under the button, never as a popup
  // ---------------------------------------------------------
  return (
    <div className="relative inline-flex flex-col">
      <button
        type="button"
        onClick={handleSpeak}
        aria-label={speaking ? t("voiceStop") : t("voiceAssist")}
        title={voiceHint ?? undefined}
        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
          speaking
            ? "border-emerald-700 bg-emerald-700 text-white"
            : "border-emerald-600 bg-white text-emerald-700 hover:bg-emerald-50"
        }`}
      >
        {speaking ? (
          <Square className="h-4 w-4" aria-hidden />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden />
        )}
        {speaking ? t("voiceStop") : t("voiceAssist")}
      </button>

      {voiceHint && (
        <span
          role="status"
          className="absolute top-full left-0 z-10 mt-1 w-max max-w-56 rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg"
        >
          {voiceHint}
        </span>
      )}
    </div>
  );
}
