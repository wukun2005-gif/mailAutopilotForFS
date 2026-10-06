// ConsequencePreviewCard — FR-12.5 writing-time advisor beside a draft.
// Shows the predicted recontact probability for the current wording vs the
// suggested connective sentence, with three precedent cards from similar
// closed threads. It suggests wording only: it never changes the decision,
// never blocks a statutory receipt, and never shows customer value / churn /
// revenue. One-click insert edits connective wording and is recorded as a
// normal draft edit.
import { useState } from "react";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DRAFT_PREVIEW } from "@/mocks/fixtures/designTime.ts";
import { cn } from "@/lib/utils";

const KIND_STYLE: Record<string, string> = {
  closed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  recontact: "border-amber-300 bg-amber-50 text-amber-800",
  escalated: "border-red-300 bg-red-50 text-red-800",
};

export function ConsequencePreviewCard({ onInsert }: { onInsert: (sentence: string) => void }) {
  const { t, i18n } = useTranslation("agent");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const [inserted, setInserted] = useState(false);
  const p = DRAFT_PREVIEW;
  const sentence = p.insertSentence[lang];

  return (
    <div
      className="mt-2 rounded-lg border border-violet-300 bg-violet-50/50 p-2.5"
      data-id="s2.draft.preview"
    >
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-violet-900">
        <Sparkles size={13} /> {t("preview.title")}
        <span className="ml-auto text-[11.5px] font-normal text-violet-700/80">
          {t("preview.sample", { n: p.sampleSize })}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2" data-id="s2.draft.preview.prob">
        <div className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-center">
          <div className="font-mono text-[18px] font-bold leading-none text-amber-700">
            {p.currentRecontactPct}%
          </div>
          <div className="mt-0.5 text-[11px] text-faint">{t("preview.current")}</div>
        </div>
        <ArrowRight size={15} className="text-violet-500" />
        <div className="rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-center">
          <div className="font-mono text-[18px] font-bold leading-none text-emerald-700">
            {p.improvedRecontactPct}%
          </div>
          <div className="mt-0.5 text-[11px] text-faint">{t("preview.improved")}</div>
        </div>
        <div className="ml-1 flex-1 text-[12px] text-violet-900/90">
          {p.reasons.map((r, i) => (
            <div key={i}>· {r[lang]}</div>
          ))}
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        {p.precedents.map((c) => (
          <div key={c.kind} className={cn("rounded-md border px-2 py-1 text-[11.5px]", KIND_STYLE[c.kind])}>
            <div className="font-mono font-bold">{c.sharePct}%</div>
            <div className="leading-tight">{c.summary[lang]}</div>
          </div>
        ))}
      </div>

      <div className="mt-1.5 rounded-md border border-violet-200 bg-white px-2 py-1.5 text-[12px] text-navy">
        {sentence}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <button
          data-id="s2.draft.preview.insert"
          disabled={inserted}
          onClick={() => {
            onInsert(sentence);
            setInserted(true);
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold",
            inserted
              ? "cursor-default border border-emerald-400 bg-emerald-50 text-emerald-700"
              : "bg-violet-700 text-white hover:bg-violet-800",
          )}
        >
          {inserted ? <Check size={12} /> : <Sparkles size={12} />}
          {inserted ? t("preview.inserted") : t("preview.insert")}
        </button>
        <span className="text-[11.5px] text-violet-700/80">{t("preview.guard")}</span>
      </div>
    </div>
  );
}
