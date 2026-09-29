// Dev BFF provider contract (client + server share this file).
// Ported & trimmed from HarnessWindTunnel/shared/provider.ts (Jev decision
// models removed — this prototype only does chat completions).
//
// Raw apiKeys live ONLY in server-data/settings.json (gitignored). The browser
// receives masked keys; the chat proxy injects real keys server-side.
// PRD §8 / Dev Plan §3.3, §11.

export type ProviderId =
  | "openai"
  | "gemini"
  | "openrouter"
  | "deepseek"
  | "kimi"
  | "volcengine"
  | "custom";

export interface ModelInfo {
  id: string;
  recommendation?: string;
  contextWindow?: number;
  isReasoning?: boolean;
  supportsVision?: boolean;
}

/** Provider config — the shape persisted in server-data/settings.json. */
export interface ProviderConfig {
  providerId: string;
  apiKey?: string;
  apiKeyRef?: string;
  baseUrl?: string;
  defaultModelId?: string;
  modelIds?: string[];
  modelFallbacks?: string[];
  enabled: boolean;
  enableModelFallback?: boolean;
}

export interface AppSettings {
  providers: ProviderConfig[];
  /** Cross-provider fallback switch (settings screen master toggle). */
  enableProviderFallback?: boolean;
}

export interface PresetProvider {
  id: string;
  name: string;
  nameEn: string;
  defaultBaseUrl: string;
  keyPlaceholder: string;
  desc: string;
  descEn: string;
  /**
   * Chinese-region dev providers hidden from the polished demo build
   * (VITE_DEMO=1 → collapsed under "dev options"). Always visible in dev.
   */
  devOnly?: boolean;
  /** Starter model list shown before the live /models fetch succeeds. */
  starterModels: string[];
}

/**
 * Seven always-rendered cards (Dev Plan §11.2): OpenAI / Gemini / OpenRouter /
 * DeepSeek / Kimi / Volcengine Ark / Custom. All speak the OpenAI-compatible
 * /chat/completions protocol (Gemini uses its openai/ compatibility base URL).
 */
export const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    nameEn: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-...",
    desc: "GPT-5 / GPT-4.1 系列",
    descEn: "GPT-5 / GPT-4.1 series",
    starterModels: ["gpt-5.1", "gpt-5.1-mini", "gpt-4.1", "gpt-4o-mini"],
  },
  {
    id: "gemini",
    name: "Gemini (Google)",
    nameEn: "Gemini (Google)",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyPlaceholder: "AIza...",
    desc: "Google Gemini 2.5 系列（OpenAI 兼容端点）",
    descEn: "Google Gemini 2.5 series (OpenAI-compatible endpoint)",
    starterModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    nameEn: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-...",
    desc: "多模型聚合平台",
    descEn: "Multi-model aggregation platform",
    starterModels: [
      "openai/gpt-5.1",
      "google/gemini-2.5-pro",
      "anthropic/claude-sonnet-4",
      "deepseek/deepseek-chat",
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    nameEn: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    keyPlaceholder: "sk-...",
    desc: "DeepSeek-V3 / R1（开发选项）",
    descEn: "DeepSeek-V3 / R1 (dev option)",
    devOnly: true,
    starterModels: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    id: "kimi",
    name: "Kimi (月之暗面)",
    nameEn: "Kimi (Moonshot)",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    keyPlaceholder: "sk-...",
    desc: "Moonshot Kimi（开发选项）",
    descEn: "Moonshot Kimi (dev option)",
    devOnly: true,
    starterModels: ["moonshot-v1-auto", "kimi-k2-turbo-preview", "moonshot-v1-32k"],
  },
  {
    id: "volcengine",
    name: "火山方舟 (豆包)",
    nameEn: "Volcengine Ark (Doubao)",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    keyPlaceholder: "ark-... 或接入点 ID",
    desc: "字节豆包（开发选项）",
    descEn: "ByteDance Doubao (dev option)",
    devOnly: true,
    starterModels: ["doubao-seed-1-6-250615", "doubao-1-5-pro-32k-250115"],
  },
  {
    id: "custom",
    name: "自定义 (OpenAI 兼容)",
    nameEn: "Custom (OpenAI compatible)",
    defaultBaseUrl: "",
    keyPlaceholder: "sk-...",
    desc: "任意 OpenAI 兼容端点",
    descEn: "Any OpenAI-compatible endpoint",
    starterModels: [],
  },
];

export const CUSTOM_PRESET_ID = "custom";

export function presetOf(providerId: string): PresetProvider | undefined {
  return PRESET_PROVIDERS.find((p) => p.id === providerId);
}

export function trimBaseUrl(u: string): string {
  return u.trim().replace(/\/+$/, "");
}

/** Mask a raw key for browser display: sk-abcd…wxyz (never the full key). */
export function maskKey(key: string | undefined): string {
  const k = (key ?? "").trim();
  if (!k) return "";
  if (k.length <= 8) return "••••••••";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}
