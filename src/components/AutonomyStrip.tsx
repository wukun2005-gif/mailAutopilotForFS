// AutonomyStrip — the open case's own row of the three-dimensional autonomy
// matrix (PRD §6.2, differentiator D1), rendered in the customer's audit view.
//
// Why it exists: the matrix is the product's core claim, and a caption that
// only says "R2 × I1 is locked" gives the audience nothing to look at. This
// strip is the same table, reduced to the one row this case is in: the four
// identity columns, the column the case is actually in marked, and the verdict
// that column yields. When the customer's identity is re-rated, the marker
// moves and the verdict changes — the before/after of the gate is on screen,
// not in the narration.
//
// Fidelity: the active cell is the verdict the runtime actually applied (read
// from the case state); the other three columns are computed by the same
// decideCell() the runtime uses, through the same input builder, so this
// cannot drift into showing a different answer than the one that was applied.
//
// Spotlight: clock-driven approvals (provisional credit, adjudication) surface
// intents the email turns never decide, and matrix verdicts only recompute on
// email turns — so while such an approval is pending the strip shows ITS row
// (with the approval's level as the awaited verdict) instead of staying frozen
// on the last email row. Email-intent approvals keep the latest-decision row,
// so scripted audit beats never move.
import { decideCell } from "@/runtime/gates.ts";
import { autonomyInput, IDENTITY_COLUMNS, pickSpotlightApproval } from "@/runtime/autonomyView.ts";
import { intentSpec, graduatedLevel } from "@/runtime/intentRegistry.ts";
import type { CaseStateType } from "@/runtime/caseState.ts";
import type { CellValue, ILevel } from "@/runtime/state.ts";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function cellLabel(
  cell: CellValue,
  t: (k: string, o?: Record<string, unknown>) => string,
): { head: string; sub: string } {
  if (cell.kind === "never") return { head: t("cell.never"), sub: t("cell.neverSub") };
  if (cell.kind === "deny") return { head: t("cell.deny"), sub: t("cell.denySub") };
  return {
    head: cell.level,
    sub: t(`customer:trace.levels.${cell.level}`, { defaultValue: cell.level }),
  };
}

const TONE: Record<string, string> = {
  never: "bg-gray-100 text-gray-500",
  deny: "bg-red-50 text-red-700 ring-1 ring-red-200",
  L1: "bg-amber-100 text-amber-900",
  L2: "bg-sky-100 text-sky-900",
  L3: "bg-teal text-white",
};

export function AutonomyStrip({ state }: { state: CaseStateType }) {
  const { t } = useTranslation("customer");
  // The latest decision is the one the case is currently living under.
  // Before the case has run its first email the checkpoint holds no decisions
  // at all (caseState is still empty), so this reads as "no row yet" instead of
  // throwing — an unguarded throw here unmounts the whole screen.
  const decisions = state.decisions ?? [];
  const decision = decisions[decisions.length - 1];
  const spot = pickSpotlightApproval(state);
  if (!decision && !spot) return null;
  const rowIntent = spot ? spot.intentCode : decision!.intentCode;
  const rowRisk = spot ? spot.risk : intentSpec(decision!.intentCode).risk;
  // Third axis: the graduation ceiling for this intent (null = never graduated).
  const cap = graduatedLevel(rowIntent);
  const current = state.identity?.level ?? "I0";
  const emailId = decision?.sourceEmailId ?? state.currentEmailId ?? null;
  const base = autonomyInput(state, rowIntent, rowRisk, emailId);

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s1.autonomy">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold text-navy">{t("matrix.stripTitle")}</span>
        <span className="truncate text-[12px] text-faint">
          {t(`builder:matrix.risk.${rowRisk}`, { defaultValue: rowRisk })}
        </span>
      </div>
      {/* The third axis, without which the strip only draws two of the three:
          how far this intent is ALLOWED to go at all (graduation). */}
      <div
        className="mt-1 flex items-baseline justify-between gap-2"
        data-id="s1.autonomy.cap"
      >
        <span className="text-[11.5px] text-faint">{t("matrix.capLabel")}</span>
        <span className="font-mono text-[12px] font-semibold text-navy">
          {cap !== null
            ? t("matrix.capSome", { level: cap })
            : spot
              ? t("matrix.capFixed", { level: spot.lLevel })
              : t("matrix.capNone")}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1">
        {IDENTITY_COLUMNS.map((col: ILevel) => {
          // The case's own column shows the applied verdict, not a recompute —
          // unless a spotlight approval is pending for this row, in which case
          // the approval's level is what the case is actually waiting on.
          let head: string;
          let sub: string;
          let tone: string;
          if (spot && col === current) {
            head = spot.lLevel;
            sub = t("matrix.awaitingApproval");
            tone = spot.lLevel;
          } else {
            const cell =
              col === current && decision
                ? decision.cell
                : decideCell({ ...base, identity: col }).cell;
            const labeled = cellLabel(cell, t as (k: string, o?: Record<string, unknown>) => string);
            head = labeled.head;
            sub = labeled.sub;
            tone = cell.kind === "L" ? cell.level : cell.kind;
          }
          const active = col === current;
          return (
            <div
              key={col}
              data-id={`s1.autonomy.cell.${col}`}
              className={cn(
                "rounded border px-1 py-1.5 text-center leading-tight",
                active ? "border-teal ring-2 ring-teal/40" : "border-line",
                !active && "opacity-55",
              )}
            >
              <div className="font-mono text-[12px] font-semibold text-ink">{col}</div>
              <div
                className={cn(
                  "mt-0.5 inline-block rounded px-1 py-px text-[12px] font-semibold leading-tight",
                  TONE[tone],
                )}
              >
                {head}
              </div>
              <div className="text-[10.5px] leading-tight text-soft">{sub}</div>
              {active && (
                <div className="mt-1 inline-block rounded bg-teal px-1 py-px text-[10.5px] font-semibold text-white">
                  {t("matrix.thisCase")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
