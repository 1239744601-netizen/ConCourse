-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- It creates one private JSON state record per authenticated ConCourse user.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "Users can read their own ConCourse state" on public.user_state;
create policy "Users can read their own ConCourse state"
on public.user_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own ConCourse state" on public.user_state;
create policy "Users can insert their own ConCourse state"
on public.user_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own ConCourse state" on public.user_state;
create policy "Users can update their own ConCourse state"
on public.user_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own ConCourse state" on public.user_state;
create policy "Users can delete their own ConCourse state"
on public.user_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Academic profiles captured during registration.
-- school_verification records the validation level. "directory_match" means
-- the institution name matched the online directory; it does not prove enrollment.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  school_name text,
  school_country text,
  school_domain text,
  school_website text,
  school_verification text not null default 'unverified'
    check (school_verification in ('unverified', 'directory_match', 'email_domain', 'institution_sso')),
  major_of_study text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to rerun if the profiles table was created by an earlier version.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists degree_level text;
alter table public.profiles add column if not exists study_year smallint;

-- Degree level and year are selected in the wishlist workspace. Keeping them
-- as profile columns makes them visible and filterable in the Supabase dashboard,
-- while the final chosen timetable remains in the user's private JSON state.
alter table public.profiles drop constraint if exists profiles_degree_level_check;
alter table public.profiles
  add constraint profiles_degree_level_check
  check (degree_level is null or degree_level in ('bachelor', 'master', 'phd'));

alter table public.profiles drop constraint if exists profiles_study_year_check;
alter table public.profiles
  add constraint profiles_study_year_check
  check (study_year is null or study_year between 1 and 8);

-- Preserve the user's capitalization while accepting both uppercase and
-- lowercase letters. Uniqueness is case-sensitive, so Alex and alex can be
-- registered as separate accounts, while the exact same spelling cannot.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,24}$');

drop index if exists public.profiles_username_unique;
create unique index profiles_username_unique
  on public.profiles (username)
  where username is not null;

-- Confidential legal names are deliberately separated from public academic
-- profiles. RLS is enabled and no anon/authenticated policies or grants are
-- provided. The website owner can access these rows from the Supabase dashboard
-- or another trusted service-role environment; browser clients cannot read them.
create table if not exists public.private_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  given_name text not null,
  middle_name text,
  family_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.private_profiles enable row level security;
revoke all on table public.private_profiles from anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own academic profile" on public.profiles;
create policy "Users can read their own academic profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own academic profile" on public.profiles;
create policy "Users can update their own academic profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Public registration can ask whether a username is free without exposing
-- profile rows or email addresses.
create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    trim(candidate) ~ '^[A-Za-z0-9_]{3,24}$'
    and not exists (
      select 1
      from public.profiles
      where username = trim(candidate)
    ),
    false
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Copy signup metadata into a private profile row whenever a user is created.
create or replace function public.handle_new_concourse_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    user_id,
    username,
    school_name,
    school_country,
    school_domain,
    school_website,
    school_verification,
    major_of_study
  ) values (
    new.id,
    case
      when trim(new.raw_user_meta_data ->> 'username') ~ '^[A-Za-z0-9_]{3,24}$'
        then trim(new.raw_user_meta_data ->> 'username')
      else null
    end,
    new.raw_user_meta_data ->> 'school_name',
    new.raw_user_meta_data ->> 'school_country',
    new.raw_user_meta_data ->> 'school_domain',
    new.raw_user_meta_data ->> 'school_website',
    coalesce(new.raw_user_meta_data ->> 'school_verification', 'unverified'),
    new.raw_user_meta_data ->> 'major_of_study'
  )
  on conflict (user_id) do update set
    username = excluded.username,
    school_name = excluded.school_name,
    school_country = excluded.school_country,
    school_domain = excluded.school_domain,
    school_website = excluded.school_website,
    school_verification = excluded.school_verification,
    major_of_study = excluded.major_of_study,
    updated_at = now();

  insert into public.private_profiles (
    user_id,
    given_name,
    middle_name,
    family_name
  ) values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'given_name'), ''), 'Not provided'),
    nullif(trim(new.raw_user_meta_data ->> 'middle_name'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'family_name'), ''), 'Not provided')
  )
  on conflict (user_id) do update set
    given_name = excluded.given_name,
    middle_name = excluded.middle_name,
    family_name = excluded.family_name,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_concourse on auth.users;
create trigger on_auth_user_created_concourse
  after insert or update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_concourse_user();

-- Backfill profile rows for accounts created before this migration.
insert into public.profiles (
  user_id,
  username,
  school_name,
  school_country,
  school_domain,
  school_website,
  school_verification,
  major_of_study
)
select
  id,
  case
    when trim(raw_user_meta_data ->> 'username') ~ '^[A-Za-z0-9_]{3,24}$'
      then trim(raw_user_meta_data ->> 'username')
    else null
  end,
  raw_user_meta_data ->> 'school_name',
  raw_user_meta_data ->> 'school_country',
  raw_user_meta_data ->> 'school_domain',
  raw_user_meta_data ->> 'school_website',
  coalesce(raw_user_meta_data ->> 'school_verification', 'unverified'),
  raw_user_meta_data ->> 'major_of_study'
from auth.users
on conflict (user_id) do nothing;

-- Backfill the confidential table for accounts created before this migration.
insert into public.private_profiles (
  user_id,
  given_name,
  middle_name,
  family_name
)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'given_name'), ''), 'Not provided'),
  nullif(trim(raw_user_meta_data ->> 'middle_name'), ''),
  coalesce(nullif(trim(raw_user_meta_data ->> 'family_name'), ''), 'Not provided')
from auth.users
on conflict (user_id) do nothing;
