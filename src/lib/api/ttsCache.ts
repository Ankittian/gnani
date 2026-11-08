/** Cache Storage-backed audio cache (survives reloads; per device). All failures are non-fatal. */
const CACHE_NAME = "dd-tts-v1";

export async function ttsCacheKey(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("␟"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `/__tts/${hex}`;
}

async function open(): Promise<Cache | null> {
  try {
    return typeof caches !== "undefined" ? await caches.open(CACHE_NAME) : null;
  } catch {
    return null;
  }
}

export async function cachedAudio(key: string): Promise<Blob | null> {
  const c = await open();
  if (!c) return null;
  try {
    const res = await c.match(key);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

export async function storeAudio(key: string, blob: Blob): Promise<void> {
  const c = await open();
  if (!c) return;
  try {
    await c.put(key, new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg" } }));
  } catch {
    /* quota or private mode — ignore */
  }
}
