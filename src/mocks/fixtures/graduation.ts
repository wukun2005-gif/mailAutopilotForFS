// Intent graduation table (fixture). Thresholds are the single source of
// truth shared with gates.ts (M2) and the Builder matrix (M6):
//   regulated intents  ≥ 600 triggers AND 0 critical misses
//   non-regulated      ≥ 300 triggers AND no-edit-approval ≥ 97%
// R3/R4 intents are "never" — no tool exists for them in the email channel.
import type { BiText } from "./types.ts";
import type { RLevel } from "@runtime/state.ts";

export type GraduationStatus =
  | "graduated"
  | "shadow"
  | "rare_hold"
  | "never";

export interface GraduationEntry {
  intentCode: string;
  label: BiText;
  risk: RLevel;
  regulated: boolean;
  triggers90d: number;
  criticalMisses: number;
  noEditApproval: number | null; // 0..1, null for never/rare
  graduatedL: "L3" | "L2" | null;
  /** Clock-driven deterministic obligation, not an AI decision (FR-4.2). */
  clockDriven?: boolean;
  status: GraduationStatus;
  dualSigned: boolean;
  signedBy?: Array<{ role: BiText; at: string }>;
}

export const GRADUATION_TABLE: GraduationEntry[] = [
  {
    intentCode: "general_inquiry",
    label: { zh: "公共信息咨询（费率/网点/流程）", en: "General inquiry (rates / branches / process)" },
    risk: "R0",
    regulated: false,
    triggers90d: 1842,
    criticalMisses: 0,
    noEditApproval: 0.984,
    graduatedL: "L3",
    status: "graduated",
    dualSigned: true,
    signedBy: [
      { role: { zh: "合规", en: "Compliance" }, at: "2026-08-12" },
      { role: { zh: "业务负责人", en: "Business owner" }, at: "2026-08-12" },
    ],
  },
  {
    intentCode: "card_delivery_status",
    label: { zh: "新卡配送状态查询", en: "Replacement card delivery status" },
    risk: "R1",
    regulated: false,
    triggers90d: 612,
    criticalMisses: 0,
    noEditApproval: 0.978,
    graduatedL: "L3",
    status: "graduated",
    dualSigned: true,
    signedBy: [
      { role: { zh: "合规", en: "Compliance" }, at: "2026-08-20" },
      { role: { zh: "业务负责人", en: "Business owner" }, at: "2026-08-21" },
    ],
  },
  {
    intentCode: "transaction_lookup",
    label: { zh: "交易查询（余额/在途交易/扣费解释）", en: "Transaction lookup (balance / activity / charge explanation)" },
    risk: "R1",
    regulated: false,
    triggers90d: 980,
    criticalMisses: 0,
    noEditApproval: 0.968, // 0.2pp short of the 97% bar — stays shadow until it clears
    graduatedL: "L2",
    status: "shadow",
    dualSigned: false,
  },
  {
    intentCode: "transaction_detail",
    label: { zh: "交易明细查询（单笔扣费明细）", en: "Transaction detail (single charge detail)" },
    risk: "R1",
    regulated: false,
    triggers90d: 745,
    criticalMisses: 0,
    noEditApproval: 0.975,
    graduatedL: "L3",
    status: "graduated",
    dualSigned: true,
    signedBy: [
      { role: { zh: "合规", en: "Compliance" }, at: "2026-09-15" },
      { role: { zh: "业务负责人", en: "Business owner" }, at: "2026-09-16" },
    ],
  },
  {
    intentCode: "od_fee_refund",
    label: { zh: "阈值内透支费退还", en: "Within-threshold overdraft fee refund" },
    risk: "R2",
    regulated: false,
    triggers90d: 488,
    criticalMisses: 0,
    noEditApproval: 0.972,
    graduatedL: "L3",
    status: "graduated",
    dualSigned: true,
    signedBy: [
      { role: { zh: "合规", en: "Compliance" }, at: "2026-09-02" },
      { role: { zh: "业务负责人", en: "Business owner" }, at: "2026-09-03" },
    ],
  },
  {
    intentCode: "card_lock",
    label: { zh: "借记卡锁卡（低影响写，已核验后自动）", en: "Debit card lock (low-impact write, auto once verified)" },
    risk: "R2",
    regulated: false,
    triggers90d: 254,
    criticalMisses: 0,
    noEditApproval: 0.981,
    graduatedL: "L3",
    status: "graduated",
    dualSigned: true,
    signedBy: [
      { role: { zh: "合规", en: "Compliance" }, at: "2026-09-10" },
      { role: { zh: "业务负责人", en: "Business owner" }, at: "2026-09-11" },
    ],
  },
  {
    intentCode: "reg_e_intake",
    label: { zh: "Reg E 争议受理 / 起钟 / 回执", en: "Reg E intake / clocks / acknowledgment" },
    risk: "R2",
    regulated: true,
    triggers90d: 640,
    criticalMisses: 0,
    noEditApproval: 0.961,
    graduatedL: "L3",
    status: "graduated",
    dualSigned: true,
    signedBy: [
      { role: { zh: "合规", en: "Compliance" }, at: "2026-09-15" },
      { role: { zh: "业务负责人", en: "Business owner" }, at: "2026-09-16" },
    ],
  },
  {
    intentCode: "reg_e_intake_demo",
    label: { zh: "Reg E 争议受理（演示用影子态）", en: "Reg E intake (demo shadow)" },
    risk: "R2",
    regulated: true,
    triggers90d: 640,
    criticalMisses: 0,
    noEditApproval: 0.955,
    graduatedL: "L2",
    status: "shadow",
    dualSigned: false,
  },
  {
    intentCode: "reg_e_provisional_credit",
    label: { zh: "临时贷记（时钟驱动）", en: "Provisional credit (clock-driven)" },
    risk: "R2",
    regulated: true,
    clockDriven: true,
    triggers90d: 618,
    criticalMisses: 0,
    noEditApproval: null,
    graduatedL: null, // computed by bank rules; never graduates to L3 (PRD §5 Disputes)
    status: "never",
    dualSigned: false,
  },
  {
    intentCode: "reg_e_adjudication",
    label: { zh: "Reg E 争议裁决", en: "Reg E dispute adjudication" },
    risk: "R4",
    regulated: true,
    triggers90d: 214,
    criticalMisses: 0,
    noEditApproval: null,
    graduatedL: null,
    status: "never",
    dualSigned: false,
  },
  {
    intentCode: "contact_detail_change",
    label: { zh: "改地址 / 改联系方式 / 寄卡新地址", en: "Address / contact change, card to new address" },
    risk: "R3",
    regulated: false,
    triggers90d: 176,
    criticalMisses: 0,
    noEditApproval: null,
    graduatedL: null,
    status: "never",
    dualSigned: false,
  },
  {
    intentCode: "wire_recall_request",
    label: { zh: "电汇召回（稀有）", en: "Wire recall (rare)" },
    risk: "R3",
    regulated: false,
    triggers90d: 11,
    criticalMisses: 0,
    noEditApproval: null,
    graduatedL: null,
    status: "rare_hold", // 90-day volume can never reach the bar
    dualSigned: false,
  },
];
