"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Rise, Stagger, press } from "@/components/common/motion";
import { DostOrb } from "@/components/orb/DostOrb";

/** Route-level error boundary: a friendly, localized recovery screen instead of a blank page or a stack trace. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Stagger className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <Rise>
        <DostOrb state="sad" size={110} />
      </Rise>
      <Rise>
        <h1 className="mt-4 text-xl font-semibold">{t("errorTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("errUnknown")}</p>
      </Rise>
      <Rise>
        <motion.button type="button" {...press} onClick={reset} className="mt-5 min-h-12 rounded-full bg-brand px-6 font-semibold text-brand-ink shadow-card">
          {t("tryAgain")}
        </motion.button>
      </Rise>
    </Stagger>
  );
}
