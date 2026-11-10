import { describe, expect, it } from "vitest";
import { parseCsv, parseStockCsv, planStockImport, SAMPLE_STOCK_CSV, stockCsvFromProducts } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const text = '﻿name,notes\r\n"Toor Dal, 1kg","say ""hi"""\r\n\r\nSugar,\n';
    expect(parseCsv(text)).toEqual([
      ["name", "notes"],
      ["Toor Dal, 1kg", 'say "hi"'],
      ["Sugar", ""],
    ]);
  });
  it("supports semicolon-separated files (Excel in some locales)", () => {
    expect(parseCsv("name;stock\nSalt;4")).toEqual([
      ["name", "stock"],
      ["Salt", "4"],
    ]);
  });
});

describe("parseStockCsv", () => {
  it("parses the bundled sample without errors", () => {
    const { rows, errors } = parseStockCsv(SAMPLE_STOCK_CSV);
    expect(errors).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows[0]).toMatchObject({ name: expect.any(String), unit: expect.any(String) });
  });

  it("maps header synonyms, units, prices in rupees and aliases", () => {
    const { rows, errors } = parseStockCsv("Item,Qty,Unit,MRP,Min,Supplier,Aliases,Emoji\nBesan,5,kilo,110.5,3,Manjunath Traders,besan|बेसन,🟡");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, name: "Besan", stockQty: 5, unit: "kg", pricePaise: 11050, reorderLevel: 3, supplierName: "Manjunath Traders", aliases: ["besan", "बेसन"], emoji: "🟡" },
    ]);
  });

  it("leaves optional columns null and reports per-line problems", () => {
    const { rows, errors } = parseStockCsv("name,stock,unit,price\nSalt,,packet,\n,3,kg,10\nSugar,abc,kg,45\nJaggery,2,bucket,60");
    expect(rows).toEqual([{ line: 2, name: "Salt", stockQty: null, unit: "packet", pricePaise: null, reorderLevel: null, supplierName: null, aliases: [], emoji: null }]);
    expect(errors).toEqual([
      { line: 3, code: "missingName" },
      { line: 4, code: "badNumber", field: "stock" },
      { line: 5, code: "badUnit", field: "unit" },
    ]);
  });

  it("needs a name column", () => {
    expect(parseStockCsv("foo,bar\n1,2").errors).toEqual([{ line: 1, code: "noNameColumn" }]);
  });
});

describe("planStockImport", () => {
  it("marks rows as update when they match an existing product, else create", () => {
    const { rows } = parseStockCsv("name,stock,unit\nmaggi,20,packet\nPaneer,2,kg");
    const plan = planStockImport(rows, [{ id: "p-maggi", name: "Maggi Noodles", aliases: ["maggi"] }]);
    expect(plan.map((p) => [p.row.name, p.productId])).toEqual([
      ["maggi", "p-maggi"],
      ["Paneer", null],
    ]);
  });
});

describe("stockCsvFromProducts", () => {
  it("round-trips through the parser", () => {
    const csv = stockCsvFromProducts(
      [{ name: 'Atta "Gold"', unit: "kg", stockQty: 6, reorderLevel: 10, pricePaise: 4800, supplierId: "s1", aliases: ["atta", "आटा"], emoji: "🌾" }],
      [{ id: "s1", name: "Manjunath Traders" }],
    );
    const { rows, errors } = parseStockCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ name: 'Atta "Gold"', stockQty: 6, unit: "kg", pricePaise: 4800, reorderLevel: 10, supplierName: "Manjunath Traders", aliases: ["atta", "आटा"] });
  });
});
