"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { Settings } from "@/components/common/icons";
import { AnimatedNumber, PressLink, Rise, Stagger, press } from "@/components/common/motion";
import { Avatar, ModuleTile } from "@/components/common/ui";
import { InsightsCard } from "@/components/memory/InsightsCard";
import { TimelineRow } from "@/components/memory/TimelineRow";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { buildTimeline, shopInsights } from "@/lib/domain/memory";
import { formatINR } from "@/lib/domain/money";
import { isLow } from "@/lib/domain/stock";
import { summarizeDay, weekSales } from "@/lib/domain/summary";
import { Sparkline } from "@/components/charts/charts";
import { LANGUAGES } from "@/lib/i18n/languages";

export default function HomePage() {
  const { shop, lang } = useShop();
  const t = useTranslations();

  const data = useLiveQuery(async () => {
    const db = getDb();
    // 14 days: enough history for sales velocity ("runs out in 2 days") and the activity feed.
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const [customers, ledger, sales, products, orders, stockEvents] = await Promise.all([
      db.customers.toArray(),
      db.ledgerEntries.where("createdAt").aboveOrEqual(since).toArray(),
      db.sales.where("createdAt").aboveOrEqual(since).toArray(),
      db.products.toArray(),
      db.orders.toArray(),
      db.stockEvents.where("createdAt").aboveOrEqual(since).toArray(),
    ]);
    return { customers, ledger, sales, products, orders, stockEvents };
  }, []);

  const summary = useMemo(() => (data ? summarizeDay(data, new Date()) : null), [data]);
  const sales7 = useMemo(() => (data ? weekSales(data.sales, new Date()) : []), [data]);
  const lowCount = useMemo(() => data?.products.filter(isLow).length ?? 0, [data]);
  const newOrders = useMemo(() => data?.orders.filter((o) => o.status === "new").length ?? 0, [data]);
  const insights = useMemo(() => (data ? shopInsights(data, new Date(), 3) : []), [data]);
  const activity = useMemo(() => (data ? buildTimeline(data).slice(0, 6) : []), [data]);

  if (!shop) return null;

  return (
    <Stagger className="px-4 pt-5">
      <Rise>
        <header className="flex items-center gap-3">
          <Avatar name={shop.ownerName || shop.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">{shop.name}</p>
            <h1 className="truncate text-xl font-semibold leading-tight tracking-tight">
              {LANGUAGES[lang].greeting}, {shop.ownerName}
            </h1>
          </div>
          <PressLink
            href="/settings"
            {...press}
            aria-label={t("settings")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:text-ink"
          >
            <Settings className="h-5 w-5" />
          </PressLink>
        </header>
      </Rise>

      {/* Hero: today's sales — the one number to notice first */}
      <Rise>
        <section aria-label={t("todayHisaab")} className="mt-5 rounded-[22px] bg-hero p-5 text-hero-ink">
          <p className="text-sm opacity-75">{t("statSales")}</p>
          <p className="tabular mt-1 text-[40px] font-semibold leading-none tracking-tight">
            <AnimatedNumber value={summary?.salesPaise ?? 0} format={formatINR} />
          </p>
          <div className="-mx-1 mt-2">
            <Sparkline data={sales7} label={t("chartSales7")} name={t("statSales")} />
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-current/15 border-t border-current/15 pt-3">
            {[
              { label: t("statCreditGiven"), value: formatINR(summary?.creditGivenPaise ?? 0) },
              { label: t("statCollected"), value: formatINR(summary?.paymentsPaise ?? 0) },
              { label: t("statLowStock"), value: String(lowCount) },
            ].map((s, i) => (
              <div key={s.label} className={i === 0 ? "pr-3" : "px-3"}>
                <p className="truncate text-[11px] opacity-70">{s.label}</p>
                <p className="tabular mt-0.5 truncate text-base font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        </section>
      </Rise>

      {/* Memory: what Dost noticed across khata, stock and orders */}
      <Rise>
        <InsightsCard insights={insights} />
      </Rise>

      {/* Modules */}
      <Rise>
        <section className="mt-4 grid grid-cols-2 gap-3">
          <ModuleTile href="/khata" icon="khata" tone="brand" label={t("modKhata")} />
          <ModuleTile href="/stock" icon="stock" tone="sky" label={t("modStock")} badge={lowCount || undefined} />
          <ModuleTile href="/orders" icon="orders" tone="saffron" label={t("modOrders")} badge={newOrders || undefined} />
          <ModuleTile href="/hisaab" icon="hisaab" tone="leaf" label={t("modHisaab")} />
        </section>
      </Rise>

      {/* Recent activity */}
      <Rise>
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("recent")}</h2>
            <Link href="/memory" className="text-xs font-semibold text-muted hover:text-ink">
              {t("seeAll")}
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="rounded-card border border-line bg-card px-4 py-6 text-center text-sm text-muted">{t("noActivity")}</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
              {activity.map((e) => (
                <TimelineRow key={e.id} e={e} />
              ))}
            </ul>
          )}
        </section>
      </Rise>

      {summary && summary.topOwing.length > 0 && (
        <Rise>
          <section className="mt-6">
            <h2 className="mb-3 text-base font-semibold">{t("topOwing")}</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {summary.topOwing.map((c) => (
                <Link key={c.id} href={`/khata/${c.id}`} className="flex min-w-36 flex-col items-center gap-1 rounded-card border border-line bg-card p-3 shadow-card transition-transform active:scale-95">
                  <Avatar name={c.name} />
                  <span className="max-w-full truncate text-sm font-semibold">{c.name}</span>
                  <span className="tabular font-semibold text-chili">{formatINR(c.balance)}</span>
                </Link>
              ))}
            </div>
          </section>
        </Rise>
      )}
    </Stagger>
  );
}
