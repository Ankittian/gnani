import type { HealthResponse } from "@/lib/api/contracts";
import { isMock } from "@/lib/server/mock";

export const dynamic = "force-dynamic";

export async function GET() {
  const body: HealthResponse = {
    gnani: Boolean(process.env.GNANI_API_KEY?.trim()),
    gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
    mock: isMock(),
  };
  return Response.json(body);
}
