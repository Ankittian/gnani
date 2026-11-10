"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Download, Minus, Plus, ShoppingCart, Upload } from "@/components/common/icons";
import { Rise, Stagger, press } from "@/components/common/motion";
import { EmptyState, PageHeader, useUnit } from "@/components/common/ui";
import { downloadText, ImportCsvSheet } from "@/components/stock/ImportCsvSheet";
import { useVoice } from "@/components/voice/VoiceProvider";
import { useShop } from "@/hooks/useShop";
import { adjustStock } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { stockCsvFromProducts } from "@/lib/domain/csv";
import { formatINR } from "@/lib/domain/money";
import { isLow } from "@/lib/domain/stock";
import type { Product } from "@/lib/types";

type Filter = "all" | "low" | "out";

function StockBar({ p }: { p: Product }) {
  const max = Math.max(p.reorderLevel * 3, p.stockQty, 1);
  const pct = Math.min(100, (p.stockQty / max) * 100);
  const color = p.stockQty === 0 ? "bg-chili" : isLow(p) ? "bg-brand" : "bg-leaf";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={false}
        animate={{ width: `${Math.max(pct, p.stockQty > 0 ? 6 : 0)}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
      />
    </div>
  );
}

export default function StockPage() {
  const t = useTranslations();
  const unitLabel = useUnit();
  const voice = useVoice();
  const { shop } = useShop();
  const [filter, setFilter] = useState<Filter>("all");
  const [importing, setImporting] = useState(false);
  const products = useLiveQuery(() => getDb().products.toArray(), []);

  const exportCsv = async () => {
    const db = getDb();
    const [ps, sups] = await Promise.all([db.products.toArray(), db.suppliers.toArray()]);
    downloadText(`stock-${new Date().toISOString().slice(0, 10)}.csv`, stockCsvFromProducts(ps, sups));
  };

  const counts = useMemo(() => {
    const ps = products ?? [];
    return { all: ps.length, low: ps.filter((p) => isLow(p) && p.stockQty > 0).length, out: ps.filter((p) => p.stockQty === 0).length };
  }, [products]);

  const list = useMemo(() => {
    const ps = [...(products ?? [])];
    const f = filter === "low" ? ps.filter((p) => isLow(p) && p.stockQty > 0) : filter === "out" ? ps.filter((p) => p.stockQty === 0) : ps;
    return f.sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name));
  }, [products, filter]);

  const reorderCount = counts.low + counts.out;
  const tabs: [Filter, string][] = [
    ["all", `${t("filterAll")} (${counts.all})`],
    ["low", `${t("filterLow")} (${counts.low})`],
    ["out", `${t("filterOut")} (${counts.out})`],
  ];

  return (
    <Stagger>
      <Rise>
        <PageHeader
          title={t("modStock")}
          subtitle={t("itemsN", { n: counts.all })}
          right={
            <Link href="/stock/reorder" className="relative flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 font-semibold text-brand-ink shadow-card transition-transform active:scale-95">
              <ShoppingCart className="h-5 w-5" /> {t("reorderList")}
              {reorderCount > 0 && (
                <motion.span
                  key={reorderCount}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 14 }}
                  className="absolute -right-1 -top-2 min-w-6 rounded-full bg-chili px-1.5 text-center text-xs font-semibold leading-6 text-white"
                >
                  {reorderCount}
                </motion.span>
              )}
            </Link>
          }
        />
      </Rise>

      <Rise className="flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {tabs.map(([f, label]) => (
          <motion.button
            key={f}
            role="tab"
            aria-selected={filter === f}
            type="button"
            {...press}
            onClick={() => setFilter(f)}
            className={`relative min-h-11 shrink-0 rounded-full px-4 font-semibold ${filter === f ? "text-bg" : "border border-line bg-card text-muted"}`}
          >
            {filter === f && <motion.span layoutId="stock-filter" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{label}</span>
          </motion.button>
        ))}
      </Rise>

      <Rise className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <motion.button
          type="button"
          {...press}
          onClick={() => setImporting(true)}
          data-testid="import-csv"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-sm font-semibold shadow-card"
        >
          <Upload className="h-4 w-4" /> {t("importCsv")}
        </motion.button>
        <motion.button
          type="button"
          {...press}
          onClick={() => void exportCsv()}
          disabled={!products?.length}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-sm font-semibold shadow-card disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {t("exportCsv")}
        </motion.button>
      </Rise>

      <Rise>
        <button
          type="button"
          onClick={() => voice.open()}
          className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-2xl border border-dashed border-brand bg-brand-soft px-4 py-3 text-left text-sm font-semibold text-brand-ink transition-transform active:scale-[0.99]"
        >
          {t("stockHint")}
        </button>
      </Rise>

      {products && products.length === 0 ? (
        <EmptyState
          icon="upload"
          tone="sky"
          title={t("csvTitle")}
          hint={t("stockHint")}
          action={
            <button type="button" onClick={() => setImporting(true)} className="min-h-12 rounded-full bg-brand px-5 font-semibold text-brand-ink shadow-card">
              {t("importCsv")}
            </button>
          }
        />
      ) : products && list.length === 0 ? (
        <EmptyState icon="celebrate" tone="leaf" title={t("stockAllGood")} />
      ) : (
        <ul className="mx-4 mt-3 grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: Math.min(i, 10) * 0.025, type: "spring", stiffness: 380, damping: 30 } }}
                exit={{ opacity: 0, scale: 0.92 }}
                className={`rounded-card border bg-card p-3 shadow-card ${p.stockQty === 0 ? "border-chili/50" : "border-line"}`}
              >
                <Link href={`/stock/${p.id}`} aria-label={t("viewItem", { name: p.name })} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl" aria-hidden>
                      {p.emoji}
                    </span>
                    {p.stockQty === 0 ? (
                      <span className="rounded-full bg-chili-soft px-2 py-0.5 text-xs font-semibold text-chili">{t("soldOut")}</span>
                    ) : isLow(p) ? (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">{t("lowBadge")}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">{p.pricePaise != null ? `${formatINR(p.pricePaise)} / ${unitLabel(p.unit)}` : unitLabel(p.unit)}</p>
                </Link>
                <div className="mt-2">
                  <StockBar p={p} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <motion.button
                    type="button"
                    aria-label={t("decreaseItem", { name: p.name })}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => void adjustStock(getDb(), p.id, -1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-bg"
                  >
                    <Minus className="h-4 w-4" />
                  </motion.button>
                  <motion.span key={p.stockQty} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="tabular text-lg font-semibold">
                    {p.stockQty} <span className="text-xs text-muted">{unitLabel(p.unit)}</span>
                  </motion.span>
                  <motion.button
                    type="button"
                    aria-label={t("increaseItem", { name: p.name })}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => void adjustStock(getDb(), p.id, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-bg"
                  >
                    <Plus className="h-4 w-4" />
                  </motion.button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence>{importing && <ImportCsvSheet soundsOn={shop?.soundsOn ?? true} onClose={() => setImporting(false)} />}</AnimatePresence>
    </Stagger>
  );
}
