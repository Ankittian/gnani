"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Minus, Plus, Send } from "@/components/common/icons";
import { Rise, Stagger, press } from "@/components/common/motion";
import { Card, EmptyState, PageHeader, useUnit } from "@/components/common/ui";
import { VoiceNoteComposer } from "@/components/common/VoiceNoteComposer";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { groupReorderBySupplier, type ReorderGroup } from "@/lib/domain/stock";
import { LANGUAGES } from "@/lib/i18n/languages";

export default function ReorderPage() {
  const { shop, lang } = useShop();
  const t = useTranslations();
  const unitLabel = useUnit();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [products, suppliers] = await Promise.all([db.products.toArray(), db.suppliers.toArray()]);
    return groupReorderBySupplier(products, suppliers);
  }, []);
  /** User-edited quantities keyed by product id. */
  const [qty, setQty] = useState<Record<string, number>>({});
  const [sending, setSending] = useState<ReorderGroup | null>(null);

  const groups = useMemo(() => data ?? [], [data]);
  const q = (id: string, fallback: number) => qty[id] ?? fallback;

  if (!shop) return null;

  return (
    <Stagger>
      <Rise>
        <PageHeader title={t("reorderList")} subtitle={t("reorderSubtitle")} back="/stock" />
      </Rise>

      {data && groups.length === 0 ? (
        <EmptyState icon="celebrate" tone="leaf" title={t("nothingToOrder")} hint={t("allStockFine")} />
      ) : (
        <div className="mx-4 space-y-4">
          {groups.map((g) => {
            const sLang = g.supplier?.language ?? lang;
            // Don't offer to send an empty order if every quantity was dialled down to 0.
            const anyQty = g.items.some(({ product: p, qty: s }) => q(p.id, s) > 0);
            return (
              <Rise key={g.supplier?.id ?? "none"}>
                <Card>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">{g.supplier?.name ?? t("noDistributor")}</p>
                      <p className="text-xs text-muted">{t("itemsN", { n: g.items.length })}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-saffron-soft px-3 py-1 text-sm font-semibold text-saffron">{LANGUAGES[sLang].nativeName}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {g.items.map(({ product: p, qty: suggested }) => (
                      <li key={p.id} className="flex items-center gap-2 py-2">
                        <span className="text-2xl" aria-hidden>
                          {p.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{p.name}</p>
                          <p className="text-xs text-muted">{t("nowStock", { n: p.stockQty, unit: unitLabel(p.unit) })}</p>
                        </div>
                        <motion.button
                          type="button"
                          aria-label={t("lessItem", { name: p.name })}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => setQty((s) => ({ ...s, [p.id]: Math.max(0, q(p.id, suggested) - 1) }))}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"
                        >
                          <Minus className="h-4 w-4" />
                        </motion.button>
                        <motion.span key={q(p.id, suggested)} initial={{ y: -5, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="tabular w-14 text-center font-semibold">
                          {q(p.id, suggested)} <span className="text-xs text-muted">{unitLabel(p.unit)}</span>
                        </motion.span>
                        <motion.button
                          type="button"
                          aria-label={t("moreItem", { name: p.name })}
                          whileTap={{ scale: 0.8 }}
                          onClick={() => setQty((s) => ({ ...s, [p.id]: q(p.id, suggested) + 1 }))}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"
                        >
                          <Plus className="h-4 w-4" />
                        </motion.button>
                      </li>
                    ))}
                  </ul>
                  <motion.button
                    type="button"
                    {...press}
                    disabled={!anyQty}
                    onClick={() => setSending(g)}
                    className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-saffron text-lg font-semibold text-white shadow-card disabled:opacity-40"
                  >
                    <Send className="h-5 w-5" /> {t("sendVoiceNote")} · {LANGUAGES[sLang].nativeName}
                  </motion.button>
                </Card>
              </Rise>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {sending && (
          <VoiceNoteComposer
            shop={shop}
            kind="supplierOrder"
            title={sending.supplier?.name ?? t("orderTitle")}
            defaultLanguage={sending.supplier?.language ?? lang}
            data={{
              supplierName: sending.supplier?.name ?? null,
              items: sending.items.map(({ product: p, qty: s }) => ({ name: p.name, qty: q(p.id, s), unit: p.unit })).filter((i) => i.qty > 0),
            }}
            filename={`order-${(sending.supplier?.name ?? "supplier").replace(/\s+/g, "-").toLowerCase()}`}
            onClose={() => setSending(null)}
          />
        )}
      </AnimatePresence>
    </Stagger>
  );
}
