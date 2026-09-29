// Shared helpers for the 11 mock handler groups.
import { delay, HttpResponse } from "msw";
import { simClock } from "@runtime/simClock";

export function jsonOk(body: unknown, init?: { status?: number }) {
  return HttpResponse.json(body as Record<string, unknown>, {
    status: init?.status ?? 200,
  });
}

export function jsonError(status: number, code: string, message: string) {
  return HttpResponse.json(
    { error: { code, message } },
    { status },
  );
}

/** Deterministic mock latency (no randomness in recorded mode). */
export function mockLatency(ms = 120) {
  return delay(ms);
}

export function envelope<T>(data: T, meta: Record<string, unknown> = {}) {
  return {
    data,
    meta: { simTime: simClock.now(), simDate: simClock.snapshot().isoDate, ...meta },
  };
}

/** Replay-first idempotency used by write handlers (server-side layer). */
export function idempotentResponse(
  map: Map<string, { atSimTime: number; result: unknown }>,
  key: string,
  produce: () => unknown,
) {
  const seen = map.get(key);
  if (seen) {
    return {
      replayed: true as const,
      result: seen.result,
      atSimTime: seen.atSimTime,
    };
  }
  const result = produce();
  map.set(key, { atSimTime: simClock.now(), result });
  return { replayed: false as const, result, atSimTime: simClock.now() };
}
