// audit:prd — deterministic conformance check between the implemented gate
// matrix and PRD v0.2 §6.2 (R × I autonomy matrix, fail-closed rules, tool
// registration). Run with `npm run audit:prd`. Exits non-zero on drift so it
// can gate CI.
import assert from "node:assert";
import { decideCell } from "../src/runtime/gates.ts";
import { assureIdentity } from "../src/runtime/identity.ts";
import { TOOL_RISK, TOOL_PATHS } from "../src/runtime/gateway.ts";
import type { ILevel, RLevel } from "../src/runtime/state.ts";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const L = (risk: RLevel, identity: ILevel, extra: Record<string, unknown> = {}) =>
  decideCell({
    intentCode: "x",
    risk,
    identity,
    policyOverall: "PASS",
    graduatedL: "L3",
    ...extra,
  });

// ── PRD §6.2 matrix ──────────────────────────────────────────────────────────

check("R3 is hard-never at every identity level and never queueable", () => {
  for (const identity of ["I0", "I1", "I2", "I3"] as ILevel[]) {
    const d = L("R3", identity);
    assert.equal(d.cell.kind, "never", `R3@${identity}`);
    assert.equal(d.queueable, false);
  }
});

check("R4 is capped at L1 at every identity level", () => {
  for (const identity of ["I0", "I1", "I2", "I3"] as ILevel[]) {
    const d = L("R4", identity, { graduatedL: null });
    assert.deepEqual(d.cell, { kind: "L", level: "L1" });
  }
});

check("R2: I0 internal intake + locked external template", () => {
  const d = L("R2", "I0", { policyOverall: "NOT_RUN" });
  assert.deepEqual(d.cell, { kind: "L", level: "L0" });
  assert.equal(d.externalLockedTemplate, true);
});

check("R2: I1 denies and routes to step-up", () => {
  const d = L("R2", "I1");
  assert.equal(d.cell.kind, "deny");
});

check("R2: I2/I3 with PASS reach L3 only after graduation", () => {
  assert.deepEqual(L("R2", "I2").cell, { kind: "L", level: "L3" });
  assert.deepEqual(L("R2", "I3").cell, { kind: "L", level: "L3" });
});

check("R2: UNKNOWN policy verdict fails closed to L0", () => {
  const d = L("R2", "I3", { policyOverall: "UNKNOWN" });
  assert.deepEqual(d.cell, { kind: "L", level: "L0" });
});

check("R2: FAIL policy verdict produces an L2 explanation draft, not an auto-write", () => {
  const d = L("R2", "I3", { policyOverall: "FAIL" });
  assert.deepEqual(d.cell, { kind: "L", level: "L2" });
  assert.equal(d.queueable, true);
});

check("R1: I0/I1 deny disclosure; I2/I3 may reach L3", () => {
  assert.equal(L("R1", "I0").cell.kind, "deny");
  assert.equal(L("R1", "I1").cell.kind, "deny");
  assert.deepEqual(L("R1", "I2").cell, { kind: "L", level: "L3" });
  assert.deepEqual(L("R1", "I3").cell, { kind: "L", level: "L3" });
});

check("R0: public info reaches L3 at any identity when graduated", () => {
  for (const identity of ["I0", "I1", "I2", "I3"] as ILevel[]) {
    assert.deepEqual(L("R0", identity).cell, { kind: "L", level: "L3" });
  }
});

check("No intent ever runs above its graduation level (fail-closed L0 pre-graduation)", () => {
  for (const risk of ["R0", "R1", "R2"] as RLevel[]) {
    const d = L(risk, "I3", { graduatedL: null, policyOverall: "PASS" });
    if (d.cell.kind === "L") assert.equal(d.cell.level === "L0", true);
  }
});

check("Second OD-fee waiver within 12 months is forced to L2 even at I3/PASS", () => {
  const d = L("R2", "I3", { secondWaiverWithin12m: true });
  assert.deepEqual(d.cell, { kind: "L", level: "L2" });
});

check("Policy-version degradation caps L3 at L2", () => {
  const d = L("R2", "I3", { policyVersionDegraded: true });
  assert.deepEqual(d.cell, { kind: "L", level: "L2" });
});

// ── Tool registration: never is enforced by absence ──────────────────────────

check("R3 actions have no registered tool path", () => {
  assert.equal(TOOL_PATHS.contact_detail_change, undefined);
  assert.equal(TOOL_PATHS.wire_recall_request, undefined);
  assert.equal(TOOL_RISK.contact_detail_change, undefined);
});

check("Provisional credit is clockDriven (statutory), not an autonomous R-write", () => {
  assert.equal(TOOL_RISK.reg_e_provisional_credit, "clockDriven");
  assert.ok(TOOL_PATHS.reg_e_provisional_credit);
});

// ── Identity gate spot checks ────────────────────────────────────────────────

check("Identity: I3 requires same-thread step-up and never inherits into a new thread", () => {
  const base = {
    addressOnFile: true, spfPass: true, dkimPass: true, dmarcPass: true,
    dkimAligned: true, lookalikeVariant: false, displayNameSpoof: false,
    fraudOrAtoSignal: false, contactChanged30d: false,
    verificationSessionExpired: false, threadClosed: false, ac3SpoofSignal: false,
    midThreadAddressChange: false,
  };
  assert.equal(assureIdentity({ ...base, stepUpInThread: true, secureMessageSession: false, isNewThread: false }).level, "I3");
  assert.notEqual(assureIdentity({ ...base, stepUpInThread: true, secureMessageSession: false, isNewThread: true }).level, "I3");
});

console.log(`\naudit:prd — ${passed} checks passed`);
