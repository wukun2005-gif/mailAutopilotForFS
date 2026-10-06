// P2 friction wave — no money, no tightening: AI routes the pattern to a
// notification-rule shadow proposal (FR-12.4) and the product team. The
// supervisor's only action is "route"; the AI cannot change policy itself.
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import type { Wave } from "@/runtime/designTime/types.ts";
import { Field, SeverityBadge, Sparkline } from "./waveUi";

export function P2Wave({ wave }: { wave: Wave }) {
  const { t, i18n } = useTranslation("supervisor");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const routed = wave.status === "routed";

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50/30 p-3"
      data-id={`s3.wave.${wave.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity="P2" />
            <h4 className="text-[14px] font-semibold text-navy">{wave.title[lang]}</h4>
          </div>
          <p className="mt-0.5 text-[12.5px] text-gray-700">{wave.signature[lang]}</p>
        </div>
        <Sparkline values={wave.volumeSeries} />
      </div>
      <div className="mt-1.5 rounded-md border border-line bg-white p-2">
        <Field label={t("waves.p2.cohorts")}>{wave.cohorts[lang]}</Field>
        <Field label={t("waves.p2.recommended")}>{wave.recommended[lang]}</Field>
      </div>
      <div className="mt-2">
        {routed ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-amber-800"
            data-id={`s3.waves.routed.${wave.id}`}
          >
            <CheckCircle2 size={14} /> {wave.routedTo?.[lang]}
          </div>
        ) : (
          <button
            data-id={`s3.waves.route.${wave.id}`}
            onClick={() => designTimeStore.routeP2(wave.id)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-600 px-3 py-1.5 text-[13px] font-semibold text-amber-700 hover:bg-amber-50"
          >
            <ArrowRight size={14} /> {t("waves.p2.routeBtn")}
          </button>
        )}
      </div>
    </div>
  );
}
