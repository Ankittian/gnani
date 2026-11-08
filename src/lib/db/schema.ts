import Dexie, { type EntityTable } from "dexie";
import type { Customer, LedgerEntry, Order, Product, Sale, Shop, StockEvent, Supplier, UsageDay } from "@/lib/types";

/** On-device database. Everything the shop owns lives here — no server DB. */
export class DukaanDB extends Dexie {
  shop!: EntityTable<Shop, "id">;
  customers!: EntityTable<Customer, "id">;
  ledgerEntries!: EntityTable<LedgerEntry, "id">;
  products!: EntityTable<Product, "id">;
  suppliers!: EntityTable<Supplier, "id">;
  stockEvents!: EntityTable<StockEvent, "id">;
  sales!: EntityTable<Sale, "id">;
  orders!: EntityTable<Order, "id">;
  usage!: EntityTable<UsageDay, "id">;

  constructor(name = "dukaan-dost") {
    super(name);
    this.version(1).stores({
      shop: "id",
      customers: "id, name, balance, updatedAt",
      ledgerEntries: "id, customerId, createdAt",
      products: "id, name, supplierId",
      suppliers: "id, name",
      stockEvents: "id, productId, createdAt",
      sales: "id, createdAt",
      orders: "id, status, createdAt",
      usage: "id",
    });
  }
}

let _db: DukaanDB | null = null;

/** Lazily created singleton (browser only). Tests construct their own `new DukaanDB(name)`. */
export function getDb(): DukaanDB {
  if (!_db) _db = new DukaanDB();
  return _db;
}

export const nowIso = (): string => new Date().toISOString();
export const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
