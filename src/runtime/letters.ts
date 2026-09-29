// Three-segment customer letter assembly (Dev Plan §6.1 node 8, TricolorLetter
// on screen 1). Every outbound is an ordered list of sections tagged by source:
//   template — fixed compliance language (blue)
//   slot     — system values: name / amount / date / case id (green)
//   ai       — generated bridge / empathy sentence (purple)
// L1/L2 letters are built as drafts and never auto-sent; the act node decides.
import type { Draft, DraftSection } from "./caseState.ts";
import {
  CARD_REPLACEMENT,
  DISPUTE_EMAIL2,
  FRAUD_LOCKED_TEMPLATE,
  LOCKED_TEMPLATE,
  OD_FEES,
  REGE_RECEIPT_TEMPLATE,
} from "@/mocks/fixtures/index.ts";
import { simClock, utcYmd } from "./simClock.ts";

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

function base(
  id: string,
  intentCode: string,
  channel: Draft["channel"],
  to: string,
  sections: DraftSection[],
  opts: { subject?: string; lockedTemplate?: boolean } = {},
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
  };
}

// ── Deny cell: locked step-up guide, no account data, no links in email ──

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

export function refundConfirmationLetter(to: string): Draft {
  const fee = OD_FEES[0]!;
  return base("DR-OD1-REFUND", "od_fee_refund", "secure_message", to, [
    ai(
      "Hi Jane — thanks for being a customer for all these years, and sorry about the surprise fee.",
    ),
    slot(
      `The ${usd(fee.amountCents)} overdraft fee posted on 2026-09-19 has been refunded to ` +
        `your checking account ending 8821. It should appear within one business day (by ${utcYmd(
          simClock.now() + 86_400_000,
        )}).`,
      "core:ODF-3318 / account:DDA-8821",
    ),
    tpl(
      "This message confirms a completed adjustment. If anything looks wrong, reply here and " +
        "we will review it. Larkspur Bank Customer Service.",
      "TPL_REFUND_CONFIRM_V2",
    ),
  ]);
}

// ── Email 1, beat 2: L2 explanation draft (second waiver in 12 months) ──

export function secondWaiverExplanationDraft(to: string): Draft {
  return base("DR-OD2-EXPLAIN", "od_fee_refund", "secure_message", to, [
    ai(
      "Hi Jane — I looked into the second overdraft fee personally, because I wanted to see what we could do.",
    ),
    tpl(
      "Our overdraft-fee courtesy program allows one refund per customer in any 12-month period, " +
        "and that courtesy was used on 2026-09-22. I am not able to refund this second fee automatically.",
      "POLICY:OD_FEE_WAIVER_V12#OD-1",
    ),
    ai(
      "A supervisor is reviewing your request and will reply within one business day; " +
        "you can also ask us to reconsider if you believe there is a special circumstance.",
    ),
  ], { subject: "About your recent overdraft fee" });
}

// ── Email 2: card delivery status (R1 low-sensitivity, L3, no address) ──

export function cardDeliveryLetter(to: string): Draft {
  const r = CARD_REPLACEMENT.replacement!;
  return base("DR-CARD-STATUS", "card_delivery_status", "secure_message", to, [
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
  ]);
}

// ── Email 2: Reg E acknowledgment receipt ──

export function regEReceiptLetter(to: string): Draft {
  return base("DR-REGE-RECEIPT", "reg_e_intake", "secure_message", to, [
    tpl(REGE_RECEIPT_TEMPLATE.body.en, REGE_RECEIPT_TEMPLATE.templateId),
  ], {
    subject: REGE_RECEIPT_TEMPLATE.subject.en,
    lockedTemplate: true,
  });
}

// ── Email 2 beat 3: transaction detail (I3 field, after same-thread step-up) ──

export function transactionDetailLetter(to: string): Draft {
  const d = DISPUTE_EMAIL2;
  return base("DR-TX-DETAIL", "transaction_detail", "secure_message", to, [
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
  ]);
}

// ── Email 2 Day 6: optional materials received (OCR gated) ──

export function materialsAckLetter(to: string, ocrLow = false): Draft {
  return base("DR-MATERIALS-ACK", "reg_e_intake", "secure_message", to, [
    tpl(
      ocrLow
        ? "We received your attachment. Its contents could not be read clearly and an agent will review it manually; this does not pause your dispute timeline."
        : "We received your signed statement and attached it to case DSP-10452. This material is optional; the investigation does not wait on it.",
      "TPL_MATERIALS_ACK_V1",
    ),
  ]);
}

// ── Email 2 Day 45: result letters (L1 human sign-off) ──

export function resultLetterError(to: string): Draft {
  return base("DR-RESULT-ERROR", "reg_e_adjudication", "secure_message", to, [
    ai("Jane, we have completed the investigation for case DSP-10452."),
    tpl(
      `We determined an error occurred. The ${usd(DISPUTE_EMAIL2.provisionalCreditCents)} provisional credit ` +
        "is now final, any related fees have been reversed, and the corrected balance is shown in your app. " +
        "You will find a full written explanation attached to this message.",
      "REG E 1005.11(c)(1) correction within 1 business day, notice within 3",
    ),
  ], { subject: "Case DSP-10452: investigation complete — error found" });
}

export function resultLetterNoError(to: string): Draft {
  return base("DR-RESULT-NOERROR", "reg_e_adjudication", "secure_message", to, [
    ai("Jane, we have completed the investigation for case DSP-10452."),
    tpl(
      "We determined no error occurred. The enclosed written notice explains the findings, the documents " +
        "we relied on, and how the provisional credit will be reversed. You may request copies of the " +
        "documents and ask us to reconsider within 60 days.",
      "REG E 1005.11(d) written explanation + documents on request",
    ),
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
