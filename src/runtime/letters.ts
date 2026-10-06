// Three-segment customer letter assembly (Dev Plan §6.1 node 8, TricolorLetter
// on screen 1). Every outbound is an ordered list of sections tagged by source:
//   template — fixed compliance language (blue)
//   slot     — system values: name / amount / date / case id (green)
//   ai       — generated bridge / empathy sentence (purple)
// L1/L2 letters are built as drafts and never auto-sent; the act node decides.
import type { Draft, DraftSection } from "./caseState.ts";
import {
  ACCOUNT_CHECKING,
  CARD_REPLACEMENT,
  DISPUTE_EMAIL2,
  FRAUD_LOCKED_TEMPLATE,
  LOCKED_TEMPLATE,
  OD_FEES,
  REGE_RECEIPT_TEMPLATE,
  type ODFee,
} from "@/mocks/fixtures/index.ts";
import { addCalendarDays, DAY0_EPOCH, simClock, utcYmd } from "./simClock.ts";

function tpl(text: string, source: string): DraftSection {
  return { kind: "template", textEn: text, source };
}
function slot(text: string, source: string): DraftSection {
  return { kind: "slot", textEn: text, source };
}
function ai(text: string, source = "llm:bridge-v1"): DraftSection {
  return { kind: "ai", textEn: text, source };
}

const usd = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── FR-10.2 / FR-10.3 footer ────────────────────────────────────────────────
// Every customer-facing email carries a locked AI-identity disclosure plus a
// one-click human handoff. The respond node (FR-5.2) refuses to send email
// drafts that lack this footer; agent-edited L1/L2 text stays human-owned.
const DISCLOSURE_SOURCE = "TPL_AI_DISCLOSURE_V1";
const HANDOFF_SOURCE = "TPL_HANDOFF_V1";

export function disclosureFooter(): DraftSection[] {
  return [
    tpl(
      "You are writing with Larkspur Bank's AI assistant. A supervised automated system " +
        "drafted this message; it does not change your legal rights or deadlines.",
      DISCLOSURE_SOURCE,
    ),
    tpl(
      "Prefer a person? Just reply HUMAN and an agent will pick up with the full case " +
        "history — no need to repeat yourself.",
      HANDOFF_SOURCE,
    ),
  ];
}

function base(
  id: string,
  intentCode: string,
  channel: Draft["channel"],
  to: string,
  sections: DraftSection[],
  opts: { subject?: string; lockedTemplate?: boolean; promise?: Draft["promise"] } = {},
): Draft {
  return {
    id,
    intentCode,
    channel,
    to,
    subject: opts.subject,
    sections,
    lockedTemplate: opts.lockedTemplate ?? false,
    dlpClean: true,
    promise: opts.promise,
  };
}

// ── Deny cell: locked step-up guide, no account data, no links in email ──

// Email nudge sent ALONGSIDE the secure case card: without it the customer
// never learns to open the app and the case stalls on their side — the
// bank's fault, not the customer's. Generic wording only, no links.
export function stepupNudgeLetter(to: string): Draft {
  return base("DR-STEPUP-NUDGE", "stepup_guide", "email", to, [
    ai(
      "Hi Jane — to protect your account, we need to verify it is you before we share any account details.",
    ),
    ai(
      "Please open the Larkspur app and complete the one-time verification in secure messages; " +
        "your case will continue automatically afterwards.",
    ),
    ...disclosureFooter(),
  ], { subject: "Action needed: verify in the Larkspur app" });
}

export function lockedStepUpLetter(to: string): Draft {
  return base(
    "DR-LOCKED-STEPUP",
    "stepup_guide",
    "secure_message",
    to,
    [tpl(LOCKED_TEMPLATE.body.en, LOCKED_TEMPLATE.templateId)],
    { subject: LOCKED_TEMPLATE.subject.en, lockedTemplate: true },
  );
}

export function caseCardMessage(): { body: string; kind: string } {
  return {
    kind: "case_card",
    body:
      "Open case: verify your identity to continue. Why: we received an email " +
      "requesting an account action from an address we cannot confirm. After " +
      "verification we will continue automatically — you won't need to repeat your request.",
  };
}

// ── Email 1, beat 1: L3 OD-fee refund confirmation ──

export function refundConfirmationLetter(to: string, fee: ODFee = OD_FEES[0]!, draftId = "DR-OD1-REFUND"): Draft {
  return base(draftId, "od_fee_refund", "email", to, [
    ai(
      "Hi Jane — thanks for being a customer for all these years, and sorry about the surprise fee.",
    ),
    slot(
      `The ${usd(fee.amountCents)} overdraft fee posted on ${fee.postedAt} has been refunded to ` +
        `your checking account ending 8821. It should appear within one business day (by ${utcYmd(
          simClock.now() + 86_400_000,
        )}).`,
      `core:${fee.feeId} / account:DDA-8821`,
    ),
    tpl(
      "This message confirms a completed adjustment. If anything looks wrong, reply here and " +
        "we will review it. Larkspur Bank Customer Service.",
      "TPL_REFUND_CONFIRM_V2",
    ),
    ...disclosureFooter(),
  ], {
    // FR-1.5: "within one business day" is a dated promise. The refund write
    // already executed before this letter went out, so the ledger fulfils it
    // the moment it registers (in production the posting is what gets tracked).
    promise: {
      labelKey: "promise.refund1bd",
      dueInBusinessDays: 1,
      fulfillByActionType: "refund_od_fee",
    },
  });
}

// ── Email 1, beat 2: L2 explanation draft (second waiver in 12 months) ──

// Holding reply: auto-sent the moment the second request arrives. It promises
// the supervisor review; it is NOT the review outcome. FR-1.5: the "within one
// business day" sentence is a customer-facing promise — registered as a
// promise clock the moment this letter goes out, fulfilled by DR-OD2-EXPLAIN.
export function secondWaiverHoldingLetter(to: string): Draft {
  return base("DR-OD2-HOLDING", "od_fee_refund", "email", to, [
    ai(
      "Hi Jane — we got your message about the second overdraft fee.",
    ),
    ai(
      "A supervisor is reviewing your request and will reply within one business day; " +
        "you can also ask us to reconsider if you believe there is a special circumstance.",
    ),
    ...disclosureFooter(),
  ], {
    subject: "About your recent overdraft fee",
    promise: {
      labelKey: "promise.od2Reply",
      dueInBusinessDays: 1,
      fulfillByDraftId: "DR-OD2-EXPLAIN",
    },
  });
}

// Final letter: sent only after the supervisor approves. Past tense — the
// review it describes has already happened.
export function secondWaiverExplanationDraft(to: string): Draft {
  return base("DR-OD2-EXPLAIN", "od_fee_refund", "email", to, [
    ai(
      "Hi Jane — I looked into the second overdraft fee personally, because I wanted to see what we could do.",
    ),
    tpl(
      "Our overdraft-fee courtesy program allows one refund per customer in any 12-month period, " +
        "and that courtesy was used on 2026-09-22. I am not able to refund this second fee automatically.",
      "POLICY:OD_FEE_WAIVER_V12#OD-1",
    ),
    ai(
      "A supervisor has reviewed your request and upheld this outcome; " +
        "you can still ask us to reconsider if you believe there is a special circumstance.",
    ),
    ...disclosureFooter(),
  ], { subject: "About your recent overdraft fee" });
}

// ── Email 2: card delivery status (R1 low-sensitivity, L3, no address) ──

export function cardDeliveryLetter(to: string): Draft {
  const r = CARD_REPLACEMENT.replacement!;
  return base("DR-CARD-STATUS", "card_delivery_status", "email", to, [
    ai("Hi Jane — here is the status of your replacement card."),
    slot(
      `Your new card ending ${r.last4} shipped via ${r.carrier} on ${r.issuedAt} and is estimated to ` +
        `arrive on day ${r.etaDayN} (2026-09-30). Tracking reference ${r.tracking}.`,
      "cards:CARD-4417 (ETA/carrier only — no address disclosed at I2)",
    ),
    tpl(
      "If it has not arrived within 10 business days, message us here and we will reissue it. " +
        "For security, delivery addresses are never sent over email.",
      "TPL_CARD_STATUS_V1",
    ),
    ...disclosureFooter(),
  ], {
    subject: "Your replacement card is on its way",
    // FR-1.5: the letter dates the promise twice — arrive by ETA (Day 8,
    // fixture-carried) and a 10-business-day reissue checkpoint. The clock
    // runs to the checkpoint; the fixture's ETA is what fulfils it.
    promise: {
      labelKey: "promise.card10bd",
      dueInBusinessDays: 10,
      fulfillByEpoch: new Date(addCalendarDays(DAY0_EPOCH, r.etaDayN)).toISOString(),
    },
  });
}

// ── Email 2: Reg E acknowledgment receipt ──

export function regEReceiptLetter(to: string): Draft {
  return base("DR-REGE-RECEIPT", "reg_e_intake", "email", to, [
    tpl(REGE_RECEIPT_TEMPLATE.body.en, REGE_RECEIPT_TEMPLATE.templateId),
    ai(
      "If you can, please reply to this thread with a photo or scan of your signed statement " +
        "confirming the charge was not yours — the investigation will not wait for it, but it helps " +
        "the final decision.",
    ),
    ai(
      "If we ever need to show you sensitive details — like full transaction information — " +
        "the secure messages in the app will walk you through a one-time verification first.",
    ),
    ...disclosureFooter(),
  ], {
    subject: REGE_RECEIPT_TEMPLATE.subject.en,
    lockedTemplate: true,
  });
}

// ── Email 2: provisional credit posted (approved by supervisor) ──
// Sent in the demo after the Day-1 step-up, so identity is I3 and the
// middle-level fields below are PRD-table-clean at send time.

export function pcPostedLetter(to: string): Draft {
  return base("DR-PC-POSTED", "reg_e_provisional_credit", "email", to, [
    ai("Hi Jane — a quick update on case DSP-10452."),
    tpl(
      `We have posted a provisional credit of ${usd(DISPUTE_EMAIL2.provisionalCreditCents)} to your account ` +
        `ending 8821 on ${utcYmd(simClock.now())} while the investigation continues. ` +
        "If we find no error, this credit will be reversed — you will always receive a written explanation first.",
      "REG E 1005.11(c)(2)(i) provisional credit",
    ),
    ...disclosureFooter(),
  ], { subject: "Provisional credit posted to your account" });
}

// ── Email 2 beat 3: transaction detail (I3 field, after same-thread step-up) ──

export function transactionDetailLetter(to: string): Draft {
  const d = DISPUTE_EMAIL2;
  return base("DR-TX-DETAIL", "transaction_detail", "email", to, [
    ai("Thanks for verifying your identity, Jane. Here are the details you asked for."),
    slot(
      `The disputed item on your account ending 8821: ${usd(d.amountCents)} at Northside Market, ` +
        `posted 2026-09-18, transaction ID ${d.txId}, channel POS debit. It is now part of case DSP-10452.`,
      "core:TX-5015 / dispute:DSP-10452",
    ),
    tpl(
      "Please share only the last four digits of any card, never the full number or CVV.",
      "TPL_PCI_REMINDER_V1",
    ),
    ...disclosureFooter(),
  ], { subject: "Transaction details you asked for" });
}

// ── Email 2 Day 6: optional materials received (OCR gated) ──

export function materialsAckLetter(to: string, ocrLow = false): Draft {
  return base("DR-MATERIALS-ACK", "reg_e_intake", "email", to, [
    tpl(
      ocrLow
        ? "We received your attachment. Its contents could not be read clearly and an agent will review it manually; this does not pause your dispute timeline."
        : "We received your signed statement and attached it to case DSP-10452. This material is optional; the investigation does not wait on it.",
      "TPL_MATERIALS_ACK_V1",
    ),
    ...disclosureFooter(),
  ], {
    subject: "We received your statement",
    // FR-1.5 without a deadline: "an agent will review it manually" is a
    // promise of action, not of time — registered open, no due date, and
    // fulfilled when the reviewer clears the queued task.
    ...(ocrLow
      ? {
          promise: {
            labelKey: "promise.manualReview",
            fulfillByApprovalId: "AP-OCR-REVIEW",
          },
        }
      : {}),
  });
}

// ── Email 2 Day 45: result letters (L1 human sign-off) ──

export function resultLetterError(to: string): Draft {
  // Corrected balance derives from fixtures (ledger balance + final credit),
  // so the number in the letter always matches demo data.
  const correctedCents =
    ACCOUNT_CHECKING.balanceCents + DISPUTE_EMAIL2.provisionalCreditCents;
  return base("DR-RESULT-ERROR", "reg_e_adjudication", "email", to, [
    ai("Jane, we have completed the investigation for case DSP-10452."),
    tpl(
      `We determined an error occurred. The ${usd(DISPUTE_EMAIL2.provisionalCreditCents)} provisional credit ` +
        "is now final and any related fees have been reversed. " +
        "Our finding is based on the transaction record, the merchant evidence received on Day 40, " +
        `and your signed statement. Your corrected checking balance is ${usd(correctedCents)}.`,
      "REG E 1005.11(c)(1) correction within 1 business day, notice within 3",
    ),
    ...disclosureFooter(),
  ], { subject: "Case DSP-10452: investigation complete — error found" });
}

export function resultLetterNoError(to: string): Draft {
  return base("DR-RESULT-NOERROR", "reg_e_adjudication", "email", to, [
    ai("Jane, we have completed the investigation for case DSP-10452."),
    tpl(
      `We determined no error occurred. Our finding is based on the transaction record, the merchant evidence ` +
        `received on Day 40, and your signed statement. The ${usd(DISPUTE_EMAIL2.provisionalCreditCents)} ` +
        "provisional credit will be reversed. You may request copies of the documents we relied on " +
        "and ask us to reconsider within 60 days.",
      "REG E 1005.11(d) written explanation + documents on request",
    ),
    ...disclosureFooter(),
  ], { subject: "Case DSP-10452: investigation complete" });
}

// ── Email 3: fraud locked template + on-file SMS warning ──

export function fraudLockedLetter(): Draft {
  return base("DR-FRAUD-LOCKED", "fraud_locked", "email", "on-file", [
    tpl(FRAUD_LOCKED_TEMPLATE.body.en, FRAUD_LOCKED_TEMPLATE.templateId),
  ], { subject: FRAUD_LOCKED_TEMPLATE.subject.en, lockedTemplate: true });
}

export function onFileWarningSms(): string {
  return (
    "Larkspur Bank security alert: we received a request to change your contact details and mail a " +
    "card from an address we could not verify. NO changes were made. If this was you, call the number " +
    "on the back of your card. Do not reply to this message."
  );
}
