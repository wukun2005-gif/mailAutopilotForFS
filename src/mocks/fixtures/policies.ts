// Declarative policy packs (Dev Plan §6.5): structured conditions are
// language-neutral; clause explanation text is i18n in the UI. The local
// deterministic engine (M2) evaluates these; /mock/policy/evaluate is only a
// network shell around it.
import type { BiText } from "./types.ts";

export type Comparator = "lte" | "eq" | "in";

export interface PolicyCondition {
  code: string;
  label: BiText;
  /** Data the engine must fetch via the tool gateway. */
  evidenceKey:
    | "waivers12m"
    | "accountStatus"
    | "feeAmountCents"
    | "reportedWithin60d"
    | "errorNoticePresent"
    | "channelIsPOSDebit";
  comparator: Comparator;
  value: number | string | string[] | boolean;
}

export interface PolicyPack {
  policyId: string;
  intentCode: string;
  version: string;
  title: BiText;
  conditions: PolicyCondition[];
  effect:
    | "refund_fee"
    | "deny_refund"
    | "open_dispute_start_clocks"
    | "human_review";
}

export const OD_FEE_WAIVER_V12: PolicyPack = {
  policyId: "OD_FEE_WAIVER",
  intentCode: "od_fee_refund",
  version: "V12",
  title: {
    zh: "透支费退还规则（虚构）",
    en: "Overdraft fee waiver policy (fictional)",
  },
  conditions: [
    {
      code: "OD-1",
      label: {
        zh: "近 12 个月退免记录 ≤ 1 次",
        en: "No more than 1 waiver in the past 12 months",
      },
      evidenceKey: "waivers12m",
      comparator: "lte",
      value: 1,
    },
    {
      code: "OD-2",
      label: {
        zh: "账户状态正常、无逾期",
        en: "Account in good standing, no delinquency",
      },
      evidenceKey: "accountStatus",
      comparator: "eq",
      value: "good",
    },
    {
      code: "OD-3",
      label: { zh: "费用金额 ≤ $35", en: "Fee amount at or below $35" },
      evidenceKey: "feeAmountCents",
      comparator: "lte",
      value: 3500,
    },
  ],
  effect: "refund_fee",
};

// Simulated future version the dev panel can switch to (threshold tightens).
export const OD_FEE_WAIVER_V13: PolicyPack = {
  ...OD_FEE_WAIVER_V12,
  version: "V13",
  conditions: [
    OD_FEE_WAIVER_V12.conditions[0]!,
    OD_FEE_WAIVER_V12.conditions[1]!,
    {
      code: "OD-3",
      label: { zh: "费用金额 ≤ $25", en: "Fee amount at or below $25" },
      evidenceKey: "feeAmountCents",
      comparator: "lte",
      value: 2500,
    },
  ],
};

export const REGE_INTAKE_V3: PolicyPack = {
  policyId: "REG_E_INTAKE",
  intentCode: "reg_e_dispute",
  version: "V3",
  title: {
    zh: "Reg E 错误通知受理（1005.11）",
    en: "Reg E error-notice intake (1005.11)",
  },
  conditions: [
    {
      code: "RE-1",
      label: {
        zh: "对账单发送后 60 天内报告",
        en: "Reported within 60 days of statement delivery",
      },
      evidenceKey: "reportedWithin60d",
      comparator: "eq",
      value: true,
    },
    {
      code: "RE-2",
      label: { zh: "通知包含错误主张", en: "Notice asserts an error" },
      evidenceKey: "errorNoticePresent",
      comparator: "eq",
      value: true,
    },
  ],
  effect: "open_dispute_start_clocks",
};

export const REGE_POS_INVEST_90: PolicyPack = {
  policyId: "REG_E_POS_90",
  intentCode: "reg_e_dispute",
  version: "V3",
  title: {
    zh: "POS 借记卡调查期 90 日历日（1005.11(c)(3)(ii)）",
    en: "POS debit investigation cap 90 calendar days",
  },
  conditions: [
    {
      code: "RE-3",
      label: { zh: "交易通道为 POS 借记卡", en: "Channel is POS debit card" },
      evidenceKey: "channelIsPOSDebit",
      comparator: "eq",
      value: true,
    },
  ],
  effect: "open_dispute_start_clocks",
};

export const POLICY_PACKS: Record<string, PolicyPack> = {
  OD_FEE_WAIVER_V12,
  OD_FEE_WAIVER_V13,
  REGE_INTAKE_V3,
  REGE_POS_INVEST_90,
};

// ── Customer-facing letter templates (locked / receipt / info-request) ──

export const LOCKED_TEMPLATE = {
  templateId: "TPL_LOCKED_STEPUP",
  subject: { zh: "请在 Larkspur App 中核验您的身份", en: "Please verify in the Larkspur app" },
  body: {
    zh: "尊敬的客户：\n\n我们已收到您的来信。为保护您的账户信息，请打开 Larkspur App →「消息」→「待办案件」完成身份核验，核验后我们将继续处理您的请求。\n\nLarkspur Bank 客户服务",
    en: "Dear Customer,\n\nWe've received your message. To protect your account, please open the Larkspur app → Messages → Open cases to verify your identity, and we'll continue handling your request.\n\nLarkspur Bank Customer Service",
  },
};

export const REGE_RECEIPT_TEMPLATE = {
  templateId: "TPL_REGE_RECEIPT",
  subject: {
    zh: "已收到您的交易争议（案件 DSP-10452）",
    en: "We received your dispute (case DSP-10452)",
  },
  body: {
    zh: "尊敬的 Jane Doe：\n\n我们已于 2026 年 9 月 22 日 08:14（收件时间）受理您关于尾号 8821 账户一笔 247.18 美元交易（Northside Market，2026-09-18）的争议。\n\n接下来：\n· 如调查在 10 个工作日内未能完成，我们将在该期限前向您的账户发放临时贷记；\n· POS 借记卡交易的调查最长在 90 个日历日内完成；\n· 您可选择回传签字声明（不强制，调查不等待该材料）；\n· 请勿在邮件中提供完整卡号或 CVV。\n\nLarkspur Bank 争议处理组",
    en: "Dear Jane Doe,\n\nWe opened a dispute on 2026-09-22 at 08:14 (when we received your message) regarding the $247.18 charge from Northside Market dated 2026-09-18 on your account ending 8821.\n\nWhat happens next:\n· If the investigation can't be finished within 10 business days, we'll post provisional credit to your account before that deadline;\n· For POS debit card transactions, the investigation takes up to 90 calendar days;\n· You may send a signed statement (optional — the investigation does not wait for it);\n· Please do not email your full card number or CVV.\n\nLarkspur Bank Disputes Team",
  },
};

/**
 * The record filed with the compliance queue after a confirmed BEC/ATO case
 * (PRD §5.2 suspicious-activity reporting). It is FILED, never sent: the
 * customer's own warning travels on the on-file channel instead (see
 * onFileWarningSms), so this template carries observed facts about the
 * message and the case — no addressee, no reassurance, no conclusion about
 * intent. Rendering it on the supervisor card is the compliance story; the
 * customer's side of the same case is the SMS in the app.
 */
export const FRAUD_LOCKED_TEMPLATE = {
  templateId: "TPL_FRAUD_LOCKED",
  subject: { zh: "可疑活动备案记录（只含事实）", en: "Suspicious activity record (facts only)" },
  body: {
    zh: "备案编号：SAR-2026-0924-0033\n案件编号：CASE-ATO-3309\n受理时间：2026-09-24 22:47（服务器到达时间戳）\n\n来件记录\n· 发件地址：jane.d0e@outlook.com（与档案内 jane.doe@gmail.com 形近）\n· 显示名：声称客户本人\n· 协议校验：SPF 通过 · DKIM 通过 · DMARC 策略 none\n· 附件：id-verification.png，内嵌指令文本（作为数据归档，未执行）\n· 请求动作：手机号变更 · 补发卡片寄送至未登记地址\n\n处置记录\n· 身份保障定档：I0（无法关联到账户）\n· 动作风险：R3，邮件渠道不提供对应工具，未执行\n· 客户通知：短信，仅发送至档案内号码\n· 档案字段变更：无\n\n本记录由锁定模板生成，仅含上述事实字段，不含结论性判断。",
    en: "Record id: SAR-2026-0924-0033\nCase id: CASE-ATO-3309\nReceived: 2026-09-24 22:47 (server arrival timestamp)\n\nMessage as received\n· Sender address: jane.d0e@outlook.com (lookalike of on-file jane.doe@gmail.com)\n· Display name: claims to be the customer\n· Protocol checks: SPF pass · DKIM pass · DMARC policy none\n· Attachment: id-verification.png, embeds instruction text (filed as data, not executed)\n· Requested actions: phone number change · replacement card dispatched to an unregistered address\n\nHandling as recorded\n· Identity assurance: I0 (cannot be linked to an account)\n· Action risk: R3 — no such tool in the email channel, nothing executed\n· Customer notification: SMS, on-file number only\n· Profile fields changed: none\n\nGenerated from a locked template. The fields above are the facts the system recorded; no conclusion about intent is stated here.",
  },
};
