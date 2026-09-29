// Handler group #2 — disputes system. POST /disputes is idempotent server-side:
// the "duplicate delivery" fault sends the same key twice and only one case is
// ever created.
import { http } from "msw";
import {
  DISPUTE_EMAIL2,
  MERCHANT_EVIDENCE_DAY40,
  PROVISIONAL_CREDIT_RECORD,
} from "@/mocks/fixtures/index.ts";
import { mockStore } from "@/mocks/mockState.ts";
import { simClock } from "@runtime/simClock";
import { envelope, idempotentResponse, jsonError, jsonOk, mockLatency } from "./util.ts";

async function readBody(req: Request) {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export const disputesHandlers = [
  http.post("*/mock/disputes", async ({ request }) => {
    const body = await readBody(request);
    const key = String(body.key ?? "");
    if (!key) return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "key");
    await mockLatency(260);
    const r = idempotentResponse(mockStore.actions, key, () => {
      const record = {
        ...DISPUTE_EMAIL2,
        status: "OPEN",
        filedAt: simClock.now(),
        filedAtIso: simClock.snapshot().isoDate,
      };
      mockStore.disputes.set(DISPUTE_EMAIL2.disputeId, record);
      return record;
    });
    return jsonOk(envelope(r.result, {
      idempotent: r.replayed,
      hint: r.replayed ? "duplicate delivery replayed first result" : undefined,
    }));
  }),

  http.get("*/mock/disputes/:id", async ({ params }) => {
    await mockLatency();
    const found = mockStore.disputes.get(String(params.id));
    if (!found)
      return jsonError(404, "DISPUTE_NOT_FOUND", "file the dispute first");
    return jsonOk(envelope(found));
  }),

  http.post("*/mock/provisional-credit", async ({ request }) => {
    const body = await readBody(request);
    const key = String(body.key ?? "");
    if (!key) return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "key");
    await mockLatency(200);
    const r = idempotentResponse(mockStore.actions, key, () => ({
      disputeId: DISPUTE_EMAIL2.disputeId,
      amountCents: DISPUTE_EMAIL2.provisionalCreditCents,
      postedAt: simClock.now(),
      note: "deterministic statutory obligation, L2-approved; AI does not decide",
    }));
    return jsonOk(envelope(r.result, { idempotent: r.replayed }));
  }),

  http.get("*/mock/provisional-credit/:disputeId", async () => {
    await mockLatency();
    // The gateway idempotency key is `${caseId}:reg_e_provisional_credit:pc:DSP…`;
    // accept either the seed form or the full key when checking posted state.
    const seed = `pc:${DISPUTE_EMAIL2.disputeId}`;
    const posted =
      mockStore.actions.has(seed) ||
      [...mockStore.actions.keys()].some((k) => k.endsWith(`:${seed}`));
    return jsonOk(
      envelope({ ...PROVISIONAL_CREDIT_RECORD, postedAt: posted ? simClock.now() : null }),
    );
  }),

  http.get("*/mock/merchant-evidence/:disputeId", async () => {
    await mockLatency();
    // Package only exists after Day 40 (representment window).
    if (simClock.dayN() < MERCHANT_EVIDENCE_DAY40.receivedDayN) {
      return jsonOk(
        envelope({ available: false, arrivesDayN: MERCHANT_EVIDENCE_DAY40.receivedDayN }),
      );
    }
    return jsonOk(envelope({ available: true, ...MERCHANT_EVIDENCE_DAY40 }));
  }),
];
