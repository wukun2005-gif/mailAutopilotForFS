// Five demo scripts (Dev Plan §8.2): trailer90s, email1, email2, email3,
// builder. Every business beat hits the real runtime through caseActions;
// every human checkpoint is a real cursor click. Tooltip beats carry a
// `focus` data-id so the pointer sits on whatever the caption is talking
// about (thread pane, policy card, clock board, fraud panel …) — the beat
// list and the current UI are kept in lockstep on purpose.
import type { DemoScript } from "./types.ts";

// ── Trailer (~100s): 4 chapters only, stay on each screen longer ────────────
// Chapters 1–3 are runtime (intake → metrics → fraud), chapter 4 is the
// design-time layer: the runtime stays deterministic, the improvement happens
// one layer upstream and still ends in a human signature on a diff.
const trailer: DemoScript = {
  id: "trailer90s",
  nameKey: "scripts.trailer",
  beats: [
    { id: "t0", chapter: "intro", action: { t: "tooltip", key: "trailer.intro", ms: 5000 } },
    // Chapter 1: 进件→核验→自动退费（客户视角完整一条线）
    { id: "t1", chapter: "intake", action: { t: "goto", screen: "customer" } },
    { id: "t2", chapter: "intake", action: { t: "load", scenario: "email1" } },
    { id: "t3", chapter: "intake", action: { t: "inject", emailId: "EM-1-IN-1" } },
    { id: "t4", chapter: "intake", action: { t: "tooltip", key: "trailer.intake", ms: 7000, focus: "s1.thread.in" } },
    { id: "t5", chapter: "stepup", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 900 } },
    { id: "t6", chapter: "stepup", action: { t: "cursor", target: "s1.phone.otp", type: "111111", wait: 500 } },
    { id: "t7", chapter: "stepup", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1500 } },
    { id: "t8", chapter: "refund", action: { t: "tooltip", key: "trailer.refund", ms: 6000, focus: "s1.thread.out" } },
    // Chapter 2: 指标看板（主管视角）——email1 自动退费无需审批，直接看指标
    { id: "t9", chapter: "metrics", action: { t: "goto", screen: "supervisor" } },
    { id: "t10", chapter: "metrics", action: { t: "cursor", target: "s3.tab.metrics", click: true, wait: 900 } },
    { id: "t11", chapter: "metrics", action: { t: "tooltip", key: "trailer.metrics", ms: 5000, focus: "s3.metrics" } },
    // Chapter 3: BEC 隔离 + Builder 矩阵置灰（合规视角）
    { id: "t12", chapter: "fraud", action: { t: "load", scenario: "email3" } },
    { id: "t13", chapter: "fraud", action: { t: "inject", emailId: "EM-3-IN-1" } },
    { id: "t14", chapter: "fraud", action: { t: "goto", screen: "supervisor" } },
    { id: "t15", chapter: "fraud", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 900 } },
    { id: "t16", chapter: "fraud", action: { t: "tooltip", key: "trailer.fraud", ms: 5000, focus: "s3.fraud.requested" } },
    { id: "t17", chapter: "fraud", action: { t: "cursor", target: "s3.fraud.confirm", click: true, require: true, wait: 1500 } },
    { id: "t18", chapter: "builder", action: { t: "goto", screen: "builder" } },
    { id: "t19", chapter: "builder", action: { t: "tooltip", key: "trailer.builder", ms: 5000, focus: "s4.matrix.never" } },
    // Chapter 4: design-time (v0.3) — the AI nominates, the evidence argues,
    // humans sign the diff. One screen is enough for the trailer's promise.
    { id: "t19a", chapter: "design", action: { t: "cursor", target: "s4.view.nominations", click: true, wait: 900 } },
    { id: "t19b", chapter: "design", action: { t: "tooltip", key: "trailer.designTime", ms: 8000, focus: "s4.nom.NOM-B" } },
    { id: "t20", chapter: "outro", action: { t: "tooltip", key: "trailer.outro", ms: 5000 } },
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
    { id: "1-6", chapter: "day0", action: { t: "tooltip", key: "email1.lockedCell", ms: 6000, focus: "s1.autonomy.cell.I1", point: "tr" } },
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
    { id: "1-15", chapter: "stepup", action: { t: "tooltip", key: "email1.i3cell", ms: 6000, focus: "s1.autonomy.cell.I3", point: "tr" } },
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
    { id: "1-30", chapter: "day21", action: { t: "tooltip", key: "email1.cellDowngrade", ms: 6000, focus: "s1.autonomy.cell.I3", point: "tr" } },
    { id: "1-31", chapter: "day21", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    // The only agent-screen beat: which policy condition failed, and by how
    // much. The reason is only readable there.
    { id: "1-32", chapter: "day21", action: { t: "goto", screen: "agent" } },
    { id: "1-33", chapter: "day21", action: { t: "tooltip", key: "email1.secondWaiver", ms: 7000, focus: "s2.policy.row.OD-1.FAIL" } },
    // FR-12.5: the writing-time consequence preview beside the L2 explanation
    // draft — suggests connective wording only, never the decision.
    { id: "1-33a", chapter: "day21", action: { t: "tooltip", key: "email1.previewConsequence", ms: 6000, focus: "s2.draft.preview" } },
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
    { id: "2-6", chapter: "day1", action: { t: "tooltip", key: "email2.detailDenied", ms: 7000, focus: "s1.autonomy.cell.I2", point: "tr" } },
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
    { id: "2-18", chapter: "bd10", action: { t: "tooltip", key: "email2.clock48h", ms: 5500, focus: "s3.clockboard" } },
    // …then the next line names the table UNDER the chart, so the camera
    // actually scrolls down to it — one caption per frame, each frame the thing
    // its own line is talking about.
    { id: "2-18b", chapter: "bd10", action: { t: "tooltip", key: "email2.disputeTable", ms: 4500, focus: "s3.clockboard.all" } },
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

// ── Email 3 (~3min): BEC/ATO quarantine, on-file channel only ─────────────
// What this script has to carry (PRD §6.1b, the slice that belongs here —
// D2/D3/D6 live in the other scripts):
//   · D4 邮件攻击面纵深防御 — the three layers this case can actually show:
//     the protocol results read one by one, the attachment's instruction read
//     as data, and the outbound whitelist: the requested writes have no tool
//     behind them at all, so greyed buttons are not a UI decision.
//   · D1 三维放权矩阵 — this case's own R3 row, read in the audit view. The
//     before/after that matters here is not a marker moving between columns:
//     all four identity columns read 'never automatic', so no re-rating of
//     this sender could ever have released the two requested writes. The
//     graduation cap line says the same thing from the third axis.
//   · D5 片段级受控生成 — the SAR record's own lettering: one locked template,
//     no generated segment, and never transmitted to the forged address.
// The camera rule, same as email1/email2: the audit view opens for the two
// moments a differentiator is the point (the matrix row, the dossier close) and
// is folded away again immediately, so the quarantine card and the customer's
// own mail never carry a third panel the audience has to read.
const email3: DemoScript = {
  id: "email3",
  nameKey: "scripts.email3",
  beats: [
    { id: "3-0", chapter: "day2", action: { t: "goto", screen: "customer" } },
    { id: "3-1", chapter: "day2", action: { t: "load", scenario: "email3" } },
    { id: "3-2", chapter: "day2", action: { t: "inject", emailId: "EM-3-IN-1" } },
    // Start on the mail itself, not on the bank's verdict about it.
    { id: "3-3", chapter: "day2", action: { t: "tooltip", key: "email3.arrives", ms: 8000, focus: "s1.thread.in" } },
    { id: "3-4", chapter: "day2", action: { t: "tooltip", key: "email3.intakeIdentity", ms: 6000, focus: "s1.thread.in.identity" } },
    { id: "3-5", chapter: "day2", action: { t: "goto", screen: "supervisor" } },
    { id: "3-6", chapter: "day2", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 600 } },
    // D4, layer by layer, each line lit where the caption names it.
    { id: "3-7", chapter: "day2", action: { t: "tooltip", key: "email3.protocol", ms: 6500, focus: "s3.fraud.auth" } },
    { id: "3-8", chapter: "day2", action: { t: "tooltip", key: "email3.lookalike", ms: 6500, focus: "s3.fraud.signal.LOCAL_PART_LOOKALIKE" } },
    { id: "3-9", chapter: "day2", action: { t: "tooltip", key: "email3.injection", ms: 6500, focus: "s3.fraud.signal.PROMPT_INJECTION" } },
    { id: "3-10", chapter: "day2", action: { t: "tooltip", key: "email3.identityLevel", ms: 6000, focus: "s3.fraud.identity" } },
    // D1: the audit view opens on the row this case is standing in.
    { id: "3-11", chapter: "day2", action: { t: "goto", screen: "customer" } },
    { id: "3-12", chapter: "day2", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1100 } },
    { id: "3-13", chapter: "day2", action: { t: "tooltip", key: "email3.r3row", ms: 8000, focus: "s1.autonomy" } },
    { id: "3-14", chapter: "day2", action: { t: "tooltip", key: "email3.noAutonomy", ms: 7000, focus: "s1.autonomy.cap" } },
    { id: "3-15", chapter: "day2", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 900 } },
    // D4, the outbound whitelist — the reason the buttons are grey.
    { id: "3-16", chapter: "day2", action: { t: "goto", screen: "supervisor" } },
    { id: "3-17", chapter: "day2", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 600 } },
    { id: "3-18", chapter: "day2", action: { t: "tooltip", key: "email3.noTools", ms: 7500, focus: "s3.fraud.requested" } },
    { id: "3-19", chapter: "day2", action: { t: "cursor", target: "s3.fraud.confirm", click: true, require: true, wait: 1800 } },
    { id: "3-20", chapter: "day2", action: { t: "tooltip", key: "email3.onfile", ms: 6500, focus: "s3.fraud.onfile" } },
    // D5: the compliance record's own lettering, on the card that holds it.
    { id: "3-21", chapter: "day2", action: { t: "tooltip", key: "email3.sar", ms: 7500, focus: "s3.sar" } },
    { id: "3-22", chapter: "day2", action: { t: "tooltip", key: "email3.closed", ms: 6000, focus: "s3.fraud.closed" } },
    { id: "3-23", chapter: "day2", action: { t: "goto", screen: "customer" } },
    { id: "3-24", chapter: "day2", action: { t: "tooltip", key: "email3.phoneWarning", ms: 6500, focus: "s1.phone.sms" } },
    // The dossier close, lit on the newest line — the way email1/email2 sign off.
    { id: "3-25", chapter: "day2", action: { t: "cursor", target: "s1.view.audit", click: true, wait: 1100 } },
    { id: "3-26", chapter: "day2", action: { t: "tooltip", key: "email3.sealed", ms: 7000, focus: "s1.trace.entry@last" } },
    // Dossier told; fold the audit view away so the closing line lands on the
    // mail and the phone rather than on three panels at once.
    { id: "3-27", chapter: "outro", action: { t: "cursor", target: "s1.view.customer", click: true, wait: 1000 } },
    { id: "3-28", chapter: "outro", action: { t: "tooltip", key: "email3.outro", ms: 6000, focus: "s1.phone.sms" } },
  ],
};

// ── Builder (~2.5min): replay, sign-off, drift, hard never cells, live effect ───
const builder: DemoScript = {
  id: "builder",
  nameKey: "scripts.builder",
  beats: [
    { id: "b0", chapter: "matrix", action: { t: "goto", screen: "builder" } },
    // 矩阵介绍：直接在 Builder 屏开始
    { id: "b1", chapter: "matrix", action: { t: "tooltip", key: "builder.intro", ms: 6000, focus: "s4.matrix" } },
    // 回测
    { id: "b2", chapter: "backtest", action: { t: "cursor", target: "s4.backtest.run", click: true, wait: 2600 } },
    { id: "b3", chapter: "backtest", action: { t: "tooltip", key: "builder.replay", ms: 5000, focus: "s4.backtest.regretAuto" } },
    { id: "b3a", chapter: "backtest", action: { t: "tooltip", key: "builder.replayConservative", ms: 3000, focus: "s4.backtest.regretConservative" } },
    // D3: 漂移自动降级演示（先选一个已毕业 L3 的意图）
    { id: "b3b0", chapter: "backtest", action: { t: "cursor", target: "s4.intent.od_fee_refund", click: true, wait: 600 } },
    { id: "b3b1", chapter: "backtest", action: { t: "cursor", target: "s4.backtest.drift", click: true, wait: 800 } },
    { id: "b3c", chapter: "backtest", action: { t: "tooltip", key: "builder.drift", ms: 4000, focus: "s4.matrix.drift" } },
    { id: "b3d", chapter: "backtest", action: { t: "cursor", target: "s4.backtest.driftClear", click: true, wait: 600 } },
    // 漂移讲完，切回默认的影子意图——后面抽样、双签几拍都发生在这个意图上，
    // 否则签署按钮落在已双签的意图上，点了什么都不会出现。
    { id: "b3e", chapter: "backtest", action: { t: "cursor", target: "s4.intent.reg_e_intake_demo", click: true, wait: 700 } },
    // 抽样
    { id: "b4", chapter: "sampling", action: { t: "tooltip", key: "builder.sampling", ms: 5000, focus: "s4.sampling.tiers" } },
    { id: "b5", chapter: "sampling", action: { t: "cursor", target: "s4.negative.toggle", click: true, wait: 800 } },
    { id: "b6", chapter: "sampling", action: { t: "tooltip", key: "builder.unsignable", ms: 4000, focus: "s4.negative.why" } },
    { id: "b7", chapter: "sampling", action: { t: "cursor", target: "s4.negative.toggle", click: true, wait: 400 } },
    // 双签 —— 去掉 require: true，避免找不到按钮卡死
    { id: "b8", chapter: "signoff", action: { t: "cursor", target: "s4.sign.compliance", click: true, wait: 800 } },
    { id: "b9", chapter: "signoff", action: { t: "cursor", target: "s4.sign.business", click: true, wait: 800 } },
    { id: "b10", chapter: "signoff", action: { t: "cursor", target: "s4.sign.apply", click: true, wait: 1200 } },
    { id: "b11", chapter: "signoff", action: { t: "tooltip", key: "builder.promoted", ms: 4000, focus: "s4.promote.notice" } },
    // （原"切到客户视图看即时生效"的 6 拍已按要求删除，晋升完直接进入下一章）
    // D4: R3/R4 never 格子点击演示无反应 + 读 tooltip
    { id: "b12", chapter: "never", action: { t: "cursor", target: "s4.intent.contact_detail_change", click: true, wait: 800 } },
    { id: "b13", chapter: "never", action: { t: "cursor", target: "s4.matrix.never.R3", click: true, wait: 400 } },
    { id: "b13a", chapter: "never", action: { t: "tooltip", key: "builder.r3never", ms: 5000, focus: "s4.matrix.row.R3", point: "tr" } },
    { id: "b13b", chapter: "never", action: { t: "tooltip", key: "builder.noTool", ms: 3000, focus: "s4.matrix.never.R3", point: "tr" } },
    { id: "b14", chapter: "never", action: { t: "cursor", target: "s4.intent.reg_e_adjudication", click: true, wait: 800 } },
    { id: "b14a", chapter: "never", action: { t: "cursor", target: "s4.matrix.cell.R4", click: true, wait: 400 } },
    { id: "b14b", chapter: "never", action: { t: "tooltip", key: "builder.r4never", ms: 4000, focus: "s4.matrix.row.R4", point: "tr" } },
    // 稀有意图
    { id: "b15", chapter: "rare", action: { t: "cursor", target: "s4.intent.wire_recall_request", click: true, wait: 800 } },
    { id: "b15a", chapter: "rare", action: { t: "tooltip", key: "builder.rare", ms: 4000, focus: "s4.matrix.never", point: "tr" } },
    { id: "b16", chapter: "outro", action: { t: "tooltip", key: "builder.outro", ms: 5000 } },
  ],
};

// ── Day 30 (~2.5min): design-time intelligence, Act 4 of the demo ──────────
// Runtime stays deterministic; every WoW beat lives one layer upstream:
// Sense (waves) → Prove (four proofs, compiled diff) → Grant (dual sign) →
// Watch (ratchet expiry, quota, shadow). No LLM ever sits in the decision path.
const day30: DemoScript = {
  id: "day30",
  nameKey: "scripts.day30",
  beats: [
    // ── Sense: the wave board ──
    { id: "d0", chapter: "waves", action: { t: "goto", screen: "supervisor" } },
    { id: "d1", chapter: "waves", action: { t: "cursor", target: "s3.tab.waves", click: true, wait: 900 } },
    { id: "d2", chapter: "waves", action: { t: "tooltip", key: "day30.funnel", ms: 7000, focus: "s3.waves.funnel" } },
    // P0 negative wave: one-click ratchet, tighter-only, auto-expires.
    { id: "d3", chapter: "waves", action: { t: "tooltip", key: "day30.p0", ms: 6000, focus: "s3.wave.WAVE-P0" } },
    { id: "d4", chapter: "waves", action: { t: "cursor", target: "s3.waves.tighten.WAVE-P0", click: true, wait: 1000 } },
    { id: "d5", chapter: "waves", action: { t: "tooltip", key: "day30.p0applied", ms: 6000, focus: "s3.waves.applied.WAVE-P0" } },
    // P1 positive wave: proactive remediation behind three gates, staged batches.
    { id: "d6", chapter: "waves", action: { t: "tooltip", key: "day30.p1", ms: 7000, focus: "s3.wave.WAVE-P1" } },
    { id: "d7", chapter: "waves", action: { t: "cursor", target: "s3.waves.confirm.WAVE-P1", click: true, wait: 500 } },
    { id: "d8", chapter: "waves", action: { t: "cursor", target: "s3.waves.signSample.WAVE-P1", click: true, wait: 500 } },
    { id: "d9", chapter: "waves", action: { t: "cursor", target: "s3.waves.signTotal.WAVE-P1", click: true, wait: 500 } },
    { id: "d10", chapter: "waves", action: { t: "cursor", target: "s3.waves.batch.WAVE-P1", click: true, wait: 800 } },
    { id: "d11", chapter: "waves", action: { t: "cursor", target: "s3.waves.batch.WAVE-P1", click: true, wait: 800 } },
    { id: "d12", chapter: "waves", action: { t: "cursor", target: "s3.waves.batch.WAVE-P1", click: true, wait: 800 } },
    { id: "d13", chapter: "waves", action: { t: "cursor", target: "s3.waves.batch.WAVE-P1", click: true, wait: 800 } },
    { id: "d14", chapter: "waves", action: { t: "cursor", target: "s3.waves.batch.WAVE-P1", click: true, wait: 800 } },
    { id: "d15", chapter: "waves", action: { t: "cursor", target: "s3.waves.batch.WAVE-P1", click: true, wait: 800 } },
    { id: "d16", chapter: "waves", action: { t: "tooltip", key: "day30.p1batches", ms: 7000, focus: "s3.waves.batches.WAVE-P1" } },
    // P2 friction wave: route only, no money action.
    { id: "d17", chapter: "waves", action: { t: "cursor", target: "s3.waves.route.WAVE-P2", click: true, wait: 700 } },
    { id: "d18", chapter: "waves", action: { t: "tooltip", key: "day30.p2", ms: 5000, focus: "s3.waves.routed.WAVE-P2" } },
    // ── Prove & grant: nominations ──
    { id: "d19", chapter: "nominations", action: { t: "goto", screen: "builder" } },
    { id: "d20", chapter: "nominations", action: { t: "cursor", target: "s4.view.nominations", click: true, wait: 900 } },
    { id: "d21", chapter: "nominations", action: { t: "tooltip", key: "day30.nom", ms: 7000, focus: "s4.nom.NOM-A" } },
    { id: "d22", chapter: "nominations", action: { t: "cursor", target: "s4.nom.fix.NOM-A", click: true, wait: 700 } },
    { id: "d23", chapter: "nominations", action: { t: "cursor", target: "s4.nom.submit.NOM-A", click: true, wait: 700 } },
    { id: "d24", chapter: "nominations", action: { t: "cursor", target: "s4.nom.sign.compliance.NOM-B", click: true, wait: 400 } },
    { id: "d25", chapter: "nominations", action: { t: "cursor", target: "s4.nom.sign.business.NOM-B", click: true, wait: 400 } },
    { id: "d26", chapter: "nominations", action: { t: "cursor", target: "s4.nom.apply.NOM-B", click: true, wait: 900 } },
    { id: "d27", chapter: "nominations", action: { t: "tooltip", key: "day30.nomgranted", ms: 6000, focus: "s4.nom.granted.NOM-B" } },
    // ── Watch the watchmen: the canary planted among the nominations (§4.2) ──
    { id: "d27a", chapter: "nominations", action: { t: "tooltip", key: "day30.canary", ms: 6000, focus: "s4.nom.canary.NOM-CANARY" } },
    // ── Policy compiler ──
    { id: "d28", chapter: "policies", action: { t: "cursor", target: "s4.view.policies", click: true, wait: 900 } },
    { id: "d29", chapter: "policies", action: { t: "cursor", target: "s4.pol.example.COMP-1", click: true, wait: 500 } },
    { id: "d30", chapter: "policies", action: { t: "tooltip", key: "day30.pol", ms: 7000, focus: "s4.pol.artifact.COMP-1" } },
    { id: "d31", chapter: "policies", action: { t: "cursor", target: "s4.pol.sign.compliance.COMP-1", click: true, wait: 400 } },
    { id: "d32", chapter: "policies", action: { t: "cursor", target: "s4.pol.sign.business.COMP-1", click: true, wait: 400 } },
    { id: "d33", chapter: "policies", action: { t: "cursor", target: "s4.pol.apply.COMP-1", click: true, wait: 900 } },
    { id: "d34", chapter: "policies", action: { t: "tooltip", key: "day30.polgranted", ms: 5000, focus: "s4.pol.granted.COMP-1" } },
    // ── Intent discovery ──
    { id: "d35", chapter: "intents", action: { t: "cursor", target: "s4.view.intents", click: true, wait: 900 } },
    { id: "d36", chapter: "intents", action: { t: "cursor", target: "s4.cand.accept.CAND-1", click: true, wait: 700 } },
    { id: "d37", chapter: "intents", action: { t: "tooltip", key: "day30.intents", ms: 5000, focus: "s4.cand.accepted.CAND-1" } },
    // ── Watch: the preventable tag on today's inbound (FR-12.4) ──
    { id: "d38", chapter: "watch", action: { t: "goto", screen: "agent" } },
    { id: "d39", chapter: "watch", action: { t: "load", scenario: "email2" } },
    { id: "d40", chapter: "watch", action: { t: "inject", emailId: "EM-2-IN-1" } },
    { id: "d41", chapter: "watch", action: { t: "tooltip", key: "day30.preventable", ms: 6000, focus: "s2.preventable" } },
    { id: "d42", chapter: "outro", action: { t: "tooltip", key: "day30.outro", ms: 8000 } },
  ],
};

export const SCRIPTS: DemoScript[] = [trailer, email1, email2, email3, builder, day30];
export const SCRIPT_BY_ID: Record<string, DemoScript> = Object.fromEntries(
  SCRIPTS.map((s) => [s.id, s]),
);
