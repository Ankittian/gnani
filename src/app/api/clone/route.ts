import type { CloneResponse } from "@/lib/api/contracts";
import { cloneEmbedding, normalizeFilename } from "@/lib/gnani/client";
import { extOf, wavDurationSec } from "@/lib/server/audio";
import { checkCap } from "@/lib/server/caps";
import { clientIp, envInt, errorResponse, jsonError } from "@/lib/server/http";
import { isMock, mockEmbedding } from "@/lib/server/mock";

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req: Request) {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return jsonError("BAD_REQUEST", "Expected multipart/form-data", 400);
  }
  const audio = fd.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return jsonError("BAD_REQUEST", "Missing audio file", 400);
  if (audio.size > MAX_BYTES) return jsonError("AUDIO_TOO_LONG", "Voice sample too large (max 3 MB)", 413);

  let filename: string;
  try {
    filename = normalizeFilename(audio instanceof File && audio.name ? audio.name : "voice.wav");
  } catch (e) {
    return errorResponse(e, "UNSUPPORTED_FORMAT");
  }
  if (extOf(filename) === "wav") {
    const dur = wavDurationSec(new Uint8Array(await audio.arrayBuffer()));
    if (dur == null) return jsonError("UNSUPPORTED_FORMAT", "Invalid WAV file", 415);
    if (dur < 5) return jsonError("BAD_REQUEST", "Voice sample too short — record at least 5 seconds", 400);
    if (dur > 30.5) return jsonError("AUDIO_TOO_LONG", "Voice sample too long — keep it under 30 seconds", 413);
  }

  if (isMock()) {
    const body: CloneResponse = { embedding: mockEmbedding() };
    return Response.json(body);
  }
  if (!checkCap(clientIp(req), "clone", envInt("DAILY_CLONE_CAP_PER_IP", 10))) {
    return jsonError("CAP_EXCEEDED", "Daily voice-clone limit reached for this demo", 429);
  }
  try {
    const body: CloneResponse = { embedding: await cloneEmbedding(audio, filename) };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e, "CLONE_FAILED");
  }
}
