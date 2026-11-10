"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Brain, Check, Minus, Plus, UserPlus, X } from "@/components/common/icons";
import type { Action } from "@/lib/llm/schema";
import { getDb } from "@/lib/db/schema";
import { drawsForItems } from "@/lib/domain/inventory";
import { matchCustomer } from "@/lib/domain/match";
import { customerMemory } from "@/lib/domain/memory";
import { formatINR } from "@/lib/domain/money";
import { useUnit } from "@/components/common/ui";
import { INTENT_META } from "@/lib/voice/pipeline";

/**
 * What confirming will do elsewhere in the shop — khata balance before → after, shelf stock before → after —
 * plus the customer's usual items as one-tap additions. Read-only preview; the repo does the real work.
 */
function ConnectedEffects({ action, onChange }: { action: Action; onChange: (a: Action) => void }) {
  const t = useTranslations();
  const unitLabel = useUnit();
  const base = useLiveQuery(async () => {
    const db = getDb();
    const [products, customers] = await Promise.all([db.products.toArray(), db.customers.toArray()]);
    return { products, customers: customers.filter((c) => !c.deletedAt) };
  }, []);
  const customer = useMemo(() => {
    if (!base || !action.customer) return null;
    const byId = action.customer.id ? base.customers.find((c) => c.id === action.customer!.id) : undefined;
    return byId ?? base.customers.find((c) => c.id === matchCustomer(action.customer!.name, base.customers).best?.id) ?? null;
  }, [base, action.customer]);
  const history = useLiveQuery(
    async () => {
      if (!customer) return null;
      const db = getDb();
      const [ledger, orders] = await Promise.all([db.ledgerEntries.where("customerId").equals(customer.id).toArray(), db.orders.toArray()]);
      return customerMemory(customer.id, ledger, orders, new Date());
    },
    [customer?.id],
  );
  if (!base) return null;

  const sells = action.intent === "add_credit" || action.intent === "cash_sale";
  const byId = new Map(base.products.map((p) => [p.id, p]));
  const draws = sells ? drawsForItems(action.items, base.products) : [];
  const amount = action.amountPaise ?? 0;
  const balanceTo =
    customer && amount > 0 ? (action.intent === "add_credit" ? customer.balance + amount : action.intent === "record_payment" ? customer.balance - amount : null) : null;
  const inBasket = new Set(action.items.map((i) => i.productId).filter(Boolean));
  const suggestions =
    action.intent === "add_credit" && history ? history.usualItems.filter((u) => u.productId && !inBasket.has(u.productId) && byId.has(u.productId)).slice(0, 4) : [];

  const addUsual = (productId: string) => {
    const p = byId.get(productId);
    if (!p) return;
    onChange({
      ...action,
      items: [...action.items, { name: p.name, qty: 1, unit: p.unit, productId: p.id, pricePaise: p.pricePaise }],
      amountPaise: p.pricePaise != null ? (action.amountPaise ?? 0) + p.pricePaise : action.amountPaise,
    });
  };
  const fmt = (n: number) => Math.round(n * 100) / 100;

  if (balanceTo == null && draws.length === 0 && suggestions.length === 0) return null;
  return (
    <div className="mb-3 space-y-2 rounded-2xl bg-bg px-3 py-2.5 text-sm" data-testid="connected-effects">
      {balanceTo != null && customer && (
        <p className="flex items-center justify-between gap-2">
          <span className="text-muted">{t("khataAfter")}</span>
          <span className="tabular font-semibold">
            {formatINR(customer.balance)} → <span className={balanceTo > 0 ? "text-chili" : "text-leaf"}>{formatINR(balanceTo)}</span>
          </span>
        </p>
      )}
      {draws.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("stockAfter")}</p>
          <ul className="mt-1 space-y-0.5">
            {draws.map((d) => {
              const p = byId.get(d.productId)!;
              const after = Math.max(0, fmt(p.stockQty - d.qty));
              return (
                <li key={d.productId} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {p.emoji} {p.name}
                  </span>
                  <span className={`tabular shrink-0 font-semibold ${after <= p.reorderLevel ? "text-chili" : ""}`}>
                    {fmt(p.stockQty)} → {after} {unitLabel(p.unit)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {suggestions.length > 0 && (
        <div>
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
            <Brain className="h-3.5 w-3.5" /> {t("tapToAdd")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestions.map((u) => (
              <button
                key={u.productId}
                type="button"
                onClick={() => addUsual(u.productId!)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-brand px-3 text-sm font-semibold text-brand-ink"
              >
                <Plus className="h-3.5 w-3.5" /> {byId.get(u.productId!)?.emoji} {u.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionCardProps {
  action: Action;
  problem: string | null;
  autoConfirm: boolean;
  busy: boolean;
  confirmLabel: string;
  cancelLabel: string;
  onChange: (a: Action) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE: Record<string, string> = {
  chili: "bg-chili-soft text-chili",
  leaf: "bg-leaf-soft text-leaf",
  brand: "bg-brand-soft text-brand-strong",
  saffron: "bg-saffron-soft text-saffron",
};

const AUTO_SECONDS = 3;

export function ActionCard({ action, problem, autoConfirm, busy, confirmLabel, cancelLabel, onChange, onConfirm, onCancel }: ActionCardProps) {
  const t = useTranslations();
  const unitLabel = useUnit();
  const meta = INTENT_META[action.intent];
  const [countdown, setCountdown] = useState(0);
  const showAmount = ["add_credit", "record_payment", "cash_sale"].includes(action.intent);

  // Visible countdown; any edit (autoConfirm → false) or busy state cancels it.
  useEffect(() => {
    if (!autoConfirm || busy) return;
    let left = AUTO_SECONDS;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(left);
    const id = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(id);
        onConfirm();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConfirm, busy]);

  const setAmount = (rupees: string) => {
    const n = Number(rupees.replace(/[^\d.]/g, ""));
    onChange({ ...action, amountPaise: Number.isFinite(n) && rupees !== "" ? Math.round(n * 100) : null });
  };

  return (
    <motion.div
      initial={{ y: 24, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      className="rounded-card border border-line bg-card p-4 shadow-card"
      data-testid="action-card"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${TONE[meta.tone]}`}>
          <span aria-hidden>{meta.emoji}</span>
          {t(meta.labelKey)}
        </span>
        {action.confidence < 0.6 && <span className="text-xs text-muted">{t("pleaseCheck")}</span>}
      </div>

      {action.customer && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="ac-customer">
            {t("customer")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="ac-customer"
              value={action.customer.name}
              onChange={(e) => onChange({ ...action, customer: { ...action.customer!, name: e.target.value } })}
              className="min-h-12 flex-1 rounded-2xl border border-line bg-bg px-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {action.customer.isNew && (
              <span className="inline-flex items-center gap-1 rounded-full bg-saffron-soft px-2.5 py-1 text-xs font-semibold text-saffron">
                <UserPlus className="h-3.5 w-3.5" /> {t("newCustomer")}
              </span>
            )}
          </div>
        </div>
      )}

      {showAmount && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="ac-amount">
            {t("amount")}
          </label>
          <div
            className={`flex items-center rounded-2xl border bg-bg px-3 ${problem === "missing_amount" ? "border-chili ring-2 ring-chili/30" : "border-line"}`}
          >
            <span className="text-3xl font-semibold text-muted">₹</span>
            <input
              id="ac-amount"
              inputMode="decimal"
              value={action.amountPaise != null ? String(action.amountPaise / 100) : ""}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              className="tabular min-h-14 w-full bg-transparent px-2 text-4xl font-semibold focus:outline-none"
            />
          </div>
          {problem === "missing_amount" && <p className="mt-1 text-sm font-semibold text-chili">{t("askAmount")}</p>}
        </div>
      )}

      {action.items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {action.items.map((it, i) => (
            <span key={`${it.name}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-semibold text-brand-ink">
              {it.qty != null ? `${it.qty} ${unitLabel(it.unit)} ` : ""}
              {it.name}
              {it.pricePaise != null && <span className="text-muted"> · {formatINR(it.pricePaise)}</span>}
              <button
                type="button"
                aria-label={t("removeItem", { name: it.name })}
                className="ml-1 rounded-full p-1 hover:bg-brand-soft"
                onClick={() => onChange({ ...action, items: action.items.filter((_, j) => j !== i) })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {action.intent === "stock_update" && (
        <ul className="mb-3 space-y-2">
          {action.stockOps.map((op, i) => (
            <li key={`${op.name}-${i}`} className="flex items-center justify-between gap-2 rounded-2xl bg-bg px-3 py-2">
              <span className="font-semibold">{op.name}</span>
              {op.op === "out" ? (
                <span className="rounded-full bg-chili-soft px-3 py-1 text-sm font-semibold text-chili">{t("soldOut")}</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="text-xs text-muted">{op.op === "add" ? t("opAdd") : op.op === "remove" ? t("opRemove") : t("opSet")}</span>
                  <button
                    type="button"
                    aria-label={t("decrease")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
                    onClick={() => onChange({ ...action, stockOps: action.stockOps.map((o, j) => (j === i ? { ...o, qty: Math.max(0, (o.qty ?? 0) - 1) } : o)) })}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="tabular w-10 text-center text-lg font-semibold">{op.qty ?? 0}</span>
                  <button
                    type="button"
                    aria-label={t("increase")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
                    onClick={() => onChange({ ...action, stockOps: action.stockOps.map((o, j) => (j === i ? { ...o, qty: (o.qty ?? 0) + 1 } : o)) })}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-muted">{unitLabel(op.unit)}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConnectedEffects action={action} onChange={onChange} />

      {action.notes && <p className="mb-3 rounded-2xl bg-bg px-3 py-2 text-sm text-muted">{action.notes}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-lg font-semibold text-muted active:scale-[0.98]"
        >
          <X className="h-5 w-5" /> {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !!problem}
          className="relative flex min-h-14 flex-[2] items-center justify-center gap-2 overflow-hidden rounded-2xl bg-leaf text-lg font-semibold text-white shadow-card active:scale-[0.98] disabled:opacity-50"
        >
          {autoConfirm && countdown > 0 && (
            <motion.span
              className="absolute inset-y-0 left-0 bg-white/25"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: AUTO_SECONDS, ease: "linear" }}
            />
          )}
          <Check className="relative h-6 w-6" strokeWidth={3} />
          <span className="relative">
            {confirmLabel}
            {autoConfirm && countdown > 0 ? ` (${countdown})` : ""}
          </span>
        </button>
      </div>
    </motion.div>
  );
}
