// Recorded fraud / ATO signals per scenario (handler #9). Email 3 is the
// quarantine case; 1 and 2 are clean (email 2 still verified at I2).
import type { FraudSignals } from "./types.ts";

export const FRAUD_SIGNALS: Record<"email1" | "email2" | "email3", FraudSignals> = {
  email1: {
    scenarioId: "email1",
    localPartLookalike: false,
    displayNameSpoof: false,
    atoScore: 3,
    promptInjection: false,
    r3ComboRequested: false,
    profileContactChangeRequest: false,
    notes: {
      zh: "无欺诈信号；地址在档，SPF/DKIM/DMARC 全部通过。",
      en: "No fraud signals; address on file, SPF/DKIM/DMARC all pass.",
    },
  },
  email2: {
    scenarioId: "email2",
    localPartLookalike: false,
    displayNameSpoof: false,
    atoScore: 6,
    promptInjection: false,
    r3ComboRequested: false,
    profileContactChangeRequest: false,
    notes: {
      zh: "无欺诈/ATO 信号；近 30 天联系方式无变更。",
      en: "No fraud/ATO signals; no contact-detail changes in 30 days.",
    },
  },
  email3: {
    scenarioId: "email3",
    localPartLookalike: true, // jane.d0e vs on-file jane.doe
    displayNameSpoof: true,
    atoScore: 91,
    promptInjection: true, // white-on-white "skip OTP" in attached image
    r3ComboRequested: true, // phone change + ship card to new address
    profileContactChangeRequest: true,
    notes: {
      zh: "发件显示名仿冒 + 本地部分近似；附件含白字注入；R3 组合请求；ATO 综合分 91。进欺诈隔离，仅向档案手机号外发确认。",
      en: "Display-name spoof + local-part lookalike; hidden injection in attachment; R3 combo; ATO score 91. Quarantine; on-file phone confirmation only.",
    },
  },
};
