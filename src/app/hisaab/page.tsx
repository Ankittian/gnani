"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { animate } from "motion/react";
import { Loader2, Play, Square } from "@/components/common/icons";
import { toast } from "sonner";
import { Avatar, Card, PageHeader, StatChip } from "@/components/common/ui";
import { DostOrb } from "@/components/orb/DostOrb";
import { useShop } from "@/hooks/useShop";
import { useSpeak } from "@/hooks/useSpeak";
import * as api from "@/lib/api/client";
import { getDb } from "@/lib/db/schema";
import { recordUsage } from "@/lib/db/repo";
import { formatINR, paiseToRupees } from "@/lib/domain/money";
import { isLow } from "@/lib/domain/stock";
import { summarizeDay, weekSeries } from "@/lib/domain/summary";

function CountUp({ paise }: { paise: number }) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const c = animate(prev.current, paise, { duration: 0.8, onUpdate: (x) => setV(Math.round(x)) });
    prev.current = paise;
    return () => c.stop();
  }, [paise]);
  return <>{formatINR(v)}</>;
}

function WeekBars({ series }: { series: ReturnType<typeof weekSeries> }) {
  const max = Math.max(1, ...series.flatMap((d) => [d.credit, d.payment]));
  return (
    <div className="flex h-36 items-end justify-between gap-2" role="img" aria-label="Last 7 days: udhaar given vs collected">
      {series.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end justify-center gap-1">
            <div className="w-1/2 rounded-t-md bg-chili" style={{ height: `${(d.credit / max) * 100}%`, minHeight: d.credit ? 4 : 0 }} />
            <div className="w-1/2 rounded-t-md bg-leaf" style={{ height: `${(d.payment / max) * 100}%`, minHeight: d.payment ? 4 : 0 }} />
          </div>
          <span className="text-[11px] font-semibold text-muted">{new Date(d.date + "T00:00").toLocaleDateString("en-IN", { weekday: "short" })}</span>
        </div>
      ))}
    </div>
  );
}

function HisaabInner() {
  const { shop, tr } = useShop();
  const speaker = useSpeak();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const autoPlayed = useRef(false);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const [ledger, sales, orders, products, customers] = await Promise.all([
      db.ledgerEntries.toArray(),
      db.sales.toArray(),
      db.orders.toArray(),
      db.products.toArray(),
      db.customers.toArray(),
    ]);
    return { ledger, sales, orders, products, customers };
  }, []);

  const s = useMemo(() => (data ? summarizeDay(data, new Date()) : null), [data]);
  const week = useMemo(() => (data ? weekSeries(data.ledger, new Date()) : []), [data]);

  const play = async () => {
    if (!shop || !data || !s) return;
    setLoading(true);
    try {
      const low = data.products.filter(isLow).slice(0, 5).map((p) => p.name);
      const m = await api.compose({
        kind: "dailySummary",
        targetLanguage: shop.language,
        data: {
          salesRupees: paiseToRupees(s.salesPaise),
          creditGivenRupees: paiseToRupees(s.creditGivenPaise),
          collectedRupees: paiseToRupees(s.paymentsPaise),
          netCashInRupees: paiseToRupees(s.netCashInPaise),
          topOwing: s.topOwing.map((c) => ({ name: c.name, rupees: paiseToRupees(c.balance) })),
          lowStock: low,
          ordersDelivered: s.ordersDelivered,
          shopName: shop.name,
          ownerName: shop.ownerName,
        },
      });
      const blob = await api.tts({ text: m.speakText, language: shop.language, voice: shop.assistantVoice });
      void recordUsage(getDb(), { llmCalls: 1, ttsChars: m.speakText.length });
      setLoading(false);
      await speaker.play(blob);
    } catch (e) {
      toast.error(api.friendlyError(e).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("play") === "1" && data && shop && !autoPlayed.current) {
      autoPlayed.current = true;
      void play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, data, shop]);

  if (!shop || !s) return null;

  return (
    <div>
      <PageHeader title={`📊 ${tr("todayHisaab")}`} subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} back="/more" />

      <div className="mx-4 flex flex-col items-center rounded-card bg-gradient-to-br from-brand-soft to-card p-4 shadow-sticker">
        <DostOrb state={speaker.speaking ? "speaking" : loading ? "thinking" : "idle"} level={speaker.level} size={110} />
        <button
          type="button"
          onClick={() => (speaker.speaking ? speaker.stop() : void play())}
          disabled={loading}
          className="mt-2 flex min-h-14 items-center gap-2 rounded-full bg-brand px-8 text-xl font-extrabold text-brand-ink shadow-sticker active:scale-95 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : speaker.speaking ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
          {tr("listen")}
        </button>
      </div>

      <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <StatChip icon="sales" label={tr("statSales")} value={formatINR(s.salesPaise)} tone="leaf" />
        <StatChip icon="credit" label={tr("statCreditGiven")} value={formatINR(s.creditGivenPaise)} tone="chili" />
        <StatChip icon="collected" label={tr("statCollected")} value={formatINR(s.paymentsPaise)} tone="leaf" />
        <StatChip icon="orders" label="Delivered" value={String(s.ordersDelivered)} tone="indigo" />
      </div>

      <Card className="mx-4 mt-3 text-center">
        <p className="text-sm font-semibold text-muted">Net cash in</p>
        <p className="tabular text-4xl font-extrabold text-leaf">
          <CountUp paise={s.netCashInPaise} />
        </p>
      </Card>

      <Card className="mx-4 mt-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-extrabold">Pichhle 7 din</h2>
          <span className="flex items-center gap-3 text-xs font-semibold text-muted">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-chili" />udhaar</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-leaf" />jama</span>
          </span>
        </div>
        <WeekBars series={week} />
      </Card>

      {s.topOwing.length > 0 && (
        <Card className="mx-4 mt-3">
          <h2 className="mb-2 font-extrabold">Sabse zyada baaki</h2>
          <ul className="space-y-2">
            {s.topOwing.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <Avatar name={c.name} size={36} />
                <span className="flex-1 truncate font-bold">{c.name}</span>
                <span className="tabular font-extrabold text-chili">{formatINR(c.balance)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export default function HisaabPage() {
  return (
    <Suspense fallback={null}>
      <HisaabInner />
    </Suspense>
  );
}
