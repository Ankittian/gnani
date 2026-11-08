import type { Paise } from "@/lib/types";

export const rupeesToPaise = (rupees: number): Paise => Math.round(rupees * 100);
export const paiseToRupees = (paise: Paise): number => paise / 100;

function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** "₹1,25,000" (Indian grouping); shows paise only when non-zero ("₹12.50"). */
export function formatINR(paise: Paise, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = `₹${groupIndian(rupees)}${frac ? `.${String(frac).padStart(2, "0")}` : ""}`;
  if (paise < 0) return `-${body}`;
  if (opts.signed && paise > 0) return `+${body}`;
  return body;
}
