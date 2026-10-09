#!/usr/bin/env node
/**
 * Repeat-probe: ask one question N times through the deployed function and see
 * how much the answer moves. Used to separate "the prompt change caused this"
 * from "this is ordinary sampling spread" — the only way to tell, since the
 * deck's answers are generated, not computed.
 *
 * Writes to deck_id='mail-autopilot-fs-qa' (never the live deck) and cleans up
 * after itself unless --keep is passed.
 *
 * Usage: SUPABASE_PAT=... node scripts/probe-answer-variance.mjs "question text" [--n 3]
 *          [--pick 3]         the Nth question of the QA set, instead of typing it
 *          [--expect 50,000]  a figure every run must contain
 *          [--reject 60k]     a figure no run may contain
 *
 * --expect / --reject exist because "the answer is generated" cuts both ways:
 * spread is normal, but a *wrong number* is not spread, it is a defect. They turn
 * "does the fix hold" into a pass/fail instead of a read-the-prose-and-hope.
 */

import './net-proxy.mjs';
import { readFileSync } from 'node:fs';
import { QUESTIONS, DECK_ID_QA } from './qa-deck-questions.mjs';

const PAT = process.env.SUPABASE_PAT || readPat();
const REF = 'ifiqhyzcklwueqsijtnq';
const OWNER_EMAIL = 'wukun2005@gmail.com';
const KEEP = process.argv.includes('--keep');
const nArg = process.argv.indexOf('--n');
const N = nArg > -1 ? Number(process.argv[nArg + 1]) : 3;
const flagArg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const EXPECT = flagArg('--expect');
const REJECT = flagArg('--reject');
/* --pick N takes the Nth question (1-based) straight out of the QA set. Typing a
   question by hand is how you end up with a hyphen where the file has an en
   dash, and then the lookup fails and you debug your own quoting. */
const PICK = flagArg('--pick');
const QTEXT = PICK
  ? QUESTIONS[Number(PICK) - 1]?.q
  : process.argv.slice(2).find((a) => !a.startsWith('--') && a !== String(N)
      && a !== EXPECT && a !== REJECT && a !== PICK);

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
  let b; try { b = JSON.parse(t); } catch { b = t.slice(0, 500); }
  if (!r.ok) throw new Error(`SQL ${r.status}: ${JSON.stringify(b).slice(0, 500)}`);
  return b;
}
const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const han = (s) => (String(s || '').match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
const latin = (s) => (String(s || '').match(/[A-Za-z]/g) || []).length;
const proseOf = (a) => String(a || '').split('\n\nSources: ')[0].replace(/\]\([^)]*\)/g, ']');

const meta = QUESTIONS.find((it) => it.q === QTEXT);
if (!meta) {
  console.error(PICK ? `--pick ${PICK}: out of range (the set has ${QUESTIONS.length})` : 'question not found in the QA set — pass --pick N to choose by number:');
  QUESTIONS.slice(0, 8).forEach((it, i) => console.error(`   ${String(i + 1).padStart(2)}. ` + it.q.slice(0, 70)));
  process.exit(2);
}

await sql(`delete from deck_comments where deck_id='${DECK_ID_QA}'`);
const values = Array.from({ length: N }, (_, i) =>
  `(gen_random_uuid(),'${DECK_ID_QA}','${esc(meta.key)}',${meta.idx},'${esc(meta.title)}',`
  + `'Probe','${OWNER_EMAIL}','${esc(QTEXT)}','probe-${Date.now()}-${i}')`).join(',\n  ');
await sql(
  `insert into deck_comments (id,deck_id,page_key,page_index,page_title,author,email,body,client_id)
   values\n  ${values}`);
console.log(`asked the same question ${N}× — p${meta.idx + 1} · ${QTEXT.slice(0, 70)}…\n`);

let got = 0;
for (let i = 0; i < 30; i++) {
  await sleep(6000);
  got = (await sql(`select count(*) n from deck_comments where deck_id='${DECK_ID_QA}' and client_id='deck-ai'`))[0].n;
  if (got === N) break;
}
const rows = await sql(
  `select a.body answer, l.sources, l.chunks
     from deck_comments a left join deck_ai_answers l on l.comment_id = a.parent_id
    where a.deck_id='${DECK_ID_QA}' and a.client_id='deck-ai' order by a.created_at`);

console.log(`${rows.length}/${N} answered\n`);
let cited = 0, legend = 0, cjk = 0;
rows.forEach((r, i) => {
  const a = String(r.answer);
  const hasLink = /\]\(http/.test(a);
  const hasLeg = /\n\nSources: /.test(a);
  if (hasLink) cited++;
  if (hasLeg) legend++;
  if (han(proseOf(a)) > latin(proseOf(a))) cjk++;
  console.log(`run ${i + 1}: link ${hasLink ? 'Y' : 'n'} · legend ${hasLeg ? 'Y' : 'n'} · han ${han(proseOf(a))} / latin ${latin(proseOf(a))} · len ${a.length} · sources ${r.chunks}`);
  console.log(`   ${proseOf(a).replace(/\s+/g, ' ').slice(0, 260)}…`);
  console.log();
});
console.log(`── spread over ${rows.length} runs: cited ${cited}/${rows.length} · legend ${legend}/${rows.length} · Chinese-majority ${cjk}/${rows.length}`);

/* A wrong figure is a defect, not spread — so it gets a verdict, not a line to read. */
if (rows.length && (EXPECT || REJECT)) {
  const withExpect = EXPECT ? rows.filter((r) => String(r.answer).includes(EXPECT)).length : null;
  const withReject = REJECT ? rows.filter((r) => String(r.answer).includes(REJECT)).length : null;
  console.log('');
  if (EXPECT) console.log(`── figure check: "${EXPECT}" present in ${withExpect}/${rows.length}`);
  if (REJECT) console.log(`── figure check: "${REJECT}" present in ${withReject}/${rows.length}`);
  const ok = (!EXPECT || withExpect === rows.length) && (!REJECT || withReject === 0);
  console.log(ok
    ? '── figures: PASS'
    : '── figures: FAIL — a figure moved, which the sampling spread does not explain');
}

if (!KEEP) {
  const gone = await sql(`delete from deck_comments where deck_id='${DECK_ID_QA}' returning id`);
  console.log(`\ncleaned up ${gone.length} probe rows`);
}
