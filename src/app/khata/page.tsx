"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Mic, Search } from "lucide-react";
import { Avatar, BalancePill, EmptyState, PageHeader, timeAgo } from "@/components/common/ui";
import { useVoice } from "@/components/voice/VoiceProvider";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { formatINR } from "@/lib/domain/money";
import { normalizeName } from "@/lib/domain/match";

export default function KhataPage() {
  const { tr } = useShop();
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
    <div>
      <PageHeader title={`📒 ${tr("modKhata")}`} subtitle={`${customers?.length ?? 0} customers`} />

      <div className="mx-4 rounded-card bg-gradient-to-br from-chili to-[#b91c1c] p-4 text-white shadow-sticker">
        <p className="text-sm font-semibold opacity-90">{tr("totalOutstanding")}</p>
        <p className="tabular text-4xl font-extrabold">{formatINR(total)}</p>
        <p className="mt-1 text-sm opacity-90">{list.filter((c) => c.balance > 0).length} logon ka udhaar baaki</p>
      </div>

      <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border border-line bg-card px-3 shadow-sticker">
        <Search className="h-5 w-5 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Naam dhoondhein…"
          aria-label="Search customers"
          className="min-h-12 flex-1 bg-transparent text-base focus:outline-none"
        />
        <button type="button" onClick={() => voice.open()} aria-label={tr("tapToSpeak")} className="rounded-full p-2 text-brand-strong">
          <Mic className="h-5 w-5" />
        </button>
      </div>

      {customers && list.length === 0 ? (
        <EmptyState
          emoji="📒"
          title={q ? "Koi nahi mila" : "Khata khaali hai"}
          hint="Bolke shuru karein: “Sharma ji ne 200 udhaar liya”"
          action={
            <button type="button" onClick={() => voice.open()} className="rounded-full bg-brand px-5 py-3 font-extrabold text-brand-ink shadow-sticker">
              🎙️ {tr("tapToSpeak")}
            </button>
          }
        />
      ) : (
        <ul className="mx-4 mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-card shadow-sticker">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/khata/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-black/5">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{c.name}</p>
                  <p className="text-xs font-semibold text-muted">{timeAgo(c.updatedAt)}</p>
                </div>
                <BalancePill balance={c.balance} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
