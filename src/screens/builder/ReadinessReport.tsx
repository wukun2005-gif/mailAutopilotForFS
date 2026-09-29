// ReadinessReport — FR-9.4: per-intent graduation verdict against the
// rule-of-three bars, plus compliance + business dual sign-off. Signing a
// shadow intent promotes it through graduationOverrides; the next inbound
// email of that intent runs at the new level immediately.
import { useState } from "react";
import { CheckCircle2, XCircle, PenLine, ShieldCheck, Briefcase } from "lucide-react";
import type { GraduationEntry } from "@/mocks/fixtures/index.ts";
import { INTENT_METRICS, READINESS_CHECKS } from "@/mocks/fixtures/index.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface Verdict {
  signable: boolean;
  headline: string;
  details: Array<{ text: string; pass: boolean | null }>;
}

function evaluate(g: GraduationEntry, negativeColumnPresent: boolean, t: (k: string, o?: Record<string, unknown>) => string): Verdict {
  const metric = INTENT_METRICS.find((m) => m.intentCode === g.intentCode);
  if (g.status === "never") {
    return {
      signable: false,
      headline:
        g.risk === "R4"
          ? t("readiness.neverR4Headline")
          : t("readiness.neverR3Headline"),
      details: [{ text: t("readiness.neverDetail"), pass: null }],
    };
  }
  if (g.status === "rare_hold") {
    return {
      signable: false,
      headline: t("readiness.rareHeadline"),
      details: [
        { text: t("readiness.rareTriggers", { count: g.triggers90d }), pass: null },
        { text: t("readiness.rareConformal"), pass: null },
      ],
    };
  }
  const details: Verdict["details"] = [];
  let signable = true;
  if (g.regulated) {
    const volumeOk = g.triggers90d >= 600;
    const missesOk = g.criticalMisses === 0;
    details.push({ text: t("readiness.regVolume", { count: g.triggers90d }), pass: volumeOk });
    details.push({ text: t("readiness.regMisses", { count: g.criticalMisses }), pass: missesOk });
    details.push({
      text: t("readiness.negativeColumn"),
      pass: negativeColumnPresent,
    });
    if (metric?.recallRegulated != null) {
      const recallOk = metric.recallRegulated >= 0.995;
      details.push({
        text: t("readiness.regRecall", { pct: (metric.recallRegulated * 100).toFixed(1) }),
        pass: recallOk,
      });
      if (!recallOk) signable = false;
    }
    if (!volumeOk || !missesOk || !negativeColumnPresent) signable = false;
  } else {
    const volumeOk = g.triggers90d >= 300;
    const noEditOk = (g.noEditApproval ?? 0) >= 0.97;
    details.push({ text: t("readiness.nonRegVolume", { count: g.triggers90d }), pass: volumeOk });
    details.push({
      text: t("readiness.nonRegNoEdit", { pct: ((g.noEditApproval ?? 0) * 100).toFixed(1) }),
      pass: noEditOk,
    });
    if (!volumeOk || !noEditOk) signable = false;
  }
  return {
    signable,
    headline:
      g.status === "shadow"
        ? signable
          ? t("readiness.shadowSignable")
          : t("readiness.shadowNot")
        : signable
          ? t("readiness.graduatedSignable")
          : t("readiness.graduatedNot"),
    details,
  };
}

export function ReadinessReport({
  entry,
  negativeColumnPresent,
  onPromote,
}: {
  entry: GraduationEntry;
  negativeColumnPresent: boolean;
  onPromote: () => void;
}) {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const verdict = evaluate(entry, negativeColumnPresent, t);
  const alreadySigned = entry.status === "graduated" && entry.dualSigned;
  const [signedCompliance, setSignedCompliance] = useState(false);
  const [signedBusiness, setSignedBusiness] = useState(false);
  const both = signedCompliance && signedBusiness;

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s4.readiness">
      <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-navy">
        {verdict.signable ? (
          <CheckCircle2 size={14} className="text-emerald-600" />
        ) : (
          <XCircle size={14} className="text-red-600" />
        )}
        {t("readiness.title", { intent: entry.intentCode })}
      </h3>
      <p className="mt-0.5 text-[13.5px] text-gray-700">{verdict.headline}</p>
      <ul className="mt-1 space-y-0.5">
        {verdict.details.map((d) => (
          <li key={d.text} className="flex items-center gap-1 font-mono text-[13px] text-gray-600">
            {d.pass == null ? (
              <span className="w-3.5 text-faint">·</span>
            ) : d.pass ? (
              <CheckCircle2 size={11} className="shrink-0 text-emerald-600" />
            ) : (
              <XCircle size={11} className="shrink-0 text-red-600" />
            )}
            {d.text}
          </li>
        ))}
      </ul>

      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] text-teal">{t("readiness.globalChecks")}</summary>
        <ul className="mt-1 space-y-0.5">
          {READINESS_CHECKS.map((c) => (
            <li key={c.code} className="flex items-start gap-1 text-[13px]">
              <CheckCircle2 size={11} className={cn("mt-0.5 shrink-0", c.pass ? "text-emerald-600" : "text-red-600")} />
              <span>
                <span className="font-medium">{c.label[lang]}</span>
                <span className="text-faint"> — {c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      {entry.status !== "never" && entry.status !== "rare_hold" && (
        <div className="mt-2 rounded border border-line bg-paper p-2">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-faint">
            {t("readiness.dualSignoff")}
          </div>
          {alreadySigned ? (
            <div className="mt-1 space-y-0.5 text-[13px]">
              {entry.signedBy?.map((rec) => (
                <div key={rec.role.en} className="flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  {t("readiness.signedAt", { role: rec.role[lang], at: rec.at })}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              <SignButton
                icon={<ShieldCheck size={11} />}
                label={t("readiness.complianceSigns")}
                signed={signedCompliance}
                disabled={!verdict.signable}
                onClick={() => setSignedCompliance(true)}
                id="s4.sign.compliance"
              />
              <SignButton
                icon={<Briefcase size={11} />}
                label={t("readiness.businessSigns")}
                signed={signedBusiness}
                disabled={!verdict.signable}
                onClick={() => setSignedBusiness(true)}
                id="s4.sign.business"
              />
              {both && (
                <button
                  data-id="s4.sign.apply"
                  onClick={onPromote}
                  className="inline-flex items-center gap-1 rounded bg-navy px-2.5 py-1 text-[13.5px] font-semibold text-white"
                >
                  <PenLine size={11} /> {t("readiness.apply")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SignButton({
  icon,
  label,
  signed,
  disabled,
  onClick,
  id,
}: {
  icon: React.ReactNode;
  label: string;
  signed: boolean;
  disabled: boolean;
  onClick: () => void;
  id: string;
}) {
  const { t } = useTranslation("builder");
  return (
    <button
      data-id={id}
      onClick={onClick}
      disabled={disabled || signed}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2.5 py-1 text-[13.5px] ring-1",
        signed
          ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
          : "bg-white text-navy ring-line disabled:opacity-40",
      )}
    >
      {signed ? <CheckCircle2 size={11} /> : icon}
      {signed ? t("readiness.signed") : label}
    </button>
  );
}
