// The autonomy inputs for one intent of the open case, in one place. The
// runtime node (graphNodes) and the on-screen matrix strip both call this, so
// the row the audience sees can never disagree with the verdict the case
// actually received — a demo that shows a different answer than the one that
// was applied would be worse than no demo at all.
import type { CaseStateType } from "./caseState.ts";
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
