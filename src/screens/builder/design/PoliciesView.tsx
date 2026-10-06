// PoliciesView — FR-12.3 Policy Compiler. Natural-language / doc / regulatory
// inputs compile to human-readable clause + machine-readable rule side by
// side, with blast radius (stale templates, 90-day flipped cases, AI dissent
// cards, cohort impact). Closed-world: a rule needing a field outside the
// evidence schema is refused; regulatory summaries yield a checklist only.
import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDiff, FileText, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { CompilationArtifact } from "./CompilationArtifact";

const PRESETS = [
  { id: "COMP-1", icon: FileDiff },
  { id: "COMP-2", icon: FileText },
  { id: "COMP-3", icon: ScrollText },
] as const;

export function PoliciesView() {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [selected, setSelected] = useState<string>("COMP-1");
  useEffect(() => designTimeStore.subscribe(bump), []);
  const compilations = designTimeStore.getCompilations();
  const current = compilations.find((c) => c.id === selected) ?? compilations[0];

  return (
    <div className="flex flex-col gap-2 pb-16">
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="text-[15px] font-semibold text-navy">{t("design.pol.title")}</h3>
        <p className="text-[12.5px] text-faint">{t("design.pol.subtitle")}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              data-id={`s4.pol.example.${id}`}
              onClick={() => setSelected(id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[12.5px] font-semibold",
                selected === id ? "border-navy bg-navy text-white" : "border-line bg-paper text-navy hover:bg-white",
              )}
            >
              <Icon size={13} /> {t(`design.pol.preset.${id}`)}
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-md border border-line bg-paper px-2.5 py-2 font-mono text-[12.5px] text-navy" data-id={`s4.pol.input.${current.id}`}>
          {current.inputText[lang]}
        </div>
      </div>
      <CompilationArtifact c={current} />
    </div>
  );
}
