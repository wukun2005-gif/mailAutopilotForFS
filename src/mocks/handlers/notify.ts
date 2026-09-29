// Handler group #6 — on-file notification gateway (SMS / email outbox).
// Destinations NOT on the customer profile are rejected at the parameter
// layer (BEC case: the "new number" in the email never receives anything).
// Every accepted outbound is recorded for the quarantine audit trail.
import { http } from "msw";
import { CUSTOMER_JANE } from "@/mocks/fixtures/index.ts";
import { mockStore } from "@/mocks/mockState.ts";
import { simClock } from "@runtime/simClock";
import { scanDlp } from "./dlp.ts";
import { envelope, jsonError, jsonOk, mockLatency } from "./util.ts";

const ALLOWED_DESTINATIONS = new Set([
  CUSTOMER_JANE.phoneOnFile,
  ...CUSTOMER_JANE.emailsOnFile,
]);

export const notifyHandlers = [
  http.post("*/mock/notify", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await mockLatency(140);
    const to = String(body.to ?? "");
    const channel: "sms" | "email" = body.channel === "email" ? "email" : "sms";
    const text = String(body.text ?? "");

    if (!ALLOWED_DESTINATIONS.has(to)) {
      const blocked = {
        id: `NTF-BLK-${mockStore.messages.length + 1}`,
        to,
        channel,
        kind: String(body.kind ?? "notify"),
        body: text,
        atSimTime: simClock.now(),
        blockedReason: "DESTINATION_NOT_ON_FILE",
      };
      mockStore.messages.push(blocked);
      return jsonError(422, "DESTINATION_NOT_ON_FILE",
        "outbound allowed to profile contact details only",
      );
    }

    const scan = scanDlp(text);
    if (!scan.clean) {
      return jsonOk(
        envelope({
          sent: false,
          blocked: true,
          reason: "DLP_HIT",
          hits: scan.hits,
        }),
      );
    }

    const msg = {
      id: `NTF-${mockStore.messages.length + 1}`,
      to,
      channel,
      kind: String(body.kind ?? "notify"),
      body: text,
      atSimTime: simClock.now(),
    };
    mockStore.messages.push(msg);
    return jsonOk(envelope({ sent: true, message: msg }));
  }),

  http.get("*/mock/notify/audit", async () => {
    await mockLatency(60);
    return jsonOk(envelope(mockStore.messages));
  }),
];
