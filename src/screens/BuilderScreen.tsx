// Screen 4 — Builder: runtime graduation (M6) + design-time intelligence
// (M12, PRD v0.3 §6.6). View switch:
//   Graduation  — backtest, sampling, matrix, dual-sign promotion (runtime)
//   Nominations — FR-12.1 four-proofs graduation nominations
//   Policies    — FR-12.3 Policy Compiler (sentence/doc/regulatory → diff)
//   Intents     — FR-12.6 Intent Discovery candidates
// Sign-off and manual caps write through to graduationOverrides, so the SAME
// runtime used by the other screens changes level for the next inbound email.
import { useEffect, useReducer, useState } from "react";
import {
  Lock,
  GraduationCap,
  Eye,
  PauseCircle,
  Scale,
  GitCompareArrows,
  BellRing,
  Search,
} from "lucide-react";
import { GRADUATION_TABLE } from "@/mocks/fixtures/index.ts";
import type { GraduationEntry } from "@/mocks/fixtures/index.ts";
import { graduationOverrides } from "@/runtime/graduationOverrides.ts";
import { AutonomyMatrix } from "./builder/AutonomyMatrix";
import { BacktestRunner } from "./builder/BacktestRunner";
import { SamplingPanel } from "./builder/SamplingPanel";
import { ReadinessReport } from "./builder/ReadinessReport";
import { NominationsView } from "./builder/design/NominationsView";
import { PoliciesView } from "./builder/design/PoliciesView";
import { IntentsView } from "./builder/design/IntentsView";
import { PreemptView } from "./builder/design/PreemptView";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type BuilderView = "graduation" | "nominations" | "policies" | "preempt" | "intents";

export function BuilderScreen() {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const [view, setView] = useState<BuilderView>("graduation");
  const STATUS_META: Record<
    GraduationEntry["status"],
    { label: string; cls: string; icon: typeof Lock }
  > = {
    graduated: { label: t("status.graduated"), cls: "bg-teal-soft text-teal", icon: GraduationCap },
    shadow: { label: t("status.shadow"), cls: "bg-sky-100 text-sky-900", icon: Eye },
    rare_hold: { label: t("status.rare_hold"), cls: "bg-amber-100 text-amber-900", icon: PauseCircle },
    never: { label: t("status.never"), cls: "bg-gray-200 text-gray-600", icon: Lock },
  };
  // 默认选中"演示用影子态"：讲解影子→双签→提升的过程从这一行开始。
  const [selectedCode, setSelectedCode] = useState("reg_e_intake_demo");
  const [negativeColumn, setNegativeColumn] = useState(true);
  const [rev, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => graduationOverrides.subscribe(bump), []);

  const selected =
    GRADUATION_TABLE.find((g) => g.intentCode === selectedCode) ?? GRADUATION_TABLE[0];
  const override = graduationOverrides.get(selected.intentCode);
  // Human-facing notice params: intent name + level code paired with its gloss.
  const levelTag = (lv: string) =>
    `${lv} · ${t("customer:trace.levels." + lv, { defaultValue: lv })}`;

  const VIEWS: Array<{ id: BuilderView; label: string; icon: typeof Lock }> = [
    { id: "graduation", label: t("views.graduation"), icon: GraduationCap },
    { id: "nominations", label: t("views.nominations"), icon: Scale },
    { id: "policies", label: t("views.policies"), icon: GitCompareArrows },
    { id: "preempt", label: t("views.preempt"), icon: BellRing },
    { id: "intents", label: t("views.intents"), icon: Search },
  ];

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2">
      <div className="flex shrink-0 gap-1 rounded-lg border border-line bg-white p-1" data-id="s4.views">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            data-id={`s4.view.${id}`}
            onClick={() => setView(id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-[13px] font-semibold",
              view === id ? "bg-navy text-white" : "text-navy hover:bg-paper",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {view !== "graduation" && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === "nominations" && <NominationsView />}
          {view === "policies" && <PoliciesView />}
          {view === "preempt" && <PreemptView />}
          {view === "intents" && <IntentsView />}
        </div>
      )}

      {view === "graduation" && (
        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-2 overflow-hidden">
          {/* Left: intent list */}
          <div className="min-h-0 overflow-y-auto rounded-lg border border-line bg-white p-2" data-id="s4.intents">
            <h2 className="px-1 text-[14px] font-semibold uppercase tracking-wide text-faint">
              {t("intentsTitle")}
            </h2>
            <ul className="mt-1 space-y-1">
              {GRADUATION_TABLE.map((g) => {
                const ov = graduationOverrides.get(g.intentCode);
                const meta = ov?.promotedTo ? STATUS_META.graduated : STATUS_META[g.status];
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

          {/* Right: report stack. pb-16 = scroll room under the last panel. */}
          <div className="min-h-0 space-y-2 overflow-y-auto pr-1 pb-16">
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
            <div className="h-4" />
            <SamplingPanel
              negativeColumnPresent={negativeColumn}
              onToggleNegative={setNegativeColumn}
            />
            <ReadinessReport
              key={selected.intentCode}
              entry={selected}
              negativeColumnPresent={negativeColumn}
              onPromote={() => graduationOverrides.promote(selected.intentCode, "L3")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
