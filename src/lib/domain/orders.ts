import type { LineItem, Order, OrderStatus, Paise, Product } from "@/lib/types";

export function nextStatus(s: OrderStatus): OrderStatus {
  return s === "new" ? "packed" : "delivered";
}

type PriceRef = Pick<Product, "id" | "pricePaise">;

function unitPrice(item: LineItem, products: PriceRef[]): Paise | null {
  if (item.pricePaise != null) return item.pricePaise;
  if (!item.productId) return null;
  return products.find((p) => p.id === item.productId)?.pricePaise ?? null;
}

/** Sum of priced items (qty defaults to 1). null when no item has a known price. */
export function orderTotalPaise(order: Pick<Order, "items">, products: PriceRef[]): Paise | null {
  let total = 0;
  let priced = false;
  for (const item of order.items) {
    const price = unitPrice(item, products);
    if (price == null) continue;
    priced = true;
    total += price * (item.qty ?? 1);
  }
  return priced ? Math.round(total) : null;
}

export function orderToLedgerItems(order: Pick<Order, "items">, products: PriceRef[]): LineItem[] {
  return order.items.map(({ name, qty, unit, productId, ...rest }) => ({
    name,
    qty,
    unit,
    productId,
    pricePaise: unitPrice({ name, qty, unit, productId, pricePaise: rest.pricePaise }, products),
  }));
}
