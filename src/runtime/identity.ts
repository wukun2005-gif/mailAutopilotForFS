// Identity assurance I0–I3 — PURE function, copied clause-by-clause from
// PRD v0.2 §6.2 "I 身份保障的四档定义". Do not loosen here without changing
// the PRD (Dev Plan §6.3 single-source rule). Every branch has a Vitest case.
import type { ILevel } from "./state.ts";
import type { IdentitySignal } from "./caseState.ts";

/**
 * The six PRD §6.2 signal groups, resolved by the ingest/identity nodes from
 * recorded fixtures (never from the LLM).
 */
export interface IdentityInput {
  /** ① exact match against the customer's profile email (not same-domain). */
  addressOnFile: boolean;
  /** ② SPF / DKIM / DMARC recorded results; DKIM must align with From domain. */
  spfPass: boolean;
  dkimPass: boolean;
  dmarcPass: boolean;
  dkimAligned: boolean;
  /** ③ lookalike variant (jane.d0e@ vs jane.doe@) or display-name spoof. */
  lookalikeVariant: boolean;
  displayNameSpoof: boolean;
  /** ④ fraud/ATO signals + profile contact-detail change within 30 days. */
  fraudOrAtoSignal: boolean;
  contactChanged30d: boolean;
  /** Multiple new sender addresses for the same customer (FR-2.1 AC5). */
  multipleNewAddresses?: boolean;
  /** ⑤ step-up completed IN THIS THREAD, or logged-in secure-message session. */
  stepUpInThread: boolean;
  secureMessageSession: boolean;
  /**
   * ⑥ PRD §6.2 I3 downgrade triggers (checked only when I3 would otherwise
   * apply). `sessionValidityAssumed` marks the one trigger the PRD does not
   * define a duration for — the UI badges it 假设.
   */
  verificationSessionExpired: boolean;
  threadClosed: boolean;
  ac3SpoofSignal: boolean;
  /** New thread: I3 never inherits across threads (FR-2.1 AC2). */
  isNewThread: boolean;
  /** Sender address changed mid-thread → downgrade to I1. */
  midThreadAddressChange: boolean;
}

export interface IdentityVerdict {
  level: ILevel;
  signals: IdentitySignal[];
  reasonCodes: string[];
  assumptions: string[];
}

function signalsOf(input: IdentityInput): IdentitySignal[] {
  const authOk =
    input.spfPass && input.dkimPass && input.dmarcPass && input.dkimAligned;
  return [
    { code: "ADDR_ON_FILE", passed: input.addressOnFile },
    { code: "SPF_PASS", passed: input.spfPass },
    { code: "DKIM_PASS", passed: input.dkimPass },
    { code: "DMARC_PASS", passed: input.dmarcPass },
    { code: "DKIM_ALIGNED", passed: input.dkimAligned },
    { code: "LOOKALIKE_VARIANT", passed: !input.lookalikeVariant },
    { code: "DISPLAY_NAME_SPOOF", passed: !input.displayNameSpoof },
    { code: "FRAUD_ATO_SIGNAL", passed: !input.fraudOrAtoSignal },
    { code: "CONTACT_CHANGED_30D", passed: !input.contactChanged30d },
    { code: "AUTH_ALL_PASS", passed: authOk },
    { code: "STEPUP_IN_THREAD", passed: input.stepUpInThread },
    { code: "SECURE_MESSAGE_SESSION", passed: input.secureMessageSession },
  ];
}

/**
 * Fail-closed: any signal group that cannot be resolved is represented by
 * `undefined` fields; callers MUST pass explicit booleans. We treat a
 * protocol result we cannot read as a failure (callers default to false).
 */
export function assureIdentity(input: IdentityInput): IdentityVerdict {
  const signals = signalsOf(input);
  const reasonCodes: string[] = [];
  const assumptions: string[] = [];
  const authOk =
    input.spfPass && input.dkimPass && input.dmarcPass && input.dkimAligned;

  // ── I3: step-up in this thread or logged-in secure-message session ──
  const i3Earned =
    (input.stepUpInThread || input.secureMessageSession) && !input.isNewThread;
  if (i3Earned) {
    // The three §6.2 downgrade triggers, evaluated one by one for the trace.
    if (input.verificationSessionExpired) {
      reasonCodes.push("I3_DOWNGRADE_SESSION_EXPIRED");
      assumptions.push("SESSION_VALIDITY_DURATION_UNDEFINED_BY_PRD");
    }
    if (input.threadClosed) reasonCodes.push("I3_DOWNGRADE_THREAD_CLOSED");
    if (input.ac3SpoofSignal || input.lookalikeVariant || input.displayNameSpoof)
      reasonCodes.push("I3_DOWNGRADE_AC3_SPOOF");
    if (input.midThreadAddressChange)
      reasonCodes.push("I3_DOWNGRADE_MIDTHREAD_ADDRESS");
    if (reasonCodes.length === 0) {
      reasonCodes.push("I3_RETAINED");
      return { level: "I3", signals, reasonCodes, assumptions };
    }
    // Downgrade falls through to signal-based reassessment below; the
    // step-up no longer counts this thread.
    input = { ...input, stepUpInThread: false, secureMessageSession: false };
  } else if (input.isNewThread && (input.stepUpInThread || input.secureMessageSession)) {
    reasonCodes.push("I3_NOT_INHERITED_AC2");
  }

  // ── I0: cannot associate — address mismatch AND dirty domain layer ──
  const domainDirty =
    !input.dmarcPass || input.lookalikeVariant || input.displayNameSpoof;
  if (input.addressOnFile && !input.dmarcPass) {
    reasonCodes.unshift("I0_ONFILE_ADDRESS_DMARC_FAIL");
    return { level: "I0", signals, reasonCodes, assumptions };
  }
  if (!input.addressOnFile && domainDirty) {
    reasonCodes.unshift("I0_DOMAIN_DIRTY_OR_SPOOF");
    if (input.lookalikeVariant) reasonCodes.push("AC3_LOOKALIKE");
    return { level: "I0", signals, reasonCodes, assumptions };
  }

  // ── I1: address not on file but all three protocols pass ──
  if (!input.addressOnFile) {
    if (!authOk) {
      reasonCodes.unshift("I0_PROTOCOL_FAILURE");
      return { level: "I0", signals, reasonCodes, assumptions };
    }
    reasonCodes.unshift("I1_DOMAIN_ONLY");
    if (input.midThreadAddressChange)
      reasonCodes.push("I1_MIDTHREAD_ADDRESS_CHANGE");
    return { level: "I1", signals, reasonCodes, assumptions };
  }

  // ── I2: on-file address, protocols pass, no fraud, no recent change ──
  if (input.fraudOrAtoSignal) {
    reasonCodes.unshift("I0_FRAUD_SIGNAL");
    return { level: "I0", signals, reasonCodes, assumptions };
  }
  if (input.contactChanged30d || input.multipleNewAddresses) {
    // FR-2.1 AC5: cap at I1, writes go to human.
    reasonCodes.unshift("I1_CONTACT_CHANGE_WINDOW_AC5");
    return { level: "I1", signals, reasonCodes, assumptions };
  }
  if (input.midThreadAddressChange) {
    reasonCodes.unshift("I1_MIDTHREAD_ADDRESS_CHANGE");
    return { level: "I1", signals, reasonCodes, assumptions };
  }
  reasonCodes.unshift(authOk ? "I2_SIGNAL_MATCH" : "I0_PROTOCOL_FAILURE");
  return { level: authOk ? "I2" : "I0", signals, reasonCodes, assumptions };
}
