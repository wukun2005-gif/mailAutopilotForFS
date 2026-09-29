// TraceRail — audit-view timeline of CaseEvents (Dev Plan §7.1). Renders the
// decision dossier: nodes, gate verdicts (L/R/I), tool calls, policy version,
// clock events, HALTED/RESUMED. This is the "X-ray" of the same email.
import { format } from "date-fns";
import type { CaseEvent } from "@/runtime/state.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const TYPE_STYLE: Record<string, string> = {
  gate: "bg-navy-soft text-navy",
  tool_call: "bg-amber-50 text-amber-800",
  tool_result: "bg-amber-50 text-amber-800",
  idempotent_replay: "bg-amber-50 text-amber-700",
  clock: "bg-sky-50 text-sky-800",
  interrupt: "bg-red-50 text-red-700",
  resume: "bg-emerald-50 text-emerald-700",
  email_inbound: "bg-gray-100 text-gray-700",
  email_outbound: "bg-emerald-50 text-emerald-700",
  system: "bg-violet-50 text-violet-700",
  node_enter: "bg-gray-50 text-gray-500",
  node_exit: "bg-gray-50 text-gray-500",
};

function summarize(e: CaseEvent, t: (k: string, o?: Record<string, unknown>) => string): string {
  const d = e.data ?? {};
  switch (e.type) {
    case "gate":
      return `${d.gate ?? ""} ${d.verdict ?? JSON.stringify(d.cell ?? "")} ${(d.reasonCodes as string[] | undefined)?.join(",") ?? ""}`.trim();
    case "tool_call":
      return `${d.actionType ?? ""} ${d.keySeed ?? ""}`;
    case "tool_result":
      return `${d.actionType ?? Object.keys(d).slice(0, 3).join(",")} ${d.replayed ? t("trace.replay") : ""}`;
    case "clock":
      return Object.entries(d).map(([k, v]) => `${k}=${String(v)}`).join(" ");
    case "interrupt":
      return t("trace.halted", { count: (d.approvals as unknown[] | undefined)?.length ?? 0 });
    case "resume":
      return t("trace.resumed", { id: d.approvalId ?? "", decision: d.decision ?? "" });
    case "email_inbound":
      return t("trace.inbound", { id: d.emailId ?? "" });
    case "email_outbound":
      return d.replayed ? t("trace.outboundReplay", { draft: d.draft ?? "" }) : t("trace.outbound", { draft: d.draft ?? "" });
    case "idempotent_replay":
      return t("trace.idempotent", { action: d.actionType ?? "" });
    case "system":
      return Object.entries(d).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" ");
    default:
      return e.node;
  }
}

export function TraceRail({ events }: { events: CaseEvent[] }) {
  const { t } = useTranslation("customer");
  return (
    <div className="flex h-full flex-col" data-id="s1.tracerail">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="text-[12px] font-semibold text-navy">{t("trace.title")}</div>
        <div className="text-[10px] text-faint">{t("trace.subtitle")}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {events.length === 0 && (
          <div className="mt-8 text-center text-[11px] text-faint">{t("trace.empty")}</div>
        )}
        <ol className="relative space-y-1.5 border-l-2 border-line pl-3">
          {events.map((e) => (
            <li key={e.seq} className="relative">
              <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-navy-light" />
              <div className="rounded border border-line bg-white px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9.5px] text-faint">
                    {e.node.replace(/^n_/, "")}
                  </span>
                  <span className="font-mono text-[9px] text-faint">
                    {format(new Date(e.simTime), "MM/dd HH:mm:ss")}
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded px-1 py-px text-[9px] font-medium",
                    TYPE_STYLE[e.type] ?? "bg-gray-100 text-gray-600",
                  )}
                >
                  {e.type}
                </span>
                <div className="mt-0.5 break-words font-mono text-[10px] leading-snug text-ink">
                  {summarize(e, t)}
                </div>
                {e.policyVersion && (
                  <div className="mt-0.5 font-mono text-[9px] text-faint">{t("trace.policy", { version: e.policyVersion })}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
