import { describe, expect, it } from "vitest";
import type { ShopContext } from "@/lib/types";
import { buildKeyterms } from "./keyterms";

const ctx: ShopContext = {
  customers: [
    { id: "a", name: "Low Balance", aliases: [], balance: 100 },
    { id: "b", name: "Ramesh Sharma", aliases: ["Sharma ji", "sharma JI"], balance: 99999 },
  ],
  products: [{ id: "p", name: "Maggi", aliases: ["मैगी", "x".repeat(41)], unit: "packet", pricePaise: 1400 }],
  suppliers: [{ id: "s", name: "Manjunath Traders" }],
};

describe("buildKeyterms", () => {
  it("orders customers by balance, then products, then suppliers; dedupes case-insensitively", () => {
    expect(buildKeyterms(ctx)).toEqual([
      "Ramesh Sharma",
      "Sharma ji",
      "Low Balance",
      "Maggi",
      "मैगी",
      "Manjunath Traders",
    ]);
  });

  it("caps at max and skips long/empty terms", () => {
    expect(buildKeyterms(ctx, 2)).toEqual(["Ramesh Sharma", "Sharma ji"]);
    const empty: ShopContext = { customers: [{ id: "x", name: "  ", aliases: [], balance: 0 }], products: [], suppliers: [] };
    expect(buildKeyterms(empty)).toEqual([]);
  });
});
