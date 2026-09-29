// 90-day backtest result set (fictional), three-tier sampling (A stratified /
// B random / C edge+adversarial), per-intent metrics, and the conformal
// calibration card. Consumed by the Builder screen (M6); recorded here so the
// prototype never computes "results" at runtime.
import type { BiText } from "./types.ts";

export const BACKTEST_WINDOW = {
  from: "2026-06-24",
  to: "2026-09-22",
  totalThreads: 12480,
  validInbound: 11904,
  notes: {
    zh: "全部数字为虚构，用于演示回测与毕业流程。",
    en: "All figures fictional, for demo of backtest & graduation flow.",
  },
};

export interface SampleTier {
  tier: "A" | "B" | "C";
  label: BiText;
  method: BiText;
  size: number;
  independentlyLabeled: boolean;
}

export const SAMPLE_TIERS: SampleTier[] = [
  {
    tier: "A",
    label: { zh: "A · 分层抽样", en: "A · Stratified" },
    method: {
      zh: "按意图×R 档×身份档分层，每格至少 20 件",
      en: "Stratified by intent × R × I; ≥20 per cell",
    },
    size: 200,
    independentlyLabeled: true,
  },
  {
    tier: "B",
    label: { zh: "B · 随机抽样", en: "B · Random" },
    method: {
      zh: "全部有效进件均匀随机",
      en: "Uniform random over valid inbound",
    },
    size: 100,
    independentlyLabeled: true,
  },
  {
    tier: "C",
    label: { zh: "C · 边缘与对抗集", en: "C · Edge & adversarial" },
    method: {
      zh: "红队构造：仿冒、注入、混合意图、跨线程、时钟临界",
      en: "Red-team: spoof, injection, multi-intent, cross-thread, clock edges",
    },
    size: 50,
    independentlyLabeled: true,
  },
];

export interface IntentMetric {
  intentCode: string;
  triggers: number;
  aiVsHumanAgreement: number;
  noEditApproval: number;
  recallRegulated: number | null;
  criticalMisses: number;
  regretPpm: number; // false-autonomy per million
  unitCostUsd: number;
}

export const INTENT_METRICS: IntentMetric[] = [
  { intentCode: "general_inquiry", triggers: 1842, aiVsHumanAgreement: 0.991, noEditApproval: 0.984, recallRegulated: null, criticalMisses: 0, regretPpm: 0, unitCostUsd: 0.04 },
  { intentCode: "card_delivery_status", triggers: 612, aiVsHumanAgreement: 0.985, noEditApproval: 0.978, recallRegulated: null, criticalMisses: 0, regretPpm: 0, unitCostUsd: 0.07 },
  { intentCode: "transaction_lookup", triggers: 980, aiVsHumanAgreement: 0.976, noEditApproval: 0.968, recallRegulated: null, criticalMisses: 0, regretPpm: 120, unitCostUsd: 0.09 },
  { intentCode: "od_fee_refund", triggers: 488, aiVsHumanAgreement: 0.974, noEditApproval: 0.972, recallRegulated: null, criticalMisses: 0, regretPpm: 0, unitCostUsd: 0.11 },
  { intentCode: "reg_e_intake", triggers: 640, aiVsHumanAgreement: 0.992, noEditApproval: 0.961, recallRegulated: 0.997, criticalMisses: 0, regretPpm: 0, unitCostUsd: 0.18 },
  { intentCode: "reg_e_adjudication", triggers: 214, aiVsHumanAgreement: 0.881, noEditApproval: 0.72, recallRegulated: 0.982, criticalMisses: 2, regretPpm: 1400, unitCostUsd: 0.34 },
  { intentCode: "contact_detail_change", triggers: 176, aiVsHumanAgreement: 0.91, noEditApproval: 0.0, recallRegulated: null, criticalMisses: 0, regretPpm: 0, unitCostUsd: 0.0 },
  { intentCode: "wire_recall_request", triggers: 11, aiVsHumanAgreement: 0.0, noEditApproval: 0.0, recallRegulated: null, criticalMisses: 0, regretPpm: 0, unitCostUsd: 0.0 },
];

export const CONFORMAL_CARD = {
  method: {
    zh: "分裂共形预测（split conformal），稀有意图弃权兜底（FR-3.5）",
    en: "Split conformal prediction, rare-intent abstain fallback (FR-3.5)",
  },
  alpha: 0.05,
  calibrationSize: 500,
  coverageObserved: 0.956,
  abstainRate: 0.078,
  // Risk-coverage curve points {coverage, avgSetSize}
  curve: [
    { coverage: 0.80, avgSetSize: 1.05 },
    { coverage: 0.90, avgSetSize: 1.18 },
    { coverage: 0.95, avgSetSize: 1.42 },
    { coverage: 0.98, avgSetSize: 1.87 },
    { coverage: 0.99, avgSetSize: 2.31 },
  ],
  verdict: {
    zh: "覆盖率达标（≥1−α）；稀有意图在高覆盖下自动弃权转人。",
    en: "Coverage meets 1−α; rare intents abstain to human at high coverage.",
  },
};

export const READINESS_CHECKS = [
  {
    code: "REG_RECALL",
    label: { zh: "受监管召回点估计 ≥ 99.5% 且 0 漏检", en: "Regulated recall ≥ 99.5% point estimate, 0 misses" },
    pass: true,
    detail: "reg_e_intake 召回 99.7%（638/640），阴性复标 0 漏检",
  },
  {
    code: "CLOCKS",
    label: { zh: "Reg E/Z 时钟达成率 100%", en: "Reg E/Z clock attainment 100%" },
    pass: true,
    detail: "回测样本 640 件，bd10/day90/RegZ30 全部按时",
  },
  {
    code: "DOSSIER",
    label: { zh: "卷宗完整率 100%", en: "Dossier completeness 100%" },
    pass: true,
    detail: "A/B/C 三层 350 件独立标注全部完整",
  },
  {
    code: "NOEDIT",
    label: { zh: "非受监管免修改批准率 ≥ 97%", en: "Non-regulated no-edit approval ≥ 97%" },
    pass: true,
    detail: "general_inquiry 98.4% / card_delivery 97.8% / od_fee 97.2%",
  },
  {
    code: "COST",
    label: { zh: "单案推理成本 ≤ $0.30", en: "Per-case inference cost ≤ $0.30" },
    pass: true,
    detail: "毕业意图最高 $0.18（reg_e_intake）",
  },
  {
    code: "ADJUDICATION",
    label: { zh: "争议裁决保持人工（永不自动）", en: "Adjudication stays human (never-auto)" },
    pass: true,
    detail: "reg_e_adjudication 0.72 免修改率，2 次关键错误，保持 R4",
  },
];
