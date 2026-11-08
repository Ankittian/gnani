import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/types";
import { nextStatus, orderToLedgerItems, orderTotalPaise } from "./orders";

const order: Order = {
  id: "o1",
  customerName: "Joseph",
  customerId: null,
  items: [
    { name: "Maggi", qty: 3, unit: "packet", productId: "p1", pricePaise: null, packed: true },
    { name: "Milk", qty: 2, unit: "packet", productId: null, pricePaise: 3000, packed: false },
    { name: "Mystery", qty: null, unit: "unknown", productId: null, pricePaise: null, packed: false },
  ],
  notes: null,
  status: "new",
  transcript: "",
  language: "en-IN",
  audioDurationSec: 10,
  createdAt: "",
  updatedAt: "",
};

describe("orders", () => {
  it("cycles status new → packed → delivered → delivered", () => {
    expect(nextStatus("new")).toBe("packed");
    expect(nextStatus("packed")).toBe("delivered");
    expect(nextStatus("delivered")).toBe("delivered");
  });

  it("totals using item price or product price, skipping unknowns", () => {
    expect(orderTotalPaise(order, [{ id: "p1", pricePaise: 1400 }])).toBe(3 * 1400 + 2 * 3000);
  });

  it("returns null when nothing is priced", () => {
    expect(orderTotalPaise({ ...order, items: [order.items[2]] }, [])).toBeNull();
  });

  it("converts to ledger items without packed flag, filling prices", () => {
    const items = orderToLedgerItems(order, [{ id: "p1", pricePaise: 1400 }]);
    expect(items[0]).toEqual({ name: "Maggi", qty: 3, unit: "packet", productId: "p1", pricePaise: 1400 });
    expect("packed" in items[0]).toBe(false);
  });
});
