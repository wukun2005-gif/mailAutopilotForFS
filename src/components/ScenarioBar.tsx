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

const INJECTS: Record<ScenarioId, { id: string; label: string }[]> = {
  email1: [
    { id: "EM-1-IN-1", label: "Day 0 · OD-fee email" },
    { id: "EM-1-IN-2", label: "Day 21 · 2nd waiver" },
  ],
  email2: [
    { id: "EM-2-IN-1", label: "Day 0 · dispute + card status" },
    { id: "EM-2-IN-1B", label: "Day 1 · transaction detail?" },
    { id: "EM-2-IN-2", label: "Day 6 · signed statement (OCR)" },
  ],
  email3: [{ id: "EM-3-IN-1", label: "Day 2 · BEC lookalike" }],
};

const FAULTS: { flag: FaultFlag; label: string }[] = [
  { flag: "bankingTimeout", label: "banking timeout (retry)" },
  { flag: "duplicateFiling", label: "duplicate delivery" },
  { flag: "policyV13", label: "policy v13 (2nd waiver FAIL)" },
  { flag: "sessionExpired", label: "I3 session expired" },
  { flag: "threadClosed", label: "thread closed" },
  { flag: "spoofSignal", label: "AC3 spoof signal" },
  { flag: "newThread", label: "new thread (no I3 inherit)" },
  { flag: "noDigital", label: "no digital banking (link fallback)" },
  { flag: "otpLockout", label: "OTP lockout" },
];

export function ScenarioBar() {
  const { scenarioId, loadScenario, inject, advance, simulateRestart, reset, busy, clock } =
    useCaseStore();
  const [open, setOpen] = useState(false);
  const [faultTick, setFaultTick] = useState(0);

  const current = scenarioId ? INJECTS[scenarioId] : [];

  return (
    <div className="shrink-0 border-b border-line bg-amber-50/70" data-id="top.devpanel">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-amber-900"
        >
          <Wrench size={12} /> Prototype controls
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <span className="font-mono text-[10px] text-amber-800">
          sim day {clock.dayN}
        </span>
        <div className="ml-1 flex gap-1">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <button
              key={id}
              data-id={`dev.load.${id}`}
              onClick={() => loadScenario(id)}
              className={cn(
                "rounded px-2 py-0.5 text-[10.5px]",
                scenarioId === id ? "bg-navy text-white" : "bg-white text-navy ring-1 ring-line",
              )}
            >
              {id === "email1" ? "Email 1" : id === "email2" ? "Email 2" : "Email 3"}
            </button>
          ))}
        </div>
        {current.map((e) => (
          <button
            key={e.id}
            data-id={`dev.inject.${e.id}`}
            disabled={busy}
            onClick={() => inject(e.id)}
            className="flex items-center gap-1 rounded bg-teal px-2 py-0.5 text-[10.5px] text-white disabled:opacity-40"
          >
            <Play size={10} /> {e.label}
          </button>
        ))}
        {scenarioId === "email2" && (
          <>
            <button data-id="dev.clock.bd10" disabled={busy} onClick={() => advance("bd10")}
              className="rounded bg-sky-700 px-2 py-0.5 text-[10.5px] text-white disabled:opacity-40">
              jump bd10
            </button>
            <button data-id="dev.clock.day40" disabled={busy} onClick={() => advance("day40")}
              className="rounded bg-sky-700 px-2 py-0.5 text-[10.5px] text-white disabled:opacity-40">
              jump Day 40
            </button>
            <button data-id="dev.clock.day45" disabled={busy} onClick={() => advance("day45")}
              className="rounded bg-sky-700 px-2 py-0.5 text-[10.5px] text-white disabled:opacity-40">
              jump Day 45
            </button>
          </>
        )}
        {scenarioId === "email1" && (
          <button data-id="dev.clock.verify14d" disabled={busy} onClick={() => advance("verify14d")}
            className="rounded bg-sky-700 px-2 py-0.5 text-[10.5px] text-white disabled:opacity-40">
            +14 days (verify)
          </button>
        )}
        <button data-id="dev.restart" onClick={simulateRestart} title="new process, same IDB checkpoints"
          className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10.5px] text-navy ring-1 ring-line">
          <RefreshCw size={10} /> restart process
        </button>
        <button data-id="dev.reset" onClick={reset}
          className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10.5px] text-red-700 ring-1 ring-line">
          <RotateCcw size={10} /> reset
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
                "rounded px-1.5 py-0.5 text-[10px] ring-1",
                faultController.isOn(f.flag)
                  ? "bg-red-600 text-white ring-red-700"
                  : "bg-white text-gray-600 ring-line",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
