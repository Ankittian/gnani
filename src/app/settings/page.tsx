"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Play, Trash2 } from "@/components/common/icons";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Rise, Stagger, press } from "@/components/common/motion";
import { Card, PageHeader } from "@/components/common/ui";
import { CloneRecorder } from "@/components/onboarding/CloneRecorder";
import { useShop } from "@/hooks/useShop";
import { useSpeak } from "@/hooks/useSpeak";
import * as api from "@/lib/api/client";
import { clearAll, saveShop } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import { errorKey } from "@/lib/i18n/errors";
import { LANGUAGE_LIST, TIMBRE_V3_VOICES, type LangCode } from "@/lib/i18n/languages";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-colors ${on ? "justify-end bg-leaf" : "justify-start bg-line"}`}>
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className="h-6 w-6 rounded-full bg-white shadow" />
    </button>
  );
}

export default function SettingsPage() {
  const { shop } = useShop();
  const t = useTranslations();
  const router = useRouter();
  const speaker = useSpeak();
  const [recloning, setRecloning] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const usage = useLiveQuery(async () => {
    const rows = await getDb().usage.toArray();
    return rows.reduce((a, r) => ({ stt: a.stt + r.sttSeconds, tts: a.tts + r.ttsChars, clone: a.clone + r.cloneCalls, llm: a.llm + r.llmCalls }), { stt: 0, tts: 0, clone: 0, llm: 0 });
  }, []);

  if (!shop) return null;
  const set = (p: Parameters<typeof saveShop>[1]) => saveShop(getDb(), p);

  const preview = async (voice: string) => {
    try {
      await speaker.play(await api.tts({ text: t("voicePreview"), language: shop.language, voice }));
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  };

  const wipe = async () => {
    setConfirmWipe(false);
    await clearAll(getDb());
    await getDb().shop.clear();
    router.replace("/onboarding");
  };

  const meter = [
    { label: t("sttSeconds"), v: usage?.stt ?? 0 },
    { label: t("ttsChars"), v: usage?.tts ?? 0 },
    { label: t("clones"), v: usage?.clone ?? 0 },
    { label: t("llmCalls"), v: usage?.llm ?? 0 },
  ];

  return (
    <Stagger>
      <Rise>
        <PageHeader title={t("settings")} back="/more" />
      </Rise>
      <div className="mx-4 space-y-4">
        <Rise>
          <Card>
            <h2 className="mb-2 font-semibold">{t("language")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGE_LIST.map((l) => (
                <motion.button
                  key={l.code}
                  type="button"
                  {...press}
                  onClick={() => void set({ language: l.code as LangCode })}
                  aria-pressed={shop.language === l.code}
                  lang={l.code.split("-")[0]}
                  className={`min-h-12 rounded-xl border-2 font-semibold transition-colors ${shop.language === l.code ? "border-brand bg-brand-soft" : "border-line"}`}
                >
                  {l.nativeName}
                </motion.button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{t("anyLanguage")}</p>
                <p className="text-xs text-muted">{t("anyLanguageSub")}</p>
              </div>
              <Toggle on={shop.anyLanguage} onChange={(v) => void set({ anyLanguage: v })} label={t("anyLanguage")} />
            </div>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <h2 className="mb-2 font-semibold">{t("assistantVoice")}</h2>
            <ul className="grid grid-cols-2 gap-2">
              {TIMBRE_V3_VOICES.map((v) => (
                <li key={v.id} className={`flex items-center gap-1 rounded-xl border-2 transition-colors ${shop.assistantVoice === v.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                  <button type="button" onClick={() => void set({ assistantVoice: v.id })} className="min-h-12 flex-1 px-2 text-left" aria-pressed={shop.assistantVoice === v.id}>
                    <span className="block text-sm font-semibold">{v.id}</span>
                    <span className="block text-[11px] text-muted">{v.gender === "F" ? t("voiceFemale") : t("voiceMale")}</span>
                  </button>
                  <motion.button
                    type="button"
                    {...press}
                    aria-label={t("previewVoice", { name: v.id })}
                    onClick={() => void preview(v.id)}
                    className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-card"
                  >
                    <Play className="h-4 w-4" />
                  </motion.button>
                </li>
              ))}
            </ul>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <h2 className="mb-2 font-semibold">{t("myVoiceClone")}</h2>
            {shop.cloneEmbedding && !recloning ? (
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-leaf">{t("saved")}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRecloning(true)} className="rounded-full border border-line px-4 py-2 font-semibold">
                    {t("rerecord")}
                  </button>
                  <button type="button" aria-label={t("deleteVoice")} onClick={() => void set({ cloneEmbedding: null })} className="rounded-full bg-chili-soft p-2 text-chili">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <CloneRecorder
                language={shop.language}
                onDone={(e) => {
                  void set({ cloneEmbedding: e });
                  void import("@/lib/db/repo").then((m) => m.recordUsage(getDb(), { cloneCalls: 1 }));
                  setRecloning(false);
                }}
              />
            )}
          </Card>
        </Rise>

        <Rise>
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{t("soundVibration")}</span>
              <Toggle on={shop.soundsOn} onChange={(v) => void set({ soundsOn: v })} label={t("soundVibration")} />
            </div>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <h2 className="mb-2 font-semibold">{t("creditMeter")}</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {meter.map((m) => (
                <div key={m.label} className="rounded-xl bg-bg p-2">
                  <dt className="text-muted">{m.label}</dt>
                  <dd className="tabular text-lg font-semibold">{m.v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </Rise>

        <Rise>
          <Card>
            <h2 className="mb-2 font-semibold">{t("dataHeader")}</h2>
            <div className="grid gap-2">
              <motion.button
                type="button"
                {...press}
                onClick={async () => {
                  await seedDemo(getDb(), shop.language);
                  toast.success(t("demoReloaded"));
                }}
                className="min-h-12 rounded-xl border border-line font-semibold"
              >
                {t("reloadDemo")}
              </motion.button>
              <motion.button type="button" {...press} onClick={() => setConfirmWipe(true)} className="min-h-12 rounded-xl bg-chili-soft font-semibold text-chili">
                {t("wipeAll")}
              </motion.button>
            </div>
          </Card>
        </Rise>

        <p className="pb-4 text-center text-xs text-muted">{t("appName")} · Gnani Prisma v3 · Timbre v3 · Voice Clone · Gemini</p>
      </div>

      <AnimatePresence>
        {confirmWipe && <ConfirmDialog title={t("wipeTitle")} body={t("wipeBody")} confirmLabel={t("delete")} destructive onConfirm={() => void wipe()} onCancel={() => setConfirmWipe(false)} />}
      </AnimatePresence>
    </Stagger>
  );
}
