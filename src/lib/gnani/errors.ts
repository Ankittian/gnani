import "server-only";
import type { ApiErrorCode } from "@/lib/api/contracts";
import type { GnaniOperation } from "./types";

/** Error carrying an internal API code; used by Gnani client, Gemini client and routes. */
export class GnaniError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "GnaniError";
    this.code = code;
    this.status = status;
  }
}

/** Alias for non-Gnani callers (Gemini, routes). */
export { GnaniError as ApiError };

const FAILED: Record<GnaniOperation, ApiErrorCode> = {
  stt: "STT_FAILED",
  tts: "TTS_FAILED",
  clone: "CLONE_FAILED",
};

interface ParsedBody {
  type?: string;
  message?: string;
}

/** Gnani uses two shapes: STT `{success:false,error:{type,message}}`, TTS `{success:false,message,status_code}`. */
function parseBody(text: string): ParsedBody {
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const err = j.error;
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      return {
        type: typeof e.type === "string" ? e.type : undefined,
        message: typeof e.message === "string" ? e.message : undefined,
      };
    }
    return {
      type: typeof j.error_code === "string" ? j.error_code : undefined,
      message: typeof j.message === "string" ? j.message : typeof j.detail === "string" ? j.detail : undefined,
    };
  } catch {
    return { message: text.slice(0, 200) || undefined };
  }
}

export function codeForStatus(status: number, op: GnaniOperation, type?: string): ApiErrorCode {
  if (type === "UNSUPPORTED_AUDIO_FORMAT") return "UNSUPPORTED_FORMAT";
  if (status === 400) return "BAD_REQUEST";
  if (status === 401 || status === 403) return "NOT_CONFIGURED";
  if (status === 402) return "OUT_OF_CREDITS";
  if (status === 429) return "RATE_LIMITED";
  return FAILED[op];
}

export async function errorFromResponse(res: Response, op: GnaniOperation): Promise<GnaniError> {
  const text = await res.text().catch(() => "");
  const body = parseBody(text);
  const code = codeForStatus(res.status, op, body.type);
  return new GnaniError(code, body.message ?? `Gnani ${op} failed (${res.status})`, res.status);
}
