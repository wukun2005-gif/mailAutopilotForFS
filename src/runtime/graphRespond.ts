// Node 8 — respond: DLP final scan, three-segment letter assembly, send only
// drafts that are either autonomous or explicitly approved. The fraud locked
// template is recorded for SAR but never transmitted to the forged address.
import type { CaseStateType, Draft, OutboundRecord, PromiseClock } from "./caseState.ts";
import type { ActionLedgerEntry as ALE } from "./state.ts";
import type { NodeDeps, NodeFn } from "./graphNodes.ts";
import { unwrap as unwrapEnvelope } from "./graphNodes.ts";
import { appendEvent } from "./eventStore.ts";
import { addBusinessDays, simClock } from "./simClock.ts";

export function draftText(d: Draft): string {
  if (d.editedText) return d.editedText;
  return d.sections.map((s) => s.textEn).join("\n\n");
}

export async function emitOutbound(
  state: CaseStateType,
  node: string,
  type: "email_outbound" | "system",
  data?: Record<string, unknown>,
) {
  await appendEvent({ caseId: state.caseId, node, type, data });
}

export async function sendSecure(
  deps: NodeDeps,
  state: CaseStateType,
  keySeed: string,
  kind: string,
  body: string,
) {
  return deps.gateway.callWrite({
    caseId: state.caseId,
    actionType: "send_secure_message",
    keySeed,
    body: { to: state.customerId, kind, body },
  });
}

export function makeRespond(deps: NodeDeps): NodeFn {
  return async (state) => {
    const outbound: OutboundRecord[] = [];
    const actionEntries: ALE[] = [];
    // FR-1.5 promise clocks: register when the promising letter actually goes
    // out; fulfill from the declared condition — the fulfilment letter going
    // out, a ledger action landing, an approval clearing, or a fixture ETA
    // being reached. All plain arithmetic on state — no model judgment.
    const promiseUpdates = new Map<string, PromiseClock>();
    const registerPromise = (d: Draft) => {
      if (!d.promise) return;
      const id = `PC:${d.id}`;
      if (state.promiseClocks.some((p) => p.id === id) || promiseUpdates.has(id)) return;
      promiseUpdates.set(id, {
        id,
        sourceDraftId: d.id,
        labelKey: d.promise.labelKey,
        dueAt:
          d.promise.dueInBusinessDays != null
            ? addBusinessDays(simClock.now(), d.promise.dueInBusinessDays)
            : undefined,
        fulfillByDraftId: d.promise.fulfillByDraftId,
        fulfillByActionType: d.promise.fulfillByActionType,
        fulfillByApprovalId: d.promise.fulfillByApprovalId,
        fulfillByEpoch: d.promise.fulfillByEpoch,
      });
    };
    // One pass over every open promise; any satisfied condition stamps
    // fulfilledAt. Called with the just-sent draft id on each send, and once
    // after the loop so clock turns (no new outbound) still close promises.
    const evalFulfill = (sentDraftId?: string) => {
      for (const p of [...(state.promiseClocks ?? []), ...promiseUpdates.values()]) {
        if (p.fulfilledAt) continue;
        const hit =
          (!!sentDraftId && p.fulfillByDraftId === sentDraftId) ||
          (!!p.fulfillByActionType &&
            state.actions.some(
              (a) => a.actionType === p.fulfillByActionType && a.status === "done",
            )) ||
          (!!p.fulfillByApprovalId &&
            (state.approvals ?? []).some(
              (a) =>
                a.id === p.fulfillByApprovalId &&
                (a.status === "approved" || a.status === "edited"),
            )) ||
          (!!p.fulfillByEpoch && simClock.now() >= Date.parse(p.fulfillByEpoch));
        if (hit) promiseUpdates.set(p.id, { ...p, fulfilledAt: simClock.now() });
      }
    };
    for (const draft of state.drafts) {
      if (state.outbound.some((o) => o.id === `OB:${draft.id}`)) continue;
      const linked = state.approvals.find((a) => a.draft?.id === draft.id);
      if (linked && linked.status !== "approved" && linked.status !== "edited") continue;
      const text = draftText(draft);
      const scan = unwrapEnvelope<{ clean: boolean; hits: { type: string }[] }>(
        await deps.gateway.postRead("/mock/dlp/scan", { text, enforce: true }),
      );
      if (!scan.clean) {
        await emitOutbound(state, "respond", "system", {
          blocked: draft.id,
          hits: scan.hits.map((h) => h.type),
        });
        continue;
      }
      // Fraud locked template is recorded for SAR, never transmitted.
      if (draft.id === "DR-FRAUD-LOCKED") {
        outbound.push({
          id: `OB:${draft.id}`, channel: "email", to: "(forged address — no reply)",
          intentCode: "fraud_locked", draftId: draft.id, lockedTemplate: true,
          atSimTime: simClock.now(), blockedReason: "ZERO_REPLY_TO_FORGED_ADDRESS",
        });
        continue;
      }
      // FR-5.2 quality gate (presence leg): every autonomous email must carry
      // the FR-10.2 disclosure and the FR-10.3 handoff. Agent-edited L1/L2 text
      // is human-owned and bypasses this leg; DLP above still applies to it.
      if (draft.channel === "email" && !draft.editedText) {
        const hasDisclosure = draft.sections.some(
          (s) => s.source === "TPL_AI_DISCLOSURE_V1",
        );
        const hasHandoff = draft.sections.some((s) => s.source === "TPL_HANDOFF_V1");
        if (!hasDisclosure || !hasHandoff) {
          await emitOutbound(state, "respond", "system", {
            blocked: draft.id,
            blockedReason: "FR52_DISCLOSURE_MISSING",
            missing: [
              ...(!hasDisclosure ? ["FR-10.2 disclosure"] : []),
              ...(!hasHandoff ? ["FR-10.3 handoff"] : []),
            ],
          });
          continue;
        }
        // Pass leg leaves a visible trace too: the audience must see the gate
        // checking, not only the rejections.
        await emitOutbound(state, "respond", "system", {
          fr52Check: draft.id,
        });
      }
      // Non-sensitive replies go back into the original mail thread so the
      // customer keeps a single conversation history (report §3.2 case model).
      if (draft.channel === "email") {
        const inThread =
          state.emails.find((e) => e.id === state.currentEmailId) ?? state.emails[0];
        outbound.push({
          id: `OB:${draft.id}`, channel: "email", to: state.customerId,
          intentCode: draft.intentCode, draftId: draft.id, lockedTemplate: draft.lockedTemplate,
          atSimTime: simClock.now(), threadId: inThread?.threadId,
        });
        registerPromise(draft);
        evalFulfill(draft.id);
        await emitOutbound(state, "respond", "email_outbound", {
          draft: draft.id,
          replayed: state.outbound.some((o) => o.id === `OB:${draft.id}`),
        });
        continue;
      }
      if (draft.channel === "secure_message") {
        const r = await sendSecure(deps, state, `send:${draft.id}`, draft.intentCode, text);
        actionEntries.push(r.entry);
        outbound.push({
          id: `OB:${draft.id}`, channel: "secure_message", to: state.customerId,
          intentCode: draft.intentCode, draftId: draft.id, lockedTemplate: draft.lockedTemplate,
          atSimTime: simClock.now(),
        });
        registerPromise(draft);
        evalFulfill(draft.id);
        await emitOutbound(state, "respond", "email_outbound", {
          draft: draft.id,
          replayed: r.replayed,
        });
      }
    }
    // Ledger/approval/ETA fulfilment can land on turns that send nothing
    // (clock jumps, approval resumes) — evaluate once more before returning.
    evalFulfill();
    const update: Partial<CaseStateType> = { outbound, actions: actionEntries };
    if (promiseUpdates.size > 0) update.promiseClocks = [...promiseUpdates.values()];
    return update;
  };
}
