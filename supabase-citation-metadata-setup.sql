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

-- Private, account-scoped bibliography persistence. The browser still keeps a
-- local fallback, while these RPCs make saved references available on another
-- signed-in device without exposing the table through PostgREST.
create table if not exists public.citation_libraries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entries jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(entries) = 'array'
      and jsonb_array_length(entries) <= 60
      and octet_length(entries::text) <= 524288
    ),
  updated_at timestamptz not null default now()
);

alter table public.citation_libraries enable row level security;
revoke all on table public.citation_libraries
from public, anon, authenticated;

create or replace function public.get_citation_library()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  saved_entries jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select library.entries
  into saved_entries
  from public.citation_libraries library
  where library.user_id = caller;

  return coalesce(saved_entries, '[]'::jsonb);
end;
$$;

revoke all on function public.get_citation_library()
from public, anon, authenticated;
grant execute on function public.get_citation_library()
to authenticated;

create or replace function public.save_citation_library(
  p_entries jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(coalesce(p_entries, 'null'::jsonb)) <> 'array' then
    raise exception 'Citation library must be an array';
  end if;
  if jsonb_array_length(p_entries) > 60
     or octet_length(p_entries::text) > 524288 then
    raise exception 'Citation library is too large';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_entries) entry
    where jsonb_typeof(entry) <> 'object'
       or coalesce(entry->>'source', '') not in ('book', 'journal', 'website')
       or coalesce(jsonb_typeof(entry->'title'), '') <> 'string'
       or char_length(entry->>'title') not between 1 and 1000
  ) then
    raise exception 'Citation library contains an invalid entry';
  end if;

  insert into public.citation_libraries (user_id, entries, updated_at)
  values (caller, p_entries, now())
  on conflict (user_id) do update
  set
    entries = excluded.entries,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.save_citation_library(jsonb)
from public, anon, authenticated;
grant execute on function public.save_citation_library(jsonb)
to authenticated;

comment on function public.get_citation_library() is
  'Returns only the signed-in user bibliography through an RPC-only surface.';
comment on function public.save_citation_library(jsonb) is
  'Validates and saves at most 60 references for the signed-in user.';

notify pgrst, 'reload schema';

commit;
