import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCap, resetCaps } from "./caps";
import { clientIp, errorResponse, jsonError } from "./http";
import { isMock, mockCompose, mockEmbedding, mockStt, mockUnderstand, silentWav } from "./mock";
import { GnaniError } from "@/lib/gnani/errors";
import { wavDurationSec } from "./audio";
import { ActionZ, ComposeResultZ, actionProblem } from "@/lib/llm/schema";
import type { ShopContext } from "@/lib/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  resetCaps();
});

describe("http", () => {
  it("jsonError has the contract shape", async () => {
    const r = jsonError("BAD_REQUEST", "nope", 400);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: { code: "BAD_REQUEST", message: "nope", status: 400 } });
  });

  it("errorResponse maps GnaniError codes to statuses", async () => {
    expect(errorResponse(new GnaniError("OUT_OF_CREDITS", "x", 402), "STT_FAILED").status).toBe(402);
    expect(errorResponse(new GnaniError("UNSUPPORTED_FORMAT", "x", 400), "STT_FAILED").status).toBe(415);
    expect(errorResponse(new GnaniError("STT_FAILED", "x", 500), "STT_FAILED").status).toBe(502);
    const generic = errorResponse(new Error("boom"), "TTS_FAILED");
    expect(generic.status).toBe(502);
    expect((await generic.json()).error.code).toBe("TTS_FAILED");
  });

  it("clientIp prefers x-forwarded-for", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } }))).toBe("5.6.7.8");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("caps", () => {
  it("allows up to the limit per ip and kind", () => {
    expect(checkCap("a", "stt", 2)).toBe(true);
    expect(checkCap("a", "stt", 2)).toBe(true);
    expect(checkCap("a", "stt", 2)).toBe(false);
    expect(checkCap("a", "tts", 2)).toBe(true);
    expect(checkCap("b", "stt", 2)).toBe(true);
  });

  it("resets on a new UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T10:00:00Z"));
    checkCap("a", "stt", 1);
    expect(checkCap("a", "stt", 1)).toBe(false);
    vi.setSystemTime(new Date("2026-11-09T00:00:01Z"));
    expect(checkCap("a", "stt", 1)).toBe(true);
  });
});

const ctx: ShopContext = {
  customers: [
    { id: "c1", name: "Ramesh Sharma", aliases: [], balance: 50000 },
    { id: "c2", name: "Priya Nair", aliases: [], balance: 0 },
  ],
  products: [
    { id: "p1", name: "Maggi", aliases: [], unit: "packet", pricePaise: 1400 },
    { id: "p2", name: "Chawal", aliases: [], unit: "kg", pricePaise: 6000 },
  ],
  suppliers: [],
};

describe("mock", () => {
  it("isMock reads MOCK_MODE", () => {
    vi.stubEnv("MOCK_MODE", "1");
    expect(isMock()).toBe(true);
    vi.stubEnv("MOCK_MODE", "0");
    expect(isMock()).toBe(false);
  });

  it("mockStt rotates through realistic transcripts", () => {
    const a = mockStt();
    const b = mockStt();
    expect(a.transcript).not.toBe(b.transcript);
    expect(a.transcript.length).toBeGreaterThan(5);
  });

  it.each([
    ["Priya ne 500 diye", "record_payment"],
    ["Ramesh ne 340 udhaar liya", "add_credit"],
    ["Maggi khatam ho gaya", "stock_update"],
    ["Ramesh ka kitna baaki hai", "query_balance"],
    ["aaj ka hisaab", "daily_summary"],
    ["mausam accha hai", "unknown"],
  ])("mockUnderstand %s → %s (schema-valid)", (transcript, intent) => {
    const a = mockUnderstand({ transcript, language: "hi-IN", mode: "command", context: ctx });
    expect(ActionZ.parse(a).intent).toBe(intent);
    expect(actionProblem(a)).toBeNull();
  });

  it("mockUnderstand picks the named customer and the spoken amount", () => {
    const a = mockUnderstand({ transcript: "Priya ne 500 diye", language: "hi-IN", mode: "command", context: ctx });
    expect(a.customer?.id).toBe("c2");
    expect(a.amountPaise).toBe(50000);
  });

  it("mockUnderstand order mode creates an order", () => {
    const a = mockUnderstand({ transcript: "do Maggi bhejo", language: "hi-IN", mode: "order", context: ctx });
    expect(a.intent).toBe("create_order");
    expect(a.items.length).toBeGreaterThan(0);
  });

  it("mockCompose is schema-valid", () => {
    const c = mockCompose({ kind: "reminder", targetLanguage: "hi-IN", data: { customerName: "Ramesh", amountRupees: 500 } });
    expect(ComposeResultZ.parse(c).displayText).toContain("Ramesh");
  });

  it("silentWav builds a valid RIFF header for the duration", () => {
    const b = new Uint8Array(silentWav(0.5, 16000));
    const dv = new DataView(b.buffer);
    expect(String.fromCharCode(...b.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...b.slice(8, 12))).toBe("WAVE");
    expect(dv.getUint32(24, true)).toBe(16000);
    expect(dv.getUint32(40, true)).toBe(16000); // 0.5 s × 16000 × 2 bytes
    expect(b.byteLength).toBe(44 + 16000);
  });

  it("wavDurationSec handles normal and streaming (0xFFFFFFFF) headers", () => {
    const b = new Uint8Array(silentWav(2, 16000));
    expect(wavDurationSec(b)).toBeCloseTo(2);
    new DataView(b.buffer).setUint32(40, 0xffffffff, true);
    expect(wavDurationSec(b)).toBeCloseTo(2);
    expect(wavDurationSec(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("mockEmbedding has the clone shape", () => {
    expect(mockEmbedding()).toMatchObject({ shape: [1, 768], dtype: "torch.bfloat16" });
  });
});
