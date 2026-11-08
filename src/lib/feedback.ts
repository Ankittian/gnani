/** Tiny sound + haptic cues. Synthesised with WebAudio so there are no asset files. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, gain = 0.08) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

export function playTing(enabled = true) {
  if (!enabled) return;
  tone(1318, 0, 0.25);
  tone(1760, 0.08, 0.35);
}

export function playStart(enabled = true) {
  if (!enabled) return;
  tone(660, 0, 0.12, 0.05);
}

export function vibrate(ms = 30, enabled = true) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

export async function celebrate() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 }, colors: ["#f59e0b", "#16a34a", "#fbbf24", "#4338ca"] });
}
