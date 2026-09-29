// Dev BFF route handlers (Dev Plan §3.3). Thin HTTP layer over bffSettings +
// llmClient/llmFallback.
import type { Connect } from "vite";
import type { ServerResponse } from "node:http";
import { presetOf } from "../shared/provider.ts";
import { resolveChatTarget } from "./llmClient.ts";
import type { ChatMessage, ChatToolSpec } from "./llmClient.ts";
import { chatCompletionWithFallback } from "./llmFallback.ts";
import { persistProviders, publicSettings, rawKeyOf, storedBundle } from "./bffSettings.ts";

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function readJson(
  req: Connect.IncomingMessage,
  limitBytes = 2_000_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    req.on("error", reject);
  });
}

async function handleModels(body: Record<string, unknown>) {
  const providerId = String(body["providerId"] ?? "");
  const preset = presetOf(providerId);
  if (!preset)
    return { status: 400, error: `unknown provider: ${providerId}` };
  const { providers } = storedBundle();
  const row =
    providers.find((p) => p.providerId === providerId) ??
    ({
      providerId,
      baseUrl: String(body["baseUrl"] ?? preset.defaultBaseUrl),
      apiKeyRef: String(body["apiKey"] ?? ""),
    });
  const baseUrl = (row.baseUrl || preset.defaultBaseUrl || "").trim().replace(/\/+$/, "");
  const key = rawKeyOf(row) || String(body["apiKey"] ?? "");
  if (!baseUrl)
    return { status: 400, error: "缺少 baseUrl", models: preset.starterModels ?? [] };
  if (!key)
    return { status: 200, models: preset.starterModels ?? [], fromApi: false };
  try {
    const r = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok)
      return {
        status: 200,
        models: preset.starterModels ?? [],
        fromApi: false,
        fetchError: `HTTP ${r.status}`,
      };
    const data = (await r.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? [])
      .map((m) => m.id)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    return {
      status: 200,
      models: ids.length > 0 ? ids : preset.starterModels ?? [],
      fromApi: ids.length > 0,
    };
  } catch (e) {
    return {
      status: 200,
      models: preset.starterModels ?? [],
      fromApi: false,
      fetchError: e instanceof Error ? e.message : String(e),
    };
  }
}

async function handleVerify(body: Record<string, unknown>) {
  const providerId = body["providerId"]
    ? String(body["providerId"])
    : undefined;
  const model = body["model"] ? String(body["model"]) : undefined;
  const target = resolveChatTarget({ providerId, model });
  if ("error" in target)
    return { status: 400, ok: false as const, error: target.error };
  const started = Date.now();
  try {
    const res = await chatCompletionWithFallback(
      target,
      {
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 1,
        temperature: 0,
      },
      { timeoutMs: 30_000 },
    );
    return {
      status: 200,
      ok: true as const,
      latencyMs: Date.now() - started,
      model: res.used.model,
      providerId: res.used.providerId,
      switchedFrom: res.switchedFrom,
    };
  } catch (e) {
    return {
      status: 200,
      ok: false as const,
      latencyMs: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function handleChat(body: Record<string, unknown>) {
  const messages = body["messages"] as ChatMessage[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0)
    return { status: 400, error: "messages required" };
  const providerId = body["providerId"]
    ? String(body["providerId"])
    : undefined;
  const model = body["model"] ? String(body["model"]) : undefined;
  const target = resolveChatTarget({ providerId, model });
  if ("error" in target) return { status: 400, error: target.error };
  const tools = body["tools"] as ChatToolSpec[] | undefined;
  const res = await chatCompletionWithFallback(target, {
    messages,
    tools: Array.isArray(tools) ? tools : undefined,
    temperature:
      typeof body["temperature"] === "number"
        ? (body["temperature"] as number)
        : 0.2,
    maxTokens:
      typeof body["maxTokens"] === "number"
        ? (body["maxTokens"] as number)
        : undefined,
    seed:
      typeof body["seed"] === "number" ? (body["seed"] as number) : undefined,
  });
  return {
    status: 200,
    text: res.text,
    usage: res.usage,
    stopReason: res.stopReason,
    used: res.used,
    switchedFrom: res.switchedFrom,
  };
}

/** Dispatch an /api/* request. Returns true when it was handled. */
export async function dispatchBff(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  url: string,
): Promise<boolean> {
  const method = req.method ?? "GET";
  if (method === "GET" && url === "/api/settings") {
    sendJson(res, 200, publicSettings());
    return true;
  }
  if (method === "POST" && url === "/api/settings/providers") {
    const r = persistProviders(await readJson(req));
    sendJson(res, r.status, r.status === 200 ? { ok: true } : r);
    return true;
  }
  if (method === "POST" && url === "/api/models") {
    const r = await handleModels(await readJson(req));
    sendJson(res, r.status ?? 200, r);
    return true;
  }
  if (method === "POST" && url === "/api/verify") {
    const r = await handleVerify(await readJson(req));
    sendJson(res, r.status ?? 200, r);
    return true;
  }
  if (method === "POST" && url === "/api/llm/chat") {
    const r = await handleChat(await readJson(req, 4_000_000));
    sendJson(res, r.status ?? 200, r);
    return true;
  }
  return false;
}
