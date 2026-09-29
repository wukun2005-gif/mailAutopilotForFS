// The three autonomy gates, PRD v0.2 §6.2, implemented as PURE functions:
//   R (action risk) × I (identity assurance) → matrix CellValue
//   L = min(graduation L, action-allowed L, identity-allowed L)  [L cells only]
// Everything fail-closed — each rule below has a matching Vitest assertion
// (Dev Plan §6.3 "fail-closed 的具体含义").
import type { CellValue, ILevel, LLevel, RLevel } from "./state.ts";
import type { PolicyVerdict } from "./caseState.ts";

export const L_RANK: Record<LLevel, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

export interface CellDecision {
  cell: CellValue;
  reasonCodes: string[];
  /** False when this intent must not enter the supervisor approval queue. */
  queueable: boolean;
  /** R2×I0 composite: internal intake/clocks run, external reply locked. */
  externalLockedTemplate?: boolean;
}

export interface DecideCellArgs {
  intentCode: string;
  risk: RLevel;
  identity: ILevel;
  policyOverall: PolicyVerdict | "NOT_RUN";
  /** Graduated level from the graduation table; null = not graduated. */
  graduatedL: LLevel | null;
  /** Rule-pack version fetch failed → previous version reused, L3 forbidden. */
  policyVersionDegraded?: boolean;
  /** R2×I3 second OD-fee waiver within 12 months → forced human (PRD §8.1). */
  secondWaiverWithin12m?: boolean;
  fraudSuspected?: boolean;
}

function l(level: LLevel): CellValue {
  return { kind: "L", level };
}

/**
 * Identity-allowed ceiling per matrix column. Only meaningful for cells that
 * are L-class; "deny"/"never" short-circuit before this is consulted.
 */
export function identityCeiling(risk: RLevel, identity: ILevel): LLevel | null {
  if (risk === "R0") return "L3";
  if (risk === "R1") {
    if (identity === "I3" || identity === "I2") return "L3";
    return null; // no account-data disclosure at I0/I1
  }
  if (risk === "R2") {
    if (identity === "I3" || identity === "I2") return "L3";
    return null; // I0/I1 writes are denied (I0 internal-only handled separately)
  }
  if (risk === "R4") return "L1";
  return null;
}

export function decideCell(args: DecideCellArgs): CellDecision {
  const { risk, identity } = args;

  // ── R3: hard never in the email channel (FR-3.1 AC2) ──
  if (risk === "R3") {
    return {
      cell: { kind: "never", reasonCode: "R3_EMAIL_CHANNEL_HARD_NEVER" },
      reasonCodes: ["NEVER_NO_TOOL_REGISTERED", "NEVER_CONFIG_LOCKED"],
      queueable: false,
    };
  }

  // ── R4: permanent L0/L1 — human adjudicates, AI only drafts ──
  if (risk === "R4") {
    return {
      cell: l("L1"),
      reasonCodes: ["R4_ADJUDICATION_HUMAN_L0", "R4_DRAFT_HUMAN_SIGNOFF_L1"],
      queueable: true,
    };
  }

  // ── R0: public information, no account data, all identity columns ──
  if (risk === "R0") {
    if (!args.graduatedL)
      return { cell: l("L0"), reasonCodes: ["NOT_GRADUATED_FAIL_CLOSED"], queueable: false };
    return { cell: l("L3"), reasonCodes: ["R0_PUBLIC_INFO_L3"], queueable: false };
  }

  // ── R1: read/disclose account info, field sensitivity gating in respond ──
  if (risk === "R1") {
    if (identity === "I0") {
      if (args.fraudSuspected)
        return { cell: l("L0"), reasonCodes: ["FRAUD_REVIEW_L0"], queueable: false };
      return {
        cell: { kind: "deny", reasonCode: "R1_I0_NO_DISCLOSE_STEPUP" },
        reasonCodes: ["DRAFT_CHANNEL_CLOSED"],
        queueable: false,
      };
    }
    if (identity === "I1") {
      return {
        cell: { kind: "deny", reasonCode: "R1_I1_NO_DISCLOSE_STEPUP" },
        reasonCodes: ["DRAFT_CHANNEL_CLOSED"],
        queueable: false,
      };
    }
    // I2 (low-sensitivity only) / I3: L2 → graduated L3
    const reasons = [identity === "I2" ? "R1_I2_LOW_SENSITIVITY_FIELDS_ONLY" : "R1_I3"];
    return graduatedLadder(args, reasons);
  }

  // ── R2: reversible low-impact writes ──
  if (risk === "R2") {
    if (identity === "I0") {
      // Composite cell: internal case creation + clocks run automatically;
      // the external receipt is a locked, account-free template.
      return {
        cell: l("L0"),
        reasonCodes: ["R2_I0_INTERNAL_INTAKE_ONLY", "EXTERNAL_LOCKED_TEMPLATE"],
        queueable: false,
        externalLockedTemplate: true,
      };
    }
    if (identity === "I1") {
      return {
        cell: { kind: "deny", reasonCode: "R2_I1_NO_GRANT_GUIDE_STEPUP" },
        reasonCodes: ["DRAFT_CHANNEL_CLOSED", "INTAKE_CLOCKS_STILL_AUTO"],
        queueable: false,
      };
    }

    // I2/I3: policy result decides the write.
    if (args.policyOverall === "UNKNOWN") {
      return {
        cell: l("L0"),
        reasonCodes: ["POLICY_UNKNOWN_FAIL_CLOSED_L0"],
        queueable: false,
      };
    }
    if (args.secondWaiverWithin12m) {
      return {
        cell: l("L2"),
        reasonCodes: ["SECOND_WAIVER_12M_FORCED_HUMAN_L2", "HUMAN_RECONSIDERATION_OPEN"],
        queueable: true,
      };
    }
    if (args.policyOverall === "FAIL") {
      return {
        cell: l("L2"),
        reasonCodes: ["POLICY_FAIL_EXPLANATION_DRAFT_L2"],
        queueable: true,
      };
    }
    return graduatedLadder(args, ["R2_WRITE_L2_TO_GRADUATED_L3"]);
  }

  // Unknown risk → fail closed.
  return { cell: l("L0"), reasonCodes: ["UNKNOWN_RISK_FAIL_CLOSED"], queueable: false };
}

function graduatedLadder(args: DecideCellArgs, reasons: string[]): CellDecision {
  if (!args.graduatedL) {
    return {
      cell: l("L0"),
      reasonCodes: [...reasons, "NOT_GRADUATED_FAIL_CLOSED_L0"],
      queueable: false,
    };
  }
  // Before double-sign graduation the default launch level is L2; a graduated
  // intent may run at the table's level (L2 or L3).
  let level: LLevel = args.graduatedL;
  const finalReasons = [...reasons];
  if (args.policyVersionDegraded && L_RANK[level] > L_RANK.L2) {
    level = "L2";
    finalReasons.push("POLICY_VERSION_FALLBACK_CAP_L2");
  }
  return { cell: l(level), reasonCodes: finalReasons, queueable: level !== "L3" };
}
