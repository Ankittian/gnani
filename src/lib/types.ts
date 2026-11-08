/**
 * Domain types shared by UI, hooks, domain reducers and the Dexie layer.
 * Conventions: camelCase, money in integer paise, timestamps as UTC ISO-8601 strings.
 */
import type { LangCode, TimbreVoice } from "@/lib/i18n/languages";

export type Paise = number;
export type IsoUtc = string;

export const UNITS = ["kg", "g", "l", "ml", "packet", "piece", "box", "sack", "dozen", "bottle", "unknown"] as const;
export type Unit = (typeof UNITS)[number];

export interface LineItem {
  name: string;
  qty: number | null;
  unit: Unit;
  productId: string | null;
  pricePaise: Paise | null;
}

export interface CloneEmbedding {
  embedding: string;
  shape: number[];
  dtype: string;
}

export interface Shop {
  id: "shop";
  name: string;
  ownerName: string;
  language: LangCode;
  assistantVoice: TimbreVoice;
  /** STT uses `indic-auto` instead of shop language + en-IN. */
  anyLanguage: boolean;
  cloneEmbedding: CloneEmbedding | null;
  soundsOn: boolean;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export interface Customer {
  id: string;
  name: string;
  nameAliases: string[];
  language: LangCode;
  /** Positive = customer owes the shop. Negative = advance. Denormalized from ledger. */
  balance: Paise;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
  deletedAt: IsoUtc | null;
}

export type LedgerType = "credit" | "payment";

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: LedgerType;
  amount: Paise;
  items: LineItem[];
  transcript: string;
  language: LangCode;
  createdAt: IsoUtc;
  deletedAt: IsoUtc | null;
}

export interface Supplier {
  id: string;
  name: string;
  language: LangCode;
  createdAt: IsoUtc;
}

export interface Product {
  id: string;
  name: string;
  aliases: string[];
  unit: Unit;
  stockQty: number;
  reorderLevel: number;
  pricePaise: Paise | null;
  supplierId: string | null;
  emoji: string;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export type StockOpKind = "set" | "add" | "remove" | "out";

export interface StockEvent {
  id: string;
  productId: string;
  op: StockOpKind;
  delta: number;
  transcript: string | null;
  createdAt: IsoUtc;
}

export interface Sale {
  id: string;
  items: LineItem[];
  amount: Paise;
  transcript: string;
  createdAt: IsoUtc;
  deletedAt: IsoUtc | null;
}

export type OrderStatus = "new" | "packed" | "delivered";

export interface OrderItem extends LineItem {
  packed: boolean;
}

export interface Order {
  id: string;
  customerName: string | null;
  customerId: string | null;
  items: OrderItem[];
  notes: string | null;
  status: OrderStatus;
  transcript: string;
  language: LangCode;
  audioDurationSec: number;
  createdAt: IsoUtc;
  updatedAt: IsoUtc;
}

export interface UsageDay {
  id: string; // YYYY-MM-DD (UTC)
  sttSeconds: number;
  ttsChars: number;
  cloneCalls: number;
  llmCalls: number;
}

/** Minimal context sent to /api/understand so the LLM can resolve names. */
export interface ShopContext {
  customers: { id: string; name: string; aliases: string[]; balance: Paise }[];
  products: { id: string; name: string; aliases: string[]; unit: Unit; pricePaise: Paise | null }[];
  suppliers: { id: string; name: string }[];
}
