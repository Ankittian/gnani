import type { Customer, LedgerEntry, Order, Paise, Product, Sale } from "@/lib/types";
import { isLow } from "./stock";

/** Local calendar day (runtime timezone) → UTC ISO bounds [start, end). */
export function localDayBounds(date: Date): { startUtc: string; endUtc: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

export function localDateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const inRange = (iso: string, startMs: number, endMs: number) => {
  const t = new Date(iso).getTime();
  return t >= startMs && t < endMs;
};

export interface DaySummary {
  salesPaise: Paise;
  creditGivenPaise: Paise;
  paymentsPaise: Paise;
  /** Cash sales + payments collected. */
  netCashInPaise: Paise;
  ordersDelivered: number;
  lowStockCount: number;
  topOwing: { id: string; name: string; balance: Paise }[];
}

export interface SummaryInput {
  ledger: LedgerEntry[];
  sales: Sale[];
  orders: Pick<Order, "status" | "updatedAt">[];
  products: Pick<Product, "stockQty" | "reorderLevel">[];
  customers: Pick<Customer, "id" | "name" | "balance" | "deletedAt">[];
}

export function summarizeDay(input: SummaryInput, day: Date): DaySummary {
  const { startUtc, endUtc } = localDayBounds(day);
  const s = new Date(startUtc).getTime();
  const e = new Date(endUtc).getTime();
  let creditGivenPaise = 0;
  let paymentsPaise = 0;
  for (const l of input.ledger) {
    if (l.deletedAt || !inRange(l.createdAt, s, e)) continue;
    if (l.type === "credit") creditGivenPaise += l.amount;
    else paymentsPaise += l.amount;
  }
  const salesPaise = input.sales
    .filter((x) => !x.deletedAt && inRange(x.createdAt, s, e))
    .reduce((a, x) => a + x.amount, 0);
  const ordersDelivered = input.orders.filter((o) => o.status === "delivered" && inRange(o.updatedAt, s, e)).length;
  const lowStockCount = input.products.filter(isLow).length;
  const topOwing = input.customers
    .filter((c) => !c.deletedAt && c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)
    .map(({ id, name, balance }) => ({ id, name, balance }));
  return {
    salesPaise,
    creditGivenPaise,
    paymentsPaise,
    netCashInPaise: salesPaise + paymentsPaise,
    ordersDelivered,
    lowStockCount,
    topOwing,
  };
}

export interface WeekPoint {
  date: string;
  credit: Paise;
  payment: Paise;
}

export function weekSeries(ledger: LedgerEntry[], endDay: Date): WeekPoint[] {
  const points: WeekPoint[] = [];
  const index = new Map<string, WeekPoint>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - i);
    const pt = { date: localDateKey(d), credit: 0, payment: 0 };
    points.push(pt);
    index.set(pt.date, pt);
  }
  for (const l of ledger) {
    if (l.deletedAt) continue;
    const pt = index.get(localDateKey(new Date(l.createdAt)));
    if (!pt) continue;
    if (l.type === "credit") pt.credit += l.amount;
    else pt.payment += l.amount;
  }
  return points;
}
