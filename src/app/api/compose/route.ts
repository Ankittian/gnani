import { z } from "zod";
import type { ComposeResponse } from "@/lib/api/contracts";
import { LANG_CODES } from "@/lib/i18n/languages";
import { compose } from "@/lib/llm/gemini";
import { COMPOSE_KINDS } from "@/lib/llm/schema";
import { checkCap } from "@/lib/server/caps";
import { clientIp, envInt, errorResponse, jsonError } from "@/lib/server/http";
import { isMock, mockCompose } from "@/lib/server/mock";

const ComposeRequestZ = z.object({
  kind: z.enum(COMPOSE_KINDS),
  targetLanguage: z.enum(LANG_CODES),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  const parsed = ComposeRequestZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("BAD_REQUEST", "Invalid compose request", 400);
  if (JSON.stringify(parsed.data.data).length > 8000) return jsonError("BAD_REQUEST", "Compose data too large", 400);

  if (isMock()) {
    const body: ComposeResponse = mockCompose(parsed.data);
    return Response.json(body);
  }
  if (!checkCap(clientIp(req), "llm", envInt("DAILY_LLM_CAP_PER_IP", 300))) {
    return jsonError("CAP_EXCEEDED", "Daily limit reached for this demo", 429);
  }
  try {
    const body: ComposeResponse = await compose(parsed.data);
    return Response.json(body);
  } catch (e) {
    return errorResponse(e, "LLM_FAILED");
  }
}
