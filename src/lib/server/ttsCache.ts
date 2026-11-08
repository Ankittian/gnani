import "server-only";
import { createHash } from "node:crypto";

/** Small in-memory LRU for synthesized audio (confirmations and hints repeat a lot). */
const MAX = 200;
const store = new Map<string, { bytes: ArrayBuffer; contentType: string }>();

export const cacheKey = (...parts: (string | number)[]): string =>
  createHash("sha256").update(parts.join("|")).digest("hex");

export function cacheGet(key: string) {
  const hit = store.get(key);
  if (!hit) return undefined;
  store.delete(key);
  store.set(key, hit);
  return hit;
}

export function cacheSet(key: string, bytes: ArrayBuffer, contentType: string): void {
  store.delete(key);
  store.set(key, { bytes, contentType });
  while (store.size > MAX) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function cacheClear(): void {
  store.clear();
}
