// Email-2 dispute seed: the record the disputes mock returns after creation,
// materials checklist (Day 6 signed statement, optional), and the Day-40
// merchant representment package (recorded, arrives on the clock).
import type { DisputeSeed } from "./types.ts";

export const DISPUTE_EMAIL2: DisputeSeed = {
  disputeId: "DSP-10452",
  scenarioId: "email2",
  customerId: "CUS-100231",
  accountId: "DDA-8821",
  txId: "TX-5015",
  amountCents: 24718,
  channel: "POS_debit",
  status: "OPEN",
  provisionalCreditCents: 24718,
  materials: [
    {
      code: "SIGNED_STMT",
      label: {
        zh: "客户签字声明（可选）",
        en: "Signed customer statement (optional)",
      },
      required: false,
      optional: true,
      dueDayN: null,
      receivedDayN: 6,
      ocrConfidence: 0.96,
    },
    {
      code: "POLICE_RPT",
      label: { zh: "报案回执（如已报案）", en: "Police report (if filed)" },
      required: false,
      optional: true,
      dueDayN: null,
      receivedDayN: null,
      ocrConfidence: null,
    },
  ],
  merchantEvidenceArrivesDayN: 40,
};

export const MERCHANT_EVIDENCE_DAY40 = {
  disputeId: "DSP-10452",
  receivedDayN: 40,
  receivedAt: "2026-11-01",
  package: {
    representmentWindowClosed: true,
    items: [
      {
        code: "TERMINAL_LOCATION",
        label: { zh: "交易终端位置", en: "Terminal location" },
        value: "Austin, TX — 4.2 mi from customer ZIP 73301",
      },
      {
        code: "ENTRY_MODE",
        label: { zh: "受理方式", en: "Entry mode" },
        value: "Chip + online PIN verified",
      },
      {
        code: "RECEIPT_IMAGE",
        label: { zh: "签购单影像", en: "Receipt image" },
        value: "Signature on file, similarity 0.61 (inconclusive)",
      },
    ],
  },
  note: {
    zh: "证据存在矛盾，提交调查员人工裁决（AI 不裁决，FR-4.x）。",
    en: "Conflicting evidence — routed to human investigator (no AI adjudication).",
  },
};

export const PROVISIONAL_CREDIT_RECORD = {
  disputeId: "DSP-10452",
  amountCents: 24718,
  /** Deterministic obligation: due on the 10th business day. */
  dueAt: "2026-10-06T08:14:00Z",
  warningHoursBefore: 48,
  postedAt: null as string | null,
  approvedBy: null as string | null,
};
