/** WAV helpers: browser mic PCM → 16-bit mono WAV that Gnani Prisma accepts. */

export function floatTo16BitPCM(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

function writeStr(dv: DataView, off: number, s: string): void {
  for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
}

export function encodeWav(samples: Float32Array | Int16Array, sampleRate: number): ArrayBuffer {
  const pcm = samples instanceof Int16Array ? samples : floatTo16BitPCM(samples);
  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(buf);
  writeStr(dv, 0, "RIFF");
  dv.setUint32(4, 36 + dataBytes, true);
  writeStr(dv, 8, "WAVE");
  writeStr(dv, 12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(dv, 36, "data");
  dv.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + i * 2, pcm[i], true);
  return buf;
}

/**
 * Duration from actual PCM byte length after the 'data' tag.
 * Gnani TTS WAVs carry a streaming header with data size 0xFFFFFFFF, so header sizes can't be trusted.
 */
export function wavDurationSec(buf: ArrayBuffer): number {
  if (buf.byteLength < 44) return 0;
  const dv = new DataView(buf);
  if (dv.getUint32(0, false) !== 0x52494646 /* RIFF */) return 0;
  const channels = dv.getUint16(22, true) || 1;
  const sampleRate = dv.getUint32(24, true);
  const bitsPerSample = dv.getUint16(34, true) || 16;
  if (!sampleRate) return 0;
  // scan for 'data' chunk tag
  for (let off = 12; off + 8 <= buf.byteLength; off++) {
    if (dv.getUint32(off, false) === 0x64617461 /* data */) {
      const bytes = buf.byteLength - (off + 8);
      return bytes / (sampleRate * channels * (bitsPerSample / 8));
    }
  }
  return 0;
}
