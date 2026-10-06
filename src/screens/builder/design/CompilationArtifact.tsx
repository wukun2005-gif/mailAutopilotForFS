// CompilationArtifact — FR-12.3 Policy Compiler output for one request.
// Sentence/doc inputs compile to a clause-level diff + blast radius and need
// dual sign; requests referencing fields outside the closed evidence schema
// are refused; regulatory summaries produce a checklist only.
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FileWarning, GitCompare, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { signaturesComplete } from "@/runtime/designTime/logic.ts";
import type { Compilation } from "@/runtime/designTime/types.ts";

export function CompilationArtifact({ c }: { c: Compilation }) {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const signed = signaturesComplete(c.signedBy ?? []);
  const signedRole = (r: "compliance" | "business") => (c.signedBy ?? []).some((s) => s.role === r);

  if (c.state === "closed_world_error") {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3" data-id={`s4.pol.closedworld.${c.id}`}>
        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-red-800">
          <AlertTriangle size={15} /> {t("design.pol.closedTitle")}
        </div>
        <p className="mt-1 text-[12.5px] text-red-900">{c.missingField?.[lang]}</p>
        <p className="mt-1 text-[12px] text-faint">{t("design.pol.closedHint")}</p>
      </div>
    );
  }

  if (c.state === "checklist_only") {
    return (
      <div className="rounded-lg border border-sky-300 bg-sky-50/60 p-3" data-id={`s4.pol.checklist.${c.id}`}>
        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-sky-900">
          <ListChecks size={15} /> {t("design.pol.checklistTitle")}
        </div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-sky-900">
          {c.checklist?.map((item, i) => <li key={i}>{item[lang]}</li>)}
        </ul>
      </div>
    );
  }

  const signable = c.state === "compiled" || c.state === "awaiting_sign";
  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id={`s4.pol.artifact.${c.id}`}>
      <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-navy">
        <GitCompare size={15} className="text-teal" /> {t("design.pol.diffTitle")}
      </div>
      <table className="mt-1.5 w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-left text-faint">
            <th className="py-1 pr-2">{t("design.pol.clause")}</th>
            <th className="py-1 pr-2">{t("design.pol.field")}</th>
            <th className="py-1 pr-2">{t("design.pol.before")}</th>
            <th className="py-1">{t("design.pol.after")}</th>
          </tr>
        </thead>
        <tbody>
          {c.diffs.map((d) => (
            <tr key={d.code} className="border-t border-line align-top">
              <td className="py-1 pr-2"><span className="font-mono text-faint">{d.code}</span> {d.clause[lang]}</td>
              <td className="py-1 pr-2 font-mono text-[12px]">{d.field}</td>
              <td className="py-1 pr-2 font-mono text-red-700 line-through">{d.before}</td>
              <td className="py-1 font-mono font-bold text-emerald-700">{d.after}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 rounded-md border border-line bg-paper p-2" data-id={`s4.pol.stale.${c.id}`}>
        <div className="flex items-center gap-1 text-[12.5px] font-semibold text-navy">
          <FileWarning size={13} className="text-amber-600" /> {t("design.pol.staleTitle")}
        </div>
        <ul className="mt-0.5 list-disc pl-5 text-[12.5px]">
          {c.staleTemplates.map((s) => (
            <li key={s.id}><span className="font-mono text-[12px] text-faint">{s.id}</span> {s.name[lang]} — {s.issue[lang]}</li>
          ))}
        </ul>
      </div>

      <div className="mt-1.5 grid gap-1.5 md:grid-cols-2">
        <div className="rounded-md border border-line bg-paper p-2 text-[12.5px]">
          <b className="text-navy">{t("design.pol.backtest", { days: c.backtest.windowDays, n: c.backtest.flipCount })}</b>
          <div className="text-faint">{t("design.pol.backtestHint")}</div>
        </div>
        <div className="rounded-md border border-line bg-paper p-2 text-[12.5px]">
          <b className="text-navy">{t("design.pol.cohort", { gap: c.cohortMaxGapPp })}</b>
        </div>
      </div>

      <div className="mt-1.5 flex flex-col gap-1">
        {c.dissents.map((d, i) => (
          <div key={i} className="rounded-md border border-violet-200 bg-violet-50/60 p-2 text-[12.5px]">
            <div className="font-semibold text-violet-900">{d.title[lang]}</div>
            <div className="text-violet-900/90">{d.body[lang]}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {signable && (
          <>
            <button data-id={`s4.pol.sign.compliance.${c.id}`} disabled={signedRole("compliance")}
              onClick={() => designTimeStore.signCompilation(c.id, "compliance")}
              className={cn("rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                signedRole("compliance") ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-navy text-navy hover:bg-paper")}>
              {t("design.actions.signCompliance")}
            </button>
            <button data-id={`s4.pol.sign.business.${c.id}`} disabled={signedRole("business")}
              onClick={() => designTimeStore.signCompilation(c.id, "business")}
              className={cn("rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                signedRole("business") ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-navy text-navy hover:bg-paper")}>
              {t("design.actions.signBusiness")}
            </button>
            <button data-id={`s4.pol.apply.${c.id}`} disabled={!signed}
              onClick={() => designTimeStore.grantCompilation(c.id)}
              className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40">
              {t("design.pol.grant")}
            </button>
          </>
        )}
        {c.state === "granted" && (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700" data-id={`s4.pol.granted.${c.id}`}>
            <CheckCircle2 size={14} /> {t("design.pol.granted", { version: c.effectiveVersion ?? "" })}
          </span>
        )}
      </div>
    </div>
  );
}
