"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2, Mic, Square } from "@/components/common/icons";
import { toast } from "sonner";
import { press } from "@/components/common/motion";
import { DostOrb } from "@/components/orb/DostOrb";
import { useRecorder } from "@/hooks/useRecorder";
import * as api from "@/lib/api/client";
import { encodeWav } from "@/lib/audio/wav";
import { errorKey } from "@/lib/i18n/errors";
import { LANGUAGES, type LangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";

/** Record 8–25 s of the shopkeeper reading a line → Gnani voice-clone embedding. */
export function CloneRecorder({ language, onDone }: { language: LangCode; onDone: (e: CloneEmbedding) => void }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const rec = useRecorder({ maxSec: 25, onAutoStop: (r) => void upload(r.samples, r.sampleRate, r.durationSec) });

  const upload = async (samples: Float32Array, rate: number, dur: number) => {
    if (dur < 6) {
      toast.error(t("errCloneShort"));
      return;
    }
    setBusy(true);
    try {
      const e = await api.clone(new Blob([encodeWav(samples, rate)], { type: "audio/wav" }), "voice.wav");
      toast.success(t("cloneSaved"));
      onDone(e);
    } catch (e) {
      toast.error(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const recording = rec.status === "recording";

  return (
    <div className="flex flex-col items-center text-center">
      <p className="mb-3 rounded-2xl bg-card px-4 py-3 text-lg font-semibold leading-relaxed shadow-card" lang={language.split("-")[0]}>
        {LANGUAGES[language].clonePrompt}
      </p>
      <DostOrb state={busy ? "thinking" : recording ? "listening" : "idle"} level={rec.level} size={96} />
      {recording && <p className="tabular mt-1 font-semibold text-muted">{Math.floor(rec.elapsed)}s</p>}
      <motion.button
        type="button"
        {...press}
        disabled={busy}
        onClick={async () => {
          if (recording) {
            const r = await rec.stop();
            if (r) await upload(r.samples, r.sampleRate, r.durationSec);
          } else void rec.start();
        }}
        className={`mt-3 flex min-h-14 items-center gap-2 rounded-full px-8 text-lg font-semibold shadow-card ${recording ? "bg-chili text-white" : "bg-brand text-brand-ink"}`}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : recording ? <Square className="h-5 w-5 fill-current" /> : <Mic className="h-5 w-5" />}
        {busy ? t("creating") : recording ? t("done") : t("recordBtn")}
      </motion.button>
      {rec.status === "error" && <p className="mt-2 text-sm font-semibold text-chili">{t("errMic")}</p>}
    </div>
  );
}
