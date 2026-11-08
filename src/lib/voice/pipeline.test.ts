import { describe, expect, it } from "vitest";
import type { Action } from "@/lib/llm/schema";
import { canAutoConfirm, fillBalance, languageHintsFor, sttFormatFor } from "./pipeline";

const base: Action = {
  intent: "add_credit",
  confidence: 0.95,
  customer: { id: "c1", name: "Ramesh Sharma", isNew: false },
  amountPaise: 34000,
  items: [],
  stockOps: [],
  notes: null,
  replyLanguage: "hi-IN",
  replyText: "ok",
  speakText: "कुल बाकी {balance}।",
  clarify: null,
};

describe("voice pipeline helpers", () => {
  it("language hints", () => {
    expect(languageHintsFor({ language: "kn-IN", anyLanguage: false })).toBe("kn-IN,en-IN");
    expect(languageHintsFor({ language: "en-IN", anyLanguage: false })).toBe("en-IN,hi-IN");
    expect(languageHintsFor({ language: "ta-IN", anyLanguage: true })).toBe("indic-auto");
  });

  it("stt format", () => {
    expect(sttFormatFor("hi-IN")).toBe("transcribe");
    expect(sttFormatFor("ta-IN")).toBe("verbatim");
  });

  it("fills balance token with formatted rupees", () => {
    expect(fillBalance(base.speakText, 124000)).toBe("कुल बाकी ₹1,240।");
    expect(fillBalance("no token", 100)).toBe("no token");
    expect(fillBalance("बाकी {balance} है", null)).toBe("बाकी है");
  });

  it("auto-confirm only when confident, complete, known customer", () => {
    expect(canAutoConfirm(base, null)).toBe(true);
    expect(canAutoConfirm({ ...base, confidence: 0.7 }, null)).toBe(false);
    expect(canAutoConfirm(base, "missing_amount")).toBe(false);
    expect(canAutoConfirm({ ...base, customer: { id: null, name: "X", isNew: true } }, null)).toBe(false);
  });
});
