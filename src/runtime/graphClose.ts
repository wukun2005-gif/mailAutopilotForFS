// Node 9 — close · verify · learn, plus clock-turn scheduling for email 2
// (provisional credit approval window, Day-40 merchant evidence, Day-45
// closure) and the email-1 +14-day verified-resolution check (FR-11.5).
import type { CaseStateType } from "./caseState.ts";
import type { ApprovalItem } from "./caseState.ts";
import type { NodeDeps, NodeFn } from "./graphNodes.ts";
import { unwrap as unwrapEnvelope } from "./graphNodes.ts";
import { appendEvent } from "./eventStore.ts";
import {
  simClock,
  regEClocks,
  DAY0_EPOCH,
  diffCalendarDays,
} from "./simClock.ts";
import { DISPUTE_EMAIL2 } from "@/mocks/fixtures/index.ts";

export const PC_APPROVAL = "AP-PCREDIT";
export const ADJ_APPROVAL = "AP-ADJUDICATION";
export const SIGN_APPROVAL = "AP-RESULTSIGN";
export const FRAUD_APPROVAL = "AP-FRAUD-CONFIRM";
export const OD2_APPROVAL = "AP-OD2-EXPLAIN";

/** Approvals created by the passage of the simulated clock (email 2). */
export async function actOnClock(
  deps: NodeDeps,
  state: CaseStateType,
): Promise<ApprovalItem[]> {
  const out: ApprovalItem[] = [];
  if (state.scenarioId !== "email2") return out;
  const clocks = regEClocks(DAY0_EPOCH);
  const pcDone = state.actions.some(
    (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
  );
  if (
    state.clocksFiled && !pcDone &&
    !state.approvals.some((a) => a.id === PC_APPROVAL) &&
    simClock.now() >= clocks.provisionalCreditDue - 48 * 3600 * 1000
  ) {
    out.push({
      id: PC_APPROVAL, kind: "money_action", intentCode: "reg_e_provisional_credit",
      risk: "R2", lLevel: "L2", title: "Post provisional credit before bd10 deadline",
      actionType: "reg_e_provisional_credit", amountCents: DISPUTE_EMAIL2.provisionalCreditCents,
      clockDueAt: clocks.provisionalCreditDue, status: "pending",
    });
  }
  const evidence = unwrapEnvelope<{ available: boolean }>(
    await deps.gateway.get(`/mock/merchant-evidence/${DISPUTE_EMAIL2.disputeId}`),
  );
  if (
    evidence.available &&
    !state.approvals.some((a) => [ADJ_APPROVAL, SIGN_APPROVAL].includes(a.id))
  ) {
    out.push({
      id: ADJ_APPROVAL, kind: "adjudication", intentCode: "reg_e_adjudication",
      risk: "R4", lLevel: "L0", title: "Human adjudication — merchant evidence arrived (Day 40)",
      status: "pending",
    });
  }
  return out;
}

export function makeClose(): NodeFn {
  return async (state) => {
    if (state.fraud.quarantined) {
      const confirmed = state.approvals.some(
        (a) => a.id === FRAUD_APPROVAL && a.status === "approved",
      );
      if (!confirmed) {
        return { fraud: { ...state.fraud, confirmed }, status: "quarantined" as const };
      }
      // Step 9 for fraud cases: on-file warning sent → seal the dossier (WORM)
      // and close. False-positive releases stay open for the restored thread.
      const smsDone = state.actions.some(
        (a) => a.actionType === "notify_onfile" && a.status === "done",
      );
      if (smsDone) {
        await appendEvent({
          caseId: state.caseId, node: "close", type: "system",
          data: { closed: true, reason: "fraud confirmed, on-file notified, dossier sealed" },
          reasonCodes: ["FR-11.1_WORM_SEALED"],
        });
        return { fraud: { ...state.fraud, confirmed }, status: "closed" as const };
      }
      return { fraud: { ...state.fraud, confirmed }, status: "quarantined" as const };
    }
    const pendingApprovals = state.approvals.filter((a) => a.status === "pending");
    if (pendingApprovals.length > 0) return { status: "awaiting_human" as const };
    if (state.status === "awaiting_customer") return {};

    if (state.turn.kind === "clock") {
      const resultSent = state.outbound.some((o) => o.draftId?.startsWith("DR-RESULT"));
      if (state.scenarioId === "email2" && resultSent && simClock.dayN() >= 45) {
        await appendEvent({
          caseId: state.caseId, node: "close", type: "system",
          data: { closed: true, reason: "result letter sent, Day 45" },
        });
        return { status: "closed" as const };
      }
      const refund = state.actions.find(
        (a) => a.actionType === "refund_od_fee" && a.status === "done",
      );
      if (state.scenarioId === "email1" && refund) {
        // Beat 2 resolution has its own 14-day watch anchored at send time.
        const od2 = state.outbound.find((o) => o.draftId === "DR-OD2-EXPLAIN");
        if (od2) {
          const sentDay = diffCalendarDays(DAY0_EPOCH, od2.atSimTime);
          const inboundAfterOd2 = state.emails.filter(
            (e) => e.dir === "in" && e.atDayN > sentDay,
          ).length;
          if (simClock.dayN() >= sentDay + 14 && inboundAfterOd2 === 0 && state.status !== "closed") {
            await appendEvent({
              caseId: state.caseId, node: "close", type: "system",
              data: { verifiedResolution: true, atDayN: simClock.dayN() },
              reasonCodes: ["FR-11.5_VERIFIED_14D_NO_REPEAT"],
            });
            return { status: "closed" as const };
          }
        }
        const refundDay = diffCalendarDays(DAY0_EPOCH, refund.simTime);
        const inboundAfter = state.emails.filter(
          (e) => e.dir === "in" && e.atDayN > refundDay,
        ).length;
        if (simClock.dayN() >= refundDay + 14 && inboundAfter === 0 && state.status !== "closed") {
          await appendEvent({
            caseId: state.caseId, node: "close", type: "system",
            data: { verifiedResolution: true, atDayN: simClock.dayN() },
            reasonCodes: ["FR-11.5_VERIFIED_14D_NO_REPEAT"],
          });
          return { status: "closed" as const };
        }
      }
      return {};
    }

    // Email / step-up turns: autonomous replies enter the 14-day verify window.
    const hasAutoReply = state.outbound.length > 0;
    if (hasAutoReply && state.status !== "closed") return { status: "pending_verify" as const };
    return {};
  };
}
