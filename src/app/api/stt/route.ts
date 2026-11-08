import { z } from "zod";
import type { SttResponse } from "@/lib/api/contracts";
import { normalizeFilename, stt } from "@/lib/gnani/client";
import { LANG_CODES } from "@/lib/i18n/languages";
import { extOf, wavDurationSec } from "@/lib/server/audio";
import { checkCap } from "@/lib/server/caps";
import { clientIp, envInt, errorResponse, jsonError } from "@/lib/server/http";
import { isMock, mockStt } from "@/lib/server/mock";

const MAX_WAV_SEC = 30.5;
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;

const KeytermsZ = z.array(z.string().min(1).max(100)).max(400);
const FormatZ = z.enum(["verbatim", "transcribe", "codemix"]);

function parseLanguageHints(raw: FormDataEntryValue | null): string | null {
  const v = typeof raw === "string" && raw.trim() ? raw.trim() : "indic-auto";
  if (v === "indic-auto") return v;
  const codes = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (codes.length === 0 || codes.length > 4) return null;
  if (!codes.every((c) => (LANG_CODES as readonly string[]).includes(c))) return null;
  return [...new Set(codes)].join(",");
}

export async function POST(req: Request) {
  const started = Date.now();
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return jsonError("BAD_REQUEST", "Expected multipart/form-data", 400);
  }

  const audio = fd.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return jsonError("BAD_REQUEST", "Missing audio file", 400);
  const rawName = audio instanceof File && audio.name ? audio.name : "speech.wav";

  let filename: string;
  try {
    filename = normalizeFilename(rawName);
  } catch (e) {
    return errorResponse(e, "UNSUPPORTED_FORMAT");
  }

  const languageHints = parseLanguageHints(fd.get("languageHints"));
  if (!languageHints) return jsonError("BAD_REQUEST", "languageHints must be indic-auto or 1-4 supported language codes", 400);

  let keyterms: string[] | undefined;
  const rawTerms = fd.get("keyterms");
  if (typeof rawTerms === "string" && rawTerms.trim()) {
    try {
      keyterms = KeytermsZ.parse(JSON.parse(rawTerms));
    } catch {
      return jsonError("BAD_REQUEST", "keyterms must be a JSON array of strings", 400);
    }
  }
  const rawFormat = fd.get("format");
  const format = typeof rawFormat === "string" && rawFormat ? FormatZ.safeParse(rawFormat) : null;
  if (format && !format.success) return jsonError("BAD_REQUEST", "Invalid format", 400);
  const previousText = typeof fd.get("previousText") === "string" ? (fd.get("previousText") as string) : undefined;

  // Length guard (Gnani REST accepts ≤ 30 s).
  if (extOf(filename) === "wav") {
    const dur = wavDurationSec(new Uint8Array(await audio.arrayBuffer()));
    if (dur == null) return jsonError("UNSUPPORTED_FORMAT", "Invalid WAV file", 415);
    if (dur > MAX_WAV_SEC) return jsonError("AUDIO_TOO_LONG", "Audio longer than 30 seconds — split it into chunks", 413);
  } else if (audio.size > MAX_COMPRESSED_BYTES) {
    return jsonError("AUDIO_TOO_LONG", "Audio file too large for one request — split it into chunks", 413);
  }

  if (isMock()) {
    const m = mockStt();
    const body: SttResponse = { transcript: m.transcript, detectedLanguageCode: m.detectedLanguageCode, latencyMs: Date.now() - started, mock: true };
    return Response.json(body);
  }

  if (!checkCap(clientIp(req), "stt", envInt("DAILY_STT_CAP_PER_IP", 80))) {
    return jsonError("CAP_EXCEEDED", "Daily voice limit reached for this demo", 429);
  }

  try {
    const r = await stt({ audio, filename, languageHints, keyterms, previousText, format: format?.success ? format.data : undefined });
    const body: SttResponse = { transcript: r.transcript, detectedLanguageCode: r.detectedLanguageCode, latencyMs: Date.now() - started, mock: false };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e, "STT_FAILED");
  }
}
