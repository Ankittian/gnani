"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { CloneRecorder } from "@/components/onboarding/CloneRecorder";
import { DostOrb } from "@/components/orb/DostOrb";
import { clearAll, saveShop } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import { LANGUAGE_LIST, LANGUAGES, type LangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<LangCode>("hi-IN");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [embedding, setEmbedding] = useState<CloneEmbedding | null>(null);
  const [busy, setBusy] = useState(false);

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
      ...(shopName.trim() ? { name: shopName.trim() } : demo ? {} : { name: "Meri Dukaan" }),
      ...(ownerName.trim() ? { ownerName: ownerName.trim() } : demo ? {} : { ownerName: "Dost" }),
      cloneEmbedding: embedding,
    });
    router.replace("/");
  };

  const steps = 4;

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-8">
      <div className="mb-6 flex justify-center gap-2" aria-label={`Step ${step + 1} of ${steps}`}>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-8 bg-brand" : i < step ? "w-2 bg-brand/60" : "w-2 bg-line"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex-1">
          {step === 0 && (
            <>
              <div className="flex flex-col items-center text-center">
                <DostOrb state="happy" size={110} />
                <h1 className="mt-2 text-3xl font-extrabold">Dukaan Dost</h1>
                <p className="text-muted">Apni bhasha chuniye · Choose your language</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {LANGUAGE_LIST.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLanguage(l.code)}
                    aria-pressed={language === l.code}
                    lang={l.code.split("-")[0]}
                    className={`min-h-20 rounded-card border-2 p-3 text-center shadow-sticker transition-all active:scale-95 ${
                      language === l.code ? "border-brand bg-brand-soft" : "border-line bg-card"
                    }`}
                  >
                    <span className="block text-2xl font-extrabold">{l.nativeName}</span>
                    <span className="block text-xs font-semibold text-muted">{l.englishName}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-extrabold">{LANGUAGES[language].greeting}! 👋</h1>
              <p className="mb-5 text-muted">Dukaan ke baare mein batayein</p>
              <label className="mb-1 block text-sm font-bold" htmlFor="ob-shop">Dukaan ka naam</label>
              <input id="ob-shop" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Shree Ganesh Kirana" className="mb-4 min-h-14 w-full rounded-2xl border border-line bg-card px-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
              <label className="mb-1 block text-sm font-bold" htmlFor="ob-owner">Aapka naam</label>
              <input id="ob-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Ramesh" className="min-h-14 w-full rounded-2xl border border-line bg-card px-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand" />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-extrabold">Apni awaaz 🗣️</h1>
              <p className="mb-4 text-muted">Ek line padhiye — reminder aapki hi awaaz mein customers ko jaayenge. (Optional)</p>
              {embedding ? (
                <div className="rounded-card bg-leaf-soft p-5 text-center font-extrabold text-leaf">✅ Awaaz save ho gayi!</div>
              ) : (
                <CloneRecorder language={language} onDone={setEmbedding} />
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-3xl font-extrabold">Shuru karein 🚀</h1>
              <p className="mb-5 text-muted">Demo data (nakli customers aur saamaan) ke saath try karein, ya khaali shuru karein.</p>
              <button type="button" disabled={busy} onClick={() => void finish(true)} className="mb-3 min-h-16 w-full rounded-card bg-brand text-xl font-extrabold text-brand-ink shadow-sticker active:scale-[0.98] disabled:opacity-60">
                ✨ Demo dukaan load karein
              </button>
              <button type="button" disabled={busy} onClick={() => void finish(false)} className="min-h-16 w-full rounded-card border border-line bg-card text-lg font-bold active:scale-[0.98] disabled:opacity-60">
                Khaali shuru karein
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {step < 3 && (
        <div className="mt-6 flex gap-3">
          {step === 2 && !embedding && (
            <button type="button" onClick={() => setStep(3)} className="min-h-14 flex-1 rounded-2xl border border-line bg-card font-bold text-muted">
              Skip
            </button>
          )}
          <button type="button" onClick={() => setStep(step + 1)} className="flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-extrabold text-bg shadow-sticker active:scale-[0.98]">
            Aage <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
