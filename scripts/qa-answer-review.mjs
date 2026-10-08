#!/usr/bin/env node
/**
 * Second pass over the QA run that scripts/qa-answer-comments.mjs left in the
 * database. The first pass graded from the summary; this one goes back to the
 * rows themselves and is deliberately harsher about two things.
 *
 * 1. Figures. The first pass fell back to the whole document when a chunk key
 *    did not line up, which makes the check nearly unfalsifiable — a 262
 *    anywhere in the PRD would "ground" a 262 in an answer about the deck. Here
 *    a figure has to appear in one of the chunks that was actually retrieved
 *    for that question, or it is reported as unverifiable.
 *
 * 2. Links. Every distinct citation target is fetched. A citation that 404s is
 *    worse than no citation, so the answer to "did we fix citations" has to
 *    include "and do the targets exist".
 *
 * Reads deck_id = mail-autopilot-fs-qa. Deletes nothing.
 *
 * Usage:  node scripts/qa-answer-review.mjs [--links]   (--links for the HTTP check)
 */

import './net-proxy.mjs';
import { readFileSync } from 'node:fs';
import { QUESTIONS, PERSONAS, DECK_ID_QA } from './qa-deck-questions.mjs';

const PAT = process.env.SUPABASE_PAT || readPat();
const REF = 'ifiqhyzcklwueqsijtnq';
const CHECK_LINKS = process.argv.includes('--links');

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

/* Ask rows carry the question text verbatim, so map by text — created_at ties
   inside a batch and any ordering by it silently mislabels every page. */
const asked = await sql(
  `select id, body, page_index, author from deck_comments
    where deck_id='${DECK_ID_QA}' and client_id like 'qa-%'`
);
const qMeta = new Map(QUESTIONS.map((it) => [it.q, it]));
const unmapped = asked.filter((r) => !qMeta.has(r.body));
if (unmapped.length) {
  console.error(`!! ${unmapped.length} ask rows do not match any known question:`);
  for (const u of unmapped.slice(0, 5)) console.error('   ' + String(u.body).slice(0, 90));
  process.exit(1);
}
if (asked.length !== QUESTIONS.length) {
  console.error(`!! expected ${QUESTIONS.length} ask rows, found ${asked.length}`);
  process.exit(1);
}
const answers = await sql(
  `select c.id, c.parent_id, c.body, c.created_at from deck_comments c
    where c.deck_id='${DECK_ID_QA}' and c.client_id='deck-ai'`
);
const ledger = await sql(
  `select a.comment_id, a.status, a.chunks, a.latency_ms, a.sources
     from deck_ai_answers a join deck_comments c on c.id=a.comment_id
    where c.deck_id='${DECK_ID_QA}'`
);

/* per-chunk text, keyed exactly the way the ledger writes a source */
const chunks = await sql(
  `select s.label, c.section, c.text, c.page_key from kb_chunks c join kb_sources s on s.id=c.source_id`
);
const byKey = new Map();
for (const c of chunks) {
  const k = `${c.label}|||${c.section ?? ''}`;
  byKey.set(k, (byKey.get(k) || '') + '\n' + c.text);
}
/* fallback keyed label|||'' — some sources have a null section */
const byLabel = new Map();
for (const c of chunks) byLabel.set(c.label, (byLabel.get(c.label) || '') + '\n' + c.text);

const norm = (s) => String(s).toLowerCase().replace(/[\s,\u00a0]/g, '');
const figures = (s) => [...s.matchAll(/(?:\$|US\$)?\d[\d,]*(?:\.\d+)?\s?(?:%|bn|m|k|b)?/gi)]
  .map((m) => m[0].trim()).filter((f) => /\d/.test(f));

const byParent = new Map();
for (const a of answers) byParent.set(a.parent_id, a);
const ledByParent = new Map();
for (const l of ledger) ledByParent.set(l.comment_id, l);

const rows = asked.map((q) => {
  const meta = qMeta.get(q.body);
  const ans = byParent.get(q.id);
  const led = ledByParent.get(q.id);
  const body = ans?.body ?? '';
  const prose = body.split('\n\nSources: ')[0];

  /* strict: a figure has to be in the retrieved chunk, not in the document */
  const used = String(led?.sources ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
  const chunkBlob = used.map((u) => {
    const [lab, ...rest] = u.split(' / ');
    const sec = rest.join(' / ');
    const exact = byKey.get(`${lab}|||${sec}`);
    if (exact) return { lab, sec, text: exact, exact: true };
    /* a section that has no chunk of its own: fall back, but say so */
    const loose = byLabel.get(lab) ?? '';
    return { lab, sec, text: loose, exact: false };
  });
  const strictHay = norm([meta.q || '', ...chunkBlob.filter((c) => c.exact).map((c) => c.text)].join('\n'));
  const looseHay = norm([meta.q || '', ...chunkBlob.map((c) => c.text)].join('\n'));
  const figs = figures(prose.replace(/\]\([^)]*\)/g, ']'));
  return {
    page: meta.page, persona: meta.p, role: PERSONAS?.[meta.p]?.role,
    question: meta.q, body, prose,
    chunks: led?.chunks ?? null, ms: led?.latency_ms ?? null,
    sources: used,
    unmatchedStrict: figs.filter((f) => !strictHay.includes(norm(f))),
    unmatchedLoose: figs.filter((f) => !looseHay.includes(norm(f))),
    inexactSections: chunkBlob.filter((c) => !c.exact).map((c) => `${c.lab} / ${c.sec}`),
    links: [...body.matchAll(/\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g)].map((m) => ({ t: m[1], u: m[2] })),
  };
});

console.log(`rows: ${rows.length} questions, ${rows.filter((r) => r.body).length} with an answer`);

console.log('\n── strict figure check (must be in the retrieved chunks) ──');
const badStrict = rows.filter((r) => r.body && r.unmatchedStrict.length);
const badLoose = rows.filter((r) => r.body && r.unmatchedLoose.length);
console.log(`  answers with an unverifiable figure, strict: ${badStrict.length}`);
console.log(`  answers with an unverifiable figure, loose : ${badLoose.length}`);
for (const r of badStrict) {
  console.log(`   p${r.page} ${r.persona}: ${r.unmatchedStrict.join(', ')}`);
}
if (badLoose.length && !badStrict.length) {
  console.log('  (loose-only, i.e. the figure is in the document but not in the retrieved chunk)');
  for (const r of badLoose) console.log(`   p${r.page} ${r.persona}: ${r.unmatchedLoose.join(', ')}`);
}
const inexact = rows.filter((r) => r.body && r.inexactSections.length);
console.log(`  answers whose source sections had no exact chunk: ${inexact.length}`);
for (const r of inexact.slice(0, 12)) console.log(`   p${r.page} ${r.persona}: ${[...new Set(r.inexactSections)].join(' | ')}`);

const DECLINE_RE = /could not find|couldn't find|do(?:es)? not cover|doesn't cover|not in the deck'?s sources|no matching material|not specified|isn'?t specified|the deck doesn'?t|not covered|unable to find|no information|is not (?:stated|described|defined)/i;
const declined = rows.filter((r) => r.body && DECLINE_RE.test(r.prose));
console.log(`\n── the ${declined.length} answers that declined ──`);
for (const r of declined) {
  console.log(`\n  p${r.page} · ${r.persona} (${r.role}) · ${r.chunks} chunks · ${r.ms}ms`);
  console.log(`  Q: ${r.question}`);
  console.log(`  A: ${r.prose.replace(/\s+/g, ' ').slice(0, 560)}`);
  console.log(`  sources: ${r.sources.join(' ; ') || '(none)'}`);
}

const cjk = rows.filter((r) => r.body && /[\u4e00-\u9fff]/.test(r.prose));
console.log(`\n── the ${cjk.length} answers carrying Chinese ──`);
for (const r of cjk) {
  console.log(`\n  p${r.page} · ${r.persona} · ${r.chunks} chunks`);
  console.log(`  Q: ${r.question}`);
  console.log(`  A: ${r.prose.replace(/\s+/g, ' ').slice(0, 420)}`);
}

/* link health: fetch each distinct target once */
const everyLink = rows.flatMap((r) => r.links.map((l) => l.u));
const all = [...new Set(everyLink)];
console.log(`\n── citation targets ──\n  link instances: ${everyLink.length} · distinct URLs: ${all.length}`);
const byPath = {};
for (const u of everyLink) {
  const p = u.replace('https://github.com/wukun2005-gif/mailAutopilotForFS/blob/main/', '');
  byPath[p] = (byPath[p] || 0) + 1;
}
for (const [p, n] of Object.entries(byPath).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}×  ${p}`);
const fam = {};
for (const u of everyLink) {
  const host = new URL(u).host;
  fam[host] = (fam[host] || 0) + 1;
}
console.log('  by host:', Object.entries(fam).map(([h, n]) => `${h} ${n}`).join(' · '));

if (CHECK_LINKS) {
  console.log('\n  fetching…');
  let ok = 0, bad = [];
  for (const u of all) {
    try {
      const r = await fetch(u, { method: 'GET', redirect: 'follow' });
      if (r.status === 200) ok++; else bad.push(`${r.status} ${u}`);
    } catch (e) { bad.push(`ERR ${u} ${e.message}`); }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`  ${ok}/${all.length} returned 200`);
  for (const b of bad) console.log('   ' + b);
}
