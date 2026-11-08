import "server-only";
import type { LangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";

export type GnaniOperation = "stt" | "tts" | "clone";
export type SttFormat = "verbatim" | "transcribe" | "codemix";

export interface SttParams {
  audio: Blob;
  filename: string;
  /** "indic-auto" or comma-separated LangCodes (≤4). */
  languageHints: string;
  keyterms?: string[];
  previousText?: string;
  format?: SttFormat;
}

export interface SttResult {
  transcript: string;
  detectedLanguageCode: LangCode | null;
  processingTime: number | null;
}

export interface TtsParams {
  text: string;
  language: LangCode | "hi-en";
  voice: string;
  speed?: number;
}

export interface TtsCloneParams {
  text: string;
  language: LangCode;
  embedding: CloneEmbedding;
}
