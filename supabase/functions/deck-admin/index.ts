// ══════════════════════════════════════════════════════════════════════════
// deck-admin — the owner-only side of the deck.
//
// The gear button in the deck's top-right corner only appears when the URL
// carries ?owner=true; comments.js imports the panel lazily and the panel
// calls this function. There is no key check — see the note in the handler.
//
// Actions:
//   { action: "status" }                      → config + knowledge stats + recent answers
//   { action: "set", patch: {...} }           → toggle AI answering, switch model
//
// Comment deletion is NOT here: it is a soft delete performed by the browser
// against the deck_comments_public view. See the handler for why.
//
// Zero dependencies (an API deploy does not bundle remote imports).
// Secrets: BAILIAN_CHAT_MODEL (+ OWNER_KEY, currently unused)
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

/* This is the only function the browser calls directly, so it is the only one
   that needs CORS. Without these headers the fetch fails before it is even
   sent, and the panel just shows "Failed to fetch". A wildcard origin is fine
   here: every action still needs the owner key, which the server checks. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

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

/* Same set as the fallback chain in answer-comment, and measured the same way
   (2026-10-08, thinking disabled). The owner's other four models are excluded
   because they cannot be called this way: qwen3.8-2.4t-a95b / glm-5.3 /
   qwen-mt-uni answer HTTP 400, and qwen3.8-omni-flash-realtime is a realtime
   endpoint that returns nothing here. */
const MODELS = [
  { id: "deepseek-v4-flash-0731", note: "默认 · 约 3 秒，最省" },
  { id: "qwen3.7-flash-2026-07-15", note: "约 3 秒 · 额度最少，先用它" },
  { id: "qwen3.8-max", note: "约 3 秒" },
  { id: "qwen3.8-flash", note: "约 3 秒" },
  { id: "qwen3.8-max-0902", note: "约 3 秒" },
  { id: "qwen3.8-omni-flash", note: "约 3 秒 · 多模态" },
  { id: "kimi-k3", note: "约 3 秒" },
  { id: "deepseek-v4.1-flash", note: "约 3 秒" },
  { id: "deepseek-v4-pro-0813", note: "约 3 秒" },
  { id: "qwen3.8-27b", note: "约 10 秒 · 较慢" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));

    /* No key check, by the owner's decision (2026-10-08): owner mode is opened
       with ?owner=true and that parameter is the only gate. Anyone who knows
       the parameter — or who calls this endpoint directly — can read the
       settings and flip them. It is a deliberately low-stakes surface (turn the
       deck's auto-answering on/off, pick a model), and the owner preferred that
       over keeping a key.

       Deleting comments deliberately does NOT live here. It is a soft delete
       (deleted = true) done by the browser against the deck_comments_public
       view, i.e. through the same permissive update policy the Resolve button
       already uses, so nothing new is exposed. A service-role hard delete here
       would make the whole deck wipeable by anyone who reads this file — a far
       bigger hole than the one it closes. If real deletion is ever wanted, put
       the OWNER_KEY check back first: the secret is still in the project. */
    const action = String(body.action ?? "status");

    if (action === "status") {
      const cfg = (await rest("deck_ai_config?id=eq.1&select=enabled,model,updated_at"))?.[0] ?? {};
      const stats = (await rest("kb_sources?select=key,label,chunk_count,embedded&order=key")) ?? [];
      const recent = (await rest(
        "deck_ai_answers?select=status,model,latency_ms,chunks,error,created_at&order=created_at.desc&limit=8"
      )) ?? [];
      const counts = (await rest("deck_ai_answers?select=status")) ?? [];
      const byStatus = counts.reduce((acc: Record<string, number>, r: any) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});
      const knowledge = await rest("rpc/kb_stats").catch(() => null);
      return json({
        ok: true,
        config: {
          enabled: cfg.enabled ?? true,
          model: cfg.model ?? Deno.env.get("BAILIAN_CHAT_MODEL") ?? "deepseek-v4-flash-0731",
          updatedAt: cfg.updated_at ?? null,
        },
        models: MODELS,
        sources: stats,
        knowledge,
        answers: { byStatus, recent },
      });
    }

    if (action === "set") {
      const patch = (body.patch ?? {}) as Record<string, unknown>;
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof patch.enabled === "boolean") update.enabled = patch.enabled;
      if (typeof patch.model === "string" && MODELS.some((m) => m.id === patch.model)) {
        update.model = patch.model;
      }
      const rows = await rest("deck_ai_config?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(update),
      });
      return json({ ok: true, config: rows?.[0] ?? null });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
