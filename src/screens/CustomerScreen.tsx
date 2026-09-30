// Screen 1 — Customer Email View (Dev Plan §7.1).
// Left: mock webmail (what the customer sends). Center: recorded phone with
// the Larkspur app (secure messages + step-up case card). Right (audit view):
// decision dossier trace + identity gate.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Eye, ScanSearch } from "lucide-react";
import { useCaseStore } from "@/store/caseStore";
import { useUIStore } from "@/store/uiStore";
import { useFaultFlags } from "@/lib/useFaultFlags";
import { Webmail } from "@/components/Webmail";
import { PhoneFrame, PhoneApp } from "@/components/PhoneApp";
import { TraceRail } from "@/components/TraceRail";
import { IdentityAudit } from "@/components/IdentityAudit";
import { StepUpPage } from "@/components/StepUpPage";
import { StatutoryClockStrip } from "@/components/ClockBadge";
import { LetterLegend } from "@/components/TricolorLetter";
import { cn } from "@/lib/utils";

export function CustomerScreen() {
  const { t } = useTranslation(["customer", "common"]);
  const VIEW_TABS = [
    { v: false, label: t("tabs.customerView"), Icon: Eye },
    { v: true, label: t("tabs.auditView"), Icon: ScanSearch },
  ] as const;
  const scenarioId = useCaseStore((s) => s.scenarioId);
  const loadScenario = useCaseStore((s) => s.loadScenario);
  const caseState = useCaseStore((s) => s.caseState);
  const events = useCaseStore((s) => s.events);
  const auditView = useUIStore((s) => s.auditView);
  const setAuditView = useUIStore((s) => s.setAuditView);
  const faults = useFaultFlags();

  useEffect(() => {
    if (!scenarioId) void loadScenario("email1");
  }, [scenarioId, loadScenario]);

  if (!scenarioId) return null;
  const pcDone = (caseState?.actions ?? []).some(
    (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-white px-3 py-1.5">
        <div className="flex rounded-full bg-gray-100 p-0.5" data-id="s1.viewtoggle">
          {VIEW_TABS.map(({ v, label, Icon }) => (
            <button
              key={label}
              // Per-tab hook: the toggle's own id is on the wrapper, and a
              // click there hits no handler.
              data-id={v ? "s1.view.audit" : "s1.view.customer"}
              onClick={() => setAuditView(v)}
              className={cn(
                "flex items-center gap-1 rounded-full px-3 py-1 text-[14px]",
                auditView === v ? "bg-navy text-white" : "text-gray-600",
              )}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <div className="ml-2 hidden md:block"><LetterLegend /></div>
        <span className="ml-auto rounded bg-gray-100 px-2 py-0.5 text-[13px] text-gray-600">
          {t("tabs.status", { value: caseState?.status ? t(`common:caseStatus.${caseState.status}`) : "—" })}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {scenarioId === "email2" && <StatutoryClockStrip pcDone={pcDone} />}
          {faults.noDigital && caseState?.status === "awaiting_customer" && <StepUpPage />}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1fr_320px]">
            <div className="min-h-[440px]">
              <Webmail scenarioId={scenarioId} />
            </div>
            <PhoneFrame>
              <PhoneApp />
            </PhoneFrame>
          </div>
        </div>

        {auditView && (
          <aside className="min-h-0 overflow-hidden rounded-lg border border-line bg-white">
            <div className="flex h-full flex-col gap-2 overflow-y-auto p-2">
              <IdentityAudit identity={caseState?.identity} />
              <div className="flex min-h-[320px] flex-1 flex-col rounded-lg border border-line">
                <TraceRail events={events} />
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
