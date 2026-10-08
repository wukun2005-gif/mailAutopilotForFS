-- ══════════════════════════════════════════════════════════════════════════
-- Knowledge base for the deck's AI comment answering.
--
-- The retrieval pipeline is ported from patentExaminator
-- (server/src/lib/hybridSearch.ts, reranker.ts, legalChunker.ts). Its storage
-- layer was SQLite with vectors held as JSON text and a full scan per query;
-- here that becomes pgvector + HNSW, which is the same maths with an index.
-- Kept verbatim from there: chunk bounds 100/1500, RRF k=60, the dynamic
-- relative threshold 0.7 with an absolute floor of 0.1, MMR lambda 0.7 and the
-- five-signal rerank weights.
--
-- Two things are deliberately different:
--   · Chinese keyword search. patentExaminator used minisearch + jieba in
--     memory; an Edge Function is stateless and cannot rebuild an index per
--     request. So bigrams are precomputed at ingest time and searched through
--     Postgres full-text search — no dictionary needed, works for zh and en.
--   · The rerank model. The Bailian MaaS gateway returns 404 for /rerank, so
--     the pipeline runs patentExaminator's third tier (heuristic five-signal
--     weighting) instead of a cross-encoder.
--
-- Run this file in the SQL Editor (or via the Management API). Idempotent.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists vector;

-- ── sources: one row per ingested document ────────────────────────────────
create table if not exists public.kb_sources (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,      -- 'deck' | 'prd_en' | 'report' | 'backlog'
  label       text not null,             -- shown in citations
  file_path   text,
  chars       int,
  chunk_count int,
  embedded    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── chunks: the retrievable units ─────────────────────────────────────────
create table if not exists public.kb_chunks (
  id         bigserial primary key,
  source_id  uuid not null references public.kb_sources(id) on delete cascade,
  idx        int not null,
  section    text,                       -- nearest heading, used for reranking + citations
  page_key   text,                       -- deck page slug, lets a comment boost its own page
  text       text not null,
  chars      int,
  bigrams    text,                       -- space-separated 2-grams, for keyword search
  embedding  vector(1024),
  created_at timestamptz not null default now()
);

create index if not exists kb_chunks_source_idx on public.kb_chunks (source_id, idx);
create index if not exists kb_chunks_page_idx   on public.kb_chunks (page_key);
-- HNSW for cosine distance: same ranking as patentExaminator's brute-force
-- scan, but it does not read every row on each query.
create index if not exists kb_chunks_vec_idx
  on public.kb_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists kb_chunks_fts_idx
  on public.kb_chunks using gin (to_tsvector('simple', coalesce(bigrams, '')));

-- ── the knowledge base is server-side only ────────────────────────────────
alter table public.kb_sources enable row level security;
alter table public.kb_chunks  enable row level security;
drop policy if exists "kb closed to the browser" on public.kb_sources;
create policy "kb closed to the browser" on public.kb_sources for select using (false);
drop policy if exists "kb closed to the browser" on public.kb_chunks;
create policy "kb closed to the browser" on public.kb_chunks for select using (false);

-- ══ hybrid retrieval: vector + keyword, fused with RRF ══
-- Mirrors hybridSearch.ts: each ranking contributes 1/(k + rank) with k = 60,
-- so a chunk that both retrievers like rises above one that only one likes.
create or replace function public.kb_search(
  q_embedding vector(1024),
  q_bigrams   text,
  q_page_key  text default null,
  q_limit     int  default 15
)
returns table (
  chunk_id  bigint,
  source    text,
  label     text,
  section   text,
  page_key  text,
  body      text,
  vec_score double precision,
  kw_score  double precision,
  score     double precision
)
language sql
stable
as $$
  with vec as (
    select c.id,
           (1 - (c.embedding <=> q_embedding))::double precision as s,
           row_number() over (order by c.embedding <=> q_embedding) as r
    from public.kb_chunks c
    where c.embedding is not null
    order by c.embedding <=> q_embedding
    limit 60
  ),
  kw as (
    select c.id,
           ts_rank(to_tsvector('simple', coalesce(c.bigrams, '')),
                   to_tsquery('simple', q_bigrams))::double precision as s,
           row_number() over (
             order by ts_rank(to_tsvector('simple', coalesce(c.bigrams, '')),
                              to_tsquery('simple', q_bigrams)) desc
           ) as r
    from public.kb_chunks c
    where q_bigrams <> ''
      and to_tsvector('simple', coalesce(c.bigrams, '')) @@ to_tsquery('simple', q_bigrams)
    limit 60
  )
  select c.id,
         s.key,
         s.label,
         c.section,
         c.page_key,
         c.text,
         coalesce(v.s, 0),
         coalesce(k.s, 0),
         -- RRF, k = 60 (patentExaminator hybridSearch.ts), plus a small bonus
         -- when the chunk sits on the page the comment was written on
         coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + k.r), 0)
           + case when q_page_key is not null and c.page_key = q_page_key then 0.004 else 0 end
  from public.kb_chunks c
  join public.kb_sources s on s.id = c.source_id
  left join vec v on v.id = c.id
  left join kw  k on k.id = c.id
  where v.id is not null or k.id is not null
  order by 9 desc
  limit q_limit;
$$;
