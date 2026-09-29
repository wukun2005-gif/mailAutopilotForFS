// Five demo scripts (Dev Plan §8.2): trailer90s, email1, email2, email3,
// builder. Every business beat hits the real runtime through caseActions;
// every human checkpoint is a real cursor click.
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
    { id: "t4", chapter: "intake", action: { t: "tooltip", key: "trailer.intake", ms: 4000 } },
    { id: "t5", chapter: "verify", action: { t: "inject", emailId: "EM-2-IN-1B" } },
    { id: "t6", chapter: "verify", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 800 } },
    { id: "t7", chapter: "verify", action: { t: "cursor", target: "s1.phone.otp", type: "482915", wait: 400 } },
    { id: "t8", chapter: "verify", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1200 } },
    { id: "t9", chapter: "clocks", action: { t: "clock", to: "bd10" } },
    { id: "t10", chapter: "approve", action: { t: "goto", screen: "supervisor" } },
    { id: "t11", chapter: "approve", action: { t: "tooltip", key: "trailer.approve", ms: 3000 } },
    { id: "t12", chapter: "approve", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "t13", chapter: "fraud", action: { t: "load", scenario: "email3" } },
    { id: "t14", chapter: "fraud", action: { t: "inject", emailId: "EM-3-IN-1" } },
    { id: "t15", chapter: "fraud", action: { t: "cursor", target: "s3.tab.fraud", click: true, wait: 800 } },
    { id: "t16", chapter: "fraud", action: { t: "tooltip", key: "trailer.fraud", ms: 4000 } },
    { id: "t17", chapter: "builder", action: { t: "goto", screen: "builder" } },
    { id: "t18", chapter: "builder", action: { t: "tooltip", key: "trailer.builder", ms: 4000 } },
    { id: "t19", chapter: "outro", action: { t: "tooltip", key: "trailer.outro", ms: 5000 } },
  ],
};

// ── Email 1 (~3min): unauthenticated public mailbox → step-up → L3 refund;
//    second waiver in the same thread stays human ──────────────────────────
const email1: DemoScript = {
  id: "email1",
  nameKey: "scripts.email1",
  beats: [
    { id: "1-0", chapter: "day0", action: { t: "goto", screen: "customer" } },
    { id: "1-1", chapter: "day0", action: { t: "load", scenario: "email1" } },
    { id: "1-2", chapter: "day0", action: { t: "inject", emailId: "EM-1-IN-1" } },
    { id: "1-3", chapter: "day0", action: { t: "tooltip", key: "email1.publicMailbox", ms: 6000 } },
    { id: "1-4", chapter: "stepup", action: { t: "tooltip", key: "email1.lockedCell", ms: 5000 } },
    { id: "1-5", chapter: "stepup", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 900 } },
    { id: "1-6", chapter: "stepup", action: { t: "tooltip", key: "email1.caseCard", ms: 5000 } },
    { id: "1-7", chapter: "stepup", action: { t: "cursor", target: "s1.phone.otp", type: "482915", wait: 500 } },
    { id: "1-8", chapter: "stepup", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1500 } },
    { id: "1-9", chapter: "refund", action: { t: "tooltip", key: "email1.i3refund", ms: 6000 } },
    { id: "1-10", chapter: "refund", action: { t: "cursor", target: "s1.viewtoggle", click: true, wait: 1200 } },
    { id: "1-11", chapter: "refund", action: { t: "tooltip", key: "email1.provenance", ms: 6000 } },
    { id: "1-12", chapter: "verified", action: { t: "clock", to: "verify14d" } },
    { id: "1-13", chapter: "verified", action: { t: "tooltip", key: "email1.verified", ms: 5000 } },
    { id: "1-14", chapter: "day21", action: { t: "inject", emailId: "EM-1-IN-2" } },
    { id: "1-15", chapter: "day21", action: { t: "tooltip", key: "email1.secondWaiver", ms: 7000 } },
    { id: "1-16", chapter: "day21", action: { t: "goto", screen: "supervisor" } },
    { id: "1-17", chapter: "day21", action: { t: "tooltip", key: "email1.l2queue", ms: 5000 } },
    { id: "1-18", chapter: "day21", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "1-19", chapter: "outro", action: { t: "tooltip", key: "email1.outro", ms: 6000 } },
  ],
};

// ── Email 2 (~4min): Reg E dispute across 45 days, restart-safe ───────────
const email2: DemoScript = {
  id: "email2",
  nameKey: "scripts.email2",
  beats: [
    { id: "2-0", chapter: "day0", action: { t: "goto", screen: "customer" } },
    { id: "2-1", chapter: "day0", action: { t: "load", scenario: "email2" } },
    { id: "2-2", chapter: "day0", action: { t: "inject", emailId: "EM-2-IN-1" } },
    { id: "2-3", chapter: "day0", action: { t: "tooltip", key: "email2.intake", ms: 7000 } },
    { id: "2-4", chapter: "day1", action: { t: "inject", emailId: "EM-2-IN-1B" } },
    { id: "2-5", chapter: "day1", action: { t: "tooltip", key: "email2.detailDenied", ms: 6000 } },
    { id: "2-6", chapter: "day1", action: { t: "cursor", target: "s1.phone.push", click: true, wait: 900 } },
    { id: "2-7", chapter: "day1", action: { t: "cursor", target: "s1.phone.otp", type: "482915", wait: 500 } },
    { id: "2-8", chapter: "day1", action: { t: "cursor", target: "s1.phone.verify", click: true, wait: 1500 } },
    { id: "2-9", chapter: "day1", action: { t: "tooltip", key: "email2.detailReleased", ms: 5000 } },
    { id: "2-10", chapter: "day6", action: { t: "inject", emailId: "EM-2-IN-2" } },
    { id: "2-11", chapter: "day6", action: { t: "tooltip", key: "email2.materials", ms: 5000 } },
    { id: "2-12", chapter: "bd10", action: { t: "clock", to: "bd10" } },
    { id: "2-13", chapter: "bd10", action: { t: "tooltip", key: "email2.clock48h", ms: 5000 } },
    { id: "2-14", chapter: "restart", action: { t: "cursor", target: "dev.restart", click: true, wait: 1500 } },
    { id: "2-15", chapter: "restart", action: { t: "goto", screen: "agent" } },
    { id: "2-16", chapter: "restart", action: { t: "tooltip", key: "email2.restart", ms: 7000 } },
    { id: "2-17", chapter: "bd10", action: { t: "goto", screen: "supervisor" } },
    { id: "2-18", chapter: "bd10", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "2-19", chapter: "bd10", action: { t: "tooltip", key: "email2.pcApproved", ms: 5000 } },
    { id: "2-20", chapter: "day40", action: { t: "clock", to: "day40" } },
    { id: "2-21", chapter: "day40", action: { t: "tooltip", key: "email2.evidence", ms: 5000 } },
    { id: "2-22", chapter: "day40", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1200 } },
    { id: "2-23", chapter: "day40", action: { t: "tooltip", key: "email2.adjudication", ms: 5000 } },
    { id: "2-24", chapter: "day40", action: { t: "cursor", target: "s3.approve", click: true, require: true, wait: 1500 } },
    { id: "2-25", chapter: "day45", action: { t: "goto", screen: "customer" } },
    { id: "2-26", chapter: "day45", action: { t: "clock", to: "day45" } },
    { id: "2-27", chapter: "day45", action: { t: "tooltip", key: "email2.closed", ms: 6000 } },
    { id: "2-28", chapter: "outro", action: { t: "tooltip", key: "email2.outro", ms: 6000 } },
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
    { id: "3-4", chapter: "day2", action: { t: "tooltip", key: "email3.signals", ms: 7000 } },
    { id: "3-5", chapter: "day2", action: { t: "tooltip", key: "email3.noTools", ms: 6000 } },
    { id: "3-6", chapter: "day2", action: { t: "cursor", target: "s3.fraud.confirm", click: true, require: true, wait: 1500 } },
    { id: "3-7", chapter: "day2", action: { t: "tooltip", key: "email3.onfile", ms: 6000 } },
    { id: "3-8", chapter: "day2", action: { t: "tooltip", key: "email3.sar", ms: 5000 } },
    { id: "3-9", chapter: "outro", action: { t: "tooltip", key: "email3.outro", ms: 6000 } },
  ],
};

// ── Builder (~2min): replay, sign-off, hard never cells ───────────────────
const builder: DemoScript = {
  id: "builder",
  nameKey: "scripts.builder",
  beats: [
    { id: "b0", chapter: "matrix", action: { t: "goto", screen: "builder" } },
    { id: "b1", chapter: "matrix", action: { t: "tooltip", key: "builder.intro", ms: 6000 } },
    { id: "b2", chapter: "backtest", action: { t: "cursor", target: "s4.backtest.run", click: true, wait: 3200 } },
    { id: "b3", chapter: "backtest", action: { t: "tooltip", key: "builder.replay", ms: 5000 } },
    { id: "b4", chapter: "sampling", action: { t: "tooltip", key: "builder.sampling", ms: 6000 } },
    { id: "b5", chapter: "sampling", action: { t: "cursor", target: "s4.negative.toggle", click: true, wait: 900 } },
    { id: "b6", chapter: "sampling", action: { t: "tooltip", key: "builder.unsignable", ms: 5000 } },
    { id: "b7", chapter: "sampling", action: { t: "cursor", target: "s4.negative.toggle", click: true, wait: 500 } },
    { id: "b8", chapter: "signoff", action: { t: "cursor", target: "s4.sign.compliance", click: true, wait: 700 } },
    { id: "b9", chapter: "signoff", action: { t: "cursor", target: "s4.sign.business", click: true, wait: 700 } },
    { id: "b10", chapter: "signoff", action: { t: "cursor", target: "s4.sign.apply", click: true, require: true, wait: 1200 } },
    { id: "b11", chapter: "signoff", action: { t: "tooltip", key: "builder.promoted", ms: 5000 } },
    { id: "b12", chapter: "never", action: { t: "cursor", target: "s4.intent.contact_detail_change", click: true, wait: 900 } },
    { id: "b13", chapter: "never", action: { t: "tooltip", key: "builder.r3never", ms: 6000 } },
    { id: "b14", chapter: "rare", action: { t: "cursor", target: "s4.intent.wire_recall_request", click: true, wait: 900 } },
    { id: "b15", chapter: "rare", action: { t: "tooltip", key: "builder.rare", ms: 5000 } },
    { id: "b16", chapter: "outro", action: { t: "tooltip", key: "builder.outro", ms: 6000 } },
  ],
};

export const SCRIPTS: DemoScript[] = [trailer, email1, email2, email3, builder];
export const SCRIPT_BY_ID: Record<string, DemoScript> = Object.fromEntries(
  SCRIPTS.map((s) => [s.id, s]),
);
