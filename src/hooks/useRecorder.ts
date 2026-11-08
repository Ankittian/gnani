"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicError, startRecording, TARGET_RATE, type MicErrorKind, type RecorderHandle } from "@/lib/audio/recorder";

export type RecorderStatus = "idle" | "starting" | "recording" | "error";

export interface RecordingResult {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  autoStopped: boolean;
}

/** Push-to-talk recorder with live level and an auto-stop limit (default 25 s — Prisma REST caps at 30 s). */
export function useRecorder({ maxSec = 25, onAutoStop }: { maxSec?: number; onAutoStop?: (r: RecordingResult) => void } = {}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [errorKind, setErrorKind] = useState<MicErrorKind | null>(null);
  const handle = useRef<RecorderHandle | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const onAutoStopRef = useRef(onAutoStop);
  useEffect(() => {
    onAutoStopRef.current = onAutoStop;
  });

  const clearTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const finish = useCallback(async (autoStopped: boolean): Promise<RecordingResult | null> => {
    const h = handle.current;
    handle.current = null;
    clearTimer();
    setLevel(0);
    if (!h) return null;
    const samples = await h.stop();
    setStatus("idle");
    return { samples, sampleRate: TARGET_RATE, durationSec: samples.length / TARGET_RATE, autoStopped };
  }, []);

  const start = useCallback(async () => {
    if (handle.current) return;
    setErrorKind(null);
    setStatus("starting");
    try {
      handle.current = await startRecording({ onLevel: setLevel });
      startedAt.current = performance.now();
      setElapsed(0);
      setStatus("recording");
      timer.current = setInterval(async () => {
        const s = (performance.now() - startedAt.current) / 1000;
        setElapsed(s);
        if (s >= maxSec) {
          const r = await finish(true);
          if (r) onAutoStopRef.current?.(r);
        }
      }, 100);
    } catch (e) {
      handle.current = null;
      setErrorKind(e instanceof MicError ? e.kind : "unknown");
      setStatus("error");
    }
  }, [finish, maxSec]);

  const stop = useCallback(() => finish(false), [finish]);

  const cancel = useCallback(() => {
    handle.current?.cancel();
    handle.current = null;
    clearTimer();
    setLevel(0);
    setStatus("idle");
  }, []);

  useEffect(() => () => {
    handle.current?.cancel();
    clearTimer();
  }, []);

  return { status, level, elapsed, maxSec, errorKind, start, stop, cancel };
}
