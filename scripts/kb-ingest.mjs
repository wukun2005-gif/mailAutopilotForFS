#!/usr/bin/env node
/**
 * Knowledge-base ingestion for the deck's AI comment answering.
 *
 * Reads the four source documents, splits them into chunks, embeds each chunk
 * through Bailian and writes everything into Supabase (kb_sources / kb_chunks).
 *
 * Chunking follows patentExaminator's legalChunker.ts: split on document
 * structure, then pack paragraphs up to a ceiling — MIN 100 / MAX 1500 chars.
 * Keyword search needs no dictionary: every chunk stores space-separated
 * bigrams (CJK) plus lowercased words (latin), which Postgres full-text can
 * match without a Chinese parser.
 *
 * Usage:
 *   node scripts/kb-ingest.mjs            # ingest everything
 *   node scripts/kb-ingest.mjs --dry      # chunk + report only, no API, no writes
 *   node scripts/kb-ingest.mjs --only deck
 *
 * Embedding provider is SiliconFlow (BAAI/bge-m3) — the same account and the
 * same config patentExaminator uses (its settings DB: providerId=siliconflow,
 * baseUrl=https://api.siliconflow.cn/v1). bge-m3 is also 1024-dim, so the
 * pgvector column and kb_search need no change.
 *
 * Requires: SUPABASE_PAT (Management API) and SILICONFLOW_API_KEY (env, so the
 * key never lands in a tracked file).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import './net-proxy.mjs';

const PAT = process.env.SUPABASE_PAT || '';
const REF = 'ifiqhyzcklwueqsijtnq';
const DRY = process.argv.includes('--dry');
const AUDIT = process.argv.includes('--audit');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i > -1 ? process.argv[i + 1] : null;
})();

const MIN_CHUNK = 100;    // patentExaminator legalChunker.ts DEFAULT_MIN_CHUNK
const MAX_CHUNK = 1500;   // ... and DEFAULT_MAX_CHUNK
/* patentExaminator uses BATCH_SIZE = 100 against SiliconFlow; this Bailian
   gateway rejects anything above 20 ("batch size is invalid, it should not be
   larger than 20"). The batching logic is the same, only the ceiling moves. */
const EMBED_BATCH = 20;
const EMBED_MODEL = 'BAAI/bge-m3';   // SiliconFlow, 1024-dim — matches kb_chunks.embedding

const EMBED_URL = `${(process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '')}/embeddings`;
const EMBED_KEY = process.env.SILICONFLOW_API_KEY || '';

const SOURCES = [
  { key: 'deck',    label: 'Case Study Deck',      file: 'deck-html/index.html',                    kind: 'deck' },
  { key: 'prd_en',  label: 'PRD (English)',        file: 'email-autopilot-fs-prd_en.html',           kind: 'doc' },
  /* The English edition replaced the Chinese one here on 2026-10-09: the deck
     answers in the reader's language by translating what it retrieved, so the
     Chinese source was a second translation step for nothing. The Chinese
     file stays in the repo and on Pages, just not in the knowledge base. */
  { key: 'report',  label: 'Research Report',      file: 'email-autopilot-research-report-v0.2_en.html', kind: 'doc' },
  { key: 'backlog', label: 'Review Backlog',       file: 'backlog.html',                            kind: 'doc' },
  /* Readers also ask about the demo app itself ("how does that clock work?",
     "where do those numbers come from?"). Three more sources answer that: the
     prototype's design document, the project README, and the parts of the
     source that carry meaning — the case runtime, the fixtures behind the fake
     data, and the demo scripts. src/screens is deliberately left out: it is
     4,460 lines of JSX whose substance (what each screen shows and why) is
     already written out in the dev plan's screen specs. */
  { key: 'dev_plan',  label: 'Prototype Dev Plan', file: 'email-autopilot-prototype-dev-plan-v0.1.html', kind: 'devplan' },
  { key: 'readme',    label: 'Project README',     file: 'README.md',                                kind: 'md' },
  { key: 'prototype', label: 'Prototype Source',   file: '(src/runtime · src/mocks · src/demo · src/lib · shared · server)', kind: 'code' },
];

/* Source directories for the code source; tests and type-only files are noise
   here. */
const CODE_DIRS = ['src/runtime', 'src/mocks', 'src/demo', 'src/lib', 'shared', 'server'];
const CODE_SKIP = /\.(test|spec)\.tsx?$|\.d\.ts$|\.gen\.ts$/;

/* The dev plan has internal sections (schedule, risks, review discipline, and
   the ops chapter for this comment system) that a reader's question should
   never be answered from. `^16[\.\s]` catches the whole ops chapter — its
   subsections are titled things like "16.10 AI 自动回答观众评论", which the
   bare `评论系统` alternative missed, so that section used to surface as the
   top hit for unrelated questions. */
const DEVPLAN_SKIP = /里程碑|风险与备选|开工纪律|评论系统|依赖清单|术语速查|变更记录|版本记录|^16[\.\s]/;

/* Bookkeeping chapters that exist for the document's maintainers, not for a
   reader. They were answering real questions: the PRD's "Review Change Log"
   and the report's "版本记录" both came back as cited sources, and a reference
   list answers nothing. Applied to every non-code source, because the same
   chapter type recurs in more than one document. */
/* The last two alternatives are the English report's own words for 版本记录 and
   完整参考资料 — the report is ingested from its English edition now, and
   without them §17/§18 of it would answer reader questions again. */
const INTERNAL_HEADING = /版本记录|变更记录|更新记录|changelog|change log|勘误|完整参考资料|version history|full references|里程碑|待办|开工纪律|风险与备选|运维与交接/i;

/* ── text extraction ───────────────────────────────────────────────────── */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
const decode = (s) =>
  s.replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m));
/* HTML comments are stripped first: `<!-- ... -->` is not a tag, so the tag
   regex only eats `<!--` and leaves the note's text plus a dangling `-->` in
   the chunk. The deck's slides carry build notes that way, and those notes were
   polluting both the embedding and the rerank score. */
const stripTags = (s) =>
  decode(s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/** Split an HTML document into {heading, text} sections on h1/h2/h3. */
function sections(html) {
  const body = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ');
  const out = [];
  const re = /<h([123])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m, last = 0, heading = '';
  const push = (chunk) => {
    const text = stripTags(chunk);
    if (text.length >= 20) out.push({ heading, text });
  };
  while ((m = re.exec(body))) {
    push(body.slice(last, m.index));
    heading = stripTags(m[2]).slice(0, 120);
    last = re.lastIndex;
  }
  push(body.slice(last));
  return out;
}

/** Slides are their own units: a comment lands on a page, so the page is the
 *  natural retrieval unit and its slug must match the comment's page_key. */
function slideSections(html) {
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  const out = [];
  const re = /<section class="slide([^"]*)"[^>]*>([\s\S]*?)<\/section>/gi;
  let m, idx = 0;
  while ((m = re.exec(html))) {
    const inner = m[2];
    const h = /<h1[^>]*>([\s\S]*?)<\/h1>|<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(inner);
    const eb = /class="eyebrow"[^>]*>([\s\S]*?)<\/p>/i.exec(inner);
    const title = stripTags(h ? (h[1] ?? h[2]) : (eb ? eb[1].replace(/^\s*\d+\s*/, '') : `Page ${idx + 1}`));
    out.push({ heading: title, text: stripTags(inner), pageKey: slug(title) || `p${idx + 1}` });
    idx++;
  }
  return out;
}

/** Source files → one section per file (the path becomes the citation label). */
function codeSections(dirs) {
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      if (!/\.(ts|tsx|js|mjs)$/.test(e.name) || CODE_SKIP.test(e.name)) continue;
      const src = readFileSync(p, 'utf8');
      if (src.length < 200) continue;
      out.push({ heading: p, text: src });
    }
  };
  dirs.forEach(walk);
  return out;
}

/** Markdown → sections on headings, links and images flattened to text. */
function mdSections(md) {
  const out = [];
  for (const part of md.split(/\n(?=#{1,3} )/)) {
    const m = /^#{1,3} (.+)$/m.exec(part);
    const text = part
      .replace(/^#{1,3} .+$/m, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*_>#|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 20) out.push({ heading: m ? m[1].trim() : '', text });
  }
  return out;
}

/** Code chunks split on line boundaries, never mid-statement. */
function packCode(sec, meta) {
  const chunks = [];
  let buf = [];
  const flush = () => {
    const t = buf.join('\n').trim();
    if (t) chunks.push({ ...meta, section: sec.heading, text: t, pageKey: null });
    buf = [];
  };
  for (const line of sec.text.split('\n')) {
    if (buf.join('\n').length + line.length > MAX_CHUNK) flush();
    buf.push(line);
  }
  flush();
  return chunks;
}

/** Pack paragraphs into chunks bounded by MIN/MAX (legalChunker.ts behaviour). */
function packChunks(sec, meta) {
  const chunks = [];
  const paras = sec.text.split(/(?<=[。．.!?；;])\s+/).map((p) => p.trim()).filter(Boolean);
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t.length >= MIN_CHUNK) chunks.push({ ...meta, section: sec.heading, text: t, pageKey: sec.pageKey ?? null });
    else if (t) chunks.push({ ...meta, section: sec.heading, text: t, pageKey: sec.pageKey ?? null, small: true });
    buf = '';
  };
  for (const p of paras) {
    if (p.length > MAX_CHUNK) {          // a single oversized paragraph: hard-split
      flush();
      /* Even pieces, not fixed 1500-char ones. Stepping by MAX_CHUNK leaves a
         short final piece (a 3013-char paragraph ends 1500 / 1500 / 13), and a
         13-character chunk embeds to noise and reads as garbage when it wins.
         Dividing by ceil(len / MAX) keeps every piece under the ceiling and
         none of them degenerate. */
      const parts = Math.ceil(p.length / MAX_CHUNK);
      const size = Math.ceil(p.length / parts);
      for (let i = 0; i < p.length; i += size) {
        chunks.push({ ...meta, section: sec.heading, text: p.slice(i, i + size), pageKey: sec.pageKey ?? null });
      }
      continue;
    }
    if ((buf + ' ' + p).trim().length > MAX_CHUNK) flush();
    buf = (buf + ' ' + p).trim();
  }
  flush();
  // merge the tail fragment when it is too small to stand alone
  if (chunks.length > 1 && chunks[chunks.length - 1].small) {
    const tail = chunks.pop();
    chunks[chunks.length - 1].text += ' ' + tail.text;
  }
  return chunks.map(({ small, ...c }) => c);
}

/* ── keyword text: bigrams for CJK, words for latin ────────────────────── */
function bigrams(text) {
  const out = new Set();
  const cjk = text.match(/[\u4e00-\u9fff]+/g) || [];
  for (const run of cjk) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2));
  }
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || [];
  const stop = new Set(['the','and','for','with','that','this','from','are','was','were','has','have','not','but','its','into','any','all','can','will','our','their','they','when','what','which','who','how','why','you','your','one','two','may','also','than','then','them','these','those','been','more','most','such','only','other','over','under','after','before','between','each','same','some','very']);
  for (const w of words) if (!stop.has(w)) out.add(w);
  return [...out].join(' ');
}

/* ── Supabase via Management API ───────────────────────────────────────── */
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
const vecLit = (v) => `'[${v.join(',')}]'::vector`;

/* ── embedding via Bailian ─────────────────────────────────────────────── */
async function embed(texts) {
  const r = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${EMBED_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts.map((t) => (t.length > 4000 ? t.slice(0, 4000) : t)) }),
  });
  if (!r.ok) throw new Error(`embed HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return d.data.sort((a, b) => a.index - b.index).map((x) => x.embedding);
}

/* ── main ──────────────────────────────────────────────────────────────── */
console.log(`\n=== 知识库摄取 ${DRY ? '(dry run)' : ''} ===\n`);
const plan = [];

for (const src of SOURCES) {
  if (ONLY && src.key !== ONLY) continue;
  let secs;
  if (src.kind === 'code') {
    // prototype source: walk the code dirs, one section per file
    secs = codeSections(CODE_DIRS);
  } else if (src.kind === 'md') {
    secs = mdSections(readFileSync(src.file, 'utf8'));
  } else {
    const html = readFileSync(src.file, 'utf8');
    secs = src.kind === 'deck' ? slideSections(html) : sections(html);
  }
  if (src.kind !== 'code') {
    // drop bookkeeping chapters a reader should never be answered from
    secs = secs.filter((s) => !INTERNAL_HEADING.test(s.heading));
    if (src.kind === 'devplan') secs = secs.filter((s) => !DEVPLAN_SKIP.test(s.heading));
  }
  const chunks = src.kind === 'code'
    ? secs.flatMap((s) => packCode(s, { src: src.key }))
    : secs.flatMap((s) => packChunks(s, { src: src.key }));
  const chars = chunks.reduce((n, c) => n + c.text.length, 0);
  plan.push({ ...src, chunks, chars });
  console.log(`  ${src.key.padEnd(9)} ${String(chunks.length).padStart(5)} chunks  ${String(chars).padStart(9)} chars   ${src.file}`);
}
const totalChunks = plan.reduce((n, p) => n + p.chunks.length, 0);
console.log(`\n  合计 ${totalChunks} chunks\n`);

/* --headings: the unique section titles per source. Excluding a chapter is a
   judgement call, so the list has to be readable before the filter is written. */
if (process.argv.includes('--headings')) {
  for (const p of plan) {
    const seen = new Map();
    for (const c of p.chunks) {
      const h = c.section || '(no heading)';
      seen.set(h, (seen.get(h) ?? 0) + 1);
    }
    console.log(`  ── ${p.key} · ${p.chunks.length} chunks · ${seen.size} headings ──`);
    for (const [h, n] of seen) console.log(`   ${String(n).padStart(3)}×  ${h}`);
    console.log();
  }
  process.exit(0);
}

/* ── chunk hygiene audit ───────────────────────────────────────────────────
   Every class below reached the live KB at least once and had to be found by
   hand (a build note inside an HTML comment, the dev-plan ops chapter, a
   changelog chunk). Run `--audit` after touching extraction so the next one
   shows up here instead of in a bad answer. Code chunks are exempt: braces,
   `=>` and `//` are their content, not noise. */
if (AUDIT) {
  const ARTIFACTS = [
    ['html comment tail', /-->/],
    ['raw html tag', /<\/?[a-z][a-z0-9-]*[\s/>]/i],
    ['html entity', /&(?:amp|nbsp|lt|gt|quot|mdash|ndash|hellip);/],
    ['css declaration', /(?:^|[\s;{])(?:flex|grid|margin|padding|font-size|line-height|max-height|z-index)\s*:/i],
    /* Real SVG tokens only. The first version of this line listed the bare
       words `path` and `fill`, which matched the English in "graduation path"
       and "attack path" — 20 healthy deck chunks flagged as noise. A tag's
       text is already stripped, so genuine residue is an attribute, not a
       word. */
    ['inline svg residue', /<svg|<\/svg|viewBox\s*=|stroke-width\s*=|stroke-linecap\s*=|xmlns\s*=|(?:fill|stroke)\s*=\s*["']#/i],
  ];
  const INTERNAL_HEADING_RE = INTERNAL_HEADING;
  /* --show prints the offending text itself. A count tells you something is
     wrong; only the text tells you *what* is wrong, and the last two bugs were
     both found by reading a snippet rather than by reading a number. */
  const SHOW = process.argv.includes('--show');
  const preview = (s) => s.replace(/\s+/g, ' ').slice(0, 220);
  const TEXT_SOURCES = plan.filter((p) => p.kind !== 'code');
  console.log('  ── 分块卫生审计（仅非代码来源）──');
  let flagged = 0;
  for (const [label, re] of ARTIFACTS) {
    const hits = [];
    for (const p of TEXT_SOURCES) for (const c of p.chunks) {
      const m = re.exec(c.text);
      if (!m) continue;
      const at = Math.max(0, m.index - 40);
      hits.push({ where: `${p.key}/${c.section ?? '-'}`, text: c.text, at: `…${c.text.slice(at, m.index + m[0].length + 40)}…` });
    }
    flagged += hits.length;
    console.log(`  ${label.padEnd(20)} ${String(hits.length).padStart(4)}  ${hits.slice(0, 4).map((h) => h.where).join(' · ')}`);
    if (SHOW) for (const h of hits.slice(0, 3)) console.log(`      ↳ ${h.where}\n        match: ${h.at}`);
  }
  const internals = [];
  for (const p of TEXT_SOURCES) for (const c of p.chunks) if (INTERNAL_HEADING_RE.test(c.section ?? '')) internals.push({ where: `${p.key}/${c.section}`, text: c.text });
  console.log(`  ${'internal-only 章节'.padEnd(18)} ${String(internals.length).padStart(4)}  ${internals.slice(0, 6).map((h) => h.where).join(' · ')}`);
  if (SHOW) for (const h of internals.slice(0, 3)) console.log(`      ↳ ${h.where}\n        ${preview(h.text)}`);
  const tiny = [];
  for (const p of TEXT_SOURCES) for (const c of p.chunks) if (c.text.length < 120) tiny.push({ where: `${p.key}/${c.section ?? '-'}(${c.text.length})`, text: c.text });
  console.log(`  ${'过短 chunk (<120字)'.padEnd(16)} ${String(tiny.length).padStart(4)}  ${tiny.slice(0, 4).map((h) => h.where).join(' · ')}`);
  if (SHOW) for (const h of tiny.slice(0, 4)) console.log(`      ↳ ${h.where}\n        ${preview(h.text)}`);
  console.log(`\n  审计合计命中 ${flagged} 处噪声 + ${internals.length} 个内部章节 + ${tiny.length} 个过短块\n`);
}

if (plan[0]?.chunks[0]) {
  console.log('  样例 chunk：');
  console.log('    section:', plan[0].chunks[0].section?.slice(0, 60));
  console.log('    pageKey:', plan[0].chunks[0].pageKey);
  console.log('    text   :', plan[0].chunks[0].text.slice(0, 140).replace(/\s+/g, ' '), '…\n');
}
if (DRY) { console.log('dry run 结束（未调用 API、未写库）\n'); process.exit(0); }
if (!PAT) { console.error('缺少 SUPABASE_PAT 环境变量\n'); process.exit(1); }
if (!EMBED_KEY) { console.error('缺少 SILICONFLOW_API_KEY 环境变量\n'); process.exit(1); }

for (const p of plan) {
  // fresh ingest per source: replace, never duplicate
  await sql(`delete from public.kb_chunks where source_id in (select id from public.kb_sources where key = '${p.key}')`);
  const [row] = await sql(
    `insert into public.kb_sources (key, label, file_path, chars, chunk_count, embedded)
     values ('${p.key}', '${p.label.replace(/'/g, "''")}', '${p.file}', ${p.chars}, ${p.chunks.length}, false)
     on conflict (key) do update set label = excluded.label, file_path = excluded.file_path,
       chars = excluded.chars, chunk_count = excluded.chunk_count, embedded = false
     returning id`);
  const sourceId = row.id;
  console.log(`  ${p.key}: 已登记 source ${sourceId.slice(0, 8)}…，开始 embedding ${p.chunks.length} 块`);

  for (let i = 0; i < p.chunks.length; i += EMBED_BATCH) {
    const batch = p.chunks.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch.map((c) => `${c.section ? c.section + '\n' : ''}${c.text}`));
    const values = batch.map((c, j) => {
      const esc = c.text.replace(/'/g, "''");
      const sec = (c.section || '').replace(/'/g, "''");
      const pk = c.pageKey ? `'${c.pageKey.replace(/'/g, "''")}'` : 'null';
      const bg = bigrams(c.text).replace(/'/g, "''");
      return `('${sourceId}', ${i + j}, '${sec}', ${pk}, '${esc}', ${c.text.length}, '${bg}', ${vecLit(vectors[j])})`;
    }).join(',');
    await sql(`insert into public.kb_chunks (source_id, idx, section, page_key, text, chars, bigrams, embedding) values ${values}`);
    process.stdout.write(`    ${Math.min(i + EMBED_BATCH, p.chunks.length)}/${p.chunks.length}\r`);
  }
  await sql(`update public.kb_sources set embedded = true where id = '${sourceId}'`);
  console.log(`    ${p.key} 完成 ✓`);
}

const [stats] = await sql(`select count(*) as chunks, count(embedding) as embedded from public.kb_chunks`);
console.log(`\n入库完成：${stats.chunks} chunks，其中 ${stats.embedded} 块带向量\n`);
