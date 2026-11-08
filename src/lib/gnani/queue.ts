import "server-only";
import { GnaniError } from "./errors";

export interface QueueOptions {
  concurrency?: number;
  retries?: number;
  baseDelayMs?: number;
}

export interface Queue {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * FIFO limiter for outbound Gnani calls. Gnani may allow very few concurrent requests per key
 * and sends no Retry-After, so RATE_LIMITED errors are retried with exponential backoff.
 */
export function createQueue({ concurrency = 2, retries = 3, baseDelayMs = 500 }: QueueOptions = {}): Queue {
  let active = 0;
  const waiting: (() => void)[] = [];

  const acquire = async () => {
    if (active < concurrency) {
      active++;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
    // slot handed over by release(); `active` stays the same
  };

  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            return await fn();
          } catch (e) {
            const retryable = e instanceof GnaniError && e.code === "RATE_LIMITED";
            if (!retryable || attempt >= retries) throw e;
            await sleep(baseDelayMs * 2 ** attempt);
          }
        }
      } finally {
        release();
      }
    },
  };
}
