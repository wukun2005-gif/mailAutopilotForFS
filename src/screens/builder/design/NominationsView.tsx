// NominationsView — FR-12.1 Graduation Nominations. AI nominates with four
// proofs (consistency, calc/judgment split, approver variance, cohort parity);
// humans fix, shadow, dual-sign and grant. R3/R4 rows are shown greyed and
// explicitly never nominated.
import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { NominationCard } from "./NominationCard";

export function NominationsView() {
  const { t } = useTranslation("builder");
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => designTimeStore.subscribe(bump), []);
  const nominations = designTimeStore.getNominations();
  const active = nominations.filter((n) => !n.neverNominated);
  const never = nominations.filter((n) => n.neverNominated);

  return (
    <div className="flex flex-col gap-2 pb-16">
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="text-[15px] font-semibold text-navy">{t("design.nom.title")}</h3>
        <p className="text-[12.5px] text-faint">{t("design.nom.subtitle")}</p>
      </div>
      {active.map((n) => (
        <NominationCard
          key={n.id}
          n={n}
          fixed={n.kind === "fix_template" && n.state !== "fix_first"}
        />
      ))}
      <div className="rounded-lg border border-line bg-paper p-3">
        <h4 className="text-[13px] font-semibold uppercase tracking-wide text-faint">
          {t("design.nom.neverTitle")}
        </h4>
        <div className="mt-1.5 flex flex-col gap-2">
          {never.map((n) => (
            <NominationCard key={n.id} n={n} fixed={false} />
          ))}
        </div>
      </div>
    </div>
  );
}
