"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { Bell, HandCoins, IconTile, Mic } from "@/components/common/icons";
import { Avatar, BalancePill, Card, EmptyState, PageHeader } from "@/components/common/ui";
import { VoiceNoteComposer } from "@/components/common/VoiceNoteComposer";
import { useVoice } from "@/components/voice/VoiceProvider";
import { useShop } from "@/hooks/useShop";
import { getDb } from "@/lib/db/schema";
import { formatINR, paiseToRupees } from "@/lib/domain/money";
import { LANGUAGES } from "@/lib/i18n/languages";
import type { LedgerEntry } from "@/lib/types";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return "Aaj";
  if (d.toDateString() === y.toDateString()) return "Kal";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { shop, tr } = useShop();
  const voice = useVoice();
  const [remind, setRemind] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const db = getDb();
    const customer = await db.customers.get(id);
    const entries = (await db.ledgerEntries.where("customerId").equals(id).toArray())
      .filter((e) => !e.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { customer: customer ?? null, entries };
  }, [id]);

  useEffect(() => {
    if (search.get("remind") === "1" && data?.customer) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemind(true);
      router.replace(`/khata/${id}`);
    }
  }, [search, data?.customer, id, router]);

  const groups = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>();
    for (const e of data?.entries ?? []) {
      const k = dayLabel(e.createdAt);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [data?.entries]);

  if (data === undefined || !shop) return null;
  if (!data.customer) return <EmptyState icon="notFound" tone="muted" title="Customer nahi mila" />;
  const c = data.customer;

  return (
    <div>
      <PageHeader title={c.name} subtitle={`${LANGUAGES[c.language].nativeName} · ${data.entries.length} entries`} back="/khata" />

      <Card className="mx-4 flex flex-col items-center text-center">
        <Avatar name={c.name} size={72} />
        <p className="mt-3 text-sm text-muted">{c.balance > 0 ? tr("owes") : c.balance < 0 ? tr("advance") : tr("settled")}</p>
        <motion.div key={c.balance} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1">
          <BalancePill balance={c.balance} size="lg" />
        </motion.div>
        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRemind(true)}
            disabled={c.balance <= 0}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-saffron text-base font-semibold text-white shadow-card disabled:opacity-40"
          >
            <Bell className="h-5 w-5" /> {tr("remind")}
          </button>
          <button
            type="button"
            onClick={() => voice.open()}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-leaf text-base font-semibold text-white shadow-card"
          >
            <HandCoins className="h-5 w-5" /> {tr("paymentReceived")}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          <Mic className="mr-1 inline h-3.5 w-3.5" />
          Boliye: “{c.name.split(" ")[0]} ne 500 diye”
        </p>
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon="sales" tone="muted" title="Koi entry nahi" />
      ) : (
        <div className="mx-4 mt-5 space-y-4">
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
                          <p className="font-semibold">{e.type === "credit" ? "Udhaar" : "Jama"}</p>
                          <p className="truncate text-xs text-muted">
                            {e.items.length ? e.items.map((i) => `${i.qty ?? ""} ${i.unit !== "unknown" ? i.unit : ""} ${i.name}`.trim()).join(", ") : new Date(e.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className={`tabular text-lg font-semibold ${e.type === "credit" ? "text-chili" : "text-leaf"}`}>
                          {e.type === "credit" ? "+" : "−"}
                          {formatINR(e.amount)}
                        </span>
                      </div>
                      {open === e.id && e.transcript && <p className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm text-muted">“{e.transcript}”</p>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {remind && (
        <VoiceNoteComposer
          shop={shop}
          kind="reminder"
          title={`${tr("remind")} · ${c.name}`}
          defaultLanguage={c.language}
          data={{ customerName: c.name, amountRupees: paiseToRupees(c.balance), lastEntryDate: data.entries[0]?.createdAt.slice(0, 10) ?? null }}
          filename={`reminder-${c.name.replace(/\s+/g, "-").toLowerCase()}`}
          allowMyVoice
          onClose={() => setRemind(false)}
        />
      )}
    </div>
  );
}
