// PreemptView — FR-12.4 event-triggered notices. The notice itself is ordinary
// deterministic automation; what the AI adds is DISCOVERY (which inbound a
// notice could have prevented, and which rule to build). So a new rule is born
// in shadow: it records "would have sent" and sends nothing, and the
// counterfactual decides whether it earns a dual sign (AC3).
import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { BellOff, Eye, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { signaturesComplete } from "@/runtime/designTime/logic.ts";
import type { NoticeRule } from "@/runtime/designTime/types.ts";

const MODE_META = {
  off: { icon: BellOff, cls: "bg-gray-200 text-gray-700" },
  shadow: { icon: Eye, cls: "bg-sky-100 text-sky-900" },
  live: { icon: Send, cls: "bg-emerald-100 text-emerald-800" },
} as const;

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return `${((a / b) * 100).toFixed(1)}%`;
}

function RuleCard({ r }: { r: NoticeRule }) {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const meta = MODE_META[r.mode];
  const Icon = meta.icon;
  const signed = signaturesComplete(r.signedBy ?? []);
  const hasRole = (role: "compliance" | "business") =>
    (r.signedBy ?? []).some((s) => s.role === role);

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id={`s4.preempt.${r.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[14px] font-semibold text-navy">{r.ruleLabel[lang]}</h4>
        <span
          className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-semibold", meta.cls)}
          data-id={`s4.preempt.mode.${r.id}`}
        >
          <Icon size={12} /> {t(`design.preempt.mode.${r.mode}`)}
        </span>
        <span className="text-[12.5px] text-faint">
          {t("design.preempt.event")} {r.eventLabel[lang]}
        </span>
      </div>

      {r.mode !== "off" && (
        <div className="mt-2 rounded-md border border-line bg-paper p-2 text-[12.5px] text-gray-700" data-id={`s4.preempt.stats.${r.id}`}>
          <div className="font-semibold text-navy">{t("design.preempt.statsTitle", { days: r.shadowStats.windowDays })}</div>
          <div className="mt-0.5 font-mono">
            {t("design.preempt.statsBody", {
              sent: r.shadowStats.wouldHaveSent,
              still: r.shadowStats.stillWroteIn,
              stillPct: pct(r.shadowStats.stillWroteIn, r.shadowStats.wouldHaveSent),
              control: r.shadowStats.controlSize,
              controlIn: r.shadowStats.controlWroteIn,
              controlPct: pct(r.shadowStats.controlWroteIn, r.shadowStats.controlSize),
            })}
          </div>
          <div className="mt-0.5 text-faint">{t("design.preempt.statsHint")}</div>
        </div>
      )}

      <div className="mt-2">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-faint">
          {t("design.preempt.constraints")}
        </div>
        <ul className="mt-0.5 list-disc pl-4 text-[12.5px] text-gray-700">
          {r.constraints.map((c, i) => (
            <li key={i}>{c[lang]}</li>
          ))}
        </ul>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {r.mode === "off" && (
          <button
            data-id={`s4.preempt.shadow.${r.id}`}
            onClick={() => designTimeStore.setNoticeShadow(r.id)}
            className="rounded-md bg-sky-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-sky-800"
          >
            {t("design.preempt.actions.startShadow")}
          </button>
        )}
        {r.mode === "shadow" && (
          <>
            <button
              data-id={`s4.preempt.sign.compliance.${r.id}`}
              disabled={hasRole("compliance")}
              onClick={() => designTimeStore.signNotice(r.id, "compliance")}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                hasRole("compliance") ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-navy text-navy hover:bg-paper",
              )}
            >
              {t("design.preempt.actions.signCompliance")}
            </button>
            <button
              data-id={`s4.preempt.sign.business.${r.id}`}
              disabled={hasRole("business")}
              onClick={() => designTimeStore.signNotice(r.id, "business")}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                hasRole("business") ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-navy text-navy hover:bg-paper",
              )}
            >
              {t("design.preempt.actions.signBusiness")}
            </button>
            <button
              data-id={`s4.preempt.grant.${r.id}`}
              disabled={!signed}
              onClick={() => designTimeStore.grantNotice(r.id)}
              className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              {t("design.preempt.actions.goLive")}
            </button>
          </>
        )}
        {r.mode === "live" && (
          <>
            <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700" data-id={`s4.preempt.live.${r.id}`}>
              <ShieldCheck size={14} /> {t("design.preempt.actions.live")}
            </span>
            <button
              data-id={`s4.preempt.withdraw.${r.id}`}
              onClick={() => designTimeStore.withdrawNotice(r.id)}
              className="rounded-md border border-red-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50"
            >
              {t("design.preempt.actions.withdraw")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function PreemptView() {
  const { t } = useTranslation("builder");
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => designTimeStore.subscribe(bump), []);
  const rules = designTimeStore.getNoticeRules();

  return (
    <div className="flex flex-col gap-2 pb-16">
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="text-[15px] font-semibold text-navy">{t("design.preempt.title")}</h3>
        <p className="text-[12.5px] text-faint">{t("design.preempt.subtitle")}</p>
      </div>
      {rules.map((r) => (
        <RuleCard key={r.id} r={r} />
      ))}
    </div>
  );
}
