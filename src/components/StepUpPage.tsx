// StepUpPage — FR-2.2 FALLBACK branch only: one-time link page for customers
// without digital banking. The default path is the in-app case card
// (PhoneApp); this surface appears only when the noDigital fault is on.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { useCaseStore } from "@/store/caseStore";

const FIXED_OTP = "111111";

export function StepUpPage() {
  const { t } = useTranslation("customer");
  const stepUp = useCaseStore((s) => s.stepUp);
  const busy = useCaseStore((s) => s.busy);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3" data-id="s1.stepuppage">
      <div className="mb-1 rounded bg-amber-200/70 px-2 py-1 text-[13px] font-medium text-amber-900">
        {t("stepup.fallbackNote")}
      </div>
      <div className="mx-auto max-w-xs rounded-lg border border-line bg-white p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-[15px] font-semibold text-navy">
          <ShieldCheck size={14} className="text-teal" /> {t("stepup.title")}
        </div>
        <p className="mt-1.5 text-[14px] text-gray-600">
          {t("stepup.body")}
        </p>
        <input
          data-id="s1.link.otp"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder={t("stepup.placeholder")}
          className="mt-2 w-full rounded-md border border-line px-2 py-1.5 font-mono text-[16px] tracking-widest"
        />
        {err && <div className="mt-1 text-[13px] text-red-600">{err}</div>}
        <button
          data-id="s1.link.verify"
          disabled={busy || code.length !== 6}
          onClick={() => {
            if (code === FIXED_OTP) {
              setErr(null);
              void stepUp("one_time_link");
            } else setErr(t("stepup.err.incorrect"));
          }}
          className="mt-2 w-full rounded-md bg-teal py-1.5 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? t("stepup.err.busy") : t("stepup.cta")}
        </button>
      </div>
    </div>
  );
}
