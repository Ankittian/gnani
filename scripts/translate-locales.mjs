#!/usr/bin/env node
/**
 * Translation pipeline: src/messages/en.json is the source of truth.
 * This script fills in any keys that are missing in the other locale files using Gemini,
 * validates that ICU placeholders survived, and writes the JSON back. It is incremental —
 * existing translations are never overwritten unless you pass --force.
 *
 *   node scripts/translate-locales.mjs              # all locales, missing keys only
 *   node scripts/translate-locales.mjs ta te        # only these (short codes)
 *   node scripts/translate-locales.mjs --force ta   # retranslate everything for ta
 *
 * Always have a native speaker review the output — especially shop vocabulary (udhaar, jama, khata).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "messages");
const NAMES = {
  hi: "Hindi (Devanagari)",
  mr: "Marathi (Devanagari)",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  bn: "Bengali",
  gu: "Gujarati",
  pa: "Punjabi (Gurmukhi)",
};
const BATCH = 60;

for (const f of [".env", ".env.local"]) {
  try {
    for (const line of fs.readFileSync(path.join(dir, "..", "..", f), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set (.env).");
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const targets = args.filter((a) => !a.startsWith("--"));
const langs = targets.length ? targets : Object.keys(NAMES);
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const read = (l) => JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), "utf8"));
const en = read("en");

/** Names of every argument used in an ICU message (including nested plural branches). */
function argNames(msg) {
  const out = new Set();
  const walk = (nodes) => {
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

function ok(key, value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    return argNames(value) === argNames(en[key]);
  } catch {
    return false;
  }
}

async function translate(lang, entries) {
  const prompt = `Translate these UI strings of "Dukaan Dost", a voice-first assistant for Indian kirana (neighbourhood grocery) shopkeepers, from English to ${NAMES[lang]}.
Rules:
- Natural, simple, spoken-style language a shopkeeper would use; short, button-friendly.
- Keep ICU MessageFormat syntax EXACTLY: {n}, {name}, {a}, {b}, {unit} and plural blocks like {n, plural, one {# item} other {# items}}. Never translate placeholder names or the words "plural", "one", "other". Use the plural categories that ${NAMES[lang]} needs (e.g. "one" and "other").
- Domain words: "khata" = customer credit ledger, "udhaar" = credit given, "jama" = payment received, "hisaab" = accounts/daily summary. Use the everyday local word shopkeepers use, not a literal translation.
- Keep brand names (WhatsApp) and the ₹ sign. Product names inside quotes (Maggi, Parle-G) may be transliterated into the target script.
- Return ONLY a JSON object mapping each key to its translation.

${JSON.stringify(Object.fromEntries(entries), null, 1)}`;
  const res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json" } });
  return JSON.parse((res.text ?? "{}").replace(/^```(?:json)?|```$/g, "").trim());
}

let failed = 0;
for (const lang of langs) {
  if (!NAMES[lang]) {
    console.error(`unknown locale "${lang}"`);
    failed++;
    continue;
  }
  const file = path.join(dir, `${lang}.json`);
  let current = {};
  try {
    current = read(lang);
  } catch {}
  const todo = Object.keys(en).filter((k) => force || !ok(k, current[k]));
  if (!todo.length) {
    console.log(`${lang}: up to date`);
    continue;
  }
  console.log(`${lang}: translating ${todo.length} keys…`);
  for (let i = 0; i < todo.length; i += BATCH) {
    let pending = todo.slice(i, i + BATCH);
    for (let attempt = 0; attempt < 3 && pending.length; attempt++) {
      try {
        const got = await translate(lang, pending.map((k) => [k, en[k]]));
        for (const k of pending) if (ok(k, got[k])) current[k] = got[k];
      } catch (e) {
        console.error(`  ${lang}: batch error (${e instanceof Error ? e.message.slice(0, 120) : e})`);
      }
      pending = pending.filter((k) => !ok(k, current[k]));
    }
    if (pending.length) {
      console.error(`  ${lang}: gave up on ${pending.length} keys: ${pending.join(", ")}`);
      failed++;
    }
  }
  // Write in en.json key order so diffs stay clean; drop keys that no longer exist in English.
  const out = Object.fromEntries(Object.keys(en).filter((k) => current[k] != null).map((k) => [k, current[k]]));
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
}
process.exit(failed ? 1 : 0);
