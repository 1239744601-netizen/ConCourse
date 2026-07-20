-- ConCourse Supabase setup — Part 1 of 2
-- Run this file first in Supabase Dashboard > SQL Editor > New query.
-- Wait for Success before running supabase-setup-part-2.sql in a new query.
-- This file is safe to rerun if a previous attempt stopped with an error.

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
-- school_verification is retained only for backwards compatibility and is not
-- used for authorization. Trusted membership status is created later below.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text,
  school_name text,
  school_country text,
  school_domain text,
  school_website text,
  school_directory_id text,
  school_directory_source text,
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
alter table public.profiles add column if not exists school_directory_id text;
alter table public.profiles add column if not exists school_directory_source text;

update public.profiles set
  school_name = case when char_length(trim(school_name)) >= 2 then left(trim(school_name), 220) else null end,
  school_country = nullif(left(trim(school_country), 120), ''),
  school_domain = nullif(left(trim(school_domain), 253), ''),
  school_website = nullif(left(trim(school_website), 500), ''),
  school_directory_id = nullif(left(trim(school_directory_id), 500), ''),
  school_directory_source = nullif(left(trim(school_directory_source), 40), ''),
  major_of_study = nullif(left(trim(major_of_study), 160), '')
where (school_name is not null and (school_name <> trim(school_name) or char_length(trim(school_name)) not between 2 and 220))
   or (school_country is not null and (school_country <> trim(school_country) or char_length(trim(school_country)) not between 1 and 120))
   or (school_domain is not null and (school_domain <> trim(school_domain) or char_length(trim(school_domain)) not between 1 and 253))
   or (school_website is not null and (school_website <> trim(school_website) or char_length(trim(school_website)) not between 1 and 500))
   or (school_directory_id is not null and (school_directory_id <> trim(school_directory_id) or char_length(trim(school_directory_id)) not between 1 and 500))
   or (school_directory_source is not null and (school_directory_source <> trim(school_directory_source) or char_length(trim(school_directory_source)) not between 1 and 40))
   or (major_of_study is not null and (major_of_study <> trim(major_of_study) or char_length(trim(major_of_study)) not between 1 and 160));

alter table public.profiles drop constraint if exists profiles_school_name_bounded;
alter table public.profiles add constraint profiles_school_name_bounded
  check (school_name is null or (school_name = trim(school_name) and char_length(school_name) between 2 and 220));
alter table public.profiles drop constraint if exists profiles_school_country_bounded;
alter table public.profiles add constraint profiles_school_country_bounded
  check (school_country is null or (school_country = trim(school_country) and char_length(school_country) between 1 and 120));
alter table public.profiles drop constraint if exists profiles_school_domain_bounded;
alter table public.profiles add constraint profiles_school_domain_bounded
  check (school_domain is null or (school_domain = trim(school_domain) and char_length(school_domain) between 1 and 253));
alter table public.profiles drop constraint if exists profiles_school_website_bounded;
alter table public.profiles add constraint profiles_school_website_bounded
  check (school_website is null or (school_website = trim(school_website) and char_length(school_website) between 1 and 500));
alter table public.profiles drop constraint if exists profiles_school_directory_id_bounded;
alter table public.profiles add constraint profiles_school_directory_id_bounded
  check (school_directory_id is null or (school_directory_id = trim(school_directory_id) and char_length(school_directory_id) between 1 and 500));
alter table public.profiles drop constraint if exists profiles_school_directory_source_bounded;
alter table public.profiles add constraint profiles_school_directory_source_bounded
  check (school_directory_source is null or (school_directory_source = trim(school_directory_source) and char_length(school_directory_source) between 1 and 40));
alter table public.profiles drop constraint if exists profiles_major_bounded;
alter table public.profiles add constraint profiles_major_bounded
  check (major_of_study is null or (major_of_study = trim(major_of_study) and char_length(major_of_study) between 1 and 160));

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
    school_directory_id,
    school_directory_source,
    school_verification,
    major_of_study
  ) values (
    new.id,
    case
      when trim(new.raw_user_meta_data ->> 'username') ~ '^[A-Za-z0-9_]{3,24}$'
        then trim(new.raw_user_meta_data ->> 'username')
      else null
    end,
    nullif(left(trim(new.raw_user_meta_data ->> 'school_name'), 220), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'school_country'), 120), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'school_domain'), 253), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'school_website'), 500), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'school_directory_id'), 500), ''),
    nullif(left(trim(new.raw_user_meta_data ->> 'school_directory_source'), 40), ''),
    -- Browser metadata is user-controlled. A directory match is useful for
    -- suggestions, but it must never grant access to a university community.
    'unverified',
    nullif(left(trim(new.raw_user_meta_data ->> 'major_of_study'), 160), '')
  )
  on conflict (user_id) do update set
    username = excluded.username,
    school_name = excluded.school_name,
    school_country = excluded.school_country,
    school_domain = excluded.school_domain,
    school_website = excluded.school_website,
    school_directory_id = excluded.school_directory_id,
    school_directory_source = excluded.school_directory_source,
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

revoke all on function public.handle_new_concourse_user() from public, anon, authenticated;

-- Backfill profile rows for accounts created before this migration.
insert into public.profiles (
  user_id,
  username,
  school_name,
  school_country,
  school_domain,
  school_website,
  school_directory_id,
  school_directory_source,
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
  nullif(left(trim(raw_user_meta_data ->> 'school_name'), 220), ''),
  nullif(left(trim(raw_user_meta_data ->> 'school_country'), 120), ''),
  nullif(left(trim(raw_user_meta_data ->> 'school_domain'), 253), ''),
  nullif(left(trim(raw_user_meta_data ->> 'school_website'), 500), ''),
  nullif(left(trim(raw_user_meta_data ->> 'school_directory_id'), 500), ''),
  nullif(left(trim(raw_user_meta_data ->> 'school_directory_source'), 40), ''),
  'unverified',
  nullif(left(trim(raw_user_meta_data ->> 'major_of_study'), 160), '')
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

-- ============================================================================
-- ConCourse Student Hub
-- Run this same file again after deploying the member-hub website files.
-- The hub intentionally separates private profile/contact data, anonymous
-- timetable analytics, school-scoped discussions, and direct conversations.
-- ============================================================================

create extension if not exists pgcrypto;

-- Users may edit only their non-authoritative academic fields. School identity
-- and verification are controlled from the Supabase dashboard/trusted backend.
revoke update on table public.profiles from authenticated;
grant update (username, major_of_study, degree_level, study_year)
  on table public.profiles to authenticated;

-- Earlier versions accepted this value from signup metadata, so none of those
-- legacy badges are authoritative. Trusted status now lives only in the
-- school_memberships table created below.
update public.profiles
set school_verification = 'unverified', updated_at = now()
where school_verification <> 'unverified';

create or replace function public.normalized_school_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(trim(coalesce(value, ''))), '[[:space:][:punct:]]+', '-', 'g')),
    ''
  );
$$;

revoke all on function public.normalized_school_key(text) from public;

create or replace function public.candidate_institution_key(
  school_name text,
  school_country text,
  school_domain text,
  school_directory_id text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when public.normalized_school_key(school_name) is null then null
    when lower(trim(coalesce(school_directory_id, ''))) ~ '^https://ror\.org/[a-z0-9]+$'
      then 'ror:' || regexp_replace(lower(trim(school_directory_id)), '^.*/', '')
    when lower(trim(coalesce(school_domain, ''))) ~ '^[a-z0-9.-]+\.[a-z]{2,}$'
      then 'domain:' || lower(trim(school_domain))
    else concat(
      'claimed:',
      coalesce(public.normalized_school_key(school_country), 'unknown-country'),
      ':',
      public.normalized_school_key(school_name)
    )
  end;
$$;

revoke all on function public.candidate_institution_key(text, text, text, text) from public;

-- A membership starts as pending even if the institution directory matched.
-- The key prefers a ROR ID, then an institutional domain, and finally a
-- country-qualified claim. These fields remain only candidates until the
-- owner/service role confirms the institution and changes status to verified.
create table if not exists public.school_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_name text not null check (char_length(trim(school_name)) between 2 and 220),
  school_key text not null check (char_length(school_key) between 2 and 500),
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected', 'revoked')),
  verification_method text check (verification_method is null or verification_method in ('academic_email', 'institution_sso', 'manual')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A verified row is authorization-bearing, so it must carry an auditable
-- verification method and timestamp. Any legacy row without both is demoted.
update public.school_memberships
set status = 'pending', verification_method = null, verified_at = null, updated_at = now()
where status = 'verified' and (verification_method is null or verified_at is null);
alter table public.school_memberships drop constraint if exists school_memberships_school_key_check;
alter table public.school_memberships add constraint school_memberships_school_key_check
  check (char_length(school_key) between 2 and 500);
alter table public.school_memberships drop constraint if exists school_memberships_verified_evidence;
alter table public.school_memberships add constraint school_memberships_verified_evidence
  check (status <> 'verified' or (verification_method is not null and verified_at is not null));

create index if not exists school_memberships_school_status_idx
  on public.school_memberships (school_key, status);

alter table public.school_memberships enable row level security;
drop policy if exists "Users can read their own school membership" on public.school_memberships;
create policy "Users can read their own school membership"
on public.school_memberships for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.school_memberships from anon, authenticated;
grant select (user_id, school_name, school_key, status, verification_method, verified_at, created_at, updated_at)
  on table public.school_memberships to authenticated;

create or replace function public.sync_school_membership_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_key text := public.candidate_institution_key(
    new.school_name,
    new.school_country,
    new.school_domain,
    new.school_directory_id
  );
begin
  if next_key is null then
    update public.school_memberships
    set status = 'revoked', verification_method = null, verified_at = null, updated_at = now()
    where user_id = new.user_id;
    return new;
  end if;

  insert into public.school_memberships (user_id, school_name, school_key, status)
  values (new.user_id, trim(new.school_name), next_key, 'pending')
  on conflict (user_id) do update set
    school_name = case
      when public.school_memberships.status = 'verified'
       and public.school_memberships.school_key = excluded.school_key
        then public.school_memberships.school_name
      else excluded.school_name
    end,
    school_key = excluded.school_key,
    status = case
      when public.school_memberships.school_key = excluded.school_key
        then public.school_memberships.status
      else 'pending'
    end,
    verification_method = case
      when public.school_memberships.school_key = excluded.school_key
        then public.school_memberships.verification_method
      else null
    end,
    verified_at = case
      when public.school_memberships.school_key = excluded.school_key
        then public.school_memberships.verified_at
      else null
    end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_sync_school_membership on public.profiles;
create trigger profiles_sync_school_membership
  after insert or update of school_name, school_country, school_domain, school_directory_id on public.profiles
  for each row execute procedure public.sync_school_membership_from_profile();

revoke all on function public.sync_school_membership_from_profile() from public, anon, authenticated;

insert into public.school_memberships (user_id, school_name, school_key, status)
select
  user_id,
  trim(school_name),
  public.candidate_institution_key(school_name, school_country, school_domain, school_directory_id),
  'pending'
from public.profiles
where public.candidate_institution_key(school_name, school_country, school_domain, school_directory_id) is not null
on conflict (user_id) do update set
  school_name = excluded.school_name,
  school_key = excluded.school_key,
  updated_at = now()
where public.school_memberships.status = 'pending';

-- Extended member profile. All columns, including phone and pasted social URLs,
-- are readable directly only by their owner. Community RPCs expose only a
-- visibility-checked subset; the schoolmate profile may include an explicitly
-- shared WeChat ID, but never the phone number or private contact fields.
create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or (display_name = trim(display_name) and char_length(display_name) between 1 and 80)),
  bio text check (bio is null or char_length(bio) <= 500),
  phone_number text check (phone_number is null or char_length(phone_number) <= 32),
  interests text[] not null default '{}'::text[] check (cardinality(interests) <= 20 and char_length(array_to_string(interests, ',')) <= 1000),
  avatar_path text,
  avatar_revision bigint not null default 0,
  instagram_url text,
  whatsapp_url text,
  linkedin_url text,
  wechat_id text,
  share_wechat boolean not null default false,
  website_url text,
  profile_visibility text not null default 'school' check (profile_visibility in ('school', 'private')),
  allow_messages boolean not null default false,
  analytics_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles add column if not exists analytics_consent boolean not null default false;
alter table public.member_profiles add column if not exists avatar_path text;
alter table public.member_profiles add column if not exists avatar_revision bigint not null default 0;
alter table public.member_profiles add column if not exists wechat_id text;
alter table public.member_profiles add column if not exists share_wechat boolean not null default false;
do $$
begin
  -- If this upgrades a draft schema whose default was opt-out-in-reverse,
  -- withdraw those implicit permissions once before changing the default.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_profiles'
      and column_name = 'allow_messages'
      and column_default in ('true', 'true::boolean')
  ) then
    update public.member_profiles set allow_messages = false where allow_messages = true;
  end if;
end;
$$;
alter table public.member_profiles alter column allow_messages set default false;
update public.member_profiles
set display_name = nullif(left(trim(display_name), 80), '')
where display_name is not null and (display_name <> trim(display_name) or char_length(display_name) > 80);
update public.member_profiles profile
set interests = coalesce((
  select array_agg(bounded.item order by bounded.position)
  from (
    select left(trim(source.item), 45) as item, source.position
    from unnest(profile.interests) with ordinality as source(item, position)
    where char_length(trim(source.item)) > 0
    order by source.position
    limit 20
  ) bounded
), '{}'::text[])
where cardinality(interests) > 20
   or char_length(array_to_string(interests, ',')) > 1000
   or exists (select 1 from unnest(interests) item where char_length(trim(item)) not between 1 and 60);

create or replace function public.bounded_profile_interests(value text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(value), 0) <= 20
    and char_length(array_to_string(coalesce(value, '{}'::text[]), ',')) <= 1000
    and not exists (
      select 1 from unnest(coalesce(value, '{}'::text[])) item
      where char_length(trim(item)) not between 1 and 60
    );
$$;
revoke all on function public.bounded_profile_interests(text[]) from public;
grant execute on function public.bounded_profile_interests(text[]) to authenticated;
alter table public.member_profiles drop constraint if exists member_profiles_display_name_bounded;
alter table public.member_profiles add constraint member_profiles_display_name_bounded
  check (display_name is null or (display_name = trim(display_name) and char_length(display_name) between 1 and 80));
alter table public.member_profiles drop constraint if exists member_profiles_interests_bounded;
alter table public.member_profiles add constraint member_profiles_interests_bounded
  check (public.bounded_profile_interests(interests));
alter table public.member_profiles drop constraint if exists member_profiles_avatar_path_owned;
alter table public.member_profiles add constraint member_profiles_avatar_path_owned
  check (
    avatar_path is null
    or avatar_path = user_id::text || '/avatar.webp'
    or avatar_path ~ ('^' || user_id::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  );
alter table public.member_profiles drop constraint if exists member_profiles_avatar_revision_nonnegative;
alter table public.member_profiles add constraint member_profiles_avatar_revision_nonnegative
  check (avatar_revision >= 0);
alter table public.member_profiles drop constraint if exists member_profiles_wechat_id_bounded;
alter table public.member_profiles add constraint member_profiles_wechat_id_bounded
  check (
    wechat_id is null
    or (
      wechat_id = trim(wechat_id)
      and char_length(wechat_id) between 1 and 64
      and wechat_id !~ '[[:cntrl:]]'
    )
  );
alter table public.member_profiles drop constraint if exists member_profiles_instagram_https;
alter table public.member_profiles add constraint member_profiles_instagram_https
  check (instagram_url is null or instagram_url ~ '^https://([^/]+\.)?instagram\.com/');
alter table public.member_profiles drop constraint if exists member_profiles_whatsapp_https;
alter table public.member_profiles add constraint member_profiles_whatsapp_https
  check (whatsapp_url is null or whatsapp_url ~ '^https://(wa\.me|api\.whatsapp\.com)/');
alter table public.member_profiles drop constraint if exists member_profiles_linkedin_https;
alter table public.member_profiles add constraint member_profiles_linkedin_https
  check (linkedin_url is null or linkedin_url ~ '^https://([^/]+\.)?linkedin\.com/');
alter table public.member_profiles drop constraint if exists member_profiles_website_https;
alter table public.member_profiles add constraint member_profiles_website_https
  check (website_url is null or website_url ~ '^https://');
alter table public.member_profiles enable row level security;
revoke all on table public.member_profiles from anon;
grant select, insert, update on table public.member_profiles to authenticated;

drop policy if exists "Users can read their own member profile" on public.member_profiles;
create policy "Users can read their own member profile"
on public.member_profiles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own member profile" on public.member_profiles;
create policy "Users can create their own member profile"
on public.member_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own member profile" on public.member_profiles;
create policy "Users can update their own member profile"
on public.member_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_concourse_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists member_profiles_set_updated_at on public.member_profiles;
create trigger member_profiles_set_updated_at
  before update on public.member_profiles
  for each row execute procedure public.set_concourse_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_concourse_updated_at();

-- Normalized index of finalized schedules. The detailed planner state remains
-- owner-private in user_state; this separate index is used only for aggregates.
create table if not exists public.final_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_key text not null,
  major_key text,
  degree_level text check (degree_level in ('bachelor', 'master', 'phd')),
  study_year smallint check (study_year between 1 and 8),
  snapshot jsonb not null,
  analytics_consent boolean not null default false,
  finalized_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.final_course_choices (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_key text not null,
  course_name text not null,
  course_code text,
  credits numeric(6,2) not null default 0,
  primary key (user_id, course_key)
);

create index if not exists final_schedules_cohort_idx
  on public.final_schedules (school_key, major_key, study_year, analytics_consent);
create index if not exists final_course_choices_course_idx
  on public.final_course_choices (course_key, user_id);

alter table public.final_schedules enable row level security;
alter table public.final_course_choices enable row level security;
grant select on table public.final_schedules to authenticated;
grant select on table public.final_course_choices to authenticated;

drop policy if exists "Users can read their own finalized schedule" on public.final_schedules;
create policy "Users can read their own finalized schedule"
on public.final_schedules for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own finalized course choices" on public.final_course_choices;
create policy "Users can read their own finalized course choices"
on public.final_course_choices for select to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on table public.final_schedules from anon, authenticated;
revoke insert, update, delete on table public.final_course_choices from anon, authenticated;

create or replace function public.sync_final_schedule(p_snapshot jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text;
  caller_major text;
  consent boolean := false;
  course_record jsonb;
  normalized_course_key text;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object'
     or jsonb_typeof(p_snapshot -> 'courses') is distinct from 'array' then
    raise exception 'Invalid final timetable';
  end if;
  if jsonb_array_length(p_snapshot -> 'courses') > 40 then
    raise exception 'A final timetable cannot contain more than 40 courses';
  end if;

  select m.school_key, public.normalized_school_key(p.major_of_study), coalesce(mp.analytics_consent, false)
  into caller_school, caller_major, consent
  from public.school_memberships m
  left join public.profiles p on p.user_id = m.user_id
  left join public.member_profiles mp on mp.user_id = m.user_id
  where m.user_id = caller;

  if caller_school is null then raise exception 'School membership setup required'; end if;

  insert into public.final_schedules (
    user_id, school_key, major_key, degree_level, study_year,
    snapshot, analytics_consent, finalized_at, updated_at
  ) values (
    caller,
    caller_school,
    caller_major,
    nullif(p_snapshot ->> 'degreeLevel', ''),
    nullif(p_snapshot ->> 'studyYear', '')::smallint,
    p_snapshot,
    consent,
    coalesce(nullif(p_snapshot ->> 'savedAt', '')::timestamptz, now()),
    now()
  )
  on conflict (user_id) do update set
    school_key = excluded.school_key,
    major_key = excluded.major_key,
    degree_level = excluded.degree_level,
    study_year = excluded.study_year,
    snapshot = excluded.snapshot,
    analytics_consent = excluded.analytics_consent,
    finalized_at = excluded.finalized_at,
    updated_at = now();

  delete from public.final_course_choices where user_id = caller;
  for course_record in select value from jsonb_array_elements(p_snapshot -> 'courses')
  loop
    normalized_course_key := public.normalized_school_key(
      concat(
        coalesce(nullif(trim(course_record ->> 'code'), ''), 'no-code'),
        '|',
        trim(coalesce(course_record ->> 'name', ''))
      )
    );
    if normalized_course_key is not null and char_length(trim(coalesce(course_record ->> 'name', ''))) > 0 then
      insert into public.final_course_choices (user_id, course_key, course_name, course_code, credits)
      values (
        caller,
        left(normalized_course_key, 220),
        left(trim(course_record ->> 'name'), 220),
        nullif(left(trim(coalesce(course_record ->> 'code', '')), 80), ''),
        greatest(0, least(99, coalesce(nullif(course_record ->> 'credits', '')::numeric, 0)))
      )
      on conflict (user_id, course_key) do update set
        course_name = excluded.course_name,
        course_code = excluded.course_code,
        credits = excluded.credits;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.sync_final_schedule(jsonb) from public;
grant execute on function public.sync_final_schedule(jsonb) to authenticated;

create or replace function public.get_course_choice_stats(
  p_scope text default 'same_major_year',
  p_study_year smallint default null
)
returns table (
  course_key text,
  course_name text,
  course_code text,
  selection_count bigint,
  cohort_size bigint,
  share_percent numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text;
  caller_major text;
  caller_year smallint;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_scope not in ('same_major_year', 'same_major', 'university_year', 'university') then
    raise exception 'Invalid analytics scope';
  end if;
  if p_study_year is not null and p_study_year not between 1 and 8 then
    raise exception 'Invalid study year';
  end if;

  select m.school_key, public.normalized_school_key(p.major_of_study), p.study_year
  into caller_school, caller_major, caller_year
  from public.school_memberships m
  left join public.profiles p on p.user_id = m.user_id
  where m.user_id = caller and m.status = 'verified';

  if caller_school is null then raise exception 'Verified school membership required'; end if;

  return query
  with eligible as (
    select fs.user_id
    from public.final_schedules fs
    join public.school_memberships sm on sm.user_id = fs.user_id
    join public.member_profiles mp on mp.user_id = fs.user_id
    where fs.school_key = caller_school
      and sm.school_key = caller_school
      and sm.status = 'verified'
      and fs.analytics_consent = true
      and mp.analytics_consent = true
      and (p_scope in ('university_year', 'university') or fs.major_key = caller_major)
      and (
        case
          when p_scope = 'same_major_year' then fs.study_year = coalesce(p_study_year, caller_year)
          when p_scope = 'university_year' then fs.study_year = coalesce(p_study_year, caller_year)
          else true
        end
      )
  ), cohort as (
    select count(*)::bigint as size from eligible
  ), aggregate_courses as (
    select
      fc.course_key,
      max(fc.course_name) as course_name,
      max(fc.course_code) as course_code,
      count(distinct fc.user_id)::bigint as selection_count
    from public.final_course_choices fc
    join eligible e on e.user_id = fc.user_id
    group by fc.course_key
  )
  select
    ac.course_key,
    ac.course_name,
    ac.course_code,
    greatest(5, (round(ac.selection_count::numeric / 5) * 5)::bigint),
    greatest(5, (round(c.size::numeric / 5) * 5)::bigint),
    round(round(((ac.selection_count::numeric / nullif(c.size, 0)::numeric) * 100) / 5) * 5, 0)
  from aggregate_courses ac
  cross join cohort c
  where c.size >= 5 and ac.selection_count >= 5
  order by ac.selection_count desc, ac.course_name
  limit 12;
end;
$$;

revoke all on function public.get_course_choice_stats(text, smallint) from public;
grant execute on function public.get_course_choice_stats(text, smallint) to authenticated;

-- School-scoped campus community. Browser clients use the narrow RPCs below;
-- the underlying posts, likes, reports, and blocks are not directly readable.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.verified_school_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select school_key
  from public.school_memberships
  where user_id = (select auth.uid()) and status = 'verified';
$$;

revoke all on function private.verified_school_key() from public, anon, authenticated;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  school_key text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 6),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Rich posts may be media-only or poll-only. The legacy publisher below still
-- requires body text, while the v2 publisher enforces that at least one content
-- type is present before an empty body is stored.
alter table public.community_posts
  drop constraint if exists community_posts_body_check;
alter table public.community_posts
  add constraint community_posts_body_check
  check (char_length(trim(body)) between 0 and 1200);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Community media metadata is kept in Postgres while the binary object stays
-- in the private community-media Storage bucket. Object names are deliberately
-- deterministic so a published row can reference exactly one uploaded object.
create table if not exists public.community_post_media (
  id uuid primary key,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null check (
    (media_type = 'image' and mime_type in ('image/webp', 'image/jpeg', 'image/png'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  ),
  width integer check (width between 1 and 8192),
  height integer check (height between 1 and 8192),
  duration_seconds numeric check (duration_seconds > 0 and duration_seconds <= 3600),
  alt_text text check (char_length(alt_text) <= 300),
  position smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (post_id, position),
  check (
    storage_path = owner_id::text || '/posts/' || draft_id::text || '/' || id::text ||
      case mime_type
        when 'image/webp' then '.webp'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'video/mp4' then '.mp4'
        when 'video/webm' then '.webm'
        when 'video/quicktime' then '.mov'
      end
  ),
  check (
    (media_type = 'image' and duration_seconds is null)
    or media_type = 'video'
  )
);

-- Upgrade older installations whose inline media checks allowed WebP only.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.community_post_media'::regclass
      and constraint_record.contype = 'c'
      and (
        pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%storage_path%'
        or (
          pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%mime_type%'
          and pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%media_type%'
        )
      )
  loop
    execute format('alter table public.community_post_media drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.community_post_media
  add constraint community_post_media_mime_supported check (
    (media_type = 'image' and mime_type in ('image/webp', 'image/jpeg', 'image/png'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  );
alter table public.community_post_media
  add constraint community_post_media_storage_path_matches check (
    storage_path = owner_id::text || '/posts/' || draft_id::text || '/' || id::text ||
      case mime_type
        when 'image/webp' then '.webp'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'video/mp4' then '.mp4'
        when 'video/webm' then '.webm'
        when 'video/quicktime' then '.mov'
      end
  );

create table if not exists public.community_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.community_posts(id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists public.community_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.community_polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  position smallint not null check (position between 0 and 9),
  created_at timestamptz not null default now(),
  unique (poll_id, position),
  unique (poll_id, id)
);

create table if not exists public.community_poll_votes (
  poll_id uuid not null,
  option_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, option_id)
    references public.community_poll_options(poll_id, id) on delete cascade
);

create table if not exists public.post_bookmarks (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'message', 'user')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists community_posts_school_created_idx
  on public.community_posts (school_key, created_at desc) where deleted_at is null;
create index if not exists community_posts_author_created_idx
  on public.community_posts (author_id, created_at desc);
create index if not exists community_comments_post_created_idx
  on public.community_comments (post_id, created_at) where deleted_at is null;
create index if not exists community_comments_author_created_idx
  on public.community_comments (author_id, created_at desc);
create index if not exists community_post_media_post_position_idx
  on public.community_post_media (post_id, position);
create index if not exists community_post_media_owner_created_idx
  on public.community_post_media (owner_id, created_at desc);
create index if not exists community_poll_votes_user_created_idx
  on public.community_poll_votes (user_id, created_at desc);
create index if not exists community_poll_votes_option_idx
  on public.community_poll_votes (poll_id, option_id);
create index if not exists post_bookmarks_user_created_idx
  on public.post_bookmarks (user_id, created_at desc);
create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);
create index if not exists content_reports_status_created_idx
  on public.content_reports (status, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.community_post_media enable row level security;
alter table public.community_polls enable row level security;
alter table public.community_poll_options enable row level security;
alter table public.community_poll_votes enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.content_reports enable row level security;
alter table public.user_blocks enable row level security;

revoke all on table public.community_posts from anon, authenticated;
revoke all on table public.community_comments from anon, authenticated;
revoke all on table public.post_likes from anon, authenticated;
revoke all on table public.community_post_media from anon, authenticated;
revoke all on table public.community_polls from anon, authenticated;
revoke all on table public.community_poll_options from anon, authenticated;
revoke all on table public.community_poll_votes from anon, authenticated;
revoke all on table public.post_bookmarks from anon, authenticated;
revoke all on table public.content_reports from anon, authenticated;
revoke all on table public.user_blocks from anon, authenticated;

-- Profile avatars use private, versioned WebP objects. A new object is written
-- before the member_profiles pointer changes, so a failed database save cannot
-- replace the currently visible avatar. The legacy /avatar.webp path remains
-- readable until an existing user replaces it.
-- private so the profile_visibility, verified-school, and blocking rules are
-- enforced for every authenticated download rather than bypassed by a public
-- object URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-avatars',
  'member-avatars',
  false,
  2097152,
  array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- This helper is deliberately narrow: it returns only an authorization
-- decision and does not expose school keys, profile details, or block rows.
-- A schoolmate may read only the exact object currently referenced by the
-- target profile; superseded or removed objects remain owner-only.
drop policy if exists "Verified schoolmates can read visible avatars" on storage.objects;
drop function if exists public.can_view_member_avatar(text);
create or replace function public.can_view_member_avatar(p_owner_id text, p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_owner_id = (select auth.uid())::text, false)
    or exists (
      select 1
      from public.school_memberships viewer
      join public.school_memberships target
        on target.school_key = viewer.school_key
       and target.status = 'verified'
      join public.member_profiles member
        on member.user_id = target.user_id
       and member.profile_visibility = 'school'
       and member.avatar_path = p_object_path
      where viewer.user_id = (select auth.uid())
        and viewer.status = 'verified'
        and target.user_id::text = p_owner_id
        and not exists (
          select 1
          from public.user_blocks block
          where (block.blocker_id = viewer.user_id and block.blocked_id = target.user_id)
             or (block.blocker_id = target.user_id and block.blocked_id = viewer.user_id)
        )
    );
$$;

revoke all on function public.can_view_member_avatar(text, text) from public, anon, authenticated;
grant execute on function public.can_view_member_avatar(text, text) to authenticated;

-- Never let an ambiguous client response remove the avatar that a committed
-- profile row already references. Unreferenced and superseded owner objects
-- remain removable, including after membership verification is revoked.
create or replace function public.can_delete_member_avatar(p_owner_id text, p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_owner_id = (select auth.uid())::text, false)
    and not exists (
      select 1
      from public.member_profiles member
      where member.user_id::text = p_owner_id
        and member.avatar_path = p_object_path
    );
$$;

revoke all on function public.can_delete_member_avatar(text, text) from public, anon, authenticated;
grant execute on function public.can_delete_member_avatar(text, text) to authenticated;

-- Serialize and bound avatar uploads per account. This prevents a modified
-- browser client from filling the private bucket with unlimited abandoned
-- versions while still leaving enough room for safe replacement retries.
create or replace function public.can_upload_member_avatar(p_owner_id text, p_object_path text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  object_count integer := 0;
  total_bytes bigint := 0;
begin
  if caller is null
     or p_owner_id is distinct from caller::text
     or p_object_path not like caller::text || '/%' then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:avatar:' || caller::text, 0)
  );

  select
    count(*)::integer,
    coalesce(sum(
      case when coalesce(object.metadata->>'size', '') ~ '^[0-9]+$'
        then (object.metadata->>'size')::bigint else 0 end
    ), 0)::bigint
  into object_count, total_bytes
  from storage.objects object
  where object.bucket_id = 'member-avatars'
    and object.owner_id = caller::text;

  return object_count < 8 and total_bytes < 16777216;
end;
$$;

revoke all on function public.can_upload_member_avatar(text, text) from public, anon, authenticated;
grant execute on function public.can_upload_member_avatar(text, text) to authenticated;

drop policy if exists "Avatar owners can upload" on storage.objects;
create policy "Avatar owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-avatars'
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
  and public.can_upload_member_avatar((storage.foldername(name))[1], name)
);

-- Owner SELECT access is also required for upload RETURNING metadata and for
-- replacing the stable object path with Storage upsert.
drop policy if exists "Avatar owners can read" on storage.objects;
create policy "Avatar owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
);

drop policy if exists "Avatar owners can replace" on storage.objects;
create policy "Avatar owners can replace"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
)
with check (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
);

drop policy if exists "Avatar owners can delete" on storage.objects;
create policy "Avatar owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id = (select auth.uid())::text
  and (
    name = (select auth.uid())::text || '/avatar.webp'
    or name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
  and public.can_delete_member_avatar(owner_id, name)
);

-- Schoolmates may fetch an avatar but cannot list the bucket. The object must
-- retain the path assigned to its authenticated owner, and the helper repeats
-- every verified-school, visibility, and bilateral block check.
drop policy if exists "Verified schoolmates can read visible avatars" on storage.objects;
create policy "Verified schoolmates can read visible avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'member-avatars'
  and owner_id is not null
  and (
    name = owner_id || '/avatar.webp'
    or name ~ ('^' || owner_id || '/avatar-[0-9a-f-]{36}\.(webp|jpg|png)$')
  )
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated'
  ])
  and public.can_view_member_avatar(owner_id, name)
);

-- Community attachments are private objects. The client generates a media UUID
-- before upload and must use the exact path
-- <user-id>/posts/<draft-id>/<media-id>.<extension>.
-- A 40 MiB object limit supports normalized browser-compatible images and short campus videos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  false,
  41943040,
  array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only an exact media row on a currently visible post may be downloaded by a
-- schoolmate. This helper returns an authorization decision without exposing
-- school keys, block rows, or unpublished media metadata.
create or replace function public.can_view_community_media(p_owner_id text, p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_owner_id = (select auth.uid())::text, false)
    or exists (
      select 1
      from public.community_post_media media
      join public.community_posts post
        on post.id = media.post_id
       and post.status = 'published'
       and post.deleted_at is null
      join public.school_memberships viewer
        on viewer.user_id = (select auth.uid())
       and viewer.school_key = post.school_key
       and viewer.status = 'verified'
      join public.school_memberships author_membership
        on author_membership.user_id = post.author_id
       and author_membership.school_key = post.school_key
       and author_membership.status = 'verified'
      where media.owner_id::text = p_owner_id
        and media.storage_path = p_object_path
        and media.owner_id = post.author_id
        and not exists (
          select 1
          from public.user_blocks block
          where (block.blocker_id = viewer.user_id and block.blocked_id = post.author_id)
             or (block.blocker_id = post.author_id and block.blocked_id = viewer.user_id)
        )
    );
$$;

revoke all on function public.can_view_community_media(text, text) from public, anon, authenticated;
grant execute on function public.can_view_community_media(text, text) to authenticated;

-- Failed uploads have no metadata row and may be removed immediately. Once an
-- object is referenced, deletion is held until its owner soft-deletes the post;
-- this avoids a timed-out publish response accidentally breaking a live post.
create or replace function public.can_delete_community_media(p_owner_id text, p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p_owner_id = (select auth.uid())::text, false)
    and not exists (
      select 1
      from public.community_post_media media
      join public.community_posts post on post.id = media.post_id
      where media.owner_id::text = p_owner_id
        and media.storage_path = p_object_path
        and post.author_id = media.owner_id
        and post.deleted_at is null
    );
$$;

revoke all on function public.can_delete_community_media(text, text) from public, anon, authenticated;
grant execute on function public.can_delete_community_media(text, text) to authenticated;

-- Uploads are serialized and bounded before any Storage cost is incurred.
-- Besides verified membership, each owner is limited to 40 objects/hour,
-- eight unpublished objects, 500 total objects, and 2 GiB of stored media.
-- Owner read/delete policies intentionally do not use this helper, so a member
-- whose verification is later revoked can still clean old files.
drop policy if exists "Community media owners can upload" on storage.objects;
drop function if exists public.can_upload_community_media();
create or replace function public.can_upload_community_media(p_owner_id text, p_object_path text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  object_count integer := 0;
  recent_count integer := 0;
  unreferenced_count integer := 0;
  total_bytes bigint := 0;
begin
  if caller is null
     or p_owner_id is distinct from caller::text
     or p_object_path not like caller::text || '/posts/%'
     or not exists (
       select 1
       from public.school_memberships membership
       where membership.user_id = caller
         and membership.status = 'verified'
     ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:community-media:' || caller::text, 0)
  );

  select
    count(*)::integer,
    count(*) filter (where object.created_at >= now() - interval '1 hour')::integer,
    count(*) filter (
      where not exists (
        select 1
        from public.community_post_media media
        where media.owner_id = caller
          and media.storage_path = object.name
      )
    )::integer,
    coalesce(sum(
      case when coalesce(object.metadata->>'size', '') ~ '^[0-9]+$'
        then (object.metadata->>'size')::bigint else 0 end
    ), 0)::bigint
  into object_count, recent_count, unreferenced_count, total_bytes
  from storage.objects object
  where object.bucket_id = 'community-media'
    and object.owner_id = caller::text;

  return object_count < 500
    and recent_count < 40
    and unreferenced_count < 8
    and total_bytes < 2147483648;
end;
$$;

revoke all on function public.can_upload_community_media(text, text) from public, anon, authenticated;
grant execute on function public.can_upload_community_media(text, text) to authenticated;

drop policy if exists "Community media owners can upload" on storage.objects;
create policy "Community media owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and public.can_upload_community_media((storage.foldername(name))[1], name)
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

-- Owner reads cover upload RETURNING metadata and safe cleanup of an upload
-- whose publish transaction failed before creating a media reference.
drop policy if exists "Community media owners can read" on storage.objects;
create policy "Community media owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Community media owners can replace" on storage.objects;
-- Published objects are immutable. Failed drafts are retried with a new media
-- UUID, while the owner delete policy below can always remove the old object.

-- Storage cleanup remains possible for an unreferenced upload and after a post
-- is soft-deleted or its database children cascade away.
drop policy if exists "Community media owners can delete" on storage.objects;
create policy "Community media owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and public.can_delete_community_media(owner_id, name)
);

drop policy if exists "Verified schoolmates can read community media" on storage.objects;
create policy "Verified schoolmates can read community media"
on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and owner_id is not null
  and name ~ (
    '^' || owner_id ||
    '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated',
    'storage.object.sign'
  ])
  and public.can_view_community_media(owner_id, name)
);

create or replace function public.publish_community_post(p_body text, p_tags text[] default '{}'::text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1200 then raise exception 'Post must contain 1 to 1200 characters'; end if;
  if cardinality(coalesce(p_tags, '{}'::text[])) > 6
     or exists (select 1 from unnest(coalesce(p_tags, '{}'::text[])) tag where char_length(trim(tag)) not between 1 and 30) then
    raise exception 'Use up to 6 tags of 30 characters each';
  end if;
  if (select count(*) from public.community_posts where author_id = caller and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Please wait before publishing another post';
  end if;

  insert into public.community_posts (school_key, author_id, body, tags)
  values (caller_school, caller, trim(p_body), coalesce(p_tags, '{}'::text[]))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.publish_community_post(text, text[]) from public;
grant execute on function public.publish_community_post(text, text[]) to authenticated;

-- Rich publisher used by the upgraded community composer. The original
-- two-argument function above remains available to older clients.
create or replace function public.publish_community_post_v2(
  p_body text,
  p_tags text[],
  p_media jsonb,
  p_poll_question text,
  p_poll_options text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_id uuid;
  new_poll_id uuid;
  media_item jsonb;
  media_id uuid;
  media_draft_id uuid;
  post_draft_id uuid;
  media_path text;
  media_kind text;
  media_mime text;
  media_alt text;
  media_position smallint;
  expected_suffix text;
  seen_media_ids uuid[] := '{}'::uuid[];
  seen_positions smallint[] := '{}'::smallint[];
  option_item record;
  normalized_poll_options text[] := coalesce(p_poll_options, '{}'::text[]);
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_body, ''))) > 1200 then
    raise exception 'Post must contain no more than 1200 characters';
  end if;
  if cardinality(coalesce(p_tags, '{}'::text[])) > 6
     or exists (
       select 1
       from unnest(coalesce(p_tags, '{}'::text[])) tag
       where tag is null or char_length(trim(tag)) not between 1 and 30
     ) then
    raise exception 'Use up to 6 tags of 30 characters each';
  end if;
  if (select count(*) from public.community_posts where author_id = caller and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Please wait before publishing another post';
  end if;

  if p_media is not null and jsonb_typeof(p_media) <> 'array' then
    raise exception 'Media must be a JSON array';
  end if;
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > 4 then
    raise exception 'A post can contain up to 4 media items';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0
     and jsonb_array_length(coalesce(p_media, '[]'::jsonb)) = 0
     and char_length(trim(coalesce(p_poll_question, ''))) = 0 then
    raise exception 'Add text, media, or a poll before publishing';
  end if;

  if char_length(trim(coalesce(p_poll_question, ''))) = 0 then
    if cardinality(normalized_poll_options) > 0 then
      raise exception 'A poll question is required when options are supplied';
    end if;
  else
    if char_length(trim(p_poll_question)) > 240 then
      raise exception 'Poll question must contain no more than 240 characters';
    end if;
    if cardinality(normalized_poll_options) not between 2 and 10 then
      raise exception 'A poll must contain 2 to 10 options';
    end if;
    if exists (
      select 1
      from unnest(normalized_poll_options) option_label
      where option_label is null or char_length(trim(option_label)) not between 1 and 120
    ) then
      raise exception 'Poll options must contain 1 to 120 characters';
    end if;
    if (
      select count(*) <> count(distinct lower(trim(option_label)))
      from unnest(normalized_poll_options) option_label
    ) then
      raise exception 'Poll options must be unique';
    end if;
  end if;

  insert into public.community_posts (school_key, author_id, body, tags)
  values (caller_school, caller, trim(coalesce(p_body, '')), coalesce(p_tags, '{}'::text[]))
  returning id into new_id;

  for media_item in
    select media_rows.value
    from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) as media_rows(value)
  loop
    if jsonb_typeof(media_item) <> 'object' then
      raise exception 'Each media item must be a JSON object';
    end if;

    media_path := nullif(trim(media_item ->> 'storage_path'), '');
    media_kind := lower(nullif(trim(media_item ->> 'media_type'), ''));
    media_mime := lower(nullif(trim(media_item ->> 'mime_type'), ''));
    media_alt := nullif(trim(media_item ->> 'alt_text'), '');

    begin
      media_position := (media_item ->> 'position')::smallint;
    exception when others then
      raise exception 'Media position must be an integer from 0 to 3';
    end;

    if media_path is null or media_path !~ (
      '^' || caller::text ||
      '/posts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
    ) then
      raise exception 'Media path must use the signed-in user, draft, and media UUIDs';
    end if;
    if media_position is null or media_position not between 0 and 3 then
      raise exception 'Media position must be an integer from 0 to 3';
    end if;
    if media_position = any(seen_positions) then
      raise exception 'Media positions must be unique';
    end if;
    seen_positions := array_append(seen_positions, media_position);

    if media_kind = 'image' and media_mime = 'image/webp' then
      expected_suffix := '.webp';
    elsif media_kind = 'image' and media_mime = 'image/jpeg' then
      expected_suffix := '.jpg';
    elsif media_kind = 'image' and media_mime = 'image/png' then
      expected_suffix := '.png';
    elsif media_kind = 'video' and media_mime = 'video/mp4' then
      expected_suffix := '.mp4';
    elsif media_kind = 'video' and media_mime = 'video/webm' then
      expected_suffix := '.webm';
    elsif media_kind = 'video' and media_mime = 'video/quicktime' then
      expected_suffix := '.mov';
    else
      raise exception 'Unsupported community media type';
    end if;
    if media_alt is not null and char_length(media_alt) > 300 then
      raise exception 'Media description must contain no more than 300 characters';
    end if;

    begin
      media_draft_id := split_part(media_path, '/', 3)::uuid;
      media_id := split_part(split_part(media_path, '/', 4), '.', 1)::uuid;
    exception when others then
      raise exception 'Media path contains an invalid draft or media UUID';
    end;
    if post_draft_id is null then
      post_draft_id := media_draft_id;
    elsif post_draft_id <> media_draft_id then
      raise exception 'All media items must belong to the same post draft';
    end if;
    if media_id = any(seen_media_ids) then
      raise exception 'Media IDs must be unique';
    end if;
    seen_media_ids := array_append(seen_media_ids, media_id);
    if media_path <> caller::text || '/posts/' || media_draft_id::text || '/' || media_id::text || expected_suffix then
      raise exception 'Media path extension does not match its MIME type';
    end if;
    if not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'community-media'
        and object.name = media_path
        and object.owner_id = caller::text
    ) then
      raise exception 'Upload each media object before publishing the post';
    end if;

    insert into public.community_post_media (
      id, post_id, owner_id, draft_id, storage_path, media_type, mime_type, alt_text, position
    )
    values (
      media_id, new_id, caller, media_draft_id, media_path, media_kind, media_mime, media_alt, media_position
    );
  end loop;

  if char_length(trim(coalesce(p_poll_question, ''))) > 0 then
    insert into public.community_polls (post_id, question)
    values (new_id, trim(p_poll_question))
    returning id into new_poll_id;

    for option_item in
      select trim(option_label) as label, (ordinality - 1)::smallint as position
      from unnest(normalized_poll_options) with ordinality as option_rows(option_label, ordinality)
    loop
      insert into public.community_poll_options (poll_id, label, position)
      values (new_poll_id, option_item.label, option_item.position);
    end loop;
  end if;

  return new_id;
end;
$$;

revoke all on function public.publish_community_post_v2(text, text[], jsonb, text, text[]) from public, anon, authenticated;
grant execute on function public.publish_community_post_v2(text, text[], jsonb, text, text[]) to authenticated;

-- Media, poll, bookmark, avatar, saved-feed, and deep-link fields change this
-- RPC's contract. Drop both the legacy and current identities so the setup is
-- safe to rerun after either database version.
drop function if exists public.get_school_feed(integer, integer);
drop function if exists public.get_school_feed(integer, integer, boolean, uuid);
create or replace function public.get_school_feed(
  p_limit integer default 30,
  p_offset integer default 0,
  p_bookmarked_only boolean default false,
  p_post_id uuid default null
)
returns table (
  post_id uuid,
  author_id uuid,
  author_username text,
  display_name text,
  avatar_path text,
  avatar_revision bigint,
  major_of_study text,
  body text,
  tags text[],
  media jsonb,
  poll jsonb,
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  bookmarked_by_me boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;

  return query
  select
    post.id,
    post.author_id,
    profile.username,
    case when member.profile_visibility = 'school' then member.display_name else null end,
    case when member.profile_visibility = 'school' then member.avatar_path else null end,
    case when member.profile_visibility = 'school' then member.avatar_revision else null end,
    case when member.profile_visibility = 'school' then profile.major_of_study else null end,
    post.body,
    post.tags,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'storage_path', attachment.storage_path,
            'media_type', attachment.media_type,
            'mime_type', attachment.mime_type,
            'alt_text', attachment.alt_text,
            'position', attachment.position
          )
          order by attachment.position
        )
        from public.community_post_media attachment
        where attachment.post_id = post.id
          and attachment.owner_id = post.author_id
      ),
      '[]'::jsonb
    ),
    (
      select jsonb_build_object(
        'poll_id', community_poll.id,
        'question', community_poll.question,
        'total_votes', (
          select count(*)
          from public.community_poll_votes poll_vote
          where poll_vote.poll_id = community_poll.id
        ),
        'selected_option_id', (
          select poll_vote.option_id
          from public.community_poll_votes poll_vote
          where poll_vote.poll_id = community_poll.id
            and poll_vote.user_id = caller
        ),
        'options', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'option_id', poll_option.id,
                'label', poll_option.label,
                'vote_count', (
                  select count(*)
                  from public.community_poll_votes option_vote
                  where option_vote.poll_id = community_poll.id
                    and option_vote.option_id = poll_option.id
                )
              )
              order by poll_option.position
            )
            from public.community_poll_options poll_option
            where poll_option.poll_id = community_poll.id
          ),
          '[]'::jsonb
        )
      )
      from public.community_polls community_poll
      where community_poll.post_id = post.id
    ),
    post.created_at,
    (select count(*) from public.post_likes likes where likes.post_id = post.id),
    (
      select count(*)
      from public.community_comments comments
      join public.school_memberships comment_membership
        on comment_membership.user_id = comments.author_id
       and comment_membership.school_key = caller_school
       and comment_membership.status = 'verified'
      where comments.post_id = post.id
        and comments.status = 'published'
        and comments.deleted_at is null
        and not exists (
          select 1 from public.user_blocks comment_block
          where (comment_block.blocker_id = caller and comment_block.blocked_id = comments.author_id)
             or (comment_block.blocker_id = comments.author_id and comment_block.blocked_id = caller)
        )
    ),
    exists (select 1 from public.post_likes mine where mine.post_id = post.id and mine.user_id = caller),
    exists (select 1 from public.post_bookmarks saved where saved.post_id = post.id and saved.user_id = caller)
  from public.community_posts post
  join public.profiles profile on profile.user_id = post.author_id
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = caller_school
   and author_membership.status = 'verified'
  left join public.member_profiles member on member.user_id = post.author_id
  where post.school_key = caller_school
    and post.status = 'published'
    and post.deleted_at is null
    and (p_post_id is null or post.id = p_post_id)
    and (
      not coalesce(p_bookmarked_only, false)
      or exists (
        select 1
        from public.post_bookmarks saved_filter
        where saved_filter.post_id = post.id
          and saved_filter.user_id = caller
      )
    )
    and not exists (
      select 1 from public.user_blocks block
      where (block.blocker_id = caller and block.blocked_id = post.author_id)
         or (block.blocker_id = post.author_id and block.blocked_id = caller)
    )
  order by post.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_school_feed(integer, integer, boolean, uuid) from public, anon, authenticated;
grant execute on function public.get_school_feed(integer, integer, boolean, uuid) to authenticated;

-- avatar_path and the opt-in WeChat value extend the RPC return type.
drop function if exists public.get_schoolmate_profile(uuid);
create or replace function public.get_schoolmate_profile(p_user_id uuid)
returns table (
  username text,
  display_name text,
  major_of_study text,
  degree_level text,
  study_year smallint,
  bio text,
  interests text[],
  avatar_path text,
  avatar_revision bigint,
  instagram_url text,
  linkedin_url text,
  wechat_id text,
  website_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if not exists (
    select 1 from public.school_memberships membership
    where membership.user_id = p_user_id
      and membership.school_key = caller_school
      and membership.status = 'verified'
  ) then raise exception 'Campus profile is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = p_user_id)
       or (block.blocker_id = p_user_id and block.blocked_id = caller)
  ) then raise exception 'Campus profile is unavailable'; end if;

  return query
  select
    profile.username,
    member.display_name,
    profile.major_of_study,
    profile.degree_level,
    profile.study_year,
    member.bio,
    member.interests,
    member.avatar_path,
    member.avatar_revision,
    member.instagram_url,
    member.linkedin_url,
    case when member.share_wechat then member.wechat_id else null end,
    member.website_url
  from public.profiles profile
  join public.member_profiles member on member.user_id = profile.user_id
  where profile.user_id = p_user_id
    and (p_user_id = caller or member.profile_visibility = 'school');
end;
$$;

revoke all on function public.get_schoolmate_profile(uuid) from public;
grant execute on function public.get_schoolmate_profile(uuid) to authenticated;

-- Provider connection badges are computed directly from Supabase Auth's
-- trusted identity records. The browser cannot create or edit these records,
-- and this RPC never reveals a provider subject, email address, or token.
create or replace function public.get_schoolmate_connection_badges(p_user_id uuid)
returns table (
  linkedin_connected boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller is null or caller_school is null then
    raise exception 'Verified school membership required';
  end if;
  if not exists (
    select 1
    from public.school_memberships membership
    where membership.user_id = p_user_id
      and membership.school_key = caller_school
      and membership.status = 'verified'
  ) then
    raise exception 'Campus profile is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = p_user_id)
       or (block.blocker_id = p_user_id and block.blocked_id = caller)
  ) then
    raise exception 'Campus profile is unavailable';
  end if;
  return query
  select
    exists (
      select 1
      from auth.identities linked_identity
      where linked_identity.user_id = p_user_id
        and linked_identity.provider = 'linkedin_oidc'
    )
  from public.profiles profile
  join public.member_profiles member on member.user_id = profile.user_id
  where profile.user_id = p_user_id
    and (p_user_id = caller or member.profile_visibility = 'school');
end;
$$;

revoke all on function public.get_schoolmate_connection_badges(uuid) from public, anon, authenticated;
grant execute on function public.get_schoolmate_connection_badges(uuid) to authenticated;

-- New clients use an allowlisted provider array so additional authenticated
-- connections do not require a new database column or a changing return type.
-- This intentionally returns only provider names, never provider subjects,
-- email addresses, identity metadata, access tokens, or timestamps.
create or replace function public.get_schoolmate_connected_providers(p_user_id uuid)
returns table (
  connected_providers text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller is null or caller_school is null then
    raise exception 'Verified school membership required';
  end if;
  if not exists (
    select 1
    from public.school_memberships membership
    where membership.user_id = p_user_id
      and membership.school_key = caller_school
      and membership.status = 'verified'
  ) then
    raise exception 'Campus profile is unavailable';
  end if;
  if exists (
    select 1
    from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = p_user_id)
       or (block.blocker_id = p_user_id and block.blocked_id = caller)
  ) then
    raise exception 'Campus profile is unavailable';
  end if;

  return query
  select coalesce(
    array_agg(distinct linked_identity.provider::text order by linked_identity.provider::text)
      filter (where linked_identity.provider is not null),
    '{}'::text[]
  )
  from public.profiles profile
  join public.member_profiles member on member.user_id = profile.user_id
  left join auth.identities linked_identity
    on linked_identity.user_id = profile.user_id
   and linked_identity.provider in ('google', 'github', 'linkedin_oidc')
  where profile.user_id = p_user_id
    and (p_user_id = caller or member.profile_visibility = 'school')
  group by profile.user_id;
end;
$$;

revoke all on function public.get_schoolmate_connected_providers(uuid) from public, anon, authenticated;
grant execute on function public.get_schoolmate_connected_providers(uuid) to authenticated;

-- Website owners can audit connected providers in Authentication > Users in
-- the Supabase dashboard. Keep auth.identities inaccessible to site clients.

create or replace function public.toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select author_id into post_author
  from public.community_posts
  where id = p_post_id and school_key = caller_school and status = 'published' and deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  delete from public.post_likes where post_id = p_post_id and user_id = caller;
  if found then return false; end if;
  insert into public.post_likes (post_id, user_id) values (p_post_id, caller);
  return true;
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public;
grant execute on function public.toggle_post_like(uuid) to authenticated;

create or replace function public.toggle_post_bookmark(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;

  select post.author_id into post_author
  from public.community_posts post
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = caller_school
   and author_membership.status = 'verified'
  where post.id = p_post_id
    and post.school_key = caller_school
    and post.status = 'published'
    and post.deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  delete from public.post_bookmarks
  where post_id = p_post_id and user_id = caller;
  if found then return false; end if;

  insert into public.post_bookmarks (post_id, user_id)
  values (p_post_id, caller);
  return true;
end;
$$;

revoke all on function public.toggle_post_bookmark(uuid) from public, anon, authenticated;
grant execute on function public.toggle_post_bookmark(uuid) to authenticated;

create or replace function public.vote_community_poll(p_poll_id uuid, p_option_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_poll_id is null or p_option_id is null then raise exception 'Choose a poll option'; end if;

  select post.author_id into post_author
  from public.community_polls poll
  join public.community_posts post on post.id = poll.post_id
  join public.school_memberships author_membership
    on author_membership.user_id = post.author_id
   and author_membership.school_key = caller_school
   and author_membership.status = 'verified'
  where poll.id = p_poll_id
    and post.school_key = caller_school
    and post.status = 'published'
    and post.deleted_at is null;
  if post_author is null then raise exception 'Poll is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Poll is unavailable'; end if;
  if not exists (
    select 1
    from public.community_poll_options poll_option
    where poll_option.poll_id = p_poll_id and poll_option.id = p_option_id
  ) then raise exception 'Poll option is unavailable'; end if;

  insert into public.community_poll_votes (poll_id, option_id, user_id)
  values (p_poll_id, p_option_id, caller)
  on conflict (poll_id, user_id) do update set
    option_id = excluded.option_id,
    created_at = now();
  return true;
end;
$$;

revoke all on function public.vote_community_poll(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vote_community_poll(uuid, uuid) to authenticated;

create or replace function public.get_post_comments(p_post_id uuid)
returns table (
  comment_id uuid,
  author_id uuid,
  author_username text,
  display_name text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select author_id into post_author from public.community_posts
  where id = p_post_id and school_key = caller_school and status = 'published' and deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  return query
  with recent_comments as (
    select
      comment.id,
      comment.author_id,
      profile.username,
      case when member.profile_visibility = 'school' then member.display_name else null end as safe_display_name,
      comment.body,
      comment.created_at
    from public.community_comments comment
    join public.profiles profile on profile.user_id = comment.author_id
    join public.school_memberships author_membership
      on author_membership.user_id = comment.author_id
     and author_membership.school_key = caller_school
     and author_membership.status = 'verified'
    left join public.member_profiles member on member.user_id = comment.author_id
    where comment.post_id = p_post_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and not exists (
        select 1 from public.user_blocks block
        where (block.blocker_id = caller and block.blocked_id = comment.author_id)
           or (block.blocker_id = comment.author_id and block.blocked_id = caller)
      )
    order by comment.created_at desc, comment.id desc
    limit 100
  )
  select recent.id, recent.author_id, recent.username, recent.safe_display_name, recent.body, recent.created_at
  from recent_comments recent
  order by recent.created_at, recent.id;
end;
$$;

revoke all on function public.get_post_comments(uuid) from public;
grant execute on function public.get_post_comments(uuid) to authenticated;

create or replace function public.add_post_comment(p_post_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  post_author uuid;
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'Comment must contain 1 to 1000 characters'; end if;
  if (select count(*) from public.community_comments where author_id = caller and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Please wait before adding another comment';
  end if;
  select author_id into post_author from public.community_posts
  where id = p_post_id and school_key = caller_school and status = 'published' and deleted_at is null;
  if post_author is null then raise exception 'Post is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = post_author)
       or (block.blocker_id = post_author and block.blocked_id = caller)
  ) then raise exception 'Post is unavailable'; end if;

  insert into public.community_comments (post_id, author_id, body)
  values (p_post_id, caller, trim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.add_post_comment(uuid, text) from public;
grant execute on function public.add_post_comment(uuid, text) to authenticated;

create or replace function public.report_community_post(p_post_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'A report reason is required'; end if;
  if not exists (select 1 from public.community_posts where id = p_post_id and school_key = caller_school) then
    raise exception 'Post is unavailable';
  end if;
  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'post' and target_id = p_post_id
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this post'; end if;
  if (select count(*) from public.content_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please wait before submitting another report';
  end if;
  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'post', p_post_id, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_community_post(uuid, text) from public;
grant execute on function public.report_community_post(uuid, text) to authenticated;

create or replace function public.report_community_comment(p_comment_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'A report reason is required'; end if;
  if not exists (
    select 1
    from public.community_comments comment
    join public.community_posts post on post.id = comment.post_id
    where comment.id = p_comment_id
      and comment.status = 'published'
      and comment.deleted_at is null
      and post.school_key = caller_school
      and post.status = 'published'
      and post.deleted_at is null
  ) then raise exception 'Comment is unavailable'; end if;
  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'comment' and target_id = p_comment_id
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this comment'; end if;
  if (select count(*) from public.content_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please wait before submitting another report';
  end if;

  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'comment', p_comment_id, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_community_comment(uuid, text) from public;
grant execute on function public.report_community_comment(uuid, text) to authenticated;

create or replace function public.delete_community_comment(p_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  update public.community_comments
  set status = 'removed', deleted_at = now()
  where id = p_comment_id and author_id = caller and deleted_at is null;
  if not found then raise exception 'Comment is unavailable'; end if;
  return true;
end;
$$;

revoke all on function public.delete_community_comment(uuid) from public;
grant execute on function public.delete_community_comment(uuid) to authenticated;

create or replace function public.delete_community_post(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  update public.community_posts
  set status = 'removed', deleted_at = now(), updated_at = now()
  where id = p_post_id and author_id = caller and deleted_at is null;
  if not found then raise exception 'Post is unavailable'; end if;
  return true;
end;
$$;

revoke all on function public.delete_community_post(uuid) from public;
grant execute on function public.delete_community_post(uuid) to authenticated;

create or replace function public.block_community_user(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_user_id is null or p_user_id = caller then raise exception 'Invalid user'; end if;
  if not exists (
    select 1 from public.school_memberships
    where user_id = p_user_id and school_key = caller_school and status = 'verified'
  ) then raise exception 'User is not in your verified school community'; end if;
  insert into public.user_blocks (blocker_id, blocked_id)
  values (caller, p_user_id) on conflict do nothing;
  return true;
end;
$$;

revoke all on function public.block_community_user(uuid) from public;
grant execute on function public.block_community_user(uuid) to authenticated;

-- Direct campus conversations. These records are private through database RLS
-- and participant checks, but are intentionally described as not end-to-end
-- encrypted: trusted database administrators can still access them.
create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  school_key text not null,
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (school_key, user_low, user_high),
  check (user_low <> user_high)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  client_nonce uuid not null,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (sender_id, client_nonce)
);

create index if not exists direct_conversations_low_idx
  on public.direct_conversations (user_low, created_at desc);
create index if not exists direct_conversations_high_idx
  on public.direct_conversations (user_high, created_at desc);
create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at);
create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;
revoke all on table public.direct_conversations from anon, authenticated;
revoke all on table public.direct_messages from anon, authenticated;

create or replace function public.start_direct_conversation(p_username text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  target_user uuid;
  low_user uuid;
  high_user uuid;
  conversation uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select profile.user_id into target_user
  from public.profiles profile
  join public.school_memberships membership on membership.user_id = profile.user_id
  left join public.member_profiles member on member.user_id = profile.user_id
  where profile.username = trim(p_username)
    and membership.school_key = caller_school
    and membership.status = 'verified'
    and coalesce(member.allow_messages, false) = true;

  if target_user is null then raise exception 'No messageable schoolmate has that username'; end if;
  if target_user = caller then raise exception 'You cannot message yourself'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = target_user)
       or (block.blocker_id = target_user and block.blocked_id = caller)
  ) then raise exception 'Messaging is unavailable because one participant blocked the other'; end if;

  if caller::text < target_user::text then low_user := caller; high_user := target_user;
  else low_user := target_user; high_user := caller; end if;

  insert into public.direct_conversations (school_key, user_low, user_high, created_by)
  values (caller_school, low_user, high_user, caller)
  on conflict (school_key, user_low, user_high) do update set school_key = excluded.school_key
  returning id into conversation;
  return conversation;
end;
$$;

revoke all on function public.start_direct_conversation(text) from public;
grant execute on function public.start_direct_conversation(text) to authenticated;

-- other_avatar_path changes the RPC return type and therefore requires a drop
-- before recreation on projects that already installed the student hub.
drop function if exists public.get_my_conversations();
create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_path text,
  other_avatar_revision bigint,
  last_message text,
  last_message_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  return query
  with mine as (
    select
      conversation.id,
      case when conversation.user_low = caller then conversation.user_high else conversation.user_low end as other_id,
      conversation.created_at
    from public.direct_conversations conversation
    where conversation.school_key = caller_school
      and (conversation.user_low = caller or conversation.user_high = caller)
  )
  select
    mine.id,
    mine.other_id,
    profile.username,
    case when member.profile_visibility = 'school' then member.display_name else null end,
    case when member.profile_visibility = 'school' then member.avatar_path else null end,
    case when member.profile_visibility = 'school' then member.avatar_revision else null end,
    latest.body,
    latest.created_at
  from mine
  join public.profiles profile on profile.user_id = mine.other_id
  join public.school_memberships other_membership
    on other_membership.user_id = mine.other_id
   and other_membership.school_key = caller_school
   and other_membership.status = 'verified'
  left join public.member_profiles member on member.user_id = mine.other_id
  left join lateral (
    select message.body, message.created_at
    from public.direct_messages message
    where message.conversation_id = mine.id and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  where not exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = mine.other_id)
       or (block.blocker_id = mine.other_id and block.blocked_id = caller)
  )
  order by coalesce(latest.created_at, mine.created_at) desc, mine.id desc;
end;
$$;

revoke all on function public.get_my_conversations() from public;
grant execute on function public.get_my_conversations() to authenticated;

create or replace function public.get_conversation_messages(p_conversation_id uuid, p_limit integer default 100)
returns table (
  message_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if not exists (
    select 1 from public.direct_conversations conversation
    where conversation.id = p_conversation_id
      and conversation.school_key = caller_school
      and (conversation.user_low = caller or conversation.user_high = caller)
      and not exists (
        select 1 from public.user_blocks block
        where (
          block.blocker_id = caller
          and block.blocked_id = case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
        ) or (
          block.blocked_id = caller
          and block.blocker_id = case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
        )
      )
  ) then raise exception 'Conversation is unavailable'; end if;

  return query
  with recent_messages as (
    select message.id, message.sender_id, message.body, message.created_at
    from public.direct_messages message
    where message.conversation_id = p_conversation_id and message.deleted_at is null
    order by message.created_at desc, message.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  )
  select recent.id, recent.sender_id, recent.body, recent.created_at
  from recent_messages recent
  order by recent.created_at, recent.id;
end;
$$;

revoke all on function public.get_conversation_messages(uuid, integer) from public;
grant execute on function public.get_conversation_messages(uuid, integer) to authenticated;

create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text,
  p_client_nonce uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  other_user uuid;
  new_id uuid;
begin
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'Message must contain 1 to 2000 characters'; end if;
  if p_client_nonce is null then raise exception 'Message identifier is required'; end if;
  if (select count(*) from public.direct_messages where sender_id = caller and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Please wait before sending another message';
  end if;

  select case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
  into other_user
  from public.direct_conversations conversation
  where conversation.id = p_conversation_id
    and conversation.school_key = caller_school
    and (conversation.user_low = caller or conversation.user_high = caller);
  if other_user is null then raise exception 'Conversation is unavailable'; end if;
  if not exists (
    select 1 from public.school_memberships membership
    where membership.user_id = other_user
      and membership.school_key = caller_school
      and membership.status = 'verified'
  ) then raise exception 'This schoolmate is no longer available for messaging'; end if;
  if not exists (
    select 1 from public.member_profiles member
    where member.user_id = other_user and member.allow_messages = true
  ) then raise exception 'This schoolmate is not accepting messages'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = other_user)
       or (block.blocker_id = other_user and block.blocked_id = caller)
  ) then raise exception 'Messaging is unavailable because one participant blocked the other'; end if;

  insert into public.direct_messages (conversation_id, sender_id, client_nonce, body)
  values (p_conversation_id, caller, p_client_nonce, trim(p_body))
  on conflict (sender_id, client_nonce) do update set body = public.direct_messages.body
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.send_direct_message(uuid, text, uuid) from public;
grant execute on function public.send_direct_message(uuid, text, uuid) to authenticated;

create or replace function public.report_conversation_user(p_conversation_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  other_user uuid;
  new_id uuid;
begin
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'A report reason is required'; end if;
  select case when conversation.user_low = caller then conversation.user_high else conversation.user_low end
  into other_user
  from public.direct_conversations conversation
  where conversation.id = p_conversation_id
    and (conversation.user_low = caller or conversation.user_high = caller);
  if other_user is null then raise exception 'Conversation is unavailable'; end if;

  if exists (
    select 1 from public.content_reports
    where reporter_id = caller and target_type = 'user' and target_id = other_user
      and status in ('open', 'reviewing')
  ) then raise exception 'You already reported this user'; end if;
  if (select count(*) from public.content_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Please wait before submitting another report';
  end if;

  insert into public.content_reports (reporter_id, target_type, target_id, reason)
  values (caller, 'user', other_user, trim(p_reason)) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.report_conversation_user(uuid, text) from public;
grant execute on function public.report_conversation_user(uuid, text) to authenticated;

-- Dashboard verification example (replace the email before running separately):
-- update public.school_memberships m
-- set status = 'verified', verification_method = 'manual', verified_at = now(), updated_at = now()
-- from auth.users u
-- where m.user_id = u.id and u.email = 'student@university.edu';
