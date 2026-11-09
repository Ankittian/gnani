"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DostOrb } from "@/components/orb/DostOrb";

/** Usage tips shown while the app loads (and while the assistant is thinking), instead of permanent on-screen instructions. */
const TIPS: Record<string, string[]> = {
  "hi-IN": [
    "बोलकर देखें: “Sharma ji ne 340 ka saamaan udhaar liya”",
    "बोलकर देखें: “Fatima ji ne 500 diye”",
    "बोलकर देखें: “Maggi khatam ho gaya”",
    "पूछकर देखें: “Suresh ka kitna baaki hai?”",
    "पूछकर देखें: “Aaj ka hisaab sunao”",
  ],
  "en-IN": [
    "Try saying: “Joseph paid 500 rupees”",
    "Try saying: “Sharma ji took 2 kg rice on credit, 140 rupees”",
    "Try saying: “Parle-G only 2 packets left”",
    "Try asking: “How much does Murugan owe?”",
    "Tap the mic any time to speak — or type instead",
  ],
};

const DEFAULT_TIPS = [...TIPS["hi-IN"].slice(0, 3), ...TIPS["en-IN"].slice(0, 2)];

export function useTips(lang?: string) {
  return TIPS[lang ?? ""] ?? DEFAULT_TIPS;
}

/** One rotating tip line. */
export function TipLine({ lang, className = "" }: { lang?: string; className?: string }) {
  const tips = useTips(lang);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % tips.length), 2600);
    return () => clearInterval(id);
  }, [tips.length]);
  return (
    <div className={`relative h-12 ${className}`} aria-live="off">
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-x-0 text-center text-sm leading-snug text-muted"
        >
          {tips[i % tips.length]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Full-screen loading view: brand, progress, one tip at a time. */
export function Splash({ lang }: { lang?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8">
      <DostOrb state="idle" size={104} />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Dukaan Dost</h1>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Loading">
        <div className="animate-progress h-full w-full rounded-full bg-brand" />
      </div>
      <TipLine lang={lang} className="mt-6 w-full max-w-xs" />
    </div>
  );
}
