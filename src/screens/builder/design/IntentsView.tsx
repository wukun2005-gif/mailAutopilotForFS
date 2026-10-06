// IntentsView — FR-12.6 Intent Discovery. Clusters of inbound mail the
// existing intent taxonomy misses become candidates; humans set R/I levels
// and accept them into shadow. R3/R4 clusters are reported for
// specialist routing only and never become an executable intent.
import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Ban, CheckCircle2, Search } from "lucide-react";
import { designTimeStore } from "@/runtime/designTime/store.ts";

export function IntentsView() {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => designTimeStore.subscribe(bump), []);
  const candidates = designTimeStore.getCandidates();

  return (
    <div className="flex flex-col gap-2 pb-16">
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-navy">
          <Search size={15} className="text-teal" /> {t("design.intents.title")}
        </h3>
        <p className="text-[12.5px] text-faint">{t("design.intents.subtitle")}</p>
      </div>

      {candidates.map((c) => (
        <div
          key={c.id}
          className={
            c.reportOnly
              ? "rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3 opacity-85"
              : "rounded-lg border border-line bg-white p-3"
          }
          data-id={`s4.cand.${c.id}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-faint">{c.proposedCode}</span>
            <h4 className="text-[14px] font-semibold text-navy">{c.label[lang]}</h4>
            <span className="rounded bg-paper px-1.5 py-0.5 text-[12px] font-semibold text-faint" data-id={`s4.cand.state.${c.id}`}>
              {t(`design.intents.state.${c.state}`)}
            </span>
          </div>

          <div className="mt-1.5 grid gap-1.5 text-[12.5px] md:grid-cols-3">
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("design.intents.volume")}</span>{" "}
              <span className="font-mono font-bold text-navy">{c.volume90d}</span>
              <span className="text-emerald-700"> (+{c.trendPct}%)</span>
            </div>
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("design.intents.consistency")}</span>{" "}
              <span className="font-mono font-bold text-navy">{(c.stepConsistency * 100).toFixed(0)}%</span>
            </div>
            <div className="rounded bg-paper px-2 py-1">
              <span className="text-faint">{t("design.intents.handle")}</span>{" "}
              <span className="font-mono font-bold text-navy">{c.avgHandleMin} min</span>
            </div>
          </div>

          <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-[12.5px] text-gray-700">
            {c.steps.map((s, i) => <li key={i}>{s[lang]}</li>)}
          </ol>
          <div className="mt-1 text-[12.5px] text-gray-700">{c.cohortDist[lang]}</div>
          {c.toolsMapping.length > 0 && (
            <div className="mt-1 text-[12.5px] text-gray-700">
              <b>{t("design.intents.tools")}</b> {c.toolsMapping.map((x) => x[lang]).join("；")}
            </div>
          )}

          {c.reportOnly ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-[12.5px] text-gray-600" data-id={`s4.cand.report.${c.id}`}>
              <Ban size={14} className="mt-0.5 shrink-0 text-gray-500" />
              <span>
                <b>{t("design.intents.reportOnly")}</b> {c.reportReason?.[lang]}
              </span>
            </div>
          ) : c.state === "in_shadow" ? (
            <div className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700" data-id={`s4.cand.accepted.${c.id}`}>
              <CheckCircle2 size={14} /> {t("design.intents.inShadow", { r: c.suggestedR, i: c.suggestedI })}
            </div>
          ) : (
            <button
              data-id={`s4.cand.accept.${c.id}`}
              onClick={() => designTimeStore.acceptCandidate(c.id)}
              className="mt-2 rounded-md bg-sky-700 px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-sky-800"
            >
              {t("design.intents.accept", { r: c.suggestedR, i: c.suggestedI })}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
