"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2, Pause, Play, RefreshCw, Share2, X } from "@/components/common/icons";
import { toast } from "sonner";
import { BottomSheet } from "@/components/common/BottomSheet";
import { press } from "@/components/common/motion";
import { DostOrb } from "@/components/orb/DostOrb";
import * as api from "@/lib/api/client";
import { shareVoiceNote } from "@/components/common/share";
import { useSpeak } from "@/hooks/useSpeak";
import { getDb } from "@/lib/db/schema";
import { recordUsage } from "@/lib/db/repo";
import { errorKey } from "@/lib/i18n/errors";
import { LANGUAGE_LIST, LANGUAGES, type LangCode } from "@/lib/i18n/languages";
import type { ComposeKind, ComposeResult } from "@/lib/llm/schema";
import type { Shop } from "@/lib/types";

interface Props {
  shop: Shop;
  kind: ComposeKind;
  title: string;
  defaultLanguage: LangCode;
  data: Record<string, unknown>;
  filename: string;
  /** Offer the shopkeeper's cloned voice (reminders) */
  allowMyVoice?: boolean;
  onClose: () => void;
}

/**
 * Compose a message in a target language (Gemini) → synthesize (Timbre or cloned voice) → preview → share.
 * Used for payment reminders (customer's language) and distributor orders (supplier's language).
 */
export function VoiceNoteComposer({ shop, kind, title, defaultLanguage, data, filename, allowMyVoice, onClose }: Props) {
  const t = useTranslations();
  const [language, setLanguage] = useState<LangCode>(defaultLanguage);
  const [useMyVoice, setUseMyVoice] = useState(Boolean(allowMyVoice && shop.cloneEmbedding));
  const [msg, setMsg] = useState<ComposeResult | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<"compose" | "voice" | null>(null);
  const [fallback, setFallback] = useState(false);
  const speaker = useSpeak();

  const run = useCallback(async () => {
    setBusy("compose");
    setAudio(null);
    try {
      const m = await api.compose({ kind, targetLanguage: language, data: { ...data, shopName: shop.name, ownerName: shop.ownerName } });
      setMsg(m);
      void recordUsage(getDb(), { llmCalls: 1 });
      setBusy("voice");
      let blob: Blob;
      if (useMyVoice && shop.cloneEmbedding) {
        const r = await api.ttsClone({ text: m.speakText, language, embedding: shop.cloneEmbedding, fallbackVoice: shop.assistantVoice });
        blob = r.blob;
        setFallback(r.usedFallback);
      } else {
        blob = await api.tts({ text: m.speakText, language, voice: shop.assistantVoice });
        setFallback(false);
      }
      void recordUsage(getDb(), { ttsChars: m.speakText.length });
      setAudio(blob);
    } catch (e) {
      toast.error(t(errorKey(e)));
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, language, useMyVoice]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [run]);

  const share = async () => {
    if (!audio || !msg) return;
    const r = await shareVoiceNote(audio, msg.displayText, filename);
    if (r !== "cancelled") toast.success(r === "shared" ? t("shareSent") : t("shareDownloaded"));
  };

  return (
    <BottomSheet label={title} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={t("close")} className="rounded-full p-2 text-muted">
          <X className="h-6 w-6" />
        </button>
      </div>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="vn-lang">
        {t("language")}
      </label>
      <select
        id="vn-lang"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LangCode)}
        className="mb-3 min-h-12 w-full rounded-2xl border border-line bg-card px-3 text-lg font-semibold"
      >
        {LANGUAGE_LIST.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName} · {l.englishName}
          </option>
        ))}
      </select>

      {allowMyVoice && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-card p-1" role="radiogroup" aria-label={t("voiceLabel")}>
          {[
            { v: true, label: t("myVoice"), disabled: !shop.cloneEmbedding },
            { v: false, label: shop.assistantVoice, disabled: false },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={useMyVoice === o.v}
              disabled={o.disabled}
              onClick={() => setUseMyVoice(o.v)}
              className={`relative min-h-11 rounded-xl text-sm font-semibold ${useMyVoice === o.v ? "text-brand-ink" : "text-muted"} disabled:opacity-40`}
            >
              {useMyVoice === o.v && <motion.span layoutId="vn-voice" className="absolute inset-0 rounded-xl bg-brand shadow-card" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{o.label}</span>
            </button>
          ))}
        </div>
      )}
      {allowMyVoice && !shop.cloneEmbedding && <p className="-mt-1 mb-3 text-xs text-muted">{t("recordInSettings")}</p>}

      <div className="rounded-card border border-line bg-card p-4 shadow-card">
        <AnimatePresence mode="wait" initial={false}>
          {busy === "compose" || !msg ? (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-4">
              <DostOrb state="thinking" size={56} />
              <p className="font-semibold text-muted">{t("writingMessage")}</p>
            </motion.div>
          ) : (
            <motion.div key={msg.displayText} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-lg leading-relaxed" lang={language.split("-")[0]}>
                {msg.displayText}
              </p>
              {language !== "en-IN" && msg.glossEn && <p className="mt-2 border-t border-line pt-2 text-sm text-muted">🇬🇧 {msg.glossEn}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {fallback && <p className="mt-2 text-xs text-muted">ℹ️ {t("fallbackNote")}</p>}

      <div className="mt-4 flex gap-2">
        <motion.button
          type="button"
          {...press}
          disabled={!audio}
          onClick={() => (speaker.speaking ? speaker.stop() : audio && void speaker.play(audio))}
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-lg font-semibold disabled:opacity-50"
        >
          {busy === "voice" ? <Loader2 className="h-5 w-5 animate-spin" /> : speaker.speaking ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {t("listen")}
        </motion.button>
        <motion.button
          type="button"
          {...press}
          onClick={() => void run()}
          disabled={busy !== null}
          aria-label={t("regenerate")}
          className="flex min-h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card disabled:opacity-50"
        >
          <motion.span animate={{ rotate: busy ? 360 : 0 }} transition={busy ? { repeat: Infinity, duration: 1, ease: "linear" } : { duration: 0 }}>
            <RefreshCw className="h-5 w-5" />
          </motion.span>
        </motion.button>
        <motion.button
          type="button"
          {...press}
          disabled={!audio}
          onClick={() => void share()}
          className="flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-semibold text-white shadow-card disabled:opacity-50"
        >
          <Share2 className="h-5 w-5" /> {t("whatsapp")}
        </motion.button>
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        {LANGUAGES[language].nativeName} · Gnani {useMyVoice && shop.cloneEmbedding ? "Voice Clone" : "Timbre v3"}
      </p>
    </BottomSheet>
  );
}
