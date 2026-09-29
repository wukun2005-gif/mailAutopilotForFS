// Handler group #7 — statutory clock service. Computed from simClock at read
// time (no fixture clock values except the email-2 filing instant, Day 0
// 08:14). POS debit lights day90; day45 is returned greyed with its reason.
import { http } from "msw";
import {
  diffCalendarDays,
  diffCalendarHours,
  regEClocks,
  regZClocks,
  simClock,
  utcYmd,
} from "@runtime/simClock";
import { DISPUTE_EMAIL2 } from "@/mocks/fixtures/index.ts";
import { envelope, jsonError, jsonOk, mockLatency } from "./util.ts";

// Filing instant per case — email 2 is filed at Day 0 08:14 (arrival).
const FILED_AT: Record<string, number> = {
  [DISPUTE_EMAIL2.disputeId]: simClock.snapshot().epoch,
};

function clockView(caseId: string) {
  const now = simClock.now();
  const filedAt = FILED_AT[caseId] ?? simClock.snapshot().epoch;
  const e = regEClocks(filedAt);
  const z = regZClocks(filedAt);

  return {
    caseId,
    filedAt,
    filedAtIso: utcYmd(filedAt),
    simToday: utcYmd(now),
    regE: {
      provisionalCreditDue: {
        at: e.provisionalCreditDue,
        iso: utcYmd(e.provisionalCreditDue),
        scale: "bd10 (business days)",
        remainingHours: diffCalendarHours(now, e.provisionalCreditDue),
        urgent48h:
          diffCalendarHours(now, e.provisionalCreditDue) <= 48 &&
          diffCalendarHours(now, e.provisionalCreditDue) >= 0,
        overdue: now > e.provisionalCreditDue,
      },
      provisionalCreditNewAccount: {
        at: e.provisionalCreditDueNewAccount,
        iso: utcYmd(e.provisionalCreditDueNewAccount),
        scale: "bd20 (business days)",
        active: false,
        reason: "standard account branch",
      },
      day45: {
        at: e.day45,
        iso: utcYmd(e.day45),
        scale: "calendar days",
        active: false,
        reason: "POS debit applies the 90-day branch (1005.11(c)(3)(ii))",
      },
      day90: {
        at: e.day90,
        iso: utcYmd(e.day90),
        scale: "calendar days",
        remainingDays: diffCalendarDays(now, e.day90),
        active: true,
        overdue: now > e.day90,
      },
    },
    regZ: {
      writtenAckDue: { at: z.ackWrittenDue, iso: utcYmd(z.ackWrittenDue), active: false, reason: "Reg Z billing-error only; this is a Reg E POS debit case" },
      resolveDue: { at: z.resolveDue, iso: utcYmd(z.resolveDue), active: false },
    },
  };
}

export const clocksHandlers = [
  http.get("*/mock/clocks/:caseId", async ({ params }) => {
    await mockLatency(50);
    const caseId = String(params.caseId);
    if (caseId !== DISPUTE_EMAIL2.disputeId)
      return jsonError(404, "CLOCK_NOT_FOUND", `no clocks for ${caseId}`);
    return jsonOk(envelope(clockView(caseId)));
  }),
];
