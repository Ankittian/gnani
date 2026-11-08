import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Action } from "@/lib/llm/schema";
import { DukaanDB, nowIso } from "./schema";
import {
  addLedgerFromOrder,
  adjustStock,
  buildShopContext,
  clearAll,
  commitAction,
  getShop,
  recordUsage,
  saveShop,
  setOrderStatus,
  toggleOrderItem,
  undoCommit,
} from "./repo";

let db: DukaanDB;

const action = (over: Partial<Action>): Action => ({
  intent: "add_credit",
  confidence: 0.95,
  customer: null,
  amountPaise: null,
  items: [],
  stockOps: [],
  notes: null,
  replyLanguage: "hi-IN",
  replyText: "",
  speakText: "",
  clarify: null,
  ...over,
});
const meta = { transcript: "test", language: "hi-IN" as const };

async function addCustomer(id: string, name: string, aliases: string[] = [], balance = 0) {
  const now = nowIso();
  await db.customers.add({ id, name, nameAliases: aliases, language: "hi-IN", balance, createdAt: now, updatedAt: now, deletedAt: null });
}
async function addProduct(id: string, name: string, stockQty: number, pricePaise: number | null = null, aliases: string[] = []) {
  const now = nowIso();
  await db.products.add({ id, name, aliases, unit: "packet", stockQty, reorderLevel: 2, pricePaise, supplierId: null, emoji: "📦", createdAt: now, updatedAt: now });
}

beforeEach(() => {
  db = new DukaanDB(`test-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await db.delete();
});

describe("shop", () => {
  it("creates with defaults then patches", async () => {
    expect(await getShop(db)).toBeUndefined();
    const s = await saveShop(db, { name: "Ganesh Kirana", language: "kn-IN" });
    expect(s).toMatchObject({ id: "shop", name: "Ganesh Kirana", language: "kn-IN", assistantVoice: "Lakshmi", anyLanguage: false, soundsOn: true, cloneEmbedding: null });
    const s2 = await saveShop(db, { ownerName: "Ramesh" });
    expect(s2.name).toBe("Ganesh Kirana");
    expect(s2.ownerName).toBe("Ramesh");
    expect(s2.createdAt).toBe(s.createdAt);
  });
});

describe("commitAction — ledger", () => {
  it("credit, then payment, then undo restores balance", async () => {
    await addCustomer("c1", "Ramesh Sharma", ["Sharma ji"]);
    const r1 = await commitAction(db, action({ customer: { id: "c1", name: "Sharma ji", isNew: false }, amountPaise: 34000 }), meta);
    expect(r1).toMatchObject({ kind: "ledger", customerId: "c1", newBalance: 34000 });
    const r2 = await commitAction(db, action({ intent: "record_payment", customer: { id: null, name: "Ramesh Sharma", isNew: false }, amountPaise: 10000 }), meta);
    expect(r2.newBalance).toBe(24000);
    expect(r2.previous.balance).toBe(34000);
    await undoCommit(db, r2);
    expect((await db.customers.get("c1"))!.balance).toBe(34000);
    expect((await db.ledgerEntries.get(r2.createdIds.ledger!))!.deletedAt).not.toBeNull();
  });

  it("creates a new customer when unmatched, and undo removes them", async () => {
    const r = await commitAction(db, action({ customer: { id: null, name: "Gurpreet Singh", isNew: true }, amountPaise: 5000 }), { transcript: "x", language: "pa-IN" });
    expect(r.createdIds.customer).toBeDefined();
    const c = await db.customers.get(r.customerId!);
    expect(c).toMatchObject({ name: "Gurpreet Singh", language: "pa-IN", balance: 5000 });
    await undoCommit(db, r);
    expect(await db.customers.get(r.customerId!)).toBeUndefined();
  });

  it("throws ambiguous_customer for two Sharmas", async () => {
    await addCustomer("c1", "Ramesh Sharma");
    await addCustomer("c2", "Suresh Sharma");
    await expect(
      commitAction(db, action({ customer: { id: null, name: "Sharma", isNew: false }, amountPaise: 1000 }), meta),
    ).rejects.toThrow("ambiguous_customer");
  });

  it("rejects invalid actions", async () => {
    await expect(commitAction(db, action({ customer: { id: null, name: "X", isNew: true } }), meta)).rejects.toThrow("invalid_action:missing_amount");
  });

  it("double concurrent commit creates two entries without crashing", async () => {
    await addCustomer("c1", "Joseph");
    const a = action({ customer: { id: "c1", name: "Joseph", isNew: false }, amountPaise: 1000 });
    await Promise.all([commitAction(db, a, meta), commitAction(db, a, meta)]);
    expect(await db.ledgerEntries.count()).toBe(2);
    expect((await db.customers.get("c1"))!.balance).toBe(2000);
  });

  it("query_balance resolves without mutating", async () => {
    await addCustomer("c1", "Murugan", [], 7000);
    const r = await commitAction(db, action({ intent: "query_balance", customer: { id: null, name: "Murugan", isNew: false } }), meta);
    expect(r).toMatchObject({ kind: "none", customerId: "c1", newBalance: 7000 });
  });
});

describe("commitAction — stock, sale, order", () => {
  it("stock ops clamp at 0, create unknown products, and undo restores", async () => {
    await addProduct("p1", "Maggi", 5, 1400, ["मैगी"]);
    const r = await commitAction(
      db,
      action({
        intent: "stock_update",
        stockOps: [
          { name: "मैगी", productId: null, op: "remove", qty: 10, unit: "packet" },
          { name: "Dragon Fruit", productId: null, op: "add", qty: 3, unit: "piece" },
        ],
      }),
      meta,
    );
    expect(r.kind).toBe("stock");
    expect((await db.products.get("p1"))!.stockQty).toBe(0);
    expect(r.createdIds.products).toHaveLength(1);
    expect((await db.products.get(r.createdIds.products![0]))!.stockQty).toBe(3);
    await undoCommit(db, r);
    expect((await db.products.get("p1"))!.stockQty).toBe(5);
    expect(await db.products.count()).toBe(1);
    expect(await db.stockEvents.count()).toBe(0);
  });

  it("cash sale records and undo soft-deletes", async () => {
    const r = await commitAction(db, action({ intent: "cash_sale", amountPaise: 4000 }), meta);
    expect((await db.sales.get(r.createdIds.sale!))!.amount).toBe(4000);
    await undoCommit(db, r);
    expect((await db.sales.get(r.createdIds.sale!))!.deletedAt).not.toBeNull();
  });

  it("order: create, toggle, status, add to khata", async () => {
    await addProduct("p1", "Maggi", 5, 1400);
    await addCustomer("c1", "Joseph");
    const r = await commitAction(
      db,
      action({
        intent: "create_order",
        customer: { id: null, name: "Joseph", isNew: false },
        items: [{ name: "maggi", qty: 3, unit: "packet", productId: null, pricePaise: null }],
        notes: "after 6",
      }),
      { ...meta, audioDurationSec: 12 },
    );
    const id = r.createdIds.order!;
    let o = (await db.orders.get(id))!;
    expect(o).toMatchObject({ status: "new", customerId: "c1", audioDurationSec: 12, notes: "after 6" });
    expect(o.items[0]).toMatchObject({ productId: "p1", packed: false });
    await toggleOrderItem(db, id, 0);
    await setOrderStatus(db, id, "delivered");
    o = (await db.orders.get(id))!;
    expect(o.items[0].packed).toBe(true);
    expect(o.status).toBe("delivered");
    const l = await addLedgerFromOrder(db, id);
    expect(l).toMatchObject({ customerId: "c1", newBalance: 4200 });
  });
});

describe("misc", () => {
  it("adjustStock clamps and logs", async () => {
    await addProduct("p1", "Maggi", 1);
    expect(await adjustStock(db, "p1", -3)).toBe(0);
    expect(await adjustStock(db, "p1", 2)).toBe(2);
    expect(await db.stockEvents.count()).toBe(2);
    expect(await adjustStock(db, "nope", 1)).toBeNull();
  });

  it("recordUsage increments today's row", async () => {
    await recordUsage(db, { sttSeconds: 5, llmCalls: 1 });
    const u = await recordUsage(db, { sttSeconds: 2.5, ttsChars: 40 });
    expect(u).toMatchObject({ sttSeconds: 7.5, ttsChars: 40, llmCalls: 1, cloneCalls: 0 });
  });

  it("buildShopContext excludes deleted customers; clearAll empties", async () => {
    await addCustomer("c1", "A");
    await addCustomer("c2", "B");
    await db.customers.update("c2", { deletedAt: nowIso() });
    const ctx = await buildShopContext(db);
    expect(ctx.customers.map((c) => c.id)).toEqual(["c1"]);
    await clearAll(db);
    expect(await db.customers.count()).toBe(0);
  });
});
