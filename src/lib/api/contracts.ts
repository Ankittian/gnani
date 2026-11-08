/** Request/response contracts for the internal Next.js API (camelCase JSON). */
import type { LangCode } from "@/lib/i18n/languages";
import type { Action, ComposeKind, ComposeResult } from "@/lib/llm/schema";
import type { CloneEmbedding, ShopContext } from "@/lib/types";

export type ApiErrorCode =
  | "STT_FAILED"
  | "TTS_FAILED"
  | "CLONE_FAILED"
  | "AUDIO_TOO_LONG"
  | "UNSUPPORTED_FORMAT"
  | "RATE_LIMITED"
  | "OUT_OF_CREDITS"
  | "LLM_INVALID_OUTPUT"
  | "LLM_FAILED"
  | "CAP_EXCEEDED"
  | "BAD_REQUEST"
  | "NOT_CONFIGURED";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; status: number };
}

export interface HealthResponse {
  gnani: boolean;
  gemini: boolean;
  mock: boolean;
}

/**
 * POST /api/stt — multipart/form-data:
 *   audio: File (wav/ogg/mp3/m4a/aac/flac; .opus is renamed to .ogg server-side)
 *   languageHints: "indic-auto" | comma-separated LangCodes (≤4)
 *   keyterms?: JSON string array (≤200)
 *   previousText?: string
 *   format?: "verbatim" | "transcribe" | "codemix"
 */
export interface SttResponse {
  transcript: string;
  detectedLanguageCode: LangCode | null;
  latencyMs: number;
  mock: boolean;
}

export type UnderstandMode = "command" | "order";

export interface UnderstandRequest {
  transcript: string;
  language: LangCode;
  mode: UnderstandMode;
  context: ShopContext;
}
export type UnderstandResponse = Action;

export interface ComposeRequest {
  kind: ComposeKind;
  targetLanguage: LangCode;
  /** Free-form facts for the message (names, amounts in rupees, items, totals, shop name). */
  data: Record<string, unknown>;
}
export type ComposeResponse = ComposeResult;

/** POST /api/tts → audio/mpeg. Header `x-cache: hit|miss`. */
export interface TtsRequest {
  text: string;
  language: LangCode | "hi-en";
  voice?: string;
  speed?: number;
}

/** POST /api/clone — multipart: audio (5–30 s). */
export interface CloneResponse {
  embedding: CloneEmbedding;
}

/** POST /api/tts-clone → audio/mpeg. Header `x-voice-fallback: 1` when the assistant voice was used instead. */
export interface TtsCloneRequest {
  text: string;
  language: LangCode;
  embedding: CloneEmbedding;
  fallbackVoice?: string;
}
