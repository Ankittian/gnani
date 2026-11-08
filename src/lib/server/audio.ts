import "server-only";

/**
 * Duration of a PCM WAV from its header byte-rate and actual payload length.
 * Tolerates streaming headers (data size 0xFFFFFFFF) by using the bytes actually present.
 * Returns null when the bytes aren't a RIFF/WAVE file.
 */
export function wavDurationSec(bytes: Uint8Array): number | null {
  if (bytes.byteLength < 44) return null;
  const tag = (o: number) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let byteRate = 0;
  let off = 12;
  while (off + 8 <= bytes.byteLength) {
    const id = tag(off);
    const size = dv.getUint32(off + 4, true);
    if (id === "fmt ") byteRate = dv.getUint32(off + 16, true);
    if (id === "data") {
      if (!byteRate) return null;
      const available = bytes.byteLength - (off + 8);
      const dataBytes = size === 0xffffffff || size > available ? available : size;
      return dataBytes / byteRate;
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

export const extOf = (filename: string): string => /\.([A-Za-z0-9]+)$/.exec(filename)?.[1]?.toLowerCase() ?? "";
