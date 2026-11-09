"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Plus } from "@/components/common/icons";
import { Rise, RiseItem, Stagger, StaggerList, press } from "@/components/common/motion";
import { EmptyState, PageHeader, useTimeAgo } from "@/components/common/ui";
import { NewOrderSheet } from "@/components/orders/NewOrderSheet";
import { STATUS_STYLE } from "@/components/orders/status";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { LANGUAGES } from "@/lib/i18n/languages";

export default function OrdersPage() {
  const { shop } = useShop();
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const [open, setOpen] = useState(false);
  const orders = useLiveQuery(async () => (await getDb().orders.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);

  if (!shop) return null;

  return (
    <Stagger>
      <Rise>
        <PageHeader
          title={t("modOrders")}
          subtitle={t("pendingN", { n: orders?.filter((o) => o.status !== "delivered").length ?? 0 })}
          back="/more"
          right={
            <motion.button type="button" {...press} onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-1 rounded-full bg-brand px-4 font-semibold text-brand-ink shadow-card">
              <Plus className="h-5 w-5" /> {t("newOrder")}
            </motion.button>
          }
        />
      </Rise>

      {orders && orders.length === 0 ? (
        <EmptyState icon="orders" tone="saffron" title={t("noOrders")} />
      ) : (
        <StaggerList className="mx-4 mt-2 space-y-3">
          {(orders ?? []).map((o) => {
            const st = STATUS_STYLE[o.status];
            const packed = o.items.filter((i) => i.packed).length;
            return (
              <RiseItem key={o.id}>
                <Link href={`/orders/${o.id}`} className="block rounded-card border border-line bg-card p-4 shadow-card transition-transform active:scale-[0.98]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-lg font-semibold">{o.customerName ?? t("customer")}</p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${st.cls}`}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current align-middle" aria-hidden />
                      {t(st.labelKey)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{o.items.map((i) => i.name).join(", ")}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <span>{timeAgo(o.createdAt)}</span>·<span>{LANGUAGES[o.language]?.nativeName}</span>·<span>{t("packedCount", { a: packed, b: o.items.length })}</span>
                  </div>
                </Link>
              </RiseItem>
            );
          })}
        </StaggerList>
      )}

      <AnimatePresence>{open && <NewOrderSheet shop={shop} onClose={() => setOpen(false)} />}</AnimatePresence>
    </Stagger>
  );
}
