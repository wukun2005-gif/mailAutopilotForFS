// Identity assurance gate tests (PRD §6.2, FR-2.1/2.2/2.3).
import { describe, expect, it } from "vitest";
import { assureIdentity, type IdentityInput } from "@/runtime/identity.ts";

const clean: IdentityInput = {
  addressOnFile: true,
  spfPass: true,
  dkimPass: true,
  dmarcPass: true,
  dkimAligned: true,
  lookalikeVariant: false,
  displayNameSpoof: false,
  fraudOrAtoSignal: false,
  contactChanged30d: false,
  stepUpInThread: false,
  secureMessageSession: false,
  verificationSessionExpired: false,
  threadClosed: false,
  ac3SpoofSignal: false,
  isNewThread: false,
  midThreadAddressChange: false,
};

describe("assureIdentity — I0–I3 levels", () => {
  it("I3 only after same-thread step-up (or secure session)", () => {
    const v = assureIdentity({ ...clean, stepUpInThread: true });
    expect(v.level).toBe("I3");
  });

  it("I2: address on file + all auth protocols pass, no step-up", () => {
    expect(assureIdentity(clean).level).toBe("I2");
  });

  it("I1: same domain but address not on file", () => {
    const v = assureIdentity({ ...clean, addressOnFile: false });
    expect(v.level).toBe("I1");
  });

  it("I0: lookalike variant or failed auth fails closed", () => {
    // A lookalike address is by definition not on file.
    expect(assureIdentity({ ...clean, addressOnFile: false, lookalikeVariant: true }).level).toBe("I0");
    expect(assureIdentity({ ...clean, dmarcPass: false }).level).toBe("I0");
    expect(assureIdentity({ ...clean, dkimAligned: false }).level).toBe("I0");
    expect(assureIdentity({ ...clean, fraudOrAtoSignal: true }).level).toBe("I0");
  });

  it("I3 downgrade: verification session expired", () => {
    const v = assureIdentity({
      ...clean, stepUpInThread: true, verificationSessionExpired: true,
    });
    expect(v.level).not.toBe("I3");
    expect(v.reasonCodes).toContain("I3_DOWNGRADE_SESSION_EXPIRED");
  });

  it("I3 downgrade: thread closed", () => {
    const v = assureIdentity({ ...clean, stepUpInThread: true, threadClosed: true });
    expect(v.level).not.toBe("I3");
  });

  it("I3 downgrade: AC3 spoof signal", () => {
    const v = assureIdentity({ ...clean, stepUpInThread: true, ac3SpoofSignal: true });
    expect(v.level).not.toBe("I3");
  });

  it("AC2: step-up in a NEW thread never grants I3", () => {
    const v = assureIdentity({ ...clean, stepUpInThread: true, isNewThread: true });
    expect(v.level).not.toBe("I3");
  });

  it("AC5: multiple new addresses for one customer suppresses I2", () => {
    const v = assureIdentity({ ...clean, multipleNewAddresses: true });
    expect(v.level).not.toBe("I2");
  });

  it("mid-thread address change downgrades to I1", () => {
    const v = assureIdentity({ ...clean, midThreadAddressChange: true });
    expect(v.level).toBe("I1");
  });
});
