// PreventableTagCard — FR-12.4 advisory tag on the email-2 case header.
// The card-delivery question was preventable: a card_shipped event already
// existed on file and could have triggered an ETA notice. The tag never
// changes intake, clock-start or reply paths; it feeds the preventable-inbound
// metric and a Builder shadow proposal for the notification rule.
import { BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PREVENTABLE_TAG } from "@/mocks/fixtures/designTime.ts";

export function PreventableTagCard() {
  const { t, i18n } = useTranslation("agent");
  const lang = i18n.language?.startsWith("zh") ? "zh" : "en";
  const tag = PREVENTABLE_TAG;

  return (
    <div
      className="rounded-lg border border-violet-300 bg-violet-50/60 px-3 py-2"
      data-id="s2.preventable"
    >
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-violet-900">
        <BellOff size={14} />
        {t("preventable.title")}
        <span className="ml-auto rounded bg-violet-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-violet-800">
          {t("preventable.shadow")}
        </span>
      </div>
      <div className="mt-1 text-[12.5px] text-violet-900/90">
        <div>{tag.eventLabel[lang]}</div>
        <div className="mt-0.5 text-violet-800/80">{tag.ruleLabel[lang]}</div>
      </div>
      <div className="mt-1 text-[12px] text-violet-800/70">{t("preventable.note")}</div>
    </div>
  );
}
