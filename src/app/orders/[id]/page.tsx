"use client";

import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check } from "@/components/common/icons";
import { toast } from "sonner";
import { Rise, Stagger, press } from "@/components/common/motion";
import { Card, EmptyState, PageHeader, useUnit } from "@/components/common/ui";
import { STATUS_STYLE } from "@/components/orders/status";
import { useShop } from "@/hooks/useShop";
import { addLedgerFromOrder, setOrderStatus, toggleOrderItem } from "@/lib/db/repo";
import { getDb } from "@/lib/db/schema";
import { formatINR } from "@/lib/domain/money";
import { nextStatus, orderTotalPaise } from "@/lib/domain/orders";
import { LANGUAGES } from "@/lib/i18n/languages";
import { celebrate, playTing } from "@/lib/feedback";

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { shop } = useShop();
  const t = useTranslations();
  const unitLabel = useUnit();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [order, products] = await Promise.all([db.orders.get(id), db.products.toArray()]);
    return { order: order ?? null, products };
  }, [id]);

  if (data === undefined || !shop) return null;
  if (!data.order) return <EmptyState icon="notFound" tone="muted" title={t("orderNotFound")} />;
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
    <Stagger>
      <Rise>
        <PageHeader
          title={o.customerName ?? t("customerOrder")}
          subtitle={`${LANGUAGES[o.language]?.nativeName} · ${t("voiceNoteSecs", { n: Math.round(o.audioDurationSec) })}`}
          back="/orders"
        />
      </Rise>

      <Rise className="mx-4 flex items-center justify-between">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={o.status}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className={`rounded-full px-3 py-1 font-semibold ${st.cls}`}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current align-middle" aria-hidden />
            {t(st.labelKey)}
          </motion.span>
        </AnimatePresence>
        {total != null && <span className="tabular text-2xl font-semibold">{formatINR(total)}</span>}
      </Rise>

      <Rise>
        <Card className="mx-4 mt-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{t("packingList")}</h2>
          <ul className="space-y-2">
            {o.items.map((it, i) => {
              const p = it.productId ? productById.get(it.productId) : undefined;
              return (
                <li key={`${it.name}-${i}`}>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
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
                    <span className={`flex-1 font-semibold ${it.packed ? "text-muted line-through" : ""}`}>{it.name}</span>
                    <span className="tabular font-semibold">
                      {it.qty ?? ""} <span className="text-sm text-muted">{unitLabel(it.unit)}</span>
                    </span>
                  </motion.button>
                </li>
              );
            })}
          </ul>
          {o.notes && <p className="mt-3 rounded-2xl bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-ink">{o.notes}</p>}
        </Card>
      </Rise>

      <Rise className="mx-4 mt-4 grid gap-2">
        {next && (
          <motion.button
            type="button"
            {...press}
            onClick={() => void advance()}
            disabled={next === "packed" && !allPacked}
            className="min-h-14 rounded-2xl bg-leaf text-lg font-semibold text-white shadow-card disabled:opacity-50"
          >
            {next === "packed" ? t("packed") : t("delivered")}
          </motion.button>
        )}
        {o.status === "delivered" && o.customerId == null && total != null && <p className="text-center text-xs text-muted">{t("notInKhata")}</p>}
        {o.status === "delivered" && total != null && (
          <motion.button
            type="button"
            {...press}
            onClick={async () => {
              try {
                await addLedgerFromOrder(getDb(), o.id);
                toast.success(t("addedToKhata"));
              } catch {
                toast.error(t("addKhataFailed"));
              }
            }}
            className="min-h-14 rounded-2xl border border-line bg-card text-lg font-semibold"
          >
            {t("addToKhata")} · {formatINR(total)}
          </motion.button>
        )}
      </Rise>

      <Rise>
        <details className="mx-4 mt-4 rounded-2xl bg-card px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-muted">{t("originalNote")}</summary>
          <p className="mt-2 leading-relaxed">“{o.transcript}”</p>
        </details>
      </Rise>
    </Stagger>
  );
}
