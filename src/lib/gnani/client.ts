import "server-only";
import { isLangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";
import { GnaniError, errorFromResponse } from "./errors";
import { createQueue } from "./queue";
import type { SttParams, SttResult, TtsCloneParams, TtsParams } from "./types";

/**
 * Thin Gnani REST client. Only place that knows Gnani's snake_case wire format.
 * Facts verified live on 2026-11-08 (see PROGRESS.md "API facts learned in Phase 0").
 */

const queue = createQueue({ concurrency: Number(process.env.GNANI_CONCURRENCY ?? 2) || 2 });

const MP3_AUDIO_CONFIG = {
  sample_rate: 22050,
  num_channels: 1,
  sample_width: 2,
  encoding: "linear_pcm",
  container: "mp3",
} as const;

const ACCEPTED_EXT = new Set(["wav", "mp3", "ogg", "flac", "aac", "m4a"]);
const EXT_ALIASES: Record<string, string> = { opus: "ogg", oga: "ogg", mpeg: "mp3", mpga: "mp3", mp4: "m4a" };
const REJECTED_EXT = new Set(["webm", "weba"]);

function config() {
  const key = (process.env.GNANI_API_KEY ?? "").trim();
  if (!key) throw new GnaniError("NOT_CONFIGURED", "GNANI_API_KEY is not set", 500);
  const base = (process.env.GNANI_BASE_URL || "https://api.vachana.ai").replace(/\/+$/, "");
  return { key, base };
}

/** Gnani detects the audio format from the filename extension. */
export function normalizeFilename(filename: string): string {
  const m = /^(.*?)(?:\.([A-Za-z0-9]+))?$/.exec(filename.trim() || "speech");
  const stem = m?.[1] || "speech";
  const ext = (m?.[2] ?? "").toLowerCase();
  if (REJECTED_EXT.has(ext)) {
    throw new GnaniError("UNSUPPORTED_FORMAT", "WebM audio is not supported. Send wav, ogg, mp3, m4a, aac or flac.", 400);
  }
  if (!ext) return `${stem}.wav`;
  const mapped = EXT_ALIASES[ext] ?? ext;
  if (!ACCEPTED_EXT.has(mapped)) {
    throw new GnaniError("UNSUPPORTED_FORMAT", `Unsupported audio format: .${ext}`, 400);
  }
  return `${stem}.${mapped}`;
}

export async function stt(p: SttParams): Promise<SttResult> {
  const filename = normalizeFilename(p.filename);
  return queue.run(async () => {
    const { key, base } = config();
    const fd = new FormData();
    fd.append("audio_file", p.audio, filename);
    fd.append("model", "prisma-v3.0");
    fd.append("language_code", p.languageHints);
    fd.append("format", p.format ?? "transcribe");
    if (p.keyterms && p.keyterms.length > 0) fd.append("keyterms", JSON.stringify(p.keyterms.slice(0, 200)));
    if (p.previousText) fd.append("previous_text", p.previousText.slice(-600));

    const res = await fetch(`${base}/stt/v3`, { method: "POST", headers: { "X-API-Key-ID": key }, body: fd });
    if (!res.ok) throw await errorFromResponse(res, "stt");
    const j = (await res.json()) as Record<string, unknown>;
    const lang = j.detected_language_code;
    return {
      transcript: typeof j.transcript === "string" ? j.transcript : "",
      detectedLanguageCode: isLangCode(lang) ? lang : null,
      processingTime: typeof j.processing_time === "number" ? j.processing_time : null,
    };
  });
}

async function postTts(body: Record<string, unknown>, op: "tts" | "clone"): Promise<ArrayBuffer> {
  const { key, base } = config();
  const res = await fetch(`${base}/api/v1/tts/inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await errorFromResponse(res, op);
  return res.arrayBuffer();
}

export function tts(p: TtsParams): Promise<ArrayBuffer> {
  const speed = Math.min(1.15, Math.max(0.85, p.speed ?? 1));
  return queue.run(() =>
    postTts(
      { text: p.text, model: "timbre-v3.0", voice: p.voice, language: p.language, speed, audio_config: MP3_AUDIO_CONFIG },
      "tts",
    ),
  );
}

export async function cloneEmbedding(audio: Blob, filename: string): Promise<CloneEmbedding> {
  const name = normalizeFilename(filename);
  return queue.run(async () => {
    const { key, base } = config();
    const fd = new FormData();
    fd.append("audio_file", audio, name);
    const res = await fetch(`${base}/api/v1/tts/voice-clone/embeddings`, {
      method: "POST",
      headers: { "X-API-Key-ID": key },
      body: fd,
    });
    if (!res.ok) throw await errorFromResponse(res, "clone");
    const j = (await res.json()) as { data?: { voice_clone_embedding?: Partial<CloneEmbedding> } };
    const e = j.data?.voice_clone_embedding;
    if (!e || typeof e.embedding !== "string" || !Array.isArray(e.shape) || typeof e.dtype !== "string") {
      throw new GnaniError("CLONE_FAILED", "Voice clone response did not contain an embedding", 502);
    }
    return { embedding: e.embedding, shape: e.shape, dtype: e.dtype };
  });
}

export function ttsClone(p: TtsCloneParams): Promise<ArrayBuffer> {
  return queue.run(() =>
    postTts(
      {
        text: p.text,
        model: "vachana-vc-v1",
        language: p.language,
        speaker_embedding: p.embedding,
        audio_config: MP3_AUDIO_CONFIG,
      },
      "clone",
    ),
  );
}
