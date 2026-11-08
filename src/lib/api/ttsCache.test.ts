import { describe, expect, it } from "vitest";
import { cachedAudio, storeAudio, ttsCacheKey } from "./ttsCache";

describe("ttsCache", () => {
  it("produces stable, distinct keys", async () => {
    const a = await ttsCacheKey(["timbre", "Lakshmi", "hi-IN", "1", "नमस्ते"]);
    const b = await ttsCacheKey(["timbre", "Lakshmi", "hi-IN", "1", "नमस्ते"]);
    const c = await ttsCacheKey(["timbre", "Lakshmi", "kn-IN", "1", "नमस्ते"]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^\/__tts\/[0-9a-f]{64}$/);
  });

  it("degrades gracefully when Cache Storage is unavailable (jsdom)", async () => {
    await expect(storeAudio("/__tts/x", new Blob(["a"]))).resolves.toBeUndefined();
    await expect(cachedAudio("/__tts/x")).resolves.toBeNull();
  });
});
