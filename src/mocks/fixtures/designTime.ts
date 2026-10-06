// M12 design-time fixtures — nominations, candidate intents, draft consequence
// preview, preventable-inbound tag, board funnel. All fictional illustrative
// numbers for the Day-30 prototype act (PRD v0.3 Appendix A.3).
import type {
  CandidateIntent,
  ConsequencePreview,
  FunnelCounts,
  Nomination,
  PreventableTag,
} from "@/runtime/designTime/types.ts";

// ── FR-12.1 Graduation nominations ──

export const NOMINATIONS: Nomination[] = [
  {
    id: "NOM-A",
    intentCode: "transaction_lookup",
    intentLabel: { zh: "交易/余额查询", en: "Transaction / balance lookup" },
    risk: "R1",
    kind: "fix_template",
    state: "fix_first",
    shadowDays: 14,
    cooldownDays: 30,
    evidence: {
      consistency: {
        reproRate: 0.968,
        sampleSize: 980,
        thresholdRate: 0.97,
        criticalMisses: 0,
        regulated: false,
      },
      calcJudgment: {
        calcShare: 0.968,
        calcPattern: {
          zh: "同一份交易明细 → 同一答复，31 次人工改稿中 24 次只是同一句措辞修补",
          en: "Same ledger extract → same answer; 24 of 31 human edits were the same wording repair",
        },
        judgmentShare: 0.032,
        judgmentCriteria: [
          { zh: "客户对交易本身有异议（应转争议受理）", en: "Customer disputes the transaction itself (route to dispute intake)" },
        ],
      },
      approverVariance: {
        maxGapPp: 1.4,
        approvers: 6,
        detail: { zh: "6 名审批人免修改批准率 95.6%–97.0%", en: "Six approvers' no-edit approval rate 95.6%–97.0%" },
      },
      cohortParity: {
        gaps: [
          { dim: "language", gapPp: 0.2 },
          { dim: "age62", gapPp: 0.1 },
          { dim: "lmi", gapPp: 0.2 },
          { dim: "channel", gapPp: 0.0 },
          { dim: "vulnerability", gapPp: 0.1 },
        ],
        maxGapPp: 0.2,
        thresholdPp: 2,
      },
    },
    templateFix: {
      editSampleCount: 31,
      sameWordingEdits: 24,
      fixedClause: {
        zh: "在答复开头固定一句「以下为您账户实际入账顺序」，消除 24/31 次改稿",
        en: "Fix an opening line 'Below is the actual posting order on your account', removing 24/31 edits",
      },
      reproRateAfterFix: 0.99,
    },
  },
  {
    id: "NOM-B",
    intentCode: "od_fee_refund",
    intentLabel: { zh: "透支费善意减免（超阈值子块）", en: "OD fee goodwill waiver (above-cap sub-block)" },
    risk: "R2",
    kind: "promote_l3_quota",
    state: "awaiting_sign",
    shadowDays: 14,
    cooldownDays: 30,
    proposedLevel: "L3",
    evidence: {
      consistency: {
        reproRate: 0.976,
        sampleSize: 412,
        thresholdRate: 0.97,
        criticalMisses: 0,
        regulated: false,
      },
      calcJudgment: {
        calcShare: 0.92,
        calcPattern: {
          zh: "24 小时内补足资金 + 当日有在途入账 → 412 件人批中 92% 同模式同结果",
          en: "Funds made whole within 24h + same-day pending deposit → 92% of 412 human approvals share one pattern",
        },
        judgmentShare: 0.08,
        judgmentCriteria: [
          { zh: "12 个月内第二次退费（政策求值 OD-1 FAIL）", en: "Second waiver within 12 months (policy OD-1 FAIL)" },
          { zh: "收入冲击 / 长期透支的困难个案", en: "Income-shock / chronic-overdraft hardship cases" },
          { zh: "多意图冲突（同信还涉及争议或欺诈）", en: "Multi-intent conflict (dispute or fraud in the same letter)" },
        ],
      },
      approverVariance: {
        maxGapPp: 2.1,
        approvers: 6,
        detail: { zh: "对计算题部分审批人差异 ≤1pp；差异全部集中在 8% 判断类", en: "≤1pp variance on the calculation cases; all variance sits in the 8% judgment tail" },
      },
      cohortParity: {
        gaps: [
          { dim: "language", gapPp: 0.6 },
          { dim: "age62", gapPp: 0.4 },
          { dim: "lmi", gapPp: 0.5 },
          { dim: "channel", gapPp: 0.2 },
          { dim: "vulnerability", gapPp: 0.3 },
        ],
        maxGapPp: 0.6,
        thresholdPp: 2,
      },
    },
    quota: {
      kind: "usd_month",
      amount: 8000,
      label: { zh: "每月善意减免额度约 $8,000，用尽自动回 L2", en: "~$8,000/month goodwill allowance; auto-ratchet to L2 when exhausted" },
    },
  },
  {
    id: "NOM-R3",
    intentCode: "contact_detail_change",
    intentLabel: { zh: "修改联系方式 / 地址", en: "Contact detail / address change" },
    risk: "R3",
    kind: "never",
    state: "rejected",
    shadowDays: 0,
    cooldownDays: 30,
    neverNominated: true,
    neverReason: {
      zh: "R3 高影响写：攻击者拿下邮箱后最想要的动作，邮件渠道工具层不提供函数",
      en: "R3 high-impact write: the first action after mailbox takeover; no tool exists on the email channel",
    },
    evidence: {
      consistency: { reproRate: 0, sampleSize: 0, thresholdRate: 0.99, criticalMisses: 0, regulated: false },
      calcJudgment: {
        calcShare: 0,
        calcPattern: { zh: "不适用", en: "Not applicable" },
        judgmentShare: 1,
        judgmentCriteria: [{ zh: "永远转已认证渠道或人工", en: "Always route to authenticated channel or human" }],
      },
      approverVariance: { maxGapPp: 0, approvers: 0, detail: { zh: "AI 不提名", en: "AI never nominates" } },
      cohortParity: { gaps: [], maxGapPp: 0, thresholdPp: 2 },
    },
  },
  {
    id: "NOM-R4",
    intentCode: "reg_e_adjudication",
    intentLabel: { zh: "Reg E 争议裁决 / 授信拒赔", en: "Reg E adjudication / credit denial" },
    risk: "R4",
    kind: "never",
    state: "rejected",
    shadowDays: 0,
    cooldownDays: 30,
    neverNominated: true,
    neverReason: {
      zh: "R4 法律责任与 UDAAP 风险：AI 可起草结果函，裁决永远是人（L0）",
      en: "R4 legal liability and UDAAP risk: AI may draft the outcome letter; adjudication stays human (L0)",
    },
    evidence: {
      consistency: { reproRate: 0, sampleSize: 0, thresholdRate: 0.99, criticalMisses: 0, regulated: true },
      calcJudgment: {
        calcShare: 0,
        calcPattern: { zh: "不适用", en: "Not applicable" },
        judgmentShare: 1,
        judgmentCriteria: [{ zh: "法定裁决责任不可委派", en: "Statutory adjudication duty is non-delegable" }],
      },
      approverVariance: { maxGapPp: 0, approvers: 0, detail: { zh: "AI 不提名", en: "AI never nominates" } },
      cohortParity: { gaps: [], maxGapPp: 0, thresholdPp: 2 },
    },
  },
];

// ── FR-12.6 Intent Discovery candidates ──

export const CANDIDATE_INTENTS: CandidateIntent[] = [
  {
    id: "CAND-1",
    proposedCode: "statement_copy_request",
    label: { zh: "历史对账单 / 回单索取", en: "Historical statement / copy request" },
    volume90d: 186,
    trendPct: 24,
    stepConsistency: 0.91,
    steps: [
      { zh: "I2 身份核验", en: "I2 identity verification" },
      { zh: "调取对账单（核心系统只读）", en: "Retrieve statement (core system, read-only)" },
      { zh: "经 secure channel 投递（不含邮件附件）", en: "Deliver via secure channel (never email attachment)" },
      { zh: "关单", en: "Close case" },
    ],
    avgHandleMin: 6.2,
    cohortDist: { zh: "英语/西语、各年龄段分布均匀，最大组差 0.8pp", en: "Even EN/ES and age spread; max cohort gap 0.8pp" },
    suggestedR: "R1",
    suggestedI: "I2",
    toolsMapping: [
      { zh: "statement.retrieve（已有连接器，只读）", en: "statement.retrieve (existing connector, read-only)" },
      { zh: "secure_message.deliver（已有工具）", en: "secure_message.deliver (existing tool)" },
    ],
    state: "awaiting_level",
  },
  {
    id: "CAND-2",
    proposedCode: "bereavement_support",
    label: { zh: "丧亲 / 账户继承聚类", en: "Bereavement / estate cluster" },
    volume90d: 47,
    trendPct: 3,
    stepConsistency: 0.38,
    steps: [
      { zh: "识别丧亲信号", en: "Detect bereavement signal" },
      { zh: "转丧亲专家小组 + 安抚模板", en: "Route to bereavement specialist team + empathy template" },
    ],
    avgHandleMin: 22,
    cohortDist: { zh: "高度异质：POA、死亡证明、共同账户、债务清偿各不相同", en: "Highly heterogeneous: POA, death certificate, joint accounts, debt settlement" },
    suggestedR: "R4",
    suggestedI: "I0",
    toolsMapping: [],
    reportOnly: true,
    reportReason: {
      zh: "涉及身份关系变更（R3/R4），只报告并转专家，永不生成可执行 intent",
      en: "Involves identity-relationship change (R3/R4): report and route to specialists, never generate an executable intent",
    },
    state: "reported",
  },
];

// ── FR-12.5 Draft consequence preview (hangs on email-1 second-waiver draft) ──

export const DRAFT_PREVIEW: ConsequencePreview = {
  scenarioId: "email1",
  draftMarker: { zh: "第二次退费的 L2 解释草稿", en: "Second-waiver L2 explanation draft" },
  currentRecontactPct: 34,
  improvedRecontactPct: 9,
  sampleSize: 412,
  reasons: [
    { zh: "草稿只说「不能退」，没解释是 12 个月一次的政策额度，客户以为是被针对", en: "The draft only says 'cannot refund' without explaining the once-per-12-months allowance; customers read it as arbitrary" },
    { zh: "没有给出下次避免透支费的具体动作", en: "No concrete action to avoid the next overdraft fee" },
  ],
  insertSentence: {
    zh: "建议插入一句：「您的账户在过去 12 个月已使用过一次 courtesy refund；开通低余额提醒（回复 ALERTS 即可）通常可以避免这类费用。」",
    en: "Suggested insert: 'Your account has used its once-per-12-months courtesy refund; enrolling in low-balance alerts (reply ALERTS) typically prevents this fee.'",
  },
  precedents: [
    { kind: "closed", sharePct: 71, summary: { zh: "一次办结：含政策解释 + 下一步动作", en: "Closed in one: policy explanation + next step included" } },
    { kind: "recontact", sharePct: 22, summary: { zh: "14 天内再次来信：多为追问「为什么他能退我不能」", en: "Recontacted within 14 days: mostly asking 'why was theirs refunded and mine wasn't'" } },
    { kind: "escalated", sharePct: 7, summary: { zh: "升级投诉：措辞被读成敷衍 / 指责客户", en: "Escalated complaint: wording read as dismissive / blaming the customer" } },
  ],
};

// ── FR-12.4 Preventable inbound tag (hangs on email-2 first inbound) ──

export const PREVENTABLE_TAG: PreventableTag = {
  scenarioId: "email2",
  emailId: "EM-2-IN-1",
  eventKey: "card_shipped",
  eventLabel: {
    zh: "card_shipped：补卡已于 2026-09-15 寄出（FedEx，ETA 9/30）",
    en: "card_shipped: replacement card mailed 2026-09-15 (FedEx, ETA 9/30)",
  },
  eventAt: "2026-09-15",
  ruleLabel: {
    zh: "事件触发通知：card_shipped → 自动 ETA + 物流号通知（只发账户事实、无链接、频控、可 opt-out）",
    en: "Event-triggered notice: card_shipped → automatic ETA + tracking notice (account facts only, no links, rate-capped, opt-out)",
  },
  shadowState: "would_have_sent",
};

// ── FR-12.2 board headline funnel (fictional pilot Day-30 snapshot) ──

export const INBOX_FUNNEL: FunnelCounts = {
  arrived: 1284,
  triaged: 1284,
  waitingCustomer: 63,
  waitingApproval: 12,
  done: 1209, // 1284 − 63 − 12 (funnel reconciles exactly)
  psi: 0.04,
  preventableRatePct: 8.4,
};
