"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Keyboard, Mic, RotateCcw, Send, Square, Undo2, X } from "@/components/common/icons";
import { DostOrb, type OrbState } from "@/components/orb/DostOrb";
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
  const { shop, lang, tr } = useShop();
  const v = useVoiceCommand(shop);
  const { state, recorder } = v;
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const started = useRef(false);

  const close = () => {
    v.reset();
    onClose();
  };

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase = state.phase;
  const recording = phase === "recording";
  const micDenied = recorder.status === "error";
  const level = recording ? recorder.level : v.speakLevel;
  const remaining = Math.max(0, recorder.maxSec - recorder.elapsed);
  const status =
    micDenied && !state.transcript && (phase === "recording" || phase === "idle")
      ? "Mic permission chahiye — ya neeche likh dein 👇"
      : phase === "recording"
        ? tr("listening")
        : phase === "transcribing" || phase === "understanding" || phase === "committing"
          ? tr("thinking")
          : phase === "error"
            ? state.error
            : state.reply;

  const detected = state.detectedLanguage ? LANGUAGES[state.detectedLanguage] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Voice assistant">
      <motion.button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={close}
      />
      <motion.div
        className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[32px] bg-bg px-4 pb-8 pt-3"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-line" />
        <button type="button" onClick={close} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-brand-soft">
          <X className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center pt-2">
          <button
            type="button"
            onClick={() => (recording ? void v.stopListening() : undefined)}
            aria-label={recording ? "Stop recording" : "Dukaan Dost"}
            className="rounded-full"
          >
            <DostOrb state={micDenied && phase === "recording" ? "sad" : ORB[phase]} level={level} size={150} />
          </button>

          <p className="mt-3 min-h-7 px-4 text-center text-lg font-bold" aria-live="polite">
            {status}
          </p>

          {recording && !micDenied && (
            <div className="mt-2 flex items-center gap-3">
              <span className="tabular rounded-full bg-card px-3 py-1 text-sm font-bold text-muted">0:{String(Math.ceil(remaining)).padStart(2, "0")}</span>
              <button
                type="button"
                onClick={() => void v.stopListening()}
                className="flex min-h-12 items-center gap-2 rounded-full bg-chili px-5 font-bold text-white shadow-sticker active:scale-95"
              >
                <Square className="h-4 w-4 fill-current" /> Done
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {state.transcript && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-card border border-dashed border-line bg-card/70 px-4 py-3"
            >
              <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                <span>🎙️ Suna</span>
                {detected && <span className="rounded-full bg-indigo-soft px-2 py-0.5 normal-case text-indigo">{detected.nativeName}</span>}
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
              confirmLabel={tr("confirm")}
              cancelLabel={tr("cancel")}
              onChange={v.updateAction}
              onConfirm={() => void v.confirm()}
              onCancel={close}
            />
          </div>
        )}

        {phase === "clarify" && state.action?.clarify && (
          <div className="mt-4 grid gap-2" role="group" aria-label={state.action.clarify.question}>
            {state.action.clarify.options.map((o) => (
              <button
                key={`${o.customerId}-${o.label}`}
                type="button"
                onClick={() => v.chooseOption(o.customerId, o.label)}
                className="min-h-14 rounded-2xl border border-line bg-card px-4 text-left text-lg font-bold shadow-sticker active:scale-[0.99]"
              >
                👤 {o.label}
              </button>
            ))}
          </div>
        )}

        {(phase === "done" || phase === "speaking") && state.result && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void v.undo()}
              className="flex min-h-12 items-center gap-2 rounded-full border border-line bg-card px-5 font-bold text-muted"
            >
              <Undo2 className="h-4 w-4" /> {tr("undo")}
            </button>
          </div>
        )}

        {(phase === "done" || phase === "error" || micDenied) && (
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void v.startListening()}
              className="flex min-h-14 items-center gap-2 rounded-full bg-brand px-6 text-lg font-extrabold text-brand-ink shadow-sticker active:scale-95"
            >
              {phase === "error" ? <RotateCcw className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              {phase === "error" ? tr("retry") : tr("tapToSpeak")}
            </button>
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
                aria-label={tr("typeInstead")}
              />
              <button type="submit" aria-label="Send" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo text-white">
                <Send className="h-5 w-5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                v.reset();
                setTyping(true);
              }}
              className="mx-auto flex items-center gap-2 text-sm font-semibold text-muted underline-offset-4 hover:underline"
            >
              <Keyboard className="h-4 w-4" /> {tr("typeInstead")}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
