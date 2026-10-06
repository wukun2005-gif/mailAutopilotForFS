// Recorded intent registry (M2 recorded mode): the "detector" is a fixture
// table keyed by inbound email id — same answers every run, zero randomness.
// Live LLM detection replaces only this table in a later phase; everything
// downstream (identity, policy, gates) is unchanged.
import type { RLevel } from "./state.ts";
import type { IntentHit } from "./caseState.ts";
import { GRADUATION_TABLE } from "@/mocks/fixtures/index.ts";
import { graduationOverrides } from "./graduationOverrides.ts";

export interface IntentSpec {
  intentCode: string;
  risk: RLevel;
  regulated: boolean;
  /** This intent's internal intake (case+clocks+receipt) runs even at I0/I1. */
  intakeAutoAtAnyIdentity?: boolean;
  /** Clock-driven deterministic obligation, not an AI decision (FR-4.2). */
  clockDriven?: boolean;
  /** Field-sensitivity class for the respond node (FR-2.3). */
  fieldClass?: "public" | "low_sensitivity" | "transaction_detail" | "none";
  policyPackId?: string;
}

export const INTENT_SPECS: Record<string, IntentSpec> = {
  general_inquiry: { intentCode: "general_inquiry", risk: "R0", regulated: false, fieldClass: "public" },
  card_delivery_status: {
    intentCode: "card_delivery_status",
    risk: "R1",
    regulated: false,
    fieldClass: "low_sensitivity", // ETA/carrier only, never the address
  },
  transaction_detail: {
    intentCode: "transaction_detail",
    risk: "R1",
    regulated: false,
    fieldClass: "transaction_detail", // I3 field (unmentioned transactions)
  },
  // Graduated L3 R2 write in the graduation table, so it needs a spec here too:
  // a wave ratchet caps an intent by code, and a code with no spec is an intent
  // the runtime cannot run (and cannot tighten).
  card_lock: {
    intentCode: "card_lock",
    risk: "R2",
    regulated: false,
    fieldClass: "none",
  },
  od_fee_refund: {
    intentCode: "od_fee_refund",
    risk: "R2",
    regulated: false,
    policyPackId: "OD_FEE_WAIVER_V12",
  },
  reg_e_intake: {
    intentCode: "reg_e_intake",
    risk: "R2",
    regulated: true,
    intakeAutoAtAnyIdentity: true,
    policyPackId: "REGE_INTAKE_V3",
  },
  reg_e_intake_demo: {
    intentCode: "reg_e_intake_demo",
    risk: "R2",
    regulated: true,
    intakeAutoAtAnyIdentity: true,
    policyPackId: "REGE_INTAKE_V3",
  },
  reg_e_provisional_credit: {
    intentCode: "reg_e_provisional_credit",
    risk: "R2",
    regulated: true,
    clockDriven: true,
  },
  reg_e_adjudication: {
    intentCode: "reg_e_adjudication",
    risk: "R4",
    regulated: true,
  },
  contact_detail_change: {
    intentCode: "contact_detail_change",
    risk: "R3",
    regulated: false,
  },
};

interface RecordedHit {
  intentCode: string;
  confidence: number;
  evidenceSentences: string[];
}

// Deterministic detector output per inbound email.
const RECORDED_DETECTIONS: Record<string, RecordedHit[]> = {
  "EM-1-IN-1": [
    {
      intentCode: "od_fee_refund",
      confidence: 0.98,
      evidenceSentences: ["I see an overdraft fee of $35.00 … Could you please refund this fee?"],
    },
  ],
  "EM-1-IN-2": [
    {
      intentCode: "od_fee_refund",
      confidence: 0.97,
      evidenceSentences: ["Another overdraft fee showed up … Could you refund this one too?"],
    },
  ],
  "EM-2-IN-1": [
    {
      intentCode: "card_delivery_status",
      confidence: 0.96,
      evidenceSentences: ["a replacement was supposed to be shipped — when should it arrive?"],
    },
    {
      intentCode: "reg_e_intake",
      confidence: 0.99,
      evidenceSentences: ["there's a charge for $247.18 … I don't recognize this charge at all"],
    },
  ],
  "EM-2-IN-1B": [
    {
      intentCode: "transaction_detail",
      confidence: 0.95,
      evidenceSentences: ["send me the details of that $247.18 charge"],
    },
  ],
  // Day-6 materials: no new customer-facing intent; OCR gate runs separately.
  "EM-2-IN-2": [],
  "EM-3-IN-1": [
    {
      intentCode: "contact_detail_change",
      confidence: 0.99,
      evidenceSentences: ["update the phone number on my account", "mail the replacement debit card … to my new address"],
    },
  ],
};

export function recordedTriage(emailId: string): IntentHit[] {
  return (RECORDED_DETECTIONS[emailId] ?? []).map((h) => ({
    intentCode: h.intentCode,
    risk: INTENT_SPECS[h.intentCode]!.risk,
    confidence: h.confidence,
    evidenceSentences: h.evidenceSentences,
    regulated: INTENT_SPECS[h.intentCode]!.regulated,
    sourceEmailId: emailId,
  }));
}

// Recorded parallel signals (PRD §6.1 step 2): language, vulnerability and
// fraud screening run alongside intent on every inbound email — including the
// negative results. All three fixtures are English with no vulnerability
// signals; fraud only fires on email 3 (see FRAUD_SIGNALS).
const RECORDED_PARALLEL: Record<string, { lang: string; vulnerable: string }> = {
  "EM-1-IN-1": { lang: "en", vulnerable: "negative" },
  "EM-1-IN-2": { lang: "en", vulnerable: "negative" },
  "EM-2-IN-1": { lang: "en", vulnerable: "negative" },
  "EM-2-IN-1B": { lang: "en", vulnerable: "negative" },
  "EM-2-IN-2": { lang: "en", vulnerable: "negative" },
  "EM-3-IN-1": { lang: "en", vulnerable: "negative" },
};

export function parallelSignals(emailId: string): { lang: string; vulnerable: string } {
  return RECORDED_PARALLEL[emailId] ?? { lang: "en", vulnerable: "negative" };
}

export function intentSpec(code: string): IntentSpec {
  const spec = INTENT_SPECS[code];
  if (!spec) throw new Error(`UNREGISTERED_INTENT:${code}`);
  return spec;
}

/**
 * Effective graduated L level. Baseline comes from the fixture table only for
 * rows already marked graduated; Builder dual sign-off / manual caps are
 * layered on via graduationOverrides (promotion can lift a shadow intent).
 */
export function graduatedLevel(intentCode: string): import("./state.ts").LLevel | null {
  const row = GRADUATION_TABLE.find((g) => g.intentCode === intentCode);
  const baseline = row && row.status === "graduated" ? row.graduatedL : null;
  return graduationOverrides.effective(intentCode, baseline);
}

/**
 * The level this intent runs at with no cap in force — the level the Builder
 * board shows before anyone tightens it. The wave board reads it so the
 * "L3 → L2" a tightening pack promises is the level the graduation table
 * actually carries, never a hardcoded number.
 */
export function uncappedLevel(intentCode: string): import("./state.ts").LLevel | null {
  const row = GRADUATION_TABLE.find((g) => g.intentCode === intentCode);
  const baseline = row && row.status === "graduated" ? row.graduatedL : null;
  return graduationOverrides.unclamped(intentCode, baseline);
}
