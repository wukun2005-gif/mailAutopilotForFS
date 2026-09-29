// DraftPanel — {t("drafts.title")} in the dossier (Dev Plan §7.2): three-segment
// coloring, inline agent editing (every edit is recorded into the trace),
// adopt / request-supervisor-signoff actions. The locked fraud template is
// shown read-only and is never sent to the forged address.
import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import type { CaseStateType, Draft } from "@/runtime/caseState.ts";
import { TricolorLetter } from "@/components/TricolorLetter";
import { useCaseStore } from "@/store/caseStore";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function DraftRow({ draft, state, t }: { draft: Draft; state: CaseStateType; t: (k: string, o?: Record<string, unknown>) => string }) {
  const recordDraftEdit = useCaseStore((s) => s.recordDraftEdit);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => draft.sections.map((s) => s.textEn).join("\n\n"));
  const sent = (state.outbound ?? []).some((o) => o.draftId === draft.id);
  const linkedApproval = state.approvals.find((a) => a.draft?.id === draft.id);

  return (
    <div className={cn("rounded border border-line p-2", draft.id === "DR-FRAUD-LOCKED" && "bg-red-50/50")}>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-mono font-semibold text-navy">{draft.id}</span>
        <span className="rounded bg-gray-100 px-1 py-0.5 font-mono text-gray-600">{draft.channel}</span>
        {draft.lockedTemplate && (
          <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-700">{t("drafts.lockedTemplate")}</span>
        )}
        {sent && <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-700">{t("drafts.sent")}</span>}
        {linkedApproval && (
          <span className="rounded bg-amber-50 px-1 py-0.5 text-amber-800">
            {t("drafts.signoff", { status: linkedApproval.status, level: linkedApproval.lLevel })}
          </span>
        )}
        <span className="ml-auto inline-flex gap-1">
          {!sent && draft.id !== "DR-FRAUD-LOCKED" && (
            <button
              onClick={() => setEditing((v) => !v)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-navy ring-1 ring-line hover:bg-navy-soft"
            >
              <Pencil size={10} /> {editing ? t("drafts.cancel") : t("drafts.edit")}
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-1.5">
          <textarea
            data-id={`s2.draft.edit.${draft.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full rounded border border-line p-1.5 font-mono text-[10.5px]"
          />
          <button
            data-id={`s2.draft.save.${draft.id}`}
            onClick={() => {
              void recordDraftEdit(draft.id, text);
              setEditing(false);
            }}
            className="mt-1 inline-flex items-center gap-1 rounded bg-teal px-2 py-0.5 text-[10px] text-white"
          >
            <Check size={10} /> {t("drafts.saveEdit")}
          </button>
        </div>
      ) : (
        <div className="mt-1.5">
          <TricolorLetter draft={draft} audit />
        </div>
      )}
    </div>
  );
}

export function DraftPanel({ state }: { state: CaseStateType }) {
  const { t } = useTranslation("agent");
  const drafts = state.drafts ?? [];
  return (
    <section className="rounded-lg border border-line bg-white p-3" data-id="s2.drafts">
      <h3 className="text-[12px] font-semibold text-navy">{t("drafts.title")}</h3>
      <p className="text-[10px] text-faint">{t("drafts.subtitle")}</p>
      <div className="mt-2 space-y-2">
        {drafts.length === 0 && <div className="text-[10.5px] text-faint">{t("drafts.empty")}</div>}
        {drafts.map((d) => (
          <DraftRow key={d.id} draft={d} state={state} t={t} />
        ))}
      </div>
    </section>
  );
}
