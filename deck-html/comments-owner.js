/* ══════════════════════════════════════════════════════════════════════════
   Owner panel — the gear in the top-right corner.

   Loaded only when ?owner=true is in the URL (comments.js imports this module
   lazily), so a reader never even downloads it. Every call goes to the
   deck-admin Edge Function. There is no key: the parameter is the whole gate,
   which is what the owner asked for — see the note in comments.js.

   What the owner gets:
     · a Delete control on EVERY comment, not just their own (comments.js)
     · switch AI answering on/off (takes effect on the next comment, no deploy)
     · pick which model answers
     · see the knowledge base and the last few answers, with latency and model
   ══════════════════════════════════════════════════════════════════════════ */

const STATE = { config: {}, models: [], sources: [], knowledge: null, answers: null, views: null };

/* Timestamps arrive as UTC; the owner reads them in CST (+08), so the shift
   lives here rather than in three places. */
const cst = (iso) => {
  if (!iso) return '—';
  const t = new Date(iso).getTime() + 8 * 3600 * 1000;
  if (Number.isNaN(t)) return String(iso);
  return new Date(t).toISOString().replace('T', ' ').slice(0, 16);
};

/* The panel is opened by ?owner=true in the URL, so no key travels with these
   calls — see the note in comments.js: this is obscurity, not authentication,
   which is what the owner asked for. */
export function mount({ config, deckId }) {
  const ENDPOINT = `${(config.supabaseUrl || '').replace(/\/+$/, '')}/functions/v1/deck-admin`;

  async function admin(action, patch) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        apikey: config.supabaseAnonKey,
      },
      body: JSON.stringify({ action, patch }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  /* ── gear button, sitting next to the Comments button ── */
  const gear = document.createElement('button');
  gear.id = 'cmtgear';
  gear.type = 'button';
  gear.title = 'Owner settings (only you see this)';
  gear.textContent = '⚙';
  document.body.appendChild(gear);

  const panel = document.createElement('div');
  panel.id = 'cmtadmin';
  panel.innerHTML = `
    <div class="ah">
      <h3>Owner settings</h3>
      <button class="ax" type="button" title="Close">✕</button>
    </div>
    <div class="abody"></div>`;
  document.body.appendChild(panel);

  const body = panel.querySelector('.abody');
  panel.querySelector('.ax').addEventListener('click', () => panel.classList.remove('on'));
  gear.addEventListener('click', async () => {
    const open = panel.classList.toggle('on');
    if (open) await refresh();
  });
  ['pointerdown', 'click'].forEach((t) => {
    panel.addEventListener(t, (e) => e.stopPropagation());
  });

  function row(label, value, extra) {
    const r = document.createElement('div');
    r.className = 'arow';
    const l = document.createElement('span'); l.className = 'al'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'av'; v.textContent = value;
    r.appendChild(l); r.appendChild(v);
    if (extra) r.appendChild(extra);
    return r;
  }

  function render() {
    body.innerHTML = '';

    /* ── AI answering on/off ── */
    const on = !!STATE.config.enabled;
    const toggle = document.createElement('button');
    toggle.className = 'atoggle' + (on ? ' on' : '');
    toggle.type = 'button';
    toggle.textContent = on ? 'ON' : 'OFF';
    toggle.addEventListener('click', async () => {
      toggle.disabled = true;
      try {
        const res = await admin('set', { enabled: !on });
        STATE.config = { ...STATE.config, ...(res.config || {}) };
        render();
      } catch (e) {
        alert('Could not change that: ' + e.message);
        toggle.disabled = false;
      }
    });
    body.appendChild(row('AI answers comments', '', toggle));

    /* ── model picker ── */
    const sel = document.createElement('select');
    sel.className = 'aselect';
    (STATE.models || []).forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = m.note ? `${m.id} — ${m.note}` : m.id;
      if (m.id === STATE.config.model) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      try {
        const res = await admin('set', { model: sel.value });
        STATE.config = { ...STATE.config, ...(res.config || {}) };
      } catch (e) {
        alert('Could not change the model: ' + e.message);
      } finally {
        sel.disabled = false;
      }
    });
    body.appendChild(row('Model', '', sel));

    /* ── knowledge base ── */
    const k = STATE.knowledge || {};
    const kbLine = `${k.chunks ?? '?'} chunks · ${k.embedded ?? '?'} embedded · ${((k.chars ?? 0) / 1000).toFixed(0)}k chars`;
    body.appendChild(row('Knowledge base', kbLine));
    (STATE.sources || []).forEach((s) => {
      const r = document.createElement('div');
      r.className = 'asub';
      r.textContent = `${s.label} — ${s.chunk_count} chunks${s.embedded ? '' : ' (not embedded)'}`;
      body.appendChild(r);
    });

    /* ── page views: who opened the deck, from where, how often ── */
    const v = STATE.views;
    if (!v) {
      body.appendChild(row('Page views', 'loading…'));
    } else {
      body.appendChild(row('Page views', `${v.total} loads · ${v.addresses} addr · ${v.browsers} browsers`));
      const span = document.createElement('div');
      span.className = 'asub';
      span.textContent = `${cst(v.first)} → ${cst(v.last)} CST${v.capped ? ' · newest 2,000 rows' : ''}`;
      body.appendChild(span);

      /* countries in the order they occur, then the days newest-first (the
         server hands them over by size, which is wrong for a timeline), then
         the busiest addresses. Ten lines each is what fits the panel. */
      (v.countries || []).slice(0, 8).forEach((c) => {
        const line = document.createElement('div');
        line.className = 'asub';
        line.textContent = `${c.key} — ${c.loads} loads · ${c.ips} addr`;
        body.appendChild(line);
      });

      [...(v.days || [])].sort((a, b) => b.key.localeCompare(a.key)).slice(0, 7).forEach((d) => {
        const line = document.createElement('div');
        line.className = 'asub';
        line.textContent = `${d.key} — ${d.loads} loads · ${d.ips} addr`;
        body.appendChild(line);
      });

      (v.ips || []).slice(0, 10).forEach((p) => {
        const line = document.createElement('div');
        line.className = 'asub';
        line.textContent = `${p.key} — ${p.loads}× · ${p.browsers} browser · ${p.country} · last ${cst(p.last)}`;
        line.title = `first ${cst(p.first)}`;
        body.appendChild(line);
      });
    }

    /* ── recent answers ── */
    const a = STATE.answers || {};
    const stat = Object.entries(a.byStatus || {}).map(([k2, v]) => `${k2} ${v}`).join(' · ') || 'none yet';
    body.appendChild(row('Answers so far', stat));
    (a.recent || []).slice(0, 5).forEach((r) => {
      const line = document.createElement('div');
      line.className = 'asub' + (r.status === 'failed' ? ' bad' : '');
      const ms = r.latency_ms ? `${(r.latency_ms / 1000).toFixed(1)}s` : '';
      line.textContent = `${r.status} · ${r.model || '-'} · ${ms} · ${r.chunks ?? '-'} chunks${r.error ? ' · ' + String(r.error).slice(0, 60) : ''}`;
      body.appendChild(line);
    });

    /* ── leave owner mode ── */
    const out = document.createElement('button');
    out.className = 'aout';
    out.type = 'button';
    out.textContent = 'Exit owner mode';
    out.title = 'Removes ?owner=true from the address bar';
    out.addEventListener('click', () => {
      /* Owner mode is the URL parameter now, so leaving means taking it out of
         the address bar — there is no stored flag to clear any more. Keeping
         the other parameters (?p=, ?c=) so an exit does not also lose your
         place in the deck. */
      try {
        const u = new URL(location.href);
        u.searchParams.delete('owner');
        location.href = u.pathname + (u.search || '') + u.hash;
      } catch (e) { location.href = location.pathname; }
    });
    body.appendChild(out);
  }

  async function refresh() {
    body.innerHTML = '<div class="aload">Loading…</div>';
    try {
      const d = await admin('status');
      STATE.config = d.config || {};
      STATE.models = d.models || [];
      STATE.sources = d.sources || [];
      STATE.knowledge = d.knowledge || null;
      STATE.answers = d.answers || null;
      render();

      /* Page views come second, on purpose: a slow log query must not hold the
         whole panel at "Loading…". A failure stays a single "loading…" line —
         the rest of the panel is still worth reading. */
      admin('views').then((res) => {
        STATE.views = res.views || null;
        render();
      }).catch(() => { /* keep the placeholder line */ });
    } catch (e) {
      body.innerHTML = `<div class="aload bad">${String(e.message || e)}</div>`;
    }
  }
}
