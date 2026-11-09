"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Mic, Search } from "@/components/common/icons";
import { AnimatedNumber, Rise, Stagger } from "@/components/common/motion";
import { Avatar, BalancePill, EmptyState, PageHeader, useTimeAgo } from "@/components/common/ui";
import { useVoice } from "@/components/voice/VoiceProvider";
import { getDb } from "@/lib/db/schema";
import { formatINR } from "@/lib/domain/money";
import { normalizeName } from "@/lib/domain/match";

export default function KhataPage() {
  const t = useTranslations();
  const timeAgo = useTimeAgo();
  const voice = useVoice();
  const [q, setQ] = useState("");
  const customers = useLiveQuery(async () => (await getDb().customers.toArray()).filter((c) => !c.deletedAt), []);

  const list = useMemo(() => {
    const needle = normalizeName(q);
    return (customers ?? [])
      .filter((c) => !needle || normalizeName(c.name).includes(needle) || c.nameAliases.some((a) => normalizeName(a).includes(needle)))
      .sort((a, b) => b.balance - a.balance || b.updatedAt.localeCompare(a.updatedAt));
  }, [customers, q]);

  const total = useMemo(() => (customers ?? []).reduce((s, c) => s + Math.max(0, c.balance), 0), [customers]);

  return (
    <Stagger>
      <Rise>
        <PageHeader title={t("modKhata")} subtitle={t("customersN", { n: customers?.length ?? 0 })} />
      </Rise>

      <Rise className="mx-4 rounded-card border border-line bg-card p-5 shadow-card">
        <p className="text-sm text-muted">{t("totalOutstanding")}</p>
        <p className="tabular mt-1 text-[36px] font-semibold leading-none tracking-tight text-chili">
          <AnimatedNumber value={total} format={formatINR} />
        </p>
        <p className="mt-2 text-sm text-muted">{t("owingN", { n: list.filter((c) => c.balance > 0).length })}</p>
      </Rise>

      <Rise className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border border-line bg-card px-3 shadow-card">
        <Search className="h-5 w-5 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchCustomers")}
          aria-label={t("searchCustomers")}
          className="min-h-12 flex-1 bg-transparent text-base focus:outline-none"
        />
        <button type="button" onClick={() => voice.open()} aria-label={t("tapToSpeak")} className="rounded-full p-2 text-brand-strong transition-transform active:scale-90">
          <Mic className="h-5 w-5" />
        </button>
      </Rise>

      {customers && list.length === 0 ? (
        <EmptyState
          icon="khata"
          title={q ? t("noMatch") : t("khataEmpty")}
          action={
            <button type="button" onClick={() => voice.open()} className="rounded-full bg-brand px-5 py-3 font-semibold text-brand-ink shadow-card">
              {t("tapToSpeak")}
            </button>
          }
        />
      ) : (
        <ul className="mx-4 mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-card">
          <AnimatePresence initial={false}>
            {list.map((c, i) => (
              <motion.li
                key={c.id}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }}
                exit={{ opacity: 0, height: 0 }}
              >
              <Link href={`/khata/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-black/5">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{timeAgo(c.updatedAt)}</p>
                </div>
                <BalancePill balance={c.balance} />
              </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Stagger>
  );
}
