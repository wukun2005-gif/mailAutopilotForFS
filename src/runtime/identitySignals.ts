// Builds the six-group IdentityInput for the pure identity gate (Dev Plan
// §6.1 node 3). In recorded mode every signal comes from fixtures + the
// email authentication block + this thread's step-up state + fault-panel
// switches — never from an LLM.
//
// Scenario note: the three vignettes are independent recorded cases that
// share one customer for convenience. Email 1 is scripted to arrive from a
// gmail address that is NOT linked on this case (Dev Plan §8.2 email-1 beat:
// "公共邮箱 gmail，不在档案 = I1"); email 2's same-address thread IS on file
// (PRD §8.2 step 2, I2 four要件). The per-scenario override below is the
// recorded equivalent of a CRM match differing per case.
import type { EmailMessage } from "@/mocks/fixtures/types.ts";
import {
  CUSTOMER_JANE,
  FRAUD_SIGNALS,
} from "@/mocks/fixtures/index.ts";
import { faultController } from "@/tools/faultController.ts";
import { assureIdentity, type IdentityInput, type IdentityVerdict } from "./identity.ts";
import type { StepUpRecord } from "./caseState.ts";

/** Recorded per-scenario CRM linkage (see scenario note above). */
const RECORDED_ADDRESS_ON_FILE: Record<string, boolean> = {
  email1: false,
  email2: true,
  email3: false, // jane.d0e@ lookalike is never an on-file match
};

export interface BuildIdentityArgs {
  email: EmailMessage;
  /** Step-up already completed in THIS thread (null otherwise). */
  stepUp: StepUpRecord | null;
  /** Sender address of the first email in this thread (mid-thread change). */
  firstThreadFrom: string | null;
  /** FR-2.1 AC2: this email opened a NEW thread (I3 never inherits). */
  isNewThread?: boolean;
}

function localPart(addr: string): string {
  return addr.split("@")[0]?.toLowerCase() ?? "";
}

export function buildIdentityInput(args: BuildIdentityArgs): IdentityInput {
  const { email, stepUp, firstThreadFrom, isNewThread = false } = args;
  const auth = email.auth;
  const fraud = FRAUD_SIGNALS[email.scenarioId] ?? FRAUD_SIGNALS.email1;
  const fromAddr = auth?.fromAddress ?? "";

  const addressOnFileRecorded =
    RECORDED_ADDRESS_ON_FILE[email.scenarioId] ?? false;
  // Exact match against the profile address is still required.
  const exactOnFile = CUSTOMER_JANE.emailsOnFile.includes(fromAddr);
  const addressOnFile = addressOnFileRecorded && exactOnFile;

  const spfPass = auth?.spf === "pass";
  const dkimPass = auth?.dkim === "pass";
  const dmarcPass = auth?.dmarc === "pass";
  const dkimAligned = auth?.dkimAligned ?? false;

  // Lookalike / display-name spoof: fixture fraud table, with the fault-panel
  // AC3 switch able to inject the signal into any thread.
  const spoofInjected = faultController.isOn("spoofSignal");
  const lookalikeVariant =
    fraud.localPartLookalike ||
    spoofInjected ||
    (CUSTOMER_JANE.emailsOnFile.some(
      (onFile) =>
        localPart(onFile) !== localPart(fromAddr) &&
        lev1(localPart(onFile), localPart(fromAddr)),
    ) &&
      !exactOnFile);
  const displayNameSpoof = fraud.displayNameSpoof || spoofInjected;

  const fraudOrAtoSignal =
    fraud.atoScore >= 70 || fraud.promptInjection || lookalikeVariant;
  const contactChanged30d = CUSTOMER_JANE.contactChangedAt !== null;

  // The runner only ever attaches a step-up record earned IN THIS thread.
  const stepUpInThread = !!stepUp?.verified;
  const secureMessageSession =
    !!stepUp?.verified && stepUp.method === "app_case_card";

  const midThreadAddressChange =
    !!firstThreadFrom &&
    extractAddress(firstThreadFrom) !== fromAddr;

  return {
    addressOnFile,
    spfPass,
    dkimPass,
    dmarcPass,
    dkimAligned,
    lookalikeVariant,
    displayNameSpoof,
    fraudOrAtoSignal,
    contactChanged30d,
    stepUpInThread,
    secureMessageSession,
    verificationSessionExpired: faultController.isOn("sessionExpired"),
    threadClosed: faultController.isOn("threadClosed"),
    ac3SpoofSignal: spoofInjected,
    isNewThread: isNewThread || faultController.isOn("newThread"),
    midThreadAddressChange,
  };
}

export function evaluateIdentity(args: BuildIdentityArgs): IdentityVerdict {
  return assureIdentity(buildIdentityInput(args));
}

export function extractAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

/** True when two local parts differ by exactly one character (typo/lookalike). */
function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  let diffs = 0;
  for (let i = 0, j = 0; i < longer.length; i++) {
    if (longer[i] !== shorter[j]) {
      diffs += 1;
      if (longer.length === shorter.length) j += 1;
    } else j += 1;
    if (diffs > 1) return false;
  }
  return diffs === 1;
}
