"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Single shared audio player with an AnalyserNode so the Dost orb can lip-sync.
 * One <audio> element + one MediaElementSource for the app lifetime (a source can only be created once per element).
 */
let el: HTMLAudioElement | null = null;
let actx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let currentUrl: string | null = null;

function ensurePlayer() {
  if (typeof window === "undefined") return null;
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    try {
      actx = new AudioContext();
      const src = actx.createMediaElementSource(el);
      analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(actx.destination);
    } catch {
      actx = null;
      analyser = null; // playback still works without lip-sync
    }
  }
  return el;
}

export function stopSpeaking() {
  if (el) {
    el.pause();
    el.currentTime = 0;
  }
}

export function useSpeak() {
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const raf = useRef<number | null>(null);

  const loop = useCallback(() => {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
    raf.current = requestAnimationFrame(loop);
  }, []);

  const play = useCallback(
    async (blob: Blob): Promise<void> => {
      const player = ensurePlayer();
      if (!player) return;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = URL.createObjectURL(blob);
      player.src = currentUrl;
      if (actx?.state === "suspended") await actx.resume().catch(() => undefined);
      setSpeaking(true);
      raf.current = requestAnimationFrame(loop);
      await new Promise<void>((resolve) => {
        const done = () => {
          player.removeEventListener("ended", done);
          player.removeEventListener("error", done);
          player.removeEventListener("pause", done);
          resolve();
        };
        player.addEventListener("ended", done);
        player.addEventListener("error", done);
        player.addEventListener("pause", done);
        player.play().catch(done);
      });
      if (raf.current) cancelAnimationFrame(raf.current);
      setLevel(0);
      setSpeaking(false);
    },
    [loop],
  );

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  return { play, stop: stopSpeaking, speaking, level };
}
