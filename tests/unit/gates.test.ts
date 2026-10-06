// Fail-closed gate matrix tests (Dev Plan §6.3 "fail-closed 的具体含义").
import { describe, expect, it } from "vitest";
import { decideCell, identityCeiling } from "@/runtime/gates.ts";
import { TOOL_RISK, TOOL_PATHS, createGateway, setGatewayBase } from "@/runtime/gateway.ts";

const base = {
  intentCode: "general_inquiry",
  identity: "I2" as const,
  policyOverall: "PASS" as const,
  graduatedL: "L3" as const,
};

describe("decideCell — fail-closed matrix", () => {
  it("never graduates above the table: no graduation → L0 even when everything else passes", () => {
    const d = decideCell({ ...base, risk: "R1", graduatedL: null });
    expect(d.cell).toEqual({ kind: "L", level: "L0" });
    expect(d.reasonCodes.join(" ")).toContain("NOT_GRADUATED");
  });

  it("UNKNOWN policy verdict fails closed to L0 for R2 writes", () => {
    const d = decideCell({ ...base, risk: "R2", identity: "I3", policyOverall: "UNKNOWN" });
    expect(d.cell).toEqual({ kind: "L", level: "L0" });
  });

  it("R3 contact changes are hard-never in the email channel and never queueable", () => {
    const d = decideCell({ ...base, risk: "R3", identity: "I3" });
    expect(d.cell.kind).toBe("never");
    expect(d.queueable).toBe(false);
  });

  it("R4 adjudication is permanently human (L0 decision / L1 draft), identity cannot raise it", () => {
    for (const identity of ["I0", "I1", "I2", "I3"] as const) {
      const d = decideCell({ ...base, risk: "R4", identity, graduatedL: null });
      expect(d.cell).toEqual({ kind: "L", level: "L1" });
      expect(d.queueable).toBe(true);
    }
  });

  it("R2×I0 runs internal intake but locks the external reply to a template", () => {
    const d = decideCell({ ...base, risk: "R2", identity: "I0", policyOverall: "NOT_RUN" });
    expect(d.cell).toEqual({ kind: "L", level: "L0" });
    expect(d.externalLockedTemplate).toBe(true);
  });

  it("R2×I1 denies the grant and guides to step-up", () => {
    const d = decideCell({ ...base, risk: "R2", identity: "I1", policyOverall: "PASS" });
    expect(d.cell.kind).toBe("deny");
    expect(d.reasonCodes).toContain("DRAFT_CHANNEL_CLOSED");
  });

  it("R1×I0 and R1×I1 deny disclosure; R1×I2 reaches L3 only after graduation", () => {
    expect(decideCell({ ...base, risk: "R1", identity: "I0", graduatedL: "L3" }).cell.kind).toBe("deny");
    expect(decideCell({ ...base, risk: "R1", identity: "I1", graduatedL: "L3" }).cell.kind).toBe("deny");
    const i2 = decideCell({ ...base, risk: "R1", identity: "I2" });
    expect(i2.cell).toEqual({ kind: "L", level: "L3" });
  });

  it("second waiver within 12 months is forced to L2 only when the policy does not pass; V14 goodwill PASS graduates to L3", () => {
    const forced = decideCell({
      ...base, risk: "R2", identity: "I3", secondWaiverWithin12m: true, policyOverall: "FAIL",
    });
    expect(forced.cell).toEqual({ kind: "L", level: "L2" });
    expect(forced.queueable).toBe(true);
    const goodwill = decideCell({
      ...base, risk: "R2", identity: "I3", secondWaiverWithin12m: true, policyOverall: "PASS",
    });
    expect(goodwill.cell).toEqual({ kind: "L", level: "L3" });
  });

  it("policy-version degradation caps an L3 intent at L2", () => {
    const d = decideCell({ ...base, risk: "R2", identity: "I3", policyVersionDegraded: true });
    expect(d.cell).toEqual({ kind: "L", level: "L2" });
  });

  it("unknown risk fails closed to L0", () => {
    // @ts-expect-error deliberately unknown risk
    const d = decideCell({ ...base, risk: "R9" });
    expect(d.cell).toEqual({ kind: "L", level: "L0" });
  });

  it("identity ceiling: R1/R2 allow L3 at I2/I3, never at I0/I1; R4 capped L1", () => {
    expect(identityCeiling("R1", "I2")).toBe("L3");
    expect(identityCeiling("R2", "I1")).toBeNull();
    expect(identityCeiling("R4", "I3")).toBe("L1");
  });
});

describe("gateway — tool registration is the enforcement point for never", () => {
  it("registers no R3 contact-change tool at all", () => {
    expect(TOOL_RISK.contact_detail_change).toBeUndefined();
    expect(TOOL_PATHS.contact_detail_change).toBeUndefined();
    expect(TOOL_RISK.wire_recall_request).toBeUndefined();
  });

  it("provisional credit is registered as clockDriven, not as an autonomous R3/R4 write", () => {
    expect(TOOL_RISK.reg_e_provisional_credit).toBe("clockDriven");
    expect(TOOL_PATHS.reg_e_provisional_credit).toBe("/mock/provisional-credit");
  });

  it("calling an unregistered action rejects without any network call", async () => {
    setGatewayBase("http://localhost");
    const gw = createGateway();
    await expect(
      gw.callWrite({
        caseId: "c", actionType: "contact_detail_change", keySeed: "x",
        body: { phone: "000" },
      }),
    ).rejects.toMatchObject({ code: "TOOL_NOT_REGISTERED", retriable: false });
  });
});
