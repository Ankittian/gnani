import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueue } from "./queue";
import { GnaniError } from "./errors";

describe("createQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("limits concurrency and preserves order of start", async () => {
    const q = createQueue({ concurrency: 1 });
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    const job = (n: number) => async () => {
      started.push(n);
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return n;
    };
    const all = Promise.all([q.run(job(1)), q.run(job(2)), q.run(job(3))]);
    await vi.runAllTimersAsync();
    expect(await all).toEqual([1, 2, 3]);
    expect(started).toEqual([1, 2, 3]);
    expect(maxActive).toBe(1);
  });

  it("retries RATE_LIMITED with 0.5/1/2 s backoff then succeeds", async () => {
    const q = createQueue({ concurrency: 1, retries: 3, baseDelayMs: 500 });
    let calls = 0;
    const p = q.run(async () => {
      calls++;
      if (calls < 3) throw new GnaniError("RATE_LIMITED", "slow down", 429);
      return "ok";
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(499);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls).toBe(3);
    expect(await p).toBe("ok");
  });

  it("gives up after retries are exhausted", async () => {
    const q = createQueue({ concurrency: 1, retries: 2, baseDelayMs: 10 });
    let calls = 0;
    const p = q.run(async () => {
      calls++;
      throw new GnaniError("RATE_LIMITED", "slow down", 429);
    });
    const assertion = expect(p).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(3);
  });

  it("does not retry other errors", async () => {
    const q = createQueue({ concurrency: 2 });
    let calls = 0;
    const p = q.run(async () => {
      calls++;
      throw new GnaniError("OUT_OF_CREDITS", "no credits", 402);
    });
    const assertion = expect(p).rejects.toMatchObject({ code: "OUT_OF_CREDITS" });
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls).toBe(1);
  });

  it("frees the slot after a failure", async () => {
    const q = createQueue({ concurrency: 1 });
    const failing = q.run(async () => {
      throw new Error("x");
    });
    const next = q.run(async () => "next");
    const assertion = expect(failing).rejects.toThrow("x");
    await vi.runAllTimersAsync();
    await assertion;
    expect(await next).toBe("next");
  });
});
