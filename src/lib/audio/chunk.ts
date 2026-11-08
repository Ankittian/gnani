/** Split long audio into ≤ maxSec chunks, cutting at the quietest 50 ms near each limit. */

export function rms(samples: Float32Array, start: number, end: number): number {
  const s = Math.max(0, start);
  const e = Math.min(samples.length, end);
  if (e <= s) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (e - s));
}

export function chunkOnSilence(
  samples: Float32Array,
  sampleRate: number,
  maxSec = 25,
  searchWindowSec = 3,
): Float32Array[] {
  const maxLen = Math.floor(maxSec * sampleRate);
  if (samples.length <= maxLen) return [samples];
  const win = Math.max(1, Math.floor(0.05 * sampleRate));
  const hop = Math.max(1, Math.floor(win / 2));
  const search = Math.floor(searchWindowSec * sampleRate);
  const chunks: Float32Array[] = [];
  let start = 0;
  while (samples.length - start > maxLen) {
    const limit = start + maxLen;
    let bestCut = limit;
    let bestRms = Infinity;
    for (let w = limit - win; w >= limit - search && w > start; w -= hop) {
      const r = rms(samples, w, w + win);
      if (r < bestRms) {
        bestRms = r;
        bestCut = w + Math.floor(win / 2);
      }
    }
    chunks.push(samples.subarray(start, bestCut));
    start = bestCut;
  }
  chunks.push(samples.subarray(start));
  return chunks;
}
