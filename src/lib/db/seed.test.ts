import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sumLedger } from "@/lib/domain/ledger";
import { isLow } from "@/lib/domain/stock";
import { summarizeDay } from "@/lib/domain/summary";
import { DukaanDB } from "./schema";
import { recordUsage } from "./repo";
import { seedDemo } from "./seed";

let db: DukaanDB;
const NOW = new Date(2026, 10, 8, 18, 30);

beforeEach(() => {
  db = new DukaanDB(`seed-${Math.random().toString(36).slice(2)}`);
});
afterEach(async () => {
  await db.delete();
});

describe("seedDemo", () => {
  it("seeds a consistent shop", async () => {
    await seedDemo(db, "kn-IN", NOW);
    const [shop, customers, products, suppliers, ledger, sales, orders] = await Promise.all([
      db.shop.get("shop"),
      db.customers.toArray(),
      db.products.toArray(),
      db.suppliers.toArray(),
      db.ledgerEntries.toArray(),
      db.sales.toArray(),
      db.orders.toArray(),
    ]);
    expect(shop).toMatchObject({ name: "Shree Ganesh Kirana", language: "kn-IN" });
    expect(customers).toHaveLength(12);
    expect(products).toHaveLength(30);
    expect(suppliers).toHaveLength(4);
    for (const c of customers) {
      expect(c.balance).toBe(sumLedger(ledger.filter((l) => l.customerId === c.id)));
    }
    expect(products.filter(isLow).length).toBeGreaterThanOrEqual(5);
    expect(orders.filter((o) => o.status === "new")).toHaveLength(2);
    const s = summarizeDay({ ledger, sales, orders, products, customers }, NOW);
    expect(s.salesPaise).toBeGreaterThan(0);
    expect(s.creditGivenPaise).toBeGreaterThan(0);
    expect(s.topOwing.length).toBeGreaterThan(0);
    // no timestamps in the future
    for (const row of [...ledger, ...sales]) expect(new Date(row.createdAt).getTime()).toBeLessThanOrEqual(NOW.getTime());
  });

  it("is deterministic and keeps the usage meter", async () => {
    await recordUsage(db, { sttSeconds: 3 });
    await seedDemo(db, "hi-IN", NOW);
    const first = (await db.ledgerEntries.toArray()).map((l) => l.amount);
    await seedDemo(db, "hi-IN", NOW);
    const second = (await db.ledgerEntries.toArray()).map((l) => l.amount);
    expect(second).toEqual(first);
    expect(await db.usage.count()).toBe(1);
  });
});
