import "server-only";

export type CapKind = "stt" | "tts" | "llm" | "clone";

/**
 * In-memory per-IP daily caps. Resets per server instance (acceptable for a demo: the goal is
 * to stop one visitor from burning the shared 5,000 Gnani credits, not perfect accounting).
 */
const counts = new Map<string, number>();
let currentDay = "";

const today = () => new Date().toISOString().slice(0, 10);

/** Increments the counter and returns true while the caller is within `limit` for today. */
export function checkCap(ip: string, kind: CapKind, limit: number): boolean {
  const day = today();
  if (day !== currentDay) {
    counts.clear();
    currentDay = day;
  }
  const key = `${day}|${ip}|${kind}`;
  const next = (counts.get(key) ?? 0) + 1;
  counts.set(key, next);
  return next <= limit;
}

/** Test helper. */
export function resetCaps(): void {
  counts.clear();
  currentDay = "";
}
