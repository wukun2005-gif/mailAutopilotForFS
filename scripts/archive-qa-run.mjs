#!/usr/bin/env node
/**
 * Snapshots whatever is sitting in deck_id='mail-autopilot-fs-qa' to a JSON file
 * on disk. The QA run leaves its rows in the database; this is how they survive
 * the cleanup, so a later run can be diffed against this one.
 *
 * Usage: SUPABASE_PAT=... node scripts/archive-qa-run.mjs <out.json>
 */

import './net-proxy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { DECK_ID_QA } from './qa-deck-questions.mjs';

const PAT = process.env.SUPABASE_PAT || readPat();
const REF = 'ifiqhyzcklwueqsijtnq';
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node scripts/archive-qa-run.mjs <out.json>'); process.exit(2); }

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

const rows = await sql(
  `select p.page_index page, p.page_title title, p.author who, p.body question,
          a.body answer, l.chunks, l.latency_ms ms, l.sources
     from deck_comments a
     join deck_comments p on p.id = a.parent_id
     left join deck_ai_answers l on l.comment_id = p.id
    where a.deck_id='${DECK_ID_QA}' and a.client_id='deck-ai'
    order by p.page_index, p.created_at`);

/* record which deployed build produced these answers — a QA archive without the
   function version cannot be compared against anything later */
const fnRes = await fetch(`https://api.supabase.com/v1/projects/${REF}/functions/answer-comment`, {
  headers: { Authorization: `Bearer ${PAT}` },
});
const fnInfo = fnRes.ok ? await fnRes.json() : {};
writeFileSync(OUT, JSON.stringify({
  ranAt: new Date().toISOString(),
  fn: 'answer-comment',
  version: fnInfo.version ?? null,
  deployedAt: fnInfo.updated_at ?? null,
  n: rows.length,
  rows,
}, null, 1));
console.log(`archived ${rows.length} rows → ${OUT}`);
console.log(`  produced by answer-comment v${fnInfo.version ?? '?'} (${fnInfo.updated_at ?? '?'})`);
