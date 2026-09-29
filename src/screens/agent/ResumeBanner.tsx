// ResumeBanner — shown after the "restart process" control reattaches a fresh
// graph to the same IDB checkpoint thread (Dev Plan §7.2, FR-4.5). The long
// case never starts over and idempotent actions never execute twice.
import { RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { simClock } from "@/runtime/simClock.ts";
import type { CaseStateType } from "@/runtime/caseState.ts";
import { useTranslation } from "react-i18next";

export function ResumeBanner({ state, reattached }: { state: CaseStateType; reattached: boolean }) {
  const { t } = useTranslation("agent");
  if (!reattached) return null;
  const executed = (state.actions ?? []).filter((a) => a.status === "done").length;
  const inflight = (state.actions ?? []).filter((a) => a.status === "inflight").length;
  return (
    <div
      data-id="s2.resumebanner"
      className="flex items-start gap-2 rounded-lg border border-teal/40 bg-teal-soft px-3 py-2 text-[14px] text-teal-dark"
    >
      <RefreshCw size={14} className="mt-0.5 shrink-0" />
      <div>
        <b>{t("resume.title")}</b>{" "}
        {t("resume.body", {
          time: format(new Date(simClock.now()), "MM/dd HH:mm"),
          executed,
          inflight: inflight > 0 ? t("resume.inflight", { count: inflight }) : "",
        })}
      </div>
    </div>
  );
}
