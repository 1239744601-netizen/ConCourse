-- ConCourse automatic website citation lookup
-- Run once in Supabase SQL Editor before deploying the fetch-citation-metadata Edge Function.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.citation_fetch_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, window_start)
);

alter table private.citation_fetch_rate_limits enable row level security;

revoke all on table private.citation_fetch_rate_limits
from public, anon, authenticated;

create or replace function public.consume_citation_fetch_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  bucket timestamptz := date_trunc('minute', clock_timestamp());
  affected integer := 0;
begin
  if caller is null then
    return false;
  end if;

  delete from private.citation_fetch_rate_limits limit_row
  where limit_row.user_id = caller
    and limit_row.window_start < clock_timestamp() - interval '2 days';

  insert into private.citation_fetch_rate_limits
    (user_id, window_start, request_count)
  values
    (caller, bucket, 1)
  on conflict (user_id, window_start) do update
    set request_count = private.citation_fetch_rate_limits.request_count + 1
    where private.citation_fetch_rate_limits.request_count < 8;

  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on function public.consume_citation_fetch_quota()
from public, anon, authenticated;
grant execute on function public.consume_citation_fetch_quota()
to authenticated;

comment on function public.consume_citation_fetch_quota() is
  'Atomically limits automatic citation metadata lookups to eight per signed-in user per minute.';

commit;
