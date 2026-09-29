// Handler group #11 — email channel (recorded inbound injection + outbound
// audit). Outbound addresses must match the authenticated customer record;
// the spoofed address in email 3 is rejected here as well as by notify.
import { http } from "msw";
import {
  CUSTOMER_JANE,
  INBOUND_EMAILS,
  inboundFor,
  type ScenarioId,
} from "@/mocks/fixtures/index.ts";
import { mockStore } from "@/mocks/mockState.ts";
import { simClock } from "@runtime/simClock";
import { envelope, jsonError, jsonOk, mockLatency } from "./util.ts";
import { scanDlp } from "./dlp.ts";

export const emailHandlers = [
  http.post("*/mock/email/inbound", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const scenarioId = String(body.scenarioId ?? "") as ScenarioId;
    await mockLatency(60);
    const msg = inboundFor(scenarioId)[0];
    if (!msg) return jsonError(404, "SCENARIO_NOT_FOUND", scenarioId);
    mockStore.inbound.push({ scenarioId, atSimTime: simClock.now() });
    return jsonOk(envelope({ injected: true, message: msg }));
  }),

  http.get("*/mock/email/threads/:threadId", async ({ params }) => {
    await mockLatency(40);
    const msgs = INBOUND_EMAILS.filter((m) => m.threadId === params.threadId);
    return jsonOk(envelope(msgs));
  }),

  http.post("*/mock/email/send", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const to = String(body.to ?? "");
    const text = String(body.body ?? "");
    await mockLatency(150);

    if (!CUSTOMER_JANE.emailsOnFile.some((e) => to.endsWith(e))) {
      return jsonError(
        422,
        "ADDRESS_NOT_AUTHENTICATED",
        "outbound blocked: address does not match authenticated customer record",
      );
    }
    const scan = scanDlp(text);
    if (!scan.clean) {
      return jsonOk(envelope({ sent: false, blocked: true, reason: "DLP_HIT", hits: scan.hits }));
    }
    const msg = {
      id: `EM-OUT-${mockStore.messages.length + 1}`,
      to,
      channel: "email" as const,
      kind: String(body.kind ?? "reply"),
      body: text,
      atSimTime: simClock.now(),
    };
    mockStore.messages.push(msg);
    return jsonOk(envelope({ sent: true, message: msg }));
  }),
];
