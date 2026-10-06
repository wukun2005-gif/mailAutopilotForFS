// Shared presentational bits for wave cards (FR-12.2): severity badge and a
// tiny deterministic volume sparkline (no chart dependency needed).
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { WaveSeverity } from "@/runtime/designTime/types.ts";

export function SeverityBadge({ severity }: { severity: WaveSeverity }) {
  const { t } = useTranslation("supervisor");
  const cls =
    severity === "P0"
      ? "bg-red-100 text-red-800 border-red-300"
      : severity === "P1"
        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
        : "bg-amber-100 text-amber-800 border-amber-300";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[12px] font-bold", cls)}>
      {t(`waves.severity.${severity}`)}
    </span>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex h-9 items-end gap-[3px]", className)} aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[9px] rounded-sm bg-teal/70"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-0.5 text-[12.5px]">
      <div className="text-faint">{label}</div>
      <div className="text-navy">{children}</div>
    </div>
  );
}
