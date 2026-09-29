// PendingActionsCard — read-only strip in the agent dossier showing what the
// machine is waiting on (the actionable queue lives in the Supervisor cockpit).
import { Hourglass } from "lucide-react";
import type { CaseStateType } from "@/runtime/caseState.ts";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export function PendingActionsCard({ state }: { state: CaseStateType }) {
  const { t } = useTranslation("agent");
  const pending = (state.approvals ?? []).filter((a) => a.status === "pending");
  if (pending.length === 0) return null;
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3" data-id="s2.pending">
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-amber-900">
        <Hourglass size={13} /> {t("pending.title", { count: pending.length })}
      </h3>
      <div className="mt-1.5 space-y-1">
        {pending.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded bg-white px-2 py-1 text-[13.5px]">
            <span className="font-mono font-semibold text-navy">{a.id}</span>
            <span className="text-gray-700">{t(`approvals.${a.id}`, { defaultValue: a.title })}</span>
            <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12.5px] text-gray-600">
              {a.kind} · {a.lLevel}
            </span>
            {a.amountCents != null && (
              <span className="font-mono text-gray-700">${(a.amountCents / 100).toFixed(2)}</span>
            )}
            {a.clockDueAt != null && (
              <span className="ml-auto font-mono text-[12.5px] text-red-700">
                {t("pending.due", { time: format(new Date(a.clockDueAt), "MM/dd HH:mm") })}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
