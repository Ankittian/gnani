import type { Product, StockOpKind, Supplier } from "@/lib/types";

/** qty null: set → unchanged, add/remove → 1 unit. Never below 0. */
export function applyStockOp(stockQty: number, op: StockOpKind, qty: number | null): number {
  let next: number;
  switch (op) {
    case "out":
      next = 0;
      break;
    case "set":
      next = qty ?? stockQty;
      break;
    case "add":
      next = stockQty + (qty ?? 1);
      break;
    case "remove":
      next = stockQty - (qty ?? 1);
      break;
  }
  return Math.max(0, next);
}

export const isLow = (p: Pick<Product, "stockQty" | "reorderLevel">): boolean => p.stockQty <= p.reorderLevel;

export const reorderQty = (p: Pick<Product, "stockQty" | "reorderLevel">): number =>
  Math.max(1, 2 * p.reorderLevel - p.stockQty);

export interface ReorderGroup {
  supplier: Supplier | null;
  items: { product: Product; qty: number }[];
}

export function groupReorderBySupplier(products: Product[], suppliers: Supplier[]): ReorderGroup[] {
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  const groups = new Map<string, ReorderGroup>();
  for (const product of products) {
    if (!isLow(product)) continue;
    const supplier = (product.supplierId && byId.get(product.supplierId)) || null;
    const key = supplier?.id ?? "__none__";
    if (!groups.has(key)) groups.set(key, { supplier, items: [] });
    groups.get(key)!.items.push({ product, qty: reorderQty(product) });
  }
  return [...groups.values()].sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1));
}
