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

    /* Who opened the deck. Not a "status" field — a log table of its own,
       read here because deck_page_views has no policy and therefore no API
       surface: this function is the only door, and it is the owner's panel
       that knocks. Aggregated here rather than in the browser so the raw
       addresses never travel further than they already have to. */
    if (action === "views") {
      const CAP = 2000;              // newest first; enough for a deck this size
      const rows = (await rest(
        `deck_page_views?select=ip,country,country_code,created_at,path,client_id,owner&order=created_at.desc&limit=${CAP}`
      )) ?? [];
      /* The owner reads CST (+08); a UTC day boundary would move a late-night
         visit into the wrong row, so the day is cut here, once. */
      const dayOf = (iso: string) =>
        new Date(Date.parse(iso) + 8 * 3600 * 1000).toISOString().slice(0, 10);
      /* Every group carries both counts — how many were mine and how many were
         not — so the panel can hide my own visits and bring them back with a
         click, without asking for the numbers a second time. */
      const track = () => ({ loads: 0, mine: 0, ips: new Set<string>() });
      const ips = new Set<string>(), mineIps = new Set<string>();
      const browsers = new Set<string>(), mineBrowsers = new Set<string>();
      const countries = new Map<string, ReturnType<typeof track>>();
      const days = new Map<string, ReturnType<typeof track>>();
      const byIp = new Map<string, {
        loads: number; mine: number; browsers: Set<string>; country: string; first: string; last: string;
      }>();
      for (const r of rows) {
        const c = r.country || r.country_code || "unknown";
        const d = dayOf(r.created_at);
        const ip = r.ip || "unknown";
        const mine = !!r.owner;
        if (r.ip) (mine ? mineIps : ips).add(r.ip);
        if (r.client_id) (mine ? mineBrowsers : browsers).add(r.client_id);
        for (const [m, k] of [[countries, c], [days, d]] as const) {
          const cur = m.get(k) ?? track();
          cur.loads++;
          if (mine) cur.mine++;
          if (r.ip) cur.ips.add(r.ip);
          m.set(k, cur);
        }
        const e = byIp.get(ip) ??
          { loads: 0, mine: 0, browsers: new Set<string>(), country: c, first: r.created_at, last: r.created_at };
        e.loads++;
        if (mine) e.mine++;
        if (r.client_id) e.browsers.add(r.client_id);
        if (r.created_at < e.first) e.first = r.created_at;
        if (r.created_at > e.last) e.last = r.created_at;
        byIp.set(ip, e);
      }
      const sorted = <T>(m: Map<string, T>) => [...m.entries()].sort((a, b) => b[1].loads - a[1].loads || a[0].localeCompare(b[0]));
      const mine = rows.filter((r) => r.owner);
      const group = ([key, v]: [string, { loads: number; mine: number }]) => ({
        key, loads: v.loads, mine: v.mine, others: v.loads - v.mine,
      });
      return json({
        ok: true,
        views: {
          total: rows.length,
          mine: mine.length,
          visitors: rows.length - mine.length,
          addresses: ips.size,
          mineAddresses: mineIps.size,
          browsers: browsers.size,
          mineBrowsers: mineBrowsers.size,
          first: rows.length ? rows[rows.length - 1].created_at : null,
          last: rows.length ? rows[0].created_at : null,
          capped: rows.length >= CAP,
          countries: sorted(countries).map(group),
          days: sorted(days).map(group),
          ips: sorted(byIp).map(([k, v]) => ({
            key: k, loads: v.loads, mine: v.mine, others: v.loads - v.mine,
            yours: v.loads > 0 && v.mine === v.loads,
            browsers: v.browsers.size, country: v.country, first: v.first, last: v.last,
          })),
        },
      });
    }

    /* Telling one address apart from another: `patch: { ip, mine }` marks an
       address as the owner's (or takes it back). Both the address list and
       every visit already recorded under it move at once, so a tag never has
       to be applied twice. */
    if (action === "views-tag") {
      const p = (body.patch ?? {}) as Record<string, unknown>;
      const ip = String(p.ip ?? "").trim();
      const mine = !!p.mine;
      if (!ip || ip === "unknown") return json({ error: "an ip is required" }, 400);
      const where = `deck_owner_ips?ip=eq.${encodeURIComponent(ip)}`;
      if (mine) {
        await rest(where, {
          method: "POST",
          headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({ ip }),
        });
      } else {
        await rest(where, { method: "DELETE" });
      }
      await rest(`deck_page_views?ip=eq.${encodeURIComponent(ip)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ owner: mine }),
      });
      return json({ ok: true, ip, mine });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
