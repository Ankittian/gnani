import { z } from "zod";
import { tts } from "@/lib/gnani/client";
import { DEFAULT_VOICE, LANG_CODES, TIMBRE_V3_VOICES } from "@/lib/i18n/languages";
import { checkCap } from "@/lib/server/caps";
import { audioResponse, clientIp, envInt, errorResponse, jsonError } from "@/lib/server/http";
import { isMock, silentWav } from "@/lib/server/mock";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/ttsCache";

const VOICE_IDS = TIMBRE_V3_VOICES.map((v) => v.id) as [string, ...string[]];

const TtsRequestZ = z.object({
  text: z.string().trim().min(1).max(1500),
  language: z.enum([...LANG_CODES, "hi-en"]),
  voice: z.enum(VOICE_IDS).optional(),
  speed: z.number().min(0.85).max(1.15).optional(),
});

export async function POST(req: Request) {
  const parsed = TtsRequestZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("BAD_REQUEST", "Invalid TTS request", 400);
  const { text, language } = parsed.data;
  const voice = parsed.data.voice ?? DEFAULT_VOICE;
  const speed = parsed.data.speed ?? 1;

  if (isMock()) return audioResponse(silentWav(0.5), "audio/wav", { "x-cache": "mock" });

  const key = cacheKey("tts", voice, language, speed, text);
  const hit = cacheGet(key);
  if (hit) return audioResponse(hit.bytes, hit.contentType, { "x-cache": "hit" });

  if (!checkCap(clientIp(req), "tts", envInt("DAILY_TTS_CAP_PER_IP", 120))) {
    return jsonError("CAP_EXCEEDED", "Daily voice limit reached for this demo", 429);
  }
  try {
    const bytes = await tts({ text, language, voice, speed });
    cacheSet(key, bytes, "audio/mpeg");
    return audioResponse(bytes, "audio/mpeg", { "x-cache": "miss" });
  } catch (e) {
    return errorResponse(e, "TTS_FAILED");
  }
}
