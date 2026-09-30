// Screen 4 — Builder: backtest & graduation (Dev Plan §7.4).
// Left: intent list with graduation status. Right: matrix, replay, sampling,
// readiness report, conformal card. Sign-off and manual caps write through to
// graduationOverrides, so the SAME runtime used by the other three screens
// changes level for the next inbound email immediately.
import { useEffect, useReducer, useState } from "react";
import { Lock, GraduationCap, Eye, PauseCircle } from "lucide-react";
import { GRADUATION_TABLE } from "@/mocks/fixtures/index.ts";
import type { GraduationEntry } from "@/mocks/fixtures/index.ts";
import { graduationOverrides } from "@/runtime/graduationOverrides.ts";
import { AutonomyMatrix } from "./builder/AutonomyMatrix";
import { BacktestRunner } from "./builder/BacktestRunner";
import { SamplingPanel } from "./builder/SamplingPanel";
import { ReadinessReport } from "./builder/ReadinessReport";
import { ConformalCard } from "./builder/ConformalCard";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function BuilderScreen() {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const STATUS_META: Record<
    GraduationEntry["status"],
    { label: string; cls: string; icon: typeof Lock }
  > = {
    graduated: { label: t("status.graduated"), cls: "bg-teal-soft text-teal", icon: GraduationCap },
    shadow: { label: t("status.shadow"), cls: "bg-sky-100 text-sky-900", icon: Eye },
    rare_hold: { label: t("status.rare_hold"), cls: "bg-amber-100 text-amber-900", icon: PauseCircle },
    never: { label: t("status.never"), cls: "bg-gray-200 text-gray-600", icon: Lock },
  };
  const [selectedCode, setSelectedCode] = useState("reg_e_intake");
  const [negativeColumn, setNegativeColumn] = useState(true);
  const [rev, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => graduationOverrides.subscribe(bump), []);

  const selected =
    GRADUATION_TABLE.find((g) => g.intentCode === selectedCode) ?? GRADUATION_TABLE[0];
  const override = graduationOverrides.get(selected.intentCode);
  // Human-facing notice params: intent name + level code paired with its gloss.
  const levelTag = (lv: string) =>
    `${lv} · ${t("customer:trace.levels." + lv, { defaultValue: lv })}`;

  return (
    <div className="grid h-full grid-cols-[260px_1fr] gap-2 overflow-hidden p-2">
      {/* Left: intent list */}
      <div className="min-h-0 overflow-y-auto rounded-lg border border-line bg-white p-2" data-id="s4.intents">
        <h2 className="px-1 text-[14px] font-semibold uppercase tracking-wide text-faint">
          {t("intentsTitle")}
        </h2>
        <ul className="mt-1 space-y-1">
          {GRADUATION_TABLE.map((g) => {
            const meta = STATUS_META[g.status];
            const Icon = meta.icon;
            const active = g.intentCode === selectedCode;
            return (
              <li key={g.intentCode}>
                <button
                  data-id={`s4.intent.${g.intentCode}`}
                  onClick={() => setSelectedCode(g.intentCode)}
                  className={cn(
                    "w-full rounded px-2 py-1.5 text-left",
                    active ? "bg-navy text-white" : "hover:bg-paper",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "text-[13px] font-semibold",
                        active ? "text-white" : "text-navy",
                      )}
                    >
                      {g.label[lang]}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[12px] font-semibold",
                        active ? "bg-white/20 text-white" : meta.cls,
                      )}
                    >
                      <Icon size={9} /> {meta.label}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Right: report stack */}
      <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
        <AutonomyMatrix selected={selected} rev={rev} onDowngrade={(lvl) => graduationOverrides.cap(selected.intentCode, lvl)} />
        {override?.cap && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-[13.5px] text-amber-900" data-id="s4.cap.notice">
            {t("capNotice", { intent: selected.label[lang], level: levelTag(override.cap) })}
            <button
              className="ml-2 underline"
              onClick={() => graduationOverrides.clearCap(selected.intentCode)}
            >
              {t("clearCap")}
            </button>
          </div>
        )}
        {override?.promotedTo && (
          <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[13.5px] text-emerald-900" data-id="s4.promote.notice">
            {t("promoteNotice", { intent: selected.label[lang], level: levelTag(override.promotedTo) })}
          </div>
        )}
        <BacktestRunner selectedIntent={selected.intentCode} />
        <SamplingPanel
          negativeColumnPresent={negativeColumn}
          onToggleNegative={setNegativeColumn}
        />
        <ReadinessReport
          entry={selected}
          negativeColumnPresent={negativeColumn}
          onPromote={() => graduationOverrides.promote(selected.intentCode, "L3")}
        />
        {selected.status === "rare_hold" && <ConformalCard />}
      </div>
    </div>
  );
}
