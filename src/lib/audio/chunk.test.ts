import { describe, expect, it } from "vitest";
import { chunkOnSilence, rms } from "./chunk";

const SR = 1000; // small rate keeps tests fast

function tone(sec: number, silences: number[] = []): Float32Array {
  const s = new Float32Array(Math.round(sec * SR));
  for (let i = 0; i < s.length; i++) s[i] = 0.5 * Math.sin(i / 3);
  for (const at of silences) {
    const start = Math.round(at * SR);
    for (let i = start; i < start + 0.2 * SR && i < s.length; i++) s[i] = 0;
  }
  return s;
}

describe("rms", () => {
  it("is 0 for silence and >0 for tone", () => {
    expect(rms(new Float32Array(100), 0, 100)).toBe(0);
    expect(rms(tone(1), 0, SR)).toBeGreaterThan(0.2);
  });
  it("handles empty range", () => {
    expect(rms(new Float32Array(10), 5, 5)).toBe(0);
  });
});

describe("chunkOnSilence", () => {
  it("returns single chunk when short", () => {
    const s = tone(10);
    const chunks = chunkOnSilence(s, SR);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBe(s.length);
  });

  it("70 s → 3 chunks, each ≤ 25 s, total length preserved", () => {
    const s = tone(70);
    const chunks = chunkOnSilence(s, SR);
    expect(chunks).toHaveLength(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(25 * SR);
    expect(chunks.reduce((a, c) => a + c.length, 0)).toBe(s.length);
  });

  it("splits near a silence inside the search window", () => {
    const s = tone(40, [23]); // silence at 23.0–23.2 s
    const chunks = chunkOnSilence(s, SR);
    const firstSec = chunks[0].length / SR;
    expect(firstSec).toBeGreaterThanOrEqual(22.9);
    expect(firstSec).toBeLessThanOrEqual(23.3);
  });
});
