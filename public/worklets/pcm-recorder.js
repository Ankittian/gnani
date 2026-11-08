// AudioWorklet: forwards mono Float32 frames + RMS level to the main thread.
class PcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = [];
    this.len = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch = input[0];
      this.buf.push(new Float32Array(ch));
      this.len += ch.length;
      // ~2048 samples per post keeps message traffic low (≈ 43 ms @ 48 kHz)
      if (this.len >= 2048) {
        const out = new Float32Array(this.len);
        let o = 0;
        let sum = 0;
        for (const b of this.buf) {
          out.set(b, o);
          o += b.length;
          for (let i = 0; i < b.length; i++) sum += b[i] * b[i];
        }
        this.port.postMessage({ samples: out, rms: Math.sqrt(sum / this.len) }, [out.buffer]);
        this.buf = [];
        this.len = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-recorder", PcmRecorder);
