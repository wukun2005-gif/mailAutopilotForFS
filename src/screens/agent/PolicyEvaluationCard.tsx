// PolicyEvaluationCard — condition-level PASS/FAIL/UNKNOWN table with data
// source and policy version (Dev Plan §7.2). Email 1 beat 2 shows the FAIL
// condition ("first waiver in 12 months"); UNKNOWN fails closed.
// Audience-facing copy: policy titles and condition labels come straight from
// the fixture packs (single source of truth), verdicts/effects from i18n.
import { Check, X, HelpCircle } from "lucide-react";
import type { CaseStateType, PolicyCard } from "@/runtime/caseState.ts";
import { POLICY_PACKS } from "@/mocks/fixtures/index.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function VerdictIcon({ v }: { v: string }) {
  if (v === "PASS") return <Check size={12} className="text-emerald-600" />;
  if (v === "FAIL") return <X size={12} className="text-red-600" />;
  return <HelpCircle size={12} className="text-amber-600" />;
}

function packFor(card: PolicyCard) {
  return Object.values(POLICY_PACKS).find(
    (p) => p.policyId === card.policyId && p.version === card.version,
  );
}

function evidenceText(v: unknown, lang: "zh" | "en"): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return lang === "zh" ? (v ? "是" : "否") : v ? "yes" : "no";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function Card({
  card,
  t,
  lang,
}: {
  card: PolicyCard;
  t: (k: string, o?: Record<string, unknown>) => string;
  lang: "zh" | "en";
}) {
  const pack = packFor(card);
  const title =
    pack?.title[lang] ??
    (t("customer:trace.policies." + card.policyId, { defaultValue: card.policyId }) as string);
  const labelOf = (code: string) =>
    pack?.conditions.find((c) => c.code === code)?.label[lang] ?? code;
  return (
    <div className="rounded border border-line p-2" data-id="s2.policy">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-navy">{title}</span>
        <span className="text-[13px] text-faint">{t("policy.version", { v: card.version })}</span>
        {card.degraded && (
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[12px] font-medium text-amber-800">
            {t("policy.degraded")}
          </span>
        )}
        <span
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 text-[13px]",
            card.overall === "PASS"
              ? "bg-emerald-50 text-emerald-700"
              : card.overall === "FAIL"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800",
          )}
        >
          {t("policy.verdict." + card.overall, { defaultValue: card.overall })}
        </span>
      </div>
      <div className="mt-0.5 text-[13px] text-faint">
        {t("policy.effects." + card.effect, { defaultValue: card.effect })}
      </div>
      <table className="mt-1.5 w-full text-[13.5px]">
        <tbody>
          {card.conditions.map((c) => (
            <tr
              key={c.code}
              className="border-t border-line"
              // Per-condition hook incl. the verdict: the same condition code
              // appears in several packs (one PASS, one FAIL) and the demo has
              // to point at the failing one.
              data-id={`s2.policy.row.${c.code}.${c.verdict}`}
            >
              <td className="py-1 pr-2">{labelOf(c.code)}</td>
              <td className="py-1 pr-2 text-faint">{evidenceText(c.evidence, lang)}</td>
              <td className="w-16 py-1 text-right">
                <span className="inline-flex items-center gap-1">
                  <VerdictIcon v={c.verdict} />
                  {t("policy.verdict." + c.verdict, { defaultValue: c.verdict })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PolicyEvaluationCard({ state }: { state: CaseStateType }) {
  const { t, i18n } = useTranslation("agent");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const cards = state.policyCards ?? [];
  return (
    <section className="rounded-lg border border-line bg-white p-3" data-id="s2.policy.section">
      <h3 className="text-[15px] font-semibold text-navy">{t("policy.title")}</h3>
      <p className="text-[13px] text-faint">{t("policy.subtitle")}</p>
      <div className="mt-2 space-y-2">
        {cards.length === 0 && <div className="text-[13.5px] text-faint">{t("policy.empty")}</div>}
        {cards.map((c) => (
          <Card key={`${c.policyId}@${c.sourceEmailId}`} card={c} t={t} lang={lang} />
        ))}
      </div>
    </section>
  );
}
