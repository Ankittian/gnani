"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { DostOrb } from "@/components/orb/DostOrb";

const TIP_KEYS = ["tip1", "tip2", "tip3", "tip4", "tip5"] as const;

/** One rotating usage tip, in the active language. */
export function TipLine({ className = "" }: { className?: string }) {
  const t = useTranslations();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % TIP_KEYS.length), 2600);
    return () => clearInterval(id);
  }, []);
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
          {t(TIP_KEYS[i])}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Full-screen loading view: brand, progress, one tip at a time. */
export function Splash() {
  const t = useTranslations();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-8">
      <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }}>
        <DostOrb state="idle" size={104} />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-3 text-2xl font-semibold tracking-tight">
        {t("appName")}
      </motion.h1>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={t("loading")}>
        <div className="animate-progress h-full w-full rounded-full bg-brand" />
      </div>
      <TipLine className="mt-6 w-full max-w-xs" />
    </div>
  );
}
