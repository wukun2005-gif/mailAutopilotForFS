// IdentityAudit — audit-view panel listing every I-level signal (PRD §6.2),
// so the presenter can point at the screen instead of explaining verbally:
// email 2's four I2 requirements, email 1's I3 basis and downgrade triggers.
import type { IdentityVerdict } from "@/runtime/identity.ts";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function IdentityAudit({ identity }: { identity?: IdentityVerdict | null }) {
  if (!identity) {
    return (
      <div className="rounded-lg border border-line bg-white p-3 text-[11px] text-faint">
        no identity evaluation yet
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-white p-3" data-id="s1.identity">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-navy">Identity assurance gate</span>
        <span className="rounded bg-navy px-2 py-0.5 font-mono text-[12px] font-bold text-white">
          {identity.level}
        </span>
      </div>
      <ul className="mt-2 space-y-0.5">
        {identity.signals.map((s) => (
          <li key={s.code} className="flex items-center gap-1.5 font-mono text-[10px]">
            {s.passed ? (
              <Check size={11} className="text-emerald-600" />
            ) : (
              <X size={11} className="text-red-600" />
            )}
            <span className={cn(s.passed ? "text-gray-700" : "font-semibold text-red-700")}>
              {s.code}
            </span>
          </li>
        ))}
      </ul>
      {identity.reasonCodes.length > 0 && (
        <div className="mt-2 border-t border-line pt-1.5">
          {identity.reasonCodes.map((r) => (
            <div key={r} className="font-mono text-[9.5px] text-faint">{r}</div>
          ))}
        </div>
      )}
      {identity.assumptions.length > 0 && (
        <div className="mt-1 rounded bg-amber-50 px-1.5 py-1 font-mono text-[9.5px] text-amber-800">
          假设 {identity.assumptions.join(" · ")}
        </div>
      )}
    </div>
  );
}
