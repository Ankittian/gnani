"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronLeft } from "@/components/common/icons";
import { press } from "@/components/common/motion";
import { usePreviewLocale } from "@/components/layout/LocaleProvider";
import { CloneRecorder } from "@/components/onboarding/CloneRecorder";
import { DostOrb } from "@/components/orb/DostOrb";
import { clearAll, saveShop } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import { LANGUAGE_LIST, LANGUAGES, type LangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations();
  const setPreview = usePreviewLocale();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [language, setLanguage] = useState<LangCode>("hi-IN");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [embedding, setEmbedding] = useState<CloneEmbedding | null>(null);
  const [busy, setBusy] = useState(false);

  // The whole flow switches language live as soon as a tile is tapped.
  useEffect(() => {
    setPreview(language);
  }, [language, setPreview]);

  const go = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  const finish = async (demo: boolean) => {
    setBusy(true);
    const db = getDb();
    if (demo) {
      await seedDemo(db, language);
    } else {
      await clearAll(db);
    }
    await saveShop(db, {
      language,
      ...(shopName.trim() ? { name: shopName.trim() } : demo ? {} : { name: t("defaultShop") }),
      ...(ownerName.trim() ? { ownerName: ownerName.trim() } : demo ? {} : { ownerName: t("defaultOwner") }),
      cloneEmbedding: embedding,
    });
    router.replace("/");
  };

  const steps = 4;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-8">
      <div className="mb-6 flex items-center justify-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={step + 1} aria-label={t("stepOf", { a: step + 1, b: steps })}>
        {Array.from({ length: steps }, (_, i) => (
          <motion.span key={i} className="h-2 rounded-full" animate={{ width: i === step ? 32 : 8, backgroundColor: i === step ? "var(--brand)" : i < step ? "color-mix(in srgb, var(--brand) 60%, transparent)" : "var(--line)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: 30 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 * dir }}
          transition={{ duration: 0.22 }}
          className="flex-1"
        >
          {step === 0 && (
            <>
              <div className="flex flex-col items-center text-center">
                <DostOrb state="happy" size={110} />
                <h1 className="mt-2 text-3xl font-semibold">{t("appName")}</h1>
                <p className="text-muted">{t("chooseLanguage")}</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {LANGUAGE_LIST.map((l, i) => (
                  <motion.button
                    key={l.code}
                    type="button"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * i } }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setLanguage(l.code)}
                    aria-pressed={language === l.code}
                    lang={l.code.split("-")[0]}
                    className={`min-h-20 rounded-card border-2 p-3 text-center shadow-card transition-colors ${language === l.code ? "border-brand bg-brand-soft" : "border-line bg-card"}`}
                  >
                    <span className="block text-2xl font-semibold">{l.nativeName}</span>
                    <span className="block text-xs text-muted">{l.englishName}</span>
                  </motion.button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-semibold">{LANGUAGES[language].greeting}!</h1>
              <p className="mb-5 text-muted">{t("aboutShop")}</p>
              <label className="mb-1 block text-sm font-semibold" htmlFor="ob-shop">
                {t("shopName")}
              </label>
              <input
                id="ob-shop"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={t("shopPlaceholder")}
                className="mb-4 min-h-14 w-full rounded-2xl border border-line bg-card px-4 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <label className="mb-1 block text-sm font-semibold" htmlFor="ob-owner">
                {t("yourName")}
              </label>
              <input
                id="ob-owner"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t("ownerPlaceholder")}
                className="min-h-14 w-full rounded-2xl border border-line bg-card px-4 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-semibold">{t("yourVoice")}</h1>
              <p className="mb-4 text-muted">{t("voiceHint")}</p>
              {embedding ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-card bg-leaf-soft p-5 text-center font-semibold text-leaf">
                  {t("voiceSavedBig")}
                </motion.div>
              ) : (
                <CloneRecorder language={language} onDone={setEmbedding} />
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-3xl font-semibold">{t("getStarted")}</h1>
              <p className="mb-5 text-muted">{t("getStartedHint")}</p>
              <motion.button type="button" {...press} disabled={busy} onClick={() => void finish(true)} className="mb-3 min-h-16 w-full rounded-card bg-brand text-xl font-semibold text-brand-ink shadow-card disabled:opacity-60">
                {t("loadDemo")}
              </motion.button>
              <motion.button type="button" {...press} disabled={busy} onClick={() => void finish(false)} className="min-h-16 w-full rounded-card border border-line bg-card text-lg font-semibold disabled:opacity-60">
                {t("startEmpty")}
              </motion.button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <motion.button type="button" {...press} onClick={() => go(step - 1)} aria-label={t("back")} disabled={busy} className="flex min-h-14 w-14 items-center justify-center rounded-2xl border border-line bg-card">
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
        )}
        {step === 2 && !embedding && (
          <motion.button type="button" {...press} onClick={() => go(3)} className="min-h-14 flex-1 rounded-2xl border border-line bg-card font-semibold text-muted">
            {t("skip")}
          </motion.button>
        )}
        {step < 3 && (
          <motion.button type="button" {...press} onClick={() => go(step + 1)} className="flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-semibold text-bg shadow-card">
            {t("next")} <ArrowRight className="h-5 w-5" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
