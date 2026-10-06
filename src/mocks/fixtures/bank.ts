// Larkspur Bank core-banking fixtures (all fictional). Email 1–3 share one
// customer so the demo can reference a single profile safely.
import type {
  BankAccount,
  Customer,
  DebitCard,
  ODFee,
  Transaction,
} from "./types.ts";

export const CUSTOMER_JANE: Customer = {
  customerId: "CUS-100231",
  firstName: "Jane",
  lastName: "Doe",
  emailsOnFile: ["jane.doe@gmail.com"],
  phoneOnFile: "+1-415-555-0142",
  address: {
    line1: "1847 Larkspur Ave",
    city: "Austin",
    state: "TX",
    zip: "73301",
  },
  digitalEnrolled: true,
  contactChangedAt: null,
};

export const ACCOUNT_CHECKING: BankAccount = {
  accountId: "DDA-8821",
  customerId: CUSTOMER_JANE.customerId,
  type: "checking",
  nickname: { zh: "日常支票账户", en: "Everyday Checking" },
  status: "good",
  last4: "8821",
  balanceCents: 421837,
  openedAt: "2019-03-04",
};

export const ACCOUNT_SAVINGS: BankAccount = {
  accountId: "SAV-9034",
  customerId: CUSTOMER_JANE.customerId,
  type: "savings",
  nickname: { zh: "储蓄账户", en: "Statement Savings" },
  status: "good",
  last4: "9034",
  balanceCents: 1820400,
  openedAt: "2019-03-04",
};

export const CARD_REPLACEMENT: DebitCard = {
  cardRef: "CARD-4417",
  accountId: ACCOUNT_CHECKING.accountId,
  last4: "4417",
  status: "replacement_issued",
  replacement: {
    last4: "0293",
    issuedAt: "2026-09-15",
    etaDayN: 8, // 2026-09-30 — the card-delivery question in email 2
    carrier: "FedEx",
    tracking: "7745-0219-8830",
  },
};

// Last 60 days (deterministic, no randomness — Dev Plan §4.3 rule 3).
export const TRANSACTIONS: Transaction[] = [
  { txId: "TX-5001", accountId: "DDA-8821", postedAt: "2026-07-24", amountCents: -4218, merchant: "H-E-B #219", channel: "POS", category: "groceries" },
  { txId: "TX-5002", accountId: "DDA-8821", postedAt: "2026-07-31", amountCents: 320000, merchant: "Payroll Deposit - Austin ISD", channel: "ACH", category: "income" },
  { txId: "TX-5003", accountId: "DDA-8821", postedAt: "2026-08-03", amountCents: -12804, merchant: "Austin Energy", channel: "ACH", category: "utilities" },
  { txId: "TX-5004", accountId: "DDA-8821", postedAt: "2026-08-08", amountCents: -6340, merchant: "Shell 24107", channel: "POS", category: "fuel" },
  { txId: "TX-5005", accountId: "DDA-8821", postedAt: "2026-08-14", amountCents: -8999, merchant: "Amazon.com", channel: "WEB", category: "retail" },
  { txId: "TX-5006", accountId: "DDA-8821", postedAt: "2026-08-15", amountCents: 320000, merchant: "Payroll Deposit - Austin ISD", channel: "ACH", category: "income" },
  { txId: "TX-5007", accountId: "DDA-8821", postedAt: "2026-08-21", amountCents: -4730, merchant: "Costco #481", channel: "POS", category: "groceries" },
  { txId: "TX-5008", accountId: "DDA-8821", postedAt: "2026-08-29", amountCents: -12000, merchant: "Zelle → M. Doe", channel: "ZELLE", category: "transfer" },
  { txId: "TX-5009", accountId: "DDA-8821", postedAt: "2026-08-31", amountCents: 320000, merchant: "Payroll Deposit - Austin ISD", channel: "ACH", category: "income" },
  { txId: "TX-5010", accountId: "DDA-8821", postedAt: "2026-09-02", amountCents: -15672, merchant: "State Farm", channel: "ACH", category: "insurance" },
  { txId: "TX-5011", accountId: "DDA-8821", postedAt: "2026-09-05", amountCents: -5475, merchant: "CVS 02441", channel: "POS", category: "pharmacy" },
  { txId: "TX-5012", accountId: "DDA-8821", postedAt: "2026-09-10", amountCents: -9320, merchant: "Target T-2217", channel: "POS", category: "retail" },
  { txId: "TX-5013", accountId: "DDA-8821", postedAt: "2026-09-12", amountCents: -7250, merchant: "Chipotle #1902", channel: "POS", category: "dining" },
  { txId: "TX-5014", accountId: "DDA-8821", postedAt: "2026-09-15", amountCents: 320000, merchant: "Payroll Deposit - Austin ISD", channel: "ACH", category: "income" },
  { txId: "TX-5015", accountId: "DDA-8821", postedAt: "2026-09-18", amountCents: -24718, merchant: "Northside Market", channel: "POS", category: "retail" },
  { txId: "TX-5016", accountId: "DDA-8821", postedAt: "2026-09-19", amountCents: -3500, merchant: "Overdraft Fee - Item TX-5015", channel: "FEE", category: "fee" },
];

export const OD_FEES: ODFee[] = [
  {
    feeId: "ODF-3318",
    accountId: "DDA-8821",
    postedAt: "2026-09-19",
    amountCents: 3500,
    waived: false,
  },
  {
    feeId: "ODF-3319",
    accountId: "DDA-8821",
    postedAt: "2026-10-10",
    amountCents: 3500,
    waived: false,
  },
];

export function customerById(id: string): Customer | undefined {
  return [CUSTOMER_JANE].find((c) => c.customerId === id);
}

export function accountsFor(customerId: string): BankAccount[] {
  return [ACCOUNT_CHECKING, ACCOUNT_SAVINGS].filter(
    (a) => a.customerId === customerId,
  );
}

export function transactionsFor(accountId: string): Transaction[] {
  return TRANSACTIONS.filter((t) => t.accountId === accountId);
}

export function cardsFor(accountId: string): DebitCard[] {
  return [CARD_REPLACEMENT].filter((c) => c.accountId === accountId);
}
