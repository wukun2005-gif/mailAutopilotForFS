-- ══════════════════════════════════════════════════════════════════════════
-- deck_page_views — who opened the deck, from where, and when.
--
-- One row per page load, written by the page-view Edge Function (service
-- role only). The deck itself sends nothing but its own identity key and the
-- URL: the IP and the country are taken from the request headers on the
-- server, because a browser cannot be asked for its own IP.
--
-- Why there are no policies at all: the table must not be reachable through
-- PostgREST. Anon and authenticated get nothing, RLS stays on with zero
-- policies, and only the service role (the Edge Function, and you through the
-- Management API) can read or write it. A visitor therefore cannot list other
-- visitors' addresses — which is the whole risk of keeping this log.
--
-- Apply it: paste into the dashboard SQL editor, or POST the whole file to
--   POST https://api.supabase.com/v1/projects/<ref>/database/query
--   with { "query": "<file contents>" } and your PAT as the bearer token.
-- Read it back with:  SUPABASE_PAT=... node scripts/page-views.mjs
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.deck_page_views (
  id          uuid primary key default gen_random_uuid(),
  deck_id     text not null default 'default',
  path        text,             -- pathname + query the reader landed on
  ip          text,             -- text, not inet: IPv4 and IPv6 both land here
  country_code text,            -- ISO-3166 alpha-2, '' when the header is absent
  country     text,             -- country name from the geo lookup
  client_id   text,             -- the deck's own identity key: same browser = same id
  user_agent  text,
  hdr         jsonb,            -- the handful of request headers it came from (debug)
  owner       boolean not null default false,  -- the owner's own visit
  created_at  timestamptz not null default now()
);

-- RLS on, no policies → nothing may touch it over the API.
alter table public.deck_page_views enable row level security;
revoke all on public.deck_page_views from anon, authenticated;
grant all on public.deck_page_views to service_role;

-- `if not exists` on CREATE only covers a first run; a table created before
-- `owner` existed still needs it added, and CREATE IF NOT EXISTS will not
-- touch an existing table at all.
alter table public.deck_page_views
  add column if not exists owner boolean not null default false;

-- ── which addresses are mine ──────────────────────────────────────────────
-- Two ways a visit gets marked as the owner's: opening the deck with
-- ?owner=true (the browser says so itself), or this list — the owner clicks
-- an address in the panel once and every visit from it counts as theirs from
-- then on, including visits where the URL carried no flag.
create table if not exists public.deck_owner_ips (
  ip        text primary key,
  tagged_at timestamptz not null default now()
);

alter table public.deck_owner_ips enable row level security;
revoke all on public.deck_owner_ips from anon, authenticated;
grant all on public.deck_owner_ips to service_role;

-- Daily roll-up. Kept as a view rather than a table so it can never drift
-- from the rows it counts. `owner` is a column of the grouping so "my own
-- visits" can be filtered out wherever the numbers are read. Dropped first:
-- CREATE OR REPLACE may only keep the columns it already has, in order, so a
-- new one in the middle needs a fresh view.
drop view if exists public.deck_page_view_stats;
create view public.deck_page_view_stats as
select
  date_trunc('day', created_at)        as day,
  country_code,
  country,
  owner,
  count(*)                             as views,
  count(distinct ip)                   as ips,
  count(distinct client_id)            as browsers
from public.deck_page_views
group by 1, 2, 3, 4;

revoke all on public.deck_page_view_stats from anon, authenticated;

-- One row per address: how many times, first and last time seen.
drop view if exists public.deck_page_view_by_ip;
create view public.deck_page_view_by_ip as
select
  ip,
  country,
  owner,
  count(*)            as views,
  count(distinct path) as pages,
  min(created_at)     as first_seen,
  max(created_at)     as last_seen,
  count(distinct client_id) as browsers
from public.deck_page_views
group by 1, 2, 3;

revoke all on public.deck_page_view_by_ip from anon, authenticated;

-- PostgREST caches its schema; without this the new relations are invisible
-- to the API until something else reloads it.
notify pgrst, 'reload schema';
