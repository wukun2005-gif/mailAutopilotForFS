// ClockBoard — FR-8.2 / FR-4.2: statutory clocks. Two layers:
//   1. the loaded case's three Reg E clocks as bars (recharts), and
//   2. the TOTAL board — every open Reg E dispute in the mailbox, so the
//      board is never scoped to whichever case the operator has open
//      (roadmap Phase 2 "时钟看板全量").
// Red under 48h, amber under 5 days. 10/20 are business-day milestones,
// 45/90 calendar days. All dates are arithmetic from arrival, never a
// model judgment.
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, LabelList } from "recharts";
import { regEClocks, addCalendarDays, DAY0_EPOCH, simClock } from "@/runtime/simClock.ts";
import type { CaseStateType } from "@/runtime/caseState.ts";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { OPEN_DISPUTES } from "@/mocks/fixtures/index.ts";

const HOUR = 3_600_000;

interface Row {
  name: string;
  nameKey: string;
  /** undefined = a promise with no deadline (shown in the table, not the bar chart). */
  due?: number;
  remainingH: number;
  totalH: number;
  color: string;
  label: string;
  done: boolean;
}

function tone(remainingH: number, done: boolean): string {
  if (done) return "#10b981";
  if (remainingH < 0) return "#dc2626";
  if (remainingH <= 48) return "#dc2626";
  if (remainingH <= 120) return "#d97706";
  return "#0f766e";
}

function rowsFor(state: CaseStateType, t: (k: string, o?: Record<string, unknown>) => string): Row[] {
  const rows: Row[] = [];
  const now = simClock.now();
  if (state.scenarioId === "email2") {
    const c = regEClocks(DAY0_EPOCH);
    const pcDone = (state.actions ?? []).some(
      (a) => a.actionType === "reg_e_provisional_credit" && a.status === "done",
    );
    const resultSent = (state.outbound ?? []).some((o) => o.draftId?.startsWith("DR-RESULT"));
    const mk = (
      name: string,
      nameKey: string,
      due: number,
      start: number,
      done: boolean,
    ): Row => {
      const remainingH = Math.round((due - now) / HOUR);
      return {
        name,
        nameKey,
        due,
        remainingH: done ? 0 : Math.max(remainingH, 0),
        totalH: Math.round((due - start) / HOUR),
        color: tone(remainingH, done),
        label: done ? t("clockboard.done") : remainingH < 0 ? t("clockboard.overdue") : t("clockboard.hours", { count: remainingH }),
        done,
      };
    };
    rows.push(
      mk("provisional credit (deadline)", "clockboard.pc", c.provisionalCreditDue, DAY0_EPOCH, pcDone),
      mk("investigation day45 (POS cases use day90)", "clockboard.day45", c.day45, DAY0_EPOCH, resultSent),
      mk("outer limit day90 for POS debit", "clockboard.day90", c.day90, DAY0_EPOCH, resultSent),
    );
  }
  // FR-1.5 对客承诺时钟（任何场景）：兑现绿色、逾期红、临期琥珀——与法定
  // 时钟同一套阈值、同一块板；labelKey 即承诺的展示名（i18n key）。
  // 无到期日的承诺（如"转人工复核"）只进表格：没有倒计时就没有条形。
  for (const p of state.promiseClocks ?? []) {
    const done = !!p.fulfilledAt;
    if (p.dueAt == null) {
      rows.push({
        name: p.labelKey,
        nameKey: p.labelKey,
        remainingH: 0,
        totalH: 0,
        color: done ? "#10b981" : "#d97706",
        label: done ? t("clockboard.done") : t("clockboard.noDue"),
        done,
      });
      continue;
    }
    const remainingH = Math.round((p.dueAt - now) / HOUR);
    rows.push({
      name: p.labelKey,
      nameKey: p.labelKey,
      due: p.dueAt,
      remainingH: done ? 0 : Math.max(remainingH, 0),
      totalH: Math.max(remainingH, 0),
      color: tone(remainingH, done),
      label: done
        ? t("clockboard.done")
        : remainingH < 0
          ? t("clockboard.overdue")
          : t("clockboard.hours", { count: remainingH }),
      done,
    });
  }
  return rows;
}

export function ClockBoard({ state }: { state: CaseStateType }) {
  const { t, i18n } = useTranslation("supervisor");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  // Open the case dossier (agent screen). Never reload the scenario here:
  // loadScenario resets the case, wiping progress and leaving an empty state.
  const setScreen = useUIStore((s) => s.setScreen);
  const rows = rowsFor(state, t);
  // Bars need a due date; deadline-less promises show up in the table only.
  const chartRows = rows.filter((r) => r.due != null);
  const now = simClock.now();

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s3.clockboard">
      <h3 className="text-[15px] font-semibold text-navy">{t("clockboard.title")}</h3>
      <p className="text-[13px] text-faint">{t("clockboard.subtitle")}</p>

      {rows.length === 0 ? (
        <p className="mt-2 rounded border border-dashed border-line px-3 py-4 text-center text-[13px] text-faint">
          {t("clockboard.empty")}
        </p>
      ) : (
        <>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ left: 40, right: 48 }}>
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={200}
                  tick={{ fontSize: 13 }}
                  tickFormatter={(v: string) =>
                    t(rows.find((r) => r.name === v)?.nameKey ?? "", { defaultValue: v })
                  }
                />
                <Bar dataKey="remainingH" radius={[3, 3, 3, 3]} barSize={18}>
                  {rows.map((r) => (
                    <Cell key={r.name} fill={r.color} />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="right"
                    style={{ fontSize: 13, fontFamily: "monospace" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-2 w-full text-[13.5px]">
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-line">
                  <td className="py-1 text-gray-700">{t(r.nameKey)}</td>
                  <td className="py-1 font-mono text-faint">
                    {r.due != null
                      ? t("clockboard.due", { date: format(new Date(r.due), "MM/dd") })
                      : t("clockboard.noDue")}
                  </td>
                  <td className="py-1 text-right">
                    <button
                      onClick={() => setScreen("agent")}
                      className="text-teal underline"
                      data-id="s3.clock.open"
                    >
                      {t("clockboard.openCase")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Total board: every open Reg E dispute, not just the loaded case. */}
      <div className="mt-3" data-id="s3.clockboard.all">
        <h4 className="text-[14px] font-semibold text-navy">
          {t("clockboard.allTitle", { count: OPEN_DISPUTES.length })}
        </h4>
        <p className="text-[12.5px] text-faint">{t("clockboard.allNote")}</p>
        <table className="mt-1 w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line text-left text-faint">
              <th className="py-1">{t("clockboard.case")}</th>
              <th className="py-1">{t("clockboard.subject")}</th>
              <th className="py-1">{t("clockboard.arrived")}</th>
              <th className="py-1">{t("clockboard.pcState")}</th>
              <th className="py-1">{t("clockboard.investigation")}</th>
              <th className="py-1 text-right">{t("clockboard.remaining")}</th>
              <th className="py-1">{t("clockboard.stage")}</th>
            </tr>
          </thead>
          <tbody>
            {OPEN_DISPUTES.map((d) => {
              const arrived = addCalendarDays(DAY0_EPOCH, d.arrivedDayOffset);
              const c = regEClocks(arrived);
              const due = d.branch === "pos_debit_90d" ? c.day90 : c.day45;
              const remainingH = Math.round((due - now) / HOUR);
              const overdue = remainingH < 0;
              const isCurrent = d.caseRef === state.caseId;
              return (
                <tr
                  key={d.caseRef}
                  className={cn("border-t border-line", isCurrent && "bg-teal-soft")}
                >
                  <td className="whitespace-nowrap py-1 pr-2 font-mono text-navy">
                    {d.caseRef}
                    {isCurrent && (
                      <span className="ml-1 rounded bg-teal px-1 text-[11px] font-semibold text-white">
                        {t("clockboard.current")}
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-2 text-gray-700">{d.subject[lang]}</td>
                  <td className="py-1 pr-2 font-mono text-faint">
                    {format(new Date(arrived), "MM/dd")}
                  </td>
                  <td className="py-1 pr-2">
                    {d.branch === "pos_debit_90d"
                      ? t("clockboard.branch90")
                      : t("clockboard.branch45")}
                    {" · "}
                    {d.provisionalCredit === "posted"
                      ? t("clockboard.pcPosted")
                      : d.provisionalCredit === "pending"
                        ? t("clockboard.pcPending")
                        : t("clockboard.pcNone")}
                  </td>
                  <td className="py-1 pr-2 font-mono text-faint">
                    {format(new Date(due), "MM/dd")}
                  </td>
                  <td
                    className={cn(
                      "py-1 pr-2 text-right font-mono",
                      overdue
                        ? "font-bold text-red-700"
                        : remainingH <= 48
                          ? "text-red-700"
                          : remainingH <= 120
                            ? "text-amber-700"
                            : "text-faint",
                    )}
                  >
                    {overdue
                      ? t("clockboard.overdue")
                      : t("clockboard.days", { count: Math.round(remainingH / 24) })}
                  </td>
                  <td className="py-1 text-gray-700">{d.stage[lang]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
