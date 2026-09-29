// Node-side MSW integration test for the 11 mock endpoint groups.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "@/mocks/handlers.ts";

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(async () => {
  await fetch("http://localhost/mock/admin/reset", { method: "POST" });
  server.resetHandlers();
});
afterAll(() => server.close());

const BASE = "http://localhost";

async function postJson(url: string, body: unknown) {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

async function getJson(url: string) {
  const res = await fetch(BASE + url);
  return { status: res.status, json: (await res.json()) as any };
}

describe("#2 disputes — server-side idempotency", () => {
  it("creates one dispute when the same key is delivered twice", async () => {
    const payload = { key: "case-2:create_dispute:1", txId: "TX-5015" };
    const a = await postJson("/mock/disputes", payload);
    const b = await postJson("/mock/disputes", payload);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.json.meta.idempotent).toBe(false);
    expect(b.json.meta.idempotent).toBe(true);
    expect(b.json.data.disputeId).toBe("DSP-10452");

    const snap = await getJson("/mock/admin/snapshot");
    expect(snap.json.data.actionCount).toBe(1);
  });
});

describe("#6 notify — destination allow-list + #8 DLP", () => {
  it("rejects a number not on the customer profile", async () => {
    const r = await postJson("/mock/notify", {
      to: "+1-415-555-0199",
      channel: "sms",
      text: "your code is 123456",
    });
    expect(r.status).toBe(422);
    expect(r.json.error.code).toBe("DESTINATION_NOT_ON_FILE");
  });

  it("blocks outbound containing a PAN even to an on-file address", async () => {
    const r = await postJson("/mock/notify", {
      to: "jane.doe@gmail.com",
      channel: "email",
      text: "confirming card 4111 1111 1111 1111 on your account",
    });
    expect(r.json.data.blocked).toBe(true);
    expect(r.json.data.reason).toBe("DLP_HIT");
  });

  it("sends a clean message to the on-file email", async () => {
    const r = await postJson("/mock/notify", {
      to: "jane.doe@gmail.com",
      channel: "email",
      text: "Your fee waiver has been processed.",
    });
    expect(r.json.data.sent).toBe(true);
  });
});

describe("#7 statutory clocks", () => {
  it("lights bd10 provisional credit and day90 for the POS debit case at Day 0", async () => {
    const r = await getJson("/mock/clocks/DSP-10452");
    expect(r.json.data.regE.provisionalCreditDue.iso).toBe("2026-10-06");
    expect(r.json.data.regE.provisionalCreditDue.active).toBeUndefined();
    expect(r.json.data.regE.day90.iso).toBe("2026-12-21");
    expect(r.json.data.regE.day90.active).toBe(true);
    expect(r.json.data.regE.day45.active).toBe(false);
    expect(r.json.data.regZ.writtenAckDue.active).toBe(false);
  });
});

describe("#9 fraud signals", () => {
  it("returns the recorded quarantine signals for email 3", async () => {
    const r = await getJson("/mock/fraud/signals?scenarioId=email3");
    expect(r.json.data.atoScore).toBe(91);
    expect(r.json.data.localPartLookalike).toBe(true);
    expect(r.json.data.r3ComboRequested).toBe(true);
  });
});

describe("#4 OTP lockout", () => {
  it("locks after three wrong codes and keeps the recorded code working otherwise", async () => {
    await postJson("/mock/otp/start", { channel: "sms" });
    const wrong1 = await postJson("/mock/otp/verify", { code: "000000" });
    expect(wrong1.json.data.verified).toBe(false);
    expect(wrong1.json.data.attemptsLeft).toBe(2);
    await postJson("/mock/otp/verify", { code: "000000" });
    const third = await postJson("/mock/otp/verify", { code: "000000" });
    expect(third.json.data.locked).toBe(true);
    const correct = await postJson("/mock/otp/verify", { code: "111111" });
    expect(correct.json.data.locked).toBe(true);
    expect(correct.json.data.verified).toBe(false);
  });
});

describe("#10 OCR", () => {
  it("auto-slots high-confidence statements and marks low confidence as missing", async () => {
    const good = await postJson("/mock/ocr", { attachmentId: "ATT-SIGNED" });
    expect(good.json.data.confidence).toBe(0.96);
    expect(good.json.data.gateDecision).toBe("auto_slot");
    const bad = await postJson("/mock/ocr", { attachmentId: "ATT-ID" });
    expect(bad.json.data.gateDecision).toBe("missing_material");
    expect(bad.json.data.flags).toContain("HIDDEN_TEXT_INJECTION");
  });
});

describe("#3 policy shell", () => {
  it("evaluates V12 conditions from supplied evidence", async () => {
    const r = await postJson("/mock/policy/evaluate", {
      policyId: "OD_FEE_WAIVER_V12",
      evidence: { waivers12m: 1, accountStatus: "good", feeAmountCents: 3500 },
    });
    expect(r.json.data.version).toBe("V12");
    expect(r.json.data.overall).toBe("PASS");
  });
});
