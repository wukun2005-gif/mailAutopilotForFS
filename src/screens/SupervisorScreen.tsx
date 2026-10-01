// Screen 3 — Supervisor Cockpit (Dev Plan §7.3): approve fast, see every
// statutory clock, keep fraud isolated. All three tabs read the same runtime
// state as the customer and agent views; approvals resume the real graph.
import { useEffect, useState } from "react";
import { Inbox, Clock, ShieldAlert } from "lucide-react";
import { useCaseStore } from "@/store/caseStore";
import { ApprovalQueue } from "./supervisor/ApprovalQueue";
import { ClockBoard } from "./supervisor/ClockBoard";
import { FraudQuarantine } from "./supervisor/FraudQuarantine";
import { regEClocks, DAY0_EPOCH, simClock } from "@/runtime/simClock.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type Tab = "queue" | "clocks" | "fraud";

export function SupervisorScreen() {
  const { t } = useTranslation("supervisor");
  const TABS: { id: Tab; label: string; icon: typeof Inbox }[] = [
    { id: "queue", label: t("tabs.queue"), icon: Inbox },
    { id: "clocks", label: t("tabs.clocks"), icon: Clock },
    { id: "fraud", label: t("tabs.fraud"), icon: ShieldAlert },
  ];
  const scenarioId = useCaseStore((s) => s.scenarioId);
  const loadScenario = useCaseStore((s) => s.loadScenario);
  const caseState = useCaseStore((s) => s.caseState);
  const [tab, setTab] = useState<Tab>("queue");

  useEffect(() => {
    if (!scenarioId) void loadScenario("email2");
  }, [scenarioId, loadScenario]);

  if (!scenarioId || !caseState) {
    return <div className="p-6 text-[15px] text-faint">{t("loading")}</div>;
  }

  const pending = (caseState.approvals ?? []).filter((a) => a.status === "pending");
  const quarantined = caseState.fraud?.quarantined ?? false;
  let dueClocks = 0;
  if (caseState.scenarioId === "email2" && caseState.clocksFiled) {
    const c = regEClocks(DAY0_EPOCH);
    const pcDone = (caseState.actions ?? []).some(
      (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
    );
    if (!pcDone && c.provisionalCreditDue - simClock.now() <= 5 * 86_400_000) dueClocks += 1;
  }
  // FR-1.5 对客承诺时钟：未兑现、有到期日且 5 天内到期的承诺计入同一 KPI
  // （任何场景）；无到期日的承诺不进倒计时 KPI，只留在看板与队列里。
  for (const p of caseState.promiseClocks ?? []) {
    if (!p.fulfilledAt && p.dueAt != null && p.dueAt - simClock.now() <= 5 * 86_400_000)
      dueClocks += 1;
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label={t("kpi.pending")} value={pending.length} hot={pending.length > 0} />
        <Kpi label={t("kpi.clocks")} value={dueClocks} hot={dueClocks > 0} />
        <Kpi label={t("kpi.quarantined")} value={quarantined ? 1 : 0} hot={quarantined} />
      </div>

      <div className="flex gap-1 border-b border-line">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-id={`s3.tab.${id}`}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[14.5px]",
              tab === id
                ? "border-teal font-semibold text-teal"
                : "border-transparent text-faint hover:text-navy",
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "queue" && <ApprovalQueue state={caseState} />}
        {tab === "clocks" && <ClockBoard state={caseState} />}
        {tab === "fraud" && <FraudQuarantine state={caseState} />}
      </div>
    </div>
  );
}

function Kpi({ label, value, hot }: { label: string; value: number; hot: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white px-3 py-2",
        hot && value > 0 ? "border-red-300 bg-red-50/50" : "border-line",
      )}
    >
      <div className={cn("text-[23px] font-bold leading-none", hot ? "text-red-700" : "text-navy")}>
        {value}
      </div>
      <div className="mt-1 text-[13px] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}
