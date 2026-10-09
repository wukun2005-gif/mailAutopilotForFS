// ══════════════════════════════════════════════════════════════════════════
// page-view — one row per deck page load: IP, country, when, how often.
//
// The deck calls this with `keepalive` fetch as soon as it has booted. It
// sends only its own identity key and the URL; the address and the country
// come from the request headers here, because a browser cannot be asked for
// its own IP.
//
// Header order matters. Behind Supabase's gateway the client address may
// arrive under several names depending on the year the project was created
// and what sits in front of it, so every candidate is tried and the one that
// worked is recorded in `hdr` — a row whose IP is empty tells you exactly
// which header to read instead of leaving you guessing.
//
// Country: CDN header first (free, no round trip). If it is missing, one
// call to ipwho.is (https, no key, no account) gets the country for that IP.
// If that also fails the row is still written — a visit with an unknown
// country is worth more than no row at all.
//
// Zero dependencies (an API deploy does not bundle remote imports).
// Secrets: none — it uses the project's own injected service key.
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

async function rest(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(2500),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

/* Every name the client address has ever arrived under, in the order they
   are worth trying. `x-forwarded-for` is a list — the visitor is the first
   entry, the proxies come after. */
const IP_HEADERS = ["cf-connecting-ip", "x-real-ip", "x-forwarded-for", "true-client-ip"];
/* Cloudflare's country code, plus the equivalents from other edges. */
const CC_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code", "x-appengine-country", "cloudfront-viewer-country"];

function firstHeader(req: Request, names: string[]): { value: string; name: string } {
  const picked: Record<string, string> = {};
  for (const n of names) {
    const v = (req.headers.get(n) ?? "").trim();
    if (v) picked[n] = v;
  }
  for (const n of names) {
    const v = picked[n];
    if (!v) continue;
    const first = n === "x-forwarded-for" ? (v.split(",")[0] ?? "").trim() : v;
    if (first && first !== "unknown") return { value: first, name: n };
  }
  return { value: "", name: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* no body — still a view */ }

  const ipFrom = firstHeader(req, IP_HEADERS);
  const ccFrom = firstHeader(req, CC_HEADERS);
  let ip = ipFrom.value;
  let countryCode = ccFrom.value.toUpperCase() === "XX" || ccFrom.value.toUpperCase() === "T1" ? "" : ccFrom.value;
  let country = "";

  /* One lookup, only when a header left something out. ipwho.is answers with
     the caller's own address when given no IP, which here would be this
     function's egress IP rather than the reader's — so an empty `ip` is
     never passed to it as "no argument", only an actual address. */
  if ((!countryCode || !ip) && ip) {
    try {
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
        signal: AbortSignal.timeout(2500),
      });
      const geo = await res.json();
      if (geo && geo.success !== false) {
        if (!countryCode) countryCode = String(geo.country_code ?? "").trim();
        country = String(geo.country ?? "").trim();
        if (!ip && geo.ip) ip = String(geo.ip);
      }
    } catch (_) { /* the row still gets written, country left blank */ }
  }

  /* Whose visit this is. Two answers, and either one is enough: the page
     admits it when it was opened with ?owner=true, and the address is one the
     owner marked as theirs by clicking it in the panel — which covers the
     ordinary case, where the owner browses the deck with no flag in the URL. */
  let owner = body.owner === true;
  if (ip && !owner) {
    try {
      const mine = await rest(`deck_owner_ips?ip=eq.${encodeURIComponent(ip)}&select=ip&limit=1`);
      owner = Array.isArray(mine) && mine.length > 0;
    } catch (_) { /* logged unmarked rather than not logged */ }
  }

  const row = {
    deck_id: String(body.deckId ?? "default").slice(0, 120),
    path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
    ip: ip.slice(0, 60) || null,
    country_code: countryCode.slice(0, 8) || null,
    country: country.slice(0, 80) || null,
    client_id: typeof body.clientId === "string" ? body.clientId.slice(0, 80) : null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
    owner,
    hdr: {
      ip: ipFrom.name || null,
      cc: ccFrom.name || null,
      names: IP_HEADERS.concat(CC_HEADERS).filter((n) => req.headers.has(n)),
    },
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/deck_page_views`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return json({ ok: false, status: res.status, detail: (await res.text()).slice(0, 300) }, 200);
  } catch (e) {
    /* Never surface an error to the deck: a failed log must look like a
       successful one from the caller's side, or the console shows it. */
    return json({ ok: false, error: String(e).slice(0, 200) }, 200);
  }

  return json({ ok: true }, 200);
});
