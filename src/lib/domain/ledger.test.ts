import { describe, expect, it } from "vitest";
import type { Action } from "@/lib/llm/schema";
import { applyLedger, entryFromAction, ledgerTypeFor, sumLedger } from "./ledger";

const base: Action = {
  intent: "add_credit",
  confidence: 0.9,
  customer: { id: "c1", name: "Sharma", isNew: false },
  amountPaise: 34000,
  items: [{ name: "Chawal", qty: 2, unit: "kg", productId: null, pricePaise: null }],
  stockOps: [],
  notes: null,
  replyLanguage: "hi-IN",
  replyText: "",
  speakText: "",
  clarify: null,
};

describe("ledger", () => {
  it("credit adds, payment subtracts, can go negative (advance)", () => {
    expect(applyLedger(1000, "credit", 500)).toBe(1500);
    expect(applyLedger(1000, "payment", 1500)).toBe(-500);
  });

  it("maps intents to ledger types", () => {
    expect(ledgerTypeFor("add_credit")).toBe("credit");
    expect(ledgerTypeFor("record_payment")).toBe("payment");
    expect(ledgerTypeFor("cash_sale")).toBeNull();
  });

  it("builds entry from action", () => {
    const e = entryFromAction(base, "c1", { transcript: "t", language: "hi-IN" });
    expect(e).toEqual({
      customerId: "c1",
      type: "credit",
      amount: 34000,
      items: base.items,
      transcript: "t",
      language: "hi-IN",
      deletedAt: null,
    });
  });

  it("throws for non-ledger intents or missing amount", () => {
    expect(() => entryFromAction({ ...base, intent: "cash_sale" }, "c1", { transcript: "", language: "hi-IN" })).toThrow();
    expect(() => entryFromAction({ ...base, amountPaise: null }, "c1", { transcript: "", language: "hi-IN" })).toThrow();
  });

  it("sums ledger ignoring soft-deleted rows", () => {
    expect(
      sumLedger([
        { type: "credit", amount: 1000, deletedAt: null },
        { type: "payment", amount: 300, deletedAt: null },
        { type: "credit", amount: 5000, deletedAt: "2026-01-01T00:00:00Z" },
      ]),
    ).toBe(700);
  });
});
