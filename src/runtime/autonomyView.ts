// The autonomy inputs for one intent of the open case, in one place. The
// runtime node (graphNodes) and the on-screen matrix strip both call this, so
// the row the audience sees can never disagree with the verdict the case
// actually received — a demo that shows a different answer than the one that
// was applied would be worse than no demo at all.
import type { CaseStateType } from "./caseState.ts";
import type { ApprovalItem } from "./caseState.ts";
import type { ILevel, RLevel } from "./state.ts";
import type { DecideCellArgs } from "./gates.ts";
import { intentSpec, graduatedLevel } from "./intentRegistry.ts";

export function autonomyInput(
  state: CaseStateType,
  intentCode: string,
  risk: RLevel,
  emailId: string | null,
): DecideCellArgs {
  const spec = intentSpec(intentCode);
  const card = state.policyCards.find(
    (p) => p.sourceEmailId === emailId && p.intentCode === intentCode,
  );
  const priorRefunds = state.actions.filter(
    (a) => a.actionType === "refund_od_fee" && a.status === "done",
  ).length;
  return {
    intentCode,
    risk,
    identity: state.identity?.level ?? "I0",
    policyOverall: card?.overall ?? (spec.policyPackId ? "NOT_RUN" : "NOT_RUN"),
    graduatedL: graduatedLevel(intentCode),
    secondWaiverWithin12m: intentCode === "od_fee_refund" && priorRefunds >= 1,
    fraudSuspected: state.fraud.quarantined,
  };
}

/** I columns, left to right, exactly as the matrix in PRD §6.2 is read. */
export const IDENTITY_COLUMNS: ILevel[] = ["I0", "I1", "I2", "I3"];

/**
 * Spotlight: the oldest pending money_action/adjudication approval for an
 * intent the email turns never decided (clock-driven: provisional credit,
 * adjudication). Matrix verdicts only recompute on email turns, so while such
 * an approval is pending the audit strip must show ITS row — otherwise it
 * stays frozen on the last email row (e.g. "L3 auto-execute" next to a
 * supervisor one-click). Email-intent approvals are skipped, so scripted
 * audit beats never move. Null = fall back to the latest decision.
 */
export function pickSpotlightApproval(state: CaseStateType): ApprovalItem | null {
  const decided = new Set((state.decisions ?? []).map((d) => d.intentCode));
  for (const a of state.approvals ?? []) {
    if (a.status !== "pending") continue;
    if (a.kind !== "money_action" && a.kind !== "adjudication") continue;
    if (decided.has(a.intentCode)) continue;
    try {
      intentSpec(a.intentCode);
    } catch {
      continue;
    }
    return a;
  }
  return null;
}
