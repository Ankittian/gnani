"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { Bell, Brain, HandCoins, IconTile, Mic, RotateCcw } from "@/components/common/icons";
import { Rise, Stagger, press } from "@/components/common/motion";
import { Avatar, BalancePill, Card, EmptyState, PageHeader, useTimeAgo, useUnit } from "@/components/common/ui";
import { STATUS_STYLE } from "@/components/orders/status";
import { useItemsLine } from "@/components/memory/TimelineRow";
import { VoiceNoteComposer } from "@/components/common/VoiceNoteComposer";
import { useVoice } from "@/components/voice/VoiceProvider";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { customerMemory } from "@/lib/domain/memory";
import { formatINR, paiseToRupees } from "@/lib/domain/money";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { LedgerEntry } from "@/lib/types";

/** "Today" / "Yesterday" / "12 Mar" heading for a ledger day group (labels are localized by the caller). */
function dayHeading(iso: string, today: string, yesterday: string, fmt: (d: Date) => string): string {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return today;
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return yesterday;
  return fmt(d);
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { shop } = useShop();
  const t = useTranslations();
  const format = useFormatter();
  const unitLabel = useUnit();
  const voice = useVoice();
  const timeAgo = useTimeAgo();
  const itemsLine = useItemsLine();
  const [remind, setRemind] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const customer = await db.customers.get(id);
    const entries = (await db.ledgerEntries.where("customerId").equals(id).toArray())
      .filter((e) => !e.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const [orders, products] = await Promise.all([db.orders.toArray(), db.products.toArray()]);
    return { customer: customer ?? null, entries, orders, products };
  }, [id]);

  // Memory: habits + their orders, derived from the same khata entries shown below.
  const mem = useMemo(() => (data?.customer ? customerMemory(id, data.entries, data.orders, new Date()) : null), [data, id]);
  const theirOrders = useMemo(() => (data && mem ? data.orders.filter((o) => mem.orderIds.includes(o.id)).slice(0, 5) : []), [data, mem]);
  const emojiOf = useMemo(() => new Map((data?.products ?? []).map((p) => [p.id, p.emoji])), [data?.products]);

  useEffect(() => {
    if (search.get("remind") === "1" && data?.customer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemind(true);
      router.replace(`/khata/${id}`);
    }
  }, [search, data?.customer, id, router]);

  const groups = useMemo(() => {
    const dayLabel = (iso: string) => dayHeading(iso, t("today"), t("yesterday"), (d) => format.dateTime(d, { day: "numeric", month: "short" }));
    const m = new Map<string, LedgerEntry[]>();
    for (const e of data?.entries ?? []) {
      const k = dayLabel(e.createdAt);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [data?.entries, t, format]);

  if (data === undefined || !shop) return null;
  if (!data.customer) return <EmptyState icon="notFound" tone="muted" title={t("customerNotFound")} />;
  const c = data.customer;

  return (
    <Stagger>
      <Rise>
      <PageHeader title={c.name} subtitle={`${LANGUAGES[c.language].nativeName} · ${t("entriesN", { n: data.entries.length })}`} back="/khata" />
      </Rise>

      <Rise>
      <Card className="mx-4 flex flex-col items-center text-center">
        <Avatar name={c.name} size={72} />
        <p className="mt-3 text-sm text-muted">{c.balance > 0 ? t("owes") : c.balance < 0 ? t("advance") : t("settled")}</p>
        <motion.div key={c.balance} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 18 }} className="mt-1">
          <BalancePill balance={c.balance} size="lg" />
        </motion.div>
        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <motion.button
            type="button"
            {...press}
            onClick={() => setRemind(true)}
            disabled={c.balance <= 0}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-saffron text-base font-semibold text-white shadow-card disabled:opacity-40"
          >
            <Bell className="h-5 w-5" /> {t("remind")}
          </motion.button>
          <motion.button
            type="button"
            {...press}
            onClick={() => voice.open()}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-leaf text-base font-semibold text-white shadow-card"
          >
            <HandCoins className="h-5 w-5" /> {t("paymentReceived")}
          </motion.button>
        </div>
        <p className="mt-3 text-xs text-muted">
          <Mic className="mr-1 inline h-3.5 w-3.5" />
          {t("sayPaid", { name: c.name.split(" ")[0] })}
        </p>
      </Card>
      </Rise>

      {mem && (mem.usualItems.length > 0 || theirOrders.length > 0 || mem.lastVisitAt) && (
        <Rise>
          <Card className="mx-4 mt-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-brand-strong" /> {t("memoryTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted">{mem.lastPaymentAt ? t("lastPaid", { when: timeAgo(mem.lastPaymentAt) }) : t("neverPaid")}</p>
            {mem.usualItems.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("usuallyBuys")}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {mem.usualItems.map((u) => {
                    const chip = (
                      <>
                        <span aria-hidden>{(u.productId && emojiOf.get(u.productId)) || "🛍️"}</span> {u.name}
                        <span className="text-muted">×{u.count}</span>
                      </>
                    );
                    return u.productId ? (
                      <Link key={u.name} href={`/stock/${u.productId}`} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-ink">
                        {chip}
                      </Link>
                    ) : (
                      <span key={u.name} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-ink">
                        {chip}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
            {mem.lastItems.length > 0 && (
              <motion.button
                type="button"
                {...press}
                onClick={() => voice.open({ typed: t("sameAgainPrompt", { name: c.name }) })}
                data-testid="same-again"
                className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-2xl border border-dashed border-brand bg-bg px-3 text-left text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4 shrink-0 text-brand-strong" />
                <span className="min-w-0 flex-1 truncate">
                  {t("sameAsLast")} · <span className="text-muted">{itemsLine(mem.lastItems)}</span>
                </span>
              </motion.button>
            )}
            {theirOrders.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{t("theirOrders")}</p>
                <ul className="mt-1.5 space-y-1.5">
                  {theirOrders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/orders/${o.id}`} className="flex items-center gap-2 rounded-2xl bg-bg px-3 py-2 text-sm">
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status].cls}`}>{t(STATUS_STYLE[o.status].labelKey)}</span>
                        <span className="min-w-0 flex-1 truncate">{itemsLine(o.items)}</span>
                        <span className="shrink-0 text-xs text-muted">{timeAgo(o.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </Rise>
      )}

      {groups.length === 0 ? (
        <EmptyState icon="sales" tone="muted" title={t("noEntries")} />
      ) : (
        <Rise className="mx-4 mt-5 space-y-4">
          {groups.map(([day, entries]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{day}</h2>
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(open === e.id ? null : e.id)}
                      className="w-full rounded-2xl border border-line bg-card px-4 py-3 text-left shadow-card"
                      aria-expanded={open === e.id}
                    >
                      <div className="flex items-center gap-3">
                        <IconTile icon={e.type === "credit" ? "credit" : "collected"} tone={e.type === "credit" ? "chili" : "leaf"} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{e.type === "credit" ? t("ledgerCredit") : t("ledgerPayment")}</p>
                          <p className="truncate text-xs text-muted">
                            {e.items.length ? e.items.map((i) => `${i.qty ?? ""} ${unitLabel(i.unit)} ${i.name}`.replace(/\s+/g, " ").trim()).join(", ") : format.dateTime(new Date(e.createdAt), { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className={`tabular text-lg font-semibold ${e.type === "credit" ? "text-chili" : "text-leaf"}`}>
                          {e.type === "credit" ? "+" : "−"}
                          {formatINR(e.amount)}
                        </span>
                      </div>
                      <AnimatePresence initial={false}>
                        {open === e.id && e.transcript && (
                          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden rounded-xl bg-bg px-3 py-2 text-sm text-muted">
                            “{e.transcript}”
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Rise>
      )}

      <AnimatePresence>
      {remind && (
        <VoiceNoteComposer
          shop={shop}
          kind="reminder"
          title={`${t("remind")} · ${c.name}`}
          defaultLanguage={c.language}
          data={{ customerName: c.name, amountRupees: paiseToRupees(c.balance), lastEntryDate: data.entries[0]?.createdAt.slice(0, 10) ?? null }}
          filename={`reminder-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
          allowMyVoice
          onClose={() => setRemind(false)}
        />
      )}
      </AnimatePresence>
    </Stagger>
  );
}
