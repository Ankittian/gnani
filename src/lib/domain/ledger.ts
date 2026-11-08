import type { Action, Intent } from "@/lib/llm/schema";
import type { LangCode } from "@/lib/i18n/languages";
import type { LedgerEntry, LedgerType, Paise } from "@/lib/types";

export function applyLedger(balance: Paise, type: LedgerType, amount: Paise): Paise {
  return type === "credit" ? balance + amount : balance - amount;
}

export function ledgerTypeFor(intent: Intent): LedgerType | null {
  if (intent === "add_credit") return "credit";
  if (intent === "record_payment") return "payment";
  return null;
}

export function entryFromAction(
  action: Action,
  customerId: string,
  meta: { transcript: string; language: LangCode },
): Omit<LedgerEntry, "id" | "createdAt"> {
  const type = ledgerTypeFor(action.intent);
  if (!type) throw new Error(`not_a_ledger_intent:${action.intent}`);
  if (action.amountPaise == null || action.amountPaise <= 0) throw new Error("missing_amount");
  return {
    customerId,
    type,
    amount: action.amountPaise,
    items: action.items,
    transcript: meta.transcript,
    language: meta.language,
    deletedAt: null,
  };
}

export function sumLedger(entries: Pick<LedgerEntry, "type" | "amount" | "deletedAt">[]): Paise {
  return entries.reduce((bal, e) => (e.deletedAt ? bal : applyLedger(bal, e.type, e.amount)), 0);
}
