"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Search } from "@/components/common/icons";
import { Rise, Stagger, press } from "@/components/common/motion";
import { EmptyState, PageHeader } from "@/components/common/ui";
import { InsightsCard } from "@/components/memory/InsightsCard";
import { TimelineRow } from "@/components/memory/TimelineRow";
import { getDb } from "@/lib/db/schema";
import { buildTimeline, shopInsights, type TimelineKind } from "@/lib/domain/memory";
import { nameKey } from "@/lib/domain/match";
import type { MessageKey } from "@/lib/i18n/messages";

type Filter = "all" | "khata" | "sale" | "stock" | "order";
const FILTERS: [Filter, MessageKey][] = [
  ["all", "filterAll"],
  ["khata", "modKhata"],
  ["sale", "cashSale"],
  ["stock", "modStock"],
  ["order", "modOrders"],
];
const KINDS: Record<Filter, TimelineKind[] | null> = { all: null, khata: ["credit", "payment"], sale: ["sale"], stock: ["stock"], order: ["order"] };

/** The shop's central memory: every khata entry, sale, stock movement and order on one linked timeline. */
export default function MemoryPage() {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const [customers, products, ledger, sales, orders, stockEvents] = await Promise.all([
      db.customers.toArray(),
      db.products.toArray(),
      db.ledgerEntries.toArray(),
      db.sales.toArray(),
      db.orders.toArray(),
      db.stockEvents.toArray(),
    ]);
    return { customers, products, ledger, sales, orders, stockEvents };
  }, []);

  const timeline = useMemo(() => (data ? buildTimeline(data) : []), [data]);
  const insights = useMemo(() => (data ? shopInsights(data, new Date()) : []), [data]);
  const shown = useMemo(() => {
    const kinds = KINDS[filter];
    const key = nameKey(query);
    return timeline
      .filter((e) => !kinds || kinds.includes(e.kind))
      .filter((e) => !key || nameKey([e.subject, ...e.items.map((i) => i.name), e.transcript ?? ""].join(" ")).includes(key))
      .slice(0, 150);
  }, [timeline, filter, query]);

  return (
    <Stagger>
      <Rise>
        <PageHeader title={t("memoryPage")} subtitle={t("memorySubtitle")} back="/more" />
      </Rise>

      <Rise className="px-4">
        <InsightsCard insights={insights} />
      </Rise>

      <Rise className="mx-4 mt-4">
        <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-card px-3 shadow-card">
          <Search className="h-5 w-5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchMemory")} aria-label={t("searchMemory")} className="min-w-0 flex-1 bg-transparent text-base focus:outline-none" />
        </label>
      </Rise>

      <Rise className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {FILTERS.map(([f, key]) => (
          <motion.button
            key={f}
            role="tab"
            aria-selected={filter === f}
            type="button"
            {...press}
            onClick={() => setFilter(f)}
            className={`relative min-h-11 shrink-0 rounded-full px-4 font-semibold ${filter === f ? "text-bg" : "border border-line bg-card text-muted"}`}
          >
            {filter === f && <motion.span layoutId="memory-filter" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{t(key)}</span>
          </motion.button>
        ))}
      </Rise>

      {data && shown.length === 0 ? (
        <EmptyState icon="memory" tone="muted" title={t("noMemory")} />
      ) : (
        <Rise className="mx-4 mt-3">
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
            {shown.map((e) => (
              <TimelineRow key={e.id} e={e} />
            ))}
          </ul>
        </Rise>
      )}
    </Stagger>
  );
}
