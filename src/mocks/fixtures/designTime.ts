// M12 design-time fixtures — nominations, candidate intents, draft consequence
// preview, preventable-inbound tag, board funnel. All fictional illustrative
// numbers for the Day-30 prototype act (PRD v0.3 Appendix A.3).
import type {
  CandidateIntent,
  ConsequencePreview,
  FunnelCounts,
  Nomination,
  NoticeRule,
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
  {
    // §4.2 / §12.1 canary: planted knowing it must be rejected. The first three
    // proofs pass; only proof ④ fails (language gap 2.4pp > 2pp bar, locked
    // translations not pre-approved). A signer reading the card rejects it; a
    // signer rubber-stamping diff approves it and loses bulk signing rights.
    id: "NOM-CANARY",
    intentCode: "card_replacement_eta",
    intentLabel: { zh: "补卡进度查询（提名）", en: "Replacement-card ETA (nomination)" },
    risk: "R1",
    kind: "promote_l3_quota",
    state: "awaiting_sign",
    shadowDays: 14,
    cooldownDays: 30,
    proposedLevel: "L3",
    evidence: {
      consistency: {
        reproRate: 0.981,
        sampleSize: 604,
        thresholdRate: 0.97,
        criticalMisses: 0,
        regulated: false,
      },
      calcJudgment: {
        calcShare: 0.94,
        calcPattern: {
          zh: "寄出事件 + 追踪号 → 同一答复，人批 604 件中 94% 同模式",
          en: "Ship event + tracking number → same answer; 94% of 604 human approvals share one pattern",
        },
        judgmentShare: 0.06,
        judgmentCriteria: [
          { zh: "地址异常 / 退回重寄的判断件", en: "Address exception / returned-and-reshipped cases" },
        ],
      },
      approverVariance: {
        maxGapPp: 1.8,
        approvers: 5,
        detail: { zh: "5 名审批人免修改批准率 96.1%–97.9%", en: "Five approvers' no-edit rate 96.1%–97.9%" },
      },
      // The single failing proof — and the whole point of the canary.
      cohortParity: {
        gaps: [
          { dim: "language", gapPp: 2.4 },
          { dim: "age62", gapPp: 0.3 },
          { dim: "lmi", gapPp: 0.4 },
          { dim: "channel", gapPp: 0.2 },
          { dim: "vulnerability", gapPp: 0.1 },
        ],
        maxGapPp: 2.4,
        thresholdPp: 2,
      },
    },
    quota: {
      kind: "items_month",
      amount: 1500,
      label: { zh: "每月 1,500 件额度，用尽自动回 L2", en: "1,500 items/month allowance; auto-ratchet to L2 when exhausted" },
    },
    canary: {
      expected: "reject",
      tell: {
        zh: "第 ④ 项证明未过：语言维度组差 2.4pp 超过 2pp 门槛（西语锁定段翻译尚未预批准），按 FR-12.7 提名自动不成立——正确动作是拒绝。",
        en: "Proof ④ fails: the language gap is 2.4pp against the 2pp bar (the Spanish locked translation is not pre-approved yet), so under FR-12.7 the nomination is void — reject it.",
      },
    },
  },
  {
    // AC5: a rare intent never gets a nomination, only an observation report.
    id: "NOM-RARE",
    intentCode: "safe_deposit_inquiry",
    intentLabel: { zh: "保管箱查询（稀有意图）", en: "Safe-deposit-box inquiry (rare intent)" },
    risk: "R1",
    kind: "observation",
    state: "insufficient_sample",
    shadowDays: 0,
    cooldownDays: 30,
    observation: {
      requiredSample: 300,
      observedSample: 47,
      note: {
        zh: "90 天仅 47 件，不足非受监管意图 300 件门槛：不出提名、不缩短 shadow、不降低门槛，只留观测报告；继续停留 L2。",
        en: "Only 47 cases in 90 days, short of the 300-case bar for non-regulated intents: no nomination, no shortened shadow, no lowered bar — an observation report only, and it stays at L2.",
      },
    },
    evidence: {
      consistency: { reproRate: 0, sampleSize: 47, thresholdRate: 0.97, criticalMisses: 0, regulated: false },
      calcJudgment: {
        calcShare: 0,
        calcPattern: { zh: "样本不足，不下结论", en: "Insufficient sample; no conclusion drawn" },
        judgmentShare: 1,
        judgmentCriteria: [
          { zh: "需分行现场核验，保持人工", en: "Requires in-branch verification; stays human" },
        ],
      },
      approverVariance: { maxGapPp: 0, approvers: 0, detail: { zh: "样本不足，不下结论", en: "Insufficient sample; no conclusion drawn" } },
      cohortParity: { gaps: [], maxGapPp: 0, thresholdPp: 2 },
    },
  },
];

// ── FR-12.4 event-triggered notice rules (Builder shadow switch) ──

export const NOTICE_RULES: NoticeRule[] = [
  {
    id: "NOTICE-1",
    eventKey: "card_shipped",
    eventLabel: { zh: "补卡寄出事件（含追踪号）", en: "Replacement card shipped (with tracking number)" },
    ruleLabel: { zh: "寄出后主动发 ETA 通知", en: "Send a proactive ETA notice after shipment" },
    mode: "shadow",
    shadowStats: {
      windowDays: 30,
      wouldHaveSent: 214,
      stillWroteIn: 26,
      controlSize: 230,
      controlWroteIn: 78,
    },
    constraints: [
      { zh: "锁定模板 + slots，只陈述账户事实", en: "Locked template + slots; account facts only" },
      { zh: "每客户频控，尊重 opt-out", en: "Per-customer frequency cap; opt-out honoured" },
      { zh: "只发 on-file 地址", en: "On-file address only" },
      { zh: "无营销内容、无产品推荐", en: "No marketing, no product recommendation" },
      { zh: "不附索要信息 / 凭据的链接", en: "No links that ask for information or credentials" },
    ],
  },
  {
    id: "NOTICE-2",
    eventKey: "fee_assessed",
    eventLabel: { zh: "透支费入账事件", en: "Overdraft fee posted" },
    ruleLabel: { zh: "入账当日主动发余额提醒", en: "Proactive low-balance alert the day the fee posts" },
    mode: "off",
    shadowStats: {
      windowDays: 0,
      wouldHaveSent: 0,
      stillWroteIn: 0,
      controlSize: 0,
      controlWroteIn: 0,
    },
    constraints: [
      { zh: "教育性内容，不推产品", en: "Educational content only; no product push" },
      { zh: "每客户频控，尊重 opt-out", en: "Per-customer frequency cap; opt-out honoured" },
      { zh: "只发 on-file 地址", en: "On-file address only" },
    ],
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
];

// ── FR-12.5 Draft consequence preview (hangs on email-1 second-waiver draft) ──

export const DRAFT_PREVIEW: ConsequencePreview = {
  scenarioId: "email1",
  draftMarker: { zh: "第二次退费的 L2 解释草稿", en: "Second-waiver L2 explanation draft" },
  currentRecontactPct: 34,
  improvedRecontactPct: 9,
  sampleSize: 412,
  reasons: [
    { zh: "没有给出下次避免透支费的具体动作", en: "No concrete action to avoid the next overdraft fee" },
  ],
  insertSentence: {
    zh: "建议插入一句：「开通低余额提醒（回复 ALERTS 即可）通常可以避免这类费用。」",
    en: "Suggested insert: 'Enrolling in low-balance alerts (reply ALERTS) typically prevents this fee.'",
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
