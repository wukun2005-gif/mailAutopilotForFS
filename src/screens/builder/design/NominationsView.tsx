// NominationsView — FR-12.1 Graduation Nominations. AI nominates with four
// proofs (consistency, calc/judgment split, approver variance, cohort parity);
// humans fix, shadow, dual-sign and grant. R3/R4 rows are shown greyed and
// explicitly never nominated.
import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Bird } from "lucide-react";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { NominationCard } from "./NominationCard";

export function NominationsView() {
  const { t } = useTranslation("builder");
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => designTimeStore.subscribe(bump), []);
  const nominations = designTimeStore.getNominations();
  const active = nominations.filter((n) => !n.neverNominated && n.kind !== "observation");
  const never = nominations.filter((n) => n.neverNominated);
  const observations = nominations.filter((n) => n.kind === "observation");
  const canary = designTimeStore.getCanary();

  return (
    <div className="flex flex-col gap-2 pb-16">
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="text-[15px] font-semibold text-navy">{t("design.nom.title")}</h3>
        <p className="text-[12.5px] text-faint">{t("design.nom.subtitle")}</p>
        <div
          className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[12.5px] text-violet-900"
          data-id="s4.nom.canaryLedger"
        >
          <Bird size={13} />
          <span className="font-semibold">
            {t("design.canary.hit", { caught: canary.caught, planted: canary.planted, rate: canary.hitRatePct })}
          </span>
          <span className="text-violet-700">{t("design.canary.hint")}</span>
        </div>
        {canary.missed && (
          <div
            className="mt-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-[12.5px] font-semibold text-red-700"
            data-id="s4.nom.bulkSuspended"
          >
            <AlertTriangle size={13} className="mr-1 inline" /> {t("design.canary.suspended")}
          </div>
        )}
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
      <div className="rounded-lg border border-line bg-paper p-3">
        <h4 className="text-[13px] font-semibold uppercase tracking-wide text-faint">
          {t("design.obs.title")}
        </h4>
        <div className="mt-1.5 flex flex-col gap-2">
          {observations.map((n) => (
            <NominationCard key={n.id} n={n} fixed={false} />
          ))}
        </div>
      </div>
    </div>
  );
}
