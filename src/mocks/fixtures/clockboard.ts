// Open Reg E disputes across the public mailbox — the clock board is total
// (roadmap Phase 2 "时钟看板全量"), not scoped to whichever case the operator
// happens to have loaded. Every offset is calendar days before Day 0
// (2026-09-22 08:14 UTC), so all deadlines on the board are arithmetic.
import type { BiText } from "./types.ts";

export type DisputeBranch = "pos_debit_90d" | "account_error_45d";
export type ProvisionalCreditState = "posted" | "pending" | "not_required";

export interface OpenDispute {
  caseRef: string;
  subject: BiText;
  branch: DisputeBranch;
  /** 0 = arrived on Day 0 (the loaded dispute case); negative = earlier. */
  arrivedDayOffset: number;
  provisionalCredit: ProvisionalCreditState;
  stage: BiText;
}

export const OPEN_DISPUTES: OpenDispute[] = [
  {
    caseRef: "DSP-10452",
    subject: { zh: "$247.18 POS 借记盗刷申诉", en: "$247.18 POS debit fraud claim" },
    branch: "pos_debit_90d",
    arrivedDayOffset: 0,
    provisionalCredit: "pending",
    stage: { zh: "调查中 · 等客户材料", en: "investigating · awaiting customer documents" },
  },
  {
    caseRef: "DSP-10437",
    subject: { zh: "$89.00 重复扣款", en: "$89.00 duplicate charge" },
    branch: "pos_debit_90d",
    arrivedDayOffset: -3,
    provisionalCredit: "posted",
    stage: { zh: "调查中 · 银行已提交证据", en: "investigating · evidence submitted" },
  },
  {
    caseRef: "DSP-10412",
    subject: { zh: "$1,240 家电未收到", en: "$1,240 goods not received" },
    branch: "pos_debit_90d",
    arrivedDayOffset: -6,
    provisionalCredit: "posted",
    stage: { zh: "等客户补寄签收凭证", en: "awaiting customer proof of delivery" },
  },
  {
    caseRef: "DSP-10398",
    subject: { zh: "账户差错 · ATM 短款 $40", en: "account error · $40 ATM shortfall" },
    branch: "account_error_45d",
    arrivedDayOffset: -12,
    provisionalCredit: "not_required",
    stage: { zh: "调查中 · 调取 ATM 日志", en: "investigating · pulling ATM logs" },
  },
  {
    caseRef: "DSP-10355",
    subject: { zh: "$212 POS 借记未授权", en: "$212 unauthorized POS debit" },
    branch: "pos_debit_90d",
    arrivedDayOffset: -19,
    provisionalCredit: "posted",
    stage: { zh: "结果已签发 · 待结案", en: "result issued · awaiting close" },
  },
];
