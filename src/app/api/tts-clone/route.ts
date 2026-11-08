import { z } from "zod";
import { tts, ttsClone } from "@/lib/gnani/client";
import { GnaniError } from "@/lib/gnani/errors";
import { DEFAULT_VOICE, LANG_CODES, TIMBRE_V3_VOICES } from "@/lib/i18n/languages";
import { checkCap } from "@/lib/server/caps";
import { audioResponse, clientIp, envInt, errorResponse, jsonError } from "@/lib/server/http";
import { isMock, silentWav } from "@/lib/server/mock";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/ttsCache";

const VOICE_IDS = TIMBRE_V3_VOICES.map((v) => v.id) as [string, ...string[]];

const TtsCloneRequestZ = z.object({
  text: z.string().trim().min(1).max(1500),
  language: z.enum(LANG_CODES),
  embedding: z.object({
    embedding: z.string().min(1).max(200_000),
    shape: z.array(z.number()),
    dtype: z.string(),
  }),
  fallbackVoice: z.enum(VOICE_IDS).optional(),
});

/** Errors where retrying with the assistant voice won't help. */
const FATAL = new Set(["OUT_OF_CREDITS", "NOT_CONFIGURED", "RATE_LIMITED"]);

export async function POST(req: Request) {
  const parsed = TtsCloneRequestZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("BAD_REQUEST", "Invalid cloned-voice TTS request", 400);
  const { text, language, embedding } = parsed.data;

  if (isMock()) return audioResponse(silentWav(0.5), "audio/wav", { "x-cache": "mock" });

  const key = cacheKey("clone", cacheKey(embedding.embedding), language, text);
  const hit = cacheGet(key);
  if (hit) return audioResponse(hit.bytes, hit.contentType, { "x-cache": "hit" });

  if (!checkCap(clientIp(req), "tts", envInt("DAILY_TTS_CAP_PER_IP", 120))) {
    return jsonError("CAP_EXCEEDED", "Daily voice limit reached for this demo", 429);
  }

  try {
    const bytes = await ttsClone({ text, language, embedding });
    cacheSet(key, bytes, "audio/mpeg");
    return audioResponse(bytes, "audio/mpeg", { "x-cache": "miss" });
  } catch (e) {
    if (e instanceof GnaniError && FATAL.has(e.code)) return errorResponse(e, "TTS_FAILED");
    try {
      const bytes = await tts({ text, language, voice: parsed.data.fallbackVoice ?? DEFAULT_VOICE });
      return audioResponse(bytes, "audio/mpeg", { "x-cache": "miss", "x-voice-fallback": "1" });
    } catch (e2) {
      return errorResponse(e2, "TTS_FAILED");
    }
  }
}
