// WavesPanel — FR-12.2 Wave Board (PRD v0.3 §6.6 Sense→Propose→Prove→Grant→
// Watch). Sense layer for the inbox: processing funnel + PSI + preventable
// rate, then the three wave severities. P0 ratchet and P1 remediation write
// through designTimeStore; AI proposes, the supervisor grants.
import { useEffect, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Activity, ShieldAlert, Sparkles } from "lucide-react";
import { INBOX_FUNNEL } from "@/mocks/fixtures/designTime.ts";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { P0Wave } from "./waves/P0Wave";
import { P1Wave } from "./waves/P1Wave";
import { P2Wave } from "./waves/P2Wave";

function FunnelStrip() {
  const { t } = useTranslation("supervisor");
  const f = INBOX_FUNNEL;
  const cells = [
    { k: "arrived", v: f.arrived },
    { k: "triaged", v: f.triaged },
    { k: "waitingCustomer", v: f.waitingCustomer },
    { k: "waitingApproval", v: f.waitingApproval },
    { k: "done", v: f.done },
  ];
  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s3.waves.funnel">
      <h3 className="text-[15px] font-semibold text-navy">{t("waves.funnel.title")}</h3>
      <div className="mt-2 grid grid-cols-5 gap-2">
        {cells.map((c) => (
          <div key={c.k} className="rounded-md border border-line bg-paper px-2 py-1.5 text-center">
            <div className="font-mono text-[20px] font-bold leading-none text-navy">
              {c.v.toLocaleString()}
            </div>
            <div className="mt-1 text-[12px] text-faint">{t(`waves.funnel.${c.k}`)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-sky-200 bg-sky-50/60 px-2.5 py-1.5" data-id="s3.waves.psi">
          <span className="text-[12.5px] font-semibold text-navy">
            {t("waves.funnel.psi")}:{" "}
          </span>
          <span className="font-mono text-[13px] font-bold text-sky-800">{f.psi.toFixed(2)}</span>
          <span className="ml-1 text-[12px] text-faint">{t("waves.funnel.psiHint")}</span>
        </div>
        <div
          className="rounded-md border border-violet-200 bg-violet-50/60 px-2.5 py-1.5"
          data-id="s3.waves.preventable"
        >
          <span className="text-[12.5px] font-semibold text-navy">
            {t("waves.funnel.preventable")}:{" "}
          </span>
          <span className="font-mono text-[13px] font-bold text-violet-800">
            {f.preventableRatePct}%
          </span>
          <span className="ml-1 text-[12px] text-faint">{t("waves.funnel.preventableHint")}</span>
        </div>
      </div>
    </div>
  );
}

export function WavesPanel() {
  const { t } = useTranslation("supervisor");
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => designTimeStore.subscribe(bump), []);
  const waves = designTimeStore.getWaves();

  return (
    <div className="flex flex-col gap-2" data-id="s3.waves">
      <FunnelStrip />
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-navy">
          <Activity size={15} className="text-teal" /> {t("waves.title")}
        </h3>
        <p className="text-[12.5px] text-faint">{t("waves.subtitle")}</p>
        <div className="mt-2 flex flex-col gap-2">
          <P0Wave wave={waves.find((w) => w.id === "WAVE-P0")!} />
          <P1Wave wave={waves.find((w) => w.id === "WAVE-P1")!} />
          <P2Wave wave={waves.find((w) => w.id === "WAVE-P2")!} />
        </div>
      </div>
      <div className="flex items-start gap-1.5 rounded-lg border border-line bg-paper p-2.5 text-[12.5px] text-gray-700">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-teal" />
        <span>{t("waves.note")}</span>
        <Sparkles size={13} className="mt-0.5 shrink-0 text-faint" />
      </div>
    </div>
  );
}
