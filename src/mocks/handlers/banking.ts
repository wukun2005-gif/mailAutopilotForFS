// Handler group #1 — core banking (Fiserv DNA mock).
import { http, delay } from "msw";
import {
  ACCOUNT_CHECKING,
  CARD_REPLACEMENT,
  CUSTOMER_JANE,
  OD_FEES,
  cardsFor,
  accountsFor,
  transactionsFor,
} from "@/mocks/fixtures/index.ts";
import { faultController } from "@/tools/faultController.ts";
import { mockStore } from "@/mocks/mockState.ts";
import { envelope, idempotentResponse, jsonError, jsonOk, mockLatency } from "./util.ts";

async function readBody(req: Request) {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export const bankingHandlers = [
  http.get("*/mock/customers/:customerId", async ({ params }) => {
    await mockLatency();
    if (params.customerId !== CUSTOMER_JANE.customerId)
      return jsonError(404, "CUSTOMER_NOT_FOUND", "unknown customer");
    return jsonOk(envelope(CUSTOMER_JANE));
  }),

  http.get("*/mock/accounts", async ({ request }) => {
    await mockLatency();
    const id = new URL(request.url).searchParams.get("customerId");
    return jsonOk(envelope(accountsFor(id ?? CUSTOMER_JANE.customerId)));
  }),

  http.get("*/mock/transactions", async ({ request }) => {
    await mockLatency();
    const accountId =
      new URL(request.url).searchParams.get("accountId") ??
      ACCOUNT_CHECKING.accountId;
    return jsonOk(envelope(transactionsFor(accountId)));
  }),

  http.get("*/mock/cards", async ({ request }) => {
    await mockLatency();
    const accountId =
      new URL(request.url).searchParams.get("accountId") ??
      ACCOUNT_CHECKING.accountId;
    return jsonOk(envelope(cardsFor(accountId)));
  }),

  http.get("*/mock/od-fees", async ({ request }) => {
    await mockLatency();
    const accountId = new URL(request.url).searchParams.get("accountId");
    const fees = OD_FEES.filter((f) =>
      accountId ? f.accountId === accountId : true,
    ).map((f) => {
      const seed = `refund:${f.feeId}`;
      const waived =
        mockStore.actions.has(seed) ||
        [...mockStore.actions.keys()].some((k) => k.endsWith(`:${seed}`));
      return waived ? { ...f, waived: true } : f;
    });
    return jsonOk(envelope(fees));
  }),

  http.post("*/mock/refund-od-fee", async ({ request }) => {
    const body = await readBody(request);
    const key = String(body.key ?? "");
    if (!key) return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "key");
    // Fault demo: next core-banking write hangs 8s then fails. The gateway may
    // retry; the key means the fee is refunded at most once.
    if (faultController.consume("bankingTimeout")) {
      await delay(8000);
      return jsonError(504, "CONNECTOR_TIMEOUT", "core banking timed out");
    }
    await mockLatency(220);
    const r = idempotentResponse(mockStore.actions, key, () => ({
      feeId: String(body.feeId ?? OD_FEES[0]!.feeId),
      refundedCents: Number(body.amountCents ?? 3500),
      postedAt: new Date().toISOString(),
    }));
    return jsonOk(envelope(r.result, { idempotent: r.replayed }));
  }),

  http.post("*/mock/cards/lock", async ({ request }) => {
    const body = await readBody(request);
    const key = String(body.key ?? "");
    if (!key) return jsonError(400, "IDEMPOTENCY_KEY_REQUIRED", "key");
    if (faultController.consume("bankingTimeout")) {
      await delay(8000);
      return jsonError(504, "CONNECTOR_TIMEOUT", "core banking timed out");
    }
    await mockLatency(180);
    const r = idempotentResponse(mockStore.actions, key, () => ({
      cardRef: CARD_REPLACEMENT.cardRef,
      status: "locked",
      lockedAt: new Date().toISOString(),
    }));
    return jsonOk(envelope(r.result, { idempotent: r.replayed }));
  }),
];
