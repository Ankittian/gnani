"use client";

import { useCallback, useState } from "react";
import * as api from "@/lib/api/client";
import { chunkOnSilence } from "@/lib/audio/chunk";
import { decodeToMono16k, TARGET_RATE } from "@/lib/audio/recorder";
import { encodeWav } from "@/lib/audio/wav";
import { buildShopContext, commitAction, recordUsage } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { buildKeyterms } from "@/lib/domain/keyterms";
import type { LangCode } from "@/lib/i18n/languages";
import type { Shop } from "@/lib/types";

export type LongStage = "idle" | "decoding" | "transcribing" | "understanding" | "saving" | "done" | "error";

export interface LongProgress {
  stage: LongStage;
  chunk: number;
  chunks: number;
  transcript: string;
  language: LangCode | null;
  orderId: string | null;
  error: string | null;
}

const IDLE: LongProgress = { stage: "idle", chunk: 0, chunks: 0, transcript: "", language: null, orderId: null, error: null };
const MAX_SEC = 10 * 60;

/** Customer voice order (any length, noisy, any language) → chunked Prisma STT → Gemini order extraction → saved order. */
export function useLongTranscribe(shop: Shop | null | undefined) {
  const [p, setP] = useState<LongProgress>(IDLE);

  const run = useCallback(
    async (input: Blob | Float32Array) => {
      if (!shop) return null;
      try {
        setP({ ...IDLE, stage: "decoding" });
        const samples = input instanceof Float32Array ? input : await decodeToMono16k(input);
        const duration = samples.length / TARGET_RATE;
        if (duration < 0.5) throw new Error("Audio khaali hai");
        if (duration > MAX_SEC) throw new Error("Audio 10 minute se lamba hai");

        const chunks = chunkOnSilence(samples, TARGET_RATE, 25);
        const ctx = await buildShopContext(getDb());
        const keyterms = buildKeyterms(ctx);
        let transcript = "";
        let language: LangCode | null = null;

        for (let i = 0; i < chunks.length; i++) {
          setP((s) => ({ ...s, stage: "transcribing", chunk: i + 1, chunks: chunks.length }));
          const wav = new Blob([encodeWav(chunks[i], TARGET_RATE)], { type: "audio/wav" });
          const res = await api.stt({
            audio: wav,
            filename: `order-${i}.wav`,
            languageHints: "indic-auto",
            keyterms,
            previousText: transcript.slice(-600) || undefined,
          });
          transcript = `${transcript} ${res.transcript}`.trim();
          language ??= res.detectedLanguageCode;
          setP((s) => ({ ...s, transcript, language }));
        }
        void recordUsage(getDb(), { sttSeconds: Math.ceil(duration) });
        if (!transcript) throw new Error("Kuch samajh nahi aaya — awaaz saaf nahi thi");

        setP((s) => ({ ...s, stage: "understanding" }));
        const action = await api.understand({ transcript, language: language ?? shop.language, mode: "order", context: ctx });
        void recordUsage(getDb(), { llmCalls: 1 });
        if (action.intent !== "create_order" || action.items.length === 0) throw new Error("Order mein koi saamaan nahi mila");

        setP((s) => ({ ...s, stage: "saving" }));
        const result = await commitAction(getDb(), action, { transcript, language: language ?? shop.language, audioDurationSec: duration });
        const orderId = result.createdIds.order ?? null;
        setP((s) => ({ ...s, stage: "done", orderId }));
        return orderId;
      } catch (e) {
        const message = e instanceof api.ApiError ? api.friendlyError(e).message : e instanceof Error ? e.message : "Kuch gadbad hui";
        setP((s) => ({ ...s, stage: "error", error: message }));
        return null;
      }
    },
    [shop],
  );

  const reset = useCallback(() => setP(IDLE), []);
  return { progress: p, run, reset };
}
