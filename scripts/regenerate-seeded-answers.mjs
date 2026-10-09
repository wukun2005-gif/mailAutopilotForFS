#!/usr/bin/env node
/**
 * Re-asks the seeded questions whose answer came back in the wrong language.
 *
 * The seed (scripts/seed-qa-on-deck.mjs) replays an archived run verbatim, so a
 * fix to the prompt cannot show up in it — the answers are frozen at whatever
 * the old function produced. This deletes just those question rows and inserts
 * them again, which fires deck_comment_answer and lets the *deployed* function
 * answer them fresh. Then it reports the language of each new answer.
 *
 * Scope: only rows tagged client_id = 'qa-seed'. The owner's own comments on the
 * same deck are never selected, deleted or re-asked.
 *
 * Usage:
 *   SUPABASE_PAT=... node scripts/regenerate-seeded-answers.mjs --cjk      # the wrong-language ones
 *   SUPABASE_PAT=... node scripts/regenerate-seeded-answers.mjs --all      # every seeded question
 *   SUPABASE_PAT=... node scripts/regenerate-seeded-answers.mjs --page 3   # one page
 *   ...add --dry to see the list without touching anything (no --live needed)
 *   ...add --live to actually re-ask them — this writes the published deck
 */

import './net-proxy.mjs';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { QUESTIONS } from './qa-deck-questions.mjs';

/* Resolved on first use, not at import time: the guard below must be free to
   fire on a machine with no PAT — otherwise "you are about to write to the
   published deck" gets buried under "no SUPABASE_PAT". */
let _pat = null;
function pat() {
  if (_pat === null) _pat = process.env.SUPABASE_PAT || readPat();
  return _pat;
}
const REF = 'ifiqhyzcklwueqsijtnq';
const DECK = 'mail-autopilot-fs';
const OWNER_EMAIL = 'wukun2005@gmail.com';
const CLIENT = 'qa-seed';

const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');
const CJK = process.argv.includes('--cjk');
const pageArg = process.argv.indexOf('--page');
const PAGE = pageArg > -1 ? Number(process.argv[pageArg + 1]) : null;

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
  if (!r.ok) throw new Error(`SQL ${r.status}: ${JSON.stringify(b).slice(0, 500)}`);
  return b;
}
const q1 = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!ALL && !CJK && PAGE === null) {
  console.error('pick a scope: --cjk | --all | --page N');
  process.exit(2);
}

/* The deck this rewrites is the published one: it deletes the rows and calls
   the deployed function again, so the new answers are on the customer-facing
   page. --dry stays free — it only reads, so it can still show you the plan. */
if (!process.argv.includes('--live') && !DRY) {
  throw new Error(
    `'${DECK}' is the LIVE deck — this re-answers on the published page.\n`
    + `  · to rehearse against a local deck: restore the snapshot with --into ${DECK}-local\n`
    + `  · to see what it would touch: add --dry\n`
    + `  · to do it on purpose: add --live`,
  );
}

/* ── who is in scope ──────────────────────────────────────────────────── */
const asked = await sql(
  `select c.id, c.page_index, c.page_key, c.page_title, c.body, c.author, a.body as answer
     from deck_comments c
     left join deck_comments a on a.parent_id = c.id and a.client_id = 'deck-ai'
    where c.deck_id = '${DECK}' and c.client_id = '${CLIENT}'
    order by c.page_index, c.created_at`);

const han = (s) => (String(s || '').match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
const latin = (s) => (String(s || '').match(/[A-Za-z]/g) || []).length;
/* Drop the Sources legend and every markdown link target before counting: an
   answer carries several full URLs, and those are long enough Latin runs to
   make a plainly Chinese answer look Latin-majority. */
const proseOf = (a) => String(a || '')
  .split('\n\nSources: ')[0]
  .replace(/\]\([^)]*\)/g, ']');
const isCjkAnswer = (a) => {
  const p = proseOf(a);
  return han(p) > latin(p);
};

let targets = asked;
if (CJK) targets = targets.filter((r) => isCjkAnswer(r.answer));
/* the deck's page number is page_index + 1, so "page 3" is index 2 */
if (PAGE !== null) targets = targets.filter((r) => Number(r.page_index) === PAGE - 1);

const byQ = new Map(QUESTIONS.map((it) => [it.q, it]));
targets = targets.filter((r) => byQ.has(r.body));

console.log(`seeded questions on the deck: ${asked.length}`);
console.log(`in scope (${ALL ? 'all' : CJK ? 'answers written in Chinese' : 'page ' + PAGE}): ${targets.length}`);
for (const r of targets) {
  const p = proseOf(r.answer);
  console.log(`  p${r.page_index + 1} · ${String(r.author).padEnd(18)} · han ${han(p)} / latin ${latin(p)} · ${String(r.body).slice(0, 62)}…`);
}
if (!targets.length) { console.log('\nnothing to do.'); process.exit(0); }
if (DRY) { console.log('\n--dry: nothing written.'); process.exit(0); }

/* ── delete, then re-insert so the trigger answers them again ──────────── */
const ids = targets.map((r) => `'${r.id}'`).join(',');
const gone = await sql(`delete from deck_comments where deck_id='${DECK}' and id in (${ids}) returning id`);
console.log(`\nremoved ${gone.length} question rows (their answers and ledger rows cascaded)`);

const now = Date.now();
const values = targets.map((r, i) => {
  const meta = byQ.get(r.body);
  const at = new Date(now + i * 3000).toISOString();
  return `('${randomUUID()}','${DECK}','${q1(meta.key)}',${meta.idx},'${q1(meta.title)}',`
    + `'${q1(r.author)}','${OWNER_EMAIL}','${q1(r.body)}',null,'${CLIENT}','${at}')`;
});
const fresh = await sql(
  `insert into deck_comments (id,deck_id,page_key,page_index,page_title,author,email,body,parent_id,client_id,created_at)
   values ${values.join(',')} returning id`);
console.log(`re-asked ${fresh.length} questions — the deployed function answers them now`);

const freshIds = fresh.map((x) => `'${x.id}'`).join(',');
console.log('waiting for answers (this is the real pipeline, ~7s each)…');
let got = 0;
for (let i = 0; i < 25; i++) {
  await sleep(6000);
  got = (await sql(
    `select count(*) n from deck_comments where deck_id='${DECK}' and client_id='deck-ai' and parent_id in (${freshIds})`))[0].n;
  if (got !== targets.length) continue;
  break;
}

/* ── what came back ───────────────────────────────────────────────────── */
const answers = await sql(
  `select parent_id, body from deck_comments
    where deck_id='${DECK}' and client_id='deck-ai' and parent_id in (${freshIds})`);
console.log(`\n${answers.length}/${targets.length} answered\n`);
let stillWrong = 0;
for (const a of answers) {
  const src = targets[fresh.findIndex((x) => x.id === a.parent_id)];
  const prose = proseOf(a.body);
  const h = han(prose), l = latin(prose);
  const bad = isCjkAnswer(a.body);
  if (bad) stillWrong++;
  console.log(`  p${src.page_index + 1} · ${src.author}`);
  console.log(`     han ${h} / latin ${l} → ${bad ? 'STILL CHINESE' : 'English'}`);
  console.log(`     ${prose.replace(/\s+/g, ' ').slice(0, 150)}…`);
}
console.log(stillWrong
  ? `\n${stillWrong} still in Chinese — the prompt fix did not hold for these.`
  : '\nall re-asked answers came back in the question\'s language.');
