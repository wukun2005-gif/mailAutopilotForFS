#!/usr/bin/env node
/**
 * Snapshot / restore / clear a deck's comments — so the page can be emptied
 * without losing the test conversation, and the whole thing can be rendered
 * back onto the deck whenever you want to look at it again.
 *
 * Why a snapshot at all: the rows are the *only* copy of the answers. The
 * archived QA json holds 52 of them, but the hand-typed ones and their replies
 * live nowhere else, and `deck_ai_answers` is gone the moment its question is
 * deleted (FK, ON DELETE CASCADE). A snapshot is what makes clearing reversible.
 *
 * Subcommands
 *   snapshot <deck> [out.json]        dump every row + its ledger row
 *   restore  <file> [--into <deck>]   put them back (original ids by default)
 *                          [--remap]  …or fresh ids, for cloning into a test deck
 *                          [--only <client_id>]  just one batch, replies included
 *   verify   <file> [--into <deck>] [--only <client_id>]
 *                                    prove a restore reproduced the snapshot
 *   clear    <deck>  [--dry] [--yes]  snapshot, then delete every row of that deck
 *
 * `--only qa-seed` is the one to reach for when you want just the seeded Q&A back
 * on the page: it takes the matching questions *and everything hanging off them*,
 * which is how the answers and their ledger rows come along.
 *
 * Notes that cost blood to learn:
 *  · `deck_ai_answers.comment_id` keys on the *question* row, not the answer row.
 *  · Restoring must disable `deck_comment_answer` (else every question gets a
 *    second, freshly generated answer) and `deck_comment_notify` (else the
 *    restore mails people). Both go in the SAME transaction as the insert, so a
 *    failure can never leave a trigger switched off.
 *  · Insert order matters: `parent_id` is a plain (non-deferrable) FK, so roots
 *    go in before replies. Depth here is 2, but the sort is by computed depth so
 *    it holds if that changes.
 *  · Values are passed as JSON through `jsonb_to_recordset`, not as concatenated
 *    literals — answers contain quotes, newlines and markdown, and hand-escaping
 *    them is how you end up with a half-inserted batch.
 *
 * Usage:
 *   SUPABASE_PAT=... node scripts/deck-comments-archive.mjs snapshot mail-autopilot-fs
 *   SUPABASE_PAT=... node scripts/deck-comments-archive.mjs restore deck-comments-mail-autopilot-fs-<ts>.json
 *   SUPABASE_PAT=... node scripts/deck-comments-archive.mjs clear mail-autopilot-fs --dry
 */

import './net-proxy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/* Resolved on first use, not at import time: the guard below must be free to
   fire on a machine with no PAT — otherwise "you are about to write to the
   published deck" gets buried under "no SUPABASE_PAT", which is the wrong
   thing to learn first. */
let _pat = null;
function pat() {
  if (_pat === null) _pat = process.env.SUPABASE_PAT || readPat();
  return _pat;
}
const REF = 'ifiqhyzcklwueqsijtnq';
const FORMAT = 1;

/* The deck the published page reads. Anything written to it is public the
   moment it lands, so every write path has to say --live out loud. This is not
   ceremony: it is the difference between "I was looking at it locally" and
   "I published 52 test comments to the customer-facing deck". */
const LIVE_DECK = 'mail-autopilot-fs';
const ALLOW_LIVE = process.argv.includes('--live');

function guardLiveWrite(deck) {
  if (deck !== LIVE_DECK || ALLOW_LIVE) return;
  throw new Error(
    `'${deck}' is the LIVE deck — anything written there shows up on the published page immediately.\n`
    + `  · to work on a local test deck instead, pass --into ${LIVE_DECK}-local\n`
    + `  · if you really mean to publish, add --live`,
  );
}

function readPat() {
  const s = readFileSync(new URL(import.meta.url), 'utf8');
  const m = /sbp_[A-Za-z0-9]{30,}/.exec(s);
  if (!m) throw new Error('no SUPABASE_PAT — pass it in the env');
  return m[0];
}

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pat()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch { b = t.slice(0, 600); }
  if (!r.ok) throw new Error(`SQL ${r.status}: ${JSON.stringify(b).slice(0, 600)}`);
  return b;
}
/* a JSON payload only has to survive single-quoting to become a SQL literal:
   with standard_conforming_strings on (the default) backslashes pass through
   untouched and the JSON parser handles them, so doubling quotes is enough. */
const lit = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;

const COMMENT_COLS = ['id', 'deck_id', 'page_key', 'page_index', 'page_title', 'author', 'email',
  'body', 'quote', 'quote_prefix', 'quote_suffix', 'parent_id', 'resolved', 'deleted', 'client_id', 'created_at'];
const COMMENT_TYPES = { id: 'uuid', deck_id: 'text', page_key: 'text', page_index: 'integer',
  page_title: 'text', author: 'text', email: 'text', body: 'text', quote: 'text',
  quote_prefix: 'text', quote_suffix: 'text', parent_id: 'uuid', resolved: 'boolean',
  deleted: 'boolean', client_id: 'text', created_at: 'timestamptz' };
const LEDGER_COLS = ['comment_id', 'status', 'model', 'latency_ms', 'chunks', 'sources', 'error', 'created_at', 'updated_at'];
const LEDGER_TYPES = { comment_id: 'uuid', status: 'text', model: 'text', latency_ms: 'integer',
  chunks: 'integer', sources: 'text', error: 'text', created_at: 'timestamptz', updated_at: 'timestamptz' };

/* ── snapshot ────────────────────────────────────────────────────────────── */
async function doSnapshot(deck, out) {
  const comments = await sql(
    `select ${COMMENT_COLS.join(', ')} from deck_comments
      where deck_id='${deck.replace(/'/g, "''")}' order by page_index, created_at`);
  const ledger = await sql(
    `select ${LEDGER_COLS.map((c) => 'a.' + c).join(', ')} from deck_ai_answers a
      where a.comment_id in (select id from deck_comments where deck_id='${deck.replace(/'/g, "''")}')`);

  const fnRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/answer-comment`,
    { headers: { Authorization: `Bearer ${pat()}` } });
  const fnInfo = fnRes.ok ? await fnRes.json() : {};

  const file = out || `deck-comments-${deck}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({
    format: FORMAT,
    snapshotAt: new Date().toISOString(),
    sourceDeck: deck,
    producedBy: { fn: 'answer-comment', version: fnInfo.version ?? null, deployedAt: fnInfo.updated_at ?? null },
    commentCount: comments.length,
    ledgerCount: ledger.length,
    comments,
    ledger,
  }, null, 1));

  const tops = comments.filter((c) => !c.parent_id).length;
  console.log(`snapshotted ${comments.length} comments (${tops} top-level + ${comments.length - tops} replies)`);
  console.log(`            + ${ledger.length} ledger rows`);
  console.log(`            → ${file}`);
  return file;
}

/* ── restore ─────────────────────────────────────────────────────────────── */
const depthOf = (map, id) => { let d = 0; const seen = new Set(); let cur = map.get(id); while (cur) { if (seen.has(cur.id)) throw new Error(`parent cycle at ${cur.id}`); seen.add(cur.id); d++; cur = cur.parent_id ? map.get(cur.parent_id) : null; } return d; };

/* `--only <client_id>` narrows a snapshot to one batch of comments plus
   everything hanging off it. Without the descendant walk you would restore the
   52 questions and none of their answers: the answers are separate rows tagged
   `deck-ai`, and their whole point is that they belong to the question above
   them. Ledger rows follow their comment. */
function selectSubset(snap, only) {
  if (!only) return snap;
  const childMap = new Map();
  for (const c of snap.comments) {
    if (!c.parent_id) continue;
    if (!childMap.has(c.parent_id)) childMap.set(c.parent_id, []);
    childMap.get(c.parent_id).push(c.id);
  }
  const keep = new Set(snap.comments.filter((c) => c.client_id === only).map((c) => c.id));
  const stack = [...keep];
  while (stack.length) {
    for (const kid of childMap.get(stack.pop()) || []) {
      if (!keep.has(kid)) { keep.add(kid); stack.push(kid); }
    }
  }
  const comments = snap.comments.filter((c) => keep.has(c.id));
  if (!comments.length) throw new Error(`no comments with client_id='${only}' in this snapshot`);
  const roots = comments.filter((c) => !c.parent_id).length;
  console.log(`--only ${only}: ${comments.length} of ${snap.comments.length} comments (${roots} matched + ${comments.length - roots} descendants)`);
  return { ...snap, comments, ledger: snap.ledger.filter((l) => keep.has(l.comment_id)) };
}

async function doRestore(file, intoDeck, remap, only) {
  const snapAll = JSON.parse(readFileSync(file, 'utf8'));
  if (snapAll.format !== FORMAT) throw new Error(`snapshot format ${snapAll.format} ≠ ${FORMAT}`);
  const snap = selectSubset(snapAll, only);
  guardLiveWrite(intoDeck || snap.sourceDeck);

  const byId = new Map(snap.comments.map((c) => [c.id, c]));
  for (const c of snap.comments) {
    if (c.parent_id && !byId.has(c.parent_id)) throw new Error(`reply ${c.id} points at a parent outside the selection`);
  }

  const idMap = new Map(snap.comments.map((c) => [c.id, remap ? randomUUID() : c.id]));
  /* roots first: parent_id is a plain FK, so a reply inserted before its parent
     is rejected. Depth is computed from the snapshot's own parent chain. */
  const rows = snap.comments
    .map((c) => ({ c, depth: depthOf(byId, c.id) }))
    .sort((a, b) => a.depth - b.depth)
    .map(({ c }) => ({
      ...c,
      id: idMap.get(c.id),
      deck_id: intoDeck || c.deck_id,
      parent_id: c.parent_id ? idMap.get(c.parent_id) : null,
    }));

  const existing = await sql(
    `select count(*) n from deck_comments where id in (${rows.map((r) => `'${r.id}'`).join(',') || "''"})`);
  if (existing[0].n) throw new Error(`${existing[0].n} of these ids already exist — restore into a clean deck, or pass --remap`);

  const ledger = snap.ledger.map((l) => ({ ...l, comment_id: idMap.get(l.comment_id) }));

  const batch = [
    'begin;',
    'alter table public.deck_comments disable trigger deck_comment_answer;',
    'alter table public.deck_comments disable trigger deck_comment_notify;',
    `insert into public.deck_comments (${COMMENT_COLS.join(',')})
       select ${COMMENT_COLS.join(',')}
         from jsonb_to_recordset(${lit(rows)}) as x(${COMMENT_COLS.map((c) => `${c} ${COMMENT_TYPES[c]}`).join(', ')});`,
    ledger.length
      ? `insert into public.deck_ai_answers (${LEDGER_COLS.join(',')})
           select ${LEDGER_COLS.join(',')}
             from jsonb_to_recordset(${lit(ledger)}) as x(${LEDGER_COLS.map((c) => `${c} ${LEDGER_TYPES[c]}`).join(', ')});`
      : 'select 1;',
    'alter table public.deck_comments enable trigger deck_comment_answer;',
    'alter table public.deck_comments enable trigger deck_comment_notify;',
    'commit;',
  ].join('\n');
  await sql(batch);

  const trig = await sql(`select tgname, tgenabled from pg_trigger
     where tgrelid='public.deck_comments'::regclass and not tgisinternal order by 1`);
  const off = trig.filter((t) => t.tgenabled !== 'O');
  const target = intoDeck || snap.sourceDeck;
  console.log(`restored ${rows.length} comments + ${ledger.length} ledger rows into '${target}'${remap ? ' (ids regenerated)' : ' (original ids)'}`);
  console.log(`triggers: ${trig.map((t) => t.tgname + '=' + t.tgenabled).join('  ')}${off.length ? '   ✗ SOMETHING IS STILL OFF' : '   ✓ all armed'}`);
  if (off.length) process.exit(1);
  return target;
}

/* ── verify ──────────────────────────────────────────────────────────────── */
const canon = (c, byId) => {
  const p = c.parent_id ? byId.get(c.parent_id) : null;
  return [c.page_index, c.page_key, c.page_title ?? '', c.author, c.email ?? '', c.client_id ?? '',
    c.resolved ? 1 : 0, c.deleted ? 1 : 0, c.body, '<-', p ? p.author + '|' + p.body : 'ROOT'].join('\u0001');
};
const tally = (list) => { const m = new Map(); for (const k of list) m.set(k, (m.get(k) || 0) + 1); return m; };
const diff = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter((k) => (a.get(k) || 0) !== (b.get(k) || 0));

async function doVerify(file, intoDeck, only) {
  const snap = selectSubset(JSON.parse(readFileSync(file, 'utf8')), only);
  const deck = intoDeck || snap.sourceDeck;
  const now = await sql(
    `select ${COMMENT_COLS.join(', ')} from deck_comments where deck_id='${deck.replace(/'/g, "''")}'`);
  const nowLed = await sql(
    `select ${LEDGER_COLS.map((c) => 'a.' + c).join(', ')}, q.body as question from deck_ai_answers a
       join deck_comments q on q.id = a.comment_id where q.deck_id='${deck.replace(/'/g, "''")}'`);
  const snapQ = new Map(snap.comments.map((c) => [c.id, c]));

  const A = tally(snap.comments.map((c) => canon(c, new Map(snap.comments.map((x) => [x.id, x])))));
  const B = tally(now.map((c) => canon(c, new Map(now.map((x) => [x.id, x])))));
  const d = diff(A, B);

  const lA = tally(snap.ledger.map((l) => [snapQ.get(l.comment_id)?.body, l.status, l.model, l.latency_ms, l.chunks, l.sources, l.error].join('\u0001')));
  const lB = tally(nowLed.map((l) => [l.question, l.status, l.model, l.latency_ms, l.chunks, l.sources, l.error].join('\u0001')));
  const lD = diff(lA, lB);

  console.log(`snapshot: ${snap.comments.length} comments / ${snap.ledger.length} ledger`);
  console.log(`   deck '${deck}': ${now.length} comments / ${nowLed.length} ledger`);
  console.log(`comment tree identical: ${d.length === 0 ? 'YES ✓' : 'NO ✗ (' + d.length + ' differing)'}`);
  d.slice(0, 5).forEach((k) => console.log(`   · snapshot ×${A.get(k) || 0} vs deck ×${B.get(k) || 0}: ${k.split('\u0001').slice(0, 4).join(' | ')} :: ${k.split('\u0001')[8].slice(0, 70)}`));
  console.log(`answers identical:      ${lD.length === 0 ? 'YES ✓' : 'NO ✗ (' + lD.length + ' differing)'}`);
  lD.slice(0, 5).forEach((k) => console.log(`   · ${k.split('\u0001').join(' | ').slice(0, 170)}`));
  const ok = !d.length && !lD.length;
  console.log(ok ? '\n✓ restore is faithful — the snapshot can stand in for the rows' : '\n✗ restore does NOT reproduce the snapshot');
  if (!ok) process.exit(1);
}

/* ── clear ───────────────────────────────────────────────────────────────── */
async function doClear(deck, dry, yes) {
  guardLiveWrite(deck);
  const rows = await sql(
    `select client_id, parent_id is not null as reply, count(*) n
       from deck_comments where deck_id='${deck.replace(/'/g, "''")}' group by 1,2 order by 1,2`);
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  const ledger = await sql(
    `select count(*) n from deck_ai_answers a where a.comment_id in
      (select id from deck_comments where deck_id='${deck.replace(/'/g, "''")}')`);

  console.log(`deck '${deck}' holds ${total} comments and ${ledger[0].n} ledger rows:\n`);
  for (const r of rows) {
    console.log(`   ${String(r.client_id ?? '(none)').padEnd(38)} ${r.reply ? 'replies' : 'top-level'}  ${r.n}`);
  }

  if (dry) { console.log('\n--dry: nothing snapshotted, nothing deleted.'); return; }
  if (!yes) { console.log('\nrefusing to delete without --yes (a snapshot is written first, but say it on purpose).'); process.exit(2); }

  const file = await doSnapshot(deck, null);
  const check = JSON.parse(readFileSync(file, 'utf8'));
  if (check.commentCount !== total) {
    throw new Error(`snapshot has ${check.commentCount} rows but the deck has ${total} — refusing to delete`);
  }
  console.log(`\nsnapshot verified against the live count (${total}) — deleting now`);

  const gone = await sql(`delete from deck_comments where deck_id='${deck.replace(/'/g, "''")}' returning id`);
  const left = await sql(`select count(*) n from deck_comments where deck_id='${deck.replace(/'/g, "''")}'`);
  const orphan = await sql(`select count(*) n from deck_ai_answers a where not exists (select 1 from deck_comments c where c.id=a.comment_id)`);
  const other = await sql(`select deck_id, count(*) n from deck_comments group by 1 order by 2 desc`);
  const trig = await sql(`select tgname, tgenabled from pg_trigger
     where tgrelid='public.deck_comments'::regclass and not tgisinternal order by 1`);

  console.log(`deleted ${gone.length} rows from '${deck}'`);
  console.log(`  rows left in '${deck}':  ${left[0].n} (want 0)`);
  console.log(`  orphan ledger rows:     ${orphan[0].n} (want 0)`);
  console.log(`  other decks untouched:  ${other.map((o) => o.deck_id + '=' + o.n).join('  ') || '(none)'}`);
  console.log(`  triggers:               ${trig.map((t) => t.tgname + '=' + t.tgenabled).join('  ')}`);
  console.log(`\nre-render onto the page at any time with:\n   node scripts/deck-comments-archive.mjs restore ${file}`);
}

/* ── dispatch ────────────────────────────────────────────────────────────── */
const [cmd, ...rest] = process.argv.slice(2);
const arg = rest.find((a) => !a.startsWith('--'));
const flagVal = (name) => { const i = rest.indexOf(name); return i > -1 ? rest[i + 1] : null; };
const into = flagVal('--into');
const only = flagVal('--only');
const flags = new Set(rest.filter((a) => a.startsWith('--')));

try {
  if (cmd === 'snapshot') {
    if (!arg) throw new Error('usage: snapshot <deck> [out.json]');
    await doSnapshot(arg, rest.filter((a) => !a.startsWith('--'))[1] || null);
  } else if (cmd === 'restore') {
    if (!arg) throw new Error('usage: restore <file> [--into <deck>] [--remap] [--only <client_id>] [--live]');
    await doRestore(arg, into, flags.has('--remap'), only);
  } else if (cmd === 'verify') {
    if (!arg) throw new Error('usage: verify <file> [--into <deck>] [--only <client_id>]');
    await doVerify(arg, into, only);
  } else if (cmd === 'clear') {
    if (!arg) throw new Error('usage: clear <deck> [--dry] [--yes] [--live]');
    await doClear(arg, flags.has('--dry'), flags.has('--yes'));
  } else {
    console.log(`usage:
  snapshot <deck> [out.json]
  restore  <file> [--into <deck>] [--remap] [--only <client_id>] [--live]
  verify   <file> [--into <deck>] [--only <client_id>]
  clear    <deck> [--dry] [--yes] [--live]

'${LIVE_DECK}' is the live deck: writes there need --live.
Default to --into ${LIVE_DECK}-local for anything you are just looking at.`);
    process.exit(2);
  }
} catch (e) {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
}
