// BacktestRunner — 90-day recorded-data replay. The progress bar is an
// animation; every number behind it is a recorded fixture (never computed).
import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import {
  BACKTEST_WINDOW,
  INTENT_METRICS,
  type IntentMetric,
} from "@/mocks/fixtures/index.ts";

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function MetricRow({ m, dim }: { m: IntentMetric; dim?: boolean }) {
  return (
    <tr className={dim ? "text-faint" : ""}>
      <td className="whitespace-nowrap py-0.5 pr-2 text-left font-mono text-[10px]">{m.intentCode}</td>
      <td className="px-2 font-mono text-[10px]">{m.triggers.toLocaleString()}</td>
      <td className="px-2 font-mono text-[10px]">{pct(m.aiVsHumanAgreement)}</td>
      <td className="px-2 font-mono text-[10px]">
        {m.noEditApproval > 0 ? pct(m.noEditApproval) : "—"}
      </td>
      <td className="px-2 font-mono text-[10px]">
        {m.recallRegulated != null ? pct(m.recallRegulated) : "—"}
      </td>
      <td className={`px-2 font-mono text-[10px] ${m.criticalMisses > 0 ? "font-bold text-red-700" : ""}`}>
        {m.criticalMisses}
      </td>
      <td className="px-2 font-mono text-[10px]">
        {m.unitCostUsd > 0 ? `$${m.unitCostUsd.toFixed(2)}` : "—"}
      </td>
    </tr>
  );
}

export function BacktestRunner({ selectedIntent }: { selectedIntent: string }) {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const run = () => {
    if (timer.current) window.clearInterval(timer.current);
    setRunning(true);
    setProgress(0);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        const next = p + 4 + Math.random() * 7;
        if (next >= 100) {
          if (timer.current) window.clearInterval(timer.current);
          setRunning(false);
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const done = progress >= 100;

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s4.backtest">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-navy">
          90-day backtest replay · {BACKTEST_WINDOW.from} → {BACKTEST_WINDOW.to}
        </h3>
        <button
          data-id="s4.backtest.run"
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1 rounded bg-teal px-2.5 py-1 text-[10.5px] font-semibold text-white disabled:opacity-50"
        >
          {done ? <RotateCcw size={11} /> : <Play size={11} />}
          {done ? "re-run replay" : "run replay"}
        </button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-gray-100">
        <div
          className="h-full rounded bg-teal transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-[9.5px] text-faint">
        {BACKTEST_WINDOW.totalThreads.toLocaleString()} threads ·{" "}
        {BACKTEST_WINDOW.validInbound.toLocaleString()} valid inbound · animation only — results are
        recorded fixtures ({BACKTEST_WINDOW.notes.en})
      </p>

      {done && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-line text-[9px] uppercase tracking-wide text-faint">
                <th className="py-1 text-left">intent</th>
                <th>triggers</th>
                <th>AI/human agree</th>
                <th>no-edit approve</th>
                <th>regulated recall</th>
                <th>critical misses</th>
                <th>unit cost</th>
              </tr>
            </thead>
            <tbody>
              {INTENT_METRICS.map((m) => (
                <MetricRow key={m.intentCode} m={m} dim={m.intentCode !== selectedIntent} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
