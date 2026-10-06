// Full CaseState for the 9-node LangGraph case machine (Dev Plan §6.2).
// Vocabulary types (L/R/I levels, CellValue, CaseEvent) live in state.ts;
// this file adds the zod-validated state shape the graph reducers use.
import { z } from "zod";
import { Annotation } from "@langchain/langgraph";
import type {
  ActionLedgerEntry,
  CaseStatus,
  CellValue,
  ILevel,
  LLevel,
  RLevel,
} from "./state.ts";
import type { EmailMessage } from "@/mocks/fixtures/types.ts";

export const PolicyVerdict = z.enum(["PASS", "FAIL", "UNKNOWN"]);
export type PolicyVerdict = z.infer<typeof PolicyVerdict>;

export const IntentHitSchema = z.object({
  intentCode: z.string(),
  risk: z.enum(["R0", "R1", "R2", "R3", "R4"]),
  confidence: z.number(),
  evidenceSentences: z.array(z.string()).default([]),
  regulated: z.boolean().default(false),
  /** Turn (inbound email id) this hit was detected on. */
  sourceEmailId: z.string(),
});
export type IntentHit = z.infer<typeof IntentHitSchema>;

export const IdentitySignalSchema = z.object({
  code: z.string(),
  passed: z.boolean(),
  detail: z.string().optional(),
});
export type IdentitySignal = z.infer<typeof IdentitySignalSchema>;

export const IdentityStateSchema = z.object({
  level: z.enum(["I0", "I1", "I2", "I3"]),
  signals: z.array(IdentitySignalSchema).default([]),
  /** "retained I3" or the downgrade trigger that fired. */
  reasonCodes: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});
export type IdentityState = z.infer<typeof IdentityStateSchema>;

export const PolicyConditionResultSchema = z.object({
  code: z.string(),
  verdict: PolicyVerdict,
  evidence: z.unknown().nullable(),
});

export const PolicyCardSchema = z.object({
  policyId: z.string(),
  version: z.string(),
  intentCode: z.string(),
  effect: z.string(),
  overall: PolicyVerdict,
  conditions: z.array(PolicyConditionResultSchema),
  degraded: z.boolean().default(false),
  sourceEmailId: z.string(),
});
export type PolicyCard = z.infer<typeof PolicyCardSchema>;

export type ApprovalKind =
  | "money_action" // L2 one-click approve (e.g. refund, provisional credit)
  | "draft_signoff" // L1 human sends
  | "adjudication" // R4: human decides (L0)
  | "fraud_confirm" // quarantine confirm → SAR locked template
  | "manual_review"; // FR-1.5: reviewer clears a low-confidence attachment task

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  intentCode: string;
  risk: RLevel;
  lLevel: LLevel;
  title: string;
  draft?: Draft;
  actionType?: string;
  amountCents?: number;
  clockDueAt?: number;
  status: "pending" | "approved" | "rejected" | "edited";
  /**
   * false = 人工任务：进主管台队列可办，但不暂停案件（不进 checkpoint 暂停
   * 集合、不进 close 的 awaiting_human 判定、不算 snapshot interrupted）。
   * 缺省 = true（审批一到就暂停案件，与既有行为一致）。
   */
  blocking?: boolean;
  reasonCode?: string;
  decidedBy?: string;
  decidedAt?: number;
}

export const DraftSectionSchema = z.object({
  kind: z.enum(["template", "slot", "ai"]),
  textEn: z.string(),
  source: z.string(),
});
export type DraftSection = z.infer<typeof DraftSectionSchema>;

export const DraftSchema = z.object({
  id: z.string(),
  intentCode: z.string(),
  channel: z.enum(["email", "secure_message", "sms"]),
  to: z.string(),
  subject: z.string().optional(),
  sections: z.array(DraftSectionSchema),
  lockedTemplate: z.boolean().default(false),
  dlpClean: z.boolean().default(true),
  /** Agent-edited full text (FR-7.1): shown everywhere and sent on approval. */
  editedText: z.string().optional(),
  /**
   * FR-1.5 对客承诺：这封信对客户说出了承诺。实际发出时登记为
   * PromiseClock，兑现（信发出 / 台账动作完成 / 审批通过 / 到达时刻到点）
   * 即销账。dueInBusinessDays 缺省 = 承诺没有时限（如"会转人工复核"）。
   */
  promise: z
    .object({
      labelKey: z.string(),
      dueInBusinessDays: z.number().optional(),
      fulfillByDraftId: z.string().optional(),
      fulfillByActionType: z.string().optional(),
      fulfillByApprovalId: z.string().optional(),
      /** ISO 时刻：fixture 保证在此之前到达（如卡片 ETA），到点即兑现。 */
      fulfillByEpoch: z.string().optional(),
    })
    .optional(),
});
export type Draft = z.infer<typeof DraftSchema>;

/** FR-1.5 对客承诺时钟：外发信里写给客户的承诺，发送即起钟、兑现即销账。 */
export interface PromiseClock {
  id: string;
  /** 承诺的原信草稿（发出这句承诺的那封信）。 */
  sourceDraftId: string;
  /** 承诺的中文/英文展示名（i18n key）。 */
  labelKey: string;
  /** 到期时刻 = 发出时间 + N 个工作日（算术，不是模型判断）；无时限承诺缺省。 */
  dueAt?: number;
  /** 兑现方式（任一成立即销账）：该 draft 实际发出。 */
  fulfillByDraftId?: string;
  /** 台账里该动作 status=done（如退款已执行）。 */
  fulfillByActionType?: string;
  /** 该人工审批通过（approved/edited）。 */
  fulfillByApprovalId?: string;
  /** fixture 保证的到达时刻（ISO），case 时钟到点即兑现。 */
  fulfillByEpoch?: string;
  /** 兑现时间（兑现条件成立的那一刻）。 */
  fulfilledAt?: number;
}

export interface OutboundRecord {
  id: string;
  channel: "email" | "secure_message" | "sms";
  to: string;
  intentCode: string;
  draftId?: string;
  lockedTemplate: boolean;
  atSimTime: number;
  blockedReason?: string;
  /** Mail thread this reply belongs to (email channel only). */
  threadId?: string;
}

export interface MaterialState {
  code: string;
  status: "not_submitted" | "received" | "ocr_low_confidence";
  ocrConfidence: number | null;
  receivedDayN: number | null;
}

export interface StepUpRecord {
  verified: boolean;
  method: "app_case_card" | "one_time_link";
  atSimTime: number;
  emailId: string;
}

export interface Turn {
  // "approval" is the input-driven resume protocol: a paused case ends its run
  // at END with status awaiting_human; the supervisor's decision arrives as a
  // fresh turn (browser builds cannot rely on LangGraph interrupt()'s ALS).
  kind:
    | "email"
    | "step_up"
    | "clock"
    | "materials"
    | "adjudication"
    | "fraud_review"
    | "approval"
    | "draft_edit"
    /** Policy pack switched under an open case (e.g. Card B grant → V14):
     *  re-runs policy → autonomy → act for the current email so a paused L2
     *  approval is re-decided under the new pack instead of staying pinned. */
    | "policy_refresh";
  emailId?: string;
  atDayN?: number;
  approvalId?: string;
  decision?: "approve" | "reject" | "edit";
  reasonCode?: string;
  outcome?: "error" | "no_error";
  draftId?: string;
  editedText?: string;
}

export interface GraphInput {
  caseId: string;
  threadId: string;
  scenarioId: string;
  customerId: string;
  turn: Turn;
  stepUp?: Omit<StepUpRecord, "atSimTime">;
  adjudication?: { outcome: "error" | "no_error"; investigator: string };
  fraudDecision?: { confirmed: boolean; agent: string };
}

export interface FraudState {
  quarantined: boolean;
  signals: string[];
  confirmed: boolean;
}

// ── LangGraph annotation (reducers documented per channel) ──

function replace<T>() {
  return Annotation<T>({ reducer: (_a, b) => b, default: () => undefined as T });
}

function appendUnique<T extends { id: string }>() {
  return Annotation<T[]>({
    reducer: (a, b) => {
      const map = new Map((a ?? []).map((x) => [x.id, x]));
      for (const x of b ?? []) map.set(x.id, x);
      return [...map.values()];
    },
    default: () => [] as T[],
  });
}

export const CaseStateAnnotation = Annotation.Root({
  caseId: Annotation<string>(),
  threadId: Annotation<string>(),
  scenarioId: Annotation<string>(),
  customerId: Annotation<string>(),
  turn: Annotation<Turn>(),
  stepUp: Annotation<StepUpRecord | null>({
    reducer: (a, b) => b ?? a,
    default: () => null,
  }),
  /** Inbound email currently being processed this turn (retained across turns). */
  currentEmailId: Annotation<string | null>({
    reducer: (a, b) => b ?? a,
    default: () => null,
  }),
  prescan: Annotation<{
    dlpHits: string[];
    atoScore: number | null;
    fraudFlags: string[];
  }>({
    reducer: (_a, b) => b,
    default: () => ({ dlpHits: [], atoScore: null, fraudFlags: [] }),
  }),
  emails: Annotation<EmailMessage[]>({
    reducer: (a, b) => {
      const map = new Map((a ?? []).map((e) => [e.id, e]));
      for (const e of b ?? []) map.set(e.id, e);
      return [...map.values()];
    },
    default: () => [],
  }),
  intents: Annotation<IntentHit[]>({
    reducer: (a, b) => {
      const map = new Map((a ?? []).map((i) => [i.intentCode + "@" + i.sourceEmailId, i]));
      for (const i of b ?? []) map.set(i.intentCode + "@" + i.sourceEmailId, i);
      return [...map.values()];
    },
    default: () => [],
  }),
  identity: replace<IdentityState | null>(),
  policyCards: Annotation<PolicyCard[]>({
    reducer: (a, b) => {
      const map = new Map((a ?? []).map((p) => [p.policyId + "@" + p.sourceEmailId, p]));
      for (const p of b ?? []) map.set(p.policyId + "@" + p.sourceEmailId, p);
      return [...map.values()];
    },
    default: () => [],
  }),
  decisions: Annotation<
    Array<{ intentCode: string; sourceEmailId: string; cell: CellValue; reasonCodes: string[] }>
  >({
    reducer: (a, b) => {
      const map = new Map(
        (a ?? []).map((d) => [d.intentCode + "@" + d.sourceEmailId, d]),
      );
      for (const d of b ?? []) map.set(d.intentCode + "@" + d.sourceEmailId, d);
      return [...map.values()];
    },
    default: () => [],
  }),
  actions: Annotation<ActionLedgerEntry[]>({
    reducer: (a, b) => {
      const map = new Map((a ?? []).map((x) => [x.key, x]));
      for (const x of b ?? []) map.set(x.key, x);
      return [...map.values()];
    },
    default: () => [] as ActionLedgerEntry[],
  }),
  approvals: appendUnique<ApprovalItem>(),
  drafts: appendUnique<Draft>(),
  outbound: appendUnique<OutboundRecord>(),
  /** FR-1.5 对客承诺时钟（登记 → 到期 → 兑现），与法定时钟同板展示。 */
  promiseClocks: appendUnique<PromiseClock>(),
  materials: Annotation<MaterialState[]>({
    reducer: (a, b) => {
      const map = new Map((a ?? []).map((m) => [m.code, m]));
      for (const m of b ?? []) map.set(m.code, m);
      return [...map.values()];
    },
    default: () => [],
  }),
  clocksFiled: Annotation<boolean>({
    reducer: (a, b) => b ?? a,
    default: () => false,
  }),
  provisionalCreditPosted: Annotation<boolean>({
    reducer: (a, b) => b ?? a,
    default: () => false,
  }),
  fraud: Annotation<FraudState>({
    reducer: (_a, b) => b,
    default: () => ({ quarantined: false, signals: [], confirmed: false }),
  }),
  status: Annotation<CaseStatus>({
    reducer: (_a, b) => b,
    default: () => "open",
  }),
  /** Last identity level computed — used by gates when identity node is skipped. */
  lastLevel: Annotation<ILevel | null>({
    reducer: (a, b) => b ?? a,
    default: () => null,
  }),
});

export type CaseStateType = typeof CaseStateAnnotation.State;
