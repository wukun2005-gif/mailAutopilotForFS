import { describe, it, expect, beforeEach } from "vitest";
import { graduationOverrides } from "@runtime/graduationOverrides.ts";
import { graduatedLevel } from "@runtime/intentRegistry.ts";

describe("graduation overrides", () => {
  beforeEach(() => graduationOverrides.reset());

  it("returns fixture L3 for graduated intents", () => {
    expect(graduatedLevel("od_fee_refund")).toBe("L3");
  });

  it("returns null for shadow intents until promoted", () => {
    expect(graduatedLevel("reg_e_intake")).toBeNull();
    graduationOverrides.promote("reg_e_intake", "L3");
    expect(graduatedLevel("reg_e_intake")).toBe("L3");
  });

  it("manual cap lowers an L3 intent immediately and can be cleared", () => {
    graduationOverrides.cap("od_fee_refund", "L2");
    expect(graduatedLevel("od_fee_refund")).toBe("L2");
    graduationOverrides.clearCap("od_fee_refund");
    expect(graduatedLevel("od_fee_refund")).toBe("L3");
  });

  it("never intents stay null", () => {
    expect(graduatedLevel("contact_detail_change")).toBeNull();
    expect(graduatedLevel("reg_e_adjudication")).toBeNull();
  });
});
