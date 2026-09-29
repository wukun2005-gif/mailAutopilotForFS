// ApprovalQueue — FR-8.1. One-click approve runs the REAL resume path
// (caseStore.approve → fresh approval turn → graph continues). Batch approve
// is restricted to same-template + same-intent L1/L2 drafts (FR-8.1);
// clock-driven case-specific actions like provisional credit never batch.
import { useState } from "react";
import { Check, Ban, PencilLine, Clock } from "lucide-react";
import type { CaseStateType, ApprovalItem } from "@/runtime/caseState.ts";
import { useCaseStore } from "@/store/caseStore";
import { TricolorLetter } from "@/components/TricolorLetter";
import { simClock } from "@/runtime/simClock.ts";
import { cn } from "@/lib/utils";

const REJECT_REASONS = [
  "INSUFFIFICIENT_EVIDENCE",
  "POLICY_NOT_MET",
  "CUSTOMER_NOT_VERIFIED",
  "REFER_TO_INVESTIGATIONS",
  "OTHER",
];

function useCountdown(clockDueAt?: number) {
  const ms = clockDueAt ? clockDueAt - simClock.now() : null;
  if (ms == null) return null;
  const hours = Math.round(ms / 3_600_000);
  return { hours, overdue: ms < 0 };
}

function ApprovalCard({ a }: { a: ApprovalItem }) {
  const approve = useCaseStore((s) => s.approve);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [outcome, setOutcome] = useState<"error" | "no_error">("error");
  const cd = useCountdown(a.clockDueAt);

  return (
    <div
      data-id="s3.approvalcard"
      className={cn(
        "rounded-lg border bg-white p-3",
        cd?.overdue ? "border-red-400" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-navy">{a.id}</span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[9.5px] text-gray-600">
          {a.kind} · {a.lLevel}
        </span>
        <span className="text-[11px] text-gray-700">{a.title}</span>
        {a.amountCents != null && (
          <span className="font-mono text-[11px] font-semibold text-navy">
            ${(a.amountCents / 100).toFixed(2)}
          </span>
        )}
        {cd && (
          <span
            data-id="s3.clockremaining"
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px]",
              cd.overdue
                ? "bg-red-100 text-red-800"
                : cd.hours <= 48
                  ? "bg-red-50 text-red-700"
                  : cd.hours <= 120
                    ? "bg-amber-50 text-amber-800"
                    : "bg-gray-100 text-gray-600",
            )}
          >
            <Clock size={10} />
            {cd.overdue ? "overdue" : `${cd.hours}h left`}
          </span>
        )}
      </div>

      {a.draft && (
        <div className="mt-2 rounded border border-line bg-paper p-2 text-[10.5px]">
          <TricolorLetter draft={a.draft} audit={false} />
        </div>
      )}

      {a.id === "AP-ADJUDICATION" && (
        <div className="mt-2 flex items-center gap-2 text-[10.5px]">
          <span className="text-faint">R4 adjudication outcome:</span>
          {(["error", "no_error"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={cn(
                "rounded px-2 py-0.5 ring-1",
                outcome === o ? "bg-navy text-white ring-navy" : "bg-white text-navy ring-line",
              )}
            >
              {o === "error" ? "uphold error" : "no error found"}
            </button>
          ))}
        </div>
      )}

      {rejecting ? (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded border border-line px-1.5 py-1 text-[10.5px]"
          >
            {REJECT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button
            data-id="s3.reject.confirm"
            onClick={() =>
              approve({ approvalId: a.id, decision: "reject", reasonCode: reason })
            }
            className="rounded bg-red-700 px-2 py-1 text-[10.5px] text-white"
          >
            confirm reject
          </button>
          <button onClick={() => setRejecting(false)} className="text-[10.5px] text-faint underline">
            cancel
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            data-id="s3.approve"
            onClick={() =>
              approve({
                approvalId: a.id,
                decision: "approve",
                ...(a.id === "AP-ADJUDICATION" ? { outcome } : {}),
              })
            }
            className="inline-flex items-center gap-1 rounded bg-teal px-3 py-1 text-[10.5px] font-semibold text-white"
          >
            <Check size={11} /> one-click approve
          </button>
          <button
            data-id="s3.edit"
            onClick={() => approve({ approvalId: a.id, decision: "edit" })}
            className="inline-flex items-center gap-1 rounded px-3 py-1 text-[10.5px] text-navy ring-1 ring-line"
          >
            <PencilLine size={11} /> hand to agent
          </button>
          <button
            data-id="s3.reject"
            onClick={() => setRejecting(true)}
            className="inline-flex items-center gap-1 rounded px-3 py-1 text-[10.5px] text-red-700 ring-1 ring-red-300"
          >
            <Ban size={11} /> reject
          </button>
        </div>
      )}
    </div>
  );
}

export function ApprovalQueue({ state }: { state: CaseStateType }) {
  const pending = (state.approvals ?? []).filter((a) => a.status === "pending");
  // Batch eligibility: same intent + same locked template, L1/L2 drafts,
  // never clock-driven case-specific actions (e.g. provisional credit).
  const batchGroups = new Map<string, ApprovalItem[]>();
  for (const a of pending) {
    if (a.actionType === "reg_e_provisional_credit") continue;
    if (!a.draft?.lockedTemplate) continue;
    if (a.lLevel !== "L1" && a.lLevel !== "L2") continue;
    const key = `${a.intentCode}:${a.draft.id}`;
    batchGroups.set(key, [...(batchGroups.get(key) ?? []), a]);
  }
  const batchable = [...batchGroups.values()].filter((g) => g.length > 1).flat();

  return (
    <div className="space-y-2" data-id="s3.queue">
      {batchable.length > 1 && (
        <div className="rounded-lg border border-teal/40 bg-teal-soft p-2 text-[11px]">
          {batchable.length} same-template / same-intent items eligible for batch approve
          (each remains expandable for review, FR-8.1).
        </div>
      )}
      {pending.length === 0 && (
        <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[11px] text-faint">
          no approvals waiting — the queue is clear
        </div>
      )}
      {pending.map((a) => (
        <ApprovalCard key={a.id} a={a} />
      ))}
      <p className="px-1 text-[10px] text-faint">
        clock-driven, case-specific obligations (e.g. provisional credit) are always single-item —
        they never enter batch lists.
      </p>
    </div>
  );
}
