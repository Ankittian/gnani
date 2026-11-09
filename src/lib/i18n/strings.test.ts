import fs from "node:fs";
import path from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { LANG_CODES, LANGUAGE_LIST } from "./languages";

const dir = path.join(__dirname, "..", "..", "messages");
const read = (code: string): Record<string, string> => JSON.parse(fs.readFileSync(path.join(dir, `${code.split("-")[0]}.json`), "utf8"));
const en = read("en-IN");
const KEYS = Object.keys(en);

/** Sorted ICU argument names used by a message (incl. inside plural/select branches). */
function args(msg: string): string {
  const out = new Set<string>();
  const walk = (nodes: ReturnType<typeof parse>) => {
    for (const n of nodes) {
      if (n.type === TYPE.argument || n.type === TYPE.number || n.type === TYPE.date || n.type === TYPE.time) out.add(n.value);
      if (n.type === TYPE.plural || n.type === TYPE.select) {
        out.add(n.value);
        for (const o of Object.values(n.options)) walk(o.value);
      }
    }
  };
  walk(parse(msg));
  return [...out].sort().join(",");
}

/** Brand names / placeholders that are legitimately identical across languages. */
const SAME_OK = new Set(["whatsapp", "shopPlaceholder", "ownerPlaceholder", "appName", "intentUnknown"]);

describe("i18n catalogs", () => {
  it("has 10 languages with native names", () => {
    expect(LANGUAGE_LIST).toHaveLength(10);
    for (const l of LANGUAGE_LIST) expect(l.nativeName.length).toBeGreaterThan(0);
  });

  it("every language has a catalog file", () => {
    for (const code of LANG_CODES) expect(() => read(code), code).not.toThrow();
  });

  it("every catalog defines every English key and has no stale extras", () => {
    for (const code of LANG_CODES) {
      const c = read(code);
      expect(KEYS.filter((k) => !c[k]?.trim()), `${code} missing`).toEqual([]);
      expect(Object.keys(c).filter((k) => !(k in en)), `${code} stale keys`).toEqual([]);
    }
  });

  it("every message is valid ICU and keeps the same {placeholders} as English", () => {
    for (const code of LANG_CODES) {
      const c = read(code);
      for (const k of KEYS) expect(args(c[k]), `${code}.${k}`).toBe(args(en[k]));
    }
  });

  it("non-English catalogs are actually translated", () => {
    for (const code of LANG_CODES.filter((c) => c !== "en-IN")) {
      const c = read(code);
      const same = KEYS.filter((k) => !SAME_OK.has(k) && c[k] === en[k]);
      expect(same, `${code} still has English text`).toEqual([]);
    }
  });
});
