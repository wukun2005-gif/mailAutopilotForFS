import { describe, it, expect, beforeEach } from "vitest";
import { graduationOverrides } from "@runtime/graduationOverrides.ts";
import { graduatedLevel, uncappedLevel } from "@runtime/intentRegistry.ts";

describe("graduation overrides", () => {
  beforeEach(() => graduationOverrides.reset());

  it("returns fixture L3 for graduated intents", () => {
    expect(graduatedLevel("od_fee_refund")).toBe("L3");
  });

  it("returns null for shadow intents until promoted", () => {
    expect(graduatedLevel("reg_e_intake_demo")).toBeNull();
    graduationOverrides.promote("reg_e_intake_demo", "L3");
    expect(graduatedLevel("reg_e_intake_demo")).toBe("L3");
  });

  it("manual cap lowers an L3 intent immediately and can be cleared", () => {
    graduationOverrides.cap("od_fee_refund", "L2");
    expect(graduatedLevel("od_fee_refund")).toBe("L2");
    graduationOverrides.clearCap("od_fee_refund");
    expect(graduatedLevel("od_fee_refund")).toBe("L3");
  });

  it("the uncapped level reports what the intent returns to when the cap lifts", () => {
    graduationOverrides.cap("od_fee_refund", "L2");
    expect(graduatedLevel("od_fee_refund")).toBe("L2");
    expect(uncappedLevel("od_fee_refund")).toBe("L3");
  });

  it("a cap never graduates a shadow intent", () => {
    graduationOverrides.cap("reg_e_intake_demo", "L2");
    expect(graduatedLevel("reg_e_intake_demo")).toBeNull();
    expect(uncappedLevel("reg_e_intake_demo")).toBeNull();
  });

  it("never intents stay null", () => {
    expect(graduatedLevel("contact_detail_change")).toBeNull();
    expect(graduatedLevel("reg_e_adjudication")).toBeNull();
  });
});
