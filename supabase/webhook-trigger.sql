-- ══════════════════════════════════════════════════════════════════════════
-- Webhook: every new comment → POST to the notify-reply Edge Function.
--
-- This is already applied to the live project (2026-10-08). Keep the file so
-- the trigger can be rebuilt on another project, or reviewed later.
--
-- Two things that are easy to get wrong:
--
--   1. The Edge Function runs with JWT verification ON, so the request must
--      carry `Authorization: Bearer <publishable/anon key>`. Without it the
--      Supabase gateway answers 401 UNAUTHORIZED_NO_AUTH_HEADER before the
--      function ever runs. x-webhook-secret alone is not enough.
--
--   2. WEBHOOK_SECRET lives in two places: the function's Secrets, and the
--      header below. Changing one without the other makes the function
--      answer 401. Read the current value from the dashboard (Secrets) —
--      the Management API only returns its hash.
--
-- Replace <PROJECT_REF>, <PUBLISHABLE_KEY> and <WEBHOOK_SECRET> before use.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_net;

create or replace function public.deck_comment_notify()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $fn$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', to_jsonb(new),
    'old_record', null
  );
  perform net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-reply',
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <PUBLISHABLE_KEY>',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$fn$;

drop trigger if exists deck_comment_notify on public.deck_comments;
create trigger deck_comment_notify
  after insert on public.deck_comments
  for each row execute function public.deck_comment_notify();

-- delivery log: net.http_post is asynchronous, so the response lands here
-- select status_code, content from net._http_response order by id desc limit 5;
