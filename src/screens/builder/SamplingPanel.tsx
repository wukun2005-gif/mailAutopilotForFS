// SamplingPanel — FR-3.3: three sampling tiers A/B/C across three intake
// frames, tier C reported separately (never mixed into recall stats), plus
// the detector-NEGATIVE re-label column without which recall is unsignable.
import { useState } from "react";
import {
  SAMPLE_TIERS,
  SAMPLING_FRAMES,
  NEGATIVE_RELABEL,
} from "@/mocks/fixtures/index.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function SamplingPanel({
  negativeColumnPresent,
  onToggleNegative,
}: {
  negativeColumnPresent: boolean;
  onToggleNegative: (v: boolean) => void;
}) {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const [showC, setShowC] = useState(true);
  const total = SAMPLE_TIERS.reduce((acc, t) => acc + t.size, 0);

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s4.sampling">
      <h3 className="text-[12px] font-semibold text-navy">{t("sampling.title")}</h3>

      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {SAMPLE_TIERS.map((tier) => (
          <div
            key={tier.tier}
            className={cn(
              "rounded border p-2 text-[10.5px]",
              tier.tier === "C" ? "border-red-300 bg-red-50/50" : "border-line",
            )}
          >
            <div className="font-semibold text-navy">{tier.label[lang]}</div>
            <div className="mt-0.5 text-[9.5px] text-faint">{tier.method[lang]}</div>
            <div className="mt-1 font-mono text-[11px]">n = {tier.size}</div>
            {tier.tier === "C" && (
              <label className="mt-1 flex items-center gap-1 text-[9.5px] text-red-800">
                <input type="checkbox" checked={showC} onChange={(e) => setShowC(e.target.checked)} />
                {t("sampling.reportSeparately")}
              </label>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[9.5px] text-faint">{t("sampling.total", { count: total })}</p>

      <table className="mt-2 w-full text-[10px]">
        <thead>
          <tr className="border-b border-line text-faint">
            <th className="py-1 text-left font-normal">{t("sampling.frame")}</th>
            <th className="font-normal">{t("sampling.tierA")}</th>
            <th className="font-normal">{t("sampling.tierB")}</th>
            <th className="font-normal">{t("sampling.tierC")}</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {SAMPLING_FRAMES.map((f) => (
            <tr key={f.code} className="border-b border-line/60">
              <td className="py-0.5 text-left font-sans">{f.label[lang]}</td>
              <td className="text-center">{f.tierA}</td>
              <td className="text-center">{f.tierB}</td>
              <td className={cn("text-center", !showC && "text-gray-300")}>
                {showC ? f.tierC : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className={cn(
          "mt-2 rounded border p-2 text-[10.5px]",
          negativeColumnPresent ? "border-teal/40 bg-teal-soft" : "border-red-300 bg-red-50",
        )}
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={negativeColumnPresent}
            onChange={(e) => onToggleNegative(e.target.checked)}
            data-id="s4.negative.toggle"
          />
          <span className="font-semibold">
            {t("sampling.negativeLabel", { count: NEGATIVE_RELABEL.sampleSize.toLocaleString() })}
          </span>
        </label>
        {negativeColumnPresent ? (
          <p className="mt-1 text-[9.5px]">
            {t("sampling.negativePresent", {
              missed: NEGATIVE_RELABEL.missedRegulatedFound,
              neg: NEGATIVE_RELABEL.falseNegativesFound,
            })}
          </p>
        ) : (
          <p className="mt-1 font-semibold text-red-800" data-id="s4.negative.missing">
            {t("sampling.notSignable")}
          </p>
        )}
        <p className="mt-1 text-[9px] text-faint">{NEGATIVE_RELABEL.note[lang]}</p>
      </div>
    </div>
  );
}
