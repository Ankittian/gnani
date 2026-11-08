"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api/client";
import { encodeWav } from "@/lib/audio/wav";
import { getDb } from "@/lib/db/schema";
import { buildShopContext, commitAction, recordUsage, undoCommit, type CommitResult } from "@/lib/db/repo";
import { buildKeyterms } from "@/lib/domain/keyterms";
import { matchCustomer, matchProduct } from "@/lib/domain/match";
import { formatINR } from "@/lib/domain/money";
import { actionProblem, MUTATING_INTENTS, type Action } from "@/lib/llm/schema";
import { celebrate, playTing, vibrate } from "@/lib/feedback";
import type { LangCode } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/strings";
import type { Shop, ShopContext } from "@/lib/types";
import { canAutoConfirm, fillBalance, languageHintsFor, sttFormatFor } from "@/lib/voice/pipeline";
import { useRecorder, type RecordingResult } from "@/hooks/useRecorder";
import { useSpeak } from "@/hooks/useSpeak";

export type VoicePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "understanding"
  | "confirming"
  | "clarify"
  | "committing"
  | "speaking"
  | "done"
  | "error";

export interface VoiceState {
  phase: VoicePhase;
  transcript: string;
  detectedLanguage: LangCode | null;
  action: Action | null;
  problem: string | null;
  autoConfirm: boolean;
  reply: string;
  result: CommitResult | null;
  error: string | null;
}

const INITIAL: VoiceState = {
  phase: "idle",
  transcript: "",
  detectedLanguage: null,
  action: null,
  problem: null,
  autoConfirm: false,
  reply: "",
  result: null,
  error: null,
};

async function contextWithStock(): Promise<ShopContext> {
  const db = getDb();
  const ctx = await buildShopContext(db);
  const products = await db.products.toArray();
  const qty = new Map(products.map((p) => [p.id, p]));
  // Extra fields (stockQty, reorderLevel) let the LLM answer "kitna bacha hai?" without another round-trip.
  return {
    ...ctx,
    products: ctx.products.map((p) => ({ ...p, stockQty: qty.get(p.id)?.stockQty ?? null, reorderLevel: qty.get(p.id)?.reorderLevel ?? null })),
  } as ShopContext;
}

export function useVoiceCommand(shop: Shop | null | undefined) {
  const [state, setState] = useState<VoiceState>(INITIAL);
  const lastTranscript = useRef<string>("");
  const speaker = useSpeak();
  const router = useRouter();
  const patch = (p: Partial<VoiceState>) => setState((s) => ({ ...s, ...p }));
  const lang: LangCode = shop?.language ?? "hi-IN";

  const speak = useCallback(
    async (text: string, language: LangCode) => {
      if (!text.trim() || !shop) return;
      try {
        const blob = await api.tts({ text, language, voice: shop.assistantVoice });
        void recordUsage(getDb(), { ttsChars: text.length });
        await speaker.play(blob);
      } catch {
        /* speaking is best-effort; text is always shown */
      }
    },
    [shop, speaker],
  );

  const fail = useCallback((message: string) => patch({ phase: "error", error: message }), []);

  /** Run understanding on a transcript (from STT or typed). */
  const processTranscript = useCallback(
    async (transcript: string, detected: LangCode | null) => {
      if (!shop) return;
      const text = transcript.trim();
      if (!text) {
        fail(t(lang, "heardNothing"));
        return;
      }
      lastTranscript.current = text;
      patch({ phase: "understanding", transcript: text, detectedLanguage: detected });
      try {
        const context = await contextWithStock();
        const action = await api.understand({ transcript: text, language: detected ?? shop.language, mode: "command", context });
        void recordUsage(getDb(), { llmCalls: 1 });
        await routeAction(action);
      } catch (e) {
        fail(api.friendlyError(e).message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shop, lang],
  );

  const routeAction = async (action: Action) => {
    if (!shop) return;
    const db = getDb();
    const problem = actionProblem(action);

    if (action.clarify && action.clarify.options.length > 0) {
      patch({ phase: "clarify", action, problem, reply: action.clarify.question });
      void speak(action.clarify.question, action.replyLanguage);
      return;
    }

    if (MUTATING_INTENTS.has(action.intent)) {
      patch({ phase: "confirming", action, problem, autoConfirm: canAutoConfirm(action, problem), reply: action.replyText });
      return;
    }

    // Read-only intents: answer straight away.
    switch (action.intent) {
      case "query_balance": {
        const customers = (await db.customers.toArray()).filter((c) => !c.deletedAt);
        const c =
          (action.customer?.id && customers.find((x) => x.id === action.customer?.id)) ||
          (action.customer ? customers.find((x) => x.id === matchCustomer(action.customer!.name, customers).best?.id) : undefined);
        const say = c ? fillBalance(action.speakText, c.balance) : action.speakText;
        patch({ phase: "speaking", action, reply: c ? `${c.name}: ${formatINR(c.balance)}` : action.replyText });
        await speak(say, action.replyLanguage);
        patch({ phase: "done" });
        return;
      }
      case "query_stock": {
        const products = await db.products.toArray();
        const name = action.stockOps[0]?.name ?? action.items[0]?.name ?? "";
        const p = name ? products.find((x) => x.id === matchProduct(name, products).best?.id) : undefined;
        patch({ phase: "speaking", action, reply: p ? `${p.emoji} ${p.name}: ${p.stockQty} ${p.unit}` : action.replyText });
        await speak(action.speakText, action.replyLanguage);
        patch({ phase: "done" });
        return;
      }
      case "send_reminder": {
        const customers = await db.customers.toArray();
        const id = action.customer?.id ?? (action.customer ? matchCustomer(action.customer.name, customers).best?.id : undefined);
        patch({ phase: "done", action, reply: action.replyText });
        if (id) router.push(`/khata/${id}?remind=1`);
        return;
      }
      case "daily_summary":
        patch({ phase: "done", action, reply: action.replyText });
        router.push("/hisaab?play=1");
        return;
      default:
        patch({ phase: "speaking", action, reply: action.replyText });
        await speak(action.speakText, action.replyLanguage);
        patch({ phase: "done" });
    }
  };

  const handleRecording = useCallback(
    async (rec: RecordingResult | null) => {
      if (!rec || !shop) return;
      if (rec.durationSec < 0.5) {
        fail(t(lang, "heardNothing"));
        return;
      }
      patch({ phase: "transcribing" });
      try {
        const context = await buildShopContext(getDb());
        const wav = new Blob([encodeWav(rec.samples, rec.sampleRate)], { type: "audio/wav" });
        const res = await api.stt({
          audio: wav,
          filename: "speech.wav",
          languageHints: languageHintsFor(shop),
          keyterms: buildKeyterms(context),
          previousText: lastTranscript.current || undefined,
          format: sttFormatFor(shop.language),
        });
        void recordUsage(getDb(), { sttSeconds: Math.ceil(rec.durationSec) });
        await processTranscript(res.transcript, res.detectedLanguageCode);
      } catch (e) {
        fail(api.friendlyError(e).message);
      }
    },
    [shop, lang, processTranscript, fail],
  );

  const recorder = useRecorder({ maxSec: 25, onAutoStop: (r) => void handleRecording(r) });

  const startListening = useCallback(async () => {
    speaker.stop();
    setState({ ...INITIAL, phase: "recording" });
    await recorder.start();
  }, [recorder, speaker]);

  const stopListening = useCallback(async () => {
    const rec = await recorder.stop();
    await handleRecording(rec);
  }, [recorder, handleRecording]);

  const submitText = useCallback(
    async (text: string) => {
      speaker.stop();
      setState({ ...INITIAL, phase: "understanding", transcript: text });
      await processTranscript(text, null);
    },
    [processTranscript, speaker],
  );

  const updateAction = useCallback((a: Action) => {
    setState((s) => ({ ...s, action: a, problem: actionProblem(a), autoConfirm: false }));
  }, []);

  const chooseOption = useCallback(
    (customerId: string | null, label: string) => {
      setState((s) => {
        if (!s.action) return s;
        const action: Action = {
          ...s.action,
          clarify: null,
          customer: { id: customerId, name: label, isNew: customerId == null },
        };
        return { ...s, phase: "confirming", action, problem: actionProblem(action), autoConfirm: false };
      });
    },
    [],
  );

  const confirm = useCallback(async () => {
    const { action } = state;
    if (!action || !shop || state.phase !== "confirming") return;
    patch({ phase: "committing", autoConfirm: false });
    try {
      const result = await commitAction(getDb(), action, {
        transcript: state.transcript,
        language: state.detectedLanguage ?? shop.language,
      });
      vibrate(30, shop.soundsOn);
      playTing(shop.soundsOn);
      const say = fillBalance(action.speakText, result.newBalance);
      patch({ phase: "speaking", result, reply: fillBalance(action.replyText, result.newBalance) });
      if (action.intent === "record_payment" && result.newBalance !== null && result.newBalance <= 0 && (result.previous.balance ?? 0) > 0) {
        void celebrate();
      }
      await speak(say, action.replyLanguage);
      patch({ phase: "done" });
    } catch (e) {
      const msg = e instanceof Error && e.message === "ambiguous_customer" ? "Kaun se customer? Naam thoda aur saaf bolein." : api.friendlyError(e).message;
      fail(msg);
    }
  }, [state, shop, speak, fail]);

  const undo = useCallback(async () => {
    if (!state.result) return;
    await undoCommit(getDb(), state.result);
    patch({ result: null, reply: "↩️ " + t(lang, "undo") });
  }, [state.result, lang]);

  const reset = useCallback(() => {
    recorder.cancel();
    speaker.stop();
    setState(INITIAL);
  }, [recorder, speaker]);

  return {
    state,
    recorder,
    speaking: speaker.speaking,
    speakLevel: speaker.level,
    startListening,
    stopListening,
    submitText,
    updateAction,
    chooseOption,
    confirm,
    undo,
    reset,
  };
}
