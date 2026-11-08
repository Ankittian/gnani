"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Minus, Plus, UserPlus, X } from "@/components/common/icons";
import type { Action } from "@/lib/llm/schema";
import { formatINR } from "@/lib/domain/money";
import { INTENT_META } from "@/lib/voice/pipeline";

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
  brand: "bg-brand-soft text-brand-ink",
  indigo: "bg-indigo-soft text-indigo",
};

const AUTO_SECONDS = 3;

export function ActionCard({ action, problem, autoConfirm, busy, confirmLabel, cancelLabel, onChange, onConfirm, onCancel }: ActionCardProps) {
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
      className="rounded-card border border-line bg-card p-4 shadow-sticker"
      data-testid="action-card"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${TONE[meta.tone]}`}>
          <span aria-hidden>{meta.emoji}</span>
          {meta.label}
        </span>
        {action.confidence < 0.6 && <span className="text-xs font-semibold text-muted">please check ✋</span>}
      </div>

      {action.customer && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="ac-customer">
            Customer
          </label>
          <div className="flex items-center gap-2">
            <input
              id="ac-customer"
              value={action.customer.name}
              onChange={(e) => onChange({ ...action, customer: { ...action.customer!, name: e.target.value } })}
              className="min-h-12 flex-1 rounded-2xl border border-line bg-bg px-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {action.customer.isNew && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-soft px-2.5 py-1 text-xs font-bold text-indigo">
                <UserPlus className="h-3.5 w-3.5" /> New
              </span>
            )}
          </div>
        </div>
      )}

      {showAmount && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" htmlFor="ac-amount">
            Amount
          </label>
          <div
            className={`flex items-center rounded-2xl border bg-bg px-3 ${problem === "missing_amount" ? "border-chili ring-2 ring-chili/30" : "border-line"}`}
          >
            <span className="text-3xl font-extrabold text-muted">₹</span>
            <input
              id="ac-amount"
              inputMode="decimal"
              value={action.amountPaise != null ? String(action.amountPaise / 100) : ""}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              className="tabular min-h-14 w-full bg-transparent px-2 text-4xl font-extrabold focus:outline-none"
            />
          </div>
          {problem === "missing_amount" && <p className="mt-1 text-sm font-semibold text-chili">Kitne rupaye? Amount daal dein.</p>}
        </div>
      )}

      {action.items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {action.items.map((it, i) => (
            <span key={`${it.name}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-semibold text-brand-ink">
              {it.qty != null ? `${it.qty} ${it.unit !== "unknown" ? it.unit : ""} ` : ""}
              {it.name}
              {it.pricePaise != null && <span className="text-muted"> · {formatINR(it.pricePaise)}</span>}
              <button
                type="button"
                aria-label={`Remove ${it.name}`}
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
              <span className="font-bold">{op.name}</span>
              {op.op === "out" ? (
                <span className="rounded-full bg-chili-soft px-3 py-1 text-sm font-bold text-chili">khatam</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-muted">{op.op === "add" ? "+ add" : op.op === "remove" ? "− remove" : "= set"}</span>
                  <button
                    type="button"
                    aria-label="decrease"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
                    onClick={() => onChange({ ...action, stockOps: action.stockOps.map((o, j) => (j === i ? { ...o, qty: Math.max(0, (o.qty ?? 0) - 1) } : o)) })}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="tabular w-10 text-center text-lg font-extrabold">{op.qty ?? 0}</span>
                  <button
                    type="button"
                    aria-label="increase"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-card"
                    onClick={() => onChange({ ...action, stockOps: action.stockOps.map((o, j) => (j === i ? { ...o, qty: (o.qty ?? 0) + 1 } : o)) })}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-muted">{op.unit !== "unknown" ? op.unit : ""}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {action.notes && <p className="mb-3 rounded-2xl bg-bg px-3 py-2 text-sm text-muted">📝 {action.notes}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-card text-lg font-bold text-muted active:scale-[0.98]"
        >
          <X className="h-5 w-5" /> {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !!problem}
          className="relative flex min-h-14 flex-[2] items-center justify-center gap-2 overflow-hidden rounded-2xl bg-leaf text-lg font-extrabold text-white shadow-sticker active:scale-[0.98] disabled:opacity-50"
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
