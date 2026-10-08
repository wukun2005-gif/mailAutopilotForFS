#!/usr/bin/env node
/**
 * Verify KB retrieval for a reader question — mirrors what the deployed
 * answer-comment Edge Function actually does:
 *   embed (SiliconFlow bge-m3) → bigramQuery → kb_search (RRF k=60)
 *   → remote cross-encoder rerank (SiliconFlow bge-reranker-v2-m3)
 * but runs kb_search through the Management API (owner role, bypasses RLS).
 *
 * The providers are the ones patentExaminator is configured with, so a score
 * here means the same thing it means there.
 *
 * Usage:
 *   SUPABASE_PAT=... SILICONFLOW_API_KEY=... node scripts/kb-verify.mjs "your question"
 */

import './net-proxy.mjs';

const PAT = process.env.SUPABASE_PAT || '';
const REF = 'ifiqhyzcklwueqsijtnq';
const q = process.argv[2] || 'how does the autonomy matrix / runtime work in the prototype?';
const SF_BASE = (process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
const SF_KEY = process.env.SILICONFLOW_API_KEY || '';
const EMBED_MODEL = 'BAAI/bge-m3';
const RERANK_MODEL = 'BAAI/bge-reranker-v2-m3';

const STOP = new Set(['the','and','for','with','that','this','from','are','was','were','has','have','not','but','its','into','any','all','can','will','our','their','they','when','what','which','who','how','why','you','your','one','two','may','also','than','then','them','these','those','been','more','most','such','only','other','over','under','after','before','between','each','same','some','very','does','did','about','would','could','should']);

function bigramQuery(text) {
  const out = new Set();
  for (const run of text.match(/[一-鿿]+/g) ?? []) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2));
  }
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) if (!STOP.has(w)) out.add(w);
  return [...out].join(' | ');
}

async function embed(texts) {
  const r = await fetch(`${SF_BASE}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SF_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!r.ok) throw new Error(`embed ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d.data.sort((a, b) => a.index - b.index).map((x) => x.embedding);
}

/** Same call the Edge Function makes: zero base score, cross-encoder decides. */
async function rerank(query, rows) {
  const r = await fetch(`${SF_BASE}/rerank`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SF_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: RERANK_MODEL, query, documents: rows.map((x) => x.body), top_n: rows.length }),
  });
  if (!r.ok) throw new Error(`rerank ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return (d.results ?? [])
    .filter((x) => x.index >= 0 && x.index < rows.length)
    .map((x) => ({ ...rows[x.index], rerank: x.relevance_score }))
    .sort((a, b) => b.rerank - a.rerank);
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

const bq = bigramQuery(q);
console.log('query  : ' + q);
console.log('tsquery: ' + bq + '\n');

const [vec] = await embed([q]);
const rows = await sql(
  `select chunk_id, source, section, body, round(score::numeric,4) as score, round(vec_score::numeric,4) as vec, round(kw_score::numeric,4) as kw
   from public.kb_search('[${vec.join(',')}]'::vector(1024), '${bq.replace(/'/g, "''")}', null, 15)`
);
console.log(`-- 融合检索 (RRF k=60) ${rows.length} 条 --`);
for (const r of rows.slice(0, 6)) {
  console.log(`  [${r.source}] rrf=${r.score} vec=${r.vec} kw=${r.kw}`);
  console.log(`      ${String(r.section ?? '').slice(0, 70)}`);
}

const ranked = await rerank(q, rows);
console.log('\n-- 远程 cross-encoder 重排后 (bge-reranker-v2-m3) --');
for (const r of ranked.slice(0, 6)) {
  console.log(`  [${r.source}] ${r.rerank.toFixed(4)}  ${String(r.section ?? '').slice(0, 60)}`);
}

const bySource = {};
for (const r of ranked.slice(0, 5)) bySource[r.source] = (bySource[r.source] || 0) + 1;
console.log('\ntop-5 来源分布: ' + JSON.stringify(bySource));

const wanted = ['prototype', 'dev_plan'];
const found = wanted.filter((s) => bySource[s]);
console.log(`demo-app 来源检查: ${found.length ? 'OK -> ' + found.join(', ') : 'NONE of ' + wanted.join('/') + ' in top-5'}`);
