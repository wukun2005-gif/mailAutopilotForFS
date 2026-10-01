// ScenarioBar — prototype control panel (Dev Plan §7.0 top.devpanel).
// Drives the real runtime for manual demos and gives the M7 Director the
// data-id hooks it needs. Collapsible; clearly labelled as prototype tooling.
import { useState } from "react";
import {
  Play, RotateCcw, RefreshCw, Wrench, ChevronDown, ChevronUp,
} from "lucide-react";
import { useCaseStore } from "@/store/caseStore";
import { faultController, type FaultFlag } from "@/tools/faultController";
import { SCENARIOS } from "@/runtime/scenarios.ts";
import type { ScenarioId } from "@/runtime/scenarios.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const INJECTS: Record<ScenarioId, { id: string }[]> = {
  email1: [{ id: "EM-1-IN-1" }, { id: "EM-1-IN-2" }],
  email2: [{ id: "EM-2-IN-1" }, { id: "EM-2-IN-1B" }, { id: "EM-2-IN-2" }],
  email3: [{ id: "EM-3-IN-1" }],
};

const FAULTS: { flag: FaultFlag }[] = [
  { flag: "bankingTimeout" },
  { flag: "duplicateFiling" },
  { flag: "policyV13" },
  { flag: "sessionExpired" },
  { flag: "threadClosed" },
  { flag: "spoofSignal" },
  { flag: "newThread" },
  { flag: "noDigital" },
  { flag: "otpLockout" },
  { flag: "ocrLow" },
];

export function ScenarioBar() {
  const { scenarioId, loadScenario, inject, advance, simulateRestart, reset, busy, clock } =
    useCaseStore();
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [faultTick, setFaultTick] = useState(0);

  const current = scenarioId ? INJECTS[scenarioId] : [];

  return (
    <div className="shrink-0 border-b border-line bg-amber-50/70" data-id="top.devpanel">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[14px] font-semibold text-amber-900"
        >
          <Wrench size={12} /> {t("dev.controls")}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <span className="font-mono text-[13px] text-amber-800">
          {t("dev.simDay", { n: clock.dayN })}
        </span>
        <div className="ml-1 flex gap-1">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <button
              key={id}
              data-id={`dev.load.${id}`}
              onClick={() => loadScenario(id)}
              className={cn(
                "rounded px-2 py-0.5 text-[13.5px]",
                scenarioId === id ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-line",
              )}
            >
              {t("dev.email", { n: id === "email1" ? 1 : id === "email2" ? 2 : 3 })}
            </button>
          ))}
        </div>
        {current.map((e) => (
          <button
            key={e.id}
            data-id={`dev.inject.${e.id}`}
            disabled={busy}
            onClick={() => inject(e.id)}
            className="flex items-center gap-1 rounded bg-teal px-2 py-0.5 text-[13.5px] text-white disabled:opacity-40"
          >
            <Play size={10} /> {t(`dev.inject.${e.id}`)}
          </button>
        ))}
        {scenarioId === "email2" && (
          <>
            <button data-id="dev.clock.bd10" disabled={busy} onClick={() => advance("bd10")}
              className="rounded bg-sky-700 px-2 py-0.5 text-[13.5px] text-white disabled:opacity-40">
              {t("dev.jumpBd10")}
            </button>
            <button data-id="dev.clock.day40" disabled={busy} onClick={() => advance("day40")}
              className="rounded bg-sky-700 px-2 py-0.5 text-[13.5px] text-white disabled:opacity-40">
              {t("dev.jumpDay40")}
            </button>
            <button data-id="dev.clock.day45" disabled={busy} onClick={() => advance("day45")}
              className="rounded bg-sky-700 px-2 py-0.5 text-[13.5px] text-white disabled:opacity-40">
              {t("dev.jumpDay45")}
            </button>
          </>
        )}
        {scenarioId === "email1" && (
          <button data-id="dev.clock.verify14d" disabled={busy} onClick={() => advance("verify14d")}
            className="rounded bg-sky-700 px-2 py-0.5 text-[13.5px] text-white disabled:opacity-40">
            {t("dev.verify14d")}
          </button>
        )}
        <button data-id="dev.restart" onClick={simulateRestart} title={t("dev.restartTitle")} disabled={busy}
          className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[13.5px] text-navy ring-1 ring-line disabled:opacity-50">
          <RefreshCw size={10} className={cn(busy && "animate-spin")} /> {t("dev.restart")}
        </button>
        <button data-id="dev.reset" onClick={reset}
          className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[13.5px] text-red-700 ring-1 ring-line">
          <RotateCcw size={10} /> {t("dev.reset")}
        </button>
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 border-t border-amber-200 px-3 py-1.5">
          {FAULTS.map((f) => (
            <button
              key={f.flag}
              data-id={`dev.fault.${f.flag}`}
              data-tick={faultTick}
              onClick={() => {
                faultController.toggle(f.flag);
                setFaultTick((v) => v + 1);
              }}
              className={cn(
                "rounded px-1.5 py-0.5 text-[13px] ring-1",
                faultController.isOn(f.flag)
                  ? "bg-red-600 text-white ring-red-700"
                  : "bg-white text-gray-600 ring-line",
              )}
            >
              {t(`dev.faults.${f.flag}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
