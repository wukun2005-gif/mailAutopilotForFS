// M1 DoD: idempotency ledger Vitest coverage (Dev Plan §6.4).
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearStores, resetDBPromise } from "@runtime/db";
import {
  listActions,
  lookupAction,
  markDone,
  markFailed,
  markInflight,
} from "@runtime/idempotency";
import { idemKey } from "@runtime/state";
import { appendEvent, listEvents } from "@runtime/eventStore";
import { simClock } from "@runtime/simClock";

beforeEach(async () => {
  resetDBPromise();
  await clearStores();
  simClock.reset();
});

afterEach(() => resetDBPromise());

describe("idempotency ledger", () => {
  it("replays the first result on a duplicate key (no second write)", async () => {
    const key = idemKey("CASE-2", "create_dispute", 1);
    const first = await markInflight(key, {
      caseId: "CASE-2",
      actionType: "create_dispute",
      seq: 1,
      traceId: "t1",
    });
    expect(first.written).toBe(true);

    // Simulated retry after timeout: second inflight attempt is a hit.
    const again = await markInflight(key, {
      caseId: "CASE-2",
      actionType: "create_dispute",
      seq: 1,
      traceId: "t2",
    });
    expect(again.written).toBe(false);
    expect(again.entry.status).toBe("inflight");

    await markDone(key, { disputeId: "DSP-77", filedAt: simClock.now() });
    const afterRetry = await lookupAction(key);
    expect(afterRetry.hit).toBe(true);
    expect(afterRetry.entry?.status).toBe("done");
    expect((afterRetry.entry?.result as { disputeId: string }).disputeId).toBe(
      "DSP-77",
    );

    const all = await listActions("CASE-2");
    expect(all).toHaveLength(1); // exactly one action row, never two
  });

  it("separates keys by case/action/seq and records failures", async () => {
    const k1 = idemKey("CASE-9", "refund_od_fee", 0);
    const k2 = idemKey("CASE-9", "refund_od_fee", 1);
    await markInflight(k1, { caseId: "CASE-9", actionType: "refund_od_fee", seq: 0, traceId: "a" });
    await markFailed(k1, "HTTP 500");
    await markInflight(k2, { caseId: "CASE-9", actionType: "refund_od_fee", seq: 1, traceId: "b" });

    const e1 = await lookupAction(k1);
    expect(e1.entry?.status).toBe("failed");
    expect(e1.entry?.error).toContain("500");
    expect((await listActions("CASE-9"))).toHaveLength(2);
  });

  it("event stream keeps per-case ordering across appends", async () => {
    await appendEvent({ caseId: "CASE-2", node: "ingest", type: "node_enter" });
    await appendEvent({ caseId: "CASE-2", node: "ingest", type: "node_exit", data: { ok: true } });
    await appendEvent({ caseId: "OTHER", node: "ingest", type: "node_enter" });
    const evs = await listEvents("CASE-2");
    expect(evs.map((e) => e.seq)).toEqual([0, 1]);
    expect(evs[1]!.simTime).toBeGreaterThan(0);
    expect(evs[1]!.wallTime).toBeGreaterThan(0);
  });
});
