import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneEmbedding, normalizeFilename, stt, tts, ttsClone } from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GNANI_API_KEY", "test-key");
  vi.stubEnv("GNANI_BASE_URL", "https://api.example.test");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normalizeFilename", () => {
  it.each([
    ["voice.opus", "voice.ogg"],
    ["voice.oga", "voice.ogg"],
    ["a.mpeg", "a.mp3"],
    ["a.WAV", "a.wav"],
    ["noext", "noext.wav"],
  ])("%s → %s", (input, out) => expect(normalizeFilename(input)).toBe(out));

  it("rejects webm", () => {
    expect(() => normalizeFilename("speech.webm")).toThrow(expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }));
    expect(() => normalizeFilename("speech.weba")).toThrow(expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }));
  });
});

describe("stt", () => {
  it("posts snake_case multipart fields with the API key header", async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { success: true, transcript: "Sharma ji ने 340", detected_language_code: "hi-IN", processing_time: 0.2 }),
    );
    const r = await stt({
      audio: new Blob([new Uint8Array(10)]),
      filename: "speech.opus",
      languageHints: "hi-IN,en-IN",
      keyterms: ["Sharma ji", "Surf"],
      previousText: "pehle",
      format: "transcribe",
    });
    expect(r).toEqual({ transcript: "Sharma ji ने 340", detectedLanguageCode: "hi-IN", processingTime: 0.2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/stt/v3");
    expect(init.method).toBe("POST");
    expect(init.headers["X-API-Key-ID"]).toBe("test-key");
    const fd = init.body as FormData;
    expect(fd.get("model")).toBe("prisma-v3.0");
    expect(fd.get("language_code")).toBe("hi-IN,en-IN");
    expect(fd.get("format")).toBe("transcribe");
    expect(JSON.parse(fd.get("keyterms") as string)).toEqual(["Sharma ji", "Surf"]);
    expect(fd.get("previous_text")).toBe("pehle");
    expect((fd.get("audio_file") as File).name).toBe("speech.ogg");
  });

  it("omits optional fields and nulls an unknown language code", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, transcript: "", detected_language_code: "xx-YY" }));
    const r = await stt({ audio: new Blob(["a"]), filename: "a.wav", languageHints: "indic-auto" });
    expect(r.detectedLanguageCode).toBeNull();
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(fd.has("keyterms")).toBe(false);
    expect(fd.has("previous_text")).toBe(false);
  });

  it("caps keyterms at 200", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, transcript: "x" }));
    const terms = Array.from({ length: 250 }, (_, i) => `t${i}`);
    await stt({ audio: new Blob(["a"]), filename: "a.wav", languageHints: "hi-IN", keyterms: terms });
    const fd = fetchMock.mock.calls[0][1].body as FormData;
    expect(JSON.parse(fd.get("keyterms") as string)).toHaveLength(200);
  });

  it("rejects webm without calling Gnani", async () => {
    await expect(stt({ audio: new Blob(["a"]), filename: "a.webm", languageHints: "hi-IN" })).rejects.toMatchObject({
      code: "UNSUPPORTED_FORMAT",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps 402 to OUT_OF_CREDITS", async () => {
    fetchMock.mockResolvedValueOnce(json(402, { success: false, error: { type: "INSUFFICIENT_CREDIT", message: "no credit" } }));
    await expect(stt({ audio: new Blob(["a"]), filename: "a.wav", languageHints: "hi-IN" })).rejects.toMatchObject({
      code: "OUT_OF_CREDITS",
      status: 402,
    });
  });

  it("throws NOT_CONFIGURED when the key is missing", async () => {
    vi.stubEnv("GNANI_API_KEY", "");
    await expect(stt({ audio: new Blob(["a"]), filename: "a.wav", languageHints: "hi-IN" })).rejects.toMatchObject({
      code: "NOT_CONFIGURED",
    });
  });
});

describe("tts", () => {
  it("posts timbre-v3.0 JSON and returns audio bytes", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg" } }));
    const buf = await tts({ text: "नमस्ते", language: "hi-IN", voice: "Lakshmi", speed: 1.1 });
    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3]));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/v1/tts/inference");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers["X-API-Key-ID"]).toBe("test-key");
    expect(JSON.parse(init.body)).toEqual({
      text: "नमस्ते",
      model: "timbre-v3.0",
      voice: "Lakshmi",
      language: "hi-IN",
      speed: 1.1,
      audio_config: { sample_rate: 22050, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "mp3" },
    });
  });

  it("clamps speed to 0.85–1.15", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1])));
    await tts({ text: "a", language: "hi-IN", voice: "Lakshmi", speed: 2 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).speed).toBe(1.15);
  });

  it("maps flat TTS error body", async () => {
    fetchMock.mockResolvedValueOnce(json(400, { success: false, message: "bad voice", status_code: 400 }));
    await expect(tts({ text: "a", language: "hi-IN", voice: "Nope" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "bad voice",
    });
  });
});

describe("clone", () => {
  const embedding = { embedding: "AAAA", shape: [1, 768], dtype: "torch.bfloat16" };

  it("reads data.voice_clone_embedding", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, message: "ok", data: { voice_clone_embedding: embedding } }));
    const e = await cloneEmbedding(new Blob(["a"]), "ref.wav");
    expect(e).toEqual(embedding);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/v1/tts/voice-clone/embeddings");
    expect(((init.body as FormData).get("audio_file") as File).name).toBe("ref.wav");
  });

  it("throws CLONE_FAILED on malformed success body", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: {} }));
    await expect(cloneEmbedding(new Blob(["a"]), "ref.wav")).rejects.toMatchObject({ code: "CLONE_FAILED" });
  });

  it("ttsClone sends vachana-vc-v1 with speaker_embedding and language", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([9])));
    await ttsClone({ text: "बाकी ₹340", language: "hi-IN", embedding });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("vachana-vc-v1");
    expect(body.language).toBe("hi-IN");
    expect(body.speaker_embedding).toEqual(embedding);
    expect(body.audio_config.container).toBe("mp3");
    expect(body.voice).toBeUndefined();
  });
});
