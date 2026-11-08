import "server-only";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api/contracts";
import { GnaniError } from "@/lib/gnani/errors";

export function jsonError(code: ApiErrorCode, message: string, status: number): Response {
  const body: ApiErrorBody = { error: { code, message, status } };
  return Response.json(body, { status });
}

const STATUS_FOR: Partial<Record<ApiErrorCode, number>> = {
  BAD_REQUEST: 400,
  UNSUPPORTED_FORMAT: 415,
  AUDIO_TOO_LONG: 413,
  OUT_OF_CREDITS: 402,
  RATE_LIMITED: 429,
  CAP_EXCEEDED: 429,
  NOT_CONFIGURED: 500,
};

/** Convert any thrown value into a JSON error Response (never leaks stack traces). */
export function errorResponse(e: unknown, fallback: ApiErrorCode): Response {
  if (e instanceof GnaniError) {
    return jsonError(e.code, e.message, STATUS_FOR[e.code] ?? 502);
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  return jsonError(fallback, message.slice(0, 300), 502);
}

/** Best-effort client IP for per-IP caps (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export function audioResponse(bytes: ArrayBuffer, contentType: string, extra: Record<string, string> = {}): Response {
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "private, max-age=86400", ...extra },
  });
}

export function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
