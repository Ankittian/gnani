import { describe, expect, it } from "vitest";
import type { Customer, LedgerEntry, LineItem, Order, Product, Sale } from "@/lib/types";
import { buildTimeline, customerMemory, productMemory, recentForLlm, shopInsights, type MemoryInput } from "./memory";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const daysAgo = (d: number, h = 0) => new Date(NOW.getTime() - d * 864e5 - h * 36e5).toISOString();

const product = (id: string, name: string, stockQty: number, reorderLevel = 2, unit: Product["unit"] = "packet"): Product => ({
  id, name, aliases: [], unit, stockQty, reorderLevel, pricePaise: 1000, supplierId: null, emoji: "📦", createdAt: daysAgo(30), updatedAt: daysAgo(30),
});
const customer = (id: string, name: string, balance: number): Customer => ({
  id, name, nameAliases: [], language: "hi-IN", balance, createdAt: daysAgo(30), updatedAt: daysAgo(1), deletedAt: null,
});
const li = (productId: string, name: string, qty: number): LineItem => ({ name, qty, unit: "packet", productId, pricePaise: 1000 });
let n = 0;
const credit = (customerId: string, d: number, items: LineItem[], amount = 1000): LedgerEntry => ({
  id: `l${++n}`, customerId, type: "credit", amount, items, transcript: "", language: "hi-IN", createdAt: daysAgo(d), deletedAt: null,
});
const payment = (customerId: string, d: number, amount: number): LedgerEntry => ({ ...credit(customerId, d, [], amount), type: "payment" });
const sale = (d: number, items: LineItem[]): Sale => ({ id: `s${++n}`, items, amount: 1000, transcript: "", createdAt: daysAgo(d), deletedAt: null });

const products = [product("maggi", "Maggi", 3, 5), product("rice", "Chawal", 50, 10, "kg"), product("salt", "Salt", 0)];
const customers = [customer("ramesh", "Ramesh", 50000), customer("priya", "Priya", 0)];
const ledger = [
  credit("ramesh", 20, [li("maggi", "Maggi", 2)]),
  credit("ramesh", 3, [li("maggi", "Maggi", 2), li("salt", "Salt", 1)]),
  credit("ramesh", 1, [li("maggi", "Maggi", 4), li("rice", "Chawal", 1)]),
  credit("priya", 2, [li("rice", "Chawal", 2)]),
  payment("priya", 1, 2000),
];
const sales = [sale(1, [li("maggi", "Maggi", 6)]), sale(2, [li("salt", "Salt", 2)])];
const input: MemoryInput = { customers, products, ledger, sales, orders: [], stockEvents: [] };

describe("customerMemory", () => {
  it("ranks usual items, keeps the last basket, and counts days since last payment", () => {
    const m = customerMemory("ramesh", ledger, [], NOW);
    expect(m.usualItems[0]).toMatchObject({ productId: "maggi", count: 3 });
    expect(m.lastItems.map((i) => i.productId)).toEqual(["maggi", "rice"]);
    expect(m.lastPaymentAt).toBeNull();
    expect(m.daysSincePayment).toBe(20); // never paid → since first udhaar
    expect(customerMemory("priya", ledger, [], NOW).daysSincePayment).toBe(1);
  });
  it("includes the customer's orders that aren't in the khata yet", () => {
    const order: Order = {
      id: "o1", customerName: "Priya", customerId: "priya", items: [{ ...li("salt", "Salt", 1), packed: false }], notes: null,
      status: "new", transcript: "", language: "hi-IN", audioDurationSec: 5, createdAt: daysAgo(0, 1), updatedAt: daysAgo(0, 1),
    };
    const m = customerMemory("priya", ledger, [order], NOW);
    expect(m.orderIds).toEqual(["o1"]);
    expect(m.lastItems[0].productId).toBe("salt");
  });
});

describe("productMemory", () => {
  it("sums udhaar + cash sales into velocity, days left and top buyers", () => {
    const m = productMemory("maggi", input, NOW);
    expect(m.soldLast7).toBe(12); // 2 + 4 credit + 6 sale (20-day-old entry excluded)
    expect(m.perDay).toBeCloseTo(12 / 14, 2);
    expect(m.daysLeft).toBe(3);
    expect(m.topBuyers).toEqual([{ customerId: "ramesh", name: "Ramesh", qty: 6 }]);
  });
  it("has no days-left when the product doesn't move", () => {
    expect(productMemory("nothing", input, NOW).daysLeft).toBeNull();
  });
});

describe("shopInsights", () => {
  it("flags sold-out sellers, products about to run out, and long-unpaid balances", () => {
    const kinds = shopInsights(input, NOW).map((i) => i.kind);
    expect(kinds).toEqual(["outOfStock", "runningOut", "paymentDue"]);
    const due = shopInsights(input, NOW).find((i) => i.kind === "paymentDue");
    expect(due).toMatchObject({ customerId: "ramesh", days: 20 });
  });
});

describe("timeline + LLM memory", () => {
  it("merges every table newest-first with links, and renders short memory lines", () => {
    const tl = buildTimeline(input);
    expect(tl[0].at >= tl[1].at).toBe(true);
    expect(tl.find((e) => e.kind === "credit")?.href).toMatch(/^\/khata\//);
    const lines = recentForLlm(tl, NOW, 2);
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).toMatch(/1 d ago · (udhaar|payment|cash sale)/);
  });
  it("hides stock movements that were caused by a sale (the sale already shows)", () => {
    const tl = buildTimeline({
      ...input,
      stockEvents: [
        { id: "e1", productId: "maggi", op: "remove", delta: -2, transcript: null, createdAt: daysAgo(0), source: "ledger", refId: "l1" },
        { id: "e2", productId: "maggi", op: "add", delta: 10, transcript: null, createdAt: daysAgo(0), source: "voice" },
      ],
    });
    expect(tl.filter((e) => e.kind === "stock").map((e) => e.id)).toEqual(["e2"]);
  });
});
