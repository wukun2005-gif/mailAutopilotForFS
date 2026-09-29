// IntentEvidenceCard — intent verdict, quoted source sentence, recorded
// confidence and alternatives (Dev Plan §7.2). Detection is recorded data.
import { recordedTriage, INTENT_SPECS } from "@/runtime/intentRegistry.ts";
import type { CaseStateType } from "@/runtime/caseState.ts";
import { INBOUND_EMAILS } from "@/mocks/fixtures/index.ts";
import { useTranslation } from "react-i18next";

function CellBadge({ cell, t }: { cell: CaseStateType["decisions"][number]["cell"]; t: (k: string) => string }) {
  if (cell.kind === "L")
    return <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[13px] text-emerald-700">{cell.level}</span>;
  if (cell.kind === "deny")
    return <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono text-[13px] text-amber-800">{t("cell.deny")}</span>;
  return <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-[13px] text-red-700">{t("cell.never")}</span>;
}

export function IntentEvidenceCard({ state }: { state: CaseStateType }) {
  const { t } = useTranslation("agent");
  const emails = INBOUND_EMAILS.filter((e) => e.scenarioId === state.scenarioId);
  return (
    <section className="rounded-lg border border-line bg-white p-3" data-id="s2.intent">
      <h3 className="text-[15px] font-semibold text-navy">{t("intent.title")}</h3>
      <p className="text-[13px] text-faint">{t("intent.subtitle")}</p>
      <div className="mt-2 space-y-2">
        {emails.flatMap((email) => {
          const hits = recordedTriage(email.id);
          if (hits.length === 0)
            return [
              <div key={email.id} className="rounded bg-gray-50 px-2 py-1 text-[13.5px] text-faint">
                {t("intent.materialsOnly", { id: email.id })}
              </div>,
            ];
          return hits.map((hit) => {
            const decision = state.decisions.find(
              (d) => d.intentCode === hit.intentCode && d.sourceEmailId === email.id,
            );
            const spec = INTENT_SPECS[hit.intentCode];
            return (
              <div key={`${email.id}:${hit.intentCode}`} className="rounded border border-line p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[14px] font-semibold text-navy">{hit.intentCode}</span>
                  <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12.5px] text-gray-600">
                    {spec?.risk}{spec?.regulated ? t("intent.regulated") : ""}
                  </span>
                  <span className="font-mono text-[13px] text-faint">{t("intent.conf", { value: hit.confidence.toFixed(2) })}</span>
                  {decision && <CellBadge cell={decision.cell} t={t} />}
                </div>
                {hit.evidenceSentences.map((q) => (
                  <blockquote
                    key={q}
                    className="mt-1 border-l-2 border-amber-400 bg-amber-50/60 px-2 py-1 text-[13.5px] italic text-gray-700"
                  >
                    “{q}”
                  </blockquote>
                ))}
                {(decision?.reasonCodes?.length ?? 0) > 0 && (
                  <div className="mt-1 font-mono text-[12.5px] text-faint">
                    {decision!.reasonCodes!.join(" · ")}
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>
    </section>
  );
}
