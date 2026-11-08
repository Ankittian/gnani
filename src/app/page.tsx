"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "motion/react";
import { IconTile, Settings, type IconKey } from "@/components/common/icons";
import { DostOrb } from "@/components/orb/DostOrb";
import { Avatar, ModuleTile, StatChip, timeAgo } from "@/components/common/ui";
import { useVoice } from "@/components/voice/VoiceProvider";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { formatINR } from "@/lib/domain/money";
import { isLow } from "@/lib/domain/stock";
import { localDayBounds, summarizeDay } from "@/lib/domain/summary";
import { LANGUAGES } from "@/lib/i18n/languages";

const HINTS: Record<string, string[]> = {
  "hi-IN": ["Sharma ji ne 340 ka saamaan udhaar liya", "Fatima ji ne 500 diye", "Maggi khatam ho gaya", "Suresh ka kitna baaki hai?", "Aaj ka hisaab sunao"],
  "en-IN": ["Joseph paid 500 rupees", "Sharma ji took 2 kg rice on credit, 140 rupees", "Parle-G only 2 packets left", "How much does Murugan owe?"],
};

function greetingKey(): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  const h = new Date().getHours();
  return h < 12 ? "greetingMorning" : h < 17 ? "greetingAfternoon" : "greetingEvening";
}

interface Activity {
  id: string;
  at: string;
  icon: IconKey;
  emoji?: string;
  title: string;
  amount?: string;
  tone?: "chili" | "leaf" | "muted";
}

export default function HomePage() {
  const { shop, lang, tr } = useShop();
  const voice = useVoice();
  const [hintIdx, setHintIdx] = useState(0);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const { startUtc } = localDayBounds(new Date());
    const [customers, ledger, sales, products, orders, stockEvents] = await Promise.all([
      db.customers.toArray(),
      db.ledgerEntries.where("createdAt").aboveOrEqual(new Date(Date.now() - 7 * 864e5).toISOString()).toArray(),
      db.sales.where("createdAt").aboveOrEqual(startUtc).toArray(),
      db.products.toArray(),
      db.orders.toArray(),
      db.stockEvents.orderBy("createdAt").reverse().limit(5).toArray(),
    ]);
    return { customers, ledger, sales, products, orders, stockEvents };
  }, []);

  const summary = useMemo(() => (data ? summarizeDay(data, new Date()) : null), [data]);
  const lowCount = useMemo(() => data?.products.filter(isLow).length ?? 0, [data]);
  const newOrders = useMemo(() => data?.orders.filter((o) => o.status === "new").length ?? 0, [data]);

  const activity = useMemo<Activity[]>(() => {
    if (!data) return [];
    const byId = new Map(data.customers.map((c) => [c.id, c.name]));
    const prod = new Map(data.products.map((p) => [p.id, p]));
    const items: Activity[] = [
      ...data.ledger
        .filter((e) => !e.deletedAt)
        .map((e) => ({
          id: e.id,
          at: e.createdAt,
          icon: (e.type === "credit" ? "credit" : "collected") as IconKey,
          title: `${byId.get(e.customerId) ?? "?"} · ${e.type === "credit" ? "udhaar" : "jama"}`,
          amount: formatINR(e.amount),
          tone: (e.type === "credit" ? "chili" : "leaf") as Activity["tone"],
        })),
      ...data.sales.filter((s) => !s.deletedAt).map((s) => ({ id: s.id, at: s.createdAt, icon: "sales" as IconKey, title: "Cash sale", amount: formatINR(s.amount), tone: "leaf" as const })),
      ...data.stockEvents.map((s) => {
        const p = prod.get(s.productId);
        return { id: s.id, at: s.createdAt, icon: "stock" as IconKey, emoji: p?.emoji, title: `${p?.name ?? "Stock"} · ${s.op === "out" ? "khatam" : s.op === "add" ? `+${s.delta}` : `${p?.stockQty ?? ""} ${p?.unit ?? ""}`}`, tone: "muted" as const };
      }),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [data]);

  const hints = HINTS[lang] ?? [LANGUAGES[lang].sampleCommand, ...HINTS["hi-IN"]];
  useEffect(() => {
    const id = setInterval(() => setHintIdx((i) => (i + 1) % hints.length), 3500);
    return () => clearInterval(id);
  }, [hints.length]);

  if (!shop) return null;

  return (
    <div className="px-4 pt-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-muted">{shop.name}</p>
          <h1 className="text-3xl font-extrabold leading-tight">
            {LANGUAGES[lang].greeting}, {shop.ownerName} 👋
          </h1>
          <p className="text-sm font-semibold text-muted">{tr(greetingKey())}</p>
        </div>
        <Link href="/settings" aria-label={tr("settings")} className="rounded-full p-2 text-muted transition-colors hover:bg-brand-soft hover:text-brand-strong">
          <Settings className="h-6 w-6" />
        </Link>
      </header>

      {/* Dost + rotating try-saying hint */}
      <button
        type="button"
        onClick={() => voice.open()}
        className="mt-4 flex w-full items-center gap-3 rounded-card border border-brand/20 bg-gradient-to-br from-brand-soft via-card to-card p-3 text-left shadow-sticker transition-transform active:scale-[0.99]"
      >
        <DostOrb state="idle" size={84} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-strong">{tr("trySaying")}</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={hintIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-lg font-bold leading-snug"
            >
              “{hints[hintIdx % hints.length]}”
            </motion.p>
          </AnimatePresence>
          <p className="mt-0.5 text-sm font-semibold text-muted">🎙️ {tr("tapToSpeak")}</p>
        </div>
      </button>

      {/* Today stats */}
      <section className="mt-4 grid grid-cols-2 gap-3" aria-label={tr("todayHisaab")}>
        <StatChip icon="sales" label={tr("statSales")} value={formatINR(summary?.salesPaise ?? 0)} tone="leaf" />
        <StatChip icon="credit" label={tr("statCreditGiven")} value={formatINR(summary?.creditGivenPaise ?? 0)} tone="chili" />
        <StatChip icon="collected" label={tr("statCollected")} value={formatINR(summary?.paymentsPaise ?? 0)} tone="leaf" />
        <StatChip icon="lowStock" label={tr("statLowStock")} value={String(lowCount)} tone="brand" />
      </section>

      {/* Modules */}
      <section className="mt-4 grid grid-cols-2 gap-3">
        <ModuleTile href="/khata" icon="khata" tone="brand" label={tr("modKhata")} sub={lang !== "en-IN" ? "Khata" : null} />
        <ModuleTile href="/stock" icon="stock" tone="leaf" label={tr("modStock")} sub={lang !== "en-IN" ? "Stock" : null} badge={lowCount || undefined} />
        <ModuleTile href="/orders" icon="orders" tone="indigo" label={tr("modOrders")} sub={lang !== "en-IN" ? "Orders" : null} badge={newOrders || undefined} />
        <ModuleTile href="/hisaab" icon="hisaab" tone="chili" label={tr("modHisaab")} sub={lang !== "en-IN" ? "Hisaab" : null} />
      </section>

      {/* Recent activity */}
      <section className="mt-6">
        <h2 className="mb-2 text-lg font-extrabold">{tr("recent")}</h2>
        {activity.length === 0 ? (
          <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-muted">Abhi kuch nahi — mic dabake shuru karein 🎙️</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-sticker">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                {a.emoji ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-line/50 text-2xl" aria-hidden>
                    {a.emoji}
                  </span>
                ) : (
                  <IconTile icon={a.icon} tone={a.tone ?? "muted"} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.title}</p>
                  <p className="text-xs font-semibold text-muted">{timeAgo(a.at)}</p>
                </div>
                {a.amount && <span className={`tabular font-extrabold ${a.tone === "chili" ? "text-chili" : "text-leaf"}`}>{a.amount}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary && summary.topOwing.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">Sabse zyada baaki</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {summary.topOwing.map((c) => (
              <Link key={c.id} href={`/khata/${c.id}`} className="flex min-w-36 flex-col items-center gap-1 rounded-card border border-line bg-card p-3 shadow-sticker">
                <Avatar name={c.name} />
                <span className="max-w-full truncate text-sm font-bold">{c.name}</span>
                <span className="tabular font-extrabold text-chili">{formatINR(c.balance)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
