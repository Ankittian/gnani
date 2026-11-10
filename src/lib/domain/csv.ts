/**
 * Stock CSV import/export. Pure: parsing, validation and planning only — the repo applies the plan.
 * Prices in the file are rupees (what shopkeepers write); we store paise.
 */
import { UNITS, type Paise, type Product, type Supplier, type Unit } from "@/lib/types";
import { matchProduct, nameKey } from "./match";

/** Minimal RFC-4180 parser: quoted fields, "" escapes, CRLF/LF, BOM. Auto-detects `,` vs `;`. Drops blank lines. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

export interface StockCsvRow {
  line: number;
  name: string;
  stockQty: number | null;
  unit: Unit;
  pricePaise: Paise | null;
  reorderLevel: number | null;
  supplierName: string | null;
  aliases: string[];
  emoji: string | null;
}

export type StockCsvErrorCode = "noNameColumn" | "missingName" | "badNumber" | "badUnit";
export interface StockCsvError {
  line: number;
  code: StockCsvErrorCode;
  field?: string;
}

type Field = "name" | "stock" | "unit" | "price" | "reorder" | "supplier" | "aliases" | "emoji";

const HEADERS: Record<Field, string[]> = {
  name: ["name", "item", "product", "item name", "product name", "saman", "naam"],
  stock: ["stock", "qty", "quantity", "stock qty", "stock_qty", "in stock", "count"],
  unit: ["unit", "units", "uom"],
  price: ["price", "mrp", "rate", "price rupees", "price_rupees", "selling price", "price (₹)", "price (rs)"],
  reorder: ["reorder level", "reorder_level", "reorder", "min", "min stock", "minimum", "alert at"],
  supplier: ["supplier", "distributor", "vendor", "supplier name"],
  aliases: ["aliases", "alias", "other names", "also called"],
  emoji: ["emoji", "icon"],
};

const UNIT_ALIASES: Record<string, Unit> = {
  kilo: "kg", kgs: "kg", kilogram: "kg", gram: "g", gm: "g", gms: "g", grams: "g",
  litre: "l", liter: "l", ltr: "l", lt: "l", litres: "l", millilitre: "ml",
  pkt: "packet", packets: "packet", pack: "packet", pc: "piece", pcs: "piece", pieces: "piece", nos: "piece", no: "piece",
  boxes: "box", dabba: "box", bag: "sack", bori: "sack", bottles: "bottle", btl: "bottle", dz: "dozen", "": "piece",
};

const normHeader = (h: string) => h.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

function toUnit(raw: string): Unit | null {
  const u = raw.toLowerCase().replace(/\.$/, "").trim();
  if ((UNITS as readonly string[]).includes(u)) return u as Unit;
  return UNIT_ALIASES[u] ?? null;
}

/** "" → null; "1,200" / "₹45" ok; NaN or negative → undefined (= error). */
function toNumber(raw: string): number | null | undefined {
  const s = raw.replace(/[₹,\s]|rs\.?/gi, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseStockCsv(text: string): { rows: StockCsvRow[]; errors: StockCsvError[] } {
  const [header, ...body] = parseCsv(text);
  const col: Partial<Record<Field, number>> = {};
  (header ?? []).forEach((h, i) => {
    const key = normHeader(h);
    for (const [field, names] of Object.entries(HEADERS) as [Field, string[]][]) {
      if (col[field] == null && names.includes(key)) col[field] = i;
    }
  });
  if (col.name == null) return { rows: [], errors: [{ line: 1, code: "noNameColumn" }] };

  const rows: StockCsvRow[] = [];
  const errors: StockCsvError[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (f: Field) => (col[f] == null ? "" : (cells[col[f]!] ?? ""));
    const name = get("name");
    if (!name) {
      errors.push({ line, code: "missingName" });
      return;
    }
    const unit = toUnit(get("unit"));
    if (!unit) {
      errors.push({ line, code: "badUnit", field: "unit" });
      return;
    }
    const nums: Partial<Record<"stock" | "price" | "reorder", number | null>> = {};
    for (const f of ["stock", "price", "reorder"] as const) {
      const n = toNumber(get(f));
      if (n === undefined) {
        errors.push({ line, code: "badNumber", field: f });
        return;
      }
      nums[f] = n;
    }
    rows.push({
      line,
      name,
      stockQty: nums.stock ?? null,
      unit,
      pricePaise: nums.price == null ? null : Math.round(nums.price * 100),
      reorderLevel: nums.reorder ?? null,
      supplierName: get("supplier") || null,
      aliases: get("aliases")
        .split(/[|;/]/)
        .map((a) => a.trim())
        .filter(Boolean),
      emoji: get("emoji") || null,
    });
  });
  return { rows, errors };
}

export interface StockImportPlanRow {
  row: StockCsvRow;
  /** Existing product to update, or null to create. */
  productId: string | null;
}

/** Exact name/alias key first, then the fuzzy matcher (same one voice uses), so "maggi" updates "Maggi Noodles". */
export function planStockImport(rows: StockCsvRow[], products: { id: string; name: string; aliases: string[] }[]): StockImportPlanRow[] {
  const exact = new Map<string, string>();
  for (const p of products) for (const n of [p.name, ...p.aliases]) exact.set(nameKey(n), p.id);
  return rows.map((row) => ({
    row,
    productId: exact.get(nameKey(row.name)) ?? matchProduct(row.name, products).best?.id ?? null,
  }));
}

const csvCell = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export const STOCK_CSV_HEADER = ["name", "stock", "unit", "price", "reorder_level", "supplier", "aliases", "emoji"];

/** Current stock as a CSV the importer accepts (backup / edit in Excel / re-import). */
export function stockCsvFromProducts(
  products: Pick<Product, "name" | "unit" | "stockQty" | "reorderLevel" | "pricePaise" | "supplierId" | "aliases" | "emoji">[],
  suppliers: Pick<Supplier, "id" | "name">[],
): string {
  const sup = new Map(suppliers.map((s) => [s.id, s.name]));
  const lines = products.map((p) =>
    [p.name, p.stockQty, p.unit, p.pricePaise == null ? null : p.pricePaise / 100, p.reorderLevel, p.supplierId ? (sup.get(p.supplierId) ?? null) : null, p.aliases.join("|"), p.emoji]
      .map(csvCell)
      .join(","),
  );
  return [STOCK_CSV_HEADER.join(","), ...lines].join("\n") + "\n";
}

/** Bundled sample for testing the importer (also served at /samples/stock-sample.csv). Mix of updates to the demo shop and new items. */
export const SAMPLE_STOCK_CSV = `name,stock,unit,price,reorder_level,supplier,aliases,emoji
Maggi Noodles,48,packet,14,12,Murugan Agencies,maggi|मैगी|மேகி,🍜
Parle-G,60,packet,10,10,Murugan Agencies,parle g|पारले जी,🍪
Aashirvaad Atta,25,kg,48,10,Manjunath Traders,atta|आटा|ಹಿಟ್ಟು,🌾
Sugar,20,kg,45,5,Manjunath Traders,chini|चीनी|ಸಕ್ಕರೆ,🧂
Amul Butter 100g,12,packet,58,4,Sai Wholesale,butter|मक्खन,🧈
Paneer 200g,6,packet,90,3,Sai Wholesale,paneer|पनीर,🧀
Basmati Rice,30,kg,120,8,Agarwal Distributors,basmati|बासमती,🍚
Moong Dal,10,kg,130,4,Manjunath Traders,moong|मूंग दाल|ಹೆಸರು ಬೇಳೆ,🫘
Jaggery (Gud),8,kg,65,3,Manjunath Traders,gud|गुड़|ಬೆಲ್ಲ,🟤
Dettol Soap,24,piece,45,6,Agarwal Distributors,dettol sabun|डेटॉल साबुन,🧼
Thums Up 750ml,18,bottle,40,6,Murugan Agencies,thums up|थम्स अप,🥤
Candles,40,piece,5,10,,mombatti|मोमबत्ती,🕯️
`;
