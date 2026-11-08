"use client";

import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { Check } from "@/components/common/icons";
import { toast } from "sonner";
import { Card, EmptyState, PageHeader } from "@/components/common/ui";
import { STATUS_STYLE } from "@/app/orders/page";
import { useShop } from "@/hooks/useShop";
import { addLedgerFromOrder, setOrderStatus, toggleOrderItem } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { formatINR } from "@/lib/domain/money";
import { nextStatus, orderTotalPaise } from "@/lib/domain/orders";
import { LANGUAGES } from "@/lib/i18n/languages";
import { celebrate, playTing } from "@/lib/feedback";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { shop, tr } = useShop();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [order, products] = await Promise.all([db.orders.get(id), db.products.toArray()]);
    return { order: order ?? null, products };
  }, [id]);

  if (data === undefined || !shop) return null;
  if (!data.order) return <EmptyState icon="notFound" tone="muted" title="Order nahi mila" />;
  const o = data.order;
  const total = orderTotalPaise(o, data.products);
  const allPacked = o.items.length > 0 && o.items.every((i) => i.packed);
  const st = STATUS_STYLE[o.status];
  const next = nextStatus(o.status);
  const productById = new Map(data.products.map((p) => [p.id, p]));

  const advance = async () => {
    if (!next) return;
    await setOrderStatus(getDb(), o.id, next);
    playTing(shop.soundsOn);
    if (next === "delivered") void celebrate();
  };

  return (
    <div>
      <PageHeader title={o.customerName ?? "Customer order"} subtitle={`${LANGUAGES[o.language]?.nativeName} · ${Math.round(o.audioDurationSec)}s voice note`} back="/orders" />

      <div className="mx-4 flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 font-bold ${st.cls}`}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current align-middle" aria-hidden />{st.label}
        </span>
        {total != null && <span className="tabular text-2xl font-extrabold">{formatINR(total)}</span>}
      </div>

      <Card className="mx-4 mt-3">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">Packing list</h2>
        <ul className="space-y-2">
          {o.items.map((it, i) => {
            const p = it.productId ? productById.get(it.productId) : undefined;
            return (
              <li key={`${it.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => void toggleOrderItem(getDb(), o.id, i)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors ${it.packed ? "border-leaf/40 bg-leaf-soft" : "border-line bg-bg"}`}
                  aria-pressed={it.packed}
                >
                  <motion.span
                    animate={{ scale: it.packed ? [1, 1.3, 1] : 1 }}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${it.packed ? "border-leaf bg-leaf text-white" : "border-line bg-card"}`}
                  >
                    {it.packed && <Check className="h-5 w-5" strokeWidth={3} />}
                  </motion.span>
                  <span className="text-2xl" aria-hidden>
                    {p?.emoji ?? "🛍️"}
                  </span>
                  <span className={`flex-1 font-bold ${it.packed ? "text-muted line-through" : ""}`}>{it.name}</span>
                  <span className="tabular font-extrabold">
                    {it.qty ?? ""} <span className="text-sm text-muted">{it.unit !== "unknown" ? it.unit : ""}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {o.notes && <p className="mt-3 rounded-2xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink">📝 {o.notes}</p>}
      </Card>

      <div className="mx-4 mt-4 grid gap-2">
        {next && (
          <button
            type="button"
            onClick={() => void advance()}
            disabled={next === "packed" && !allPacked}
            className="min-h-14 rounded-2xl bg-leaf text-lg font-extrabold text-white shadow-sticker disabled:opacity-50"
          >
            {next === "packed" ? `📦 ${tr("packed")}` : `✅ ${tr("delivered")}`}
          </button>
        )}
        {o.status === "delivered" && o.customerId == null && total != null && <p className="text-center text-xs text-muted">Customer khate mein nahi hai — naam bolke udhaar likhein.</p>}
        {o.status === "delivered" && total != null && (
          <button
            type="button"
            onClick={async () => {
              try {
                await addLedgerFromOrder(getDb(), o.id);
                toast.success("Khate mein jod diya 📒");
              } catch {
                toast.error("Khate mein nahi jod paaye");
              }
            }}
            className="min-h-14 rounded-2xl border border-line bg-card text-lg font-bold"
          >
            📒 {tr("addToKhata")} · {formatINR(total)}
          </button>
        )}
      </div>

      <details className="mx-4 mt-4 rounded-2xl bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-bold text-muted">🎙️ Original voice note text</summary>
        <p className="mt-2 leading-relaxed">“{o.transcript}”</p>
      </details>
    </div>
  );
}
