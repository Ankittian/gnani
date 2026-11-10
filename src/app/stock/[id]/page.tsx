"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Minus, Plus, ShoppingCart } from "@/components/common/icons";
import { Rise, Stagger, press } from "@/components/common/motion";
import { Avatar, Card, EmptyState, PageHeader, useUnit } from "@/components/common/ui";
import { TimelineRow } from "@/components/memory/TimelineRow";
import { adjustStock } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { buildTimeline, productMemory } from "@/lib/domain/memory";
import { formatINR } from "@/lib/domain/money";
import { isLow } from "@/lib/domain/stock";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const unitLabel = useUnit();

  const data = useLiveQuery(async () => {
    const db = getDb();
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    const [product, products, customers, ledger, sales, orders, stockEvents, suppliers] = await Promise.all([
      db.products.get(id),
      db.products.toArray(),
      db.customers.toArray(),
      db.ledgerEntries.where("createdAt").aboveOrEqual(since).toArray(),
      db.sales.where("createdAt").aboveOrEqual(since).toArray(),
      db.orders.toArray(),
      db.stockEvents.where("productId").equals(id).toArray(),
      db.suppliers.toArray(),
    ]);
    return { product: product ?? null, products, customers, ledger, sales, orders, stockEvents, suppliers };
  }, [id]);

  const mem = useMemo(() => (data?.product ? productMemory(id, data, new Date()) : null), [data, id]);
  const history = useMemo(() => (data ? buildTimeline(data).filter((e) => e.productIds.includes(id)).slice(0, 25) : []), [data, id]);

  if (data === undefined) return null;
  if (!data.product || !mem) return <EmptyState icon="notFound" tone="muted" title={t("productNotFound")} />;
  const p = data.product;
  const supplier = data.suppliers.find((s) => s.id === p.supplierId);
  const fmtQty = (n: number) => `${Math.round(n * 100) / 100} ${unitLabel(p.unit)}`.trim();

  return (
    <Stagger>
      <Rise>
        <PageHeader title={`${p.emoji} ${p.name}`} subtitle={[p.pricePaise != null ? `${formatINR(p.pricePaise)} / ${unitLabel(p.unit)}` : null, supplier ? `${t("supplier")}: ${supplier.name}` : null].filter(Boolean).join(" · ")} back="/stock" />
      </Rise>

      <Rise>
        <Card className="mx-4">
          <div className="flex items-center justify-between">
            <motion.button type="button" aria-label={t("decreaseItem", { name: p.name })} whileTap={{ scale: 0.8 }} onClick={() => void adjustStock(getDb(), p.id, -1)} className="flex h-12 w-12 items-center justify-center rounded-full bg-bg">
              <Minus className="h-5 w-5" />
            </motion.button>
            <div className="text-center">
              <motion.p key={p.stockQty} initial={{ y: -6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className={`tabular text-4xl font-semibold ${p.stockQty === 0 ? "text-chili" : ""}`}>
                {fmtQty(p.stockQty)}
              </motion.p>
              <p className="text-xs text-muted">{p.stockQty === 0 ? t("soldOut") : t("reorderAt", { n: p.reorderLevel })}</p>
            </div>
            <motion.button type="button" aria-label={t("increaseItem", { name: p.name })} whileTap={{ scale: 0.8 }} onClick={() => void adjustStock(getDb(), p.id, 1)} className="flex h-12 w-12 items-center justify-center rounded-full bg-bg">
              <Plus className="h-5 w-5" />
            </motion.button>
          </div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
            {[
              { label: t("soldLast7"), value: fmtQty(mem.soldLast7) },
              { label: t("perDay"), value: mem.perDay > 0 ? fmtQty(mem.perDay) : "—" },
              { label: t("lastsFor"), value: mem.daysLeft == null ? "—" : t("daysN", { n: mem.daysLeft }), warn: mem.daysLeft != null && mem.daysLeft <= 3 },
            ].map((s) => (
              <div key={s.label} className="px-2">
                <p className="truncate text-[11px] text-muted">{s.label}</p>
                <p className={`tabular mt-0.5 truncate font-semibold ${s.warn ? "text-chili" : ""}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {isLow(p) && (
            <motion.div {...press} className="mt-3">
              <Link href="/stock/reorder" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-brand-ink">
                <ShoppingCart className="h-5 w-5" /> {t("reorderList")}
              </Link>
            </motion.div>
          )}
        </Card>
      </Rise>

      {mem.topBuyers.length > 0 && (
        <Rise className="mx-4 mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("topBuyers")}</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {mem.topBuyers.map((b) => (
              <Link key={b.customerId} href={`/khata/${b.customerId}`} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-1.5 pr-3 shadow-card">
                <Avatar name={b.name} size={30} />
                <span className="text-sm font-semibold">{b.name}</span>
                <span className="tabular text-xs text-muted">{fmtQty(b.qty)}</span>
              </Link>
            ))}
          </div>
        </Rise>
      )}

      <Rise className="mx-4 mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("stockHistory")}</h2>
        {history.length === 0 ? (
          <p className="rounded-card border border-line bg-card px-4 py-6 text-center text-sm text-muted">{t("noActivity")}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
            {history.map((e) => (
              <TimelineRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Rise>
    </Stagger>
  );
}
