import { describe, expect, it } from "vitest";
import { drawsForItems, qtyInProductUnit } from "./inventory";
import type { LineItem } from "@/lib/types";

const products = [
  { id: "p-rice", name: "Chawal", aliases: ["rice"], unit: "kg" as const },
  { id: "p-maggi", name: "Maggi Noodles", aliases: ["maggi"], unit: "packet" as const },
  { id: "p-eggs", name: "Eggs", aliases: ["anda"], unit: "dozen" as const },
  { id: "p-oil", name: "Sunflower Oil", aliases: [], unit: "l" as const },
];
const item = (over: Partial<LineItem>): LineItem => ({ name: "x", qty: 1, unit: "unknown", productId: null, pricePaise: null, ...over });

describe("qtyInProductUnit", () => {
  it("passes through same / unknown units and defaults qty to 1", () => {
    expect(qtyInProductUnit(2, "kg", "kg")).toBe(2);
    expect(qtyInProductUnit(3, "unknown", "packet")).toBe(3);
    expect(qtyInProductUnit(null, "packet", "packet")).toBe(1);
  });
  it("converts mass, volume and dozens", () => {
    expect(qtyInProductUnit(500, "g", "kg")).toBe(0.5);
    expect(qtyInProductUnit(2, "kg", "g")).toBe(2000);
    expect(qtyInProductUnit(250, "ml", "l")).toBe(0.25);
    expect(qtyInProductUnit(6, "piece", "dozen")).toBe(0.5);
    expect(qtyInProductUnit(1, "dozen", "piece")).toBe(12);
  });
  it("treats count units as interchangeable", () => {
    expect(qtyInProductUnit(2, "piece", "packet")).toBe(2);
    expect(qtyInProductUnit(1, "box", "bottle")).toBe(1);
  });
  it("returns null for incompatible units", () => {
    expect(qtyInProductUnit(2, "kg", "packet")).toBeNull();
    expect(qtyInProductUnit(1, "l", "kg")).toBeNull();
  });
});

describe("drawsForItems", () => {
  it("resolves by productId, then by name, and merges duplicates", () => {
    const draws = drawsForItems(
      [
        item({ name: "Chawal", qty: 2, unit: "kg", productId: "p-rice" }),
        item({ name: "maggi", qty: 1, unit: "packet" }),
        item({ name: "Maggi", qty: 2, unit: "packet", productId: "p-maggi" }),
      ],
      products,
    );
    expect(draws).toEqual([
      { productId: "p-rice", qty: 2 },
      { productId: "p-maggi", qty: 3 },
    ]);
  });
  it("skips unmatched items, incompatible units and zero quantities", () => {
    expect(
      drawsForItems(
        [item({ name: "Unicorn tears", qty: 1 }), item({ name: "Chawal", qty: 1, unit: "packet", productId: "p-rice" }), item({ name: "Eggs", qty: 0, unit: "dozen", productId: "p-eggs" })],
        products,
      ),
    ).toEqual([]);
  });
  it("converts units into the product's unit", () => {
    expect(drawsForItems([item({ name: "anda", qty: 6, unit: "piece" }), item({ name: "oil", qty: 500, unit: "ml", productId: "p-oil" })], products)).toEqual([
      { productId: "p-eggs", qty: 0.5 },
      { productId: "p-oil", qty: 0.5 },
    ]);
  });
});
