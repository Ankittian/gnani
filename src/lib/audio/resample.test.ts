import { describe, expect, it } from "vitest";
import { mixToMono, resampleLinear } from "./resample";

describe("resampleLinear", () => {
  it("48k → 16k gives a third of the samples", () => {
    const out = resampleLinear(new Float32Array(48000), 48000, 16000);
    expect(out.length).toBe(16000);
  });

  it("returns a copy when rates match", () => {
    const input = new Float32Array([0.1, 0.2]);
    const out = resampleLinear(input, 16000, 16000);
    expect(Array.from(out)).toEqual(Array.from(input));
    expect(out).not.toBe(input);
  });

  it("interpolates a ramp", () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const out = resampleLinear(input, 8, 4);
    expect(out.length).toBe(4);
    expect(out[1]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(6);
  });

  it("handles empty input", () => {
    expect(resampleLinear(new Float32Array(0), 44100, 16000).length).toBe(0);
  });
});

describe("mixToMono", () => {
  it("averages channels", () => {
    const out = mixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(Array.from(out)).toEqual([0.5, 0.5]);
  });
  it("passes a single channel through", () => {
    const ch = new Float32Array([0.3]);
    expect(mixToMono([ch])).toBe(ch);
  });
  it("empty → empty", () => {
    expect(mixToMono([]).length).toBe(0);
  });
});
