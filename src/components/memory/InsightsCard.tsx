"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Brain, IconTile } from "@/components/common/icons";
import { RiseItem, StaggerList } from "@/components/common/motion";
import type { Insight } from "@/lib/domain/memory";
import { formatINR } from "@/lib/domain/money";

/** Proactive memory on the home screen: what Dost noticed across khata, stock and orders. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const t = useTranslations();
  if (insights.length === 0) return null;

  const row = (i: Insight) => {
    switch (i.kind) {
      case "outOfStock":
        return { href: `/stock/${i.productId}`, emoji: i.emoji, text: t("insightOutOfStock", { name: i.name, n: i.buyers }), tone: "text-chili" };
      case "runningOut":
        return { href: `/stock/${i.productId}`, emoji: i.emoji, text: t("insightRunningOut", { name: i.name, n: Math.max(i.daysLeft, 1) }), tone: "text-brand-strong" };
      case "paymentDue":
        return { href: `/khata/${i.customerId}`, emoji: null, text: t("insightPaymentDue", { name: i.name, n: i.days, amount: formatINR(i.balance) }), tone: "text-chili" };
      case "ordersWaiting":
        return { href: i.count === 1 ? `/orders/${i.orderId}` : "/orders", emoji: null, text: t("insightOrders", { n: i.count }), tone: "text-saffron" };
    }
  };
  const icon = (i: Insight) => (i.kind === "paymentDue" ? "credit" : i.kind === "ordersWaiting" ? "orders" : "lowStock");

  return (
    <section className="mt-4 rounded-card border border-line bg-card shadow-card" aria-label={t("memoryTitle")}>
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-brand-strong" /> {t("memoryTitle")}
        </h2>
        <Link href="/memory" className="flex min-h-9 items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
          {t("seeAll")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <StaggerList className="divide-y divide-line">
        {insights.map((i, idx) => {
          const r = row(i);
          return (
            <RiseItem key={`${i.kind}-${idx}`}>
              <Link href={r.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg">
                {r.emoji ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-line/70 text-xl" aria-hidden>
                    {r.emoji}
                  </span>
                ) : (
                  <IconTile icon={icon(i)} tone={i.kind === "ordersWaiting" ? "saffron" : "chili"} size="sm" />
                )}
                <p className={`min-w-0 flex-1 text-sm font-semibold ${r.tone}`}>{r.text}</p>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </RiseItem>
          );
        })}
      </StaggerList>
    </section>
  );
}
