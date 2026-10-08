// ══════════════════════════════════════════════════════════════════════════
// answer-comment — the deck answers a reader's comment by itself.
//
// Retrieval pipeline ported from patentExaminator, keeping its structure, its
// providers and its numbers:
//   · hybrid retrieval     (hybridSearch.ts)       → vector + keyword, RRF k=60
//   · cross-encoder rerank (toolExecutor.ts:401)   → SiliconFlow bge-reranker-v2-m3
//                                                   (wired, opt-in — ON since
//                                                    2026-10-08, see rerankStage)
//   · heuristic rerank     (reranker.ts tier 3)    → five weighted signals (fallback)
//   · threshold + MMR      (orchestrator.ts)       → 0.7 × top, floor 0.1, λ=0.7
//   · grounded prompt      (orchestrator.ts)       → "## Reference material" + rules
//   · model fallback       (llmFallback.ts)        → walk the chain on failure
//
// Embedding and reranking run on the SAME provider patentExaminator uses —
// SiliconFlow (BAAI/bge-m3, BAAI/bge-reranker-v2-m3) — so a chunk's vector and
// its rerank score mean the same thing in both projects. bge-m3 is 1024-dim,
// which is why kb_chunks.embedding needed no migration when we switched.
//
// Two adaptations, both forced by the runtime:
//   · patentExaminator's tier 2 (a local ONNX cross-encoder) cannot exist here
//     — an Edge Function cannot load a model — so the chain is two tiers:
//     remote rerank → heuristic.
//   · keyword search goes through Postgres instead of an in-memory index,
//     because an Edge Function is stateless (bigrams are precomputed at ingest)
//
// Zero dependencies on purpose: an API deploy does not bundle remote imports,
// and a failed import means 503 BOOT_ERROR (learned the hard way, see
// notify-reply).
//
// Secrets: SILICONFLOW_BASE_URL, SILICONFLOW_API_KEY, BAILIAN_BASE_URL,
//          BAILIAN_API_KEY, BAILIAN_CHAT_MODEL, AI_ANSWER_ENABLED,
//          WEBHOOK_SECRET
// ══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = (function () {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  for (const name of ["SUPABASE_SECRET_KEYS", "SUPABASE_PUBLISHABLE_KEYS"]) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const first = parsed?.default ?? Object.values(parsed ?? {})[0];
      if (first) return String(first);
    } catch (_) { /* not a JSON dictionary */ }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
})();

/* Retrieval providers — SiliconFlow, the same account and models
   patentExaminator is configured with (its settings DB: providerId=siliconflow,
   baseUrl=https://api.siliconflow.cn/v1, BAAI/bge-m3 + BAAI/bge-reranker-v2-m3). */
const SF_BASE = (Deno.env.get("SILICONFLOW_BASE_URL") ?? "https://api.siliconflow.cn/v1").replace(/\/+$/, "");
const SF_KEY = Deno.env.get("SILICONFLOW_API_KEY") ?? "";
const EMBED_MODEL = Deno.env.get("SILICONFLOW_EMBED_MODEL") ?? "BAAI/bge-m3";
const RERANK_MODEL = Deno.env.get("SILICONFLOW_RERANK_MODEL") ?? "BAAI/bge-reranker-v2-m3";
/* Opt-in. ON since 2026-10-08 by the owner's call; the measured trade-off of
   turning it on is written up in rerankStage(). */
const RERANK_ENABLED = (Deno.env.get("SILICONFLOW_RERANK_ENABLED") ?? "false") === "true";

/* Generation still runs on the owner's free Bailian models — only retrieval
   moved to SiliconFlow. */
const BAILIAN_BASE = (Deno.env.get("BAILIAN_BASE_URL") ?? "").replace(/\/+$/, "");
const BAILIAN_KEY = Deno.env.get("BAILIAN_API_KEY") ?? "";
const CHAT_MODEL = Deno.env.get("BAILIAN_CHAT_MODEL") ?? "qwen-plus";

/* Model fallback chain, in the spirit of llmFallback.ts: first model that
   answers wins, the rest are safety nets.
   Order was measured against this account (2026-10-08): qwen-plus / qwen-flash
   / qwen-turbo / qwen3.7-flash / deepseek-v4-flash all return 403 "free quota
   exhausted" and each failed attempt costs 2–4s, so they are not in the chain
   at all. deepseek-v4-flash-0731 answers in ~3s with almost no reasoning
   tokens; qwen3.7-flash works but spends ~160 reasoning tokens on a one-word
   reply, so it is kept only as the last resort. */
/* The owner's chain: free LLM and multimodal models, in the order they gave
   (least remaining quota first, so nothing expires unused).
   Four of their fourteen are not in it, each for a measured reason:
     · qwen3.8-2.4t-a95b, glm-5.3, qwen-mt-uni → HTTP 400 on
       /chat/completions (not callable this way)
     · qwen3.8-omni-flash-realtime → realtime endpoint, returns empty here
   Leaving them in would cost 2–4 seconds of dead time per attempt. */
const FALLBACK_MODELS = [
  "qwen3.7-flash-2026-07-15",
  "deepseek-v4-flash-0731",
  "qwen3.8-max",
  "deepseek-v4-pro-0813",
  "qwen3.8-27b",
  "kimi-k3",
  "qwen3.8-flash",
  "qwen3.8-max-0902",
  "deepseek-v4.1-flash",
  "qwen3.8-omni-flash",
];

/* The owner can switch models from the gear panel (deck_ai_config); whatever
   is configured goes first and the rest stay as safety nets. */
let preferredModel = CHAT_MODEL;
const modelChain = () =>
  [preferredModel, ...FALLBACK_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);

/* ── pipeline constants (patentExaminator values, unchanged) ───────────── */
const TOP_K = 15;                 // orchestrator.ts RAG internal top-k
const REL_THRESHOLD = 0.7;        // ... score >= topScore * 0.7
const ABS_FLOOR = 0.1;            // ... and >= 0.1 absolute
const MMR_LAMBDA = 0.7;           // ... MMR diversity
const RERANK_WEIGHTS = {          // reranker.ts DEFAULT_CONFIG
  semantic: 0.4,
  keyword: 0.25,
  section: 0.15,
  page: 0.15,
  depth: 0.05,
};
/* Six chunks is enough to answer a slide question and keeps the prompt short,
   which directly cuts generation time; 1600 was more room than the answers
   ever used (the default model barely reasons), and a shorter ceiling means a
   faster finish. */
const MAX_CONTEXT_CHUNKS = 4;
const ANSWER_MAX_TOKENS = 800;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/* ── keyword text: bigrams for CJK + words for latin (mirrors kb-ingest) ── */
const STOP = new Set(["the","and","for","with","that","this","from","are","was","were","has","have","not","but","its","into","any","all","can","will","our","their","they","when","what","which","who","how","why","you","your","one","two","may","also","than","then","them","these","those","been","more","most","such","only","other","over","under","after","before","between","each","same","some","very","does","did","about","would","could","should"]);
function bigramQuery(text: string): string {
  const out = new Set<string>();
  for (const run of text.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2));
  }
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) if (!STOP.has(w)) out.add(w);
  return [...out].join(" | ");
}

/* ── SiliconFlow: embeddings (retrieval side) ──────────────────────────── */
async function embed(texts: string[]): Promise<number[][]> {
  const r = await fetch(`${SF_BASE}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SF_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map((t) => (t.length > 4000 ? t.slice(0, 4000) : t)) }),
  });
  if (!r.ok) throw new Error(`embed ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return (d.data ?? []).sort((a: any, b: any) => a.index - b.index).map((x: any) => x.embedding);
}

/* ── Bailian: generation only ──────────────────────────────────────────── */
async function chatOnce(model: string, messages: unknown[], maxTokens: number): Promise<string> {
  const r = await fetch(`${BAILIAN_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${BAILIAN_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      /* Turn the thinking off. These models reason before answering by
         default, and the thinking is billed against max_tokens: with a 800
         ceiling a question could burn 1400–3600 reasoning tokens, hit
         finish_reason=length, and return an EMPTY answer — which looked like
         a flaky model and cost a fallback to a slower one. With thinking
         disabled the same questions answer in ~3s instead of 5–25s, with
         nothing lost: the deck's questions are about its own documents, not
         puzzles. */
      enable_thinking: false,
    }),
  });
  if (!r.ok) throw new Error(`chat ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text = (d.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("empty completion");
  return text;
}

/** Walk the chain like llmFallback.ts: first model that answers wins. */
async function chat(messages: unknown[], maxTokens = ANSWER_MAX_TOKENS) {
  const errors: string[] = [];
  for (const model of modelChain()) {
    /* Retry the same model once before moving down the chain. The primary
       model fails intermittently on Chinese input (roughly one call in four
       in testing); a single retry usually lands, and it is far cheaper than
       falling through to the only other usable model, which reasons its way
       through ~1100 tokens and takes five times as long. */
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const text = await chatOnce(model, messages, maxTokens);
        return { text, model, errors };
      } catch (e) {
        errors.push(`${model}#${attempt}: ${String(e).slice(0, 100)}`);
        if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  throw new Error(`all models failed — ${errors.join(" | ")}`);
}

/* ── retrieval ─────────────────────────────────────────────────────────── */
type Hit = {
  chunk_id: number; source: string; label: string; section: string | null;
  page_key: string | null; body: string; vec_score: number; kw_score: number; score: number;
};
/** A hit plus the ranking value the rerank stage assigned it. */
type Ranked = Hit & { rerank: number };

async function search(vec: number[], bigrams: string, pageKey: string | null): Promise<Hit[]> {
  const rows = await rest("rpc/kb_search", {
    method: "POST",
    body: JSON.stringify({
      q_embedding: `[${vec.join(",")}]`,
      q_bigrams: bigrams,
      q_page_key: pageKey,
      q_limit: TOP_K,
    }),
  });
  return (rows ?? []) as Hit[];
}

/** Heuristic rerank — patentExaminator reranker.ts tier 3, five signals. */
function rerank(query: string, pageKey: string | null, hits: Hit[]): Ranked[] {
  if (!hits.length) return hits;
  const qWords = new Set((query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []).filter((w) => !STOP.has(w)));
  const qCjk = (query.match(/[\u4e00-\u9fff]+/g) ?? []).join("");
  const maxVec = Math.max(...hits.map((h) => h.vec_score), 0.0001);
  const maxKw = Math.max(...hits.map((h) => h.kw_score), 0.0001);
  const maxRrf = Math.max(...hits.map((h) => h.score), 0.0001);

  return hits
    .map((h) => {
      const body = h.body.toLowerCase();
      const overlap = [...qWords].filter((w) => body.includes(w)).length / (qWords.size || 1);
      const cjkHit = qCjk ? ([...new Set(qCjk.split("").concat(qCjk.match(/../g) ?? []))].filter((g) => g && h.body.includes(g)).length / 8) : 0;
      const keyword = Math.min(1, overlap + cjkHit);
      const sectionHit = h.section && qWords.size
        ? [...qWords].some((w) => (h.section ?? "").toLowerCase().includes(w)) ? 1 : 0
        : 0;
      const pageHit = pageKey && h.page_key === pageKey ? 1 : 0;
      // depth: prefer mid-sized chunks — tiny ones lack context, huge ones dilute it
      const len = h.body.length;
      const depth = len < 200 ? 0.3 : len > 1200 ? 0.6 : 1;
      const blended =
        RERANK_WEIGHTS.semantic * (h.vec_score / maxVec) +
        RERANK_WEIGHTS.keyword * Math.max(keyword, h.kw_score / maxKw) +
        RERANK_WEIGHTS.section * sectionHit +
        RERANK_WEIGHTS.page * pageHit +
        RERANK_WEIGHTS.depth * depth;
      return { ...h, rerank: 0.6 * blended + 0.4 * (h.score / maxRrf) };
    })
    .sort((a, b) => (b as any).rerank - (a as any).rerank);
}

/** Remote cross-encoder — patentExaminator's tier 1 (toolExecutor.ts:401-434).
 *  POST {base}/rerank {model, query, documents, top_n}, 30s ceiling. Like
 *  patentExaminator we hand the reranker a zero base score and let it rank
 *  alone (its `score: 0` inputs, toolExecutor.ts:394-399): the relevance score
 *  becomes the ranking value, and threshold + MMR then run on it unchanged.
 *  Returns null on any failure so the caller can fall back. */
async function remoteRerank(query: string, hits: Hit[]): Promise<Ranked[] | null> {
  if (!hits.length) return [];
  if (!SF_KEY) return null;
  const res = await fetch(`${SF_BASE}/rerank`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SF_KEY}` },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query,
      documents: hits.map((h) => (h.body.length > 1500 ? h.body.slice(0, 1500) : h.body)),
      top_n: hits.length,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`rerank ${res.status} ${(await res.text()).slice(0, 150)}`);
  const data = await res.json() as { results?: Array<{ index: number; relevance_score: number }> };
  const results = data.results ?? [];
  if (!results.length) return null;
  return results
    .filter((r) => r.index >= 0 && r.index < hits.length)
    .map((r) => ({ ...hits[r.index], rerank: r.relevance_score }))
    .sort((a, b) => b.rerank - a.rerank);
}

/** The chain this runtime permits: remote cross-encoder → five-signal
 *  heuristic. patentExaminator's tier 2 — a local ONNX cross-encoder — cannot
 *  exist in an Edge Function, so that tier is dropped rather than ported.
 *
 *  The remote tier is ON — SILICONFLOW_RERANK_ENABLED=true, the owner's call
 *  (2026-10-08). What the measurement said before it went on is worth keeping,
 *  because the cost does not show up as an error: over 12 reader questions
 *  (4 Chinese / 4 demo-app / 4 English) the cross-encoder and plain RRF both
 *  put the right source in the top-3 11 times out of 12 — but ranking alone
 *  demoted the hybrid retriever's own top-1 chunk in 4 of those 12, and a
 *  0.6/0.4 blend of the two did worse still (10/12). So this is a "no measured
 *  gain, small measured cost" setting chosen deliberately, not an improvement.
 *  The whole tier sits behind the flag: flipping it back to false restores the
 *  previous ordering with no redeploy.
 *
 *  The tier that actually ran is returned to the caller, so this is observable
 *  rather than assumed — a remote-tier failure falls through to the heuristic
 *  silently, and that would otherwise be invisible in production. */
async function rerankStage(
  query: string,
  pageKey: string | null,
  hits: Hit[],
): Promise<{ ranked: Ranked[]; tier: "remote" | "heuristic" }> {
  if (RERANK_ENABLED) {
    try {
      const remote = await remoteRerank(query, hits);
      if (remote?.length) return { ranked: remote, tier: "remote" };
    } catch (_) { /* fall through to the heuristic */ }
  }
  return { ranked: rerank(query, pageKey, hits), tier: "heuristic" };
}

/** Dynamic threshold + MMR (orchestrator.ts): keep what is close to the best,
 *  then drop near-duplicates so the context is not eight copies of one line. */
function select(hits: (Hit & { rerank?: number })[], k: number) {
  if (!hits.length) return [];
  const top = (hits[0] as any).rerank ?? 1;
  const kept = hits.filter((h) => {
    const s = (h as any).rerank ?? 0;
    return s >= top * REL_THRESHOLD && s >= ABS_FLOOR;
  });
  const pool = kept.length ? kept : hits.slice(0, 3);
  const picked: typeof pool = [];
  const jaccard = (a: string, b: string) => {
    const A = new Set(a.slice(0, 400).split(/\s+/));
    const B = new Set(b.slice(0, 400).split(/\s+/));
    const inter = [...A].filter((x) => B.has(x)).length;
    return inter / (A.size + B.size - inter || 1);
  };
  for (const cand of pool) {
    if (picked.length >= k) break;
    const sim = Math.max(0, ...picked.map((p) => jaccard(p.body, cand.body)));
    if (sim <= 1 - MMR_LAMBDA) picked.push(cand);
  }
  // if MMR was too strict, backfill in rank order
  for (const cand of pool) {
    if (picked.length >= k) break;
    if (!picked.includes(cand)) picked.push(cand);
  }
  return picked;
}

/* ── citations ─────────────────────────────────────────────────────────────
   The model is told to cite as [1], [2] …, which the reader never could
   resolve: the numbered list it refers to lives only in the prompt. Two things
   fix that (2026-10-08):
     · every marker becomes a link to the file the cited chunk came from,
     · a legend says what each number is.
   HTML documents link through GitHub Pages — github.com's file view always
   shows HTML as source code and there is no setting to change that — while
   README and code files stay on github.com, where they render as-is.

   This table is kept in step with kb-ingest.mjs SOURCES by hand — seven rows,
   they change about never. `null` means "not published": dev_plan is not in
   the repo, and a link to a 404 is worse than a number the reader cannot
   click. `prototype` is a directory, so its target is the chunk's own section,
   which for code chunks IS the file path (src/runtime/caseRunner.ts …). */
const REPO = "https://github.com/wukun2005-gif/mailAutopilotForFS";
const REPO_REF = "main";
const PAGES = "https://wukun2005-gif.github.io/mailAutopilotForFS";
const SOURCE_PATH: Record<string, string | null> = {
  deck: `${PAGES}/deck-html/`,
  prd_en: `${PAGES}/email-autopilot-fs-prd_en.html`,
  report: `${PAGES}/email-autopilot-research-report-v0.2.html`,
  backlog: `${PAGES}/backlog.html`,
  readme: "README.md",
  dev_plan: null,
  prototype: "\u0000dir",   // per-chunk — see sourceUrl()
};
const DIR = "\u0000dir";

function sourceUrl(h: { source: string; section?: string | null }): string | null {
  const p = SOURCE_PATH[h.source];
  if (p === undefined || p === null) return null;
  if (p === DIR) {
    const f = (h.section ?? "").trim();
    return f ? `${REPO}/blob/${REPO_REF}/${f}` : `${REPO}/blob/${REPO_REF}/README.md`;
  }
  if (p.startsWith("https://")) return p;   // already absolute (Pages)
  return `${REPO}/blob/${REPO_REF}/${p}`;
}

/* A markdown link the deck's renderer understands. The label must not contain
   brackets and the URL must not contain whitespace or the renderer stops at the
   closing paren — so both are sanitised here rather than trusted. */
const mdLink = (label: string, url: string) =>
  `[${label.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim()}](${url.replace(/[\s()]/g, "")})`;

/** What a cited number is, in words: "PRD (English) — 2.3 Non-Goals". */
function citeLabel(h: { label: string; section?: string | null }): string {
  const s = (h.section ?? "").trim();
  return s && s !== h.label ? `${h.label} — ${s}` : h.label;
}

/**
 * Rewrite the model's `[n]` markers into links and append a legend.
 *
 * Only markers that really index a retrieved chunk are touched; anything else
 * (the model counting something of its own, a stray bracket) is left exactly as
 * written. The legend lists only the numbers the answer actually used, in the
 * order they first appear, and is omitted entirely when nothing was cited — an
 * empty "Sources:" line would be noise.
 */
function withCitations(text: string, picked: { label: string; section?: string | null; source: string }[]) {
  const cited: number[] = [];
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= picked.length && !cited.includes(n)) cited.push(n);
  }
  if (!cited.length) return text;

  const body = text.replace(/\[(\d{1,2})\]/g, (whole, d) => {
    const n = Number(d);
    if (n < 1 || n > picked.length) return whole;
    const url = sourceUrl(picked[n - 1]);
    return url ? mdLink(d, url) : whole;
  });

  const legend = cited.map((n) => {
    const h = picked[n - 1];
    const url = sourceUrl(h);
    const name = citeLabel(h);
    return url ? `${n}. ${mdLink(name, url)}` : `${n}. ${name} (not published)`;
  });

  return `${body}\n\nSources: ${legend.join(" · ")}`;
}

/* ── prompt (orchestrator.ts buildChatPrompt + citation rules) ─────────── */
/* Which script the comment is written in.
 *
 * Why this is code and not just a prompt rule: the reference material is
 * genuinely mixed — the deck, the PRD and the README are English, the research
 * report is Chinese (38% CJK by volume), and the prototype's preamble is too.
 * Measured over 52 questions (2026-10-08): with the generic rule alone, 3
 * answers came back in Chinese to English questions; every one of the 3 was
 * grounded in the Chinese report, and none of the 40 answers that never touched
 * it drifted. So the model was picking up the material's language. Naming the
 * language outright, per request, removes the inference it was getting wrong.
 *
 * Han count first, ratio only as a tie-break. A ratio test alone is wrong for
 * this domain: "Talkdesk 的 core-bank execution 是什么意思？" is unambiguously a
 * Chinese question, but its English product names outnumber its 6 Han
 * characters, so any proportional threshold calls it English — and the whole
 * point here is to stop English answers reaching Chinese questions. Four Han
 * characters is the floor because that is about where a real Chinese sentence
 * starts; the ratio clause picks up short ones like "几点？". A lone Chinese word
 * quoted inside an English sentence stays under both and is left alone.
 *
 * `null` means "no letters at all" (digits, emoji, punctuation), where taking a
 * side would be guesswork. */
function commentScript(text: string): "Chinese" | "English" | null {
  const s = String(text ?? "");
  const han = (s.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  if (han + latin === 0) return null;
  if (han >= 4) return "Chinese";
  if (han >= 2 && han / (han + latin) >= 0.5) return "Chinese";
  return "English";
}

function buildMessages(o: {
  comment: string; author: string; pageTitle: string; quote: string | null; hits: any[];
}) {
  const refs = o.hits.map((h, i) =>
    `[${i + 1}] ${h.label}${h.section ? " — " + h.section : ""}${h.page_key ? ` (deck page: ${h.page_key})` : ""}\n${h.body}`
  ).join("\n\n");

  /* Answer in the reader's own language (owner's call, 2026-10-08). Product
     terms, clause numbers and slide titles stay in English on purpose: the
     deck, the PRD and the report are English, and a translated term would no
     longer match anything a reader can look up.

     The language is stated, not implied — see commentScript() above for why the
     generic version of this rule was not enough. */
  const script = commentScript(o.comment);
  const system = [
    "You are the author of a case-study deck about an email-automation product for banks (fictional Larkspur Bank).",
    "A reviewer left a comment on one of the slides. Answer it yourself, in the author's voice.",
    "",
    "## Rules (must follow)",
    "- Ground every factual claim in the reference material below. If it does not cover the question, say so plainly and do not invent numbers, clause references, or commitments.",
    "- Cite the sources you use inline as [1], [2] — e.g. \"the clock starts at intake (see [1])\".",
    "- Each number is turned into a link to the file it came from, so only cite a number that really supports the claim. Cite the ones you lean on; do not pad.",
    "- Be concise: 2–3 sentences, or a short list when the question has parts. No preamble, no restating the question.",
    "- This is a case study, not a bank: never promise anything on a real institution's behalf.",
    "- If the comment is praise or chit-chat rather than a question, reply briefly and warmly (one sentence).",
    "",
    "## Reference material",
    refs || "(no matching material was retrieved — say that you could not find it in the deck's sources)",
    "",
    "## Language",
    script
      ? `The comment is written in ${script}. Write the whole answer in ${script}. The reference material above is part English and part Chinese — answer in the comment's language, never in the material's.`
      : "Answer in the same language the comment is written in.",
    "Keep product terms, clause references and slide titles in their original English form.",
  ].join("\n");

  const context = [
    `Slide: ${o.pageTitle}`,
    o.quote ? `Phrase the comment is attached to: "${o.quote}"` : "",
    `Reviewer (${o.author}) wrote: ${o.comment}`,
  ].filter(Boolean).join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: context },
  ];
}

/* ── handler ───────────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  const started = Date.now();
  try {
    /* Two callers, two levels of trust.
       · The database trigger (x-webhook-secret) is trusted outright.
       · The browser calls this straight after posting, so the answer does not
         have to wait in pg_net's queue — that queue alone added 5–6 seconds to
         every answer. A browser caller is not trusted, so it must name a
         comment that really exists, and the atomic claim below still allows
         exactly one answer per comment: the worst a stranger can do is ask the
         deck to answer a comment that is already sitting there. */
    const secret = Deno.env.get("WEBHOOK_SECRET");
    const fromTrigger = !!secret && req.headers.get("x-webhook-secret") === secret;
    /* Owner configuration wins over the secret: the gear panel can switch
       answering off, or point it at a different model, without a redeploy. */
    try {
      const cfg = (await rest("deck_ai_config?id=eq.1&select=enabled,model"))?.[0];
      if (cfg && cfg.enabled === false) {
        return json({ ok: true, skipped: "ai answering switched off by the owner" });
      }
      if (cfg?.model) preferredModel = String(cfg.model);
    } catch (_) {
      if ((Deno.env.get("AI_ANSWER_ENABLED") ?? "true") !== "true") {
        return json({ ok: true, skipped: "ai answering disabled" });
      }
    }

    const payload = await req.json();
    const rec = payload?.record ?? payload;
    if (!rec?.id) return json({ ok: false, skipped: "no record" });

    if (!fromTrigger) {
      /* An untrusted caller only gets to say *which* comment to answer — the
         stored row is what we actually work from, so a caller cannot invent a
         comment, a page, or a quote. */
      const stored = await rest(
        `deck_comments?id=eq.${rec.id}&select=id,deck_id,page_key,page_index,page_title,author,email,body,quote,parent_id`
      );
      if (!stored?.length) return json({ error: "unknown comment" }, 404);
      Object.assign(rec, stored[0]);
    }

    if (!rec.body) return json({ ok: false, skipped: "no body" });
    // only top-level comments, and never answer our own answers
    if (rec.parent_id) return json({ ok: true, skipped: "reply, not a top-level comment" });
    if ((rec.author ?? "") === "Deck AI") return json({ ok: true, skipped: "own comment" });

    /* ── idempotency: exactly one answer per comment ──
       An atomic claim, not a read-then-write. The trigger fires the moment a
       comment lands, so a second invocation can easily arrive while the first
       is still running; a plain "is it sent yet?" check lets that second one
       through and the comment ends up with two answers (observed in testing).
       Inserting with ignore-duplicates makes the primary key do the deciding:
       whoever wins the insert owns the work, everyone else backs off. A row
       left in 'failed' is the one case that may be retried. */
    const claimed = await rest("deck_ai_answers?on_conflict=comment_id", {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({ comment_id: rec.id, status: "running" }),
    }).catch(() => null);

    if (!claimed?.length) {
      const cur = await rest(`deck_ai_answers?comment_id=eq.${rec.id}&select=status`);
      const status = cur?.[0]?.status;
      if (status === "sent") return json({ ok: true, skipped: "already answered" });
      if (status !== "failed") return json({ ok: true, skipped: `already ${status ?? "claimed"}` });
      const taken = await rest(`deck_ai_answers?comment_id=eq.${rec.id}&status=eq.failed`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ status: "running", error: null }),
      }).catch(() => null);
      if (!taken?.length) return json({ ok: true, skipped: "already claimed" });
    }

    /* ── 1+2. expand and retrieve concurrently ────────────────────────────
       The first version awaited each query's embedding and search in turn:
       three queries meant six sequential round trips, and that is where most
       of the 20-odd seconds went. Now the expansion runs alongside the first
       retrieval, embeddings for a batch of queries go out in ONE request, and
       the searches themselves run in parallel. */
    const baseQuery = [rec.quote, rec.body].filter(Boolean).join(" — ");
    const pageKey = rec.page_key ?? null;

    const retrieve = async (queries: string[]): Promise<Hit[]> => {
      const vecs = await embed(queries);                       // one call for the whole batch
      const lists = await Promise.all(
        queries.map((q, i) => search(vecs[i], bigramQuery(q), pageKey).catch(() => []))
      );
      return lists.flat();
    };

    /* Query expansion (patentExaminator's queryExpand.ts) was ported and then
       removed again, deliberately: it cost one extra LLM call plus two more
       embedding/search rounds, and on Chinese comments that pushed the
       function over the Edge runtime's resource ceiling (HTTP 546
       WORKER_RESOURCE_LIMIT — a hard failure, not a slow answer). The vector
       half of the hybrid search already crosses languages well enough, so the
       comment itself is what gets retrieved with. If quality ever needs it
       back, it belongs in a background worker, not in the request path. */
    const hits = await retrieve([baseQuery]).catch(() => []);
    const candidates = hits;
    if (!candidates.length) {
      await rest(`deck_ai_answers?comment_id=eq.${rec.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "failed", error: "no retrieval results" }),
      }).catch(() => {});
      return json({ ok: false, error: "no retrieval results" }, 500);
    }

    // ── 3. rerank (remote cross-encoder → heuristic) → threshold + MMR ──
    const { ranked, tier: rerankTier } = await rerankStage(baseQuery, rec.page_key ?? null, candidates);
    const picked = select(ranked, MAX_CONTEXT_CHUNKS);

    // ── 4. generate ─────────────────────────────────────────────────────
    const messages = buildMessages({
      comment: String(rec.body),
      author: String(rec.author ?? "Anonymous"),
      pageTitle: String(rec.page_title ?? "the deck"),
      quote: rec.quote ?? null,
      hits: picked,
    });
    const answer = await chat(messages);

    // ── 5. post it as a reply to the comment ────────────────────────────
    await rest("deck_comments", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        deck_id: rec.deck_id,
        page_key: rec.page_key,
        page_index: rec.page_index,
        page_title: rec.page_title,
        author: "Deck AI",
        email: null,
        body: withCitations(answer.text, picked),
        parent_id: rec.id,
        resolved: false,
        deleted: false,
        client_id: "deck-ai",
      }),
    });

    await rest(`deck_ai_answers?comment_id=eq.${rec.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "sent", model: answer.model, latency_ms: Date.now() - started,
        chunks: picked.length, sources: picked.map((p) => `${p.label}${p.section ? " / " + p.section : ""}`).join(" | ").slice(0, 500),
        error: answer.errors.length ? answer.errors.join(" | ").slice(0, 400) : null,
      }),
    }).catch(() => {});

    return json({
      ok: true, model: answer.model, ms: Date.now() - started,
      query: baseQuery, chunks: picked.length, rerank: rerankTier,
      fallbackErrors: answer.errors,
    });
  } catch (e) {
    console.error("answer-comment error:", String(e));
    return json({ error: String(e) }, 500);
  }
});
