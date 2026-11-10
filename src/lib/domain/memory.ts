/**
 * Shop memory: one place that derives "what Dost remembers" from the raw tables —
 * customer habits, product movement, a unified timeline, proactive insights, and the
 * short memory lines handed to the LLM so it can resolve "usne", "same as last time", etc.
 * Pure functions only; the UI and the voice hook both read through here.
 */
import type { Customer, IsoUtc, LedgerEntry, LineItem, Order, Paise, Product, Sale, StockEvent, StockSource } from "@/lib/types";
import { formatINR } from "./money";
import { drawsForItems } from "./inventory";
import { isLow } from "./stock";

const DAY = 864e5;
const daysBetween = (fromIso: string, now: Date) => Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY);

export interface MemoryInput {
  customers: Customer[];
  products: Product[];
  ledger: LedgerEntry[];
  sales: Sale[];
  orders: Order[];
  stockEvents: StockEvent[];
}

const liveLedger = (l: LedgerEntry[]) => l.filter((e) => !e.deletedAt);
const liveSales = (s: Sale[]) => s.filter((x) => !x.deletedAt);

export const itemsLine = (items: Pick<LineItem, "name" | "qty" | "unit">[]): string =>
  items.map((i) => `${i.qty ?? ""} ${i.unit === "unknown" ? "" : i.unit} ${i.name}`.replace(/\s+/g, " ").trim()).join(", ");

// ---------------------------------------------------------------- customers

export interface UsualItem {
  productId: string | null;
  name: string;
  count: number;
}

export interface CustomerMemory {
  usualItems: UsualItem[];
  lastItems: LineItem[];
  lastVisitAt: IsoUtc | null;
  lastPaymentAt: IsoUtc | null;
  daysSincePayment: number | null;
  creditCount: number;
  orderIds: string[];
}

/** What this customer usually buys (khata entries + their orders), when they last came, when they last paid. */
export function customerMemory(customerId: string, ledger: LedgerEntry[], orders: Order[], now: Date): CustomerMemory {
  const entries = liveLedger(ledger)
    .filter((e) => e.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const theirOrders = orders.filter((o) => o.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts = new Map<string, UsualItem>();
  const baskets: { at: string; items: LineItem[] }[] = [
    ...entries.filter((e) => e.type === "credit" && e.items.length).map((e) => ({ at: e.createdAt, items: e.items })),
    // Orders already in the khata are counted via their ledger entry.
    ...theirOrders.filter((o) => !o.ledgerEntryId).map((o) => ({ at: o.createdAt, items: o.items as LineItem[] })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  for (const b of baskets) {
    for (const it of b.items) {
      const key = it.productId ?? it.name.toLowerCase();
      const cur = counts.get(key) ?? { productId: it.productId, name: it.name, count: 0 };
      cur.count += 1;
      counts.set(key, cur);
    }
  }
  const lastPayment = entries.find((e) => e.type === "payment");
  const lastCredit = entries.find((e) => e.type === "credit");
  return {
    usualItems: [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5),
    lastItems: baskets[0]?.items ?? [],
    lastVisitAt: entries[0]?.createdAt ?? theirOrders[0]?.createdAt ?? null,
    lastPaymentAt: lastPayment?.createdAt ?? null,
    daysSincePayment: lastPayment ? daysBetween(lastPayment.createdAt, now) : lastCredit ? daysBetween(entries[entries.length - 1].createdAt, now) : null,
    creditCount: entries.filter((e) => e.type === "credit").length,
    orderIds: theirOrders.map((o) => o.id),
  };
}

// ---------------------------------------------------------------- products

export interface ProductMemory {
  soldLast7: number;
  /** Average units sold per day over the last 14 days. */
  perDay: number;
  /** Days until the shelf is empty at the current pace; null when it isn't selling. */
  daysLeft: number | null;
  lastSoldAt: IsoUtc | null;
  topBuyers: { customerId: string; name: string; qty: number }[];
}

interface Draw {
  productId: string;
  qty: number;
  at: string;
  customerId: string | null;
}

/** Every unit that left the shop: udhaar items, cash-sale items, delivered orders not yet in the khata. */
function allDraws(input: Pick<MemoryInput, "ledger" | "sales" | "orders" | "products">, sinceMs: number): Draw[] {
  const out: Draw[] = [];
  const push = (items: LineItem[], at: string, customerId: string | null) => {
    if (new Date(at).getTime() < sinceMs) return;
    for (const d of drawsForItems(items, input.products)) out.push({ ...d, at, customerId });
  };
  for (const e of liveLedger(input.ledger)) if (e.type === "credit") push(e.items, e.createdAt, e.customerId);
  for (const s of liveSales(input.sales)) push(s.items, s.createdAt, null);
  for (const o of input.orders) if (o.status === "delivered" && !o.ledgerEntryId) push(o.items, o.updatedAt, o.customerId);
  return out;
}

export function productMemory(productId: string, input: Pick<MemoryInput, "ledger" | "sales" | "orders" | "products" | "customers">, now: Date): ProductMemory {
  const product = input.products.find((p) => p.id === productId);
  const draws = allDraws(input, now.getTime() - 14 * DAY).filter((d) => d.productId === productId);
  const last7 = draws.filter((d) => new Date(d.at).getTime() >= now.getTime() - 7 * DAY);
  const sum = (ds: Draw[]) => Math.round(ds.reduce((a, d) => a + d.qty, 0) * 1000) / 1000;
  const perDay = Math.round((sum(draws) / 14) * 100) / 100;
  const names = new Map(input.customers.map((c) => [c.id, c.name]));
  const buyers = new Map<string, number>();
  for (const d of draws) if (d.customerId) buyers.set(d.customerId, (buyers.get(d.customerId) ?? 0) + d.qty);
  return {
    soldLast7: sum(last7),
    perDay,
    daysLeft: perDay > 0 && product ? Math.floor(product.stockQty / perDay) : null,
    lastSoldAt: draws.map((d) => d.at).sort().at(-1) ?? null,
    topBuyers: [...buyers.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([customerId, qty]) => ({ customerId, name: names.get(customerId) ?? "?", qty })),
  };
}

// ---------------------------------------------------------------- insights

export type Insight =
  | { kind: "runningOut"; productId: string; name: string; emoji: string; daysLeft: number }
  | { kind: "outOfStock"; productId: string; name: string; emoji: string; buyers: number }
  | { kind: "paymentDue"; customerId: string; name: string; balance: Paise; days: number }
  | { kind: "ordersWaiting"; count: number; orderId: string };

/** The 3–4 things worth the shopkeeper's attention right now, most urgent first. */
export function shopInsights(input: MemoryInput, now: Date, limit = 4): Insight[] {
  const out: Insight[] = [];
  const waiting = input.orders.filter((o) => o.status !== "delivered").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (waiting.length) out.push({ kind: "ordersWaiting", count: waiting.length, orderId: waiting[0].id });

  const draws = allDraws(input, now.getTime() - 14 * DAY);
  const perDay = new Map<string, number>();
  const buyers = new Map<string, Set<string>>();
  for (const d of draws) {
    perDay.set(d.productId, (perDay.get(d.productId) ?? 0) + d.qty / 14);
    if (d.customerId) buyers.set(d.productId, (buyers.get(d.productId) ?? new Set()).add(d.customerId));
  }
  const out0 = input.products
    .filter((p) => p.stockQty === 0 && (perDay.get(p.id) ?? 0) > 0)
    .sort((a, b) => (perDay.get(b.id) ?? 0) - (perDay.get(a.id) ?? 0))
    .slice(0, 1)
    .map((p): Insight => ({ kind: "outOfStock", productId: p.id, name: p.name, emoji: p.emoji, buyers: buyers.get(p.id)?.size ?? 0 }));
  const running = input.products
    .filter((p) => p.stockQty > 0 && (perDay.get(p.id) ?? 0) > 0)
    .map((p) => ({ p, daysLeft: Math.floor(p.stockQty / perDay.get(p.id)!) }))
    .filter((x) => x.daysLeft <= 3 || (isLow(x.p) && x.daysLeft <= 5))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 1)
    .map(({ p, daysLeft }): Insight => ({ kind: "runningOut", productId: p.id, name: p.name, emoji: p.emoji, daysLeft }));
  out.push(...out0, ...running);

  const due = input.customers
    .filter((c) => !c.deletedAt && c.balance > 0)
    .map((c) => ({ c, days: customerMemory(c.id, input.ledger, input.orders, now).daysSincePayment ?? 0 }))
    .filter((x) => x.days >= 7)
    .sort((a, b) => b.c.balance - a.c.balance)
    .slice(0, 2)
    .map(({ c, days }): Insight => ({ kind: "paymentDue", customerId: c.id, name: c.name, balance: c.balance, days }));
  out.push(...due);
  return out.slice(0, limit);
}

// ---------------------------------------------------------------- timeline

export type TimelineKind = "credit" | "payment" | "sale" | "stock" | "order";

export interface TimelineEvent {
  id: string;
  at: IsoUtc;
  kind: TimelineKind;
  /** Customer or product name — the "who/what" of the event. */
  subject: string;
  detail: string;
  amount: Paise | null;
  href: string | null;
  emoji: string | null;
  customerId: string | null;
  productIds: string[];
  transcript: string | null;
  /** Line items (credit / sale / order) for localized rendering. */
  items: LineItem[];
  /** stock events: what caused the movement */
  source?: StockSource;
  delta?: number;
  /** order status for order events */
  status?: Order["status"];
}

export function buildTimeline(input: MemoryInput): TimelineEvent[] {
  const cust = new Map(input.customers.map((c) => [c.id, c]));
  const prod = new Map(input.products.map((p) => [p.id, p]));
  const ids = (items: LineItem[]) => items.map((i) => i.productId).filter((x): x is string => !!x);
  const events: TimelineEvent[] = [
    ...liveLedger(input.ledger).map((e) => ({
      id: e.id,
      at: e.createdAt,
      kind: e.type as TimelineKind,
      subject: cust.get(e.customerId)?.name ?? "?",
      detail: itemsLine(e.items),
      amount: e.amount,
      href: `/khata/${e.customerId}`,
      emoji: null,
      customerId: e.customerId,
      productIds: ids(e.items),
      transcript: e.transcript || null,
      items: e.items,
    })),
    ...liveSales(input.sales).map((s) => ({
      id: s.id,
      at: s.createdAt,
      kind: "sale" as const,
      subject: "",
      detail: itemsLine(s.items),
      amount: s.amount,
      href: "/hisaab",
      emoji: null,
      customerId: null,
      productIds: ids(s.items),
      transcript: s.transcript || null,
      items: s.items,
    })),
    // Movements caused by a khata entry / sale / order are already shown by that event.
    ...input.stockEvents
      .filter((s) => !s.source || s.source === "voice" || s.source === "manual" || s.source === "import")
      .map((s) => {
        const p = prod.get(s.productId);
        return {
          id: s.id,
          at: s.createdAt,
          kind: "stock" as const,
          subject: p?.name ?? "?",
          detail: "",
          amount: null,
          href: p ? `/stock/${p.id}` : null,
          emoji: p?.emoji ?? null,
          customerId: null,
          productIds: p ? [p.id] : [],
          transcript: s.transcript,
          items: [],
          source: s.source,
          delta: s.delta,
        };
      }),
    ...input.orders.map((o) => ({
      id: o.id,
      at: o.createdAt,
      kind: "order" as const,
      subject: o.customerId ? (cust.get(o.customerId)?.name ?? o.customerName ?? "") : (o.customerName ?? ""),
      detail: itemsLine(o.items),
      amount: null,
      href: `/orders/${o.id}`,
      emoji: null,
      customerId: o.customerId,
      productIds: ids(o.items),
      transcript: o.transcript || null,
      items: o.items as LineItem[],
      status: o.status,
    })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------- LLM memory

function ago(iso: string, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

/** Newest-first one-liners of what just happened — lets the LLM resolve pronouns and "same again". */
export function recentForLlm(timeline: TimelineEvent[], now: Date, n = 6): string[] {
  const label: Record<TimelineKind, string> = { credit: "udhaar", payment: "payment", sale: "cash sale", stock: "stock", order: "order" };
  return timeline.slice(0, n).map((e) =>
    [ago(e.at, now), label[e.kind], e.subject || null, e.amount != null ? formatINR(e.amount) : null, e.kind === "stock" && e.delta != null ? `${e.delta > 0 ? "+" : ""}${e.delta}` : null, e.detail || null]
      .filter(Boolean)
      .join(" · "),
  );
}
