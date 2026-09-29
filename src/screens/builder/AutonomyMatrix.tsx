// AutonomyMatrix — R (action risk) × I (identity assurance) grid, FR-3.1/9.3.
// Cells are computed by the SAME decideCell() pure function the runtime uses;
// the Builder cannot open a cell the config layer cannot reach: R3 is a hard
// never with no registered tool, R4 is permanently L0/L1 human.
import { Lock, Ban, MousePointerClick } from "lucide-react";
import { decideCell } from "@/runtime/gates.ts";
import { graduatedLevel } from "@/runtime/intentRegistry.ts";
import { graduationOverrides } from "@/runtime/graduationOverrides.ts";
import { GRADUATION_TABLE } from "@/mocks/fixtures/index.ts";
import type { CellValue, ILevel, LLevel, RLevel } from "@/runtime/state.ts";
import type { GraduationEntry } from "@/mocks/fixtures/index.ts";
import { cn } from "@/lib/utils";

const RISKS: RLevel[] = ["R0", "R1", "R2", "R3", "R4"];
const IDENTITIES: ILevel[] = ["I0", "I1", "I2", "I3"];

// Representative graduated intent per risk row (used to render non-active rows).
const ROW_INTENT: Record<RLevel, string> = {
  R0: "general_inquiry",
  R1: "card_delivery_status",
  R2: "od_fee_refund",
  R3: "contact_detail_change",
  R4: "reg_e_adjudication",
};

const RISK_LABEL: Record<RLevel, string> = {
  R0: "R0 · public info",
  R1: "R1 · read account data",
  R2: "R2 · reversible writes",
  R3: "R3 · high-impact changes",
  R4: "R4 · adjudication / money movement",
};

const L_COLOR: Record<LLevel, string> = {
  L0: "bg-gray-200 text-gray-600",
  L1: "bg-amber-100 text-amber-900",
  L2: "bg-sky-100 text-sky-900",
  L3: "bg-teal text-white",
};

function CellView({
  cell,
  active,
  shadow,
  capped,
  onClick,
  title,
}: {
  cell: CellValue;
  active: boolean;
  shadow: boolean;
  capped: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const base =
    "relative flex h-14 flex-col items-center justify-center rounded text-[10px] leading-tight";
  if (cell.kind === "never") {
    return (
      <div
        data-id="s4.matrix.never"
        className={cn(base, "cursor-not-allowed bg-gray-100 text-gray-400 line-through")}
        title="Never automated in the email channel: disabled in config AND no tool function exists"
      >
        <Ban size={12} />
        never
      </div>
    );
  }
  if (cell.kind === "deny") {
    return (
      <div
        className={cn(base, "bg-red-50 text-red-700 ring-1 ring-red-200")}
        title="AI neither generates nor executes content; locked step-up template only"
      >
        <Lock size={11} />
        locked
      </div>
    );
  }
  const clickable = active && (cell.level === "L3" || cell.level === "L2");
  return (
    <button
      data-id="s4.matrix.cell"
      onClick={clickable ? onClick : undefined}
      title={title}
      className={cn(
        base,
        L_COLOR[cell.level],
        active ? "ring-2 ring-navy/30" : "opacity-60",
        clickable && "cursor-pointer hover:ring-2 hover:ring-navy",
      )}
    >
      <span className="font-mono text-[12px] font-bold">
        {cell.level}
        {shadow && <Lock size={9} className="ml-0.5 inline" />}
      </span>
      {shadow && <span>shadow · sign to unlock</span>}
      {capped && <span className="text-[8.5px]">manual cap</span>}
      {clickable && !shadow && (
        <MousePointerClick size={9} className="absolute right-1 top-1 opacity-60" />
      )}
    </button>
  );
}

export function AutonomyMatrix({
  selected,
  onDowngrade,
  rev,
}: {
  selected: GraduationEntry;
  onDowngrade: (level: LLevel) => void;
  rev: number;
}) {
  void rev; // re-render trigger from override subscriptions
  const displayLevel = (intentCode: string, row: GraduationEntry | undefined): LLevel | null => {
    if (row && row.status === "shadow" && !graduationOverrides.get(intentCode)?.promotedTo) {
      return row.graduatedL; // show the shadow launch level with a lock
    }
    return graduatedLevel(intentCode);
  };

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s4.matrix">
      <h3 className="text-[12px] font-semibold text-navy">Autonomy matrix · R × I</h3>
      <p className="text-[10px] text-faint">
        same decideCell() as production · click an active L3/L2 cell to cap it · R3/R4 cells do not
        respond — the config layer cannot reach them
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr>
              <th className="w-44" />
              {IDENTITIES.map((i) => (
                <th key={i} className="pb-1 font-mono text-[10px] text-faint">
                  {i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RISKS.map((r) => {
              const intentCode = r === selected.risk ? selected.intentCode : ROW_INTENT[r];
              const row = GRADUATION_TABLE.find((g) => g.intentCode === intentCode);
              const active = r === selected.risk;
              const level = displayLevel(intentCode, row);
              const override = graduationOverrides.get(intentCode);
              return (
                <tr key={r} className={cn(!active && "text-faint")}>
                  <td className="pr-2 text-right text-[9.5px] font-medium text-gray-600">
                    {RISK_LABEL[r]}
                    {active && <div className="font-mono text-[8.5px] text-teal">{intentCode}</div>}
                  </td>
                  {IDENTITIES.map((i) => {
                    const decision = decideCell({
                      intentCode,
                      risk: r,
                      identity: i,
                      policyOverall: "PASS",
                      graduatedL: level,
                    });
                    return (
                      <td key={i} className="p-0.5">
                        <CellView
                          cell={decision.cell}
                          active={active}
                          shadow={!!(active && row?.status === "shadow" && !override?.promotedTo)}
                          capped={!!override?.cap}
                          onClick={() => {
                            if (decision.cell.kind === "L") {
                              onDowngrade(decision.cell.level === "L3" ? "L2" : "L1");
                            }
                          }}
                          title={decision.reasonCodes.join(" · ")}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[9.5px] text-faint">
        <span className="inline-flex items-center gap-1"><Lock size={10} /> locked template / shadow</span>
        <span className="inline-flex items-center gap-1"><Ban size={10} /> hard never: config + no tool</span>
        <span>R4 is permanently human L0 decide / L1 AI-drafts-human-signs</span>
      </div>
    </div>
  );
}
