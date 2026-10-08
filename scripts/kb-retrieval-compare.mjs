#!/usr/bin/env node
/**
 * Three-group retrieval comparison for the deck KB.
 *
 * The point is to answer three separate questions with one run:
 *   A 中文题   — the deck is written in English but the audience comments in
 *                Chinese, so the vector half has to cross languages.
 *   B demo 题  — the questions the prototype source (src/runtime, src/mocks,
 *                dev_plan) was added to answer. If these do not come back from
 *                the code/dev-plan sources, that source was added for nothing.
 *   C 英文基线 — the same intent asked in the deck's own language. This is the
 *                ceiling: if English is not clean, nothing else can be.
 *
 * Two numbers per question:
 *   hit@3      — is an expected source in the top 3? (the retrieval that ships)
 *   non-reg    — does the fusion top-1 survive into the rerank top-3? A "no"
 *                means turning the remote reranker on would cost a correct
 *                answer, which is exactly why it is off by default.
 *
 * Usage:
 *   SUPABASE_PAT=... SILICONFLOW_API_KEY=... node scripts/kb-retrieval-compare.mjs
 *   ... node scripts/kb-retrieval-compare.mjs --only B
 */

import './net-proxy.mjs';

const PAT = process.env.SUPABASE_PAT || '';
const REF = 'ifiqhyzcklwueqsijtnq';
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i > -1 ? process.argv[i + 1] : null;
})();

const SF_BASE = (process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
const SF_KEY = process.env.SILICONFLOW_API_KEY || '';
const EMBED_MODEL = 'BAAI/bge-m3';
const RERANK_MODEL = 'BAAI/bge-reranker-v2-m3';
const TOP_K = 15;
const DOC_MAX = 1500;   // the Edge Function truncates documents to this before rerank

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

async function rerank(query, rows) {
  const r = await fetch(`${SF_BASE}/rerank`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SF_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: RERANK_MODEL, query, top_n: rows.length,
      documents: rows.map((x) => String(x.body).slice(0, DOC_MAX)),
    }),
  });
  if (!r.ok) throw new Error(`rerank ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const raw = (d.results ?? [])
    .filter((x) => x.index >= 0 && x.index < rows.length)
    .map((x) => ({ ...rows[x.index], rerank: x.relevance_score }));

  const maxRr = Math.max(...raw.map((x) => x.rerank), 1e-9);
  const maxFusion = Math.max(...rows.map((x) => x.score), 1e-9);
  /* Two ways to use the cross-encoder, because the difference decides whether
     the flag can be turned on:
       alone   — the ported behaviour (patentExaminator's `score: 0`): the
                 relevance score replaces the ranking value wholesale.
       blended — the cross-encoder orders, the hybrid retriever still gets a
                 vote (0.6/0.4, the same split the heuristic tier uses). */
  const alone = [...raw].sort((a, b) => b.rerank - a.rerank);
  const blended = raw
    .map((x) => ({ ...x, blend: 0.6 * (x.rerank / maxRr) + 0.4 * (x.score / maxFusion) }))
    .sort((a, b) => b.blend - a.blend);
  return { alone, blended };
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

/* ── the question set ──────────────────────────────────────────────────────
   `want` is the source the answer should be grounded in. It is a source list,
   not a chunk id: more than one document legitimately covers some topics
   (the PRD and the report both describe the runtime), and pinning a chunk
   would make the test fail on a harmless tie. */
const GROUPS = {
  A: {
    label: 'A 中文题（英文语料，跨语言向量）',
    items: [
      { q: '三维放权矩阵里的 L1、L2、L3 分别是怎么定义的？', want: ['prd_en', 'report'] },
      { q: '持久化运行时是怎么保证长案子不丢的？',             want: ['prd_en', 'report', 'prototype'] },
      { q: '有哪些动作是明确写在"永不开放"清单里的？',        want: ['prd_en', 'report'] },
      { q: '三个 headline 成功指标分别是什么？',              want: ['prd_en', 'report'] },
    ],
  },
  B: {
    label: 'B demo app 题（原型代码 / 开发文档）',
    items: [
      { q: '原型里的时钟是怎么走的？',                        want: ['prototype', 'dev_plan'] },
      { q: '演示用的假数据是从哪里来的？',                    want: ['prototype', 'dev_plan'] },
      { q: '原型的四个核心屏幕分别是什么？',                  want: ['dev_plan', 'prototype', 'prd_en'] },
      { q: 'src/runtime 里信件线程模型是怎么实现的？',        want: ['prototype', 'dev_plan'] },
    ],
  },
  C: {
    label: 'C 英文基线（deck 母语）',
    items: [
      { q: 'What is the three-dimensional delegation matrix, and what are L1, L2 and L3?', want: ['prd_en', 'report'] },
      { q: 'How does the durable case runtime keep a multi-day case alive?',                want: ['prd_en', 'report', 'prototype'] },
      { q: 'What actions are on the hard "never" list?',                                    want: ['prd_en', 'report'] },
      { q: 'What are the three headline success metrics?',                                  want: ['prd_en', 'report'] },
    ],
  },
};

if (!SF_KEY) { console.error('缺少 SILICONFLOW_API_KEY\n'); process.exit(1); }
if (!PAT) { console.error('缺少 SUPABASE_PAT\n'); process.exit(1); }

const rowsOut = [];
console.log(`\n=== 三组检索对照（kb_chunks 现库）===\n`);

for (const [key, g] of Object.entries(GROUPS)) {
  if (ONLY && ONLY !== key) continue;
  console.log(`\n━━ ${g.label} ━━`);
  for (const item of g.items) {
    const [vec] = await embed([item.q]);
    const rows = await sql(
      `select chunk_id, source, section, body,
              round(score::numeric,4) as score, round(vec_score::numeric,4) as vec, round(kw_score::numeric,4) as kw
       from public.kb_search('[${vec.join(',')}]'::vector(1024), '${bigramQuery(item.q).replace(/'/g, "''")}', null, ${TOP_K})`
    );
    const { alone, blended } = await rerank(item.q, rows);

    const hitFusion = rows.slice(0, 3).some((r) => item.want.includes(r.source));
    const hitAlone = alone.slice(0, 3).some((r) => item.want.includes(r.source));
    const hitBlend = blended.slice(0, 3).some((r) => item.want.includes(r.source));
    // non-regression: fusion top-1 must still be in the reranked top-3
    const top1 = rows[0];
    const keptAlone = alone.slice(0, 3).some((r) => r.chunk_id === top1?.chunk_id);
    const keptBlend = blended.slice(0, 3).some((r) => r.chunk_id === top1?.chunk_id);

    rowsOut.push({ group: key, q: item.q, want: item.want.join('/'), hitFusion, hitAlone, hitBlend, keptAlone, keptBlend });

    console.log(`\n  ▸ ${item.q}`);
    console.log(`    期望来源: ${item.want.join(' | ')}`);
    console.log(`    融合 top-3 (RRF k=60):`);
    for (const r of rows.slice(0, 3)) {
      console.log(`      [${r.source}] rrf=${r.score} vec=${r.vec} kw=${r.kw}  ${String(r.section ?? '').slice(0, 56)}`);
    }
    console.log(`    cross-encoder 单独排序 top-3 (照搬行为):`);
    for (const r of alone.slice(0, 3)) {
      console.log(`      [${r.source}] ${r.rerank.toFixed(4)}  ${String(r.section ?? '').slice(0, 56)}`);
    }
    console.log(`    cross-encoder 与 RRF 混合 top-3 (0.6/0.4):`);
    for (const r of blended.slice(0, 3)) {
      console.log(`      [${r.source}] ${r.blend.toFixed(4)}  ${String(r.section ?? '').slice(0, 56)}`);
    }
    console.log(`    hit@3 融合 ${hitFusion ? '✓' : '✗'} | 单独重排 ${hitAlone ? '✓' : '✗'} | 混合重排 ${hitBlend ? '✓' : '✗'}` +
                `    融合top-1保住: 单独 ${keptAlone ? '✓' : '✗'} | 混合 ${keptBlend ? '✓' : '✗'}`);
  }
}

console.log(`\n\n═══ 汇总 ═══\n`);
console.log('组 | 题 | 期望来源 | hit@3融合 | hit@3单独重排 | hit@3混合 | top-1保住(单独/混合)');
for (const r of rowsOut) {
  console.log(`${r.group} | ${r.q.slice(0, 32).padEnd(32)} | ${r.want.slice(0, 20).padEnd(20)} | ${r.hitFusion ? ' ✓ ' : ' ✗ '} | ${r.hitAlone ? ' ✓ ' : ' ✗ '} | ${r.hitBlend ? ' ✓ ' : ' ✗ '} | ${r.keptAlone ? '✓' : '✗'}/${r.keptBlend ? '✓' : '✗'}`);
}

for (const key of Object.keys(GROUPS)) {
  const set = rowsOut.filter((r) => r.group === key);
  if (!set.length) continue;
  console.log(`\n${key}: hit@3 融合 ${set.filter((r) => r.hitFusion).length}/${set.length}   `
    + `单独重排 ${set.filter((r) => r.hitAlone).length}/${set.length}   `
    + `混合重排 ${set.filter((r) => r.hitBlend).length}/${set.length}   `
    + `非回归 ${set.filter((r) => r.keptBlend).length}/${set.length}(混合)`);
}
const all = rowsOut;
console.log(`\n合计: hit@3 融合 ${all.filter((r) => r.hitFusion).length}/${all.length}   `
  + `单独重排 ${all.filter((r) => r.hitAlone).length}/${all.length}   `
  + `混合重排 ${all.filter((r) => r.hitBlend).length}/${all.length}   `
  + `非回归 单独 ${all.filter((r) => r.keptAlone).length}/${all.length} / 混合 ${all.filter((r) => r.keptBlend).length}/${all.length}\n`);
