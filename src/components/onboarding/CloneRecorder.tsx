"use client";

import { useState } from "react";
import { Loader2, Mic, Square } from "@/components/common/icons";
import { toast } from "sonner";
import { DostOrb } from "@/components/orb/DostOrb";
import { useRecorder } from "@/hooks/useRecorder";
import * as api from "@/lib/api/client";
import { encodeWav } from "@/lib/audio/wav";
import { LANGUAGES, type LangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";

/** Record 8–25 s of the shopkeeper reading a line → Gnani voice-clone embedding. */
export function CloneRecorder({ language, onDone }: { language: LangCode; onDone: (e: CloneEmbedding) => void }) {
  const [busy, setBusy] = useState(false);
  const rec = useRecorder({ maxSec: 25, onAutoStop: (r) => void upload(r.samples, r.sampleRate, r.durationSec) });

  const upload = async (samples: Float32Array, rate: number, dur: number) => {
    if (dur < 6) {
      toast.error("Thoda lamba bolein (kam se kam 6 second)");
      return;
    }
    setBusy(true);
    try {
      const e = await api.clone(new Blob([encodeWav(samples, rate)], { type: "audio/wav" }), "voice.wav");
      toast.success("Aapki awaaz save ho gayi 🎉");
      onDone(e);
    } catch (e) {
      toast.error(api.friendlyError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const recording = rec.status === "recording";

  return (
    <div className="flex flex-col items-center text-center">
      <p className="mb-3 rounded-2xl bg-card px-4 py-3 text-lg font-semibold leading-relaxed shadow-sticker" lang={language.split("-")[0]}>
        {LANGUAGES[language].clonePrompt}
      </p>
      <DostOrb state={busy ? "thinking" : recording ? "listening" : "idle"} level={rec.level} size={96} />
      {recording && <p className="tabular mt-1 font-bold text-muted">{Math.floor(rec.elapsed)}s</p>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (recording) {
            const r = await rec.stop();
            if (r) await upload(r.samples, r.sampleRate, r.durationSec);
          } else void rec.start();
        }}
        className={`mt-3 flex min-h-14 items-center gap-2 rounded-full px-8 text-lg font-extrabold shadow-sticker active:scale-95 ${recording ? "bg-chili text-white" : "bg-brand text-brand-ink"}`}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
        {busy ? "Ban rahi hai…" : recording ? "Done" : "Record karein"}
      </button>
      {rec.status === "error" && <p className="mt-2 text-sm font-semibold text-chili">Mic permission chahiye.</p>}
    </div>
  );
}
