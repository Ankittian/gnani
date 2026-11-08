import type { ShopContext } from "@/lib/types";

/** STT biasing terms (Prisma `keyterms`, ≤200): customers by balance, then products, then suppliers. */
export function buildKeyterms(ctx: ShopContext, max = 200): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    const term = t.trim().replace(/\s+/g, " ");
    if (!term || term.length > 40) return;
    const k = term.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(term);
  };
  const customers = [...ctx.customers].sort((a, b) => b.balance - a.balance);
  for (const c of customers) [c.name, ...c.aliases].forEach(push);
  for (const p of ctx.products) [p.name, ...p.aliases].forEach(push);
  for (const s of ctx.suppliers) push(s.name);
  return out.slice(0, max);
}
