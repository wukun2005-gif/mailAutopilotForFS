// M12 design-time fixtures — waves (FR-12.2) and Policy Compiler artifacts
// (FR-12.3). All fictional illustrative numbers for the Day-30 act.
import type { Compilation, Wave } from "@/runtime/designTime/types.ts";

// ── FR-12.2 Waves ──

export const WAVES: Wave[] = [
  {
    id: "WAVE-P0",
    severity: "P0",
    title: { zh: "负面浪：同一 BIN 段大面积拒付 / 冻卡", en: "Negative wave: mass denials / card freezes on one BIN range" },
    signature: {
      zh: "20 分钟内 38 封邮件指向同一 BIN 段，关键词 denied / frozen / on hold，样本措辞高度雷同",
      en: "38 emails in 20 minutes referencing one BIN range, keywords denied / frozen / on hold, near-identical wording",
    },
    windowMin: 20,
    emailCount: 38,
    sampleSubjects: [
      { zh: "“我的卡突然刷不过了，我在医院排队”", en: "'My card suddenly stopped working, I'm at the hospital'" },
      { zh: "“你们为什么冻结我的卡？”", en: "'Why did you freeze my card?'" },
    ],
    volumeSeries: [2, 3, 5, 9, 14, 22, 30, 38],
    cohorts: { zh: "跨语言 / 年龄段均匀，非定向群体事件", en: "Even across language / age cohorts — non-targeted population event" },
    recommended: {
      zh: "一键收紧包（棘轮，只能紧不能松）：锁定「已知事件」回执模板、给卡运营建工单、受影响意图 L3→L2，24h 自动到期",
      en: "One-click tightening pack (ratchet, tighter-only): lock known-event receipt, file card-ops ticket, affected intents L3→L2, auto-expire in 24h",
    },
    status: "active",
    tightening: {
      ackTemplate: {
        zh: "已知事件回执（只陈述已确认事实：我们正在处理一个影响部分卡片的事件，不猜测原因、不附链接）",
        en: "Known-event receipt (confirmed facts only: we are addressing an incident affecting some cards; no speculation, no links)",
      },
      ticket: { zh: "自动建工单给卡运营团队（附 BIN 段 + 38 封样本）", en: "Auto-file ticket to card operations (BIN range + 38 samples attached)" },
      downgrades: [
        { intentCode: "card_lock", intentLabel: { zh: "锁卡 / 冻卡咨询", en: "Card lock / freeze inquiry" }, from: "L3", to: "L2" },
        { intentCode: "transaction_lookup", intentLabel: { zh: "拒付交易查询", en: "Denied-transaction lookup" }, from: "L3", to: "L2" },
      ],
      expiresHours: 24,
    },
  },
  {
    id: "WAVE-P1",
    severity: "P1",
    title: { zh: "正面浪：NSF 重复扣费，主动赔付机会", en: "Positive wave: duplicate NSF fees, proactive remediation opportunity" },
    signature: {
      zh: "7 天 212 封来信：授权时余额充足、清算时不足，同一晚批量重复收取 NSF 费",
      en: "212 emails in 7 days: sufficient balance at authorization, insufficient at settlement, duplicate NSF fees posted in one overnight batch",
    },
    windowMin: 7 * 24 * 60,
    emailCount: 212,
    sampleSubjects: [
      { zh: "“我被收了两次 $35 透支费”", en: "'I was charged two $35 overdraft fees'" },
      { zh: "“我买 groceries 时明明有钱”", en: "'I had money when I bought groceries'" },
    ],
    volumeSeries: [12, 19, 31, 48, 66, 24, 12],
    cohorts: { zh: "LMI 普查区占比偏高（组差 1.6pp，<2pp 阈值，持续监控）", en: "Skews to LMI census tracts (1.6pp gap, under the 2pp threshold, monitored)" },
    recommended: {
      zh: "主动 remediation：扫描全部磁带 → 合规/法务确认银行错误 → 双签样本与总额 → 1%→10%→100% 分批，幂等可冲正",
      en: "Proactive remediation: scan full tape → compliance/legal confirms bank error → dual-sign sample and total → staged 1%→10%→100%, idempotent and reversible",
    },
    status: "active",
    remediation: {
      signature: {
        zh: "授权余额快照 > 金额 且 清算时 NSF，且同一账户同晚 ≥2 笔 NSF 费",
        en: "Authorization balance snapshot > amount with NSF at settlement, and ≥2 NSF fees same account same night",
      },
      scanTotal: 3904,
      affectedWriters: 212,
      silentVictims: 3692,
      perAccountTapeCount: 1,
      amountTotalUsd: 117120,
      bankErrorConfirmed: false,
      signedSample: false,
      signedTotal: false,
      // Per-batch populations at cumulative milestones 1% / 10% / 100%:
      // 39, then +351 to reach 390, then +3,514 to reach the full 3,904 tape.
      batches: [
        { pct: 1, accounts: 39, status: "pending" },
        { pct: 10, accounts: 351, status: "pending" },
        { pct: 100, accounts: 3514, status: "pending" },
      ],
      idempotencyKeyPrefix: "REM-NSF-20260930-",
      reversible: true,
    },
  },
  {
    id: "WAVE-P2",
    severity: "P2",
    title: { zh: "摩擦浪：新版 App 发布后登录咨询上升", en: "Friction wave: login how-to volume after new app release" },
    signature: {
      zh: "3 天 64 封「怎么登录 / 找不到账单入口」，无资金影响、无情绪升级",
      en: "64 'how do I log in / where is my statement' emails in 3 days; no money impact, no sentiment escalation",
    },
    windowMin: 3 * 24 * 60,
    emailCount: 64,
    sampleSubjects: [{ zh: "“更新后 App 登录按钮在哪？”", en: "'Where is the login button after the update?'" }],
    volumeSeries: [9, 27, 28],
    cohorts: { zh: "62+ 客户占比 71%", en: "71% from customers aged 62+" },
    recommended: {
      zh: "不收紧、不赔付：转 FR-12.4 事件通知 shadow + 产品团队 onboarding 优化，AI 只提议",
      en: "No tightening, no remediation: route to FR-12.4 notification shadow + product onboarding fix; AI proposes only",
    },
    status: "active",
    routedTo: { zh: "已转 FR-12.4 通知规则 shadow 提议 + 产品团队", en: "Routed to FR-12.4 notification-rule shadow proposal + product team" },
  },
];

// ── FR-12.3 Policy Compiler ──

export const COMPILATIONS: Compilation[] = [
  {
    id: "COMP-1",
    inputKind: "sentence",
    inputText: {
      zh: "「透支费退还上限从 $35 降到 $25」",
      en: "'Lower the overdraft-fee refund cap from $35 to $25'",
    },
    state: "compiled",
    diffs: [
      {
        code: "OD-3",
        clause: { zh: "OD_FEE_WAIVER 条件 OD-3：单笔费用金额上限", en: "OD_FEE_WAIVER condition OD-3: per-item fee cap" },
        field: "feeAmountCents",
        before: "≤ 3500 ($35)",
        after: "≤ 2500 ($25)",
      },
    ],
    staleTemplates: [
      { id: "TPL-OD-ACK-7", name: { zh: "退费回执模板 v7", en: "Fee-waiver acknowledgment v7" }, issue: { zh: "正文写有「$35 上限」，需随版本替换", en: "Body states '$35 cap'; must be replaced with the version" } },
      { id: "TPL-OD-FAQ-2", name: { zh: "透支费 FAQ 回复片段", en: "Overdraft-fee FAQ snippet" }, issue: { zh: "引用旧阈值 $35", en: "References the old $35 threshold" } },
    ],
    backtest: { windowDays: 90, flipCount: 47 },
    dissents: [
      {
        title: { zh: "异议 1（边界个案）", en: "Dissent 1 (edge case)" },
        body: { zh: "47 个翻转案件中 6 件费用为 $26–$30 且当日有在途入账；旧版会退、新版拒绝，建议附解释模板", en: "Of 47 flipped cases, 6 had fees of $26–$30 with same-day pending deposits; old version refunded, new denies — attach an explanation template" },
        severity: "edge",
      },
      {
        title: { zh: "异议 2（cohort）", en: "Dissent 2 (cohort)" },
        body: { zh: "翻转案件在 LMI 普查区占比高 1.7pp（<2pp 阈值但接近），建议上线后 30 天加监控", en: "Flips skew 1.7pp toward LMI tracts (under but near the 2pp threshold); add 30-day post-launch monitoring" },
        severity: "cohort",
      },
      {
        title: { zh: "异议 3（政策冲突）", en: "Dissent 3 (policy conflict)" },
        body: { zh: "营销页仍宣传「$35 courtesy refund」，先改营销材料再生效，否则构成 UDAAP 风险", en: "Marketing still advertises a '$35 courtesy refund'; update marketing before effective date or face UDAAP risk" },
        severity: "conflict",
      },
    ],
    cohortMaxGapPp: 1.7,
    effectiveVersion: "OD_FEE_WAIVER_V13",
  },
  {
    id: "COMP-2",
    inputKind: "sentence",
    inputText: {
      zh: "「给上周手机银行宕机期间投诉过登录问题的客户自动退月费」",
      en: "'Automatically refund monthly fees to customers who complained about login during last week's mobile outage'",
    },
    state: "closed_world_error",
    missingField: {
      zh: "需要新数据源：outage_complaint_flag（宕机投诉标记）——现有证据字段表无法表达「上周宕机期间」这个条件，编译器拒绝生成规则",
      en: "New data source needed: outage_complaint_flag — the closed evidence-field schema cannot express 'during last week's outage'; the compiler refuses to emit a rule",
    },
    diffs: [],
    staleTemplates: [],
    backtest: { windowDays: 90, flipCount: 0 },
    dissents: [],
    cohortMaxGapPp: 0,
  },
  {
    id: "COMP-3",
    inputKind: "regulatory",
    inputText: {
      zh: "监管摘要：SR 26-2 模型风险管理更新（粘贴监管通讯）",
      en: "Regulatory summary: SR 26-2 model risk management update (pasted bulletin)",
    },
    state: "checklist_only",
    checklist: [
      { zh: "是否影响现有 intent 的风险分级？→ 生成 12 项待核查问题，不生成 diff", en: "Does it change risk tiers of existing intents? → 12 review questions, no diff" },
      { zh: "是否新增留痕 / 测试要求？→ 映射到 FR-11.1 WORM 卷宗条款", en: "New recordkeeping / testing duties? → mapped to FR-11.1 WORM file clauses" },
      { zh: "摘要不构成规则来源：任何条款修改必须回到句子 / 文档 diff 通道", en: "A summary is never a rule source: any clause change must re-enter via the sentence / doc-diff channel" },
    ],
    diffs: [],
    staleTemplates: [],
    backtest: { windowDays: 90, flipCount: 0 },
    dissents: [],
    cohortMaxGapPp: 0,
  },
];
