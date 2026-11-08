// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gnani/client", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/gnani/client")>();
  return { ...orig, stt: vi.fn(), tts: vi.fn(), cloneEmbedding: vi.fn(), ttsClone: vi.fn() };
});
vi.mock("@/lib/llm/gemini", () => ({ understand: vi.fn(), compose: vi.fn() }));

import * as client from "@/lib/gnani/client";
import * as gemini from "@/lib/llm/gemini";
import { GnaniError } from "@/lib/gnani/errors";
import type { Action } from "@/lib/llm/schema";
import { resetCaps } from "@/lib/server/caps";
import { cacheClear } from "@/lib/server/ttsCache";
import { silentWav } from "@/lib/server/mock";
import { GET as health } from "./health/route";
import { POST as sttPost } from "./stt/route";
import { POST as understandPost } from "./understand/route";
import { POST as composePost } from "./compose/route";
import { POST as ttsPost } from "./tts/route";
import { POST as clonePost } from "./clone/route";
import { POST as ttsClonePost } from "./tts-clone/route";

const sttMock = vi.mocked(client.stt);
const ttsMock = vi.mocked(client.tts);
const cloneMock = vi.mocked(client.cloneEmbedding);
const ttsCloneMock = vi.mocked(client.ttsClone);
const understandMock = vi.mocked(gemini.understand);
const composeMock = vi.mocked(gemini.compose);

beforeEach(() => {
  vi.stubEnv("MOCK_MODE", "0");
  vi.stubEnv("GNANI_API_KEY", "k");
  vi.stubEnv("GEMINI_API_KEY", "g");
  vi.resetAllMocks();
  resetCaps();
  cacheClear();
});
afterEach(() => vi.unstubAllEnvs());

const wav = (sec: number) => new File([silentWav(sec, 16000)], "speech.wav", { type: "audio/wav" });

function sttReq(fields: Record<string, string | File>, ip = "1.1.1.1") {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request("http://localhost/api/stt", { method: "POST", body: fd, headers: { "x-forwarded-for": ip } });
}
const jsonReq = (url: string, body: unknown, ip = "1.1.1.1") =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });

describe("GET /api/health", () => {
  it("reports configuration without leaking keys", async () => {
    const body = await (await health()).json();
    expect(body).toEqual({ gnani: true, gemini: true, mock: false });
  });
});

describe("POST /api/stt", () => {
  it("transcribes and returns the contract shape", async () => {
    sttMock.mockResolvedValueOnce({ transcript: "Sharma ji 340", detectedLanguageCode: "hi-IN", processingTime: 0.2 });
    const res = await sttPost(
      sttReq({ audio: wav(2), languageHints: "hi-IN,en-IN", keyterms: JSON.stringify(["Sharma ji"]), previousText: "x", format: "transcribe" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ transcript: "Sharma ji 340", detectedLanguageCode: "hi-IN", mock: false });
    expect(typeof body.latencyMs).toBe("number");
    const arg = sttMock.mock.calls[0][0];
    expect(arg).toMatchObject({ filename: "speech.wav", languageHints: "hi-IN,en-IN", keyterms: ["Sharma ji"], previousText: "x", format: "transcribe" });
  });

  it("defaults languageHints to indic-auto", async () => {
    sttMock.mockResolvedValueOnce({ transcript: "x", detectedLanguageCode: null, processingTime: null });
    await sttPost(sttReq({ audio: wav(1) }));
    expect(sttMock.mock.calls[0][0].languageHints).toBe("indic-auto");
  });

  it("rejects invalid language hints", async () => {
    const res = await sttPost(sttReq({ audio: wav(1), languageHints: "fr-FR" }));
    expect(res.status).toBe(400);
  });

  it("rejects webm with 415 before calling Gnani", async () => {
    const res = await sttPost(sttReq({ audio: new File(["abc"], "speech.webm") }));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("UNSUPPORTED_FORMAT");
    expect(sttMock).not.toHaveBeenCalled();
  });

  it("rejects WAV longer than 30 s", async () => {
    const res = await sttPost(sttReq({ audio: wav(31) }));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("AUDIO_TOO_LONG");
  });

  it("rejects missing audio", async () => {
    const res = await sttPost(sttReq({ languageHints: "hi-IN" }));
    expect(res.status).toBe(400);
  });

  it("passes OUT_OF_CREDITS through as 402", async () => {
    sttMock.mockRejectedValueOnce(new GnaniError("OUT_OF_CREDITS", "no credits", 402));
    const res = await sttPost(sttReq({ audio: wav(1) }));
    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe("OUT_OF_CREDITS");
  });

  it("enforces the per-IP daily cap", async () => {
    vi.stubEnv("DAILY_STT_CAP_PER_IP", "1");
    sttMock.mockResolvedValue({ transcript: "x", detectedLanguageCode: null, processingTime: null });
    expect((await sttPost(sttReq({ audio: wav(1) }, "9.9.9.9"))).status).toBe(200);
    const res = await sttPost(sttReq({ audio: wav(1) }, "9.9.9.9"));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("CAP_EXCEEDED");
  });

  it("serves fixtures in mock mode without calling Gnani", async () => {
    vi.stubEnv("MOCK_MODE", "1");
    const body = await (await sttPost(sttReq({ audio: wav(1) }))).json();
    expect(body.mock).toBe(true);
    expect(body.transcript.length).toBeGreaterThan(0);
    expect(sttMock).not.toHaveBeenCalled();
  });
});

const context = {
  customers: [{ id: "c1", name: "Ramesh Sharma", aliases: [], balance: 1000 }],
  products: [{ id: "p1", name: "Maggi", aliases: [], unit: "packet", pricePaise: 1400 }],
  suppliers: [],
};

describe("POST /api/understand", () => {
  it("validates the body", async () => {
    expect((await understandPost(jsonReq("/api/understand", { transcript: "" }))).status).toBe(400);
    expect(
      (await understandPost(jsonReq("/api/understand", { transcript: "x", language: "fr-FR", mode: "command", context }))).status,
    ).toBe(400);
  });

  it("returns the action from the LLM", async () => {
    const action: Action = {
      intent: "unknown",
      confidence: 0.9,
      customer: null,
      amountPaise: null,
      items: [],
      stockOps: [],
      notes: null,
      replyLanguage: "hi-IN",
      replyText: "हाँ",
      speakText: "हाँ",
      clarify: null,
    };
    understandMock.mockResolvedValueOnce(action);
    const res = await understandPost(jsonReq("/api/understand", { transcript: "garmi hai", language: "hi-IN", mode: "command", context }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(action);
    expect(understandMock.mock.calls[0][0].transcript).toBe("garmi hai");
  });

  it("uses mock rules in mock mode", async () => {
    vi.stubEnv("MOCK_MODE", "1");
    const body = await (
      await understandPost(jsonReq("/api/understand", { transcript: "Ramesh ne 200 diye", language: "hi-IN", mode: "command", context }))
    ).json();
    expect(body.intent).toBe("record_payment");
    expect(understandMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/compose", () => {
  it("composes via the LLM", async () => {
    composeMock.mockResolvedValueOnce({ displayText: "d", glossEn: "g", speakText: "s" });
    const res = await composePost(jsonReq("/api/compose", { kind: "reminder", targetLanguage: "kn-IN", data: { customerName: "Ramesh" } }));
    expect(await res.json()).toEqual({ displayText: "d", glossEn: "g", speakText: "s" });
  });

  it("rejects unknown kinds", async () => {
    expect((await composePost(jsonReq("/api/compose", { kind: "poem", targetLanguage: "kn-IN", data: {} }))).status).toBe(400);
  });

  it("maps LLM failures to a JSON error", async () => {
    composeMock.mockRejectedValueOnce(new GnaniError("LLM_INVALID_OUTPUT", "bad", 502));
    const res = await composePost(jsonReq("/api/compose", { kind: "reminder", targetLanguage: "kn-IN", data: {} }));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("LLM_INVALID_OUTPUT");
  });
});

describe("POST /api/tts", () => {
  it("returns mp3 and caches repeats", async () => {
    ttsMock.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    const body = { text: "नमस्ते", language: "hi-IN", voice: "Lakshmi" };
    const r1 = await ttsPost(jsonReq("/api/tts", body));
    expect(r1.status).toBe(200);
    expect(r1.headers.get("content-type")).toBe("audio/mpeg");
    expect(r1.headers.get("x-cache")).toBe("miss");
    const r2 = await ttsPost(jsonReq("/api/tts", body));
    expect(r2.headers.get("x-cache")).toBe("hit");
    expect(new Uint8Array(await r2.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(ttsMock).toHaveBeenCalledTimes(1);
  });

  it("defaults voice and validates input", async () => {
    ttsMock.mockResolvedValue(new Uint8Array([1]).buffer);
    await ttsPost(jsonReq("/api/tts", { text: "hi", language: "hi-en" }));
    expect(ttsMock.mock.calls[0][0]).toMatchObject({ voice: "Lakshmi", language: "hi-en", speed: 1 });
    expect((await ttsPost(jsonReq("/api/tts", { text: "hi", language: "hi-IN", voice: "Nalini" }))).status).toBe(400);
  });

  it("returns silent wav in mock mode", async () => {
    vi.stubEnv("MOCK_MODE", "1");
    const r = await ttsPost(jsonReq("/api/tts", { text: "x", language: "hi-IN" }));
    expect(r.headers.get("content-type")).toBe("audio/wav");
    expect(ttsMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/clone", () => {
  const cloneReq = (file: File) => {
    const fd = new FormData();
    fd.append("audio", file);
    return new Request("http://localhost/api/clone", { method: "POST", body: fd });
  };

  it("rejects samples shorter than 5 s", async () => {
    const res = await clonePost(cloneReq(wav(3)));
    expect(res.status).toBe(400);
    expect(cloneMock).not.toHaveBeenCalled();
  });

  it("returns the embedding", async () => {
    const embedding = { embedding: "AAAA", shape: [1, 768], dtype: "torch.bfloat16" };
    cloneMock.mockResolvedValueOnce(embedding);
    const res = await clonePost(cloneReq(wav(8)));
    expect(await res.json()).toEqual({ embedding });
  });
});

describe("POST /api/tts-clone", () => {
  const body = {
    text: "बाकी ₹340",
    language: "hi-IN",
    embedding: { embedding: "AAAA", shape: [1, 768], dtype: "torch.bfloat16" },
    fallbackVoice: "Shivani",
  };

  it("uses the cloned voice", async () => {
    ttsCloneMock.mockResolvedValueOnce(new Uint8Array([7]).buffer);
    const r = await ttsClonePost(jsonReq("/api/tts-clone", body));
    expect(r.headers.get("x-voice-fallback")).toBeNull();
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([7]));
  });

  it("falls back to the assistant voice when cloning fails", async () => {
    ttsCloneMock.mockRejectedValueOnce(new GnaniError("CLONE_FAILED", "nope", 500));
    ttsMock.mockResolvedValueOnce(new Uint8Array([8]).buffer);
    const r = await ttsClonePost(jsonReq("/api/tts-clone", body));
    expect(r.status).toBe(200);
    expect(r.headers.get("x-voice-fallback")).toBe("1");
    expect(ttsMock.mock.calls[0][0]).toMatchObject({ voice: "Shivani", language: "hi-IN" });
  });

  it("does not fall back when out of credits", async () => {
    ttsCloneMock.mockRejectedValueOnce(new GnaniError("OUT_OF_CREDITS", "no", 402));
    const r = await ttsClonePost(jsonReq("/api/tts-clone", body));
    expect(r.status).toBe(402);
    expect(ttsMock).not.toHaveBeenCalled();
  });
});
