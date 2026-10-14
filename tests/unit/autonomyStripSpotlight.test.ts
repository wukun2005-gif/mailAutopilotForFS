// Audit-strip spotlight (AutonomyStrip via autonomyView.pickSpotlightApproval):
// clock-driven approvals (provisional credit, adjudication) surface intents
// the email turns never decide, so while pending the strip must show THEIR
// row — not stay frozen on the last email row. Email-intent approvals keep
// the latest-decision row, so scripted audit beats never move.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import "fake-indexeddb/auto";
import { handlers } from "@/mocks/handlers.ts";
import { setGatewayBase } from "@/runtime/gateway.ts";
import { CaseRunner } from "@/runtime/caseRunner.ts";
import { pickSpotlightApproval } from "@/runtime/autonomyView.ts";
import { faultController } from "@/tools/faultController.ts";

const server = setupServer(...handlers);
beforeAll(() => {
  setGatewayBase("http://localhost");
  server.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => faultController.reset());
afterEach(async () => {
  await fetch("http://localhost/mock/admin/reset", { method: "POST" });
  server.resetHandlers();
});
afterAll(() => server.close());

describe("audit-strip spotlight", () => {
  it("spotlights provisional credit at the bd10 window", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    const snap = await r.advance("bd10");
    expect(
      snap.state.approvals.some((a) => a.id === "AP-PCREDIT" && a.status === "pending"),
    ).toBe(true);
    const spot = pickSpotlightApproval(snap.state);
    expect(spot?.id).toBe("AP-PCREDIT");
    expect(spot?.intentCode).toBe("reg_e_provisional_credit");
    expect(spot?.lLevel).toBe("L2");
  });

  it("spotlights adjudication at Day 40, then falls back once chained sign-off owns it", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    await r.advance("bd10");
    await r.approve({ approvalId: "AP-PCREDIT", decision: "approve" });
    let snap = await r.advance("day40");
    expect(
      snap.state.approvals.some((a) => a.id === "AP-ADJUDICATION" && a.status === "pending"),
    ).toBe(true);
    let spot = pickSpotlightApproval(snap.state);
    expect(spot?.id).toBe("AP-ADJUDICATION");
    expect(spot?.intentCode).toBe("reg_e_adjudication");
    expect(spot?.lLevel).toBe("L1");
    // Adjudication approved → chained L1 draft sign-off is draft_signoff kind:
    // spotlight goes quiet, strip falls back to the latest email decision.
    snap = await r.approve({ approvalId: "AP-ADJUDICATION", decision: "approve", outcome: "error" });
    expect(
      snap.state.approvals.some((a) => a.id === "AP-RESULTSIGN" && a.status === "pending"),
    ).toBe(true);
    spot = pickSpotlightApproval(snap.state);
    expect(spot).toBeNull();
  });

  it("leaves email-1 rows alone: day-0 deny and day-21 second waiver never spotlight", async () => {
    const r = new CaseRunner("email1");
    await r.reset();
    let snap = await r.injectEmail("EM-1-IN-1");
    expect(pickSpotlightApproval(snap.state)).toBeNull();
    await r.stepUp("app_case_card");
    await r.advance("verify14d");
    snap = await r.injectEmail("EM-1-IN-2");
    // Second-waiver explain approval IS pending — but od_fee_refund already has
    // email-turn decisions, so the strip keeps the latest-decision row.
    expect(
      snap.state.approvals.some((a) => a.id === "AP-OD2-EXPLAIN" && a.status === "pending"),
    ).toBe(true);
    expect(pickSpotlightApproval(snap.state)).toBeNull();
  });
});
