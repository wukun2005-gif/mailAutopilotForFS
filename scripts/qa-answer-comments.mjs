#!/usr/bin/env node
/**
 * QA run for the deck's AI answering, across deck pages 2–14.
 *
 * 52 questions: four per page, each from a different role out of the seven the
 * owner named (PM department director, Engineering VP, PM line VP, Senior PM,
 * Principal PM, Senior Engineer, Principal Engineer), each written against that
 * page's content — related to it, not a rewording of it.
 *
 * What it grades
 *   1 whether the deck answered at all, and how long it took
 *   2 whether the answer carries citations — a link per marker, plus the
 *     Sources legend (the thing that used to be missing)
 *   3 which knowledge sources the answer actually came from, against the five
 *     published documents (deck · PRD · research report · backlog · README)
 *   4 whether every figure in the answer is traceable to the material that was
 *     retrieved — the cheap, objective hallucination check in a deck whose
 *     substance is numbers
 *   5 that no answer was written from the internal-only material (the dev plan
 *     is not published, and the bookkeeping chapters are excluded from the KB)
 *
 * Isolation, on purpose
 *   · Writes go to deck_id "mail-autopilot-fs-qa", so nothing appears on the
 *     live deck (which filters deck_id = "mail-autopilot-fs").
 *   · Every comment carries email = OWNER_EMAIL. notify-reply deliberately
 *     never mails the owner their own comment, so a 52-question run sends
 *     ZERO email. Without this the run would have sent 52.
 *   · The rows are hard-deleted at the end (they are ours, and the FK cascade
 *     removes the answers and the ledger rows with them).
 *
 * Usage:  node scripts/qa-answer-comments.mjs [--dry] [--no-clean] [--report-only]
 */

import './net-proxy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { QUESTIONS, PERSONAS, DECK_ID_QA } from './qa-deck-questions.mjs';

const PAT = process.env.SUPABASE_PAT || readPat();
const REF = 'ifiqhyzcklwueqsijtnq';
const OWNER_EMAIL = 'wukun2005@gmail.com';
const FN = `https://${REF}.supabase.co/functions/v1/answer-comment`;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaXFoeXpja2x3dWVxc2lqdG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjUzNTIsImV4cCI6MjEwNzAxMzUyfQ.bScn3NqBHTIPG3JFEtFAoG1EPEf4hkqavpVAysTa2FM';

const DRY = process.argv.includes('--dry');
const NO_CLEAN = process.argv.includes('--no-clean');
const REPORT_ONLY = process.argv.includes('--report-only');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  if (r.status !== 200 && r.status !== 201) throw new Error(`SQL ${r.status}: ${JSON.stringify(b).slice(0, 400)}`);
  return b;
}
const q1 = (s) => s.replace(/'/g, "''");

/* ── 0. the question bank has to be right before anything is written ───── */
function auditBank() {
  const problems = [];
  const byPage = {};
  for (const it of QUESTIONS) {
    (byPage[it.page] ||= []).push(it);
    if (!PERSONAS[it.p]) problems.push(`unknown persona ${it.p} on page ${it.page}`);
  }
  const pages = Object.keys(byPage).map(Number).sort((a, b) => a - b);
  for (const p of pages) {
    const set = byPage[p];
    if (set.length !== 4) problems.push(`page ${p} has ${set.length} questions, want 4`);
    const roles = new Set(set.map((x) => x.p));
    if (roles.size !== set.length) problems.push(`page ${p} repeats a role: ${[...roles].join(',')}`);
  }
  for (let p = 2; p <= 14; p++) if (!byPage[p]) problems.push(`page ${p} missing`);
  const tally = {};
  for (const it of QUESTIONS) tally[it.p] = (tally[it.p] || 0) + 1;
  return { problems, pages, tally };
}

const bank = auditBank();
console.log(`question bank: ${QUESTIONS.length} questions over pages ${bank.pages[0]}–${bank.pages[bank.pages.length - 1]}`);
console.log('roles used:', Object.entries(bank.tally).map(([k, v]) => `${k}×${v}`).join(' · '));
if (bank.problems.length) {
  console.error('\nBANK PROBLEMS:\n  ' + bank.problems.join('\n  '));
  process.exit(1);
}
console.log('bank OK — 4 questions per page, 4 distinct roles each\n');
if (DRY) {
  for (const it of QUESTIONS) console.log(`p${String(it.page).padStart(2)} ${it.p.padEnd(4)} ${it.q}`);
  process.exit(0);
}

/* ── 1. ask ────────────────────────────────────────────────────────────── */
let asked = [];
if (!REPORT_ONLY) {
  /* clear anything a previous aborted run left behind, so ids are unambiguous */
  const stale = await sql(`delete from deck_comments where deck_id='${DECK_ID_QA}' returning id`);
  if (stale.length) console.log(`cleared ${stale.length} rows from an earlier run`);

  console.log('inserting questions (batched, to keep the function concurrency sane)…');
  for (let i = 0; i < QUESTIONS.length; i += 8) {
    const batch = QUESTIONS.slice(i, i + 8);
    const values = batch.map((it) => `(
      '${DECK_ID_QA}', '${q1(it.key)}', ${it.idx}, '${q1(it.title)}',
      '${q1(PERSONAS[it.p].name)}', '${OWNER_EMAIL}', '${q1(it.q)}', 'qa-${it.p}'
    )`).join(',');
    const rows = await sql(
      `insert into deck_comments (deck_id, page_key, page_index, page_title, author, email, body, client_id)
       values ${values} returning id, body`
    );
    asked.push(...rows);
    console.log(`  ${asked.length}/${QUESTIONS.length}`);
    if (i + 8 < QUESTIONS.length) await sleep(10000);
  }

  console.log('\nwaiting for answers…');
  const t0 = Date.now();
  let last = -1;
  while (Date.now() - t0 < 9 * 60 * 1000) {
    const n = (await sql(
      `select count(*) n from deck_comments where deck_id='${DECK_ID_QA}' and client_id='deck-ai'`
    ))[0].n;
    if (n !== last) { console.log(`  ${n}/${asked.length} answered`); last = n; }
    if (n >= asked.length) break;
    await sleep(6000);
  }
} else {
  asked = await sql(
    `select id, body from deck_comments
      where deck_id='${DECK_ID_QA}' and client_id like 'qa-%' order by created_at`
  );
}

/* ── 2. collect ────────────────────────────────────────────────────────── */
const answers = await sql(
  `select c.id, c.parent_id, c.body, c.created_at
     from deck_comments c where c.deck_id='${DECK_ID_QA}' and c.client_id='deck-ai'`
);
const ledger = await sql(
  `select a.comment_id, a.status, a.model, a.chunks, a.latency_ms, a.sources, a.error
     from deck_ai_answers a
     join deck_comments c on c.id = a.comment_id
    where c.deck_id='${DECK_ID_QA}'`
);

/* chunk text per source+section, for the figure check */
const chunks = await sql(
  `select s.label, c.section, c.text from kb_chunks c join kb_sources s on s.id = c.source_id`
);
const chunkText = new Map();
for (const c of chunks) {
  const k = `${c.label}|||${c.section ?? ''}`;
  chunkText.set(k, (chunkText.get(k) || '') + '\n' + c.text);
}
const allByLabel = new Map();
for (const c of chunks) allByLabel.set(c.label, (allByLabel.get(c.label) || '') + '\n' + c.text);

/* ── 3. grade ──────────────────────────────────────────────────────────── */
const PUBLISHED = new Set(['Case Study Deck', 'PRD (English)', 'Research Report', 'Review Backlog', 'Project README']);
const CODE = 'Prototype Source';
const INTERNAL = 7; // Prototype Dev Plan — in the KB, deliberately not published
const INTERNAL_RE = /版本记录|变更记录|更新记录|changelog|change log|勘误|完整参考资料|里程碑|待办|开工纪律|风险与备选|运维与交接|Review Change Log/i;

const norm = (s) => String(s).toLowerCase().replace(/[\s,\u00a0]/g, '');
/** figures with their unit attached: $4.8M, 99.5%, 48h, 1,005.11 */
const figures = (s) => [...s.matchAll(/(?:\$|US\$)?\d[\d,]*(?:\.\d+)?\s?(?:%|bn|m|k|b)?/gi)]
  .map((m) => m[0].trim()).filter((f) => /\d/.test(f) && f.replace(/\D/g, '').length >= 1);

const DECLINE_RE = /could not find|couldn't find|do(?:es)? not cover|doesn't cover|not in the deck'?s sources|no matching material|not specified|isn'?t specified|the deck doesn'?t|not covered|unable to find|no information/i;

const askIdx = new Map();
QUESTIONS.forEach((it, n) => askIdx.set(n, it));
const byId = new Map();
asked.forEach((r, n) => byId.set(r.id, n));

const results = QUESTIONS.map((it, n) => {
  const row = asked[n];
  const id = row?.id;
  const ans = answers.find((a) => a.parent_id === id);
  const led = ledger.find((l) => l.comment_id === id);
  const body = ans?.body ?? '';
  const prose = body.split('\n\nSources: ')[0];

  const links = [...body.matchAll(/\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g)].map((m) => ({ text: m[1], url: m[2] }));
  const bare = [...prose.matchAll(/\[(\d{1,2})\](?!\()/g)].map((m) => m[1]);

  /* provenance */
  const used = String(led?.sources ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
  const labels = used.map((u) => u.split(' / ')[0].trim());
  const internalUsed = used.filter((u) => INTERNAL_RE.test(u.split(' / ').slice(1).join(' / ')));

  /* figures, against the material that was actually retrieved */
  const hay = norm([
    it.q,
    ...used.map((u) => {
      const [lab, ...rest] = u.split(' / ');
      const sec = rest.join(' / ');
      return chunkText.get(`${lab}|||${sec}`) || allByLabel.get(lab) || '';
    }),
  ].join('\n'));
  const warned = figures(prose.replace(/\]\([^)]*\)/g, ']')).filter((f) => !hay.includes(norm(f)));

  return {
    n, page: it.page, idx: it.idx, key: it.key, persona: it.p,
    role: PERSONAS[it.p].role, who: PERSONAS[it.p].name, question: it.q,
    commentId: id, answerId: ans?.id ?? null,
    answered: !!ans, status: led?.status ?? null, model: led?.model ?? null,
    ms: led?.latency_ms ?? null, chunks: led?.chunks ?? null, error: led?.error ?? null,
    sources: used, labels, links: links.length, legend: body.includes('\n\nSources: '),
    bare, internalUsed, unmatched: warned,
    declined: DECLINE_RE.test(prose),
    cjk: /[\u4e00-\u9fff]/.test(prose),
    body,
  };
});

/* ── 4. summary ────────────────────────────────────────────────────────── */
const answered = results.filter((r) => r.answered);
const withLinks = answered.filter((r) => r.links > 0);
const withLegend = answered.filter((r) => r.legend);
const cleanMarkers = answered.filter((r) => r.bare.length === 0);
const grounded = answered.filter((r) => r.unmatched.length === 0);
const onlyPublished = answered.filter((r) => r.labels.every((l) => PUBLISHED.has(l)));
const usedCode = answered.filter((r) => r.labels.includes(CODE));
const usedInternal = answered.filter((r) => r.labels.includes('Prototype Dev Plan'));
const declined = answered.filter((r) => r.declined);

const labelTally = {};
for (const r of answered) for (const l of new Set(r.labels)) labelTally[l] = (labelTally[l] || 0) + 1;

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a');
console.log(`\n${'═'.repeat(72)}\nRESULTS  ·  ${answered.length}/${results.length} answered\n${'═'.repeat(72)}`);
console.log(`  citations present      ${withLinks.length}/${answered.length}  (${pct(withLinks.length, answered.length)})`);
console.log(`  Sources legend present ${withLegend.length}/${answered.length}  (${pct(withLegend.length, answered.length)})`);
console.log(`  no bare [n] left       ${cleanMarkers.length}/${answered.length}  (${pct(cleanMarkers.length, answered.length)})`);
console.log(`  every figure grounded  ${grounded.length}/${answered.length}  (${pct(grounded.length, answered.length)})`);
console.log(`  sources ⊆ 5 documents  ${onlyPublished.length}/${answered.length}  (${pct(onlyPublished.length, answered.length)})`);
console.log(`  answered from the code ${usedCode.length}`);
console.log(`  answered from dev plan ${usedInternal.length}`);
console.log(`  answered "not covered" ${declined.length}`);
console.log('\n  source usage:', Object.entries(labelTally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));

const problems = results.filter((r) => !r.answered || r.links === 0 || !r.legend || r.bare.length);
if (problems.length) {
  console.log('\n  NEEDS A LOOK');
  for (const r of problems) {
    console.log(`   p${r.page} ${r.persona} ${r.answered ? '' : 'NOT ANSWERED '}${r.links === 0 ? 'no links ' : ''}${r.bare.length ? 'bare[' + r.bare + '] ' : ''}${r.legend ? '' : 'no legend'} — ${r.question.slice(0, 70)}`);
  }
}
const ungrounded = answered.filter((r) => r.unmatched.length);
if (ungrounded.length) {
  console.log('\n  FIGURES NOT FOUND IN THE RETRIEVED MATERIAL');
  for (const r of ungrounded) console.log(`   p${r.page} ${r.persona}: ${r.unmatched.join(', ')}`);
}

const perPage = {};
for (const r of results) {
  const p = (perPage[r.page] ||= { page: r.page, n: 0, answered: 0, links: 0, grounded: 0, published: 0, declined: 0 });
  p.n++; if (r.answered) p.answered++;
  if (r.links > 0) p.links++;
  if (r.answered && !r.unmatched.length) p.grounded++;
  if (r.answered && r.labels.every((l) => PUBLISHED.has(l))) p.published++;
  if (r.answered && r.declined) p.declined++;
}
console.log('\n  per page (answered / cited / grounded / published-only)');
for (const p of Object.values(perPage)) console.log(`   p${String(p.page).padStart(2)}  ${p.answered}/${p.n}  ${p.links}  ${p.grounded}  ${p.published}`);

writeFileSync('/tmp/qa-answer-results.json', JSON.stringify({
  ranAt: new Date().toISOString(),
  totals: { asked: results.length, answered: answered.length, withLinks: withLinks.length, withLegend: withLegend.length, grounded: grounded.length, publishedOnly: onlyPublished.length, usedCode: usedCode.length, usedInternal: usedInternal.length, declined: declined.length },
  labelTally, perPage, results: results.map(({ body, ...r }) => ({ ...r, bodyLen: body.length })),
}, null, 1));
console.log('\nwrote /tmp/qa-answer-results.json');

/* ── 5. clean up ───────────────────────────────────────────────────────── */
if (!NO_CLEAN) {
  console.log('\ncleaning up the QA deck…');
  const cleared = await sql(`delete from deck_comments where deck_id='${DECK_ID_QA}' returning id`);
  console.log(`  removed ${cleared.length} rows (questions + answers cascade)`);
  const left = await sql(`select count(*) n from deck_comments where deck_id='${DECK_ID_QA}'`);
  const led = await sql(
    `select count(*) n from deck_ai_answers a
      where not exists (select 1 from deck_comments c where c.id = a.comment_id)`
  );
  const live = await sql(`select count(*) filter (where deleted=false) n, count(*) t from deck_comments where deck_id='mail-autopilot-fs'`);
  console.log(`  rows left in the QA deck: ${left[0].n} (want 0)`);
  console.log(`  orphan ledger rows:       ${led[0].n} (want 0)`);
  console.log(`  live deck untouched:      ${live[0].n} visible / ${live[0].t} total`);
}
