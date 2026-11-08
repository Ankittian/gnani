import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent } };
  }),
  ThinkingLevel: { LOW: "LOW" },
}));

import { compose, generateJson, sanitizeSchema, understand } from "./gemini";
import type { UnderstandRequest } from "@/lib/api/contracts";

const ctx = {
  customers: [{ id: "c1", name: "Ramesh Sharma", aliases: ["Sharma ji"], balance: 90000 }],
  products: [{ id: "p1", name: "Chawal", aliases: ["rice"], unit: "kg" as const, pricePaise: 6000 }],
  suppliers: [],
};

const req: UnderstandRequest = { transcript: "Sharma ji ne 340 udhaar", language: "hi-IN", mode: "command", context: ctx };

const llmAction = {
  intent: "add_credit",
  confidence: 0.93,
  customer: { id: "c1", name: "Ramesh Sharma", isNew: false },
  amountRupees: 340.5,
  items: [{ name: "Chawal", qty: 2, unit: "kg", productId: "p1", priceRupees: 60 }],
  stockOps: [],
  notes: null,
  replyLanguage: "hi-IN",
  replyText: "लिख दिया",
  speakText: "₹340 जोड़ दिए। कुल बाकी {balance}।",
  clarify: null,
};

beforeEach(() => {
  generateContent.mockReset();
  vi.stubEnv("GEMINI_API_KEY", "k");
  vi.stubEnv("GEMINI_FAST_MODEL", "fast-model");
  vi.stubEnv("GEMINI_MODEL", "quality-model");
});

describe("sanitizeSchema", () => {
  it("drops $schema without mutating the input", () => {
    const s = { $schema: "x", type: "object", properties: { a: { type: "string" } } };
    const out = sanitizeSchema(s);
    expect(out).not.toHaveProperty("$schema");
    expect(out).toMatchObject({ type: "object" });
    expect(s).toHaveProperty("$schema");
  });
});

describe("generateJson", () => {
  const zod = z.object({ a: z.number() });

  it("sends JSON config and returns validated data", async () => {
    generateContent.mockResolvedValueOnce({ text: '{"a":1}' });
    const r = await generateJson({ prompt: "p", system: "s", schema: { type: "object" }, zod, models: ["m1"] });
    expect(r).toEqual({ a: 1 });
    const arg = generateContent.mock.calls[0][0];
    expect(arg.model).toBe("m1");
    expect(arg.contents).toBe("p");
    expect(arg.config.systemInstruction).toBe("s");
    expect(arg.config.responseMimeType).toBe("application/json");
    expect(arg.config.responseJsonSchema).toEqual({ type: "object" });
    expect(arg.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
  });

  it("strips markdown fences", async () => {
    generateContent.mockResolvedValueOnce({ text: '```json\n{"a":2}\n```' });
    expect(await generateJson({ prompt: "p", schema: {}, zod, models: ["m1"] })).toEqual({ a: 2 });
  });

  it("falls back to the next model on invalid output", async () => {
    generateContent.mockResolvedValueOnce({ text: '{"a":"nope"}' }).mockResolvedValueOnce({ text: '{"a":3}' });
    expect(await generateJson({ prompt: "p", schema: {}, zod, models: ["m1", "m2"] })).toEqual({ a: 3 });
    expect(generateContent.mock.calls[1][0].model).toBe("m2");
  });

  it("falls back on API errors", async () => {
    generateContent.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce({ text: '{"a":4}' });
    expect(await generateJson({ prompt: "p", schema: {}, zod, models: ["m1", "m2"] })).toEqual({ a: 4 });
  });

  it("throws LLM_INVALID_OUTPUT when every model returns bad JSON", async () => {
    generateContent.mockResolvedValue({ text: "not json" });
    await expect(generateJson({ prompt: "p", schema: {}, zod, models: ["m1", "m2"] })).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
  });

  it("throws LLM_FAILED when every model errors", async () => {
    generateContent.mockRejectedValue(new Error("down"));
    await expect(generateJson({ prompt: "p", schema: {}, zod, models: ["m1"] })).rejects.toMatchObject({ code: "LLM_FAILED" });
  });

  it("throws NOT_CONFIGURED without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateJson({ prompt: "p", schema: {}, zod, models: ["m1"] })).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });
});

describe("understand", () => {
  it("uses fast model first and converts rupees to paise", async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify(llmAction) });
    const a = await understand(req);
    expect(generateContent.mock.calls[0][0].model).toBe("fast-model");
    expect(a.amountPaise).toBe(34050);
    expect(a.items[0].pricePaise).toBe(6000);
    expect(a.customer?.id).toBe("c1");
    const prompt = generateContent.mock.calls[0][0].contents as string;
    expect(prompt).toContain("Sharma ji ne 340 udhaar");
    expect(prompt).toContain('"balanceRupees":900');
  });

  it("returns a safe unknown action when the LLM fails completely", async () => {
    generateContent.mockRejectedValue(new Error("down"));
    const a = await understand({ ...req, language: "kn-IN" });
    expect(a.intent).toBe("unknown");
    expect(a.confidence).toBe(0);
    expect(a.replyLanguage).toBe("kn-IN");
    expect(a.speakText.length).toBeGreaterThan(0);
  });

  it("uses the order system prompt in order mode", async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ ...llmAction, intent: "create_order" }) });
    await understand({ ...req, mode: "order" });
    expect(generateContent.mock.calls[0][0].config.systemInstruction).toContain("CUSTOMER's voice order");
  });
});

describe("compose", () => {
  it("uses quality model first", async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ displayText: "d", glossEn: "g", speakText: "s" }) });
    const r = await compose({ kind: "reminder", targetLanguage: "ta-IN", data: { customerName: "Murugan", amountRupees: 500 } });
    expect(r).toEqual({ displayText: "d", glossEn: "g", speakText: "s" });
    const arg = generateContent.mock.calls[0][0];
    expect(arg.model).toBe("quality-model");
    expect(arg.contents).toContain("Tamil");
    expect(arg.contents).toContain("Murugan");
  });
});
