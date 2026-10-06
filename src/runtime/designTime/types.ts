// M12 Design-time Intelligence types (PRD v0.3 §6.6, FR-12.1–12.7).
// Runtime stays deterministic: nothing in this layer ever sits on a live
// decision path. It proposes (nominations, packs, diffs, new intents); humans
// grant. All numbers are fictional illustrative fixtures.
import type { BiText } from "@/mocks/fixtures/types.ts";
import type { ILevel, LLevel, RLevel } from "@runtime/state.ts";

// ── FR-12.1 Graduation nominations ──

export type NominationState =
  | "fix_first" // evidence fails the bar; AI prescribes the fix, does not lower it
  | "in_shadow" // 14-day shadow running / replayed
  | "awaiting_sign" // shadow passed; waiting dual sign
  | "granted"
  | "rejected"
  | "cooldown"; // rejected → 30-day rate limit

export type NominationKind = "fix_template" | "promote_l3_quota" | "never";

/** Five proxy dimensions for cohort parity (PRD §6.6; protected attributes
 *  like race/sex are never collected). */
export type CohortDim = "language" | "age62" | "lmi" | "channel" | "vulnerability";

export interface CohortGap {
  dim: CohortDim;
  gapPp: number; // absolute percentage-point difference, worst cohort vs rest
}

export interface FourProofs {
  /** Proof 1 — consistency: deterministic-rule reproduction of human calls. */
  consistency: {
    reproRate: number;
    sampleSize: number;
    /** Bar the nomination claims against (0.97 non-regulated / 0.99 regulated). */
    thresholdRate: number;
    /** Regulated intents additionally require zero missed critical cases. */
    criticalMisses: number;
    regulated: boolean;
  };
  /** Proof 2 — calculation vs judgment split. */
  calcJudgment: {
    calcShare: number; // share of human cases that are same-evidence → same result
    calcPattern: BiText;
    judgmentShare: number;
    judgmentCriteria: BiText[];
  };
  /** Proof 3 — approver variance (high variance ⇒ policy ambiguity, not AI). */
  approverVariance: { maxGapPp: number; approvers: number; detail: BiText };
  /** Proof 4 — cohort parity; any gap ≥ thresholdPp invalidates the nomination. */
  cohortParity: { gaps: CohortGap[]; maxGapPp: number; thresholdPp: number };
}

export interface Nomination {
  id: string;
  intentCode: string;
  intentLabel: BiText;
  risk: RLevel;
  kind: NominationKind;
  state: NominationState;
  evidence: FourProofs;
  shadowDays: number;
  /** fix_template: what to repair, and the projected repro rate after. */
  templateFix?: {
    editSampleCount: number;
    sameWordingEdits: number;
    fixedClause: BiText;
    reproRateAfterFix: number;
  };
  /** promote_l3_quota: monthly allowance; exhaustion auto-ratchets back to L2. */
  quota?: { kind: "usd_month" | "items_month"; amount: number; label: BiText };
  proposedLevel?: LLevel;
  /** R3/R4 rows: AI never nominates, shown greyed. */
  neverNominated?: boolean;
  neverReason?: BiText;
  signedBy?: Array<{ role: "compliance" | "business"; at: string }>;
  rejectedAt?: number;
  cooldownDays: number;
}

// ── FR-12.2 Wave board ──

export type WaveSeverity = "P0" | "P1" | "P2";
export type WaveStatus =
  | "active"
  | "tightening_applied"
  | "awaiting_dual_sign"
  | "remediating"
  | "resolved"
  | "routed";

export interface TighteningPack {
  ackTemplate: BiText; // known-event receipt: account facts only, no links
  ticket: BiText; // internal ticket to the owning ops team
  downgrades: Array<{ intentCode: string; intentLabel: BiText; from: LLevel; to: LLevel }>;
  expiresHours: number; // ratchet auto-reverses at now + 24h
  appliedAt?: number;
  expiresAt?: number;
}

export interface RemediationBatch {
  pct: number;
  accounts: number;
  status: "pending" | "running" | "done";
}

export interface RemediationPlan {
  signature: BiText;
  scanTotal: number;
  affectedWriters: number; // customers who emailed
  silentVictims: number; // same tape, never wrote
  perAccountTapeCount: number;
  amountTotalUsd: number;
  bankErrorConfirmed: boolean;
  signedSample: boolean;
  signedTotal: boolean;
  batches: RemediationBatch[];
  idempotencyKeyPrefix: string;
  reversible: boolean;
}

export interface Wave {
  id: string;
  severity: WaveSeverity;
  title: BiText;
  signature: BiText;
  windowMin: number;
  emailCount: number;
  sampleSubjects: BiText[];
  volumeSeries: number[];
  cohorts: BiText;
  recommended: BiText;
  status: WaveStatus;
  tightening?: TighteningPack;
  remediation?: RemediationPlan;
  routedTo?: BiText;
}

// ── FR-12.3 Policy Compiler ──

export type CompileInputKind = "sentence" | "doc_diff" | "regulatory";
export type CompileState =
  | "draft"
  | "compiled"
  | "closed_world_error"
  | "checklist_only"
  | "awaiting_sign"
  | "granted";

export interface ClauseDiff {
  code: string;
  clause: BiText;
  field: string;
  before: string;
  after: string;
}

export interface StaleTemplate {
  id: string;
  name: BiText;
  issue: BiText;
}

export interface DissentCard {
  title: BiText;
  body: BiText;
  severity: "edge" | "cohort" | "conflict";
}

export interface Compilation {
  id: string;
  inputKind: CompileInputKind;
  inputText: BiText;
  state: CompileState;
  /** Closed-world violation: the requested rule needs evidence we cannot read. */
  missingField?: BiText;
  /** Regulatory summaries only ever produce a checklist, never a diff. */
  checklist?: BiText[];
  diffs: ClauseDiff[];
  staleTemplates: StaleTemplate[];
  backtest: { windowDays: number; flipCount: number };
  dissents: DissentCard[];
  cohortMaxGapPp: number;
  signedBy?: Array<{ role: "compliance" | "business"; at: string }>;
  effectiveVersion?: string;
}

// ── FR-12.6 Intent Discovery ──

export type CandidateState = "reported" | "awaiting_level" | "in_shadow";

export interface CandidateIntent {
  id: string;
  proposedCode: string;
  label: BiText;
  volume90d: number;
  trendPct: number;
  stepConsistency: number;
  steps: BiText[];
  avgHandleMin: number;
  cohortDist: BiText;
  suggestedR: RLevel;
  suggestedI: ILevel;
  toolsMapping: BiText[];
  /** Clusters like bereavement are reported for specialist routing only;
   *  they never generate an executable intent. */
  reportOnly?: boolean;
  reportReason?: BiText;
  state: CandidateState;
}

// ── FR-12.4 / FR-12.5 runtime-adjacent advisory fixtures ──

export interface ConsequencePreview {
  scenarioId: string;
  /** Identifies which draft the preview hangs beside. */
  draftMarker: BiText;
  currentRecontactPct: number;
  improvedRecontactPct: number;
  reasons: BiText[];
  insertSentence: BiText;
  precedents: Array<{
    kind: "closed" | "recontact" | "escalated";
    sharePct: number;
    summary: BiText;
  }>;
  sampleSize: number;
}

export interface PreventableTag {
  scenarioId: string;
  emailId: string;
  eventKey: string;
  eventLabel: BiText;
  eventAt: string;
  ruleLabel: BiText;
  shadowState: "observing" | "would_have_sent";
}

// ── FR-12.2 board headline ──

export interface FunnelCounts {
  arrived: number;
  triaged: number;
  waitingCustomer: number;
  waitingApproval: number;
  done: number;
  /** Pacing Stability Index, fictional 0–1 (lower = steadier). */
  psi: number;
  /** Share of inbound that an event-triggered notice could have prevented. */
  preventableRatePct: number;
}
