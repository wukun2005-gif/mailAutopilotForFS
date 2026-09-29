// Node 8 — respond: DLP final scan, three-segment letter assembly, send only
// drafts that are either autonomous or explicitly approved. The fraud locked
// template is recorded for SAR but never transmitted to the forged address.
import type { CaseStateType, Draft, OutboundRecord } from "./caseState.ts";
import type { ActionLedgerEntry as ALE } from "./state.ts";
import type { NodeDeps, NodeFn } from "./graphNodes.ts";
import { unwrap as unwrapEnvelope } from "./graphNodes.ts";
import { appendEvent } from "./eventStore.ts";
import { simClock } from "./simClock.ts";

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
        await emitOutbound(state, "respond", "email_outbound", {
          draft: draft.id,
          replayed: r.replayed,
        });
      }
    }
    return { outbound, actions: actionEntries };
  };
}
