// Agent screen — left rail: the three recorded cases (Dev Plan §7.2).
import { FileClock, Lock, AlertOctagon } from "lucide-react";
import { SCENARIOS, type ScenarioId } from "@/runtime/scenarios.ts";
import { useCaseStore } from "@/store/caseStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const ICONS: Record<ScenarioId, typeof FileClock> = {
  email1: FileClock,
  email2: Lock,
  email3: AlertOctagon,
};

export function CaseList() {
  const { t, i18n } = useTranslation(["agent", "common"]);
  const scenarioId = useCaseStore((s) => s.scenarioId);
  const loadScenario = useCaseStore((s) => s.loadScenario);
  const caseState = useCaseStore((s) => s.caseState);

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto p-2" data-id="s2.caselist">
      <div className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-faint">
        {t("caselist.title")}
      </div>
      {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
        const Icon = ICONS[id];
        const active = scenarioId === id;
        const status = active ? caseState?.status : undefined;
        return (
          <button
            key={id}
            data-id={`s2.case.${id}`}
            onClick={() => loadScenario(id)}
            className={cn(
              "rounded-lg border p-2 text-left transition-colors",
              active ? "border-navy bg-navy-soft" : "border-line bg-white hover:bg-gray-50",
            )}
          >
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-navy">
              <Icon size={13} />
              {id === "email1" ? "CASE-OD-7701" : id === "email2" ? "DSP-10452" : "CASE-ATO-3309"}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-faint">
              {i18n.language?.startsWith("zh") ? SCENARIOS[id].label.zh : SCENARIOS[id].label.en}
            </div>
            {status && (
              <span className="mt-1 inline-block rounded bg-white px-1.5 py-0.5 font-mono text-[9px] text-navy ring-1 ring-line">
                {status}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
