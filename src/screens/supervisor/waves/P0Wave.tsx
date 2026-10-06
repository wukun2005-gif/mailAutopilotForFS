// P0 negative wave — one-click tightening pack (the ratchet): immediate
// effect, tighter-only, auto-expires after 24h. Loosening is deliberately
// absent from this UI; expiry restores the prior level automatically.
import { useTranslation } from "react-i18next";
import { Lock, CheckCircle2, ChevronDown } from "lucide-react";
import { designTimeStore } from "@/runtime/designTime/store.ts";
import { uncappedLevel } from "@/runtime/intentRegistry.ts";
import { GRADUATION_TABLE } from "@/mocks/fixtures/index.ts";
import { utcYmd } from "@/runtime/simClock.ts";
import type { Wave } from "@/runtime/designTime/types.ts";
import { Field, SeverityBadge, Sparkline } from "./waveUi";

export function P0Wave({ wave }: { wave: Wave }) {
  const { t, i18n } = useTranslation("supervisor");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const pack = wave.tightening!;
  const applied = wave.status === "tightening_applied" || wave.status === "resolved";

  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50/30 p-3"
      data-id={`s3.wave.${wave.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity="P0" />
            <h4 className="text-[14px] font-semibold text-navy">{wave.title[lang]}</h4>
          </div>
          <p className="mt-0.5 text-[12.5px] text-gray-700">{wave.signature[lang]}</p>
        </div>
        <Sparkline values={wave.volumeSeries} />
      </div>

      <div className="mt-1.5 rounded-md border border-line bg-white p-2">
        <Field label={t("waves.p0.samples")}>
          {wave.sampleSubjects.map((s, i) => (
            <div key={i} className="text-[12.5px] italic text-gray-600">
              “{s[lang]}”
            </div>
          ))}
        </Field>
        <Field label={t("waves.p0.pack")}>
          <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">
            <li>{pack.ackTemplate[lang]}</li>
            <li>{pack.ticket[lang]}</li>
            {pack.downgrades.map((d) => {
              // Name and "from" both come from the graduation table — the same
              // source the Builder board renders — so a pack can never promise a
              // level the admin board does not show for that intent.
              const row = GRADUATION_TABLE.find((g) => g.intentCode === d.intentCode);
              const from = uncappedLevel(d.intentCode);
              return (
                <li key={d.intentCode} data-id={`s3.waves.downgrade.${d.intentCode}`}>
                  {row?.label[lang] ?? d.intentLabel[lang]}:{" "}
                  <span className="font-mono font-semibold">
                    {from ?? t("waves.p0.notGraduated")} → {d.to}
                  </span>
                </li>
              );
            })}
          </ul>
        </Field>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {!applied ? (
          <button
            data-id={`s3.waves.tighten.${wave.id}`}
            onClick={() => designTimeStore.applyTightening(wave.id)}
            className="inline-flex items-center gap-1 rounded-md bg-red-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-red-800"
          >
            <ChevronDown size={14} /> {t("waves.p0.tightenBtn")}
          </button>
        ) : (
          <div
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-800"
            data-id={`s3.waves.applied.${wave.id}`}
          >
            <CheckCircle2 size={14} />
            {t("waves.p0.applied", {
              hours: pack.expiresHours,
              until: pack.expiresAt ? utcYmd(pack.expiresAt) : "",
            })}
          </div>
        )}
        <span className="inline-flex items-center gap-1 text-[12px] text-faint">
          <Lock size={12} /> {t("waves.p0.ratchetNote")}
        </span>
      </div>
    </div>
  );
}
