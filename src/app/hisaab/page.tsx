"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Loader2, Play, Square } from "@/components/common/icons";
import { toast } from "sonner";
import { AnimatedNumber, Rise, Stagger, press } from "@/components/common/motion";
import { Avatar, Card, PageHeader, StatChip } from "@/components/common/ui";
import { DostOrb } from "@/components/orb/DostOrb";
import { useShop } from "@/hooks/useShop";
import { useSpeak } from "@/hooks/useSpeak";
import * as api from "@/lib/api/client";
import { getDb } from "@/lib/db/schema";
import { recordUsage } from "@/lib/db/repo";
import { formatINR, paiseToRupees } from "@/lib/domain/money";
import { errorKey } from "@/lib/i18n/errors";
import { isLow } from "@/lib/domain/stock";
import { summarizeDay, weekSales, weekSeries } from "@/lib/domain/summary";
import { CompareBars, Donut, TrendArea } from "@/components/charts/charts";

function HisaabInner() {
  const { shop } = useShop();
  const t = useTranslations();
  const format = useFormatter();
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
  const sales7 = useMemo(() => (data ? weekSales(data.sales, new Date()) : []), [data]);
  const weekSalesTotal = useMemo(() => sales7.reduce((a, d) => a + d.amount, 0), [sales7]);

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
      toast.error(t(errorKey(e)));
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
    <Stagger>
      <Rise>
        <PageHeader title={t("todayHisaab")} subtitle={format.dateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })} back="/more" />
      </Rise>

      <Rise className="mx-4 flex flex-col items-center rounded-card border border-line bg-card p-4 shadow-card">
        <DostOrb state={speaker.speaking ? "speaking" : loading ? "thinking" : "idle"} level={speaker.level} size={110} />
        <motion.button
          type="button"
          {...press}
          onClick={() => (speaker.speaking ? speaker.stop() : void play())}
          disabled={loading}
          className="mt-2 flex min-h-14 items-center gap-2 rounded-full bg-brand px-8 text-xl font-semibold text-brand-ink shadow-card disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : speaker.speaking ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
          {t("listen")}
        </motion.button>
      </Rise>

      <Rise className="mx-4 mt-4 grid grid-cols-2 gap-3">
        <StatChip icon="sales" label={t("statSales")} value={formatINR(s.salesPaise)} tone="leaf" />
        <StatChip icon="credit" label={t("statCreditGiven")} value={formatINR(s.creditGivenPaise)} tone="chili" />
        <StatChip icon="collected" label={t("statCollected")} value={formatINR(s.paymentsPaise)} tone="leaf" />
        <StatChip icon="orders" label={t("delivered")} value={String(s.ordersDelivered)} tone="saffron" />
      </Rise>

      <Rise>
        <Card className="mx-4 mt-3 text-center">
          <p className="text-sm text-muted">{t("netCashIn")}</p>
          <p className="tabular text-4xl font-semibold text-leaf">
            <AnimatedNumber value={s.netCashInPaise} format={formatINR} />
          </p>
        </Card>
      </Rise>

      <Rise>
        <Card className="mx-4 mt-3">
          <h2 className="font-semibold">
            {t("statSales")} · {t("last7Days")}
          </h2>
          <p className="tabular mb-2 text-2xl font-semibold tracking-tight">{formatINR(weekSalesTotal)}</p>
          <TrendArea data={sales7} name={t("statSales")} color="var(--brand)" label={t("chartSales7")} />
        </Card>
      </Rise>

      <Rise>
        <Card className="mx-4 mt-3">
          <h2 className="mb-3 font-semibold">{t("todayMix")}</h2>
          <Donut
            label={t("chartMix")}
            centerLabel={t("netCashIn")}
            centerValue={formatINR(s.netCashInPaise)}
            slices={[
              { name: t("statSales"), value: s.salesPaise, color: "var(--brand)" },
              { name: t("statCollected"), value: s.paymentsPaise, color: "var(--leaf)" },
              { name: t("statCreditGiven"), value: s.creditGivenPaise, color: "var(--chili)" },
            ]}
          />
        </Card>
      </Rise>

      <Rise>
        <Card className="mx-4 mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{t("last7Days")}</h2>
            <span className="flex items-center gap-3 text-xs text-muted">
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-chili" />
                {t("ledgerCredit")}
              </span>
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand" />
                {t("ledgerPayment")}
              </span>
            </span>
          </div>
          <CompareBars
            data={week}
            a={{ key: "credit", name: t("ledgerCredit"), color: "var(--chili)" }}
            b={{ key: "payment", name: t("ledgerPayment"), color: "var(--brand)" }}
            label={t("chartCompare")}
          />
        </Card>
      </Rise>

      {s.topOwing.length > 0 && (
        <Rise>
          <Card className="mx-4 mt-3">
            <h2 className="mb-2 font-semibold">{t("topOwing")}</h2>
            <ul className="space-y-2">
              {s.topOwing.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar name={c.name} size={36} />
                  <span className="flex-1 truncate font-semibold">{c.name}</span>
                  <span className="tabular font-semibold text-chili">{formatINR(c.balance)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Rise>
      )}
    </Stagger>
  );
}

export default function HisaabPage() {
  return (
    <Suspense fallback={null}>
      <HisaabInner />
    </Suspense>
  );
}
