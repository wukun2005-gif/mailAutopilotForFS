// Handler groups #4 (OTP / step-up) and #5 (secure message).
// Fixed OTP code "111111" — recorded demo, zero randomness. Three wrong tries
// lock the session (fault panel can pre-lock it too).
import { http } from "msw";
import { CUSTOMER_JANE } from "@/mocks/fixtures/index.ts";
import { faultController } from "@/tools/faultController.ts";
import { mockStore } from "@/mocks/mockState.ts";
import { simClock } from "@runtime/simClock";
import { envelope, jsonError, jsonOk, mockLatency } from "./util.ts";

export const RECORDED_OTP_CODE = "111111";

export const identityHandlers = [
  http.post("*/mock/otp/start", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const channel = body.channel === "link" ? "link" : "sms";
    await mockLatency(300);
    mockStore.setOtp({
      channel,
      code: RECORDED_OTP_CODE,
      attempts: 0,
      locked: false,
      startedAt: simClock.now(),
    });
    return jsonOk(
      envelope({
        started: true,
        channel,
        destination:
          channel === "sms"
            ? `on-file phone ${CUSTOMER_JANE.phoneOnFile.slice(-4)}`
            : "one-time link page (FR-2.2 fallback branch)",
        expiresInSec: channel === "sms" ? 600 : 172800,
      }),
    );
  }),

  http.post("*/mock/otp/verify", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const session = mockStore.getOtp();
    if (!session) return jsonError(409, "OTP_NOT_STARTED", "call /otp/start first");
    await mockLatency(420);
    if (faultController.isOn("otpLockout") || session.locked) {
      mockStore.setOtp({ ...session, locked: true });
      return jsonOk(
        envelope({ verified: false, locked: true, reason: "too many attempts" }),
      );
    }
    const code = String(body.code ?? "");
    if (code === session.code) {
      mockStore.setOtp({ ...session, locked: false });
      return jsonOk(envelope({ verified: true, locked: false, level: "I3" }));
    }
    session.attempts += 1;
    const locked = session.attempts >= 3;
    mockStore.setOtp({ ...session, locked });
    return jsonOk(
      envelope({
        verified: false,
        locked,
        attemptsLeft: Math.max(0, 3 - session.attempts),
      }),
    );
  }),

  http.get("*/mock/stepup-page", async () => {
    await mockLatency(80);
    return jsonOk(
      envelope({
        variant: "fallback",
        banner: {
          zh: "FR-2.2 兜底分支：仅对未开通数字银行的客户使用一次性链接。",
          en: "FR-2.2 fallback: one-time link only for customers without digital banking.",
        },
      }),
    );
  }),

  // #5 secure messages — the App case-card channel.
  http.get("*/mock/secure-messages/:customerId", async ({ params }) => {
    await mockLatency();
    if (params.customerId !== CUSTOMER_JANE.customerId)
      return jsonError(404, "CUSTOMER_NOT_FOUND", "unknown customer");
    const mine = mockStore.messages.filter(
      (m) => m.channel === "secure_message" && m.to.includes(params.customerId as string),
    );
    return jsonOk(envelope(mine));
  }),

  http.post("*/mock/secure-messages", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await mockLatency(120);
    const msg = {
      id: `SM-${mockStore.messages.length + 1}`,
      to: String(body.to ?? CUSTOMER_JANE.customerId),
      channel: "secure_message" as const,
      kind: String(body.kind ?? "case_card"),
      body: String(body.body ?? ""),
      atSimTime: simClock.now(),
    };
    mockStore.messages.push(msg);
    return jsonOk(envelope(msg));
  }),
];
