// ClockBadge / StatutoryClockStrip — {t("clock.title")} for email 2.
// Day 0 = intake; bd10 = provisional credit due (10th business day);
// day45 greyed for POS debit (90-day branch applies); day90 = outer limit.
// The <48h warning uses 48 *calendar* hours (Dev Plan v0.4.1).
import { format } from "date-fns";
import { regEClocks, simClock, diffCalendarDays, DAY0_EPOCH } from "@/runtime/simClock.ts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function fmt(ts: number) {
  return format(new Date(ts), "MM/dd");
}

export function ClockBadge({ pcDone = false }: { pcDone?: boolean }) {
  const { t } = useTranslation("customer");
  const c = regEClocks(DAY0_EPOCH);
  const now = simClock.now();
  const hoursLeft = (c.provisionalCreditDue - now) / 3_600_000;
  const danger = !pcDone && hoursLeft <= 48;
  const elapsed = diffCalendarDays(DAY0_EPOCH, now);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[13.5px]",
        danger ? "bg-red-100 text-red-700" : "bg-navy-soft text-navy",
      )}
    >
      {t("clock.badge", { day: elapsed, state: pcDone ? t("clock.posted") : t("clock.due", { date: fmt(c.provisionalCreditDue) }) })}
    </span>
  );
}

export function StatutoryClockStrip({ pcDone = false }: { pcDone?: boolean }) {
  const { t } = useTranslation("customer");
  const c = regEClocks(DAY0_EPOCH);
  const now = simClock.now();
  const hoursLeft = (c.provisionalCreditDue - now) / 3_600_000;
  const danger = !pcDone && hoursLeft <= 48;

  const milestones = [
    { label: t("clock.milestones.intake"), date: DAY0_EPOCH, done: true },
    { label: t("clock.milestones.pc"), date: c.provisionalCreditDue, done: pcDone },
    { label: t("clock.milestones.day45"), date: c.day45, done: false, skipped: true },
    { label: t("clock.milestones.day90"), date: c.day90, done: false },
  ];

  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s2.clockstrip">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[14px] font-semibold text-navy">{t("clock.title")}</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[13px] font-medium",
            danger ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700",
          )}
        >
          {pcDone
            ? t("clock.pcPosted")
            : danger
              ? t("clock.under48")
              : t("clock.daysTo", { count: Math.max(0, Math.floor(hoursLeft / 24)) })}
        </span>
      </div>
      <div className="relative flex justify-between">
        <div className="absolute left-2 right-2 top-[7px] h-0.5 bg-line" />
        {milestones.map((m) => {
          const reached = now >= m.date;
          const skipped = "skipped" in m && m.skipped;
          return (
            <div key={m.label} className="relative z-10 flex w-1/4 flex-col items-center gap-1">
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2",
                  skipped
                    ? "border-dashed border-gray-300 bg-white"
                    : m.done || reached
                      ? "border-teal bg-teal"
                      : "border-navy-light bg-white",
                )}
              />
              <span className={cn("text-center text-[12.5px] leading-tight", skipped ? "text-faint" : "text-ink")}>
                {m.label}
              </span>
              {skipped && (
                <span className="rounded bg-gray-100 px-1.5 py-px text-[12px] font-medium text-gray-500">
                  {t("clock.skipped")}
                </span>
              )}
              <span className="font-mono text-[12.5px] text-faint">{fmt(m.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
