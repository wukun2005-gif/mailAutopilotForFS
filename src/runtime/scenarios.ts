// Three recorded vignettes share one fictional customer (Dev Plan §8). Each
// scenario is an independent thread/case; identity signals are recorded per
// scenario (see identitySignals.RECORDED_ADDRESS_ON_FILE).
import { CUSTOMER_JANE } from "@/mocks/fixtures/index.ts";

export type ScenarioId = "email1" | "email2" | "email3";

export interface Scenario {
  scenarioId: ScenarioId;
  caseId: string;
  threadId: string;
  customerId: string;
  /** Inbound emails in scripted order. */
  emailIds: string[];
  label: { en: string; zh: string };
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  email1: {
    scenarioId: "email1",
    caseId: "CASE-OD-7701",
    threadId: "THR-OD-2026-09",
    customerId: CUSTOMER_JANE.customerId,
    emailIds: ["EM-1-IN-1", "EM-1-IN-2"],
    label: {
      en: "Email 1 — overdraft fee: step-up, auto refund, second-waiver escalation",
      zh: "邮件 1 — 透支费：step-up、自动退费、第二次退费升级",
    },
  },
  email2: {
    scenarioId: "email2",
    caseId: "DSP-10452",
    threadId: "THR-DSP-2026-09",
    customerId: CUSTOMER_JANE.customerId,
    emailIds: ["EM-2-IN-1", "EM-2-IN-1B", "EM-2-IN-2"],
    label: {
      en: "Email 2 — Reg E dispute: clocks, provisional credit, adjudication",
      zh: "邮件 2 — Reg E 争议：法定时钟、临时贷记、人工裁决",
    },
  },
  email3: {
    scenarioId: "email3",
    caseId: "CASE-ATO-3309",
    threadId: "THR-ATO-2026-09",
    customerId: CUSTOMER_JANE.customerId,
    emailIds: ["EM-3-IN-1"],
    label: {
      en: "Email 3 — BEC/ATO: lookalike address, contact-change injection, quarantine",
      zh: "邮件 3 — BEC/ATO：仿冒地址、改联系方式注入、隔离",
    },
  },
};
