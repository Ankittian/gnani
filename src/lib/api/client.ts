/** Typed browser client for the internal API. Never holds API keys. */
import type {
  ApiErrorBody,
  ApiErrorCode,
  CloneResponse,
  ComposeRequest,
  ComposeResponse,
  HealthResponse,
  SttResponse,
  TtsCloneRequest,
  TtsRequest,
  UnderstandRequest,
  UnderstandResponse,
} from "@/lib/api/contracts";
import { cachedAudio, storeAudio, ttsCacheKey } from "@/lib/api/ttsCache";
import type { CloneEmbedding } from "@/lib/types";

export class ApiError extends Error {
  constructor(public code: ApiErrorCode | "NETWORK", message: string, public status: number) {
    super(message);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body?.error?.code) return new ApiError(body.error.code, body.error.message ?? "Request failed", res.status);
  } catch {
    /* non-JSON error */
  }
  return new ApiError("BAD_REQUEST", `Request failed (${res.status})`, res.status);
}

async function request(input: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new ApiError("NETWORK", "Network unavailable", 0);
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

const postJson = (url: string, body: unknown) =>
  request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function health(): Promise<HealthResponse> {
  return (await request("/api/health", { method: "GET" })).json();
}

export interface SttInput {
  audio: Blob;
  filename: string;
  languageHints: string;
  keyterms?: string[];
  previousText?: string;
  format?: "verbatim" | "transcribe" | "codemix";
}

export async function stt(input: SttInput): Promise<SttResponse> {
  const fd = new FormData();
  fd.append("audio", input.audio, input.filename);
  fd.append("languageHints", input.languageHints);
  if (input.keyterms?.length) fd.append("keyterms", JSON.stringify(input.keyterms));
  if (input.previousText) fd.append("previousText", input.previousText);
  if (input.format) fd.append("format", input.format);
  return (await request("/api/stt", { method: "POST", body: fd })).json();
}

export async function understand(req: UnderstandRequest): Promise<UnderstandResponse> {
  return (await postJson("/api/understand", req)).json();
}

export async function compose(req: ComposeRequest): Promise<ComposeResponse> {
  return (await postJson("/api/compose", req)).json();
}

/** TTS with a persistent client cache: identical (voice, lang, speed, text) never hits the API twice. */
export async function tts(req: TtsRequest): Promise<Blob> {
  const key = await ttsCacheKey(["timbre", req.voice ?? "", req.language, String(req.speed ?? 1), req.text]);
  const hit = await cachedAudio(key);
  if (hit) return hit;
  const blob = await (await postJson("/api/tts", req)).blob();
  await storeAudio(key, blob);
  return blob;
}

export async function clone(audio: Blob, filename = "voice.wav"): Promise<CloneEmbedding> {
  const fd = new FormData();
  fd.append("audio", audio, filename);
  const body: CloneResponse = await (await request("/api/clone", { method: "POST", body: fd })).json();
  return body.embedding;
}

export async function ttsClone(req: TtsCloneRequest): Promise<{ blob: Blob; usedFallback: boolean }> {
  const key = await ttsCacheKey(["clone", req.embedding.embedding.slice(0, 64), req.language, req.text]);
  const hit = await cachedAudio(key);
  if (hit) return { blob: hit, usedFallback: false };
  const res = await postJson("/api/tts-clone", req);
  const usedFallback = res.headers.get("x-voice-fallback") === "1";
  const blob = await res.blob();
  if (!usedFallback) await storeAudio(key, blob);
  return { blob, usedFallback };
}

/** Friendly message for an error code (shown in UI; never raw axios/fetch strings). */
export function friendlyError(e: unknown): { code: string; message: string } {
  if (e instanceof ApiError) {
    const map: Partial<Record<ApiError["code"], string>> = {
      NETWORK: "Internet nahi hai — connection check karein.",
      OUT_OF_CREDITS: "Demo credits khatam ho gaye. Thodi der baad try karein.",
      RATE_LIMITED: "Bahut saari requests — 2 second ruk kar dobara bolein.",
      CAP_EXCEEDED: "Aaj ki demo limit poori ho gayi. Kal phir try karein!",
      AUDIO_TOO_LONG: "Recording bahut lambi hai — 25 second se kam bolein.",
      UNSUPPORTED_FORMAT: "Yeh audio format support nahi hai.",
      NOT_CONFIGURED: "Server keys set nahi hain.",
    };
    return { code: e.code, message: map[e.code] ?? e.message };
  }
  return { code: "UNKNOWN", message: "Kuch gadbad hui. Dobara koshish karein." };
}
