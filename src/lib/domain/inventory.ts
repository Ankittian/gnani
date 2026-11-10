/**
 * Selling something takes it off the shelf: turns the line items of an udhaar entry, a cash sale
 * or a delivered order into stock draws (product id + quantity in the product's own unit).
 */
import type { LineItem, Unit } from "@/lib/types";
import { matchProduct } from "./match";

const COUNT_UNITS: ReadonlySet<Unit> = new Set(["packet", "piece", "box", "bottle", "sack"]);

/** Factors to a base unit within one family. */
const FAMILY: Partial<Record<Unit, { family: string; factor: number }>> = {
  kg: { family: "mass", factor: 1000 },
  g: { family: "mass", factor: 1 },
  l: { family: "volume", factor: 1000 },
  ml: { family: "volume", factor: 1 },
  dozen: { family: "count12", factor: 12 },
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Convert `qty` of `from` into `to`. qty null → 1. null when the units can't be compared. */
export function qtyInProductUnit(qty: number | null, from: Unit, to: Unit): number | null {
  const q = qty ?? 1;
  if (from === to || from === "unknown" || to === "unknown") return q;
  if (COUNT_UNITS.has(from) && COUNT_UNITS.has(to)) return q;
  // dozen ↔ piece-like counts
  if (from === "dozen" && COUNT_UNITS.has(to)) return q * 12;
  if (to === "dozen" && COUNT_UNITS.has(from)) return round3(q / 12);
  const a = FAMILY[from];
  const b = FAMILY[to];
  if (!a || !b || a.family !== b.family) return null;
  return round3((q * a.factor) / b.factor);
}

export interface StockDraw {
  productId: string;
  qty: number;
}

type ProductRef = { id: string; name: string; aliases: string[]; unit: Unit };

/** Aggregated draws in first-seen order. Unmatched items and incompatible units are skipped (never guessed). */
export function drawsForItems(items: Pick<LineItem, "name" | "qty" | "unit" | "productId">[], products: ProductRef[]): StockDraw[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const totals = new Map<string, number>();
  for (const it of items) {
    const product = (it.productId && byId.get(it.productId)) || byId.get(matchProduct(it.name, products).best?.id ?? "");
    if (!product) continue;
    const qty = qtyInProductUnit(it.qty, it.unit, product.unit);
    if (qty == null || qty <= 0) continue;
    totals.set(product.id, round3((totals.get(product.id) ?? 0) + qty));
  }
  return [...totals.entries()].map(([productId, qty]) => ({ productId, qty }));
}
