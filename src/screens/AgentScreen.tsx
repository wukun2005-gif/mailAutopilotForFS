// Screen 2 — Agent Handoff Dossier (Dev Plan §7.2).
// Humans make judgments, not searches: the full case context is assembled
// into a vertical card flow over the same runtime as the other three views.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCaseStore } from "@/store/caseStore";
import { CaseList } from "./agent/CaseList";
import { ResumeBanner } from "./agent/ResumeBanner";
import { IntentEvidenceCard } from "./agent/IntentEvidenceCard";
import { PolicyEvaluationCard } from "./agent/PolicyEvaluationCard";
import { MissingMaterialsCard } from "./agent/MissingMaterialsCard";
import { PendingActionsCard } from "./agent/PendingActionsCard";
import { DraftPanel } from "./agent/DraftPanel";
import { StatutoryClockStrip } from "@/components/ClockBadge";
import { TraceRail } from "@/components/TraceRail";
import { SCENARIOS } from "@/runtime/scenarios.ts";

export function AgentScreen() {
  const { t, i18n } = useTranslation(["agent", "common"]);
  const scenarioId = useCaseStore((s) => s.scenarioId);
  const loadScenario = useCaseStore((s) => s.loadScenario);
  const caseState = useCaseStore((s) => s.caseState);
  const events = useCaseStore((s) => s.events);
  const reattached = useCaseStore((s) => s.reattached);

  useEffect(() => {
    // The dispute dossier is the showcase case for this screen.
    if (!scenarioId) void loadScenario("email2");
  }, [scenarioId, loadScenario]);

  if (!scenarioId || !caseState) {
    return <div className="p-6 text-[15px] text-faint">{t("loading")}</div>;
  }

  const pcDone = (caseState.actions ?? []).some(
    (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
  );
  const scen = (
    SCENARIOS as Record<string, { label: { zh: string; en: string } } | undefined>
  )[caseState.scenarioId];
  const scenarioLabel =
    scen?.label[i18n.language?.startsWith("zh") ? "zh" : "en"] ?? caseState.scenarioId;

  return (
    <div className="grid h-full grid-cols-[220px_1fr_340px] gap-2 overflow-hidden p-2">
      <aside className="min-h-0 overflow-hidden rounded-lg border border-line bg-paper">
        <CaseList />
      </aside>

      <section className="min-h-0 overflow-y-auto pr-1" data-id="s2.dossier">
        <div className="space-y-2">
          <ResumeBanner state={caseState} reattached={reattached} />
          <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
            <h2 className="text-[16px] font-semibold text-navy">
              {caseState.caseId} · {scenarioLabel}
            </h2>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[13px] text-gray-600">
              {t(`common:caseStatus.${caseState.status}`)}
            </span>
            <span className="ml-auto font-mono text-[13px] text-faint">
              {t("identityLabel", { level: caseState.identity?.level ?? "—" })}
            </span>
          </div>
          {caseState.scenarioId === "email2" && <StatutoryClockStrip pcDone={pcDone} />}
          <PendingActionsCard state={caseState} />
          <IntentEvidenceCard state={caseState} />
          <PolicyEvaluationCard state={caseState} />
          <MissingMaterialsCard state={caseState} />
          <DraftPanel state={caseState} />
        </div>
      </section>

      <aside className="min-h-0 overflow-hidden rounded-lg border border-line bg-white">
        <TraceRail events={events} dataId="s2.tracerail" />
      </aside>
    </div>
  );
}
