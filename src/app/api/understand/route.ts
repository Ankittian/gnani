import { z } from "zod";
import type { UnderstandResponse } from "@/lib/api/contracts";
import { LANG_CODES } from "@/lib/i18n/languages";
import { understand } from "@/lib/llm/gemini";
import { UNITS } from "@/lib/types";
import { checkCap } from "@/lib/server/caps";
import { clientIp, envInt, errorResponse, jsonError } from "@/lib/server/http";
import { isMock, mockUnderstand } from "@/lib/server/mock";

const UnderstandRequestZ = z.object({
  transcript: z.string().trim().min(1).max(6000),
  language: z.enum(LANG_CODES),
  mode: z.enum(["command", "order"]),
  context: z.object({
    customers: z
      .array(z.object({ id: z.string(), name: z.string(), aliases: z.array(z.string()), balance: z.number() }))
      .max(1000),
    products: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          aliases: z.array(z.string()),
          unit: z.enum(UNITS),
          pricePaise: z.number().nullable(),
        }),
      )
      .max(2000),
    suppliers: z.array(z.object({ id: z.string(), name: z.string() })).max(200),
  }),
});

export async function POST(req: Request) {
  const parsed = UnderstandRequestZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("BAD_REQUEST", "Invalid understand request", 400);

  if (isMock()) {
    const body: UnderstandResponse = mockUnderstand(parsed.data);
    return Response.json(body);
  }
  if (!checkCap(clientIp(req), "llm", envInt("DAILY_LLM_CAP_PER_IP", 300))) {
    return jsonError("CAP_EXCEEDED", "Daily limit reached for this demo", 429);
  }
  try {
    const body: UnderstandResponse = await understand(parsed.data);
    return Response.json(body);
  } catch (e) {
    return errorResponse(e, "LLM_FAILED");
  }
}
