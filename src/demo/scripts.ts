// Five demo scripts (Dev Plan §8.2): trailer90s, email1, email2, email3,
// builder. Every business beat hits the real runtime through caseActions;
// every human checkpoint is a real cursor click. Tooltip beats carry a
// `focus` data-id so the pointer sits on whatever the caption is talking
// about (thread pane, policy card, clock board, fraud panel …) — the beat
// list and the current UI are kept in lockstep on purpose.
import type { DemoScript } from "./types.ts";

// ── Trailer (~90s): fast cut across all four screens ──────────────────────
const trailer: DemoScript = {
  id: "trailer90s",
  nameKey: "scripts.trailer",
  beats: [
    { id: "t0", chapter: "intro", action: { t: "tooltip", key: "trailer.intro", ms: 4000 } },
    { id: "t1", chapter: "intake", action: { t: "goto", screen: "customer" } },
    { id: "t2", chapter: "intake", action: { t: "load", scenario: "email2" } },
    { id: "t3", chapter: "intake", action: { t: "inject", emailId: "EM-2-IN-1" } },
    { id: "t4", chapter: "intake", action: { t: "tooltip", key: "trailer.intake", ms: 4000, focus: "s1.thread" } },
    { id: "t5", chapter: "stepup", action: { t: "inject", emailId: "EM-2-IN-1B" } },
    { id: "t6", chapter: "stepup", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 800 } },
    { id: "t7", chapter: "stepup", action: { t: "cursor", target: "s1.phone.otp", type: "111111", wait: 400 } },
    { id: "t8", chapter: "stepup", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1200 } },
    { id: "t9", chapter: "dossier", action: { t: "goto", screen: "agent" } },
    { id: "t10", chapter: "dossier", action: { t: "tooltip", key: "trailer.dossier", ms: 4000, focus: "s2.policy.section" } },
    { id: "t11", chapter: "clocks", action: { t: "clock", to: "bd10" } },
    { id: "t12", chapter: "clocks", action: { t: "goto", screen: "supervisor" } },
    { id: "t13", chapter: "clocks", action: { t: "cursor", target: "s3.tab.clocks", click: true, wait: 900 } },
    { id: "t14", chapter: "clocks", action: { t: "tooltip", key: "trailer.clocks", ms: 4000, focus: "s3.clockboard.all" } },
    { id: "t15", chapter: "approve", action: { t: "cursor", target: "s3.tab.queue", click: true, wait: 800 } },
    { id: "t16", chapter: "approve", action: { t: "tooltip", key: "trailer.approve", ms: 3000, focus: "s3.queue" } },
    { id: "t17", chapter: "approve", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "t17a", chapter: "metrics", action: { t: "cursor", target: "s3.tab.metrics", click: true, wait: 900 } },
    { id: "t17b", chapter: "metrics", action: { t: "tooltip", key: "trailer.metrics", ms: 4000, focus: "s3.metrics" } },
    { id: "t18", chapter: "fraud", action: { t: "load", scenario: "email3" } },
    { id: "t19", chapter: "fraud", action: { t: "inject", emailId: "EM-3-IN-1" } },
    { id: "t20", chapter: "fraud", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 900 } },
    { id: "t21", chapter: "fraud", action: { t: "tooltip", key: "trailer.fraud", ms: 4000, focus: "s3.fraud.requested" } },
    { id: "t22", chapter: "fraud", action: { t: "cursor", target: "s3.fraud.confirm", click: true, require: true, wait: 1500 } },
    { id: "t23", chapter: "builder", action: { t: "goto", screen: "builder" } },
    { id: "t24", chapter: "builder", action: { t: "tooltip", key: "trailer.builder", ms: 4000, focus: "s4.matrix" } },
    { id: "t25", chapter: "outro", action: { t: "tooltip", key: "trailer.outro", ms: 5000 } },
  ],
};

// ── Email 1 (~3min): unauthenticated public mailbox → step-up → L3 refund;
//    second waiver in the same thread stays human.
//
//    What this script has to carry (PRD §6.1b differentiators, not the whole
//    PRD — D2/D3/D6 live in the other scripts):
//      · D1 三维放权矩阵 — twice, and shown rather than said: once with the
//        case sitting in the locked I1 column, once with the same row re-read
//        at I3 and the verdict flipped to auto-execute. The row itself is the
//        audit view's matrix strip, and the marker moves because the identity
//        was re-rated, not because the script drew anything.
//      · D5 片段级受控生成 — the refund letter, coloured by source, on the
//        customer's own screen.
//      · D4 (the slice that belongs here) — the locked template carries no
//        link, and every letter passes the outbound check with AI disclosure
//        and a human handoff.
//    The audit view is opened only for the two moments where the difference is
//    the point (the matrix before/after) and closed again immediately, so the
//    customer view never carries two panels the audience has to read.
// ─────────────────────────────────────────────────────────────────────────
const email1: DemoScript = {
  id: "email1",
  nameKey: "scripts.email1",
  beats: [
    { id: "1-0", chapter: "day0", action: { t: "goto", screen: "customer" } },
    { id: "1-1", chapter: "day0", action: { t: "load", scenario: "email1" } },
    { id: "1-2", chapter: "day0", action: { t: "inject", emailId: "EM-1-IN-1" } },
    { id: "1-3", chapter: "day0", action: { t: "tooltip", key: "email1.publicMailbox", ms: 6000, focus: "s1.thread.in" } },
    // D4 (the slice that belongs to this story): the unverified reply is a
    // written-in-advance template with no link in it — said while pointing at
    // that very letter in the customer's own thread.
    { id: "1-4", chapter: "day0", action: { t: "tooltip", key: "email1.lockedTemplate", ms: 6000, focus: "s1.thread.out" } },
    // D1 before: the case is in the R2 row, identity I1, and that column
    // grants nothing. Show the row, point at the column it is standing in.
    { id: "1-5", chapter: "day0", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    { id: "1-6", chapter: "day0", action: { t: "tooltip", key: "email1.lockedCell", ms: 6000, focus: "s1.autonomy.cell.I1" } },
    // The dossier side of the same "before": the machine's own filed verdict
    // (seq 2 = the day-0 identity check) says I1. seq ids are stable because
    // the trajectory is deterministic — verified by the screenshots pass.
    { id: "1-7", chapter: "day0", action: { t: "tooltip", key: "email1.traceBefore", ms: 6000, focus: "s1.trace.entry.2" } },
    { id: "1-8", chapter: "stepup", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    { id: "1-9", chapter: "stepup", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 900 } },
    { id: "1-10", chapter: "stepup", action: { t: "tooltip", key: "email1.caseCard", ms: 5000, focus: "s1.phone.casecard" } },
    { id: "1-11", chapter: "stepup", action: { t: "cursor", target: "s1.phone.otp", type: "111111", wait: 500 } },
    { id: "1-12", chapter: "stepup", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1600 } },
    // D1 after: identity was re-rated one click ago, so the same row is read
    // again. Same screen, same row, different column, different verdict.
    { id: "1-13", chapter: "stepup", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    { id: "1-14", chapter: "stepup", action: { t: "tooltip", key: "email1.identityUp", ms: 6000, focus: "s1.identity.rise" } },
    { id: "1-15", chapter: "stepup", action: { t: "tooltip", key: "email1.i3cell", ms: 6000, focus: "s1.autonomy.cell.I3" } },
    // D1's third axis (R, I, and the graduation ceiling) — visible next to the
    // cell it is capping instead of living only in the caption.
    { id: "1-16", chapter: "stepup", action: { t: "tooltip", key: "email1.graduationCap", ms: 6000, focus: "s1.autonomy.cap" } },
    // …and the dossier side of the "after": seq 7 is the second identity
    // check, I3, filed right below the day-0 one.
    { id: "1-17", chapter: "stepup", action: { t: "tooltip", key: "email1.traceAfter", ms: 6000, focus: "s1.trace.entry.7" } },
    { id: "1-18", chapter: "refund", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    { id: "1-19", chapter: "refund", action: { t: "tooltip", key: "email1.i3refund", ms: 6000, focus: "s1.thread.out" } },
    { id: "1-20", chapter: "refund", action: { t: "tooltip", key: "email1.provenance", ms: 6000, focus: "s1.thread.out" } },
    // D4's outbound gate: the check the caption just claimed, shown as the
    // line the system itself wrote (seq 11 = the refund letter's check).
    { id: "1-21", chapter: "refund", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    { id: "1-22", chapter: "refund", action: { t: "tooltip", key: "email1.outboundGate", ms: 6000, focus: "s1.trace.entry.11" } },
    { id: "1-23", chapter: "verified", action: { t: "clock", to: "verify14d" } },
    { id: "1-24", chapter: "verified", action: { t: "tooltip", key: "email1.verified", ms: 5000, focus: "s1.trace.entry@last" } },
    { id: "1-25", chapter: "day21", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    { id: "1-26", chapter: "day21", action: { t: "inject", emailId: "EM-1-IN-2" } },
    { id: "1-27", chapter: "day21", action: { t: "tooltip", key: "email1.secondRequest", ms: 6000, focus: "s1.thread.in" } },
    { id: "1-28", chapter: "day21", action: { t: "tooltip", key: "email1.holding", ms: 5000, focus: "s1.thread.out" } },
    // D1 third read, same strip: identity is still I3, but the policy condition
    // now fails, so the same cell lands on one-click approval instead of auto.
    { id: "1-29", chapter: "day21", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    { id: "1-30", chapter: "day21", action: { t: "tooltip", key: "email1.cellDowngrade", ms: 6000, focus: "s1.autonomy.cell.I3" } },
    { id: "1-31", chapter: "day21", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    // The only agent-screen beat: which policy condition failed, and by how
    // much. The reason is only readable there.
    { id: "1-32", chapter: "day21", action: { t: "goto", screen: "agent" } },
    { id: "1-33", chapter: "day21", action: { t: "tooltip", key: "email1.secondWaiver", ms: 7000, focus: "s2.policy.row.OD-1.FAIL" } },
    { id: "1-34", chapter: "day21", action: { t: "goto", screen: "supervisor" } },
    { id: "1-35", chapter: "day21", action: { t: "tooltip", key: "email1.l2queue", ms: 5000, focus: "s3.approvalcard" } },
    { id: "1-36", chapter: "day21", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1600 } },
    { id: "1-37", chapter: "day21", action: { t: "goto", screen: "customer" } },
    { id: "1-38", chapter: "day21", action: { t: "tooltip", key: "email1.explanationSent", ms: 6000, focus: "s1.thread.out" } },
    { id: "1-39", chapter: "day21", action: { t: "clock", to: "verify14d" } },
    { id: "1-40", chapter: "day21", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    { id: "1-41", chapter: "day21", action: { t: "tooltip", key: "email1.secondClosed", ms: 6000, focus: "s1.trace.entry@last" } },
    { id: "1-42", chapter: "outro", action: { t: "tooltip", key: "email1.outro", ms: 6000, focus: "s1.thread" } },
  ],
};

// ── Email 2 (~4min): Reg E dispute across 45 days ──────────────────────────
// The camera rule, same as email1: whatever the line names must be on screen
// and lit. The matrix verdicts and the I2 → I3 rerating live in the audit
// view, so that view opens BEFORE the line that claims them and closes again
// once the identity story is told — the customer screen otherwise stays sparse.
const email2: DemoScript = {
  id: "email2",
  nameKey: "scripts.email2",
  beats: [
    { id: "2-0", chapter: "day0", action: { t: "goto", screen: "customer" } },
    { id: "2-1", chapter: "day0", action: { t: "load", scenario: "email2" } },
    { id: "2-2", chapter: "day0", action: { t: "inject", emailId: "EM-2-IN-1" } },
    // D2: arrival files the case and the clock starts — lit on the strip.
    { id: "2-3", chapter: "day0", action: { t: "tooltip", key: "email2.intake", ms: 7500, focus: "s2.clockstrip" } },
    { id: "2-4", chapter: "day1", action: { t: "inject", emailId: "EM-2-IN-1B" } },
    { id: "2-5", chapter: "day1", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    // D1: the deny verdict is the cell's text, so the cell is what gets lit.
    { id: "2-6", chapter: "day1", action: { t: "tooltip", key: "email2.detailDenied", ms: 7000, focus: "s1.autonomy.cell.I2" } },
    { id: "2-7", chapter: "day1", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 900 } },
    { id: "2-8", chapter: "day1", action: { t: "cursor", target: "s1.phone.otp", type: "111111", wait: 500 } },
    { id: "2-9", chapter: "day1", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1500 } },
    // The rerating line names the banner's exact words: I2 → I3, this conversation.
    // Frame the whole identity card, not the banner span alone: the audit column
    // is scrolled by earlier beats, so the span's own box can sit above the fold
    // while the caption is already up — the card keeps banner and checklist in view.
    { id: "2-10", chapter: "day1", action: { t: "tooltip", key: "email2.detailReleased", ms: 6000, focus: "s1.identity" } },
    // Identity story told; fold the audit view away again.
    { id: "2-11", chapter: "day1", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    { id: "2-12", chapter: "day6", action: { t: "inject", emailId: "EM-2-IN-2" } },
    // OCR confidence and "never pauses the clock" are card text — go to the card.
    { id: "2-13", chapter: "day6", action: { t: "goto", screen: "agent" } },
    { id: "2-14", chapter: "day6", action: { t: "tooltip", key: "email2.materials", ms: 7000, focus: "s2.materials" } },
    { id: "2-15", chapter: "bd10", action: { t: "clock", to: "bd10" } },
    { id: "2-16", chapter: "bd10", action: { t: "goto", screen: "supervisor" } },
    { id: "2-17", chapter: "bd10", action: { t: "cursor", target: "s3.tab.clocks", click: true, wait: 900 } },
    // The board jumps to the deadline itself: name the red bar and its 0 hours.
    // Focus the CHART, not the table under it — framing the tall table scrolls
    // the red bar off the top of the screen, which is the one thing said here.
    { id: "2-18", chapter: "bd10", action: { t: "tooltip", key: "email2.clock48h", ms: 8000, focus: "s3.clockboard" } },
    { id: "2-19", chapter: "bd10", action: { t: "cursor", target: "s3.tab.queue", click: true, wait: 900 } },
    { id: "2-20", chapter: "bd10", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "2-21", chapter: "bd10", action: { t: "goto", screen: "customer" } },
    // D5: the posting email carries the AI disclosure and the HUMAN line.
    { id: "2-22", chapter: "bd10", action: { t: "tooltip", key: "email2.pcApproved", ms: 6000, focus: "s1.thread.out" } },
    { id: "2-23", chapter: "day40", action: { t: "clock", to: "day40" } },
    // Day 40 brings no customer email — the merchant evidence arrives on the
    // adjudication card, so that card, not the thread, is where this line lands.
    { id: "2-24", chapter: "day40", action: { t: "goto", screen: "supervisor" } },
    { id: "2-25", chapter: "day40", action: { t: "tooltip", key: "email2.evidence", ms: 6500, focus: "s3.approvalcard" } },
    { id: "2-26", chapter: "day40", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    // Chained sign-off: the letter on this card is the "error occurred" finding.
    { id: "2-27", chapter: "day40", action: { t: "tooltip", key: "email2.adjudication", ms: 6500, focus: "s3.approvalcard" } },
    { id: "2-28", chapter: "day40", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "2-29", chapter: "day45", action: { t: "goto", screen: "customer" } },
    { id: "2-30", chapter: "day45", action: { t: "clock", to: "day45" } },
    { id: "2-31", chapter: "day45", action: { t: "tooltip", key: "email2.closed", ms: 6000, focus: "s1.thread.out" } },
    // The dossier close-out claim needs the dossier: open the audit view and
    // light its newest (closing) line, the way email1 signs off.
    { id: "2-32", chapter: "day45", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1200 } },
    { id: "2-33", chapter: "day45", action: { t: "tooltip", key: "email2.closedDossier", ms: 6000, focus: "s1.trace.entry@last" } },
    { id: "2-34", chapter: "outro", action: { t: "tooltip", key: "email2.outro", ms: 6000, focus: "s1.thread" } },
  ],
};

// ── Email 3 (~2min): BEC/ATO quarantine, on-file channel only ─────────────
const email3: DemoScript = {
  id: "email3",
  nameKey: "scripts.email3",
  beats: [
    { id: "3-0", chapter: "day2", action: { t: "goto", screen: "supervisor" } },
    { id: "3-1", chapter: "day2", action: { t: "load", scenario: "email3" } },
    { id: "3-2", chapter: "day2", action: { t: "inject", emailId: "EM-3-IN-1" } },
    { id: "3-3", chapter: "day2", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 900 } },
    { id: "3-4", chapter: "day2", action: { t: "tooltip", key: "email3.signals", ms: 7000, focus: "s3.quarantine" } },
    { id: "3-5", chapter: "day2", action: { t: "tooltip", key: "email3.noTools", ms: 6000, focus: "s3.fraud.requested" } },
    { id: "3-6", chapter: "day2", action: { t: "cursor", target: "s3.fraud.confirm", click: true, require: true, wait: 1500 } },
    { id: "3-7", chapter: "day2", action: { t: "goto", screen: "customer" } },
    { id: "3-8", chapter: "day2", action: { t: "tooltip", key: "email3.onfile", ms: 6000, focus: "s1.phone.sms" } },
    { id: "3-9", chapter: "day2", action: { t: "goto", screen: "supervisor" } },
    { id: "3-10", chapter: "day2", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 800 } },
    { id: "3-11", chapter: "day2", action: { t: "tooltip", key: "email3.sar", ms: 5000, focus: "s3.sar" } },
    { id: "3-12", chapter: "day2", action: { t: "tooltip", key: "email3.closed", ms: 6000, focus: "s3.fraud.onfile" } },
    { id: "3-13", chapter: "outro", action: { t: "tooltip", key: "email3.outro", ms: 6000 } },
  ],
};

// ── Builder (~2min): replay, sign-off, hard never cells ───────────────────
const builder: DemoScript = {
  id: "builder",
  nameKey: "scripts.builder",
  beats: [
    { id: "b0", chapter: "matrix", action: { t: "goto", screen: "builder" } },
    { id: "b1", chapter: "matrix", action: { t: "tooltip", key: "builder.intro", ms: 6000, focus: "s4.matrix" } },
    { id: "b2", chapter: "backtest", action: { t: "cursor", target: "s4.backtest.run", click: true, wait: 2600 } },
    { id: "b3", chapter: "backtest", action: { t: "tooltip", key: "builder.replay", ms: 5000, focus: "s4.backtest.regret" } },
    { id: "b4", chapter: "sampling", action: { t: "tooltip", key: "builder.sampling", ms: 6000, focus: "s4.sampling.tiers" } },
    { id: "b5", chapter: "sampling", action: { t: "cursor", target: "s4.negative.toggle", click: true, wait: 900 } },
    { id: "b6", chapter: "sampling", action: { t: "tooltip", key: "builder.unsignable", ms: 5000, focus: "s4.negative.why" } },
    { id: "b7", chapter: "sampling", action: { t: "cursor", target: "s4.negative.toggle", click: true, wait: 500 } },
    { id: "b8", chapter: "signoff", action: { t: "cursor", target: "s4.sign.compliance", click: true, wait: 700 } },
    { id: "b9", chapter: "signoff", action: { t: "cursor", target: "s4.sign.business", click: true, wait: 700 } },
    { id: "b10", chapter: "signoff", action: { t: "cursor", target: "s4.sign.apply", click: true, require: true, wait: 1200 } },
    { id: "b11", chapter: "signoff", action: { t: "tooltip", key: "builder.promoted", ms: 5000, focus: "s4.promote.notice" } },
    { id: "b12", chapter: "never", action: { t: "cursor", target: "s4.intent.contact_detail_change", click: true, wait: 900 } },
    { id: "b13", chapter: "never", action: { t: "tooltip", key: "builder.r3never", ms: 6000, focus: "s4.matrix.never" } },
    { id: "b14", chapter: "rare", action: { t: "cursor", target: "s4.intent.wire_recall_request", click: true, wait: 900 } },
    { id: "b15", chapter: "rare", action: { t: "tooltip", key: "builder.rare", ms: 5000, focus: "s4.conformal" } },
    { id: "b16", chapter: "outro", action: { t: "tooltip", key: "builder.outro", ms: 6000 } },
  ],
};

export const SCRIPTS: DemoScript[] = [trailer, email1, email2, email3, builder];
export const SCRIPT_BY_ID: Record<string, DemoScript> = Object.fromEntries(
  SCRIPTS.map((s) => [s.id, s]),
);
