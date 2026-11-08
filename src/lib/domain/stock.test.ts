import { describe, expect, it } from "vitest";
import type { Product, Supplier } from "@/lib/types";
import { applyStockOp, groupReorderBySupplier, isLow, reorderQty } from "./stock";

const p = (id: string, stockQty: number, reorderLevel: number, supplierId: string | null): Product => ({
  id,
  name: id,
  aliases: [],
  unit: "packet",
  stockQty,
  reorderLevel,
  pricePaise: null,
  supplierId,
  emoji: "📦",
  createdAt: "",
  updatedAt: "",
});

describe("stock", () => {
  it("applies ops with clamping", () => {
    expect(applyStockOp(5, "set", 2)).toBe(2);
    expect(applyStockOp(5, "add", 3)).toBe(8);
    expect(applyStockOp(5, "remove", 9)).toBe(0);
    expect(applyStockOp(5, "out", null)).toBe(0);
    expect(applyStockOp(5, "set", null)).toBe(5);
    expect(applyStockOp(5, "add", null)).toBe(6);
    expect(applyStockOp(5, "remove", null)).toBe(4);
  });

  it("low stock and reorder qty", () => {
    expect(isLow(p("a", 2, 2, null))).toBe(true);
    expect(isLow(p("a", 3, 2, null))).toBe(false);
    expect(reorderQty(p("a", 1, 5, null))).toBe(9);
    expect(reorderQty(p("a", 20, 5, null))).toBe(1);
  });

  it("groups low products by supplier, unknown supplier last", () => {
    const suppliers: Supplier[] = [{ id: "s1", name: "Manjunath", language: "kn-IN", createdAt: "" }];
    const groups = groupReorderBySupplier(
      [p("a", 0, 3, "s1"), p("b", 10, 3, "s1"), p("c", 1, 2, null), p("d", 1, 2, "s1")],
      suppliers,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].supplier?.id).toBe("s1");
    expect(groups[0].items.map((i) => i.product.id)).toEqual(["a", "d"]);
    expect(groups[0].items[0].qty).toBe(6);
    expect(groups[1].supplier).toBeNull();
  });
});
