// TricolorLetter — the signature three-segment outbound (Dev Plan §7.1):
// blue = fixed compliance template, green = system slot, purple = AI bridge.
// Audit view shows the source of every sentence on hover.
import type { Draft } from "@/runtime/caseState.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const SECTION_STYLE: Record<string, string> = {
  template: "border-l-4 border-blue-400 bg-blue-50 text-blue-950",
  slot: "border-l-4 border-emerald-500 bg-emerald-50 text-emerald-950",
  ai: "border-l-4 border-violet-500 bg-violet-50 text-violet-950",
};

const SECTION_DOT: Record<string, string> = {
  template: "bg-blue-500",
  slot: "bg-emerald-500",
  ai: "bg-violet-500",
};

export function TricolorLetter({
  draft,
  audit = false,
}: {
  draft: Draft;
  audit?: boolean;
}) {
  const { t } = useTranslation("customer");
  return (
    <div className="space-y-1.5">
      {draft.lockedTemplate && (
        <div className="mb-2 inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
          {t("legend.lockedTemplate")}
        </div>
      )}
      {draft.sections.map((s, i) => (
        <p
          key={i}
          title={audit ? s.source : undefined}
          className={cn(
            "whitespace-pre-wrap rounded-r px-2.5 py-1.5 text-[12.5px] leading-relaxed",
            SECTION_STYLE[s.kind],
            audit && "cursor-help",
          )}
        >
          {audit && (
            <span
              className={cn(
                "mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle",
                SECTION_DOT[s.kind],
              )}
            />
          )}
          {s.textEn}
          {audit && (
            <span className="mt-0.5 block font-mono text-[9.5px] opacity-55">
              {s.kind} · {s.source}
            </span>
          )}
        </p>
      ))}
    </div>
  );
}

export function LetterLegend() {
  const { t } = useTranslation("customer");
  const items = [
    ["template", "bg-blue-500", t("legend.template")],
    ["slot", "bg-emerald-500", t("legend.slot")],
    ["ai", "bg-violet-500", t("legend.ai")],
  ] as const;
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-faint">
      {items.map(([kind, cls, label]) => (
        <span key={kind} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-sm ${cls}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
