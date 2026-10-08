-- ══════════════════════════════════════════════════════════════════════════
-- Deck comments — run this whole file once in Supabase → SQL Editor.
-- It is safe to re-run: every statement is guarded with IF NOT EXISTS / DROP.
--
-- Security model: the anon key ships in the page, so row-level security is
-- what protects the data. Readers may read everything, add comments, and
-- flip resolved/deleted on a comment. Nobody may hard-delete a row, and the
-- notification log is closed to the browser entirely (service role only).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.deck_comments (
  id            uuid primary key default gen_random_uuid(),
  deck_id       text        not null default 'default',
  page_key      text        not null,          -- slug of the headline
  page_index    int         not null,          -- fallback if the headline changes
  page_title    text,
  author        text        not null default 'Anonymous',
  email         text,                          -- optional; only for reply notices
  body          text        not null,
  quote         text,                          -- anchored phrase, if any
  quote_prefix  text,
  quote_suffix  text,
  parent_id     uuid references public.deck_comments(id) on delete cascade,
  resolved      boolean     not null default false,
  deleted       boolean     not null default false,
  client_id     text,                          -- lets a reader delete their own
  created_at    timestamptz not null default now()
);

create index if not exists deck_comments_deck_idx   on public.deck_comments (deck_id, page_key);
create index if not exists deck_comments_time_idx   on public.deck_comments (deck_id, created_at);
create index if not exists deck_comments_parent_idx on public.deck_comments (parent_id);

-- ══ notification log (closed to the browser) ══
-- Guards against a webhook retry sending the same email twice. One comment
-- can raise two mails — 'reply' to whoever was answered, 'owner' to the deck
-- owner — so the key is (comment_id, kind), not just comment_id.
create table if not exists public.deck_comment_notifications (
  comment_id uuid references public.deck_comments(id) on delete cascade,
  kind       text not null default 'reply',
  recipient  text,
  status     text,
  error      text,
  sent_at    timestamptz not null default now(),
  primary key (comment_id, kind)
);

-- upgrade path: an earlier install keyed this log on comment_id alone
alter table public.deck_comment_notifications
  add column if not exists kind text not null default 'reply';
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'deck_comment_notifications_pkey'
      and conrelid = 'public.deck_comment_notifications'::regclass
      and array_length(conkey, 1) = 1
  ) then
    alter table public.deck_comment_notifications
      drop constraint deck_comment_notifications_pkey;
    alter table public.deck_comment_notifications
      add primary key (comment_id, kind);
  end if;
end $$;

-- ══ row level security ══
alter table public.deck_comments              enable row level security;
alter table public.deck_comment_notifications enable row level security;

drop policy if exists "comments are readable by everyone" on public.deck_comments;
create policy "comments are readable by everyone"
  on public.deck_comments for select
  using (true);

drop policy if exists "anyone may comment" on public.deck_comments;
create policy "anyone may comment"
  on public.deck_comments for insert
  with check (
    char_length(body) between 1 and 2000
    and char_length(author) <= 60
    and (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    and (quote is null or char_length(quote) <= 500)
  );

-- resolve / reopen / soft-delete. The panel only shows these for your own
-- comment, but the row itself is public data, so a determined caller could
-- flip any of them — acceptable for a public comment box, and it keeps
-- hard deletes (real data loss) out of reach.
drop policy if exists "comments may be resolved or withdrawn" on public.deck_comments;
create policy "comments may be resolved or withdrawn"
  on public.deck_comments for update
  using (true)
  with check (true);

-- no delete policy → nobody can delete through the API

-- ══ realtime ══
alter table public.deck_comments replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'deck_comments'
  ) then
    alter publication supabase_realtime add table public.deck_comments;
  end if;
end $$;

-- ══ hide email addresses from the browser ══
-- Row-level security is row-scoped, not column-scoped, so the browser reads
-- through a view that simply does not have the email column.
--
-- security_invoker is NOT optional. A plain view runs with the *creator's*
-- rights, which meant RLS was silently bypassed for anything done through it:
-- an anonymous visitor could DELETE anyone's comment and it really went away
-- (verified 2026-10-08 — this is also what Supabase's Security Advisor flags
-- as "security_definer_view"). With security_invoker the caller's own rights
-- and RLS apply, so the missing DELETE policy actually protects the rows.
--
-- The cost of invoker rights is that anon must be able to read the base table,
-- which is why SELECT is granted per column below — every column except email.
create or replace view public.deck_comments_public as
  select id, deck_id, page_key, page_index, page_title, author, body,
         quote, quote_prefix, quote_suffix, parent_id, resolved, deleted,
         client_id, created_at
  from public.deck_comments;

alter view public.deck_comments_public set (security_invoker = true);

grant select (id, deck_id, page_key, page_index, page_title, author, body,
              quote, quote_prefix, quote_suffix, parent_id, resolved, deleted,
              client_id, created_at)
  on public.deck_comments to anon, authenticated;

-- and the raw table stays unreadable as a whole: `select *` fails, so email
-- cannot be reached even by asking for every column
revoke select on public.deck_comments from anon;

-- ══ updates may only touch resolved / deleted ══
-- RLS decides *which rows* may be updated, not *which columns*. Without this
-- guard any visitor could rewrite someone else's comment body (verified
-- 2026-10-08: PATCH with {"body":"TAMPERED"} succeeded). The trigger forces
-- every content field back to its previous value; the service role and the
-- ops roles are exempt so data can still be repaired.
create or replace function public.deck_comments_guard_update()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  new.body := old.body;
  new.author := old.author;
  new.email := old.email;
  new.quote := old.quote;
  new.quote_prefix := old.quote_prefix;
  new.quote_suffix := old.quote_suffix;
  new.deck_id := old.deck_id;
  new.page_key := old.page_key;
  new.page_index := old.page_index;
  new.page_title := old.page_title;
  new.parent_id := old.parent_id;
  new.client_id := old.client_id;
  new.created_at := old.created_at;
  return new;
end $fn$;

drop trigger if exists deck_comments_guard_update on public.deck_comments;
create trigger deck_comments_guard_update
  before update on public.deck_comments
  for each row execute function public.deck_comments_guard_update();

-- ══ trigger functions are not a public API ══
-- They only ever run as triggers, so nothing should be able to call them over
-- HTTP (Security Advisor: anon_security_definer_function_executable).
revoke execute on function public.deck_comment_notify() from anon, authenticated, public;
revoke execute on function public.deck_comments_guard_update() from anon, authenticated, public;

-- ══ the notification log is closed to everyone but the service role ══
-- An explicit deny-all policy documents the intent and keeps the advisor quiet.
drop policy if exists "closed to everyone but the service role" on public.deck_comment_notifications;
create policy "closed to everyone but the service role"
  on public.deck_comment_notifications for select using (false);

-- PostgREST caches the schema: without this the new view is invisible to the
-- API until something else happens to reload it, and the panel shows an empty
-- list or a refresh error. Safe to run any time.
notify pgrst, 'reload schema';
