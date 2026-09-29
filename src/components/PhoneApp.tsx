// PhoneApp — recorded Larkspur Bank mobile app inside a phone frame.
// Default FR-2.2 path: push → secure-message case card → OTP to the on-file
// number → I3 success. The verification email itself contains NO links.
// Also renders the secure-message inbox (case card, receipts, letters) and
// the on-file fraud SMS (email 3).
import { useState } from "react";
import { Bell, ShieldCheck, MessageSquareText, CheckCircle2 } from "lucide-react";
import { useCaseStore } from "@/store/caseStore";
import { TricolorLetter } from "./TricolorLetter";
import type { Draft } from "@/runtime/caseState.ts";
import { cn } from "@/lib/utils";

const FIXED_OTP = "482915";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[300px] shrink-0">
      <div className="rounded-[2.2rem] border-[7px] border-gray-900 bg-gray-900 shadow-xl">
        <div className="overflow-hidden rounded-[1.6rem] bg-white">{children}</div>
      </div>
      <div className="mt-1 text-center text-[9.5px] text-faint">
        recorded Larkspur Bank app · prototype
      </div>
    </div>
  );
}

export function PhoneApp() {
  const caseState = useCaseStore((s) => s.caseState);
  const stepUp = useCaseStore((s) => s.stepUp);
  const busy = useCaseStore((s) => s.busy);
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showCard, setShowCard] = useState(false);

  const needsVerify = caseState?.status === "awaiting_customer";
  const i3 = caseState?.identity?.level === "I3";

  const submitOtp = () => {
    if (otp === FIXED_OTP) {
      setErr(null);
      void stepUp("app_case_card");
      setShowCard(false);
      setOtp("");
    } else {
      const n = attempts + 1;
      setAttempts(n);
      setErr(n >= 3 ? "too many attempts — request locked (recorded)" : "incorrect code");
    }
  };

  const visibleDrafts: Draft[] = (caseState?.drafts ?? []).filter(
    (d) => d.id !== "DR-FRAUD-LOCKED",
  );
  const fraudSms = (caseState?.actions ?? []).some(
    (a) => a.actionType === "notify_onfile" && a.status === "done",
  );

  return (
    <div className="flex h-[560px] flex-col bg-gray-50">
      {/* status bar */}
      <div className="flex items-center justify-between bg-navy px-4 py-1.5 text-[10px] text-white">
        <span className="font-mono">9:41</span>
        <span className="font-semibold">Larkspur Bank</span>
        <span>5G ▮</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {/* push notification when verification needed */}
        {needsVerify && !showCard && (
          <button
            data-id="s1.phone.push"
            onClick={() => setShowCard(true)}
            className="w-full animate-pulse rounded-xl border border-navy/20 bg-white p-2.5 text-left shadow-md"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-navy">
              <Bell size={11} /> Larkspur Bank · now
            </div>
            <div className="mt-0.5 text-[11px] text-ink">
              Secure message: a case needs your verification
            </div>
          </button>
        )}

        {/* case card / OTP flow */}
        {needsVerify && showCard && (
          <div className="rounded-xl border border-teal/30 bg-teal-soft/60 p-3" data-id="s1.phone.casecard">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-dark">
              <ShieldCheck size={13} /> Verify it is you
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-ink">
              We received a request about your account. For your protection, verify
              before we share details or move money. After verification, the case
              continues automatically.
            </p>
            <p className="mt-1 text-[9.5px] text-faint">
              I3 basis §6.2②: logged-in secure-message session
            </p>
            <label className="mt-2 block text-[10px] font-medium text-navy">
              One-time code sent to the phone number on file (••-0142)
            </label>
            <input
              data-id="s1.phone.otp"
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-[13px] tracking-widest"
            />
            {err && <div className="mt-1 text-[10px] text-red-600">{err}</div>}
            <button
              data-id="s1.phone.verify"
              disabled={busy || otp.length !== 6}
              onClick={submitOtp}
              className="mt-2 w-full rounded-md bg-teal py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "verifying…" : "Verify & continue case"}
            </button>
          </div>
        )}

        {i3 && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <div className="text-[10.5px] text-emerald-800">
              Verified — identity level <b>I3</b>. Case resumed autonomously.
            </div>
          </div>
        )}

        {/* fraud SMS goes to the ON-FILE number only */}
        {fraudSms && (
          <div className="rounded-xl border border-gray-300 bg-gray-100 p-2.5" data-id="s1.phone.sms">
            <div className="text-[9.5px] font-semibold text-gray-500">SMS · Larkspur Fraud</div>
            <div className="mt-0.5 text-[11px] text-gray-800">
              We blocked a suspicious message claiming to be you. We will never ask
              you to change contact details by email. If unsure, call the number on
              your card.
            </div>
          </div>
        )}

        {/* secure-message inbox: approved/sent letters */}
        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5 text-[10.5px] font-semibold text-navy">
            <MessageSquareText size={12} /> Secure messages
          </div>
          <div className="divide-y divide-line">
            {visibleDrafts.length === 0 && (
              <div className="px-2.5 py-3 text-[10px] text-faint">no messages yet</div>
            )}
            {visibleDrafts.map((d) => {
              const sent = (caseState?.outbound ?? []).some((o) => o.draftId === d.id);
              return (
                <div key={d.id} className={cn("px-2.5 py-2", !sent && "opacity-60")}>
                  <div className="flex items-center justify-between text-[9.5px] text-faint">
                    <span className="font-mono">{d.id}</span>
                    <span>{sent ? "delivered" : "draft"}</span>
                  </div>
                  <div className="mt-1">
                    <TricolorLetter draft={d} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
