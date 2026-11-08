"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Minus, Plus, ShoppingCart } from "@/components/common/icons";
import { EmptyState, PageHeader } from "@/components/common/ui";
import { useVoice } from "@/components/voice/VoiceProvider";
import { useShop } from "@/hooks/useShop";
import { adjustStock } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
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
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, p.stockQty > 0 ? 6 : 0)}%` }} />
    </div>
  );
}

export default function StockPage() {
  const { tr } = useShop();
  const voice = useVoice();
  const [filter, setFilter] = useState<Filter>("all");
  const products = useLiveQuery(() => getDb().products.toArray(), []);

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

  return (
    <div>
      <PageHeader
        title={`${tr("modStock")}`}
        subtitle={`${counts.all} items`}
        right={
          <Link
            href="/stock/reorder"
            className="relative flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 font-semibold text-brand-ink shadow-card"
          >
            <ShoppingCart className="h-5 w-5" /> {tr("reorderList")}
            {reorderCount > 0 && (
              <span className="absolute -right-1 -top-2 min-w-6 rounded-full bg-chili px-1.5 text-center text-xs font-semibold leading-6 text-white">{reorderCount}</span>
            )}
          </Link>
        }
      />

      <div className="flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {(
          [
            ["all", `Sab (${counts.all})`],
            ["low", `Kam (${counts.low})`],
            ["out", `Khatam (${counts.out})`],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-11 shrink-0 rounded-full px-4 font-semibold ${filter === f ? "bg-ink text-bg" : "border border-line bg-card text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => voice.open()} className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-2xl border border-dashed border-brand bg-brand-soft px-4 py-3 text-left text-sm font-semibold text-brand-ink">
        Boliye: “Maggi khatam ho gaya, Parle-G sirf 2 packet bacha”
      </button>

      {products && list.length === 0 ? (
        <EmptyState icon="celebrate" tone="leaf" title="Sab stock mein hai!" />
      ) : (
        <ul className="mx-4 mt-3 grid grid-cols-2 gap-3">
          {list.map((p) => (
            <li key={p.id} className={`rounded-card border bg-card p-3 shadow-card ${p.stockQty === 0 ? "border-chili/50" : "border-line"}`}>
              <div className="flex items-start justify-between">
                <span className="text-3xl" aria-hidden>
                  {p.emoji}
                </span>
                {p.stockQty === 0 ? (
                  <span className="rounded-full bg-chili-soft px-2 py-0.5 text-xs font-semibold text-chili">khatam</span>
                ) : isLow(p) ? (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">kam</span>
                ) : null}
              </div>
              <p className="mt-1 truncate font-semibold">{p.name}</p>
              <p className="text-xs text-muted">{p.pricePaise != null ? `${formatINR(p.pricePaise)} / ${p.unit}` : p.unit}</p>
              <div className="mt-2">
                <StockBar p={p} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label={`Decrease ${p.name}`}
                  onClick={() => void adjustStock(getDb(), p.id, -1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-bg active:scale-90"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="tabular text-lg font-semibold">
                  {p.stockQty} <span className="text-xs text-muted">{p.unit}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Increase ${p.name}`}
                  onClick={() => void adjustStock(getDb(), p.id, 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-bg active:scale-90"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
