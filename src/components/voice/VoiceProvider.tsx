"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "motion/react";

const VoiceSheet = dynamic(() => import("@/components/voice/VoiceSheet").then((m) => m.VoiceSheet), { ssr: false });

interface VoiceCtx {
  open: (opts?: { typed?: string }) => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<VoiceCtx | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [seed, setSeed] = useState<{ typed?: string; n: number }>({ n: 0 });

  const open = useCallback((opts?: { typed?: string }) => {
    setSeed((s) => ({ typed: opts?.typed, n: s.n + 1 }));
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <AnimatePresence>{isOpen && <VoiceSheet key={seed.n} initialText={seed.typed} onClose={close} />}</AnimatePresence>
    </Ctx.Provider>
  );
}

export function useVoice(): VoiceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVoice must be used inside <VoiceProvider>");
  return v;
}
