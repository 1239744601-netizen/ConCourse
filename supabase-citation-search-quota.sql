-- ConCourse paid citation-search daily cost ceilings
-- Run after supabase-citation-metadata-setup.sql.
-- Defaults: 25 Brave searches per user per UTC day and 200 for the project.
-- Re-running this file is safe and does not overwrite later threshold changes.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.citation_paid_search_quota_config (
  singleton boolean primary key default true check (singleton),
  per_user_daily_limit integer not null check (per_user_daily_limit between 1 and 10000),
  project_daily_limit integer not null check (project_daily_limit between 1 and 1000000),
  updated_at timestamptz not null default now()
);

insert into private.citation_paid_search_quota_config
  (singleton, per_user_daily_limit, project_daily_limit)
values
  (true, 25, 200)
on conflict (singleton) do nothing;

create table if not exists private.citation_paid_search_user_daily (
  quota_date date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (quota_date, user_id)
);

create table if not exists private.citation_paid_search_project_daily (
  quota_date date primary key,
  request_count integer not null default 0 check (request_count >= 0)
);

alter table private.citation_paid_search_quota_config enable row level security;
alter table private.citation_paid_search_user_daily enable row level security;
alter table private.citation_paid_search_project_daily enable row level security;

revoke all on table private.citation_paid_search_quota_config from public, anon, authenticated;
revoke all on table private.citation_paid_search_user_daily from public, anon, authenticated;
revoke all on table private.citation_paid_search_project_daily from public, anon, authenticated;

create or replace function public.consume_citation_paid_search_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  bucket date := (clock_timestamp() at time zone 'UTC')::date;
  per_user_limit integer;
  project_limit integer;
  user_usage integer := 0;
  project_usage integer := 0;
begin
  if caller is null then
    return false;
  end if;

  -- Serialize paid-search reservations for this UTC day. This makes checking
  -- and incrementing the user and project counters one atomic operation.
  perform pg_advisory_xact_lock(
    hashtext('concourse-paid-citation-search'),
    hashtext(bucket::text)
  );

  select config.per_user_daily_limit, config.project_daily_limit
    into per_user_limit, project_limit
  from private.citation_paid_search_quota_config config
  where config.singleton = true;

  if per_user_limit is null or project_limit is null then
    return false;
  end if;

  select counter.request_count
    into user_usage
  from private.citation_paid_search_user_daily counter
  where counter.quota_date = bucket
    and counter.user_id = caller;

  select counter.request_count
    into project_usage
  from private.citation_paid_search_project_daily counter
  where counter.quota_date = bucket;

  user_usage := coalesce(user_usage, 0);
  project_usage := coalesce(project_usage, 0);
  if user_usage >= per_user_limit or project_usage >= project_limit then
    return false;
  end if;

  insert into private.citation_paid_search_user_daily
    (quota_date, user_id, request_count)
  values
    (bucket, caller, 1)
  on conflict (quota_date, user_id) do update
    set request_count = private.citation_paid_search_user_daily.request_count + 1;

  insert into private.citation_paid_search_project_daily
    (quota_date, request_count)
  values
    (bucket, 1)
  on conflict (quota_date) do update
    set request_count = private.citation_paid_search_project_daily.request_count + 1;

  delete from private.citation_paid_search_user_daily counter
  where counter.quota_date < bucket - 35;

  delete from private.citation_paid_search_project_daily counter
  where counter.quota_date < bucket - 35;

  return true;
end;
$$;

revoke all on function public.consume_citation_paid_search_quota()
from public, anon, authenticated;
grant execute on function public.consume_citation_paid_search_quota()
to authenticated;

comment on function public.consume_citation_paid_search_quota() is
  'Atomically enforces configurable per-user and project-wide UTC daily ceilings for paid citation keyword search.';

commit;

-- To change the ceilings later, run as the project owner, for example:
-- update private.citation_paid_search_quota_config
-- set per_user_daily_limit = 40,
--     project_daily_limit = 500,
--     updated_at = now()
-- where singleton = true;
