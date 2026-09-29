// PolicyEvaluationCard — condition-level PASS/FAIL/UNKNOWN table with data
// source and policy version (Dev Plan §7.2). Email 1 beat 2 shows the FAIL
// condition ("first waiver in 12 months"); UNKNOWN fails closed.
import { Check, X, HelpCircle } from "lucide-react";
import type { CaseStateType, PolicyCard } from "@/runtime/caseState.ts";
import { cn } from "@/lib/utils";

function VerdictIcon({ v }: { v: string }) {
  if (v === "PASS") return <Check size={12} className="text-emerald-600" />;
  if (v === "FAIL") return <X size={12} className="text-red-600" />;
  return <HelpCircle size={12} className="text-amber-600" />;
}

function Card({ card }: { card: PolicyCard }) {
  return (
    <div className="rounded border border-line p-2" data-id="s2.policy">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-navy">{card.policyId}</span>
        <span className="font-mono text-[10px] text-faint">{card.version}</span>
        {card.degraded && (
          <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800">
            version degraded
          </span>
        )}
        <span
          className={cn(
            "ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]",
            card.overall === "PASS"
              ? "bg-emerald-50 text-emerald-700"
              : card.overall === "FAIL"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-800",
          )}
        >
          {card.overall}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] text-faint">{card.effect}</div>
      <table className="mt-1.5 w-full text-[10.5px]">
        <tbody>
          {card.conditions.map((c) => (
            <tr key={c.code} className="border-t border-line">
              <td className="py-1 pr-2 font-mono text-gray-700">{c.code}</td>
              <td className="py-1 pr-2 text-faint">
                {c.evidence == null ? "—" : JSON.stringify(c.evidence)}
              </td>
              <td className="w-10 py-1 text-right">
                <span className="inline-flex items-center gap-1">
                  <VerdictIcon v={c.verdict} />
                  <span className="font-mono">{c.verdict}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PolicyEvaluationCard({ state }: { state: CaseStateType }) {
  const cards = state.policyCards ?? [];
  return (
    <section className="rounded-lg border border-line bg-white p-3" data-id="s2.policy.section">
      <h3 className="text-[12px] font-semibold text-navy">Policy evaluation</h3>
      <p className="text-[10px] text-faint">deterministic policy pack · conditions evaluated from system data, not model mood</p>
      <div className="mt-2 space-y-2">
        {cards.length === 0 && <div className="text-[10.5px] text-faint">no policy evaluated for this case</div>}
        {cards.map((c) => (
          <Card key={`${c.policyId}@${c.sourceEmailId}`} card={c} />
        ))}
      </div>
    </section>
  );
}
