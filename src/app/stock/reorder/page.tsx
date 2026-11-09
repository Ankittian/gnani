"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus, Send } from "@/components/common/icons";
import { Card, EmptyState, PageHeader } from "@/components/common/ui";
import { VoiceNoteComposer } from "@/components/common/VoiceNoteComposer";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { groupReorderBySupplier, type ReorderGroup } from "@/lib/domain/stock";
import { LANGUAGES } from "@/lib/i18n/languages";

export default function ReorderPage() {
  const { shop, lang, tr } = useShop();
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
    <div>
      <PageHeader title={`${tr("reorderList")}`} subtitle="Distributor ko unki bhasha mein voice note" back="/stock" />

      {data && groups.length === 0 ? (
        <EmptyState icon="celebrate" tone="leaf" title="Kuch mangwana nahi hai" hint="Saara stock theek hai." />
      ) : (
        <div className="mx-4 space-y-4">
          {groups.map((g) => {
            const sLang = g.supplier?.language ?? lang;
            return (
              <Card key={g.supplier?.id ?? "none"}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{g.supplier?.name ?? "Bina distributor"}</p>
                    <p className="text-xs text-muted">{g.items.length} items</p>
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
                        <p className="text-xs text-muted">
                          abhi {p.stockQty} {p.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Less ${p.name}`}
                        onClick={() => setQty((s) => ({ ...s, [p.id]: Math.max(0, q(p.id, suggested) - 1) }))}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="tabular w-14 text-center font-semibold">
                        {q(p.id, suggested)} <span className="text-xs text-muted">{p.unit}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`More ${p.name}`}
                        onClick={() => setQty((s) => ({ ...s, [p.id]: q(p.id, suggested) + 1 }))}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setSending(g)}
                  className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-saffron text-lg font-semibold text-white shadow-card"
                >
                  <Send className="h-5 w-5" /> {tr("sendVoiceNote")} · {LANGUAGES[sLang].nativeName}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {sending && (
        <VoiceNoteComposer
          shop={shop}
          kind="supplierOrder"
          title={`${sending.supplier?.name ?? "Order"}`}
          defaultLanguage={sending.supplier?.language ?? lang}
          data={{
            supplierName: sending.supplier?.name ?? null,
            items: sending.items
              .map(({ product: p, qty: s }) => ({ name: p.name, qty: q(p.id, s), unit: p.unit }))
              .filter((i) => i.qty > 0),
          }}
          filename={`order-${(sending.supplier?.name ?? "supplier").replace(/\s+/g, "-").toLowerCase()}`}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  );
}
