import "server-only";
import type { ComposeRequest, UnderstandRequest } from "@/lib/api/contracts";
import type { Action, ComposeResult, Intent } from "@/lib/llm/schema";
import type { LangCode } from "@/lib/i18n/languages";
import type { CloneEmbedding } from "@/lib/types";
import type { SttResult } from "@/lib/gnani/types";

/**
 * MOCK_MODE: lets the UI be built and demoed with zero Gnani/Gemini spend.
 * Routes also fall back to these when Gnani returns OUT_OF_CREDITS (client decides).
 */
export const isMock = (): boolean => /^(1|true|yes)$/i.test(process.env.MOCK_MODE ?? "");

const MOCK_TRANSCRIPTS: SttResult[] = [
  { transcript: "Sharma ji ने 2 किलो chawal और एक surf लिया, 340 रुपये उधार लिख दो।", detectedLanguageCode: "hi-IN", processingTime: 0.2 },
  { transcript: "ರಮೇಶ್ ಐನೂರು ರೂಪಾಯಿ ಕೊಟ್ಟರು", detectedLanguageCode: "kn-IN", processingTime: 0.18 },
  { transcript: "மேகி தீர்ந்துவிட்டது, பார்லே ஜி இரண்டு பாக்கெட் மட்டும் இருக்கு", detectedLanguageCode: "ta-IN", processingTime: 0.19 },
  { transcript: "How much does Priya owe?", detectedLanguageCode: "en-IN", processingTime: 0.15 },
  { transcript: "आज का हिसाब बताओ", detectedLanguageCode: "hi-IN", processingTime: 0.16 },
];
let sttIndex = 0;

export function mockStt(): SttResult {
  const r = MOCK_TRANSCRIPTS[sttIndex % MOCK_TRANSCRIPTS.length];
  sttIndex++;
  return r;
}

const RULES: [RegExp, Intent][] = [
  [/hisaab|summary|हिसाब|ಲೆಕ್ಕ|கணக்கு/i, "daily_summary"],
  [/baaki|owe|balance|बाकी|ಬಾಕಿ|நிலுவை/i, "query_balance"],
  [/khatam|out of stock|bacha|खत्म|ಮುಗಿ|தீர்ந்த/i, "stock_update"],
  [/diye|jama|paid|दिए|जमा|ಕೊಟ್ಟ|கொடுத்த/i, "record_payment"],
  [/reminder|yaad/i, "send_reminder"],
  [/cash|nagad/i, "cash_sale"],
  [/udhaar|credit|liya|उधार|लिया|ಸಾಲ|கடன்/i, "add_credit"],
];

const NEEDS_CUSTOMER = new Set<Intent>(["add_credit", "record_payment", "query_balance", "send_reminder"]);
const NEEDS_AMOUNT = new Set<Intent>(["add_credit", "record_payment", "cash_sale"]);

const REPLY: Partial<Record<Intent, string>> = {
  add_credit: "खाते में ₹{amt} जोड़ दिए। कुल बाकी {balance}।",
  record_payment: "₹{amt} जमा हो गए। बाकी {balance}।",
  query_balance: "कुल बाकी {balance} है।",
  cash_sale: "₹{amt} की नकद बिक्री दर्ज हुई।",
  stock_update: "स्टॉक अपडेट कर दिया।",
  create_order: "नया ऑर्डर दर्ज हो गया।",
  send_reminder: "रिमाइंडर तैयार है।",
  daily_summary: "आज का हिसाब तैयार है।",
  unknown: "(mock) कोई दुकान का काम बताइए।",
};

export function mockUnderstand(req: UnderstandRequest): Action {
  const t = req.transcript;
  const intent: Intent = req.mode === "order" ? "create_order" : (RULES.find(([re]) => re.test(t))?.[1] ?? "unknown");
  const lower = t.toLowerCase();
  const named = req.context.customers.find((c) => c.name.split(/\s+/).some((part) => part.length > 2 && lower.includes(part.toLowerCase())));
  const cust = named ?? req.context.customers[0];
  const num = /(\d+(?:\.\d+)?)/.exec(t);
  const amountPaise = NEEDS_AMOUNT.has(intent) ? Math.round((num ? Number(num[1]) : 100) * 100) : null;
  const product = req.context.products.find((p) => lower.includes(p.name.toLowerCase())) ?? req.context.products[0];

  const stockOps =
    intent === "stock_update" && product
      ? [{ name: product.name, productId: product.id, op: "out" as const, qty: null, unit: product.unit }]
      : [];
  const items =
    intent === "create_order"
      ? req.context.products.slice(0, 2).map((p) => ({ name: p.name, qty: 1, unit: p.unit, productId: p.id, pricePaise: p.pricePaise }))
      : [];

  const text = (REPLY[intent] ?? "").replace("{amt}", amountPaise ? String(amountPaise / 100) : "");
  return {
    intent,
    confidence: intent === "unknown" ? 0.3 : 0.9,
    customer:
      NEEDS_CUSTOMER.has(intent) && cust ? { id: cust.id, name: cust.name, isNew: false } : intent === "add_credit" ? { id: null, name: "New Customer", isNew: true } : null,
    amountPaise,
    items,
    stockOps,
    notes: null,
    replyLanguage: req.language as LangCode,
    replyText: text.replace("{balance}", "").trim(),
    speakText: text,
    clarify: null,
  };
}

export function mockCompose(req: ComposeRequest): ComposeResult {
  const facts = Object.entries(req.data)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
  const text = `(mock ${req.kind}) ${facts}`;
  return { displayText: text, glossEn: text, speakText: text };
}

/** Valid silent mono 16-bit PCM WAV (correct header — unlike Gnani's streaming WAVs). */
export function silentWav(durationSec = 0.5, sampleRate = 16000): ArrayBuffer {
  const dataBytes = Math.round(durationSec * sampleRate) * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(buf);
  const ascii = (off: number, s: string) => [...s].forEach((ch, i) => dv.setUint8(off + i, ch.charCodeAt(0)));
  ascii(0, "RIFF");
  dv.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  ascii(36, "data");
  dv.setUint32(40, dataBytes, true);
  return buf;
}

export function mockEmbedding(): CloneEmbedding {
  return { embedding: "MOCK".repeat(16), shape: [1, 768], dtype: "torch.bfloat16" };
}
