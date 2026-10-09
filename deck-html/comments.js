/* ══════════════════════════════════════════════════════════════════════════
   Shared comments for the deck.

   Two backends, one code path:
     · cloud  — Supabase (comments.config.js filled in): everyone sees
                everyone, pushed over realtime, with a poll as a fallback
                for networks that block the websocket.
     · local  — no config: comments stay in this browser and sync across
                its tabs, so the deck never breaks on a missing backend.

   No login. A reader is a nickname (optional) plus an email (optional,
   used only to send "someone replied to you").
   ══════════════════════════════════════════════════════════════════════════ */

const CFG = window.DECK_COMMENT_CONFIG || {};
const DECK = CFG.deckId || 'default';
/* the byline the deck's own answers carry — used to badge them and to keep
   the AI from answering itself */
const AI_AUTHOR = 'Deck AI';
const TABLE = 'deck_comments';
const LS_ID = 'deck-comment-identity';
const LS_LOCAL = 'deck-comments-local-' + DECK;
const LS_ACK = 'deck-comment-terms-ack';

/* ── legal notice ──────────────────────────────────────────────────────────
   Every reader sees the full text once (they must acknowledge it), and the
   one-line summary sits above the composer from then on. */
const CONTACT = CFG.contactEmail || 'wukun2005@gmail.com';
const DISCLAIMER = (Array.isArray(CFG.disclaimer) && CFG.disclaimer.length) ? CFG.disclaimer : [
  'The author may remove any comment at any time, without notice.',
  'Comments are collected for this case study only.',
  'Write to ' + CONTACT + ' to request deletion of your comment.',
  'This is a personal case study; it does not represent the position of any company.'
];
const DISC_SHORT = 'Public to anyone with this link · may be removed · personal case study only';

/* #stage only: the left rail holds a scaled clone of every page, and those
   clones carry the same .slide class — indexing them would put every comment
   on the wrong page. */
const slides = [...document.querySelectorAll('#stage .slide')];
const N = slides.length;

/* ── who am I ──────────────────────────────────────────────────────────── */
let me = (function () {
  try { return JSON.parse(localStorage.getItem(LS_ID)) || {}; } catch (e) { return {}; }
})();
if (!me.clientId) {
  me.clientId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c' + Date.now() + Math.random();
  saveMe();
}
function saveMe() { try { localStorage.setItem(LS_ID, JSON.stringify(me)); } catch (e) {} }

/* ── stable page identity ──────────────────────────────────────────────────
   A page's number shifts whenever a slide is inserted, so comments are
   filed under a slug of the headline and the number is only a fallback.
   Reword a headline and the comment rides along on its index instead. */
function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}
const titles = slides.map(function (s, idx) {
  const h = s.querySelector('h1,h2');
  if (h && h.textContent.trim()) return h.textContent.trim();
  const eb = s.querySelector('.eyebrow');
  if (eb) return eb.textContent.replace(/^\s*\d+\s*/, '').trim();
  return 'Page ' + (idx + 1);
});
const keys = titles.map(function (t, idx) { return slug(t) || ('p' + (idx + 1)); });

function resolveIdx(c) {
  const k = keys.indexOf(c.page_key);
  if (k >= 0) return k;
  if (typeof c.page_index === 'number' && c.page_index >= 0 && c.page_index < N) return c.page_index;
  return -1;
}

/* ── state ─────────────────────────────────────────────────────────────── */
let mode = 'local';
let sb = null;
let all = [];
let pageIdx = 0;
let pending = null;      // a selected phrase waiting to become a comment
let replyTo = null;      // parent comment id while replying
let hotId = null;        // comment to flash (arrived by link / clicked anchor)
let liveOn = false;
let presence = {};
let lastJSON = '';
/* ?owner=true — set by ownerMode() at the bottom of this file. Owner mode
   lives in the URL, never in storage, so it is a plain module variable the
   comment renderer can read: owners get a Delete control on every comment,
   not just their own. */
let ownerOn = false;
/* Ids we rendered optimistically but the server has not handed back yet.
   A refresh that lands before the read catches up must not erase them —
   otherwise a comment flickers out right after sending and the reader
   sends it again. */
let unsentIds = new Set();
let sending = false;
let presCh = null;

const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('deck-comments-' + DECK) : null;
if (bc) bc.onmessage = function () { refresh(true); };

/* ── backend ───────────────────────────────────────────────────────────── */
async function initBackend() {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return;
  try {
    /* The vendored copy in assets/supabase.min.js is the normal path. The
       CDN import is only a fallback for a deck that lost that file — and it
       is a bad path on purpose: fetching supabase-js from esm.sh costs
       seconds on some networks, during which the panel sits at 0 comments. */
    const create = (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient
      : (await import('https://esm.sh/@supabase/supabase-js@2')).createClient;
    sb = create(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } }
    });
    mode = 'cloud';
  } catch (e) {
    console.warn('[comments] supabase unreachable, falling back to local:', e);
    mode = 'local';
  }
}

async function load() {
  if (mode === 'cloud') {
    const { data, error } = await sb.from('deck_comments_public').select(
      'id,deck_id,page_key,page_index,page_title,author,body,quote,quote_prefix,' +
      'quote_suffix,parent_id,resolved,deleted,client_id,created_at'
    ).eq('deck_id', DECK).order('created_at', { ascending: true }).limit(3000);
    if (error) throw error;
    return data || [];
  }
  try { return JSON.parse(localStorage.getItem(LS_LOCAL)) || []; } catch (e) { return []; }
}
async function addRow(row) {
  if (mode === 'cloud') {
    /* No .select() on purpose. The table's SELECT is revoked from anon (that
       is what keeps reader emails out of the browser), and PostgREST needs
       SELECT rights to return the inserted row — so asking for it back makes
       every insert fail. We already hold the full row locally, including the
       id and created_at we generated, so there is nothing to read back. */
    const { error } = await sb.from(TABLE).insert(row);
    if (error) throw error;
    return row;
  }
  const rows = await load();
  rows.push(row);
  localStorage.setItem(LS_LOCAL, JSON.stringify(rows));
  if (bc) bc.postMessage({ t: 'changed' });
  return row;
}
async function patchRow(id, fields) {
  if (mode === 'cloud') {
    /* Also through the view, not the table: PostgREST asks for SELECT rights
       before it will run an UPDATE, and anon's SELECT on the raw table is
       revoked (that is what keeps emails private). The view is auto-updatable
       and hides the email column, so resolve / reopen / delete land fine. */
    const { error } = await sb.from('deck_comments_public').update(fields).eq('id', id);
    if (error) throw error;
    return;
  }
  const rows = await load();
  const k = rows.findIndex(function (c) { return c.id === id; });
  if (k >= 0) {
    Object.assign(rows[k], fields);
    localStorage.setItem(LS_LOCAL, JSON.stringify(rows));
    if (bc) bc.postMessage({ t: 'changed' });
  }
}
/* Same as patchRow, but for everything matching a column rather than one id —
   used to take a comment's replies with it when the comment is deleted. Goes
   through the view for the same reason patchRow does (anon has no SELECT on
   the table, and PostgREST checks SELECT before an UPDATE). */
async function patchWhere(column, value, fields) {
  if (mode === 'cloud') {
    const { error } = await sb.from('deck_comments_public').update(fields).eq(column, value);
    if (error) throw error;
    return;
  }
  const rows = await load();
  rows.forEach(function (c) { if (c[column] === value) Object.assign(c, fields); });
  localStorage.setItem(LS_LOCAL, JSON.stringify(rows));
  if (bc) bc.postMessage({ t: 'changed' });
}
function newId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function subscribe() {
  if (mode !== 'cloud') return;
  try {
    sb.channel('deck-comments-' + DECK)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE, filter: 'deck_id=eq.' + DECK },
        function () { refresh(true); })
      .subscribe(function (status) { setLive(status === 'SUBSCRIBED'); });

    presCh = sb.channel('deck-presence-' + DECK, { config: { presence: { key: me.clientId } } });
    presCh.on('presence', { event: 'sync' }, function () {
      presence = presCh.presenceState() || {};
      renderLive();
    }).subscribe(function (status) { if (status === 'SUBSCRIBED') trackPresence(); });
  } catch (e) { /* realtime is a bonus, polling still covers it */ }
}
function trackPresence() {
  if (!presCh || mode !== 'cloud') return;
  try {
    presCh.track({ name: me.name || 'Anonymous', page: keys[pageIdx], at: Date.now() });
  } catch (e) {}
}
function peopleStates() {
  const key = keys[pageIdx];
  const out = [];
  Object.keys(presence).forEach(function (k) {
    const st = presence[k] || [];
    st.forEach(function (s) { if (s && s.page === key) out.push(s); });
  });
  return out;
}

/* Initials, not full names. The strip is 360px wide, and a presence channel
   nobody opted into is the wrong place to broadcast a stranger's full name to
   everyone else looking at the page. One word keeps its first letter
   ("dana" → "D"); two or more give one letter each ("Dana Whitfield" → "DW").
   Non-Latin names fall out correctly — "吴坤" has no spaces, so it keeps "吴". */
function shortName(name) {
  const s = String(name == null ? '' : name).trim();
  if (!s || /^anonymous$/i.test(s)) return null;
  return s.split(/\s+/).filter(Boolean)
    .map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 3);
}

/* Who is here, by name when somebody gave one. Falls back to the plain
   headcount when every visitor is anonymous: there is then nothing to name,
   and a placeholder would be worse than a number. Pure on purpose, so the UI
   regression script can call it without standing up a realtime socket. */
function presenceLabel(people) {
  const n = people.length;
  const named = people.map(function (p) { return shortName(p && p.name); }).filter(Boolean);
  if (!named.length) return n > 1 ? n + ' people on this page' : 'You are the only one here';
  const shown = named.slice(0, 4).join(' · ');
  const extra = n - Math.min(named.length, 4);
  return shown + (extra > 0 ? ' · +' + extra : '') + (n === 1 ? ' is on this page' : ' on this page');
}

/* ── DOM ───────────────────────────────────────────────────────────────── */
const btn = document.createElement('button');
btn.id = 'cmtbtn'; btn.type = 'button';
btn.title = 'Comments on this page (C)';
btn.innerHTML = '<span>Comments</span><span class="cnt zero">0</span>';
document.body.appendChild(btn);
btn.addEventListener('click', function () { toggle(); });

/* park the button right of the deck's own ☀ Light pill, copying its box —
   re-runs on resize, on the Light/Dark text swap and on body class changes
   (notoc rail move, fullscreen). A hidden pill leaves the last position. */
function syncBtnToTheme() {
  const t = document.querySelector('.themebtn');
  if (!t) return;
  const r = t.getBoundingClientRect();
  if (!r.width) return;
  btn.style.top = r.top + 'px';
  btn.style.left = (r.right + 6) + 'px';
  /* The owner's gear rides in the same row, immediately right of Comments —
     which is what it always said it did, but it was pinned to right:268px, so
     it landed *inside* the 360px comments panel and, with a higher z-index,
     sat on top of the panel's own header. Counting off the button keeps the
     two together and clear of both panels. The gear is appended later by the
     lazily imported owner module, so it is looked up on every pass rather than
     held in a variable. */
  const g = document.getElementById('cmtgear');
  if (g) {
    const b = btn.getBoundingClientRect();
    g.style.top = b.top + 'px';
    g.style.left = (b.right + 6) + 'px';
  }
}
syncBtnToTheme();
new MutationObserver(syncBtnToTheme).observe(document.querySelector('.themebtn') || document.body,
  { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
new MutationObserver(syncBtnToTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });
addEventListener('resize', syncBtnToTheme);

const selBtn = document.createElement('button');
selBtn.id = 'cmtselbtn'; selBtn.type = 'button';
selBtn.textContent = 'Comment on this';
document.body.appendChild(selBtn);
selBtn.addEventListener('mousedown', function (e) { e.preventDefault(); });  // keep the selection
selBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  if (!pending) return;
  open();
  setQuote(pending);
  hideSelBtn();
});

const panel = document.createElement('aside');
panel.id = 'cmtpanel';
panel.innerHTML =
  '<div class="ch">' +
    '<div class="row"><h3>Comments</h3>' +
      '<button class="i" id="cmtclose" title="Close (Esc)">✕</button></div>' +
    '<div class="sub" id="cmtsub"></div>' +
  '</div>' +
  '<div class="live" id="cmtlive"><span class="dot"></span><span id="cmtlivetxt"></span></div>' +
  '<div class="who" id="cmtwho"></div>' +
  '<div class="idedit" id="cmtidedit" style="display:none"></div>' +
  '<div class="list" id="cmtlist"></div>' +
  '<div class="comp">' +
    '<div class="discbar" id="cmtdisc"><span id="cmtdiscshort"></span>' +
      '<button id="cmtdiscmore" type="button">Terms</button></div>' +
    '<div class="qchip" id="cmtqchip" style="display:none"><span id="cmtqtext"></span>' +
      '<button id="cmtqx" title="Drop the quote">✕</button></div>' +
    '<textarea id="cmtta" placeholder="Ask a question or leave a comment…"></textarea>' +
    '<div class="crow"><span class="sp" id="cmthint"></span>' +
      '<button class="send" id="cmtsend">Send</button></div>' +
    '<div class="warn" id="cmtwarn" style="display:none"></div>' +
  '</div>' +
  '<div class="discmodal" id="cmtdiscmodal" style="display:none">' +
    '<h4>Before you comment</h4>' +
    '<ul id="cmtdisclist"></ul>' +
    '<button class="btn pri" id="cmtdiscok" type="button">I understand</button>' +
  '</div>';
document.body.appendChild(panel);

const el = {
  sub: panel.querySelector('#cmtsub'),
  live: panel.querySelector('#cmtlive'),
  liveTxt: panel.querySelector('#cmtlivetxt'),
  who: panel.querySelector('#cmtwho'),
  idedit: panel.querySelector('#cmtidedit'),
  list: panel.querySelector('#cmtlist'),
  qchip: panel.querySelector('#cmtqchip'),
  qtext: panel.querySelector('#cmtqtext'),
  ta: panel.querySelector('#cmtta'),
  send: panel.querySelector('#cmtsend'),
  hint: panel.querySelector('#cmthint'),
  warn: panel.querySelector('#cmtwarn'),
  discshort: panel.querySelector('#cmtdiscshort'),
  discmodal: panel.querySelector('#cmtdiscmodal'),
  disclist: panel.querySelector('#cmtdisclist'),
  discok: panel.querySelector('#cmtdiscok')
};

panel.querySelector('#cmtclose').addEventListener('click', close);
el.send.addEventListener('click', submit);

/* The deck's own key handler only steps aside for INPUT, not TEXTAREA, so
   typing a space or an arrow in the composer would flip the page. Swallow
   key events while a field has focus, before they reach that handler —
   capture phase, which is the only phase that runs ahead of it. */
addEventListener('keydown', function (e) {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if (typing) {
    if (t === el.ta && (e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
    e.stopPropagation();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggle(); }
  else if (e.key === 'Escape' && document.body.classList.contains('cmt-open')) close();
}, true);
panel.querySelector('#cmtqx').addEventListener('click', function () { setQuote(null); });

/* ── identity strip ────────────────────────────────────────────────────── */
function renderIdentity() {
  const name = me.name || 'Anonymous';
  const initial = (name.trim()[0] || '?');
  el.who.innerHTML = '';
  const av = document.createElement('span'); av.className = 'av'; av.textContent = initial;
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = name;
  const em = document.createElement('span'); em.textContent = me.email ? ' · ' + me.email : ' · no email';
  const ed = document.createElement('button'); ed.className = 'ed'; ed.textContent = 'edit';
  ed.addEventListener('click', function () {
    el.idedit.style.display = 'block';
    renderIdentityForm();
  });
  el.who.appendChild(av); el.who.appendChild(nm); el.who.appendChild(em); el.who.appendChild(ed);
}

function renderIdentityForm() {
  el.idedit.innerHTML = '';
  function field(label, hint, value, type, ph) {
    const l = document.createElement('label'); l.textContent = label;
    const inp = document.createElement('input');
    inp.type = type; inp.value = value || ''; inp.placeholder = ph || '';
    if (hint) {
      const h = document.createElement('div'); h.className = 'hint'; h.textContent = hint;
      el.idedit.appendChild(l); el.idedit.appendChild(inp); el.idedit.appendChild(h);
    } else { el.idedit.appendChild(l); el.idedit.appendChild(inp); }
    return inp;
  }
  const nameI = field('Your name (optional)', null, me.name, 'text', 'e.g. Dana from Risk');
  const mailI = field('Email (optional)', 'Only used to email you when somebody replies to your comment.',
    me.email, 'email', 'you@company.com');
  const row = document.createElement('div'); row.className = 'btnrow';
  const save = document.createElement('button'); save.className = 'btn pri'; save.textContent = 'Save';
  const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
  row.appendChild(save); row.appendChild(cancel);
  el.idedit.appendChild(row);

  save.addEventListener('click', function () {
    const n = nameI.value.trim().slice(0, 40);
    const m = mailI.value.trim().slice(0, 120);
    if (m && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) { warn('That email does not look right.'); return; }
    me.name = n; me.email = m || ''; saveMe();
    el.idedit.style.display = 'none';
    warn('');
    renderIdentity(); trackPresence();
  });
  cancel.addEventListener('click', function () { el.idedit.style.display = 'none'; warn(''); });
}

function warn(msg) {
  if (!msg) { el.warn.style.display = 'none'; el.warn.textContent = ''; return; }
  el.warn.style.display = 'block'; el.warn.textContent = msg;
}

/* ── legal notice ──────────────────────────────────────────────────────── */
function acked() { try { return localStorage.getItem(LS_ACK) === '1'; } catch (e) { return false; } }
function showTerms(mustAck) {
  el.disclist.innerHTML = '';
  DISCLAIMER.forEach(function (t) {
    const li = document.createElement('li');
    li.textContent = t;
    el.disclist.appendChild(li);
  });
  el.discok.textContent = mustAck ? 'I understand' : 'Close';
  el.discmodal.style.display = 'flex';
}
function hideTerms() { el.discmodal.style.display = 'none'; }
panel.querySelector('#cmtdiscmore').addEventListener('click', function () { showTerms(false); });
el.discok.addEventListener('click', function () {
  try { localStorage.setItem(LS_ACK, '1'); } catch (e) {}
  hideTerms();
  el.ta.focus();
});
el.discshort.textContent = DISC_SHORT;

/* ── open / close ──────────────────────────────────────────────────────── */
function open() {
  document.body.classList.add('cmt-open');
  fit();
  renderIdentity();
  renderList();
  /* first visit: the notice covers the panel until it is acknowledged */
  if (!acked()) showTerms(true);
  else setTimeout(function () { el.ta.focus(); }, 60);
}
function close() {
  document.body.classList.remove('cmt-open');
  fit();
  setQuote(null);
}
function toggle() { document.body.classList.contains('cmt-open') ? close() : open(); }

/* the deck's own fit() does not know about the panel, so repeat it with the
   panel's width taken off the available space */
function fit() {
  const rail = document.body.classList.contains('notoc') ? 0 : 186;
  const extra = (document.body.classList.contains('cmt-open') && window.innerWidth > 900) ? 360 : 0;
  const s = Math.min((window.innerWidth - rail - extra) / 1280, (window.innerHeight - 40) / 720);
  slides.forEach(function (sl) { sl.style.transform = 'scale(' + s + ')'; sl.style.transformOrigin = 'center center'; });
}
window.fit = fit;
addEventListener('resize', fit);

/* the deck's show() is a global, so wrapping it catches every page change */
const deckShow = window.show;
window.show = function (n) {
  deckShow(n);
  const k = slides.findIndex(function (s) { return s.classList.contains('on'); });
  pageIdx = k < 0 ? 0 : k;
  setQuote(null);
  replyTo = null;
  renderBadges(); renderList(); highlight(); trackPresence();
};

/* ── rendering ─────────────────────────────────────────────────────────── */
function ago(ts) {
  const t = new Date(ts).getTime();
  if (!t) return '';
  const d = Math.max(0, Date.now() - t);
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' h ago';
  const dd = Math.floor(h / 24);
  if (dd < 7) return dd + ' d ago';
  return new Date(t).toISOString().slice(0, 10);
}

function renderBadges() {
  const counts = new Array(N).fill(0);
  for (let k = 0; k < N; k++) counts[k] = visibleOn(k).rows.length;
  const items = [...document.querySelectorAll('#toclist .tocitem')];
  items.forEach(function (it, k) {
    let b = it.querySelector('.cmtbadge');
    if (!b) {
      b = document.createElement('span'); b.className = 'cmtbadge';
      it.appendChild(b);
    }
    b.textContent = counts[k] || '';
    b.classList.toggle('on', counts[k] > 0);
  });
  const n = counts[pageIdx] || 0;
  const c = btn.querySelector('.cnt');
  c.textContent = n;
  c.classList.toggle('zero', n === 0);
  el.sub.textContent = 'Page ' + (pageIdx + 1) + ' · ' + titles[pageIdx];
}

function renderLive() {
  if (mode !== 'cloud') {
    el.live.classList.add('off');
    el.liveTxt.textContent = 'Local only — comments are not shared yet';
    return;
  }
  el.live.classList.toggle('off', !liveOn);
  el.liveTxt.textContent = liveOn ? presenceLabel(peopleStates()) : 'Reconnecting…';
}
function setLive(on) { liveOn = on; renderLive(); }

/* ── comment body → text, with our own links made clickable ──────────────
   The answer-comment function writes its citations as markdown links, e.g.
   "[3](https://wukun2005-gif.github.io/mailAutopilotForFS/…)" — the
   [3] used to be a dead number, because the numbered list it referred to only
   ever existed inside the prompt.

   Only hosts we own become anchors. An open comment box would otherwise be a
   phishing surface: anyone can post "[click here](https://evil.example)" and
   the deck would render a link that looks like it comes from the author.
   Anything not ours stays exactly as it was typed.

   Nothing goes through innerHTML — text is set with createTextNode and links
   are built with createElement — so no comment, from any source, can turn into
   markup. Newlines need no handling: .bd is white-space:pre-wrap. */
const OK_HOSTS = [
  'github.com/wukun2005-gif/mailAutopilotForFS',
  'wukun2005-gif.github.io/mailAutopilotForFS',
];
function okLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const target = u.host + u.pathname;
    return OK_HOSTS.some(function (h) { return target === h || target.indexOf(h + '/') === 0; });
  } catch (e) { return false; }
}
function renderBody(bd, text) {
  const s = String(text == null ? '' : text);
  const re = /\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g;
  let at = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > at) bd.appendChild(document.createTextNode(s.slice(at, m.index)));
    if (okLink(m[2])) {
      const a = document.createElement('a');
      a.className = 'cite';
      a.href = m[2];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = m[2];
      a.textContent = m[1];
      bd.appendChild(a);
    } else {
      bd.appendChild(document.createTextNode(m[0]));
    }
    at = m.index + m[0].length;
  }
  if (at < s.length) bd.appendChild(document.createTextNode(s.slice(at)));
}

function node(comment, isKid) {
  const isAI = (comment.author || '') === AI_AUTHOR;
  const d = document.createElement('div');
  d.className = 'cmt' + (comment.resolved ? ' resolved' : '')
    + (comment.client_id === me.clientId ? ' mine' : '') + (isAI ? ' ai' : '');
  d.dataset.id = comment.id;

  const top = document.createElement('div'); top.className = 'top';
  const av = document.createElement('span'); av.className = 'av' + (isAI ? ' ai' : '');
  av.textContent = isAI ? 'AI' : ((comment.author || 'A').trim()[0] || '?');
  const nm = document.createElement('span'); nm.className = 'nm';
  nm.textContent = comment.author || 'Anonymous';
  if (isAI) {
    const b = document.createElement('span');
    b.className = 'ai-badge';
    b.textContent = 'auto';
    b.title = 'Answered by the deck itself, grounded in its own PRD, research report and backlog';
    nm.appendChild(b);
  }
  const tm = document.createElement('span'); tm.className = 'tm';
  tm.textContent = ago(comment.created_at);
  const acts = document.createElement('span'); acts.className = 'acts';
  top.appendChild(av); top.appendChild(nm); top.appendChild(tm); top.appendChild(acts);
  d.appendChild(top);

  if (comment.quote) {
    const q = document.createElement('div'); q.className = 'q';
    q.textContent = '“' + comment.quote + '”';
    d.appendChild(q);
  }

  const bd = document.createElement('div'); bd.className = 'bd';
  renderBody(bd, comment.body);
  d.appendChild(bd);

  if (isAI) {
    const note = document.createElement('div'); note.className = 'ai-note';
    note.textContent = "Written by the deck from its own PRD, research report and backlog. It can be wrong — ask Wu Kun about anything binding.";
    d.appendChild(note);
  }

  if (comment.resolved) {
    const dn = document.createElement('span'); dn.className = 'done'; dn.textContent = 'Resolved';
    d.appendChild(dn);
  }

  /* actions — only the author of a comment (same browser) may remove it */
  if (!isKid) {
    const rp = document.createElement('button'); rp.textContent = 'Reply';
    rp.addEventListener('click', function () {
      replyTo = comment.id;
      el.ta.focus();
      el.hint.textContent = 'Replying to ' + (comment.author || 'Anonymous');
    });
    acts.appendChild(rp);

    const rs = document.createElement('button');
    rs.textContent = comment.resolved ? 'Reopen' : 'Resolve';
    rs.addEventListener('click', async function () {
      try {
        await patchRow(comment.id, { resolved: !comment.resolved });
        comment.resolved = !comment.resolved;
        renderBadges(); renderList(); highlight();
        await refresh(true);
      } catch (e) { warn('Could not update that comment.'); }
    });
    acts.appendChild(rs);
  }
  const mineToDelete = comment.client_id === me.clientId;
  if (mineToDelete || ownerOn) {
    const dl = document.createElement('button');
    dl.textContent = 'Delete';
    if (!mineToDelete) dl.title = 'Owner: delete any comment';
    dl.addEventListener('click', async function () {
      /* In owner mode this button also sits on comments that are not yours, so
         the prompt has to name what is about to disappear — "this comment" is
         not enough when the comment is somebody else's. Deleting a top-level
         comment takes its replies with it, and that is worth saying before the
         click rather than after. */
      const who = comment.author || 'Anonymous';
      const msg = mineToDelete ? 'Delete this comment?'
        : comment.parent_id ? 'Owner: delete this reply by ' + who + '?'
          : 'Owner: delete ' + who + '\u2019s comment, and any replies under it?';
      if (!confirm(msg)) return;
      try {
        await patchRow(comment.id, { deleted: true });
        comment.deleted = true;
        /* Delete the replies too rather than leaving them live-but-unreachable.
           They used to stay deleted = false, so they were counted on the badge
           while nothing could render them — the "says 4, shows 0" bug. The
           confirmation above already promised this. */
        if (!comment.parent_id) await patchWhere('parent_id', comment.id, { deleted: true });
        renderBadges(); renderList(); highlight();
        await refresh(true);
      } catch (e) { warn('Could not delete that comment.'); }
    });
    acts.appendChild(dl);
  }
  return d;
}

/* ── what a reader can actually see on one page ──────────────────────────
   Live top-level comments, plus the replies hanging under a live parent.

   The rule has to exist in ONE place. It used to be written out twice and the
   two copies disagreed: the badge counted every row with deleted = false,
   while the list only walked replies whose parent was still there. Deleting a
   top-level comment therefore left its replies counted-but-invisible — the
   badge said "4" and there was nothing on the page to find. Keeping the
   predicate here means the count cannot drift from the list again.

   A reply whose parent is gone is deliberately returned to nobody: its
   context is gone with the parent, and the delete path now marks those
   replies deleted as well, so this is a backstop rather than the norm. */
function visibleOn(k) {
  const mine = all.filter(function (c) { return !c.deleted && resolveIdx(c) === k; });
  const tops = mine.filter(function (c) { return !c.parent_id; });
  const live = {};
  tops.forEach(function (t) { live[t.id] = 1; });
  const kids = {};
  const rows = tops.slice();
  mine.forEach(function (c) {
    if (!c.parent_id || !live[c.parent_id]) return;   // orphan — nothing renders it
    (kids[c.parent_id] = kids[c.parent_id] || []).push(c);
    rows.push(c);
  });
  return { tops: tops, kids: kids, rows: rows };
}

function renderList() {
  const v = visibleOn(pageIdx);
  const tops = v.tops;
  const kids = v.kids;

  el.list.innerHTML = '';
  if (!tops.length) {
    const e = document.createElement('div'); e.className = 'empty';
    e.textContent = 'No comments on this page yet. Select any sentence on the slide to comment on it directly.';
    el.list.appendChild(e);
  }
  const order = function (a, b) {
    if (!!a.resolved !== !!b.resolved) return a.resolved ? 1 : -1;
    return new Date(a.created_at) - new Date(b.created_at);
  };
  tops.sort(order).forEach(function (c) {
    const d = node(c, false);
    (kids[c.id] || []).sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })
      .forEach(function (k) {
        const box = d.querySelector('.kids') || (function () {
          const b = document.createElement('div'); b.className = 'kids'; d.appendChild(b); return b;
        })();
        box.appendChild(node(k, true));
      });
    el.list.appendChild(d);
  });

  if (hotId) {
    const target = el.list.querySelector('[data-id="' + hotId + '"]');
    if (target) {
      target.scrollIntoView({ block: 'center' });
      target.style.transition = 'box-shadow .2s';
      target.style.boxShadow = '0 0 0 2px var(--amber)';
      setTimeout(function () { target.style.boxShadow = ''; }, 1600);
    }
    hotId = null;
  }
}

/* ── anchored quotes: wrap the phrase inside the slide ─────────────────── */
function clearMarks() {
  [...document.querySelectorAll('mark.cmt-anchor')].forEach(function (m) {
    const p = m.parentNode;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m);
  });
}

function textNodes(root) {
  const out = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (n.parentElement && n.parentElement.closest('svg,script,style,mark')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (w.nextNode()) out.push(w.currentNode);
  return out;
}

function locate(root, quote, pre, suf) {
  const nodes = textNodes(root);
  let text = '', map = [];
  nodes.forEach(function (n) {
    map.push({ n: n, a: text.length, b: text.length + n.nodeValue.length });
    text += n.nodeValue;
  });
  let at = -1, from = 0;
  while (from < text.length) {
    const i = text.indexOf(quote, from);
    if (i < 0) break;
    const okPre = !pre || text.slice(Math.max(0, i - pre.length), i) === pre;
    const okSuf = !suf || text.slice(i + quote.length, i + quote.length + suf.length) === suf;
    if (okPre && okSuf) { at = i; break; }
    from = i + 1;
  }
  if (at < 0) return null;
  const end = at + quote.length;
  let s = null, e = null;
  map.forEach(function (m) {
    if (s === null && at >= m.a && at < m.b) s = { n: m.n, o: at - m.a };
    if (e === null && end > m.a && end <= m.b) e = { n: m.n, o: end - m.a };
  });
  return (s && e) ? { s: s, e: e } : null;
}

function highlight() {
  clearMarks();
  const slide = slides[pageIdx];
  if (!slide) return;

  /* Two reviewers can anchor a comment to the same phrase. They must share
     ONE highlight: the second wrap would have to go inside the first <mark>,
     and the text walker deliberately skips mark contents, so the second one
     would silently never render. Group by the quoted phrase instead, and let
     the highlight carry the count. */
  /* Only comments the reader can actually see: an orphaned reply would paint a
     highlight whose count can never be opened. */
  const here = visibleOn(pageIdx).rows.filter(function (c) { return c.quote; });
  const groups = new Map();
  here.forEach(function (c) {
    if (!groups.has(c.quote)) groups.set(c.quote, []);
    groups.get(c.quote).push(c);
  });

  groups.forEach(function (group, quote) {
    let pos = null;
    for (const c of group) {                       // any member's context may be the one that still matches
      pos = locate(slide, quote, c.quote_prefix, c.quote_suffix);
      if (pos) break;
    }
    if (!pos) return;
    const r = document.createRange();
    r.setStart(pos.s.n, pos.s.o);
    r.setEnd(pos.e.n, pos.e.o);
    const m = document.createElement('mark');
    m.className = 'cmt-anchor';
    m.dataset.cid = group[0].id;
    m.dataset.ids = group.map(function (c) { return c.id; }).join(',');
    m.title = group.length > 1
      ? group.length + ' comments on this phrase'
      : 'Comment by ' + (group[0].author || 'Anonymous');
    try { r.surroundContents(m); }
    catch (e) {
      const frag = r.extractContents();
      m.appendChild(frag);
      r.insertNode(m);
    }
  });

  [...slide.querySelectorAll('mark.cmt-anchor')].forEach(function (m) {
    m.addEventListener('click', function () {
      open();
      hotId = m.dataset.cid;
      renderList();
    });
  });
}

/* ── selecting a phrase on the slide ───────────────────────────────────── */
function hideSelBtn() { selBtn.style.display = 'none'; }
function showSelBtn(r) {
  selBtn.style.display = 'flex';
  const left = Math.min(Math.max(12, r.left), window.innerWidth - 170);
  const top = r.bottom + 8 + 40 < window.innerHeight ? r.bottom + 8 : r.top - 40;
  selBtn.style.left = left + 'px';
  selBtn.style.top = Math.max(8, top) + 'px';
}
function contextOf(node, off, back) {
  const t = (node && node.nodeValue) ? node.nodeValue : '';
  return back ? t.slice(Math.max(0, off - 24), off) : t.slice(off, off + 24);
}
function pickSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hideSelBtn(); return; }
  const text = (sel.toString() || '').trim();
  if (text.length < 3 || text.length > 500) { hideSelBtn(); return; }
  const n = sel.anchorNode;
  const e = n && (n.nodeType === 1 ? n : n.parentElement);
  if (!e || !slides[pageIdx] || !slides[pageIdx].contains(e)) { hideSelBtn(); return; }
  if (e.closest('#cmtpanel,#cmtselbtn,#toc,#pbar,#lightbox')) { hideSelBtn(); return; }
  const r = sel.getRangeAt(0);
  const rect = r.getBoundingClientRect();
  if (!rect.width && !rect.height) { hideSelBtn(); return; }
  pending = {
    text: text,
    pre: contextOf(r.startContainer, r.startOffset, true),
    suf: contextOf(r.endContainer, r.endOffset, false)
  };
  showSelBtn(rect);
}
document.addEventListener('mouseup', function (e) {
  if (e.target && e.target.closest && e.target.closest('#cmtpanel,#cmtselbtn')) return;
  setTimeout(pickSelection, 0);
});
document.addEventListener('mousedown', function (e) {
  if (e.target && e.target.closest && e.target.closest('#cmtselbtn')) return;
  hideSelBtn();
});

function setQuote(q) {
  if (!q) {
    pending = null;
    el.qchip.style.display = 'none';
    return;
  }
  el.qchip.style.display = 'flex';
  el.qtext.textContent = '“' + q.text + '”';
  el.ta.focus();
}

/* ── let the deck answer straight away ─────────────────────────────────────
   The database trigger would get to it anyway, but it goes through pg_net's
   queue, and that queue alone added 5–6 seconds to every answer. Calling the
   function directly starts the work immediately. Only the comment's id is
   sent — the function reads the real row itself, so nothing here can be
   forged. If this call fails (offline, tab closed, function cold) the trigger
   still covers it, and both paths are idempotent: one answer per comment. */
function askDeckToAnswer(row) {
  if (mode !== 'cloud' || row.parent_id) return;
  try {
    fetch(`${(CFG.supabaseUrl || '').replace(/\/+$/, '')}/functions/v1/answer-comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CFG.supabaseAnonKey}`,
        apikey: CFG.supabaseAnonKey,
      },
      body: JSON.stringify({ record: { id: row.id } }),
      keepalive: true,
    }).catch(function () { /* the trigger still covers it */ });
  } catch (e) { /* same */ }
}

/* ── send ──────────────────────────────────────────────────────────────── */
async function submit() {
  if (sending) return;
  const body = el.ta.value.trim();
  if (!body) { warn('Write something first.'); return; }
  if (body.length > 2000) { warn('That is too long — 2000 characters max.'); return; }
  warn('');
  sending = true; el.send.disabled = true;

  const row = {
    id: newId(),
    deck_id: DECK,
    page_key: keys[pageIdx],
    page_index: pageIdx,
    page_title: titles[pageIdx],
    author: me.name || 'Anonymous',
    email: me.email || null,
    body: body,
    quote: pending ? pending.text : null,
    quote_prefix: pending ? pending.pre : null,
    quote_suffix: pending ? pending.suf : null,
    parent_id: replyTo || null,
    resolved: false,
    deleted: false,
    client_id: me.clientId,
    created_at: new Date().toISOString()
  };
  try {
    await addRow(row);
    /* Show it straight away instead of waiting for the round trip — a slow
       read should never make a reader wonder whether the comment was sent.
       The refresh below reconciles with whatever the server actually holds,
       and unsentIds keeps this row alive until the read can see it. */
    all = all.filter(function (c) { return c.id !== row.id; }).concat([row]);
    unsentIds.add(row.id);
    renderBadges(); renderList(); highlight();
    el.ta.value = '';
    setQuote(null);
    replyTo = null;
    el.hint.textContent = '';
    await refresh(true);
    askDeckToAnswer(row);
  } catch (e) {
    console.warn('[comments] send failed:', e);
    warn('Could not save that comment (' + (mode === 'cloud' ? 'server' : 'local') + ' error). Try again.');
  } finally {
    sending = false; el.send.disabled = false;
  }
}

/* ── refresh ───────────────────────────────────────────────────────────── */
async function refresh(force) {
  try {
    const rows = await load();
    /* Anything we showed optimistically but the server has not returned yet
       stays on screen: a read that has not caught up must never look like a
       lost comment. As soon as the server does return it, it is no longer
       "unsent" and the server's copy wins. */
    const have = new Set(rows.map(function (r) { return r.id; }));
    unsentIds.forEach(function (id) { if (have.has(id)) unsentIds.delete(id); });
    unsentIds.forEach(function (id) {
      if (have.has(id)) return;
      const local = all.filter(function (c) { return c.id === id; })[0];
      if (local) { rows.push(local); have.add(id); }
    });
    const json = JSON.stringify(rows);
    if (!force && json === lastJSON) return;
    lastJSON = json;
    all = rows;
    renderBadges(); renderList(); highlight();
  } catch (e) {
    console.warn('[comments] refresh failed:', e);
    if (mode === 'cloud') setLive(false);
  }
}

/* Keep clicks inside the panel from reaching the deck's document-level
   handlers: the auto-present arming (a click anywhere starts the narrated
   tour), the lightbox opener, and the cross-page [data-jump] links.
   Bound on the panel itself in the bubble phase, so the panel's own
   buttons still fire first. */
['pointerdown', 'click'].forEach(function (type) {
  panel.addEventListener(type, function (e) { e.stopPropagation(); });
});

/* ── one row per page load ────────────────────────────────────────────────
   Who opened the deck, from where, when. The browser only sends the deck's
   own identity key and the URL — the IP and the country are read off the
   request headers by the page-view function, because a browser cannot be
   asked for its own address.

   Fire-and-forget: `keepalive` so it survives a navigation, a `.catch` so a
   failure is silent, and never awaited — the deck must not wait on a log
   line, and nothing here is allowed to surface as an error. */
function logPageView() {
  if (mode !== 'cloud' || !CFG.supabaseUrl || !CFG.supabaseAnonKey) return;
  try {
    fetch(`${String(CFG.supabaseUrl).replace(/\/+$/, '')}/functions/v1/page-view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CFG.supabaseAnonKey}`,
        apikey: CFG.supabaseAnonKey,
      },
      body: JSON.stringify({
        deckId: DECK,
        clientId: me.clientId,
        path: location.pathname + location.search,
      }),
      keepalive: true,
    }).catch(function () { /* a missed log is still not worth a warning */ });
  } catch (e) { /* same */ }
}

/* ── boot ──────────────────────────────────────────────────────────────── */
(async function boot() {
  renderIdentity();
  renderLive();
  setInterval(function () { if (!document.hidden) refresh(false); }, CFG.pollMs || 8000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(false); });

  await initBackend();
  /* the visit is logged before anything else can delay it — see logPageView */
  logPageView();
  subscribe();
  await refresh(true);

  /* links out of the notification email: ?p=<page-key>&c=<comment-id> */
  const q = new URLSearchParams(location.search);
  const p = q.get('p'), cid = q.get('c');
  if (p) {
    const k = keys.indexOf(p);
    if (k >= 0) window.show(k);
  }
  if (cid) { hotId = cid; open(); }
  renderLive();
})();

/* ── owner mode ────────────────────────────────────────────────────────────
   Owner mode is the URL parameter and nothing else: `?owner=true` adds the
   gear and the Delete control on every comment; take the parameter away and
   both are gone. No localStorage, no sticky state.

   That is a deliberate reversal. The flag used to be remembered per origin,
   which meant one visit put a gear on every page of that origin for good, with
   no way out except a button hidden *inside* the panel it opened — it read as
   "the gear appears by default" and looked like a broken gate.

   The parameter is left in the URL rather than stripped, for two reasons: this
   deck never rewrites its query string (it only reads ?p= and ?c=), so leaving
   it makes owner mode survive a reload with no storage involved; and it makes
   "why is the gear here?" answerable by looking at the address bar. The cost
   is that a screenshot of the address bar shows the flag — an acceptable
   trade for a deck that is already public, and the owner can drop it by
   removing the parameter.

   `?config=true` is retired: it is stripped and ignored, and the storage key it
   used is deleted on every load, so browsers still carrying it stop showing the
   gear. Anything that is not true/1/on/yes leaves owner mode off.

   Note this is obscurity, not authentication — anyone who types the parameter
   gets the panel, exactly as before. The owner chose that over carrying a key;
   OWNER_KEY is still in the project if that trade ever needs to change. */
(function ownerMode() {
  const RETIRED_FLAG = 'deck-comment-config';
  const ON_VALUES = /^(?:true|1|on|yes)$/i;
  try {
    const u = new URL(location.href);
    const params = u.searchParams;
    ownerOn = ON_VALUES.test(params.get('owner') || '');
    if (params.get('config') !== null) {
      params.delete('config');
      history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
      console.warn('[comments] ?config=true is retired — use ?owner=true');
    }
  } catch (e) { /* no URL access — stay out of owner mode */ }
  // drop the retired sticky flag so it cannot bring the gear back
  try { localStorage.removeItem(RETIRED_FLAG); } catch (e) {}
  if (!ownerOn) return;
  /* boot() is async and has not rendered yet, so this is normally a no-op; it
     is here for the case where a list already exists without the controls */
  try { renderList(); } catch (e) {}
  import('./comments-owner.js')
    /* mount() appends the gear, and the gear is placed with the Comments
       button — so the row has to be laid out again once it exists. */
    .then(function (m) { m.mount({ config: CFG, deckId: DECK }); syncBtnToTheme(); })
    .catch(function (e) { console.warn('[comments] owner panel failed to load:', e); });
})();
