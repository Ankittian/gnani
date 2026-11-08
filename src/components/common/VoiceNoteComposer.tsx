"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Loader2, Pause, Play, RefreshCw, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { DostOrb } from "@/components/orb/DostOrb";
import * as api from "@/lib/api/client";
import { shareVoiceNote } from "@/components/common/share";
import { useSpeak } from "@/hooks/useSpeak";
import { getDb } from "@/lib/db/schema";
import { recordUsage } from "@/lib/db/repo";
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
      toast.error(api.friendlyError(e).message);
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, language, useMyVoice]);

  useEffect(() => {
    void run();
  }, [run]);

  const share = async () => {
    if (!audio || !msg) return;
    const r = await shareVoiceNote(audio, msg.displayText, filename);
    if (r !== "cancelled") toast.success(r === "shared" ? "Bhej diya! ✅" : "Audio download ho gaya — WhatsApp par bhejein");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-bg px-4 pb-8 pt-3"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted">
            <X className="h-6 w-6" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="vn-lang">
          Bhasha / Language
        </label>
        <select
          id="vn-lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value as LangCode)}
          className="mb-3 min-h-12 w-full rounded-2xl border border-line bg-card px-3 text-lg font-bold"
        >
          {LANGUAGE_LIST.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName} · {l.englishName}
            </option>
          ))}
        </select>

        {allowMyVoice && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-card p-1" role="radiogroup" aria-label="Voice">
            {[
              { v: true, label: "🗣️ Meri awaaz", disabled: !shop.cloneEmbedding },
              { v: false, label: `🤖 ${shop.assistantVoice}`, disabled: false },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                role="radio"
                aria-checked={useMyVoice === o.v}
                disabled={o.disabled}
                onClick={() => setUseMyVoice(o.v)}
                className={`min-h-11 rounded-xl text-sm font-bold ${useMyVoice === o.v ? "bg-brand text-brand-ink shadow-sticker" : "text-muted"} disabled:opacity-40`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {allowMyVoice && !shop.cloneEmbedding && <p className="-mt-1 mb-3 text-xs text-muted">Apni awaaz Settings mein record karein — reminder aapki awaaz mein jaayega.</p>}

        <div className="rounded-card border border-line bg-card p-4 shadow-sticker">
          {busy === "compose" || !msg ? (
            <div className="flex items-center gap-3 py-4">
              <DostOrb state="thinking" size={56} />
              <p className="font-bold text-muted">Message likh raha hoon…</p>
            </div>
          ) : (
            <>
              <p className="text-lg leading-relaxed" lang={language.split("-")[0]}>
                {msg.displayText}
              </p>
              {language !== "en-IN" && msg.glossEn && <p className="mt-2 border-t border-line pt-2 text-sm text-muted">🇬🇧 {msg.glossEn}</p>}
            </>
          )}
        </div>

        {fallback && <p className="mt-2 text-xs font-semibold text-muted">ℹ️ Is bhasha mein assistant ki awaaz use hui.</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!audio}
            onClick={() => (speaker.speaking ? speaker.stop() : audio && void speaker.play(audio))}
            className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-lg font-bold disabled:opacity-50"
          >
            {busy === "voice" ? <Loader2 className="h-5 w-5 animate-spin" /> : speaker.speaking ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            Suno
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy !== null}
            aria-label="Regenerate"
            className="flex min-h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card disabled:opacity-50"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={!audio}
            onClick={() => void share()}
            className="flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-extrabold text-white shadow-sticker disabled:opacity-50"
          >
            <Share2 className="h-5 w-5" /> WhatsApp
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-muted">
          {LANGUAGES[language].nativeName} · Gnani {useMyVoice && shop.cloneEmbedding ? "Voice Clone" : "Timbre v3"}
        </p>
      </motion.div>
    </div>
  );
}
