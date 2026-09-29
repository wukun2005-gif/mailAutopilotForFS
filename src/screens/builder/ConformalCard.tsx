// ConformalCard — FR-3.5 (P2): split-conformal abstention calibration.
// Explicitly a method demonstration with fictional numbers.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CONFORMAL_CARD } from "@/mocks/fixtures/index.ts";
import { useTranslation } from "react-i18next";

export function ConformalCard() {
  const { t, i18n } = useTranslation("builder");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const c = CONFORMAL_CARD;
  const curve = c.curve.map((p) => ({ coverage: Math.round(p.coverage * 100), setSize: p.avgSetSize }));
  return (
    <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50/60 p-3" data-id="s4.conformal">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-navy">{t("conformal.title")}</h3>
        <span className="rounded bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">
          {t("conformal.methodDemo")}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-faint">{c.method[lang]}</p>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center font-mono text-[10px]">
        <Stat label={t("conformal.targetAlpha")} value={c.alpha.toString()} />
        <Stat label={t("conformal.calibrationN")} value={c.calibrationSize.toString()} />
        <Stat label={t("conformal.observedCoverage")} value={`${(c.coverageObserved * 100).toFixed(1)}%`} />
        <Stat label={t("conformal.abstainRate")} value={`${(c.abstainRate * 100).toFixed(1)}%`} />
      </div>
      <div className="mt-2 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve} margin={{ top: 5, right: 16, bottom: 18, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="coverage"
              tick={{ fontSize: 9 }}
              label={{ value: t("conformal.coveragePct"), position: "insideBottom", offset: -10, fontSize: 9 }}
            />
            <YAxis tick={{ fontSize: 9 }} label={{ value: t("conformal.avgSetSize"), angle: -90, position: "insideLeft", fontSize: 9 }} />
            <Tooltip formatter={(v) => [`${v}`, t("conformal.avgSetSize")]} />
            <Line type="monotone" dataKey="setSize" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[9.5px] text-faint">{c.verdict[lang]}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white py-1">
      <div className="text-[12px] font-bold text-navy">{value}</div>
      <div className="text-[8.5px] text-faint">{label}</div>
    </div>
  );
}
