"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Play, Trash2 } from "@/components/common/icons";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/common/ui";
import { CloneRecorder } from "@/components/onboarding/CloneRecorder";
import { useShop } from "@/hooks/useShop";
import { useSpeak } from "@/hooks/useSpeak";
import * as api from "@/lib/api/client";
import { clearAll, saveShop } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { seedDemo } from "@/lib/db/seed";
import { LANGUAGE_LIST, LANGUAGES, TIMBRE_V3_VOICES, type LangCode } from "@/lib/i18n/languages";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-leaf" : "bg-line"}`}>
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { shop, tr } = useShop();
  const router = useRouter();
  const speaker = useSpeak();
  const [recloning, setRecloning] = useState(false);
  const usage = useLiveQuery(async () => {
    const rows = await getDb().usage.toArray();
    return rows.reduce((a, r) => ({ stt: a.stt + r.sttSeconds, tts: a.tts + r.ttsChars, clone: a.clone + r.cloneCalls, llm: a.llm + r.llmCalls }), { stt: 0, tts: 0, clone: 0, llm: 0 });
  }, []);

  if (!shop) return null;
  const set = (p: Parameters<typeof saveShop>[1]) => saveShop(getDb(), p);

  const preview = async (voice: string) => {
    try {
      const text = shop.language === "en-IN" ? "Hello, I am your shop assistant." : `${LANGUAGES[shop.language].greeting}! मैं आपका दुकान दोस्त हूँ।`;
      const lang = shop.language;
      await speaker.play(await api.tts({ text: lang === "hi-IN" || lang === "en-IN" ? text : LANGUAGES[lang].greeting, language: lang, voice }));
    } catch (e) {
      toast.error(api.friendlyError(e).message);
    }
  };

  return (
    <div>
      <PageHeader title={tr("settings")} back="/more" />
      <div className="mx-4 space-y-4">
        <Card>
          <h2 className="mb-2 font-semibold">Bhasha / Language</h2>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGE_LIST.map((l) => (
              <button key={l.code} type="button" onClick={() => void set({ language: l.code as LangCode })} aria-pressed={shop.language === l.code} className={`min-h-12 rounded-xl border-2 font-semibold ${shop.language === l.code ? "border-brand bg-brand-soft" : "border-line"}`}>
                {l.nativeName}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Kisi bhi bhasha mein bolein</p>
              <p className="text-xs text-muted">Auto-detect (Prisma indic-auto)</p>
            </div>
            <Toggle on={shop.anyLanguage} onChange={(v) => void set({ anyLanguage: v })} label="Any language" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Assistant ki awaaz</h2>
          <ul className="grid grid-cols-2 gap-2">
            {TIMBRE_V3_VOICES.map((v) => (
              <li key={v.id} className={`flex items-center gap-1 rounded-xl border-2 ${shop.assistantVoice === v.id ? "border-brand bg-brand-soft" : "border-line"}`}>
                <button type="button" onClick={() => void set({ assistantVoice: v.id })} className="min-h-12 flex-1 px-2 text-left" aria-pressed={shop.assistantVoice === v.id}>
                  <span className="block text-sm font-semibold">{v.id}</span>
                  <span className="block text-[11px] text-muted">{v.vibe}</span>
                </button>
                <button type="button" aria-label={`Preview ${v.id}`} onClick={() => void preview(v.id)} className="mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-card">
                  <Play className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Meri awaaz (Voice clone)</h2>
          {shop.cloneEmbedding && !recloning ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-leaf">Saved</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRecloning(true)} className="rounded-full border border-line px-4 py-2 font-semibold">Dobara</button>
                <button type="button" aria-label="Delete voice" onClick={() => void set({ cloneEmbedding: null })} className="rounded-full bg-chili-soft p-2 text-chili"><Trash2 className="h-5 w-5" /></button>
              </div>
            </div>
          ) : (
            <CloneRecorder language={shop.language} onDone={(e) => { void set({ cloneEmbedding: e }); void import("@/lib/db/repo").then((m) => m.recordUsage(getDb(), { cloneCalls: 1 })); setRecloning(false); }} />
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Sound & vibration</span>
            <Toggle on={shop.soundsOn} onChange={(v) => void set({ soundsOn: v })} label="Sounds" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Credit meter (this device)</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-bg p-2"><dt className="text-muted">STT seconds</dt><dd className="tabular text-lg font-semibold">{usage?.stt ?? 0}</dd></div>
            <div className="rounded-xl bg-bg p-2"><dt className="text-muted">TTS characters</dt><dd className="tabular text-lg font-semibold">{usage?.tts ?? 0}</dd></div>
            <div className="rounded-xl bg-bg p-2"><dt className="text-muted">Clones</dt><dd className="tabular text-lg font-semibold">{usage?.clone ?? 0}</dd></div>
            <div className="rounded-xl bg-bg p-2"><dt className="text-muted">LLM calls</dt><dd className="tabular text-lg font-semibold">{usage?.llm ?? 0}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Data</h2>
          <div className="grid gap-2">
            <button type="button" onClick={async () => { await seedDemo(getDb(), shop.language); toast.success("Demo data reload ho gaya"); }} className="min-h-12 rounded-xl border border-line font-semibold">Demo data reload</button>
            <button type="button" onClick={async () => { if (confirm("Saara data delete karein?")) { await clearAll(getDb()); await getDb().shop.clear(); router.replace("/onboarding"); } }} className="min-h-12 rounded-xl bg-chili-soft font-semibold text-chili">Sab kuch mita dein</button>
          </div>
        </Card>

        <p className="pb-4 text-center text-xs text-muted">Dukaan Dost · Gnani Prisma v3 · Timbre v3 · Voice Clone · Gemini</p>
      </div>
    </div>
  );
}
