// FraudQuarantine — FR-8.3 / FR-6.3 / FR-6.4: BEC/ATO isolation queue.
// Outbound contact-change actions are unreachable (greyed, no R3 tools exist);
// the only outbound is an SMS to the ON-FILE number; the SAR-style locked
// template records facts only and is never sent to the forged address.
import { ShieldAlert, Lock, PhoneCall, FileText } from "lucide-react";
import type { CaseStateType } from "@/runtime/caseState.ts";
import { useCaseStore } from "@/store/caseStore";
import { INBOUND_EMAILS, CUSTOMER_JANE } from "@/mocks/fixtures/index.ts";
import { TricolorLetter } from "@/components/TricolorLetter";
import { useTranslation } from "react-i18next";

function signalLabel(code: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (code.startsWith("ATO_SCORE_")) return t("fraud.atoScore", { value: code.split("_")[2] });
  return t(`fraud.signals.${code}`, { defaultValue: code });
}

export function FraudQuarantine({ state }: { state: CaseStateType }) {
  const { t } = useTranslation("supervisor");
  const approve = useCaseStore((s) => s.approve);
  const email3 = INBOUND_EMAILS.find((e) => e.id === "EM-3-IN-1");
  const fraudApproval = (state.approvals ?? []).find((a) => a.id === "AP-FRAUD-CONFIRM");
  const decided = fraudApproval && fraudApproval.status !== "pending";
  const confirmed = fraudApproval?.status === "approved";
  const rejected = fraudApproval?.status === "rejected";
  const sarDraft = (state.drafts ?? []).find((d) => d.id === "DR-FRAUD-LOCKED");
  const smsSent = (state.actions ?? []).some(
    (a) => a.actionType === "notify_onfile" && a.status === "done",
  );

  if (state.scenarioId !== "email3") {
    return (
      <div className="rounded-lg border border-dashed border-line bg-white p-6 text-center text-[14px] text-faint" data-id="s3.quarantine">
        {t("fraud.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-id="s3.quarantine">
      <div className="rounded-lg border-2 border-red-300 bg-red-50/60 p-3">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-red-800">
          <ShieldAlert size={14} /> {t("fraud.title")}
        </h3>
        <div className="mt-1 text-[13.5px] text-gray-700">
          <div>
            from <span className="font-mono font-semibold">{email3?.from}</span> → {t("fraud.onfile")}{" "}
            <span className="font-mono">{CUSTOMER_JANE.emailsOnFile[0]}</span>
          </div>
          {email3?.auth && (
            <div className="mt-0.5 font-mono text-[13px] text-red-700">
              SPF {email3.auth.spf} · DKIM {email3.auth.dkim} · DMARC {email3.auth.dmarc}
            </div>
          )}
        </div>
        <ul className="mt-2 space-y-1">
          {(state.fraud?.signals ?? []).map((s) => (
            <li key={s} className="flex items-start gap-1.5 rounded bg-white px-2 py-1 text-[13.5px]">
              <Lock size={11} className="mt-0.5 shrink-0 text-red-600" />
              <span>
                <span className="font-mono text-[12.5px] text-faint">{s}</span>
                <br />
                {signalLabel(s, t)}
              </span>
            </li>
          ))}
        </ul>

        {/* Requested actions are unreachable, not just denied */}
        <div className="mt-2 rounded border border-line bg-gray-100 p-2">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">
            {t("fraud.requestedTitle")}
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["change phone number", "mail card to new address", "reply to sender"] as const).map((x) => (
              <button
                key={x}
                disabled
                className="cursor-not-allowed rounded bg-gray-200 px-2 py-1 text-[13.5px] text-gray-400 line-through"
                title={t("fraud.unreachable")}
              >
                {t(`fraud.actions.${x}`)}
              </button>
            ))}
          </div>
          <div className="mt-1 text-[12.5px] text-gray-500">
            {t("fraud.unreachable")}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            data-id="s3.fraud.confirm"
            disabled={!!decided}
            onClick={() => approve({ approvalId: "AP-FRAUD-CONFIRM", decision: "approve" })}
            className="inline-flex items-center gap-1 rounded bg-red-700 px-3 py-1.5 text-[13.5px] font-semibold text-white disabled:opacity-40"
          >
            <PhoneCall size={11} /> {t("fraud.confirm")}
          </button>
          <button
            data-id="s3.fraud.release"
            disabled={!!decided}
            onClick={() =>
              approve({
                approvalId: "AP-FRAUD-CONFIRM",
                decision: "reject",
                reasonCode: "FALSE_POSITIVE",
              })
            }
            className="rounded px-3 py-1.5 text-[13.5px] text-navy ring-1 ring-line disabled:opacity-40"
          >
            {t("fraud.release")}
          </button>
        </div>
        {smsSent && (
          <div className="mt-1.5 text-[13.5px] text-emerald-700">
            {t("fraud.smsSent", { phone: CUSTOMER_JANE.phoneOnFile })}
          </div>
        )}
        {rejected && <div className="mt-1.5 text-[13.5px] text-gray-600">{t("fraud.released")}</div>}
      </div>

      {confirmed && sarDraft && (
        <div className="rounded-lg border border-line bg-white p-3" data-id="s3.sar">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-navy">
            <FileText size={13} /> {t("fraud.sarTitle")}
          </h3>
          <p className="text-[13px] text-faint">
            {t("fraud.sarNote")}
          </p>
          <div className="mt-2 rounded border border-line bg-paper p-2">
            <TricolorLetter draft={sarDraft} audit={false} />
          </div>
        </div>
      )}
    </div>
  );
}
