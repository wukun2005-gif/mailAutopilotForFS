// MetricsPanel — PRD §04 success metrics + §4.2 guardrails on screen 3.
// Case doc gives the supervisor "day-to-day operations, KPIs, and performance",
// so every metric here shows a NUMBER, never an "in observation" placeholder.
// Values are fixtures: fictional profile (§1.2) + pilot-week-6 observation
// window (§4.3), because the demo timeline (Day 0 → Day 21) cannot satisfy the
// VARR 14-day no-repeat window. Production computes the same tiles from real
// traffic; the target column is the §4.3 stage gate, the threshold column is
// §4.2, and tests/unit/metricsFixture.test.ts fails if a gate quoted here
// disappears from PRD §04.
import { useTranslation } from "react-i18next";

/** Order is display order; copy lives in locales/{zh,en}/supervisor.json. */
// PRD §4.2 guardrails. The last four are the v0.3 additions that come with the
// design-time layer: cohort parity gates every nomination and policy diff, the
// preventable rate and canary hit rate police the two new loops, and the
// remediation error rate gates the P1 positive wave's money-moving batches.
const GUARD_ROWS = [
  "regret",
  "bidirectional",
  "escalation",
  "customer",
  "clockHealth",
  "drift",
  "regDetection",
  "pleaseCall",
  "cohortParity",
  "preventable",
  "canary",
  "remediationError",
] as const;

const MAIN = ["varr", "ttr", "trust"] as const;
type MainMetric = (typeof MAIN)[number];

export function MetricsPanel() {
  const { t } = useTranslation("supervisor");

  return (
    <div className="flex flex-col gap-2" data-id="s3.metrics">
      <div className="rounded-lg border border-line bg-white p-3">
        <h3 className="text-[15px] font-semibold text-navy">{t("metrics.title")}</h3>
        <p className="text-[13px] text-faint">{t("metrics.subtitle")}</p>

        <div className="mt-2 grid gap-2 md:grid-cols-3" data-id="s3.metrics.main">
          {MAIN.map((m) => (
            <MainCard key={m} id={m} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-3" data-id="s3.metrics.guardrails">
        <h4 className="text-[14.5px] font-semibold text-navy">{t("metrics.guard.title")}</h4>
        <table className="mt-1 w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-faint">
              <th className="py-1 pr-2">{t("metrics.guard.name")}</th>
              <th className="py-1 pr-2">{t("metrics.guard.value")}</th>
              <th className="py-1">{t("metrics.guard.threshold")}</th>
            </tr>
          </thead>
          <tbody>
            {GUARD_ROWS.map((r) => (
              <tr key={r} className="border-t border-line align-top">
                <td className="py-1.5 pr-2 font-medium text-navy">
                  {t(`metrics.guard.rows.${r}.name`)}
                </td>
                <td className="py-1.5 pr-2 font-mono text-teal">
                  {t(`metrics.guard.rows.${r}.value`)}
                </td>
                <td className="py-1.5 text-gray-700">
                  {t(`metrics.guard.rows.${r}.threshold`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MainCard({ id }: { id: MainMetric }) {
  const { t } = useTranslation("supervisor");
  // All three fixtures sit inside their §4.3 stage gate, so the card reads
  // green; a value outside the gate flips the card to the red pair below.
  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5"
      data-id={`s3.metrics.${id}`}
    >
      <div className="text-[12.5px] font-semibold uppercase tracking-wide text-faint">
        {t(`metrics.main.${id}.name`)}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[27px] font-bold leading-none text-emerald-700">
          {t(`metrics.main.${id}.value`)}
        </span>
        <span className="text-[12.5px] text-faint">{t(`metrics.main.${id}.unit`)}</span>
      </div>
      <div className="mt-1 text-[12.5px] font-medium text-navy">
        {t(`metrics.main.${id}.target`)}
      </div>
      <div className="mt-0.5 text-[12.5px] text-gray-600">{t(`metrics.main.${id}.detail`)}</div>
    </div>
  );
}
