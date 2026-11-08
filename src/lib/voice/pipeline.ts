/**
 * Pure-ish helpers for the voice command pipeline, kept out of the hook so they're unit-testable.
 */
import type { LangCode } from "@/lib/i18n/languages";
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

export const INTENT_META: Record<Action["intent"], { emoji: string; label: string; tone: "chili" | "leaf" | "brand" | "indigo" }> = {
  add_credit: { emoji: "📒", label: "Udhaar", tone: "chili" },
  record_payment: { emoji: "💰", label: "Payment", tone: "leaf" },
  query_balance: { emoji: "🔎", label: "Balance", tone: "indigo" },
  cash_sale: { emoji: "🧾", label: "Cash sale", tone: "leaf" },
  stock_update: { emoji: "📦", label: "Stock", tone: "brand" },
  query_stock: { emoji: "📦", label: "Stock check", tone: "indigo" },
  create_order: { emoji: "🛵", label: "Order", tone: "brand" },
  send_reminder: { emoji: "🔔", label: "Reminder", tone: "indigo" },
  daily_summary: { emoji: "📊", label: "Hisaab", tone: "indigo" },
  unknown: { emoji: "🤔", label: "Hmm", tone: "indigo" },
};
