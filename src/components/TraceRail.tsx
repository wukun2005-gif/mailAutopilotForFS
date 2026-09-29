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
  const map = (ns: string, code: string): string =>
    t(`trace.${ns}.${code}`, { defaultValue: code }) as string;
  switch (e.type) {
    case "gate": {
      // Identity gate emits {level, signals, failed}; autonomy emits
      // {identity, cells}. Both render in plain words, codes as fallback.
      if (typeof d.level === "string") {
        const failed = (d.failed as string[] | undefined) ?? [];
        const failedTxt = failed
          .map((c) => t(`identity.signals.${c}`, { defaultValue: c }) as string)
          .join("、");
        return failed.length > 0
          ? `${t("trace.gateLevel", { level: d.level })}；${t("trace.gateFailed", { values: failedTxt })}`
          : (t("trace.gateLevel", { level: d.level }) as string);
      }
      if (d.lowConfidence) return t("trace.lowConfidence") as string;
      const cells = (d.cells as Array<{ intent: string; cell: unknown }> | undefined) ?? [];
      if (cells.length > 0) {
        return cells
          .map((c) => {
            const cell = c.cell as { kind?: string; level?: string; reasonCode?: string } | undefined;
            const verdict =
              cell?.kind === "L"
                ? map("levels", cell.level ?? "")
                : (t(`identity.reasons.${cell?.reasonCode ?? ""}`, {
                    defaultValue: cell?.reasonCode ?? "",
                  }) as string);
            return `${map("intents", c.intent)} → ${verdict}`;
          })
          .join("；");
      }
      return `${d.gate ?? ""} ${d.verdict ?? JSON.stringify(d.cell ?? "")} ${(d.reasonCodes as string[] | undefined)?.join(",") ?? ""}`.trim();
    }
    case "tool_call":
      return map("actions", (d.actionType as string | undefined) ?? "");
    case "tool_result":
      if (typeof d.actionType === "string")
        return t("trace.toolDone", { action: map("actions", d.actionType) }) as string;
      if (d.ocr) return t("trace.ocrDone") as string;
      if (d.refund)
        return t("trace.toolDone", { action: map("actions", "refund_od_fee") }) as string;
      return `${Object.keys(d).slice(0, 3).join(",")} ${d.replayed ? t("trace.replay") : ""}`;
    case "clock":
      if (d.filed) return t("trace.disputeFiled") as string;
      if (d.closed) return t("trace.caseClosed") as string;
      if (d.verifiedResolution) return t("trace.verified14d") as string;
      return Object.entries(d).map(([k, v]) => `${k}=${String(v)}`).join(" ");
    case "interrupt":
      return t("trace.halted", { count: (d.approvals as unknown[] | undefined)?.length ?? 0 }) as string;
    case "resume":
      return t("trace.resumed", {
        approval: map("approvals", (d.approvalId as string | undefined) ?? ""),
        decision: map("decisions", (d.decision as string | undefined) ?? ""),
      }) as string;
    case "email_inbound":
      return t("trace.mailReceived") as string;
    case "email_outbound":
      return t("trace.replySent", {
        draft: map("drafts", (d.draft as string | undefined) ?? ""),
        code: (d.draft as string | undefined) ?? "",
      }) as string;
    case "idempotent_replay":
      return t("trace.idempotent", {
        action: map("actions", (d.actionType as string | undefined) ?? ""),
      }) as string;
    case "system": {
      if (d.restarted) return t("trace.restarted") as string;
      if (typeof d.handedToAgent === "string")
        return t("trace.handedToAgent", {
          approval: map("approvals", d.handedToAgent),
        }) as string;
      if (typeof d.draftEdited === "string")
        return t("trace.draftEdited", {
          draft: map("drafts", d.draftEdited),
        }) as string;
      if (Array.isArray(d.intents))
        return t("trace.triageFound", {
          values: (d.intents as string[]).map((c) => map("intents", c)).join("、"),
        }) as string;
      if (Array.isArray(d.cards))
        return (d.cards as Array<{ policyId?: string; version?: string; overall?: string }>)
          .map((c) =>
            t("trace.policyVerdict", {
              policy: map("policies", c.policyId ?? ""),
              version: c.version ?? "",
              verdict: c.overall === "PASS" ? t("trace.pass") : t("trace.fail"),
            }),
          )
          .join("；") as string;
      if (d.quarantined) return t("trace.quarantinedLine") as string;
      if (typeof d.blocked === "string")
        return t("trace.blockedDraft", { draft: map("drafts", d.blocked) }) as string;
      if (d.closed) return t("trace.caseClosed") as string;
      if (d.verifiedResolution) return t("trace.verified14d") as string;
      return Object.entries(d).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" ");
    }
    default:
      return "";
  }
}

export function TraceRail({ events }: { events: CaseEvent[] }) {
  const { t } = useTranslation("customer");
  return (
    <div className="flex h-full flex-col" data-id="s1.tracerail">
      <div className="shrink-0 border-b border-line px-3 py-2">
        <div className="text-[15px] font-semibold text-navy">{t("trace.title")}</div>
        <div className="text-[13px] text-faint">{t("trace.subtitle")}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {events.length === 0 && (
          <div className="mt-8 text-center text-[14px] text-faint">{t("trace.empty")}</div>
        )}
        <ol className="relative space-y-1.5 border-l-2 border-line pl-3">
          {events.map((e) => (
            <li key={e.seq} className="relative">
              <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-navy-light" />
              <div className="rounded border border-line bg-white px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-faint">
                    {t(`trace.nodes.${e.node.replace(/^n_/, "")}`, { defaultValue: e.node.replace(/^n_/, "") })}
                  </span>
                  <span className="font-mono text-[12px] text-faint">
                    {format(new Date(e.simTime), "MM/dd HH:mm:ss")}
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded px-1 py-px text-[12px] font-medium",
                    TYPE_STYLE[e.type] ?? "bg-gray-100 text-gray-600",
                  )}
                >
                  {t(`trace.types.${e.type}`, { defaultValue: e.type })}
                </span>
                <div className="mt-0.5 break-words text-[13px] leading-snug text-ink">
                  {summarize(e, t)}
                </div>
                {e.policyVersion && (
                  <div className="mt-0.5 font-mono text-[12px] text-faint">{t("trace.policy", { version: e.policyVersion })}</div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
