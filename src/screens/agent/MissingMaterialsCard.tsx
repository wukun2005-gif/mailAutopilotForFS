// MissingMaterials — Reg E evidence checklist (Dev Plan §7.2 / PRD Never ⑪):
// every item is OPTIONAL and never blocks the investigation or the clock;
// a police report is deliberately NOT listed (CFPB EFT FAQ Q4).
import { Check, AlertTriangle, CircleDashed } from "lucide-react";
import type { CaseStateType, MaterialState } from "@/runtime/caseState.ts";

// Canonical ask list for the POS debit dispute vignette.
const CANONICAL: { code: string; label: string }[] = [
  { code: "ATT-RECEIPT", label: "receipt / proof of purchase (optional)" },
  { code: "ATT-SCREENSHOT", label: "screenshot of the charge (optional)" },
  { code: "ATT-SIGNED", label: "signed customer statement (optional)" },
];

function Row({ code, label, m }: { code: string; label: string; m?: MaterialState }) {
  const status = m?.status ?? "not_submitted";
  return (
    <div className="flex items-center gap-2 rounded border border-line px-2 py-1 text-[11px]">
      {status === "received" ? (
        <Check size={13} className="text-emerald-600" />
      ) : status === "ocr_low_confidence" ? (
        <AlertTriangle size={13} className="text-amber-600" />
      ) : (
        <CircleDashed size={13} className="text-gray-400" />
      )}
      <span className="flex-1 text-gray-700">{label}</span>
      <span className="font-mono text-[9.5px] text-faint">{code}</span>
      <span
        className={
          status === "received"
            ? "rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] text-emerald-700"
            : status === "ocr_low_confidence"
              ? "rounded bg-amber-50 px-1.5 py-0.5 text-[9.5px] text-amber-800"
              : "rounded bg-gray-100 px-1.5 py-0.5 text-[9.5px] text-gray-500"
        }
      >
        {status === "received"
          ? `received · OCR ${(m?.ocrConfidence ?? 0).toFixed(2)}`
          : status === "ocr_low_confidence"
            ? `OCR low ${(m?.ocrConfidence ?? 0).toFixed(2)} · human confirm`
            : "not submitted"}
      </span>
    </div>
  );
}

export function MissingMaterialsCard({ state }: { state: CaseStateType }) {
  if (state.scenarioId !== "email2") return null;
  return (
    <section className="rounded-lg border border-line bg-white p-3" data-id="s2.materials">
      <h3 className="text-[12px] font-semibold text-navy">Requested materials</h3>
      <p className="text-[10px] text-faint">
        all items optional · missing items never pause the statutory clock · police report never requested
      </p>
      <div className="mt-2 space-y-1">
        {CANONICAL.map((c) => (
          <Row key={c.code} code={c.code} label={c.label} m={state.materials.find((x) => x.code === c.code)} />
        ))}
      </div>
    </section>
  );
}
