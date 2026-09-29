// LLM client used by the Dev BFF chat proxy. OpenAI-compatible /chat/completions
// protocol only (all preset cards expose one). Target resolution + single
// round live here; the two-level fallback orchestration lives in
// llmFallback.ts (kept under the 300-line/file limit).
import { getSetting } from "./settingsStore.ts";

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
}

export interface ChatToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ChatToolSpec[];
  temperature?: number;
  seed?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  usage: ChatUsage | null;
  stopReason: string;
}

export interface ResolvedTarget {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface StoredProvider {
  providerId?: string;
  apiKeyRef?: string;
  apiKey?: string;
  baseUrl?: string;
  modelIds?: string[];
  defaultModelId?: string;
  enabled?: boolean;
  modelFallbacks?: string[];
  enableModelFallback?: boolean;
}

interface StoredBundle {
  providers?: StoredProvider[];
  enableProviderFallback?: boolean;
}

export function readBundle(): {
  providers: StoredProvider[];
  enableProviderFallback: boolean;
} {
  const bundle = getSetting("provider_all") as StoredBundle | null;
  return {
    providers: Array.isArray(bundle?.providers) ? bundle!.providers! : [],
    enableProviderFallback: bundle?.enableProviderFallback ?? true,
  };
}

export function keyOf(p: StoredProvider): string {
  if (p.apiKeyRef) return p.apiKeyRef;
  if (p.apiKey) return p.apiKey;
  const legacy = getSetting(`provider_${p.providerId}`) as
    | StoredProvider
    | null;
  return legacy?.apiKeyRef ?? legacy?.apiKey ?? "";
}

export function baseUrlOf(p: StoredProvider): string {
  return (p.baseUrl ?? "").trim().replace(/\/+$/, "");
}

export function providerFallbackEnabled(): boolean {
  return readBundle().enableProviderFallback !== false;
}

/** Per-card model chain: primary first, then fallback models if enabled. */
export function modelChain(t: ResolvedTarget): string[] {
  const { providers } = readBundle();
  const row =
    providers.find((p) => p.providerId === t.providerId) ??
    (getSetting(`provider_${t.providerId}`) as StoredProvider | null);
  const list = row?.enableModelFallback ? row?.modelFallbacks ?? [] : [];
  const chain = [t.model];
  for (const m of list) {
    const v = typeof m === "string" ? m.trim() : "";
    if (v && !chain.includes(v)) chain.push(v);
  }
  return chain;
}

/**
 * Usable chat target chain: explicitly-enabled providers with key+baseUrl first
 * (in settings card order), then the rest.
 */
export function resolveChatTargets(opts: {
  providerId?: string;
  model?: string;
} = {}): { targets: ResolvedTarget[] } | { error: string } {
  const { providers } = readBundle();
  const usable = (p: StoredProvider): boolean =>
    !!keyOf(p) && !!baseUrlOf(p);
  const ordered: StoredProvider[] = [
    ...providers.filter((p) => p.enabled && usable(p)),
    ...providers.filter((p) => !(p.enabled && usable(p)) && usable(p)),
  ];

  let primaryRow: StoredProvider | undefined;
  if (opts.providerId) {
    primaryRow = providers.find((p) => p.providerId === opts.providerId);
    if (!primaryRow)
      return { error: `设置中找不到 provider：${opts.providerId}` };
    const at = ordered.indexOf(primaryRow);
    if (at >= 0) ordered.splice(at, 1);
  } else {
    primaryRow = ordered.shift();
    if (!primaryRow)
      return {
        error:
          "尚未在 Provider 设置中配置可用的服务商（需要 baseUrl + API key + 模型）",
      };
  }

  const apiKey = keyOf(primaryRow);
  if (!apiKey)
    return {
      error: `provider ${primaryRow.providerId} 缺少 API key（请到设置页填写）`,
    };
  const baseUrl = baseUrlOf(primaryRow);
  if (!baseUrl)
    return { error: `provider ${primaryRow.providerId} 缺少 baseUrl` };
  const model =
    opts.model?.trim() ||
    primaryRow.defaultModelId ||
    primaryRow.modelIds?.[0] ||
    "";
  if (!model)
    return { error: `provider ${primaryRow.providerId} 未选择模型` };

  const targets: ResolvedTarget[] = [
    { providerId: primaryRow.providerId ?? "custom", baseUrl, apiKey, model },
  ];
  for (const p of ordered) {
    if (p === primaryRow) continue;
    const k = keyOf(p);
    const b = baseUrlOf(p);
    const m = (p.defaultModelId ?? "").trim() || p.modelIds?.[0] || "";
    if (!k || !b || !m) continue;
    targets.push({
      providerId: p.providerId ?? "custom",
      baseUrl: b,
      apiKey: k,
      model: m,
    });
  }
  return { targets };
}

/** Primary chat target (head of the fallback chain) or a settings error. */
export function resolveChatTarget(opts: {
  providerId?: string;
  model?: string;
} = {}): ResolvedTarget | { error: string } {
  const chain = resolveChatTargets(opts);
  if ("error" in chain) return chain;
  return chain.targets[0]!;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** One OpenAI-compatible chat completion round. Throws on transport errors. */
export async function chatCompletion(
  target: ResolvedTarget,
  req: ChatRequest,
): Promise<ChatResponse> {
  const body: Record<string, unknown> = {
    model: target.model,
    messages: req.messages.map((m) => {
      if (m.role === "tool")
        return {
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        };
      if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    }),
    temperature: req.temperature ?? 0.2,
  };
  if (req.seed != null) body["seed"] = req.seed;
  if (req.maxTokens) body["max_tokens"] = req.maxTokens;
  if (req.tools && req.tools.length > 0) {
    body["tools"] = req.tools;
    body["tool_choice"] = "auto";
  }

  const started = Date.now();
  const where = `${target.providerId}/${target.model}`;
  const r = await fetch(`${target.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${target.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: req.signal ?? AbortSignal.timeout(120_000),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    const err = new Error(
      `LLM API HTTP ${r.status}: ${text.slice(0, 400)}`,
    ) as Error & { status?: number };
    err.status = r.status;
    console.warn(
      `[llm] HTTP ${r.status} ← ${where} ${Date.now() - started}ms`,
    );
    throw err;
  }

  const data = (await r.json()) as {
    choices?: Array<{
      message?: { content?: string | null };
      finish_reason?: string;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const choice = data.choices?.[0];
  if (!choice) throw new Error("LLM API 返回缺少 choices");

  const usage: ChatUsage | null = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens:
          data.usage.total_tokens ??
          (data.usage.prompt_tokens ?? 0) +
            (data.usage.completion_tokens ?? 0),
      }
    : null;

  return {
    text: choice.message?.content ?? "",
    usage:
      usage ??
      (() => {
        const n = estimateTokens(
          req.messages.map((m) => m.content).join(""),
        );
        return { promptTokens: 0, completionTokens: n, totalTokens: n };
      })(),
    stopReason: choice.finish_reason ?? "stop",
  };
}
