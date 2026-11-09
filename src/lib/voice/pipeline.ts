/**
 * Pure-ish helpers for the voice command pipeline, kept out of the hook so they're unit-testable.
 */
import type { LangCode } from "@/lib/i18n/languages";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatINR } from "@/lib/domain/money";
import type { Action } from "@/lib/llm/schema";
import type { Shop } from "@/lib/types";

/** STT language hints: shop language + English (code-mixing), or auto-detect when the shop allows any language. */
export function languageHintsFor(shop: Pick<Shop, "language" | "anyLanguage">): string {
  if (shop.anyLanguage) return "indic-auto";
  return shop.language === "en-IN" ? "en-IN,hi-IN" : `${shop.language},en-IN`;
}

/** Hindi/English → digits + Latin English words; other languages → native script verbatim. */
export function sttFormatFor(lang: LangCode): "transcribe" | "verbatim" {
  return lang === "hi-IN" || lang === "en-IN" ? "transcribe" : "verbatim";
}

/** Replace the {balance} token with the customer's true balance (Timbre reads "₹1,240" correctly). */
export function fillBalance(text: string, balancePaise: number | null | undefined): string {
  if (!text.includes("{balance}")) return text;
  if (balancePaise == null) return text.replace(/\s*\{balance\}\s*/g, " ").trim();
  return text.replaceAll("{balance}", formatINR(Math.abs(balancePaise)));
}

/** Should the confirm card auto-commit after a short countdown? Only for confident, unambiguous, complete actions. */
export function canAutoConfirm(a: Action, problem: string | null): boolean {
  return a.confidence >= 0.85 && !problem && !a.clarify && !(a.customer?.isNew ?? false);
}

export const INTENT_META: Record<Action["intent"], { emoji: string; labelKey: MessageKey; tone: "chili" | "leaf" | "brand" | "saffron" }> = {
  add_credit: { emoji: "📒", labelKey: "intentCredit", tone: "chili" },
  record_payment: { emoji: "💰", labelKey: "intentPayment", tone: "leaf" },
  query_balance: { emoji: "🔎", labelKey: "intentBalance", tone: "saffron" },
  cash_sale: { emoji: "🧾", labelKey: "intentCashSale", tone: "leaf" },
  stock_update: { emoji: "📦", labelKey: "intentStock", tone: "brand" },
  query_stock: { emoji: "📦", labelKey: "intentStockCheck", tone: "saffron" },
  create_order: { emoji: "🛵", labelKey: "intentOrder", tone: "brand" },
  send_reminder: { emoji: "🔔", labelKey: "intentReminder", tone: "saffron" },
  daily_summary: { emoji: "📊", labelKey: "intentSummary", tone: "saffron" },
  unknown: { emoji: "🤔", labelKey: "intentUnknown", tone: "saffron" },
};
