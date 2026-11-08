/**
 * Action contract between /api/understand and the client.
 *
 * Two shapes:
 *  - LlmAction: what Gemini returns (rupees, flat object — Gemini handles flat schemas
 *    more reliably than discriminated unions).
 *  - Action: what the app consumes (integer paise). `toAction()` converts.
 *
 * `speakText` may contain the literal token `{balance}`; the client replaces it with the
 * customer's true balance formatted as "₹1,240" after committing (Timbre reads ₹ digits
 * correctly in all tested languages), so spoken balances never come from the LLM.
 */
import { z } from "zod";
import { LANG_CODES } from "@/lib/i18n/languages";
import { UNITS } from "@/lib/types";

export const INTENTS = [
  "add_credit",
  "record_payment",
  "query_balance",
  "cash_sale",
  "stock_update",
  "query_stock",
  "create_order",
  "send_reminder",
  "daily_summary",
  "unknown",
] as const;
export type Intent = (typeof INTENTS)[number];

const LangCodeZ = z.enum(LANG_CODES);
const UnitZ = z.enum(UNITS);

const LlmItemZ = z.object({
  name: z.string().min(1),
  qty: z.number().nullable(),
  unit: UnitZ,
  productId: z.string().nullable(),
  priceRupees: z.number().nullable(),
});

const StockOpZ = z.object({
  name: z.string().min(1),
  productId: z.string().nullable(),
  op: z.enum(["set", "add", "remove", "out"]),
  qty: z.number().nullable(),
  unit: UnitZ,
});

const CustomerRefZ = z.object({
  id: z.string().nullable(),
  name: z.string().min(1),
  isNew: z.boolean(),
});

const ClarifyZ = z.object({
  question: z.string().min(1),
  options: z.array(
    z.object({
      label: z.string().min(1),
      customerId: z.string().nullable(),
    }),
  ),
});

export const LlmActionZ = z.object({
  intent: z.enum(INTENTS),
  confidence: z.number().min(0).max(1),
  customer: CustomerRefZ.nullable(),
  amountRupees: z.number().nullable(),
  items: z.array(LlmItemZ),
  stockOps: z.array(StockOpZ),
  notes: z.string().nullable(),
  replyLanguage: LangCodeZ,
  replyText: z.string(),
  speakText: z.string(),
  clarify: ClarifyZ.nullable(),
});
export type LlmAction = z.infer<typeof LlmActionZ>;

export const ActionItemZ = LlmItemZ.omit({ priceRupees: true }).extend({ pricePaise: z.number().int().nullable() });

export const ActionZ = LlmActionZ.omit({ amountRupees: true, items: true }).extend({
  amountPaise: z.number().int().nullable(),
  items: z.array(ActionItemZ),
});
export type Action = z.infer<typeof ActionZ>;
export type ActionItem = z.infer<typeof ActionItemZ>;
export type StockOp = z.infer<typeof StockOpZ>;
export type Clarify = z.infer<typeof ClarifyZ>;

const toPaise = (rupees: number | null): number | null => (rupees == null ? null : Math.round(rupees * 100));

export function toAction(a: LlmAction): Action {
  const { amountRupees, items, ...rest } = a;
  return {
    ...rest,
    amountPaise: toPaise(amountRupees),
    items: items.map(({ priceRupees, ...it }) => ({ ...it, pricePaise: toPaise(priceRupees) })),
  };
}

/** Intents that change data and therefore need a confirm card. */
export const MUTATING_INTENTS: ReadonlySet<Intent> = new Set([
  "add_credit",
  "record_payment",
  "cash_sale",
  "stock_update",
  "create_order",
]);

/** Business validation beyond the schema; returns a reason or null. */
export function actionProblem(a: Action): string | null {
  switch (a.intent) {
    case "add_credit":
    case "record_payment":
      if (!a.customer) return "missing_customer";
      if (a.amountPaise == null || a.amountPaise <= 0) return "missing_amount";
      return null;
    case "query_balance":
    case "send_reminder":
      return a.customer ? null : "missing_customer";
    case "cash_sale":
      return a.amountPaise != null && a.amountPaise > 0 ? null : "missing_amount";
    case "stock_update":
      return a.stockOps.length > 0 ? null : "missing_stock_ops";
    case "create_order":
      return a.items.length > 0 ? null : "missing_items";
    default:
      return null;
  }
}

// ---- Compose (messages in a target language) ----

export const COMPOSE_KINDS = ["reminder", "supplierOrder", "dailySummary"] as const;
export type ComposeKind = (typeof COMPOSE_KINDS)[number];

export const ComposeResultZ = z.object({
  displayText: z.string().min(1),
  glossEn: z.string(),
  speakText: z.string().min(1),
});
export type ComposeResult = z.infer<typeof ComposeResultZ>;

/** JSON Schemas handed to Gemini `responseJsonSchema`. */
export const llmActionJsonSchema = z.toJSONSchema(LlmActionZ, { target: "draft-2020-12" });
export const composeJsonSchema = z.toJSONSchema(ComposeResultZ, { target: "draft-2020-12" });
