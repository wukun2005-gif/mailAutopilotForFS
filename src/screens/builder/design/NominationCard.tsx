// NominationCard — FR-12.1 evidence card with the four proofs. The AI's job
// ends at the evidence and the prescription; a human moves the card through
// fix → shadow → dual sign → grant. R3/R4 cards render greyed with no actions.
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Ban,
  Bird,
  CheckCircle2,
  FileSignature,
  Lock,
  Scale,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import {
  consistencyPasses,
  effectiveRepro,
  maxCohortGap,
  signaturesComplete,
} from "@/runtime/designTime/logic.ts";
import type { Nomination } from "@/runtime/designTime/types.ts";

function Proof({ icon, title, ok, children }: {
  icon: React.ReactNode;
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line bg-paper p-2">
      <div className="flex items-center gap-1 text-[12.5px] font-semibold text-navy">
        {icon}
        <span className="flex-1">{title}</span>
        {ok ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} className="text-red-600" />}
      </div>
      <div className="mt-1 text-[12px] text-gray-700">{children}</div>
    </div>
  );
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function NominationCard({ n, fixed }: { n: Nomination; fixed: boolean }) {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const e = n.evidence;
  const signed = signaturesComplete(n.signedBy ?? []);
  const signedRole = (r: "compliance" | "business") =>
    (n.signedBy ?? []).some((s) => s.role === r);
  const repro = effectiveRepro(n, fixed);
  const reproOk = consistencyPasses(e, repro);
  const parityOk = maxCohortGap(e.cohortParity.gaps) < e.cohortParity.thresholdPp;

  // AC5: rare intents get an observation report, never a nomination — no
  // shadow shortening, no bar lowering, no grant button.
  if (n.kind === "observation" && n.observation) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-paper p-3" data-id={`s4.nom.${n.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-navy px-1.5 py-0.5 font-mono text-[12px] font-bold text-white">{n.risk}</span>
          <h4 className="text-[13.5px] font-semibold text-navy">{n.intentLabel[lang]}</h4>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-amber-900">
            {t("design.kind.observation")}
          </span>
          <span className="ml-auto text-[12px] font-semibold uppercase text-faint">
            {t("design.state.insufficient_sample")}
          </span>
        </div>
        <div className="mt-1.5 font-mono text-[12.5px] text-navy" data-id={`s4.nom.sample.${n.id}`}>
          {t("design.obs.required", { required: n.observation.requiredSample, observed: n.observation.observedSample })}
        </div>
        <p className="mt-1 text-[12.5px] text-gray-700">{n.observation.note[lang]}</p>
      </div>
    );
  }

  if (n.neverNominated) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3 opacity-80" data-id={`s4.nom.${n.id}`}>
        <div className="flex items-center gap-2">
          <Ban size={15} className="text-gray-500" />
          <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[12px] font-bold text-gray-600">{n.risk}</span>
          <h4 className="text-[13.5px] font-semibold text-gray-600">{n.intentLabel[lang]}</h4>
          <span className="ml-auto text-[12px] font-semibold uppercase text-gray-500">{t("design.never")}</span>
        </div>
        <p className="mt-1 text-[12.5px] text-gray-600">{n.neverReason?.[lang]}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id={`s4.nom.${n.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-navy px-1.5 py-0.5 font-mono text-[12px] font-bold text-white">{n.risk}</span>
        <h4 className="text-[14px] font-semibold text-navy">{n.intentLabel[lang]}</h4>
        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-sky-900">
          {t(`design.kind.${n.kind}`)}
        </span>
        {n.canary && (
          <span
            className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-violet-900"
            data-id={`s4.nom.canary.${n.id}`}
          >
            <Bird size={12} /> {t("design.canary.badge")}
          </span>
        )}
        <span className="ml-auto rounded bg-paper px-1.5 py-0.5 text-[12px] font-semibold text-faint" data-id={`s4.nom.state.${n.id}`}>
          {t(`design.state.${n.state}`)}
        </span>
      </div>

      <div className="mt-2 grid gap-1.5 md:grid-cols-2">
        <Proof icon={<Scale size={13} />} title={t("design.proofs.consistency")} ok={reproOk}>
          <div>
            {t("design.proofs.repro", { rate: pct(repro), bar: pct(e.consistency.thresholdRate) })}
            {fixed && <span className="ml-1 font-semibold text-emerald-700">({t("design.afterFix")})</span>}
          </div>
          <div className="text-faint">
            {t("design.proofs.sample", { n: e.consistency.sampleSize.toLocaleString() })}
            {n.templateFix && t("design.proofs.edits", { a: n.templateFix.editSampleCount, b: n.templateFix.sameWordingEdits })}
          </div>
          {!reproOk && n.templateFix && (
            <div className="mt-1 rounded bg-amber-50 p-1.5 text-amber-900">{n.templateFix.fixedClause[lang]}</div>
          )}
        </Proof>
        <Proof icon={<FileSignature size={13} />} title={t("design.proofs.calc")} ok={e.calcJudgment.calcShare >= 0.9}>
          <div className="font-mono font-bold text-navy">{pct(e.calcJudgment.calcShare)} <span className="font-normal text-faint">/ {pct(e.calcJudgment.judgmentShare)} {t("design.proofs.judgment")}</span></div>
          <div>{e.calcJudgment.calcPattern[lang]}</div>
          <ul className="mt-0.5 list-disc pl-4">
            {e.calcJudgment.judgmentCriteria.map((c, i) => <li key={i}>{c[lang]}</li>)}
          </ul>
        </Proof>
        <Proof icon={<Users size={13} />} title={t("design.proofs.variance")} ok={e.approverVariance.maxGapPp <= 2.5}>
          <div>{e.approverVariance.detail[lang]}</div>
        </Proof>
        <Proof icon={<ShieldCheck size={13} />} title={t("design.proofs.parity")} ok={parityOk}>
          <div>
            {t("design.proofs.maxGap", { gap: maxCohortGap(e.cohortParity.gaps), threshold: e.cohortParity.thresholdPp })}
          </div>
          <div className="text-faint">{e.cohortParity.gaps.map((g) => t(`design.dims.${g.dim}`)).join(" · ")}</div>
        </Proof>
      </div>

      {n.quota && (
        <div className="mt-1.5 rounded-md border border-teal/40 bg-teal-soft/50 px-2 py-1 text-[12.5px] text-teal" data-id={`s4.nom.quota.${n.id}`}>
          {n.quota.label[lang]}
        </div>
      )}

      {n.canary && (
        <div
          className="mt-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12.5px] text-violet-900"
          data-id={`s4.nom.canaryTell.${n.id}`}
        >
          <span className="font-semibold">{t("design.canary.tellTitle")}</span> {n.canary.tell[lang]}
        </div>
      )}
      {n.canary && designTimeStore.getCanary().missed && (
        <div
          className="mt-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-red-700"
          data-id={`s4.nom.canaryMissed.${n.id}`}
        >
          <AlertTriangle size={13} className="mr-1 inline" /> {t("design.canary.missed")}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {n.state === "fix_first" && (
          <button data-id={`s4.nom.fix.${n.id}`} onClick={() => designTimeStore.fixTemplateAndReplay(n.id)}
            className="rounded-md bg-amber-600 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-amber-700">
            {t("design.actions.fix")}
          </button>
        )}
        {n.state === "in_shadow" && (
          <button data-id={`s4.nom.submit.${n.id}`} onClick={() => designTimeStore.submitForSign(n.id)}
            className="rounded-md bg-sky-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-sky-800">
            {t("design.actions.submit", { days: n.shadowDays })}
          </button>
        )}
        {n.state === "awaiting_sign" && (
          <>
            <button data-id={`s4.nom.sign.compliance.${n.id}`} disabled={signedRole("compliance")}
              onClick={() => designTimeStore.signNomination(n.id, "compliance")}
              className={cn("rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                signedRole("compliance") ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-navy text-navy hover:bg-paper")}>
              {t("design.actions.signCompliance")}
            </button>
            <button data-id={`s4.nom.sign.business.${n.id}`} disabled={signedRole("business")}
              onClick={() => designTimeStore.signNomination(n.id, "business")}
              className={cn("rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                signedRole("business") ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-navy text-navy hover:bg-paper")}>
              {t("design.actions.signBusiness")}
            </button>
            <button data-id={`s4.nom.apply.${n.id}`} disabled={!signed}
              onClick={() => designTimeStore.grantNomination(n.id)}
              className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-40">
              {t("design.actions.grant")}
            </button>
            <button data-id={`s4.nom.reject.${n.id}`} onClick={() => designTimeStore.rejectNomination(n.id)}
              className="rounded-md border border-red-300 px-2.5 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-50">
              {t("design.actions.reject")}
            </button>
          </>
        )}
        {n.state === "granted" && (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700" data-id={`s4.nom.granted.${n.id}`}>
            <CheckCircle2 size={14} /> {n.quota ? t("design.actions.granted") : t("design.actions.grantedPlain")}
          </span>
        )}
        {n.state === "cooldown" && (
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-gray-500" data-id={`s4.nom.cooldown.${n.id}`}>
            <Lock size={13} /> {t("design.actions.cooldown", { days: n.cooldownDays })}
          </span>
        )}
      </div>
    </div>
  );
}
