// ClockBoard — FR-8.2 / FR-4.2: statutory clocks across open disputes.
// Recharts horizontal bars, remaining calendar hours; red under 48h, amber
// under 5 days. 10/20 are business-day milestones, 45/90 calendar days.
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, LabelList } from "recharts";
import { regEClocks, DAY0_EPOCH, simClock } from "@/runtime/simClock.ts";
import type { CaseStateType } from "@/runtime/caseState.ts";
import { useCaseStore } from "@/store/caseStore";
import { format } from "date-fns";

const HOUR = 3_600_000;

interface Row {
  name: string;
  due: number;
  remainingH: number;
  totalH: number;
  color: string;
  label: string;
  done: boolean;
}

function rowsFor(state: CaseStateType): Row[] {
  if (state.scenarioId !== "email2") return [];
  const c = regEClocks(DAY0_EPOCH);
  const now = simClock.now();
  const pcDone = (state.actions ?? []).some(
    (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
  );
  const resultSent = (state.outbound ?? []).some((o) => o.draftId?.startsWith("DR-RESULT"));
  const mk = (
    name: string,
    due: number,
    start: number,
    done: boolean,
  ): Row => {
    const remainingH = Math.round((due - now) / HOUR);
    const color = done
      ? "#10b981"
      : remainingH < 0
        ? "#dc2626"
        : remainingH <= 48
          ? "#dc2626"
          : remainingH <= 120
            ? "#d97706"
            : "#0f766e";
    return {
      name,
      due,
      remainingH: done ? 0 : Math.max(remainingH, 0),
      totalH: Math.round((due - start) / HOUR),
      color,
      label: done ? "done" : remainingH < 0 ? "OVERDUE" : `${remainingH}h`,
      done,
    };
  };
  return [
    mk("provisional credit (bd10)", c.provisionalCreditDue, DAY0_EPOCH, pcDone),
    mk("investigation day45 (POS→90)", c.day45, DAY0_EPOCH, resultSent),
    mk("outer limit day90 POS debit", c.day90, DAY0_EPOCH, resultSent),
  ];
}

export function ClockBoard({ state }: { state: CaseStateType }) {
  const loadScenario = useCaseStore((s) => s.loadScenario);
  const rows = rowsFor(state);
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[11px] text-faint" data-id="s3.clockboard">
        no open Reg E disputes in this case — load the dispute case from the dev panel
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s3.clockboard">
      <h3 className="text-[12px] font-semibold text-navy">Statutory clock board · Reg E</h3>
      <p className="text-[10px] text-faint">
        red &lt; 48 calendar hours · amber &lt; 5 days · dates are arithmetic, never model judgment
      </p>
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 40, right: 48 }}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 10 }} />
            <Bar dataKey="remainingH" radius={[3, 3, 3, 3]} barSize={18}>
              {rows.map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
              <LabelList
                dataKey="label"
                position="right"
                style={{ fontSize: 10, fontFamily: "monospace" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="mt-2 w-full text-[10.5px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-line">
              <td className="py-1 text-gray-700">{r.name}</td>
              <td className="py-1 font-mono text-faint">due {format(new Date(r.due), "MM/dd")}</td>
              <td className="py-1 text-right">
                <button
                  onClick={() => loadScenario("email2")}
                  className="text-teal underline"
                  data-id="s3.clock.open"
                >
                  open case
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
