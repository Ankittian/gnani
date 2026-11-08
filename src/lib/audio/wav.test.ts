import { describe, expect, it } from "vitest";
import { encodeWav, floatTo16BitPCM, wavDurationSec } from "./wav";

const str = (dv: DataView, off: number, len: number) =>
  String.fromCharCode(...Array.from({ length: len }, (_, i) => dv.getUint8(off + i)));

describe("floatTo16BitPCM", () => {
  it("scales and clamps", () => {
    const out = floatTo16BitPCM(new Float32Array([0, 1, -1, 2, -2, 0.5]));
    expect(Array.from(out)).toEqual([0, 32767, -32768, 32767, -32768, 16384]);
  });
});

describe("encodeWav", () => {
  it("writes a correct 16 kHz mono header", () => {
    const samples = new Float32Array(16000); // 1 s
    const buf = encodeWav(samples, 16000);
    const dv = new DataView(buf);
    expect(buf.byteLength).toBe(44 + 32000);
    expect(str(dv, 0, 4)).toBe("RIFF");
    expect(dv.getUint32(4, true)).toBe(36 + 32000);
    expect(str(dv, 8, 4)).toBe("WAVE");
    expect(str(dv, 12, 4)).toBe("fmt ");
    expect(dv.getUint16(20, true)).toBe(1); // PCM
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(16000);
    expect(dv.getUint32(28, true)).toBe(32000); // byte rate
    expect(dv.getUint16(32, true)).toBe(2);
    expect(dv.getUint16(34, true)).toBe(16);
    expect(str(dv, 36, 4)).toBe("data");
    expect(dv.getUint32(40, true)).toBe(32000);
  });

  it("accepts Int16Array input", () => {
    const buf = encodeWav(new Int16Array([1, -1, 300]), 8000);
    const dv = new DataView(buf);
    expect(dv.getInt16(44, true)).toBe(1);
    expect(dv.getInt16(48, true)).toBe(300);
  });
});

describe("wavDurationSec", () => {
  it("computes duration from encoded wav", () => {
    expect(wavDurationSec(encodeWav(new Float32Array(24000), 16000))).toBeCloseTo(1.5);
  });

  it("ignores a bogus streaming header size (0xFFFFFFFF)", () => {
    const buf = encodeWav(new Float32Array(8000), 16000);
    const dv = new DataView(buf);
    dv.setUint32(4, 0xffffffff, true);
    dv.setUint32(40, 0xffffffff, true);
    expect(wavDurationSec(buf)).toBeCloseTo(0.5);
  });

  it("returns 0 for non-wav", () => {
    expect(wavDurationSec(new ArrayBuffer(10))).toBe(0);
  });
});
