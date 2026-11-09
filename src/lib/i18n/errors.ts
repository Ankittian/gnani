import { ApiError } from "@/lib/api/client";
import type { MessageKey } from "./messages";

/** An error whose message is a translation key — translate at the UI edge with t(errorKey(e)). */
export class KeyedError extends Error {
  constructor(public key: MessageKey) {
    super(key);
  }
}

const API_KEYS: Partial<Record<ApiError["code"], MessageKey>> = {
  NETWORK: "errNetwork",
  OUT_OF_CREDITS: "errCredits",
  RATE_LIMITED: "errRate",
  CAP_EXCEEDED: "errCap",
  AUDIO_TOO_LONG: "errAudioLong",
  UNSUPPORTED_FORMAT: "errFormat",
  NOT_CONFIGURED: "errNotConfigured",
};

/** Map any thrown value to a user-facing message key. Never exposes raw fetch/axios/server strings. */
export function errorKey(e: unknown): MessageKey {
  if (e instanceof KeyedError) return e.key;
  if (e instanceof ApiError) return API_KEYS[e.code] ?? "errUnknown";
  if (e instanceof Error && e.message === "ambiguous_customer") return "errAmbiguous";
  return "errUnknown";
}
