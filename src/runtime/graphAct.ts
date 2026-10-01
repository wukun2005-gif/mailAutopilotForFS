// Nodes 6–7 of the case machine (Dev Plan §6.1): orchestrate & act, then the
// human checkpoint. The pause protocol is input-driven: a case with due
// approvals ends its run at END (status awaiting_human / quarantined), and the
// supervisor's decision arrives as a fresh {kind:"approval"} turn. This keeps
// interrupt/resume working in browser builds, where LangGraph's interrupt()
// has no AsyncLocalStorage. Nodes 8–9 and the clock scheduler live in
// graphRespond.ts / graphClose.ts. Write tools only run through the gateway
// (idempotent); R3 tools are not registered.
import { Command, END } from "@langchain/langgraph";
import type { CaseStateType } from "./caseState.ts";
import type { ApprovalItem, Draft } from "./caseState.ts";
import type { ActionLedgerEntry } from "./state.ts";
import type { NodeDeps, NodeFn } from "./graphNodes.ts";
import { emailById, unwrap as unwrapEnvelope } from "./graphNodes.ts";
import { appendEvent } from "./eventStore.ts";
import { addBusinessDays, simClock } from "./simClock.ts";
import { CUSTOMER_JANE, DISPUTE_EMAIL2 } from "@/mocks/fixtures/index.ts";
import {
  cardDeliveryLetter,
  fraudLockedLetter,
  lockedStepUpLetter,
  materialsAckLetter,
  onFileWarningSms,
  pcPostedLetter,
  refundConfirmationLetter,
  regEReceiptLetter,
  resultLetterError,
  resultLetterNoError,
  secondWaiverExplanationDraft,
  secondWaiverHoldingLetter,
  stepupNudgeLetter,
  transactionDetailLetter,
  caseCardMessage,
} from "./letters.ts";
import { draftText, sendSecure } from "./graphRespond.ts";
import {
  ADJ_APPROVAL,
  FRAUD_APPROVAL,
  PC_APPROVAL,
  SIGN_APPROVAL,
  actOnClock,
} from "./graphClose.ts";
export interface ResumePayload {
  approvalId: string;
  decision: "approve" | "reject" | "edit";
  reasonCode?: string;
  /** adjudication approval only. */
  outcome?: "error" | "no_error";
  editedText?: string;
}

const OD2_APPROVAL = "AP-OD2-EXPLAIN";
// FR-1.5: reviewer task for a low-confidence attachment — queued in the
// supervisor desk, non-blocking (the customer letter promises a review, not a
// deadline, and the dispute clock never waits on materials).
const OCR_REVIEW_APPROVAL = "AP-OCR-REVIEW";

async function emit(
  state: CaseStateType,
  node: string,
  type: "tool_result" | "resume" | "clock" | "system" | "idempotent_replay",
  data?: Record<string, unknown>,
) {
  await appendEvent({ caseId: state.caseId, node, type, data });
}

function due(a: ApprovalItem): boolean {
  if (a.status !== "pending") return false;
  if (a.blocking === false) return false; // FR-1.5 reviewer task: never pauses
  if (!a.clockDueAt) return true;
  return simClock.now() >= a.clockDueAt - 48 * 3600 * 1000;
}

type WriteResult = { entry: ActionLedgerEntry; replayed: boolean };

// ── 6. orchestrate & act ─────────────────────────────────────────────────────

export function makeAct(deps: NodeDeps): NodeFn {
  return async (state) => {
    const updates: Partial<CaseStateType> = { approvals: [], drafts: [] };
    const actionEntries: ActionLedgerEntry[] = [];
    const track = (r: WriteResult) => actionEntries.push(r.entry);
    const addApproval = (a: ApprovalItem) => {
      if (!state.approvals.some((x) => x.id === a.id) && !(updates.approvals ?? []).some((x) => x.id === a.id))
        updates.approvals = [...(updates.approvals ?? []), a];
    };
    const addDraft = (d: Draft) => {
      if (!state.drafts.some((x) => x.id === d.id) && !(updates.drafts ?? []).some((x) => x.id === d.id))
        updates.drafts = [...(updates.drafts ?? []), d];
    };
    const caseCard = async (emailId: string) => {
      if (state.actions.some((a) => a.key.includes(`casecard:${emailId}`))) return;
      const letter = lockedStepUpLetter(state.customerId);
      track(
        await sendSecure(
          deps, state, `casecard:${emailId}`, "case_card",
          `${caseCardMessage().body}\n\n${draftText(letter)}`,
        ),
      );
      // The email thread must say where to go: otherwise the customer has no
      // reason to open the app and the case stalls on their side.
      addDraft(stepupNudgeLetter(state.customerId));
    };

    // Fraud quarantine (email 3): signals converged in ingest.
    const f = state.prescan.fraudFlags;
    const isFraud =
      f.includes("LOCAL_PART_LOOKALIKE") ||
      f.includes("PROMPT_INJECTION") ||
      f.includes("R3_COMBO") ||
      f.some((x) => x.startsWith("ATO_SCORE_") && Number(x.split("_")[2]) >= 70);
    if (isFraud && state.turn.kind === "email") {
      updates.fraud = { quarantined: true, signals: f, confirmed: false };
      updates.status = "quarantined";
      addApproval({
        id: FRAUD_APPROVAL, kind: "fraud_confirm", intentCode: "contact_detail_change",
        risk: "R3", lLevel: "L0", title: "Confirm BEC/ATO quarantine", status: "pending",
      });
      await emit(state, "act", "system", { quarantined: true, signals: f });
      return { ...updates, actions: actionEntries };
    }

    // Clock-driven turns (email 2 statutory timeline).
    if (state.turn.kind === "clock") {
      const clockApprovals = await actOnClock(deps, state);
      return { approvals: clockApprovals, actions: actionEntries };
    }

    if (!["email", "step_up"].includes(state.turn.kind)) return {};
    const emailId = state.currentEmailId;
    if (!emailId) return {};
    const level = state.identity?.level ?? "I0";
    const decisions = state.decisions.filter((d) => d.sourceEmailId === emailId);
    const email = emailById(emailId);

    // Attachments → OCR gate (Day-6 materials).
    if (state.turn.kind === "email" && email?.attachments?.length) {
      const materials = [...state.materials];
      for (const att of email.attachments) {
        const r = unwrapEnvelope<{ gateDecision: string; confidence: number; flags: string[] }>(
          await deps.gateway.postRead("/mock/ocr", { attachmentId: att.id }),
        );
        const existing = materials.findIndex((m) => m.code === att.id);
        const row = {
          code: att.id,
          status: r.gateDecision === "auto_slot" ? ("received" as const) : ("ocr_low_confidence" as const),
          ocrConfidence: r.confidence,
          receivedDayN: simClock.dayN(),
        };
        if (existing >= 0) materials[existing] = row;
        else materials.push(row);
        if (r.gateDecision === "auto_slot") addDraft(materialsAckLetter(state.customerId));
        else {
          // FR-1.5: the letter promises a human review ("an agent will review
          // it manually") — so a task actually has to exist for someone to
          // pick up. Non-blocking: the same letter tells the customer the
          // dispute timeline does not wait on it.
          addDraft(materialsAckLetter(state.customerId, true));
          addApproval({
            id: OCR_REVIEW_APPROVAL, kind: "manual_review", intentCode: "reg_e_intake",
            risk: "R1", lLevel: "L1",
            title: "Manually review low-confidence attachment (OCR)",
            status: "pending", blocking: false,
          });
        }
        await emit(state, "act", "tool_result", { ocr: att.id, gateDecision: r.gateDecision, flags: r.flags });
      }
      updates.materials = materials;
    }

    for (const d of decisions) {
      const cell = d.cell;
      if (d.intentCode === "contact_detail_change") continue; // never cell: no plan, no tool

      if (d.intentCode === "card_delivery_status" && cell.kind === "L" && cell.level === "L3") {
        addDraft(cardDeliveryLetter(state.customerId));
      }

      if (d.intentCode === "transaction_detail") {
        if (cell.kind === "deny") {
          await caseCard(emailId);
          updates.status = "awaiting_customer";
        } else if (cell.kind === "L" && level === "I3") {
          addDraft(transactionDetailLetter(state.customerId));
          updates.status = "pending_verify";
        }
      }

      if (d.intentCode === "reg_e_intake") {
        // Deterministic intake: file + clocks run at ANY identity (R2×I0 too).
        if (!state.actions.some((a) => a.actionType === "create_dispute" && a.status === "done")) {
          track(await deps.gateway.callWrite({
            caseId: state.caseId, actionType: "create_dispute",
            keySeed: DISPUTE_EMAIL2.disputeId, body: { txId: DISPUTE_EMAIL2.txId },
          }));
          updates.clocksFiled = true;
          await emit(state, "act", "clock", { filed: true, case: DISPUTE_EMAIL2.disputeId });
        }
        if (level === "I0" || level === "I1") await caseCard(emailId);
        else addDraft(regEReceiptLetter(state.customerId));
      }

      if (d.intentCode === "od_fee_refund") {
        if (cell.kind === "deny") {
          await caseCard(emailId);
          updates.status = "awaiting_customer";
        } else if (cell.kind === "L" && cell.level === "L3") {
          const already = state.actions.some(
            (a) => a.actionType === "refund_od_fee" && a.status === "done",
          );
          if (!already) {
            const r = await deps.gateway.callWrite({
              caseId: state.caseId, actionType: "refund_od_fee",
              keySeed: "refund:ODF-3318", body: { feeId: "ODF-3318", amountCents: 3500 },
            });
            track(r);
            await emit(state, "act", r.replayed ? "idempotent_replay" : "tool_result", {
              refund: r.data, replayed: r.replayed,
            });
          }
          addDraft(refundConfirmationLetter(state.customerId));
          updates.status = "pending_verify";
        } else if (cell.kind === "L" && cell.level === "L2") {
          // Holding reply goes out immediately (no approval linked); the
          // final explanation waits for the supervisor. FR-1.5: the holding
          // letter promised a reply within one business day — the approval
          // carries the same deadline as a countdown, and sending the
          // explanation fulfills the promise clock.
          addDraft(secondWaiverHoldingLetter(state.customerId));
          const explanation = secondWaiverExplanationDraft(state.customerId);
          addDraft(explanation);
          addApproval({
            id: OD2_APPROVAL, kind: "money_action", intentCode: "od_fee_refund",
            risk: "R2", lLevel: "L2", title: "Approve second-waiver explanation",
            draft: explanation, status: "pending",
            clockDueAt: addBusinessDays(simClock.now(), 1),
          });
        }
      }
    }
    return { ...updates, actions: actionEntries };
  };
}

// ── 7. human checkpoint (input-driven pause / resume) ────────────────────────

export function makeHumanCheckpoint(deps: NodeDeps): NodeFn {
  return async (state) => {
    const updated = new Map<string, ApprovalItem>();
    const drafts: Draft[] = [];
    const actionEntries: ActionLedgerEntry[] = [];
    const byId = () => {
      const map = new Map(state.approvals.map((a) => [a.id, a]));
      for (const [id, a] of updated) map.set(id, a);
      return map;
    };

    // Agent edit turn (FR-7.1): persist the edited text onto the checkpointed
    // draft and record it. The edited text is what respond will send on a
    // later supervisor approval. Falls through to respond/close (no-ops).
    const t0 = state.turn;
    if (t0.kind === "draft_edit" && t0.draftId) {
      const text = t0.editedText ?? "";
      const kept = (state.drafts ?? []).map((d) =>
        d.id === t0.draftId ? { ...d, editedText: text } : d,
      );
      await emit(state, "human_checkpoint", "system", {
        draftEdited: t0.draftId,
        editedLength: text.length,
      });
      return { drafts: kept };
    }

    // A supervisor decision arrives as a fresh approval turn.
    const t = state.turn;
    let chained = false;
    if (t.kind === "approval" && t.approvalId && t.decision) {
      const target = byId().get(t.approvalId);
      if (target && target.status === "pending") {
        updated.set(target.id, {
          ...target,
          status: t.decision === "approve" ? "approved" : t.decision === "edit" ? "edited" : "rejected",
          reasonCode: t.reasonCode,
          decidedBy: "supervisor@larkspur.example",
          decidedAt: simClock.now(),
        });
        await emit(state, "human_checkpoint", "resume", {
          approvalId: target.id,
          decision: t.decision,
        });

        if (t.decision === "approve" && target.id === PC_APPROVAL) {
          const r = await deps.gateway.callWrite({
            caseId: state.caseId, actionType: "reg_e_provisional_credit",
            keySeed: `pc:${DISPUTE_EMAIL2.disputeId}`, body: { disputeId: DISPUTE_EMAIL2.disputeId },
          });
          actionEntries.push(r.entry);
          // Customer update email: amount-free so it stays sendable at I2.
          if (!state.drafts.some((x) => x.id === "DR-PC-POSTED"))
            drafts.push(pcPostedLetter(state.customerId));
        }
        if (t.decision === "approve" && target.id === FRAUD_APPROVAL) {
          const r = await deps.gateway.callWrite({
            caseId: state.caseId, actionType: "notify_onfile",
            keySeed: "sms:onfile-warning",
            body: { to: CUSTOMER_JANE.phoneOnFile, channel: "sms", kind: "fraud_warning", text: onFileWarningSms() },
          });
          actionEntries.push(r.entry);
          drafts.push(fraudLockedLetter()); // SAR locked template, NEVER sent to the forged address
        }
        if (target.id === ADJ_APPROVAL && t.decision === "approve") {
          const resultDraft =
            t.outcome === "error"
              ? resultLetterError(state.customerId)
              : resultLetterNoError(state.customerId);
          drafts.push(resultDraft);
          updated.set(SIGN_APPROVAL, {
            id: SIGN_APPROVAL, kind: "draft_signoff", intentCode: "reg_e_adjudication",
            risk: "R4", lLevel: "L1", title: "Sign and send investigation result letter",
            draft: resultDraft, status: "pending",
          });
          chained = true;
        }
      }
    }

    const update = { approvals: [...updated.values()], drafts, actions: actionEntries };
    // Re-enter once to surface the chained approval (adjudication → L1 sign-off).
    if (chained) return new Command({ update, goto: "n_human_checkpoint" });

    // Still-due approvals pause the case at END; the durable checkpoint makes
    // the pause survive restart, and idempotent tools prevent double execution.
    const pendingNow = [...byId().values()].filter(due);
    if (pendingNow.length > 0) {
      return new Command({
        update: {
          ...update,
          status: state.fraud.quarantined ? ("quarantined" as const) : ("awaiting_human" as const),
        },
        goto: END,
      });
    }
    return update;
  };
}
