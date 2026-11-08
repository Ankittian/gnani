import { describe, expect, it } from "vitest";
import { GnaniError, errorFromResponse } from "./errors";

const res = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("errorFromResponse", () => {
  it("maps STT unsupported format body", async () => {
    const e = await errorFromResponse(
      res(400, { success: false, error: { type: "UNSUPPORTED_AUDIO_FORMAT", message: "Unsupported audio format." } }),
      "stt",
    );
    expect(e).toBeInstanceOf(GnaniError);
    expect(e.code).toBe("UNSUPPORTED_FORMAT");
    expect(e.status).toBe(400);
    expect(e.message).toContain("Unsupported");
  });

  it("maps TTS flat 400 body to BAD_REQUEST", async () => {
    const e = await errorFromResponse(res(400, { success: false, message: "'model' is required", status_code: 400 }), "tts");
    expect(e.code).toBe("BAD_REQUEST");
    expect(e.message).toContain("model");
  });

  it.each([
    [401, "NOT_CONFIGURED"],
    [403, "NOT_CONFIGURED"],
    [402, "OUT_OF_CREDITS"],
    [429, "RATE_LIMITED"],
  ])("maps %i → %s", async (status, code) => {
    const e = await errorFromResponse(res(status, { success: false, message: "x" }), "tts");
    expect(e.code).toBe(code);
  });

  it("maps 5xx by operation", async () => {
    expect((await errorFromResponse(res(500, "boom"), "stt")).code).toBe("STT_FAILED");
    expect((await errorFromResponse(res(503, "boom"), "tts")).code).toBe("TTS_FAILED");
    expect((await errorFromResponse(res(500, "boom"), "clone")).code).toBe("CLONE_FAILED");
  });

  it("survives non-JSON bodies", async () => {
    const e = await errorFromResponse(new Response("<html>bad gateway</html>", { status: 502 }), "stt");
    expect(e.code).toBe("STT_FAILED");
    expect(e.status).toBe(502);
  });
});
