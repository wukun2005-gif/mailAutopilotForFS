// Fixture vocabulary for Larkspur Bank (fictional). Free-text fields carry
// {zh,en}; codes, ids, statuses, amounts stay language-neutral.

export interface BiText {
  zh: string;
  en: string;
}

export type ScenarioId = "email1" | "email2" | "email3";

export interface Customer {
  customerId: string;
  firstName: string;
  lastName: string;
  /** Email addresses on the bank profile (exact-match candidates for I2). */
  emailsOnFile: string[];
  phoneOnFile: string; // 555-01xx reserved block
  address: {
    line1: string;
    city: string;
    state: string;
    zip: string;
  };
  digitalEnrolled: boolean;
  /** Most recent change of profile contact details (30-day ATO window). */
  contactChangedAt: string | null;
}

export type AccountType = "checking" | "savings" | "credit_card";
export type AccountStatus = "good" | "overdrawn" | "frozen" | "closed";

export interface BankAccount {
  accountId: string;
  customerId: string;
  type: AccountType;
  nickname: BiText;
  status: AccountStatus;
  last4: string;
  balanceCents: number;
  openedAt: string;
}

export type CardStatus = "active" | "replacement_issued" | "locked";

export interface DebitCard {
  cardRef: string;
  accountId: string;
  last4: string;
  status: CardStatus;
  replacement?: {
    last4: string;
    issuedAt: string;
    etaDayN: number;
    carrier: string;
    tracking: string;
  };
}

export interface Transaction {
  txId: string;
  accountId: string;
  /** ISO date (UTC) the transaction posted. */
  postedAt: string;
  amountCents: number; // negative = debit
  merchant: string;
  channel: "POS" | "ACH" | "ATM" | "WEB" | "ZELLE" | "FEE";
  category: string;
}

export interface ODFee {
  feeId: string;
  accountId: string;
  postedAt: string;
  amountCents: number;
  waived: boolean;
  waivedAt?: string;
}

export type EmailKind =
  | "customer"
  | "locked_template"
  | "stepup_notice"
  | "receipt"
  | "info_request"
  | "result"
  | "fraud_locked";

export type EmailDir = "in" | "out";

export interface EmailAuth {
  spf: "pass" | "fail" | "none";
  dkim: "pass" | "fail" | "none";
  dkimAligned: boolean;
  dmarc: "pass" | "fail" | "none";
  displayName: string;
  fromAddress: string;
}

export interface EmailMessage {
  id: string;
  scenarioId: ScenarioId;
  threadId: string;
  dir: EmailDir;
  kind: EmailKind;
  from: string;
  to: string;
  subject: BiText;
  body: BiText;
  /** Day-N offset from simClock Day 0 + HH:MM UTC. Negative = before Day 0. */
  atDayN: number;
  atTime: string;
  auth?: EmailAuth;
  attachments?: Array<{
    id: string;
    name: string;
    kind: "screenshot" | "statement" | "receipt";
    /** Hidden injected text (email-3 prompt-injection payload). */
    injectedText?: string;
  }>;
}

export type DisputeStatus =
  | "OPEN"
  | "AWAITING_MATERIALS"
  | "PROV_CREDIT_DUE"
  | "PROV_CREDIT_POSTED"
  | "UNDER_INVESTIGATION"
  | "MERCHANT_REVIEW"
  | "RESOLVED_ERROR"
  | "RESOLVED_NO_ERROR";

export interface DisputeMaterial {
  code: string;
  label: BiText;
  required: boolean;
  optional: boolean;
  dueDayN: number | null;
  receivedDayN: number | null;
  ocrConfidence: number | null;
}

export interface DisputeSeed {
  disputeId: string;
  scenarioId: ScenarioId;
  customerId: string;
  accountId: string;
  txId: string;
  amountCents: number;
  channel: "POS_debit";
  status: DisputeStatus;
  provisionalCreditCents: number;
  materials: DisputeMaterial[];
  merchantEvidenceArrivesDayN: number;
}

export interface FraudSignals {
  scenarioId: ScenarioId;
  localPartLookalike: boolean;
  displayNameSpoof: boolean;
  atoScore: number; // 0-100
  promptInjection: boolean;
  r3ComboRequested: boolean;
  profileContactChangeRequest: boolean;
  notes: BiText;
}
