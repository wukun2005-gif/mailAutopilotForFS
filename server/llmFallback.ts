// Two-level fallback orchestration (ported from HarnessWindTunnel):
// 5xx/timeout/network → retry same target twice with backoff; then per-card
// model chain; then cross-provider chain. 401 stops the whole chain.
// Content-level validate() failure moves straight to the next target.
import {
  chatCompletion,
  modelChain,
  providerFallbackEnabled,
  resolveChatTargets,
  type ChatRequest,
  type ChatResponse,
  type ResolvedTarget,
} from "./llmClient.ts";

export interface ChatResponseWithFallback extends ChatResponse {
  used: { providerId: string; model: string };
  switchedFrom?: { providerId: string; model: string; reason: string };
}

export interface ChatFallbackOptions {
  validate?: (text: string) => void;
  timeoutMs?: number;
}

type FbClass =
  | "auth"
  | "bad-request"
  | "quota"
  | "server"
  | "timeout"
  | "validate"
  | "network";

function classifyFallback(err: unknown): FbClass {
  if (err instanceof Error) {
    const kind = (err as Error & { kind?: string }).kind;
    if (kind === "validate") return "validate";
    if (kind === "timeout") return "timeout";
    const st =
      (err as Error & { status?: number }).status ??
      Number(/LLM API HTTP (\d{3})/.exec(err.message)?.[1] ?? 0);
    if (st === 401) return "auth";
    if (st === 403 || st === 429) return "quota";
    if (st >= 500) return "server";
    if (st >= 400) return "bad-request";
  }
  return "network";
}

const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

export async function chatCompletionWithFallback(
  primary: ResolvedTarget,
  req: ChatRequest,
  opts: ChatFallbackOptions = {},
): Promise<ChatResponseWithFallback> {
  const origin = { providerId: primary.providerId, model: primary.model };
  const attempts: string[] = [];
  let lastErr: unknown = null;
  let modelTries = 0;
  const MAX_TOTAL_ATTEMPTS = 8;
  const timeoutMs =
    opts.timeoutMs ??
    (Number(process.env["EAP_FB_TIMEOUT_MS"] ?? "") || 120_000);
  const backoffMs: [number, number] = [500, 1500];

  const callOnce = async (
    t: ResolvedTarget,
    m: string,
  ): Promise<ChatResponse> => {
    const ctrl = new AbortController();
    if (req.signal) {
      if (req.signal.aborted) ctrl.abort();
      else
        req.signal.addEventListener("abort", () => ctrl.abort(), {
          once: true,
        });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, timeoutMs);
    try {
      const res = await chatCompletion(
        { ...t, model: m },
        { ...req, signal: ctrl.signal },
      );
      if (opts.validate) opts.validate(res.text);
      return res;
    } catch (err) {
      if (timedOut && !req.signal?.aborted) {
        const e = new Error(`LLM 请求超时（${timeoutMs}ms）`) as Error & {
          kind?: string;
        };
        e.kind = "timeout";
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  const runCard = async (
    t: ResolvedTarget,
  ): Promise<ChatResponseWithFallback> => {
    const models = modelChain(t);
    for (const m of models) {
      if (modelTries >= MAX_TOTAL_ATTEMPTS)
        throw new Error(
          `回退尝试已达 ${MAX_TOTAL_ATTEMPTS} 次上限：${attempts.join("；")}`,
        );
      modelTries++;
      let retries = 0;
      for (;;) {
        try {
          const res = await callOnce(t, m);
          const used = { providerId: t.providerId, model: m };
          if (
            used.providerId === origin.providerId &&
            used.model === origin.model
          )
            return { ...res, used };
          return {
            ...res,
            used,
            switchedFrom: { ...origin, reason: attempts[0] ?? "" },
          };
        } catch (err) {
          if (req.signal?.aborted) throw err;
          const cls = classifyFallback(err);
          if (cls === "auth") throw err;
          if (
            retries < 2 &&
            (cls === "server" || cls === "timeout" || cls === "network")
          ) {
            retries++;
            await sleep(backoffMs[retries - 1] ?? 0);
            continue;
          }
          attempts.push(
            `${t.providerId}/${m}: ${err instanceof Error ? err.message : String(err)}`,
          );
          lastErr = err;
          break;
        }
      }
    }
    throw lastErr ?? new Error("no models tried");
  };

  try {
    return await runCard(primary);
  } catch (err) {
    if (req.signal?.aborted) throw err;
    const chain = providerFallbackEnabled()
      ? resolveChatTargets({})
      : { targets: [] as ResolvedTarget[] };
    const candidates =
      "error" in chain
        ? []
        : chain.targets.filter((t) => t.providerId !== primary.providerId);
    if (candidates.length === 0) throw err;
    for (const t of candidates) {
      try {
        return await runCard(t);
      } catch (e2) {
        if (req.signal?.aborted) throw e2;
      }
    }
    throw new Error(`所有可用服务商均失败：${attempts.join("；")}`);
  }
}
