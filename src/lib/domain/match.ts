/**
 * Transliteration-aware fuzzy matching for customer and product names.
 * "शर्मा जी", "ಶರ್ಮಾ ಅವರೇ" and "Sharma ji" all resolve to the same key.
 */

// Indic blocks share the ISCII-derived layout, so one offset table covers all scripts.
const BLOCK_STARTS = [0x0900, 0x0980, 0x0a00, 0x0a80, 0x0b00, 0x0b80, 0x0c00, 0x0c80, 0x0d00];

const VOWELS: Record<number, string> = {
  0x05: "a", 0x06: "aa", 0x07: "i", 0x08: "ii", 0x09: "u", 0x0a: "uu", 0x0b: "ri",
  0x0e: "e", 0x0f: "e", 0x10: "ai", 0x12: "o", 0x13: "o", 0x14: "au",
};
const MATRAS: Record<number, string> = {
  0x3e: "aa", 0x3f: "i", 0x40: "ii", 0x41: "u", 0x42: "uu", 0x43: "ri",
  0x46: "e", 0x47: "e", 0x48: "ai", 0x4a: "o", 0x4b: "o", 0x4c: "au", 0x57: "au",
};
const CONSONANTS: Record<number, string> = {
  0x15: "k", 0x16: "kh", 0x17: "g", 0x18: "gh", 0x19: "ng", 0x1a: "ch", 0x1b: "chh", 0x1c: "j",
  0x1d: "jh", 0x1e: "ny", 0x1f: "t", 0x20: "th", 0x21: "d", 0x22: "dh", 0x23: "n", 0x24: "t",
  0x25: "th", 0x26: "d", 0x27: "dh", 0x28: "n", 0x29: "n", 0x2a: "p", 0x2b: "ph", 0x2c: "b",
  0x2d: "bh", 0x2e: "m", 0x2f: "y", 0x30: "r", 0x31: "r", 0x32: "l", 0x33: "l", 0x34: "zh",
  0x35: "v", 0x36: "sh", 0x37: "sh", 0x38: "s", 0x39: "h",
};
const VIRAMA = 0x4d;
const SIGNS: Record<number, string> = { 0x01: "n", 0x02: "n", 0x03: "h" };

function indicOffset(cp: number): number | null {
  for (const b of BLOCK_STARTS) if (cp >= b && cp < b + 0x80) return cp - b;
  return null;
}

/** Rough Indic → Latin (lowercase). Latin input passes through lowercased. */
export function transliterate(input: string): string {
  const cps = Array.from(input.normalize("NFC")).map((c) => c.codePointAt(0) ?? 0);
  let out = "";
  for (let i = 0; i < cps.length; i++) {
    const off = indicOffset(cps[i]);
    if (off == null) {
      out += String.fromCodePoint(cps[i]).toLowerCase();
      continue;
    }
    if (CONSONANTS[off]) {
      out += CONSONANTS[off];
      // skip nukta
      let j = i + 1;
      while (j < cps.length && indicOffset(cps[j]) === 0x3c) j++;
      const nextOff = j < cps.length ? indicOffset(cps[j]) : null;
      if (nextOff != null && MATRAS[nextOff]) {
        out += MATRAS[nextOff];
        i = j;
      } else if (nextOff === VIRAMA) {
        i = j;
      } else {
        out += "a";
        i = j - 1;
      }
    } else if (VOWELS[off]) out += VOWELS[off];
    else if (MATRAS[off]) out += MATRAS[off];
    else if (SIGNS[off]) out += SIGNS[off];
    // anything else (nukta, digits, danda) dropped
  }
  return out;
}

const SKELETON_RULES: [RegExp, string][] = [
  [/chh/g, "c"], [/ch/g, "c"], [/sh/g, "s"], [/zh/g, "l"], [/kh|gh|g|q/g, "k"], [/th|dh|d/g, "t"],
  [/ph|bh|b|f/g, "p"], [/jh|z/g, "j"], [/w/g, "v"], [/x/g, "ks"], [/aa/g, "a"], [/ee|ii|y/g, "i"],
  [/oo|uu/g, "u"], [/au|ou/g, "o"], [/ai/g, "e"], [/h/g, ""],
];

function skeletonToken(tok: string): string {
  let s = tok.replace(/[^a-z]/g, "");
  for (const [re, rep] of SKELETON_RULES) s = re.test(s) ? s.replace(re, rep) : s;
  s = s.replace(/(.)\1+/g, "$1");
  if (s.length > 3 && s.endsWith("a")) s = s.slice(0, -1);
  return s;
}

const HONORIFICS = [
  "ji", "jee", "bhai", "bhaiya", "bhaiyya", "didi", "behen", "ben", "anna", "akka", "amma", "sir", "madam",
  "saab", "sahab", "saheb", "babu", "garu", "avare", "avaru", "avargal", "aunty", "uncle", "chechi", "chettan",
];
const HONORIFIC_KEYS = new Set(HONORIFICS.map(skeletonToken));
const HONORIFIC_RAW = new Set(["जी", "जि", "भाई", "भैया", "दीदी", "बहन", "साहब", "साब", "बाबू", "ಅವರೇ", "ಅವರು", "ಅಣ್ಣ", "ಅಕ್ಕ",
  "அவர்கள்", "அவர்களே", "அண்ணா", "அக்கா", "గారు", "అన్న", "అక్క", "বাবু", "দিদি", "ভাই", "ਜੀ", "ਭਾਈ", "ભાઈ", "બેન", "ജി", "ചേട്ടൻ", "ചേച്ചി"]);

function tokensOf(s: string): string[] {
  const raw = s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}\d]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const kept = raw.filter((t) => !HONORIFIC_RAW.has(t));
  const latin = kept.map(transliterate).map((t) => (t.length > 4 && /(ji|jee)$/.test(t) ? t.replace(/(ji|jee)$/, "") : t));
  const noHon = latin.filter((t) => !HONORIFIC_KEYS.has(skeletonToken(t)));
  const result = noHon.length ? noHon : raw.map(transliterate);
  return result.filter(Boolean);
}

/** Lowercase Latin form with honorifics/punctuation removed. */
export function normalizeName(s: string): string {
  return tokensOf(s).join(" ");
}

/** Phonetic-ish skeleton used for comparison. */
export function nameKey(s: string): string {
  return tokensOf(s).map(skeletonToken).filter(Boolean).join(" ");
}

export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function similarity(qKey: string, cKey: string): number {
  if (!qKey || !cKey) return 0;
  const full = levenshteinRatio(qKey, cKey);
  const qt = qKey.split(" ");
  const ct = cKey.split(" ");
  const bestPer = qt.map((q) => Math.max(...ct.map((c) => levenshteinRatio(q, c))));
  const qCover = bestPer.reduce((a, b) => a + b, 0) / qt.length;
  const cCover = bestPer.reduce((a, b) => a + b, 0) / Math.max(qt.length, ct.length);
  const token = qCover * 0.85 + cCover * 0.15;
  return Math.max(full, token);
}

/** Accepts products/context rows (`aliases`) and Customer rows (`nameAliases`) directly. */
export interface Named {
  id: string;
  name: string;
  aliases?: string[];
  nameAliases?: string[];
}
export interface Scored {
  id: string;
  name: string;
  score: number;
}
export interface MatchResult {
  best: Scored | null;
  candidates: Scored[];
}

function match(query: string, items: Named[]): MatchResult {
  const qKey = nameKey(query);
  const scored: Scored[] = items
    .map((it) => ({
      id: it.id,
      name: it.name,
      score: Math.max(...[it.name, ...(it.aliases ?? []), ...(it.nameAliases ?? [])].map((n) => similarity(qKey, nameKey(n)))),
    }))
    .sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  if (first && first.score >= 0.8 && (!second || first.score - second.score >= 0.1)) {
    return { best: first, candidates: [first] };
  }
  return { best: null, candidates: scored.filter((s) => s.score >= 0.6).slice(0, 3) };
}

export const matchCustomer = (name: string, customers: Named[]): MatchResult => match(name, customers);
export const matchProduct = (name: string, products: Named[]): MatchResult => match(name, products);
