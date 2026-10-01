// IdentityAudit — audit-view panel listing every I-level signal (PRD §6.2),
// so the presenter can point at the screen instead of explaining verbally:
// email 2's four I2 requirements, email 1's I3 basis and downgrade triggers.
// `previousLevel` adds the before/after: when the level was re-rated inside this
// thread (I1 → I3 after a step-up) the panel says so, which is the part an
// audience cannot infer from a badge that only shows "now".
import type { IdentityVerdict } from "@/runtime/identity.ts";
import { Check, X, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function IdentityAudit({
  identity,
  previousLevel,
}: {
  identity?: IdentityVerdict | null;
  previousLevel?: string | null;
}) {
  const { t } = useTranslation("customer");
  if (!identity) {
    return (
      <div className="rounded-lg border border-line bg-white p-3 text-[14px] text-faint">
        {t("identity.empty")}
      </div>
    );
  }
  const moved = previousLevel && previousLevel !== identity.level;
  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s1.identity">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-navy">{t("identity.title")}</span>
        {moved ? (
          <span className="inline-flex items-center gap-1" data-id="s1.identity.rise">
            <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[13px] font-bold text-gray-600 line-through">
              {previousLevel}
            </span>
            <ArrowRight size={13} className="text-teal" />
            <span className="rounded bg-teal px-2 py-0.5 text-[15px] font-bold text-white">
              {identity.level}
            </span>
          </span>
        ) : (
          <span className="rounded bg-navy px-2 py-0.5 text-[15px] font-bold text-white">
            {identity.level}
          </span>
        )}
      </div>
      {moved && (
        <div className="mt-1 rounded bg-teal-soft px-2 py-1 text-[13px] font-medium text-teal-dark">
          {t("identity.rerated", { from: previousLevel, to: identity.level })}
        </div>
      )}
      <div className="mt-0.5 text-[13px] text-faint">
        {t(`identity.levels.${identity.level}`, { defaultValue: identity.level })}
      </div>
      <ul className="mt-2 space-y-0.5">
        {identity.signals.map((s) => (
          <li key={s.code} className="flex items-center gap-1.5 text-[13px]">
            {s.passed ? (
              <Check size={11} className="shrink-0 text-emerald-600" />
            ) : (
              <X size={11} className="shrink-0 text-red-600" />
            )}
            <span className={cn(s.passed ? "text-gray-700" : "font-semibold text-red-700")}>
              {t(`identity.signals.${s.code}`, { defaultValue: t("trace.signalFallback") })}
            </span>
          </li>
        ))}
      </ul>
      {identity.reasonCodes.length > 0 && (
        <div className="mt-2 border-t border-line pt-1.5">
          {identity.reasonCodes.map((r) => (
            <div key={r} className="text-[12.5px] text-faint">
              {t(`identity.reasons.${r}`, { defaultValue: r })}
            </div>
          ))}
        </div>
      )}
      {identity.assumptions.length > 0 && (
        <div className="mt-1 rounded bg-amber-50 px-1.5 py-1 font-mono text-[12.5px] text-amber-800">
          {t("identity.assumptions", { values: identity.assumptions.join(" · ") })}
        </div>
      )}
    </div>
  );
}
