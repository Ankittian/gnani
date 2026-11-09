"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "@/components/common/icons";
import { EmptyState, PageHeader, timeAgo } from "@/components/common/ui";
import { NewOrderSheet } from "@/components/orders/NewOrderSheet";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { OrderStatus } from "@/lib/types";

export const STATUS_STYLE: Record<OrderStatus, { label: string; cls: string}> = {
  new: { label: "Naya", cls: "bg-chili-soft text-chili" },
  packed: { label: "Packed", cls: "bg-brand-soft text-brand-ink" },
  delivered: { label: "Delivered", cls: "bg-leaf-soft text-leaf" },
};

export default function OrdersPage() {
  const { shop, tr } = useShop();
  const [open, setOpen] = useState(false);
  const orders = useLiveQuery(async () => (await getDb().orders.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);

  if (!shop) return null;

  return (
    <div>
      <PageHeader
        title={tr("modOrders")}
        subtitle={`${orders?.filter((o) => o.status !== "delivered").length ?? 0} pending`}
        back="/more"
        right={
          <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-1 rounded-full bg-brand px-4 font-semibold text-brand-ink shadow-card">
            <Plus className="h-5 w-5" /> {tr("newOrder")}
          </button>
        }
      />

      {orders && orders.length === 0 ? (
        <EmptyState icon="orders" tone="saffron" title="Koi order nahi" />
      ) : (
        <ul className="mx-4 mt-2 space-y-3">
          {(orders ?? []).map((o) => {
            const st = STATUS_STYLE[o.status];
            const packed = o.items.filter((i) => i.packed).length;
            return (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="block rounded-card border border-line bg-card p-4 shadow-card active:scale-[0.99]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-lg font-semibold">{o.customerName ?? "Customer"}</p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${st.cls}`}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current align-middle" aria-hidden />{st.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{o.items.map((i) => i.name).join(", ")}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <span>{timeAgo(o.createdAt)}</span>·<span>{LANGUAGES[o.language]?.nativeName}</span>·
                    <span>
                      {packed}/{o.items.length} packed
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {open && <NewOrderSheet shop={shop} onClose={() => setOpen(false)} />}
    </div>
  );
}
