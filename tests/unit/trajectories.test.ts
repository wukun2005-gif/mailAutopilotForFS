// Three-email headless trajectories (Dev Plan §8, M2 DoD). Runs the full
// 9-node graph against the MSW mock stack with fake-indexeddb persistence.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import "fake-indexeddb/auto";
import { handlers } from "@/mocks/handlers.ts";
import { setGatewayBase } from "@/runtime/gateway.ts";
import { CaseRunner } from "@/runtime/caseRunner.ts";
import { draftText } from "@/runtime/graphRespond.ts";
import { simClock } from "@/runtime/simClock.ts";
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

describe("empty case state", () => {
  // A freshly loaded scenario has no emails, so LangGraph's append-only
  // collections do not exist yet. The V14 policy refresh (fired by a design-time
  // grant, long before any email arrives) must read that as "nothing pending".
  it("policy refresh and approval pickup no-op instead of throwing", async () => {
    const r = new CaseRunner("email1");
    await r.reset();
    expect((await r.snapshot()).state.approvals).toBeUndefined();
    await expect(r.refreshPolicy()).resolves.toBeDefined();
    await expect(r.approveDue()).resolves.toBeDefined();
  });
});

describe("email 1 — overdraft fee: deny → step-up → auto refund → verified → second waiver L2", () => {
  it("runs the full beat-1 lifecycle to a verified autonomous resolution", async () => {
    const r = new CaseRunner("email1");
    await r.reset();

    let snap = await r.injectEmail("EM-1-IN-1");
    // I1 (gmail not on file in this recorded scenario) → deny cell, case card.
    expect(snap.state.identity?.level).toBe("I1");
    expect(snap.state.status).toBe("awaiting_customer");
    expect(snap.interrupted).toBe(false);
    expect(
      snap.state.actions.some((a) => a.key.includes("casecard:EM-1-IN-1")),
    ).toBe(true);
    expect(
      snap.state.actions.some((a) => a.actionType === "refund_od_fee"),
    ).toBe(false);
    // The email thread tells the customer to open the app (no silent stall).
    expect(snap.state.outbound.some((o) => o.draftId === "DR-STEPUP-NUDGE")).toBe(true);

    // Customer completes App case-card step-up → I3 → L3 refund + letter.
    snap = await r.stepUp("app_case_card");
    expect(snap.state.identity?.level).toBe("I3");
    const refund = snap.state.actions.filter(
      (a) => a.actionType === "refund_od_fee" && a.status === "done",
    );
    expect(refund).toHaveLength(1);
    expect(snap.state.outbound.some((o) => o.draftId === "DR-OD1-REFUND")).toBe(true);
    expect(snap.state.status).toBe("pending_verify");
    // FR-10.2 / FR-10.3 footer rides every autonomous email.
    const refundDraft = snap.state.drafts.find((d) => d.id === "DR-OD1-REFUND");
    expect(refundDraft && draftText(refundDraft)).toContain("AI assistant");
    expect(refundDraft && draftText(refundDraft)).toContain("HUMAN");
    // FR-1.5: the refund letter's "within one business day" promise registers
    // on send and is fulfilled from the ledger — the refund write already
    // landed before the letter went out, so no fulfilment letter is needed.
    const pcRefund = snap.state.promiseClocks.find((p) => p.id === "PC:DR-OD1-REFUND");
    expect(pcRefund?.dueAt).toBeGreaterThan(simClock.now());
    expect(pcRefund?.fulfillByActionType).toBe("refund_od_fee");
    expect(pcRefund?.fulfilledAt).toBeGreaterThan(0);

    // +14 calendar days, no repeat contact → verified resolution.
    snap = await r.advance("verify14d");
    expect(snap.state.status).toBe("closed");
  });

  it("escalates the second waiver in 12 months to an L2 one-click approval", async () => {
    const r = new CaseRunner("email1");
    await r.reset();
    await r.injectEmail("EM-1-IN-1");
    await r.stepUp("app_case_card");
    await r.advance("verify14d");

    const snap = await r.injectEmail("EM-1-IN-2");
    expect(snap.interrupted).toBe(true);
    // Thread merge: beat 2 continues the same thread, beat-1 mail is retained.
    expect(snap.state.emails.some((e) => e.id === "EM-1-IN-1")).toBe(true);
    expect(snap.state.emails.some((e) => e.id === "EM-1-IN-2")).toBe(true);
    const approval = snap.state.approvals.find((a) => a.id === "AP-OD2-EXPLAIN");
    expect(approval?.lLevel).toBe("L2");
    // Holding reply is auto-sent on arrival; final explanation waits.
    expect(snap.state.outbound.some((o) => o.draftId === "DR-OD2-HOLDING")).toBe(true);
    // No explanation sent before supervisor approval.
    expect(snap.state.outbound.some((o) => o.draftId === "DR-OD2-EXPLAIN")).toBe(false);
    // FR-1.5: the promise ("reply within one business day") is registered the
    // moment the holding letter goes out — due = send + 1 business day — and
    // is NOT yet fulfilled. Approval carries the same deadline as countdown.
    const pc0 = snap.state.promiseClocks.find((p) => p.id === "PC:DR-OD2-HOLDING");
    expect(pc0?.sourceDraftId).toBe("DR-OD2-HOLDING");
    expect(pc0?.fulfillByDraftId).toBe("DR-OD2-EXPLAIN");
    expect(pc0?.dueAt).toBeGreaterThan(simClock.now());
    expect(pc0?.fulfilledAt).toBeUndefined();
    expect(approval?.clockDueAt).toBe(pc0?.dueAt);

    const done = await r.approve({ approvalId: "AP-OD2-EXPLAIN", decision: "approve" });
    expect(done.state.outbound.some((o) => o.draftId === "DR-OD2-EXPLAIN")).toBe(true);
    // FR-1.5: the explanation going out fulfills the promise clock.
    const pc1 = done.state.promiseClocks.find((p) => p.id === "PC:DR-OD2-HOLDING");
    expect(pc1?.fulfilledAt).toBeGreaterThan(0);
    expect(pc1?.dueAt).toBe(pc0?.dueAt);
    // Refund ledger still shows exactly one refund (second waiver never auto-paid).
    expect(
      done.state.actions.filter((a) => a.actionType === "refund_od_fee" && a.status === "done"),
    ).toHaveLength(1);

    // +14d watch after the beat-2 resolution closes the case (no time travel:
    // Day-21 content stays visible).
    const closed = await r.advance("verify14d");
    expect(closed.state.status).toBe("closed");
    expect(closed.state.emails.some((e) => e.id === "EM-1-IN-2")).toBe(true);
  });

  it("agent edit persists on the checkpoint and is what gets sent", async () => {
    const r = new CaseRunner("email1");
    await r.reset();
    await r.injectEmail("EM-1-IN-1");
    await r.stepUp("app_case_card");
    await r.advance("verify14d");
    await r.injectEmail("EM-1-IN-2");

    const edited = await r.editDraft("DR-OD2-EXPLAIN", "Jane, custom agent wording here.");
    const draft = edited.state.drafts.find((d) => d.id === "DR-OD2-EXPLAIN");
    expect(draft?.editedText).toBe("Jane, custom agent wording here.");
    expect(draftText(draft!)).toBe("Jane, custom agent wording here.");
    // Approval still pending, nothing new sent by the edit turn itself.
    expect(edited.state.approvals.find((a) => a.id === "AP-OD2-EXPLAIN")?.status).toBe("pending");
    expect(edited.state.outbound.some((o) => o.draftId === "DR-OD2-EXPLAIN")).toBe(false);

    const done = await r.approve({ approvalId: "AP-OD2-EXPLAIN", decision: "approve" });
    expect(done.state.outbound.some((o) => o.draftId === "DR-OD2-EXPLAIN")).toBe(true);
    expect(done.state.drafts.find((d) => d.id === "DR-OD2-EXPLAIN")?.editedText).toBe(
      "Jane, custom agent wording here.",
    );
  });
});

describe("email 2 — Reg E dispute: intake, clocks, restart-safe provisional credit, adjudication", () => {
  it("files the dispute and answers card status autonomously at I2", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    const snap = await r.injectEmail("EM-2-IN-1");
    expect(snap.state.identity?.level).toBe("I2");
    expect(snap.state.clocksFiled).toBe(true);
    expect(
      snap.state.actions.some((a) => a.actionType === "create_dispute" && a.status === "done"),
    ).toBe(true);
    expect(snap.state.outbound.some((o) => o.draftId === "DR-REGE-RECEIPT")).toBe(true);
    expect(snap.state.outbound.some((o) => o.draftId === "DR-CARD-STATUS")).toBe(true);
    const receipt = snap.state.drafts.find((d) => d.id === "DR-REGE-RECEIPT");
    expect(receipt && draftText(receipt)).toContain("AI assistant");
    expect(receipt && draftText(receipt)).toContain("HUMAN");
    // FR-1.5: the card letter's 10-business-day promise registers on send and
    // stays open until the fixture ETA (Day 8) is reached.
    const pcCard = snap.state.promiseClocks.find((p) => p.id === "PC:DR-CARD-STATUS");
    expect(pcCard?.dueAt).toBeGreaterThan(simClock.now());
    expect(pcCard?.fulfillByEpoch).toBeTruthy();
    expect(pcCard?.fulfilledAt).toBeUndefined();
  });

  it("denies transaction detail below I3, releases it after same-thread step-up", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    let snap = await r.injectEmail("EM-2-IN-1B");
    expect(snap.state.status).toBe("awaiting_customer");
    expect(snap.state.outbound.some((o) => o.draftId === "DR-TX-DETAIL")).toBe(false);

    snap = await r.stepUp("app_case_card");
    expect(snap.state.identity?.level).toBe("I3");
    expect(snap.state.outbound.some((o) => o.draftId === "DR-TX-DETAIL")).toBe(true);
  });

  it("auto-slots Day-6 signed statement via OCR without pausing the clock", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    const snap = await r.injectEmail("EM-2-IN-2");
    const mat = snap.state.materials.find((m) => m.code === "ATT-SIGNED");
    expect(mat?.status).toBe("received");
    expect(mat?.ocrConfidence).toBe(0.96);
    expect(snap.state.outbound.some((o) => o.draftId === "DR-MATERIALS-ACK")).toBe(true);
  });

  it("FR-1.5: low-confidence OCR promises a human review, queues a non-blocking task, never pauses", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    // One-shot fault: the Day-6 statement reads low-confidence.
    faultController.set("ocrLow", true);
    const snap = await r.injectEmail("EM-2-IN-2");
    expect(faultController.isOn("ocrLow")).toBe(false); // consumed by the OCR read

    // Material stays with the human; the letter promises a manual review.
    const mat = snap.state.materials.find((m) => m.code === "ATT-SIGNED");
    expect(mat?.status).toBe("ocr_low_confidence");
    expect(snap.state.outbound.some((o) => o.draftId === "DR-MATERIALS-ACK")).toBe(true);
    const ack = snap.state.drafts.find((d) => d.id === "DR-MATERIALS-ACK");
    expect(ack && draftText(ack)).toContain("review it manually");

    // The promise has a task behind it — and the task must not pause the case.
    const task = snap.state.approvals.find((a) => a.id === "AP-OCR-REVIEW");
    expect(task?.status).toBe("pending");
    expect(task?.blocking).toBe(false);
    expect(snap.interrupted).toBe(false);
    expect(snap.state.status).not.toBe("awaiting_human");

    // Registered open: the letter promises an action, not a time.
    const pc = snap.state.promiseClocks.find((p) => p.id === "PC:DR-MATERIALS-ACK");
    expect(pc?.dueAt).toBeUndefined();
    expect(pc?.fulfillByApprovalId).toBe("AP-OCR-REVIEW");
    expect(pc?.fulfilledAt).toBeUndefined();

    // The case keeps running: at bd10 the PAUSE is the PC approval only.
    const atBd10 = await r.advance("bd10");
    expect(atBd10.interrupted).toBe(true);
    expect(
      atBd10.state.approvals.filter((a) => a.status === "pending").map((a) => a.id).sort(),
    ).toEqual(["AP-OCR-REVIEW", "AP-PCREDIT"]);

    // Clearing the reviewer task fulfils the promise; the PC approval still holds.
    const done = await r.approve({ approvalId: "AP-OCR-REVIEW", decision: "approve" });
    const pc2 = done.state.promiseClocks.find((p) => p.id === "PC:DR-MATERIALS-ACK");
    expect(pc2?.fulfilledAt).toBeGreaterThan(0);
    expect(
      done.state.approvals.filter((a) => a.status === "pending").map((a) => a.id),
    ).toEqual(["AP-PCREDIT"]);
    expect(done.interrupted).toBe(true);
  });

  it("posts provisional credit exactly once across a restart (bd10 deadline)", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    let snap = await r.advance("bd10");
    expect(snap.interrupted).toBe(true);
    expect(snap.next).toContain("n_human_checkpoint");
    // FR-1.5: the card-arrival promise (ETA Day 8) is fulfilled now that the
    // case clock has passed it — on a turn that sent no new letter.
    const pcCard = snap.state.promiseClocks.find((p) => p.id === "PC:DR-CARD-STATUS");
    expect(pcCard?.fulfilledAt).toBeGreaterThan(0);

    // Simulate process restart: brand-new graph instance, same IDB checkpointer.
    const r2 = new CaseRunner("email2");
    snap = await r2.snapshot();
    expect(snap.interrupted).toBe(true);
    snap = await r2.approve({ approvalId: "AP-PCREDIT", decision: "approve" });
    // Resume twice (double-click / retry) must not double-post.
    const retry = await r2.approve({ approvalId: "AP-PCREDIT", decision: "approve" });
    const pc = retry.state.actions.filter(
      (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
    );
    expect(pc).toHaveLength(1);
    // Exactly one customer update email (demo runs at I3 past Day-1 step-up).
    const notices = retry.state.outbound.filter((o) => o.draftId === "DR-PC-POSTED");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.channel).toBe("email");
    const notice = retry.state.drafts.find((d) => d.id === "DR-PC-POSTED");
    expect(notice && draftText(notice)).toContain("247.18");
  });

  it("routes Day-40 merchant evidence to human adjudication then L1 result sign-off", async () => {
    const r = new CaseRunner("email2");
    await r.reset();
    await r.injectEmail("EM-2-IN-1");
    await r.advance("bd10");
    await r.approve({ approvalId: "AP-PCREDIT", decision: "approve" });
    let snap = await r.advance("day40");
    expect(snap.interrupted).toBe(true);

    snap = await r.approve({
      approvalId: "AP-ADJUDICATION",
      decision: "approve",
      outcome: "error",
    });
    // Chains into the L1 draft sign-off interrupt in the same resumed run.
    expect(snap.interrupted).toBe(true);
    expect(snap.state.approvals.some((a) => a.id === "AP-RESULTSIGN" && a.status === "pending")).toBe(true);

    snap = await r.approve({ approvalId: "AP-RESULTSIGN", decision: "approve" });
    expect(snap.state.outbound.some((o) => o.draftId === "DR-RESULT-ERROR")).toBe(true);
    const result = snap.state.drafts.find((d) => d.id === "DR-RESULT-ERROR");
    expect(result && draftText(result)).toContain("4,465.55");

    snap = await r.advance("day45");
    expect(snap.state.status).toBe("closed");
  });
});

describe("email 3 — BEC/ATO: quarantine, no R3 tools, on-file SMS only, zero reply to forger", () => {
  it("quarantines and never touches contact details; supervisor confirms fraud", async () => {
    const r = new CaseRunner("email3");
    await r.reset();
    const snap0 = await r.injectEmail("EM-3-IN-1");
    expect(snap0.state.fraud.quarantined).toBe(true);
    // Lookalike sender rates I0 (never an on-file match).
    expect(snap0.state.identity?.level).toBe("I0");
    expect(snap0.state.status).toBe("quarantined");
    expect(snap0.interrupted).toBe(true);
    // R3 contact-change tool is not registered and therefore never called.
    expect(
      snap0.state.actions.some((a) => a.actionType === "contact_detail_change"),
    ).toBe(false);
    // Nothing goes to the forged address.
    expect(snap0.state.outbound).toHaveLength(0);

    const done = await r.approve({ approvalId: "AP-FRAUD-CONFIRM", decision: "approve" });
    const sms = done.state.actions.find((a) => a.actionType === "notify_onfile");
    expect(sms).toBeTruthy();
    // The locked SAR template is recorded but blocked from transmission.
    const locked = done.state.outbound.find((o) => o.draftId === "DR-FRAUD-LOCKED");
    expect(locked?.blockedReason).toBe("ZERO_REPLY_TO_FORGED_ADDRESS");
    // Step 9: on-file warning sent → dossier sealed, case closed.
    expect(done.state.status).toBe("closed");
  });
});
