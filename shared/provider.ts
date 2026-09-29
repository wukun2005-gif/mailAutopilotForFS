// Dev BFF provider contract (client + server share this file).
// Ported verbatim from HarnessWindTunnel/shared/provider.ts — all 15 cards
// (13 chat + 2 Jev decision). Decision cards use POST {baseUrl}/systemone
// (not /chat/completions) and can be enabled alongside any chat provider.
//
// Raw apiKeys live ONLY in server-data/settings.json (gitignored). The browser
// receives masked keys; the chat proxy injects real keys server-side.
// PRD §8 / Dev Plan §3.3, §11.

export type ProviderId =
  | "kimi" | "glm" | "minimax" | "mimo" | "deepseek" | "gemini"
  | "qwen" | "bedrock" | "openrouter" | "opencode" | "volcengine" | "bailian"
  | "typesafe" | "opencode-jev";

export interface ModelInfo {
  id: string;
  recommendation?: string;
  rpm?: number;
  rpd?: number;
  tpm?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  isReasoning?: boolean;
  supportsVision?: boolean;
  supportsStructuredOutput?: boolean;
  supportsFunctionCalling?: boolean;
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
  enableProviderFallback?: boolean;
  /** 判定模型 Provider 回退（失败时按排列顺序切换至下一张可用判定卡）。默认 true。 */
  enableDecisionProviderFallback?: boolean;
}

export interface PresetProvider {
  id: string;
  name: string;
  nameEn?: string;
  defaultBaseUrl: string;
  keyPlaceholder: string;
  desc: string;
  descEn?: string;
  /**
   * "chat"（默认）= 可被选作主模型跑 chat；"decision" = 判定模型（System One），
   * 只服务判分/闸门类复核，不能被选成主 chat 目标（该端点没有 /chat/completions）。
   */
  kind?: "chat" | "decision";
  /** Starter model list shown before the live /models fetch succeeds. */
  starterModels?: string[];
}

/** All 15 cards are always rendered; the last two are Jev decision models. */
export const PRESET_PROVIDERS: PresetProvider[] = [
  { id: "gemini", name: "Gemini (Google)", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta", keyPlaceholder: "AIza...", desc: "Google Gemini 系列", descEn: "Google Gemini series", starterModels: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"] },
  { id: "openrouter", name: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1", keyPlaceholder: "sk-or-...", desc: "多模型聚合平台", descEn: "Multi-model aggregation platform", starterModels: ["openai/gpt-5.1", "google/gemini-2.5-pro", "anthropic/claude-sonnet-4", "deepseek/deepseek-chat"] },
  { id: "deepseek", name: "DeepSeek", defaultBaseUrl: "https://api.deepseek.com/v1", keyPlaceholder: "sk-...", desc: "DeepSeek AI", starterModels: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "qwen", name: "Qwen (通义千问)", nameEn: "Qwen (Tongyi)", defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", keyPlaceholder: "sk-...", desc: "阿里通义千问", descEn: "Alibaba Tongyi Qianwen", starterModels: ["qwen-max", "qwen-plus", "qwen-turbo"] },
  { id: "kimi", name: "Kimi (月之暗面)", nameEn: "Kimi (Moonshot)", defaultBaseUrl: "https://api.moonshot.cn/v1", keyPlaceholder: "sk-...", desc: "月之暗面 Kimi", descEn: "Moonshot AI Kimi", starterModels: ["moonshot-v1-auto", "kimi-k2-turbo-preview", "moonshot-v1-32k"] },
  { id: "glm", name: "GLM (智谱)", nameEn: "GLM (Zhipu)", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4", keyPlaceholder: "...", desc: "智谱 GLM", descEn: "Zhipu GLM", starterModels: ["glm-4-plus", "glm-4-air", "glm-4-flash"] },
  { id: "minimax", name: "MiniMax", defaultBaseUrl: "https://api.minimax.chat/v1", keyPlaceholder: "eyJhb...", desc: "MiniMax AI", starterModels: ["MiniMax-Text-01", "abab6.5s-chat"] },
  { id: "opencode", name: "OpenCode", defaultBaseUrl: "https://opencode.ai/v1", keyPlaceholder: "sk-...", desc: "OpenCode AI", starterModels: ["grok-code-fast-1", "claude-sonnet-4-5"] },
  { id: "mimo", name: "MiMo (Xiaomi)", defaultBaseUrl: "https://api.xiaomi.com/v1", keyPlaceholder: "tp-...", desc: "小米 MiMo", descEn: "Xiaomi MiMo", starterModels: ["mimo-7b-chat", "mimo-7b-rl"] },
  { id: "volcengine", name: "Volcengine (火山引擎)", nameEn: "Volcengine", defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3", keyPlaceholder: "ark-...", desc: "火山引擎豆包", descEn: "Volcengine Doubao", starterModels: ["doubao-seed-1-6-250615", "doubao-1-5-pro-32k-250115"] },
  { id: "bailian", name: "Bailian (百炼/阿里)", nameEn: "Bailian (Alibaba)", defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", keyPlaceholder: "sk-...", desc: "阿里百炼", descEn: "Alibaba Bailian", starterModels: ["qwen-max", "qwen-plus", "qwen-turbo"] },
  { id: "bedrock", name: "AWS Bedrock", defaultBaseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com", keyPlaceholder: "AWS access key ID", desc: "Amazon Bedrock", starterModels: ["anthropic.claude-sonnet-4", "amazon.nova-pro-v1"] },
  { id: "custom", name: "Custom (OpenAI Compatible)", defaultBaseUrl: "", keyPlaceholder: "sk-...", desc: "自定义 OpenAI 兼容端点", descEn: "Custom OpenAI-compatible endpoint", starterModels: [] },
  // ── 判定模型（非 chat）：TypeSafe Jev / OpenCode Jev ──
  // 端点 POST {baseUrl}/systemone（Bearer），不是 OpenAI 兼容端点。
  { id: "typesafe", name: "TypeSafe Jev (判定模型)", nameEn: "TypeSafe Jev (decision model)", defaultBaseUrl: "https://api.typesafe.ai/v1", keyPlaceholder: "TypeSafe API key", desc: "判定模型（非 chat）：判分复核 / 闸门预筛，与主模型并行启用", descEn: "Decision model (not chat): judging cross-check, runs alongside the main model", kind: "decision", starterModels: ["jev-1.13.0", "jev-latest", "jev-preview"] },
  { id: "opencode-jev", name: "OpenCode Jev (判定模型)", nameEn: "OpenCode Jev (decision model)", defaultBaseUrl: "https://opencode.ai/zen/v1", keyPlaceholder: "OpenCode Console API key", desc: "判定模型（非 chat）：OpenCode Console 托管的 Jev，判分复核 / 闸门预筛", descEn: "Decision model (not chat): Jev hosted by OpenCode Console, judging cross-check", kind: "decision", starterModels: ["jev-1.13", "jev-1.13-free"] },
];

export const CUSTOM_PRESET_ID = "custom";

/** 判定模型 provider（System One 协议，非 OpenAI 兼容）。 */
export const DECISION_PROVIDER_IDS: string[] = ["typesafe", "opencode-jev"];

/** true = 判定模型，不能当主 chat 目标。 */
export function isDecisionProvider(providerId: string): boolean {
  const preset = PRESET_PROVIDERS.find((p) => p.id === providerId);
  if (preset) return preset.kind === "decision";
  return DECISION_PROVIDER_IDS.includes(providerId);
}

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
