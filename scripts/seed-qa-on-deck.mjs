#!/usr/bin/env node
/**
 * Puts the 52-question QA run onto the deck itself, so it can be read in the
 * comments panel page by page instead of only in the report.
 *
 * It replays the answers that were actually produced (qa-answer-comments-52.json
 * is the archive of that run) rather than asking the model again. Nothing here
 * calls a model: the rows are inserted verbatim.
 *
 * Why the triggers get turned off for the insert
 * ---------------------------------------------
 * deck_comments carries two AFTER INSERT triggers:
 *   deck_comment_answer  — answers any new top-level comment, which would
 *                          generate a SECOND answer next to the replayed one
 *   deck_comment_notify  — would email the owner about all 52
 * Both are disabled for the duration of the write and re-enabled in the same
 * transaction, so a failure anywhere rolls the whole thing back and the deck is
 * never left unable to answer. (Verified: a multi-statement batch from the
 * Management API runs as one transaction — a ROLLBACK undoes an earlier CREATE.)
 *
 * Isolation
 * ---------
 * Questions are tagged client_id = "qa-seed", which is what --remove targets.
 * The load-bearing detail is email = OWNER_EMAIL: notify-reply deliberately
 * never mails the owner their own comment, so even if a trigger were left on
 * this run sends zero mail. Delete is scoped to client_id, so the owner's real
 * comments on the same deck are never touched.
 *
 * Usage:
 *   SUPABASE_PAT=... node scripts/seed-qa-on-deck.mjs            # insert
 *   SUPABASE_PAT=... node scripts/seed-qa-on-deck.mjs --remove   # take it back off
 *   SUPABASE_PAT=... node scripts/seed-qa-on-deck.mjs --dry      # print, write nothing
 */

import './net-proxy.mjs';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { QUESTIONS } from './qa-deck-questions.mjs';

const PAT = process.env.SUPABASE_PAT || readPat();
const REF = 'ifiqhyzcklwueqsijtnq';
const DECK = 'mail-autopilot-fs';
const OWNER_EMAIL = 'wukun2005@gmail.com';
const ARCHIVE = 'qa-answer-comments-52.json';

const CLIENT = 'qa-seed';
const AI_MODEL = 'deepseek-v4-flash-0731';

const DRY = process.argv.includes('--dry');
const REMOVE = process.argv.includes('--remove');

function readPat() {
  const s = readFileSync(new URL(import.meta.url), 'utf8');
  const m = /sbp_[A-Za-z0-9]{30,}/.exec(s);
  if (!m) throw new Error('no SUPABASE_PAT — pass it in the env');
  return m[0];
}
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  let b; try { b = JSON.parse(t); } catch { b = t.slice(0, 600); }
  if (!r.ok) throw new Error(`SQL ${r.status}: ${JSON.stringify(b).slice(0, 500)}`);
  return b;
}
const q1 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── take it back off ─────────────────────────────────────────────────── */
if (REMOVE) {
  const before = (await sql(
    `select count(*) n from deck_comments where deck_id='${DECK}' and client_id='${CLIENT}'`))[0].n;
  console.log(`qa-seed rows on the deck: ${before}`);
  if (!before) { console.log('nothing to remove.'); process.exit(0); }
  const gone = await sql(
    `delete from deck_comments where deck_id='${DECK}' and client_id='${CLIENT}' returning id`);
  console.log(`removed ${gone.length} questions (their answers cascade)`);
  const after = (await sql(
    `select count(*) n from deck_comments where deck_id='${DECK}' and client_id='${CLIENT}'`))[0].n;
  const live = (await sql(
    `select count(*) n from deck_comments where deck_id='${DECK}' and deleted=false and client_id is distinct from '${CLIENT}'`))[0].n;
  console.log(`qa-seed rows left: ${after} (want 0)`);
  console.log(`other visible comments on the deck: ${live} (the owner's own — untouched)`);
  process.exit(after === 0 ? 0 : 1);
}

/* ── build the rows ───────────────────────────────────────────────────── */
const run = JSON.parse(readFileSync(ARCHIVE, 'utf8'));
const byQ = new Map(QUESTIONS.map((it) => [it.q, it]));
const base = Date.parse(run.ranAt) || Date.now();

const questions = [];   // { id, values }
const ledger = [];
run.rows.forEach((r, i) => {
  const meta = byQ.get(r.question);
  if (!meta) throw new Error(`no page metadata for: ${r.question.slice(0, 70)}`);
  const id = randomUUID();
  const at = new Date(base + i * 4000).toISOString();
  questions.push({
    id, at, meta, r,
    body: r.question, author: r.who,
    answerId: r.answer ? randomUUID() : null,
    answerAt: new Date(base + i * 4000 + 2000).toISOString(),
  });
  if (r.answer) {
    ledger.push({
      comment_id: id, chunks: r.chunks, ms: r.ms, sources: r.sources,
      created_at: at, updated_at: at,
    });
  }
});

const missing = questions.filter((x) => !x.r.answer);
console.log(`archive       ${ARCHIVE} · ${run.rows.length} questions · ranAt ${run.ranAt}`);
console.log(`deck          ${DECK}`);
console.log(`to insert     ${questions.length} questions + ${questions.length - missing.length} answers`);
console.log(`pages         ${[...new Set(questions.map((x) => x.meta.page))].sort((a, b) => a - b).join(', ')}`);
if (missing.length) console.log(`no answer for ${missing.length} question(s): ${missing.map((x) => 'p' + x.meta.page).join(', ')}`);

const cols = 'id,deck_id,page_key,page_index,page_title,author,email,body,parent_id,client_id,created_at';
const values = [];
for (const q of questions) {
  values.push(`('${q.id}','${DECK}','${q1(q.meta.key)}',${q.meta.idx},'${q1(q.meta.title)}',` +
    `'${q1(q.author)}','${OWNER_EMAIL}','${q1(q.body)}',null,'${CLIENT}','${q.at}')`);
  if (q.answerId) {
    values.push(`('${q.answerId}','${DECK}','${q1(q.meta.key)}',${q.meta.idx},'${q1(q.meta.title)}',` +
      `'Deck AI',null,'${q1(q.r.answer)}','${q.id}','deck-ai','${q.answerAt}')`);
  }
}
const ledgerValues = ledger.map((l) =>
  `('${l.comment_id}','sent','${AI_MODEL}',${l.ms ?? 'null'},${l.chunks ?? 'null'},` +
  `'${q1(l.sources)}',null,'${l.created_at}','${l.updated_at}')`);

if (DRY) {
  console.log(`\n--dry: would insert ${values.length} comment rows and ${ledger.length} ledger rows. Nothing written.`);
  console.log('\nfirst two value tuples:');
  console.log('  ' + values[0].slice(0, 220) + '…');
  console.log('  ' + values[1].slice(0, 220) + '…');
  process.exit(0);
}

/* ── one transaction: triggers off, insert, triggers on ───────────────── */
const batch = [
  'begin;',
  'alter table public.deck_comments disable trigger deck_comment_answer;',
  'alter table public.deck_comments disable trigger deck_comment_notify;',
  `insert into public.deck_comments (${cols}) values\n  ` + values.join(',\n  ') + ';',
  ledger.length
    ? 'insert into public.deck_ai_answers (comment_id,status,model,latency_ms,chunks,sources,error,created_at,updated_at) values\n  '
      + ledgerValues.join(',\n  ') + ';'
    : 'select 1;',
  'alter table public.deck_comments enable trigger deck_comment_answer;',
  'alter table public.deck_comments enable trigger deck_comment_notify;',
  'commit;',
].join('\n');

console.log('\nwriting…');
await sql(batch);

/* ── verify ───────────────────────────────────────────────────────────── */
const trg = await sql(
  `select tgname, tgenabled from pg_trigger
    where tgrelid='public.deck_comments'::regclass and not tgisinternal order by tgname`);
console.log('\ntrigger state (tgenabled O = on):');
for (const t of trg) console.log(`  ${t.tgname.padEnd(26)} ${t.tgenabled}`);

const counts = await sql(
  `select
     count(*) filter (where client_id='${CLIENT}') seeded,
     count(*) filter (where client_id='deck-ai' and parent_id in
        (select id from deck_comments where client_id='${CLIENT}')) seeded_answers,
     count(*) filter (where client_id is distinct from '${CLIENT}') others,
     count(*) total
   from deck_comments where deck_id='${DECK}'`);
console.log('\ndeck now:', JSON.stringify(counts[0]));

const perPage = await sql(
  `select page_index, count(*) n from deck_comments
    where deck_id='${DECK}' and deleted=false and client_id is distinct from '${CLIENT}'
    group by 1 order by 1`);
console.log('visible rows the seed did NOT create (the owner\'s):', JSON.stringify(perPage));

const led = await sql(
  `select count(*) n from deck_ai_answers a join deck_comments c on c.id=a.comment_id
    where c.client_id='${CLIENT}'`);
console.log('ledger rows for the seed:', led[0].n);

const offTriggers = trg.filter((t) => t.tgenabled !== 'O');
if (offTriggers.length) {
  console.error('\n!! a trigger was left disabled — re-enabling');
  await sql(offTriggers.map((t) =>
    `alter table public.deck_comments enable trigger ${t.tgname};`).join('\n'));
  process.exit(1);
}
console.log('\ndone. Panel: page 2 onwards, 4 questions per page.');
console.log('undo with:  node scripts/seed-qa-on-deck.mjs --remove');
