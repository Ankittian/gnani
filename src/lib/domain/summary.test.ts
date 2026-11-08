import { describe, expect, it } from "vitest";
import type { Customer, LedgerEntry, Order, Product, Sale } from "@/lib/types";
import { localDateKey, localDayBounds, summarizeDay, weekSales, weekSeries } from "./summary";

// Local-time constructors so expectations hold in any runtime TZ.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();

const led = (createdAt: string, type: "credit" | "payment", amount: number, deletedAt: string | null = null): LedgerEntry => ({
  id: createdAt + type + amount,
  customerId: "c",
  type,
  amount,
  items: [],
  transcript: "",
  language: "hi-IN",
  createdAt,
  deletedAt,
});

describe("localDayBounds", () => {
  it("spans exactly the local calendar day", () => {
    const { startUtc, endUtc } = localDayBounds(new Date(2026, 10, 8, 15));
    expect(new Date(startUtc).getTime()).toBe(new Date(2026, 10, 8).getTime());
    expect(new Date(endUtc).getTime()).toBe(new Date(2026, 10, 9).getTime());
  });
});

describe("summarizeDay", () => {
  it("aggregates today only and ignores soft-deleted rows", () => {
    const ledger = [
      led(at(8, 0, 1), "credit", 1000),
      led(at(8, 23, 59), "payment", 400),
      led(at(7, 23, 59), "credit", 99999), // yesterday (local)
      led(at(8, 10), "credit", 5000, at(8, 11)), // undone
    ];
    const sales: Sale[] = [{ id: "s", items: [], amount: 2500, transcript: "", createdAt: at(8, 12), deletedAt: null }];
    const orders = [
      { status: "delivered", updatedAt: at(8, 9) },
      { status: "new", updatedAt: at(8, 9) },
    ] as Order[];
    const products = [
      { stockQty: 0, reorderLevel: 2 },
      { stockQty: 10, reorderLevel: 2 },
    ] as Product[];
    const customers = [
      { id: "a", name: "A", balance: 500, deletedAt: null },
      { id: "b", name: "B", balance: 9000, deletedAt: null },
      { id: "c", name: "C", balance: 0, deletedAt: null },
      { id: "d", name: "D", balance: 100, deletedAt: null },
      { id: "e", name: "E", balance: 50, deletedAt: null },
      { id: "f", name: "F", balance: 99999, deletedAt: at(1, 1) },
    ] as Customer[];

    const s = summarizeDay({ ledger, sales, orders, products, customers }, new Date(2026, 10, 8, 18));
    expect(s.salesPaise).toBe(2500);
    expect(s.creditGivenPaise).toBe(1000);
    expect(s.paymentsPaise).toBe(400);
    expect(s.netCashInPaise).toBe(2900);
    expect(s.ordersDelivered).toBe(1);
    expect(s.lowStockCount).toBe(1);
    expect(s.topOwing.map((c) => c.id)).toEqual(["b", "a", "d"]);
  });
});

describe("weekSeries", () => {
  it("returns 7 local days oldest → newest", () => {
    const ledger = [led(at(8, 9), "credit", 100), led(at(2, 9), "payment", 50), led(at(1, 9), "credit", 999)];
    const series = weekSeries(ledger, new Date(2026, 10, 8, 20));
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe("2026-11-02");
    expect(series[6].date).toBe("2026-11-08");
    expect(series[0].payment).toBe(50);
    expect(series[6].credit).toBe(100);
    expect(series.reduce((a, d) => a + d.credit, 0)).toBe(100);
  });

  it("localDateKey pads", () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("weekSales", () => {
  const sale = (createdAt: string, amount: number, deletedAt: string | null = null): Sale => ({ id: createdAt + amount, items: [], amount, transcript: "", createdAt, deletedAt });

  it("sums cash sales per local day, oldest → newest, ignoring deleted and out-of-range", () => {
    const sales = [sale(at(8, 9), 100), sale(at(8, 18), 50), sale(at(5, 9), 70), sale(at(6, 9), 999, at(6, 10)), sale(at(1, 9), 999)];
    const series = weekSales(sales, new Date(2026, 10, 8, 20));
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe("2026-11-02");
    expect(series[6]).toEqual({ date: "2026-11-08", amount: 150 });
    expect(series[3].amount).toBe(70);
    expect(series.reduce((a, d) => a + d.amount, 0)).toBe(220);
  });
});
