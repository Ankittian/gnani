"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Keyboard, Mic, RotateCcw, Send, Square, Undo2, X } from "@/components/common/icons";
import { BottomSheet } from "@/components/common/BottomSheet";
import { press } from "@/components/common/motion";
import { DostOrb, type OrbState } from "@/components/orb/DostOrb";
import { TipLine } from "@/components/common/Splash";
import { ActionCard } from "@/components/voice/ActionCard";
import { useShop } from "@/hooks/useShop";
import { useVoiceCommand, type VoicePhase } from "@/hooks/useVoiceCommand";
import { LANGUAGES } from "@/lib/i18n/languages";
import { playStart } from "@/lib/feedback";

const ORB: Record<VoicePhase, OrbState> = {
  idle: "idle",
  recording: "listening",
  transcribing: "thinking",
  understanding: "thinking",
  confirming: "idle",
  clarify: "thinking",
  committing: "thinking",
  speaking: "speaking",
  done: "happy",
  error: "sad",
};

export function VoiceSheet({ onClose, initialText }: { onClose: () => void; initialText?: string }) {
  const { shop, lang } = useShop();
  const t = useTranslations();
  const v = useVoiceCommand(shop);
  const { state, recorder } = v;
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const started = useRef(false);

  const { reset } = v;
  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Start listening as soon as the sheet opens (or run typed text).
  useEffect(() => {
    if (started.current || !shop) return;
    started.current = true;
    if (initialText) void v.submitText(initialText);
    else {
      playStart(shop.soundsOn);
      void v.startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  const phase = state.phase;
  const recording = phase === "recording";
  const micDenied = recorder.status === "error";
  const level = recording ? recorder.level : v.speakLevel;
  const remaining = Math.max(0, recorder.maxSec - recorder.elapsed);
  const status =
    micDenied && !state.transcript && (phase === "recording" || phase === "idle")
      ? t("micNeeded")
      : phase === "recording"
        ? t("listening")
        : phase === "transcribing" || phase === "understanding" || phase === "committing"
          ? t("thinking")
          : phase === "error"
            ? state.error
            : state.reply;

  const detected = state.detectedLanguage ? LANGUAGES[state.detectedLanguage] : null;

  return (
    <BottomSheet label={t("voiceAssistant")} onClose={close}>
      <button type="button" onClick={close} aria-label={t("close")} className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-brand-soft">
        <X className="h-6 w-6" />
      </button>

      <div className="flex flex-col items-center pt-0">
        <button
          type="button"
          onClick={() => (recording ? void v.stopListening() : undefined)}
          aria-label={recording ? t("stopRecording") : t("appName")}
          className="rounded-full"
        >
          <DostOrb state={micDenied && phase === "recording" ? "sad" : ORB[phase]} level={level} size={150} />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={status ?? ""}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-3 min-h-7 px-4 text-center text-lg font-semibold"
            aria-live="polite"
          >
            {status}
          </motion.p>
        </AnimatePresence>

        {(phase === "transcribing" || phase === "understanding" || phase === "committing") && <TipLine className="mt-1 w-full max-w-xs" />}

        {recording && !micDenied && (
          <div className="mt-2 flex items-center gap-3">
            <span className="tabular rounded-full bg-card px-3 py-1 text-sm font-semibold text-muted">0:{String(Math.ceil(remaining)).padStart(2, "0")}</span>
            <motion.button type="button" {...press} onClick={() => void v.stopListening()} className="flex min-h-12 items-center gap-2 rounded-full bg-chili px-5 font-semibold text-white shadow-card">
              <Square className="h-4 w-4 fill-current" /> {t("done")}
            </motion.button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {state.transcript && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-card border border-dashed border-line bg-card/70 px-4 py-3">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
              <span>{t("heard")}</span>
              {detected && <span className="rounded-full bg-saffron-soft px-2 py-0.5 normal-case text-saffron">{detected.nativeName}</span>}
            </div>
            <p className="text-lg leading-snug">“{state.transcript}”</p>
          </motion.div>
        )}
      </AnimatePresence>

      {state.action && (phase === "confirming" || phase === "committing") && (
        <div className="mt-4">
          <ActionCard
            action={state.action}
            problem={state.problem}
            autoConfirm={state.autoConfirm}
            busy={phase === "committing"}
            confirmLabel={t("confirm")}
            cancelLabel={t("cancel")}
            onChange={v.updateAction}
            onConfirm={() => void v.confirm()}
            onCancel={close}
          />
        </div>
      )}

      {phase === "clarify" && state.action?.clarify && (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="mt-4 grid gap-2" role="group" aria-label={state.action.clarify.question}>
          {state.action.clarify.options.map((o) => (
            <motion.button
              key={`${o.customerId}-${o.label}`}
              type="button"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => v.chooseOption(o.customerId, o.label)}
              className="min-h-14 rounded-2xl border border-line bg-card px-4 text-left text-lg font-semibold shadow-card"
            >
              {o.label}
            </motion.button>
          ))}
        </motion.div>
      )}

      {(phase === "done" || phase === "speaking") && state.result && (
        <div className="mt-4 flex justify-center">
          <motion.button type="button" {...press} onClick={() => void v.undo()} className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-card px-5 font-semibold text-muted">
            <Undo2 className="h-4 w-4" /> {t("undo")}
          </motion.button>
        </div>
      )}

      {(phase === "done" || phase === "error" || micDenied) && (
        <div className="mt-5 flex justify-center gap-3">
          <motion.button type="button" {...press} onClick={() => void v.startListening()} className="flex min-h-14 items-center gap-2 rounded-full bg-brand px-6 text-lg font-semibold text-brand-ink shadow-card">
            {phase === "error" ? <RotateCcw className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {phase === "error" ? t("retry") : t("tapToSpeak")}
          </motion.button>
        </div>
      )}

      <div className="mt-6">
        {typing || micDenied ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) {
                void v.submitText(text.trim());
                setText("");
              }
            }}
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={LANGUAGES[lang].sampleCommand}
              className="min-h-14 flex-1 rounded-2xl border border-line bg-card px-4 text-base focus:outline-none focus:ring-2 focus:ring-brand"
              aria-label={t("typeInstead")}
            />
            <motion.button type="submit" {...press} aria-label={t("send")} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron text-white">
              <Send className="h-5 w-5" />
            </motion.button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              v.reset();
              setTyping(true);
            }}
            className="mx-auto flex items-center gap-2 text-sm text-muted underline-offset-4 hover:underline"
          >
            <Keyboard className="h-4 w-4" /> {t("typeInstead")}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
