/** Transactional data access over Dexie. All mutations of shop data go through here. */
import type { LangCode } from "@/lib/i18n/languages";
import { DEFAULT_VOICE } from "@/lib/i18n/languages";
import { actionProblem, type Action } from "@/lib/llm/schema";
import { applyLedger, entryFromAction, ledgerTypeFor } from "@/lib/domain/ledger";
import { matchCustomer, matchProduct } from "@/lib/domain/match";
import { orderToLedgerItems, orderTotalPaise } from "@/lib/domain/orders";
import { applyStockOp } from "@/lib/domain/stock";
import type { Customer, OrderStatus, Paise, Product, Shop, ShopContext, UsageDay } from "@/lib/types";
import { type DukaanDB, newId, nowIso } from "./schema";

// ---------- shop ----------

export async function getShop(db: DukaanDB): Promise<Shop | undefined> {
  return db.shop.get("shop");
}

export type ShopPatch = Partial<Omit<Shop, "id" | "createdAt" | "updatedAt">>;

export async function saveShop(db: DukaanDB, patch: ShopPatch): Promise<Shop> {
  return db.transaction("rw", db.shop, async () => {
    const existing = await db.shop.get("shop");
    const now = nowIso();
    const shop: Shop = existing
      ? { ...existing, ...patch, updatedAt: now }
      : {
          name: "Meri Dukaan",
          ownerName: "",
          language: "hi-IN",
          assistantVoice: DEFAULT_VOICE,
          anyLanguage: false,
          cloneEmbedding: null,
          soundsOn: true,
          ...patch,
          id: "shop",
          createdAt: now,
          updatedAt: now,
        };
    await db.shop.put(shop);
    return shop;
  });
}

export async function buildShopContext(db: DukaanDB): Promise<ShopContext> {
  const [customers, products, suppliers] = await Promise.all([
    db.customers.toArray(),
    db.products.toArray(),
    db.suppliers.toArray(),
  ]);
  return {
    customers: customers
      .filter((c) => !c.deletedAt)
      .map((c) => ({ id: c.id, name: c.name, aliases: c.nameAliases, balance: c.balance })),
    products: products.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, unit: p.unit, pricePaise: p.pricePaise })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
  };
}

// ---------- commit / undo ----------

export interface CommitMeta {
  transcript: string;
  language: LangCode;
  audioDurationSec?: number;
}

export interface CommitResult {
  kind: "ledger" | "sale" | "stock" | "order" | "none";
  customerId: string | null;
  newBalance: Paise | null;
  createdIds: {
    ledger?: string;
    sale?: string;
    order?: string;
    stockEvents?: string[];
    customer?: string;
    products?: string[];
  };
  previous: { balance?: Paise; stock?: Record<string, number> };
}

const activeCustomers = async (db: DukaanDB) => (await db.customers.toArray()).filter((c) => !c.deletedAt);
const toNamed = (c: Customer) => ({ id: c.id, name: c.name, aliases: c.nameAliases });

/** Resolve an existing customer without creating one. */
async function findCustomer(db: DukaanDB, ref: { id: string | null; name: string }): Promise<{ customer: Customer | null; ambiguous: boolean }> {
  if (ref.id) {
    const c = await db.customers.get(ref.id);
    if (c && !c.deletedAt) return { customer: c, ambiguous: false };
  }
  const all = await activeCustomers(db);
  const m = matchCustomer(ref.name, all.map(toNamed));
  if (m.best) return { customer: all.find((c) => c.id === m.best!.id) ?? null, ambiguous: false };
  return { customer: null, ambiguous: m.candidates.length > 0 };
}

async function createCustomer(db: DukaanDB, name: string, language: LangCode): Promise<Customer> {
  const now = nowIso();
  const c: Customer = {
    id: newId(),
    name: name.trim(),
    nameAliases: [],
    language,
    balance: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.customers.add(c);
  return c;
}

async function resolveProduct(db: DukaanDB, ref: { productId: string | null; name: string }): Promise<Product | null> {
  if (ref.productId) {
    const p = await db.products.get(ref.productId);
    if (p) return p;
  }
  const all = await db.products.toArray();
  const m = matchProduct(ref.name, all.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases })));
  return m.best ? (all.find((p) => p.id === m.best!.id) ?? null) : null;
}

export async function commitAction(db: DukaanDB, action: Action, meta: CommitMeta): Promise<CommitResult> {
  const problem = actionProblem(action);
  if (problem) throw new Error(`invalid_action:${problem}`);

  const result: CommitResult = { kind: "none", customerId: null, newBalance: null, createdIds: {}, previous: {} };
  const tables = [db.customers, db.ledgerEntries, db.products, db.stockEvents, db.sales, db.orders];

  await db.transaction("rw", tables, async () => {
    const now = nowIso();
    switch (action.intent) {
      case "add_credit":
      case "record_payment": {
        const ref = action.customer!;
        const found = await findCustomer(db, ref);
        let customer = found.customer;
        const ambiguous = found.ambiguous;
        if (!customer) {
          if (ambiguous && !ref.isNew) throw new Error("ambiguous_customer");
          customer = await createCustomer(db, ref.name, meta.language);
          result.createdIds.customer = customer.id;
        }
        const entry = { ...entryFromAction(action, customer.id, meta), id: newId(), createdAt: now };
        await db.ledgerEntries.add(entry);
        const newBalance = applyLedger(customer.balance, ledgerTypeFor(action.intent)!, entry.amount);
        await db.customers.update(customer.id, { balance: newBalance, updatedAt: now });
        Object.assign(result, { kind: "ledger", customerId: customer.id, newBalance });
        result.createdIds.ledger = entry.id;
        result.previous.balance = customer.balance;
        break;
      }
      case "query_balance":
      case "send_reminder": {
        const { customer } = await findCustomer(db, action.customer!);
        if (customer) Object.assign(result, { customerId: customer.id, newBalance: customer.balance });
        break;
      }
      case "cash_sale": {
        const id = newId();
        await db.sales.add({ id, items: action.items, amount: action.amountPaise!, transcript: meta.transcript, createdAt: now, deletedAt: null });
        result.kind = "sale";
        result.createdIds.sale = id;
        break;
      }
      case "stock_update": {
        const prev: Record<string, number> = {};
        const eventIds: string[] = [];
        const created: string[] = [];
        for (const op of action.stockOps) {
          let product = await resolveProduct(db, op);
          if (!product) {
            product = {
              id: newId(),
              name: op.name.trim(),
              aliases: [],
              unit: op.unit,
              stockQty: 0,
              reorderLevel: 2,
              pricePaise: null,
              supplierId: null,
              emoji: "📦",
              createdAt: now,
              updatedAt: now,
            };
            await db.products.add(product);
            created.push(product.id);
          }
          if (!(product.id in prev)) prev[product.id] = product.stockQty;
          const current = (await db.products.get(product.id))!.stockQty;
          const next = applyStockOp(current, op.op, op.qty);
          await db.products.update(product.id, { stockQty: next, updatedAt: now });
          const evId = newId();
          await db.stockEvents.add({ id: evId, productId: product.id, op: op.op, delta: next - current, transcript: meta.transcript, createdAt: now });
          eventIds.push(evId);
        }
        result.kind = "stock";
        result.createdIds.stockEvents = eventIds;
        if (created.length) result.createdIds.products = created;
        result.previous.stock = prev;
        break;
      }
      case "create_order": {
        const products = await db.products.toArray();
        const named = products.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases }));
        const items = action.items.map((it) => ({
          ...it,
          productId: it.productId ?? matchProduct(it.name, named).best?.id ?? null,
          packed: false,
        }));
        let customerId: string | null = null;
        if (action.customer) {
          const { customer } = await findCustomer(db, action.customer);
          customerId = customer?.id ?? null;
        }
        const id = newId();
        await db.orders.add({
          id,
          customerName: action.customer?.name ?? null,
          customerId,
          items,
          notes: action.notes,
          status: "new",
          transcript: meta.transcript,
          language: meta.language,
          audioDurationSec: meta.audioDurationSec ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        Object.assign(result, { kind: "order", customerId });
        result.createdIds.order = id;
        break;
      }
      default:
        break;
    }
  });
  return result;
}

export async function undoCommit(db: DukaanDB, result: CommitResult): Promise<void> {
  const tables = [db.customers, db.ledgerEntries, db.products, db.stockEvents, db.sales, db.orders];
  await db.transaction("rw", tables, async () => {
    const now = nowIso();
    const { createdIds } = result;
    if (createdIds.ledger) {
      const entry = await db.ledgerEntries.get(createdIds.ledger);
      if (entry && !entry.deletedAt) {
        await db.ledgerEntries.update(entry.id, { deletedAt: now });
        const c = await db.customers.get(entry.customerId);
        if (c) {
          const reversed = entry.type === "credit" ? c.balance - entry.amount : c.balance + entry.amount;
          await db.customers.update(c.id, { balance: reversed, updatedAt: now });
        }
      }
    }
    if (createdIds.customer) {
      const others = await db.ledgerEntries.where("customerId").equals(createdIds.customer).filter((e) => !e.deletedAt).count();
      if (others === 0) await db.customers.delete(createdIds.customer);
    }
    if (createdIds.sale) await db.sales.update(createdIds.sale, { deletedAt: now });
    if (createdIds.order) await db.orders.delete(createdIds.order);
    if (createdIds.stockEvents?.length) {
      const events = (await db.stockEvents.bulkGet(createdIds.stockEvents)).filter((e) => e != null);
      for (const ev of [...events].reverse()) {
        const p = await db.products.get(ev.productId);
        if (p) await db.products.update(p.id, { stockQty: Math.max(0, p.stockQty - ev.delta), updatedAt: now });
      }
      await db.stockEvents.bulkDelete(createdIds.stockEvents);
    }
    if (createdIds.products?.length) await db.products.bulkDelete(createdIds.products);
  });
}

// ---------- orders & stock helpers ----------

export async function setOrderStatus(db: DukaanDB, id: string, status: OrderStatus): Promise<void> {
  await db.orders.update(id, { status, updatedAt: nowIso() });
}

export async function toggleOrderItem(db: DukaanDB, id: string, index: number): Promise<void> {
  await db.transaction("rw", db.orders, async () => {
    const o = await db.orders.get(id);
    if (!o || !o.items[index]) return;
    const items = o.items.map((it, i) => (i === index ? { ...it, packed: !it.packed } : it));
    await db.orders.update(id, { items, updatedAt: nowIso() });
  });
}

export async function adjustStock(db: DukaanDB, productId: string, delta: number): Promise<number | null> {
  return db.transaction("rw", db.products, db.stockEvents, async () => {
    const p = await db.products.get(productId);
    if (!p) return null;
    const now = nowIso();
    const next = Math.max(0, p.stockQty + delta);
    await db.products.update(productId, { stockQty: next, updatedAt: now });
    await db.stockEvents.add({ id: newId(), productId, op: delta >= 0 ? "add" : "remove", delta: next - p.stockQty, transcript: null, createdAt: now });
    return next;
  });
}

/** Adds the delivered order's priced total to the customer's khata as udhaar. */
export async function addLedgerFromOrder(db: DukaanDB, orderId: string): Promise<{ customerId: string; newBalance: Paise; ledgerId: string }> {
  return db.transaction("rw", db.orders, db.customers, db.ledgerEntries, db.products, async () => {
    const order = await db.orders.get(orderId);
    if (!order) throw new Error("order_not_found");
    const products = await db.products.toArray();
    const total = orderTotalPaise(order, products);
    if (total == null || total <= 0) throw new Error("order_unpriced");
    let customer = order.customerId ? await db.customers.get(order.customerId) : undefined;
    if (!customer) {
      if (!order.customerName) throw new Error("order_no_customer");
      const found = await findCustomer(db, { id: null, name: order.customerName });
      customer = found.customer ?? (await createCustomer(db, order.customerName, order.language));
    }
    const now = nowIso();
    const ledgerId = newId();
    await db.ledgerEntries.add({
      id: ledgerId,
      customerId: customer.id,
      type: "credit",
      amount: total,
      items: orderToLedgerItems(order, products),
      transcript: order.transcript,
      language: order.language,
      createdAt: now,
      deletedAt: null,
    });
    const newBalance = customer.balance + total;
    await db.customers.update(customer.id, { balance: newBalance, updatedAt: now });
    await db.orders.update(orderId, { customerId: customer.id, updatedAt: now });
    return { customerId: customer.id, newBalance, ledgerId };
  });
}

// ---------- usage & reset ----------

export async function recordUsage(db: DukaanDB, patch: Partial<Omit<UsageDay, "id">>): Promise<UsageDay> {
  const id = new Date().toISOString().slice(0, 10);
  return db.transaction("rw", db.usage, async () => {
    const cur = (await db.usage.get(id)) ?? { id, sttSeconds: 0, ttsChars: 0, cloneCalls: 0, llmCalls: 0 };
    const next: UsageDay = {
      id,
      sttSeconds: cur.sttSeconds + (patch.sttSeconds ?? 0),
      ttsChars: cur.ttsChars + (patch.ttsChars ?? 0),
      cloneCalls: cur.cloneCalls + (patch.cloneCalls ?? 0),
      llmCalls: cur.llmCalls + (patch.llmCalls ?? 0),
    };
    await db.usage.put(next);
    return next;
  });
}

export async function clearAll(db: DukaanDB): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
