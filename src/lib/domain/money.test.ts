import { describe, expect, it } from "vitest";
import { formatINR, paiseToRupees, rupeesToPaise } from "./money";

describe("money", () => {
  it("converts rupees ↔ paise without float drift", () => {
    expect(rupeesToPaise(340)).toBe(34000);
    expect(rupeesToPaise(12.5)).toBe(1250);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
    expect(paiseToRupees(34050)).toBe(340.5);
  });

  it.each([
    [34000, "₹340"],
    [124000, "₹1,240"],
    [12500000, "₹1,25,000"],
    [1000000000, "₹1,00,00,000"],
    [0, "₹0"],
    [1250, "₹12.50"],
    [-50000, "-₹500"],
  ])("formatINR(%i) = %s", (p, s) => {
    expect(formatINR(p)).toBe(s);
  });

  it("signed option adds +", () => {
    expect(formatINR(50000, { signed: true })).toBe("+₹500");
    expect(formatINR(-50000, { signed: true })).toBe("-₹500");
    expect(formatINR(0, { signed: true })).toBe("₹0");
  });
});
