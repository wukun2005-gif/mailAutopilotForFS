// i18next bootstrap — en default, zh switchable; persisted in localStorage.
// Default is English: detection only reads localStorage (no navigator), and
// an empty/unknown detection falls back to `fallbackLng: "en"`.
// Seven namespaces: common + one per screen + demo. Resources are statically
// bundled (no async backend); M8 wires i18next-parser for missing-key audit.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhCommon from "../locales/zh/common.json";
import zhCustomer from "../locales/zh/customer.json";
import zhAgent from "../locales/zh/agent.json";
import zhSupervisor from "../locales/zh/supervisor.json";
import zhBuilder from "../locales/zh/builder.json";
import zhSettings from "../locales/zh/settings.json";
import zhDemo from "../locales/zh/demo.json";

import enCommon from "../locales/en/common.json";
import enCustomer from "../locales/en/customer.json";
import enAgent from "../locales/en/agent.json";
import enSupervisor from "../locales/en/supervisor.json";
import enBuilder from "../locales/en/builder.json";
import enSettings from "../locales/en/settings.json";
import enDemo from "../locales/en/demo.json";

export const NAMESPACES = [
  "common",
  "customer",
  "agent",
  "supervisor",
  "builder",
  "settings",
  "demo",
] as const;

export type AppNamespace = (typeof NAMESPACES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["zh", "en"],
    nonExplicitSupportedLngs: true,
    defaultNS: "common",
    ns: NAMESPACES as unknown as string[],
    resources: {
      zh: {
        common: zhCommon,
        customer: zhCustomer,
        agent: zhAgent,
        supervisor: zhSupervisor,
        builder: zhBuilder,
        settings: zhSettings,
        demo: zhDemo,
      },
      en: {
        common: enCommon,
        customer: enCustomer,
        agent: enAgent,
        supervisor: enSupervisor,
        builder: enBuilder,
        settings: enSettings,
        demo: enDemo,
      },
    },
    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "eap.lang",
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
