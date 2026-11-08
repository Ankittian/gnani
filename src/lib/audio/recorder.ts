/**
 * Browser mic capture → 16 kHz mono Float32 samples.
 * Uses an AudioWorklet (ScriptProcessor fallback) at the device's native rate, then resamples,
 * because Prisma REST rejects MediaRecorder's WebM and Firefox can't mix sample rates.
 */
import { resampleLinear } from "@/lib/audio/resample";

export const TARGET_RATE = 16000;

export type MicErrorKind = "denied" | "no-device" | "unsupported" | "unknown";

export class MicError extends Error {
  constructor(public kind: MicErrorKind, message: string) {
    super(message);
  }
}

export interface RecorderHandle {
  stop(): Promise<Float32Array>;
  cancel(): void;
}

export interface StartOptions {
  onLevel?: (rms: number) => void;
}

export async function startRecording({ onLevel }: StartOptions = {}): Promise<RecorderHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new MicError("unsupported", "Microphone not available in this browser");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") throw new MicError("denied", "Mic permission denied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new MicError("no-device", "No microphone found");
    throw new MicError("unknown", String(e));
  }

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const chunks: Float32Array[] = [];
  let total = 0;
  const push = (s: Float32Array, rms: number) => {
    chunks.push(s);
    total += s.length;
    onLevel?.(Math.min(1, rms * 6));
  };

  let node: AudioNode;
  let workletNode: AudioWorkletNode | null = null;
  let scriptNode: ScriptProcessorNode | null = null;

  if (ctx.audioWorklet) {
    await ctx.audioWorklet.addModule("/worklets/pcm-recorder.js");
    workletNode = new AudioWorkletNode(ctx, "pcm-recorder");
    workletNode.port.onmessage = (ev: MessageEvent<{ samples: Float32Array; rms: number }>) => push(ev.data.samples, ev.data.rms);
    node = workletNode;
  } else {
    scriptNode = ctx.createScriptProcessor(4096, 1, 1);
    scriptNode.onaudioprocess = (ev) => {
      const d = new Float32Array(ev.inputBuffer.getChannelData(0));
      let sum = 0;
      for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      push(d, Math.sqrt(sum / d.length));
    };
    node = scriptNode;
  }

  // Route through a muted gain so the graph pulls audio without echoing it to the speakers.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);

  const teardown = () => {
    try {
      source.disconnect();
      node.disconnect();
      mute.disconnect();
    } catch {
      /* already disconnected */
    }
    if (workletNode) workletNode.port.onmessage = null;
    if (scriptNode) scriptNode.onaudioprocess = null;
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    async stop() {
      // Let the worklet flush its last partial buffer.
      await new Promise((r) => setTimeout(r, 60));
      const rate = ctx.sampleRate;
      teardown();
      const all = new Float32Array(total);
      let o = 0;
      for (const c of chunks) {
        all.set(c, o);
        o += c.length;
      }
      return rate === TARGET_RATE ? all : resampleLinear(all, rate, TARGET_RATE);
    },
    cancel: teardown,
  };
}

/** Decode any browser-playable audio file (WhatsApp .opus/.ogg, .m4a, .mp3, .wav) to 16 kHz mono. */
export async function decodeToMono16k(file: Blob): Promise<Float32Array> {
  const buf = await file.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const chans: Float32Array[] = [];
    for (let i = 0; i < audio.numberOfChannels; i++) chans.push(audio.getChannelData(i));
    const mono = new Float32Array(audio.length);
    for (const c of chans) for (let i = 0; i < c.length; i++) mono[i] += c[i] / chans.length;
    return audio.sampleRate === TARGET_RATE ? mono : resampleLinear(mono, audio.sampleRate, TARGET_RATE);
  } finally {
    void ctx.close();
  }
}
