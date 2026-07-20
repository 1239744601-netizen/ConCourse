-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- If the editor reports that the request/entity is too large, run
-- supabase-setup-part-1.sql first and supabase-setup-part-2.sql second instead.
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

-- ---------------------------------------------------------------------------
-- Verified-campus marketplace
-- ---------------------------------------------------------------------------
-- Marketplace rows are deliberately RPC-only. Browser clients cannot query or
-- mutate these tables directly; every RPC repeats verified-school and bilateral
-- block checks. Money is stored as integer minor units with an ISO 4217-style
-- three-letter currency code. A browser can create an awaiting-payment order,
-- but only a trusted service-role payment webhook can record held, released,
-- refunded, or failed provider money states.

create table if not exists public.marketplace_listings (
  id uuid primary key,
  school_key text not null,
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (title = trim(title) and char_length(title) between 3 and 120),
  description text not null check (description = trim(description) and char_length(description) between 10 and 5000),
  category text not null check (category in (
    'notes', 'past_papers', 'textbooks', 'electronics', 'furniture',
    'life_essentials', 'services', 'other'
  )),
  mode text not null check (mode in ('sale', 'free', 'wanted')),
  item_condition text not null check (item_condition in (
    'digital', 'new', 'like_new', 'good', 'fair', 'used', 'not_applicable'
  )),
  course_code text,
  negotiable boolean not null default false,
  price_minor bigint not null check (price_minor between 0 and 999999999999),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  delivery_methods text[] not null check (
    cardinality(delivery_methods) between 1 and 3
    and delivery_methods <@ array['digital', 'meetup', 'shipping']::text[]
  ),
  location_label text check (
    location_label is null
    or (location_label = trim(location_label) and char_length(location_label) between 1 and 120)
  ),
  status text not null default 'draft' check (status in (
    'draft', 'active', 'reserved', 'sold', 'paused', 'deleted'
  )),
  rights_attestation text not null check (
    rights_attestation = trim(rights_attestation)
    and char_length(rights_attestation) between 20 and 600
  ),
  academic_rights_basis text not null check (academic_rights_basis in (
    'original', 'licensed', 'public_domain', 'not_applicable'
  )),
  academic_rights_confirmed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (mode <> 'free' or price_minor = 0),
  check (mode <> 'sale' or price_minor > 0),
  check (
    category not in ('notes', 'past_papers')
    or (
      academic_rights_basis <> 'not_applicable'
      and academic_rights_confirmed_at is not null
    )
  ),
  check (
    category <> 'past_papers'
    or academic_rights_basis in ('licensed', 'public_domain')
  ),
  check ((status = 'deleted') = (deleted_at is not null))
);

create table if not exists public.marketplace_listing_media (
  id uuid primary key,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null check (
    (media_type = 'image' and mime_type in ('image/webp', 'image/jpeg', 'image/png'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  ),
  width integer check (width between 1 and 8192),
  height integer check (height between 1 and 8192),
  duration_seconds numeric check (duration_seconds > 0 and duration_seconds <= 3600),
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  position smallint not null check (position between 0 and 7),
  created_at timestamptz not null default now(),
  unique (listing_id, position),
  check (
    storage_path = owner_id::text || '/listings/' || listing_id::text || '/' || id::text ||
      case mime_type
        when 'image/webp' then '.webp'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'video/mp4' then '.mp4'
        when 'video/webm' then '.webm'
        when 'video/quicktime' then '.mov'
      end
  ),
  check ((media_type = 'image' and duration_seconds is null) or media_type = 'video')
);

-- Upgrade older installations whose inline media checks allowed WebP only.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.marketplace_listing_media'::regclass
      and constraint_record.contype = 'c'
      and (
        pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%storage_path%'
        or (
          pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%mime_type%'
          and pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%media_type%'
        )
      )
  loop
    execute format('alter table public.marketplace_listing_media drop constraint %I', constraint_row.conname);
  end loop;
end;
$$;

alter table public.marketplace_listing_media
  add constraint marketplace_listing_media_mime_supported check (
    (media_type = 'image' and mime_type in ('image/webp', 'image/jpeg', 'image/png'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  );
alter table public.marketplace_listing_media
  add constraint marketplace_listing_media_storage_path_matches check (
    storage_path = owner_id::text || '/listings/' || listing_id::text || '/' || id::text ||
      case mime_type
        when 'image/webp' then '.webp'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'video/mp4' then '.mp4'
        when 'video/webm' then '.webm'
        when 'video/quicktime' then '.mov'
      end
  );

-- Safe upgrade path for a project that briefly installed an earlier draft of
-- the marketplace section before these discovery fields were added.
alter table public.marketplace_listings add column if not exists course_code text;
alter table public.marketplace_listings add column if not exists negotiable boolean not null default false;
alter table public.marketplace_listings drop constraint if exists marketplace_listings_course_code_bounded;
alter table public.marketplace_listings add constraint marketplace_listings_course_code_bounded
  check (
    course_code is null
    or (course_code = trim(course_code) and char_length(course_code) between 1 and 80)
  );

-- Replace every earlier academic-rights draft constraint by definition, not by
-- an assumed generated name. This makes upgrades rerunnable and removes the
-- ambiguous combined attestation value from projects that installed a preview.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.marketplace_listings'::regclass
      and constraint_record.contype = 'c'
      and pg_catalog.pg_get_constraintdef(constraint_record.oid) ilike '%academic_rights_basis%'
  loop
    execute pg_catalog.format(
      'alter table public.marketplace_listings drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

-- Never guess whether a legacy combined claim meant original work or a real
-- redistribution licence. Preserve the listing, move it out of an academic
-- category, and pause it when possible until its seller supplies a precise
-- basis through the editor.
update public.marketplace_listings
set category = 'other',
    status = case when status in ('draft', 'active', 'paused') then 'paused' else status end,
    academic_rights_basis = 'not_applicable',
    academic_rights_confirmed_at = null,
    version = version + 1,
    updated_at = now()
where academic_rights_basis = 'seller_created_or_authorized';

alter table public.marketplace_listings
  add constraint marketplace_listings_academic_rights_basis_check
  check (academic_rights_basis in ('original', 'licensed', 'public_domain', 'not_applicable'));
alter table public.marketplace_listings
  add constraint marketplace_listings_academic_material_rights_check
  check (
    category not in ('notes', 'past_papers')
    or (
      academic_rights_basis <> 'not_applicable'
      and academic_rights_confirmed_at is not null
    )
  );
alter table public.marketplace_listings
  add constraint marketplace_listings_past_paper_rights_check
  check (category <> 'past_papers' or academic_rights_basis in ('licensed', 'public_domain'));

create table if not exists public.marketplace_favorites (
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.marketplace_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 999999999999),
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'declined', 'withdrawn', 'expired'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id),
  school_key text not null,
  seller_id uuid not null references auth.users(id),
  buyer_id uuid not null references auth.users(id),
  offer_id uuid unique references public.marketplace_offers(id),
  amount_minor bigint not null check (amount_minor between 0 and 999999999999),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  delivery_method text not null check (delivery_method in ('digital', 'meetup', 'shipping')),
  status text not null default 'awaiting_payment' check (status in (
    'awaiting_payment', 'payment_held', 'fulfilled', 'accepted',
    'disputed', 'cancelled', 'refunded'
  )),
  listing_snapshot jsonb not null,
  idempotency_actor_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  version integer not null default 1 check (version > 0),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  fulfilled_note text check (fulfilled_note is null or char_length(fulfilled_note) <= 1000),
  fulfilled_at timestamptz,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_actor_id, idempotency_key),
  check (seller_id <> buyer_id)
);

-- Append-only audit trail. The trigger below rejects UPDATE and DELETE even if
-- a future privileged tool accidentally receives table-level write access.
create table if not exists public.marketplace_order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  actor_id uuid references auth.users(id),
  event_type text not null check (event_type in (
    'created', 'payment_pending', 'payment_held', 'fulfilled', 'accepted',
    'disputed', 'cancelled', 'payment_failed', 'released', 'refunded'
  )),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id),
  opened_by uuid not null references auth.users(id),
  opened_from_status text not null,
  reason text not null check (reason = trim(reason) and char_length(reason) between 3 and 80),
  details text not null check (details = trim(details) and char_length(details) between 10 and 2000),
  status text not null default 'open' check (status in (
    'open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed'
  )),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id),
  reviewer_id uuid not null references auth.users(id),
  reviewee_id uuid not null references auth.users(id),
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 1500),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id)
);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason = trim(reason) and char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

-- Provider identifiers and payout calculations are intentionally isolated from
-- browser-facing public tables. Browser RPCs expose only the coarse state and
-- seller gross/fee/net projection required to explain an order.
create table if not exists private.marketplace_payment_projections (
  order_id uuid primary key references public.marketplace_orders(id) on delete restrict,
  provider text,
  provider_reference text,
  payment_state text not null default 'provider_required' check (payment_state in (
    'provider_required', 'pending', 'held', 'release_pending',
    'released', 'refund_pending', 'refunded', 'failed'
  )),
  gross_minor bigint not null check (gross_minor between 0 and 999999999999),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  seller_receivable_minor bigint not null check (seller_receivable_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  held_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (fee_minor <= gross_minor),
  check (seller_receivable_minor = gross_minor - fee_minor)
);

create table if not exists private.marketplace_payment_provider_events (
  provider_event_id text primary key check (char_length(provider_event_id) between 4 and 240),
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  provider text not null check (char_length(provider) between 2 and 80),
  provider_reference text not null check (char_length(provider_reference) between 2 and 240),
  payment_state text not null,
  fee_minor bigint not null check (fee_minor >= 0),
  received_at timestamptz not null default now()
);

alter table private.marketplace_payment_provider_events
  add column if not exists provider_reference text;
alter table private.marketplace_payment_provider_events
  add column if not exists fee_minor bigint;
update private.marketplace_payment_provider_events provider_event
set provider_reference = payment.provider_reference,
    fee_minor = payment.fee_minor
from private.marketplace_payment_projections payment
where payment.order_id = provider_event.order_id
  and (provider_event.provider_reference is null or provider_event.fee_minor is null);
alter table private.marketplace_payment_provider_events
  alter column provider_reference set not null;
alter table private.marketplace_payment_provider_events
  alter column fee_minor set not null;
alter table private.marketplace_payment_provider_events
  drop constraint if exists marketplace_payment_provider_events_provider_reference_check;
alter table private.marketplace_payment_provider_events
  add constraint marketplace_payment_provider_events_provider_reference_check
  check (char_length(provider_reference) between 2 and 240);
alter table private.marketplace_payment_provider_events
  drop constraint if exists marketplace_payment_provider_events_fee_minor_check;
alter table private.marketplace_payment_provider_events
  add constraint marketplace_payment_provider_events_fee_minor_check
  check (fee_minor >= 0);

create unique index if not exists marketplace_payment_provider_reference_unique_idx
  on private.marketplace_payment_projections (provider, provider_reference)
  where provider is not null and provider_reference is not null;

-- Fail closed until a real payment-provider webhook has been deployed and a
-- service-role call explicitly enables checkout. Discovery, offers, favorites,
-- post promotion, and messaging do not depend on this switch.
create table if not exists private.marketplace_runtime_settings (
  singleton boolean primary key default true check (singleton),
  checkout_enabled boolean not null default false,
  payment_provider text,
  updated_at timestamptz not null default now()
);

insert into private.marketplace_runtime_settings (singleton, checkout_enabled)
values (true, false)
on conflict (singleton) do nothing;

create table if not exists public.community_post_listing_links (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  school_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_listings_school_status_created_idx
  on public.marketplace_listings (school_key, status, created_at desc);
create index if not exists marketplace_listings_seller_updated_idx
  on public.marketplace_listings (seller_id, updated_at desc);
create index if not exists marketplace_listing_media_listing_position_idx
  on public.marketplace_listing_media (listing_id, position);
create index if not exists marketplace_listing_media_owner_created_idx
  on public.marketplace_listing_media (owner_id, created_at desc);
create index if not exists marketplace_favorites_user_created_idx
  on public.marketplace_favorites (user_id, created_at desc);
create index if not exists marketplace_offers_listing_status_created_idx
  on public.marketplace_offers (listing_id, status, created_at desc);
create index if not exists marketplace_offers_buyer_created_idx
  on public.marketplace_offers (buyer_id, created_at desc);
create unique index if not exists marketplace_offers_one_pending_per_buyer_idx
  on public.marketplace_offers (listing_id, buyer_id) where status = 'pending';
create index if not exists marketplace_orders_buyer_created_idx
  on public.marketplace_orders (buyer_id, created_at desc);
create index if not exists marketplace_orders_seller_created_idx
  on public.marketplace_orders (seller_id, created_at desc);
drop index if exists public.marketplace_orders_one_open_per_listing_idx;
create unique index marketplace_orders_one_open_per_listing_idx
  on public.marketplace_orders (listing_id)
  where status in ('payment_held', 'fulfilled', 'disputed');
create unique index if not exists marketplace_orders_one_pending_per_buyer_idx
  on public.marketplace_orders (listing_id, buyer_id)
  where status = 'awaiting_payment';
create index if not exists marketplace_order_events_order_created_idx
  on public.marketplace_order_events (order_id, created_at, id);
create index if not exists marketplace_reports_status_created_idx
  on public.marketplace_reports (status, created_at desc);
create index if not exists community_post_listing_links_listing_idx
  on public.community_post_listing_links (listing_id, created_at desc);

alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_media enable row level security;
alter table public.marketplace_favorites enable row level security;
alter table public.marketplace_offers enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_events enable row level security;
alter table public.marketplace_disputes enable row level security;
alter table public.marketplace_reviews enable row level security;
alter table public.marketplace_reports enable row level security;
alter table public.community_post_listing_links enable row level security;

revoke all on table public.marketplace_listings from anon, authenticated;
revoke all on table public.marketplace_listing_media from anon, authenticated;
revoke all on table public.marketplace_favorites from anon, authenticated;
revoke all on table public.marketplace_offers from anon, authenticated;
revoke all on table public.marketplace_orders from anon, authenticated;
revoke all on table public.marketplace_order_events from anon, authenticated;
revoke all on table public.marketplace_disputes from anon, authenticated;
revoke all on table public.marketplace_reviews from anon, authenticated;
revoke all on table public.marketplace_reports from anon, authenticated;
revoke all on table public.community_post_listing_links from anon, authenticated;
revoke all on table private.marketplace_payment_projections from public, anon, authenticated;
revoke all on table private.marketplace_payment_provider_events from public, anon, authenticated;
revoke all on table private.marketplace_runtime_settings from public, anon, authenticated;

drop trigger if exists marketplace_listings_set_updated_at on public.marketplace_listings;
create trigger marketplace_listings_set_updated_at
  before update on public.marketplace_listings
  for each row execute procedure public.set_concourse_updated_at();
drop trigger if exists marketplace_offers_set_updated_at on public.marketplace_offers;
create trigger marketplace_offers_set_updated_at
  before update on public.marketplace_offers
  for each row execute procedure public.set_concourse_updated_at();
drop trigger if exists marketplace_orders_set_updated_at on public.marketplace_orders;
create trigger marketplace_orders_set_updated_at
  before update on public.marketplace_orders
  for each row execute procedure public.set_concourse_updated_at();
drop trigger if exists marketplace_disputes_set_updated_at on public.marketplace_disputes;
create trigger marketplace_disputes_set_updated_at
  before update on public.marketplace_disputes
  for each row execute procedure public.set_concourse_updated_at();

create or replace function private.prevent_marketplace_order_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Marketplace order events are immutable';
end;
$$;

revoke all on function private.prevent_marketplace_order_event_mutation() from public, anon, authenticated;
drop trigger if exists marketplace_order_events_immutable on public.marketplace_order_events;
create trigger marketplace_order_events_immutable
  before update or delete on public.marketplace_order_events
  for each row execute procedure private.prevent_marketplace_order_event_mutation();

create or replace function private.validate_community_listing_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.community_posts post
    join public.marketplace_listings listing
      on listing.id = new.listing_id
     and listing.seller_id = new.seller_id
     and listing.school_key = new.school_key
     and listing.status = 'active'
    where post.id = new.post_id
      and post.author_id = new.seller_id
      and post.school_key = new.school_key
      and post.status = 'published'
      and post.deleted_at is null
  ) then
    raise exception 'Community post listing link must join the seller own active school listing';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_community_listing_link() from public, anon, authenticated;
drop trigger if exists community_post_listing_links_validate on public.community_post_listing_links;
create trigger community_post_listing_links_validate
  before insert or update on public.community_post_listing_links
  for each row execute procedure private.validate_community_listing_link();

create or replace function private.append_marketplace_order_event(
  p_order_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  insert into public.marketplace_order_events (
    order_id, actor_id, event_type, from_status, to_status, metadata
  ) values (
    p_order_id, p_actor_id, p_event_type, p_from_status, p_to_status,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function private.append_marketplace_order_event(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;

-- Private object storage for marketplace listing previews. Product files are
-- not themselves a payment-delivery channel; sellers should release purchased
-- digital materials only after the trusted payment provider reports funds held.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-media',
  'marketplace-media',
  false,
  52428800,
  array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_upload_marketplace_media(p_owner_id text, p_object_path text)
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
     or p_object_path not like caller::text || '/listings/%'
     or not exists (
       select 1 from public.school_memberships membership
       where membership.user_id = caller and membership.status = 'verified'
     ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:marketplace-media:' || caller::text, 0)
  );

  select
    count(*)::integer,
    count(*) filter (where object.created_at >= now() - interval '1 hour')::integer,
    count(*) filter (
      where not exists (
        select 1 from public.marketplace_listing_media media
        where media.owner_id = caller and media.storage_path = object.name
      )
    )::integer,
    coalesce(sum(
      case when coalesce(object.metadata->>'size', '') ~ '^[0-9]+$'
        then (object.metadata->>'size')::bigint else 0 end
    ), 0)::bigint
  into object_count, recent_count, unreferenced_count, total_bytes
  from storage.objects object
  where object.bucket_id = 'marketplace-media'
    and object.owner_id = caller::text;

  return object_count < 300
    and recent_count < 30
    and unreferenced_count < 12
    and total_bytes < 1073741824;
end;
$$;

revoke all on function public.can_upload_marketplace_media(text, text) from public, anon, authenticated;
grant execute on function public.can_upload_marketplace_media(text, text) to authenticated;

create or replace function public.can_view_marketplace_media(p_owner_id text, p_object_path text)
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
      from public.marketplace_listing_media media
      join public.marketplace_listings listing
        on listing.id = media.listing_id
       and listing.seller_id = media.owner_id
      where media.owner_id::text = p_owner_id
        and media.storage_path = p_object_path
        and (
          exists (
            select 1 from public.marketplace_orders orders
            where orders.listing_id = listing.id
              and ((select auth.uid()) = orders.buyer_id or (select auth.uid()) = orders.seller_id)
          )
          or (
            listing.status in ('active', 'reserved')
            and exists (
              select 1 from public.school_memberships viewer
              where viewer.user_id = (select auth.uid())
                and viewer.school_key = listing.school_key
                and viewer.status = 'verified'
            )
            and exists (
              select 1 from public.school_memberships seller_membership
              where seller_membership.user_id = listing.seller_id
                and seller_membership.school_key = listing.school_key
                and seller_membership.status = 'verified'
            )
            and not exists (
              select 1 from public.user_blocks block
              where (block.blocker_id = (select auth.uid()) and block.blocked_id = listing.seller_id)
                 or (block.blocker_id = listing.seller_id and block.blocked_id = (select auth.uid()))
            )
          )
        )
    );
$$;

revoke all on function public.can_view_marketplace_media(text, text) from public, anon, authenticated;
grant execute on function public.can_view_marketplace_media(text, text) to authenticated;

create or replace function public.can_delete_marketplace_media(p_owner_id text, p_object_path text)
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
      from public.marketplace_listing_media media
      join public.marketplace_listings listing on listing.id = media.listing_id
      where media.owner_id::text = p_owner_id
        and media.storage_path = p_object_path
        and (
          listing.status <> 'deleted'
          or exists (
            select 1 from public.marketplace_orders orders
            where orders.listing_id = listing.id
              and (
                orders.status not in ('accepted', 'cancelled', 'refunded')
                or (
                  orders.status = 'accepted'
                  and orders.accepted_at >= now() - interval '30 days'
                )
              )
          )
        )
    );
$$;

revoke all on function public.can_delete_marketplace_media(text, text) from public, anon, authenticated;
grant execute on function public.can_delete_marketplace_media(text, text) to authenticated;

drop policy if exists "Marketplace media owners can upload" on storage.objects;
create policy "Marketplace media owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'marketplace-media'
  and public.can_upload_marketplace_media((storage.foldername(name))[1], name)
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Marketplace media owners can read" on storage.objects;
create policy "Marketplace media owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
);

drop policy if exists "Marketplace media owners can replace" on storage.objects;

drop policy if exists "Marketplace media owners can delete" on storage.objects;
create policy "Marketplace media owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'marketplace-media'
  and owner_id = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and public.can_delete_marketplace_media(owner_id, name)
);

drop policy if exists "Verified schoolmates can read marketplace media" on storage.objects;
create policy "Verified schoolmates can read marketplace media"
on storage.objects for select to authenticated
using (
  bucket_id = 'marketplace-media'
  and owner_id is not null
  and name ~ (
    '^' || owner_id ||
    '/listings/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|png|mp4|webm|mov)$'
  )
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated',
    'storage.object.sign'
  ])
  and public.can_view_marketplace_media(owner_id, name)
);

-- Shared JSON builders keep feed, detail, post-link, and order responses
-- consistent without granting direct access to the underlying tables.
create or replace function private.marketplace_member_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', profile.user_id,
    'username', profile.username,
    'display_name', case when member.profile_visibility = 'school' then member.display_name else null end,
    'avatar_path', case when member.profile_visibility = 'school' then member.avatar_path else null end,
    'avatar_revision', case when member.profile_visibility = 'school' then member.avatar_revision else null end,
    'major_of_study', case when member.profile_visibility = 'school' then profile.major_of_study else null end,
    'seller_rating', coalesce((
      select round(avg(review.rating)::numeric, 2)
      from public.marketplace_reviews review
      where review.reviewee_id = profile.user_id and review.status = 'published'
    ), 0),
    'seller_review_count', (
      select count(*) from public.marketplace_reviews review
      where review.reviewee_id = profile.user_id and review.status = 'published'
    )
  )
  from public.profiles profile
  left join public.member_profiles member on member.user_id = profile.user_id
  where profile.user_id = p_user_id;
$$;

revoke all on function private.marketplace_member_json(uuid) from public, anon, authenticated;

create or replace function private.marketplace_listing_json(p_listing_id uuid, p_viewer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', listing.id,
    'seller_id', listing.seller_id,
    'seller', private.marketplace_member_json(listing.seller_id),
    'title', listing.title,
    'description', listing.description,
    'category', listing.category,
    'mode', listing.mode,
    'condition', listing.item_condition,
    'course_code', listing.course_code,
    'negotiable', listing.negotiable,
    'price_minor', listing.price_minor,
    'currency', listing.currency,
    'delivery_methods', listing.delivery_methods,
    'location_label', listing.location_label,
    'status', listing.status,
    'rights_attestation', case when p_viewer_id = listing.seller_id then listing.rights_attestation else null end,
    'academic_rights_basis', listing.academic_rights_basis,
    'version', listing.version,
    'created_at', listing.created_at,
    'updated_at', listing.updated_at,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', media.id,
        'storage_path', media.storage_path,
        'media_type', media.media_type,
        'mime_type', media.mime_type,
        'width', media.width,
        'height', media.height,
        'duration_seconds', media.duration_seconds,
        'alt_text', media.alt_text,
        'position', media.position
      ) order by media.position)
      from public.marketplace_listing_media media
      where media.listing_id = listing.id
    ), '[]'::jsonb),
    'favorite_count', (
      select count(*) from public.marketplace_favorites favorite where favorite.listing_id = listing.id
    ),
    'favorited_by_me', exists (
      select 1 from public.marketplace_favorites favorite
      where favorite.listing_id = listing.id and favorite.user_id = p_viewer_id
    ),
    'offer_count', (
      select count(*) from public.marketplace_offers offer
      where offer.listing_id = listing.id and offer.status = 'pending'
    ),
    'linked_post_count', (
      select count(*) from public.community_post_listing_links link
      join public.community_posts post on post.id = link.post_id
      where link.listing_id = listing.id and post.status = 'published' and post.deleted_at is null
    )
  )
  from public.marketplace_listings listing
  where listing.id = p_listing_id;
$$;

revoke all on function private.marketplace_listing_json(uuid, uuid) from public, anon, authenticated;

create or replace function private.marketplace_payment_json(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'payment_state', payment.payment_state,
    'gross_minor', payment.gross_minor,
    'fee_minor', payment.fee_minor,
    'seller_receivable_minor', payment.seller_receivable_minor,
    'currency', payment.currency,
    'held_at', payment.held_at,
    'released_at', payment.released_at,
    'refunded_at', payment.refunded_at
  )
  from private.marketplace_payment_projections payment
  where payment.order_id = p_order_id;
$$;

revoke all on function private.marketplace_payment_json(uuid) from public, anon, authenticated;

create or replace function private.marketplace_order_json(p_order_id uuid, p_viewer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', orders.id,
    'listing_id', orders.listing_id,
    'role', case when p_viewer_id = orders.seller_id then 'seller' else 'buyer' end,
    'seller', private.marketplace_member_json(orders.seller_id),
    'buyer', private.marketplace_member_json(orders.buyer_id),
    'amount_minor', orders.amount_minor,
    'currency', orders.currency,
    'delivery_method', orders.delivery_method,
    'status', orders.status,
    'listing_snapshot', orders.listing_snapshot,
    'payment', private.marketplace_payment_json(orders.id),
    'expires_at', orders.expires_at,
    'fulfilled_note', orders.fulfilled_note,
    'fulfilled_at', orders.fulfilled_at,
    'accepted_at', orders.accepted_at,
    'cancelled_at', orders.cancelled_at,
    'created_at', orders.created_at,
    'updated_at', orders.updated_at
  )
  from public.marketplace_orders orders
  where orders.id = p_order_id
    and (p_viewer_id = orders.seller_id or p_viewer_id = orders.buyer_id);
$$;

revoke all on function private.marketplace_order_json(uuid, uuid) from public, anon, authenticated;

create or replace function public.get_marketplace_feed(
  p_limit integer default 24,
  p_offset integer default 0,
  p_query text default null,
  p_category text default null,
  p_mode text default null,
  p_sort text default 'recent'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  safe_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_query text := nullif(left(trim(coalesce(p_query, '')), 120), '');
  safe_category text := nullif(lower(trim(coalesce(p_category, ''))), '');
  safe_mode text := nullif(lower(trim(coalesce(p_mode, ''))), '');
  safe_sort text := lower(trim(coalesce(p_sort, 'recent')));
  item_rows jsonb;
  row_count integer;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if safe_category is not null and safe_category <> 'all' and safe_category not in (
    'notes', 'past_papers', 'textbooks', 'electronics', 'furniture',
    'life_essentials', 'services', 'other'
  ) then raise exception 'Unsupported marketplace category'; end if;
  if safe_mode is not null and safe_mode <> 'all' and safe_mode not in ('sale', 'free', 'wanted', 'saved') then
    raise exception 'Unsupported marketplace mode';
  end if;
  if safe_sort not in ('recent', 'price_asc', 'price_desc', 'popular') then
    raise exception 'Unsupported marketplace sort';
  end if;

  with ranked as (
    select listing.id, listing.price_minor, listing.created_at,
      (select count(*) from public.marketplace_favorites favorite where favorite.listing_id = listing.id) as popularity
    from public.marketplace_listings listing
    join public.school_memberships seller_membership
      on seller_membership.user_id = listing.seller_id
     and seller_membership.school_key = caller_school
     and seller_membership.status = 'verified'
    where listing.school_key = caller_school
      and listing.status = 'active'
      and (safe_category is null or safe_category = 'all' or listing.category = safe_category)
      and (
        safe_mode is null
        or safe_mode = 'all'
        or (safe_mode in ('sale', 'free', 'wanted') and listing.mode = safe_mode)
        or (
          safe_mode = 'saved'
          and exists (
            select 1 from public.marketplace_favorites saved
            where saved.listing_id = listing.id and saved.user_id = caller
          )
        )
      )
      and (
        safe_query is null
        or listing.title ilike '%' || safe_query || '%'
        or listing.description ilike '%' || safe_query || '%'
        or coalesce(listing.course_code, '') ilike '%' || safe_query || '%'
        or coalesce(listing.location_label, '') ilike '%' || safe_query || '%'
      )
      and not exists (
        select 1 from public.user_blocks block
        where (block.blocker_id = caller and block.blocked_id = listing.seller_id)
           or (block.blocker_id = listing.seller_id and block.blocked_id = caller)
      )
    order by
      case when safe_sort = 'price_asc' then listing.price_minor end asc nulls last,
      case when safe_sort = 'price_desc' then listing.price_minor end desc nulls last,
      case when safe_sort = 'popular' then
        (select count(*) from public.marketplace_favorites favorite where favorite.listing_id = listing.id)
      end desc nulls last,
      listing.created_at desc,
      listing.id desc
    limit safe_limit + 1 offset safe_offset
  ), visible as (
    select ranked.id, row_number() over (
      order by
        case when safe_sort = 'price_asc' then ranked.price_minor end asc nulls last,
        case when safe_sort = 'price_desc' then ranked.price_minor end desc nulls last,
        case when safe_sort = 'popular' then ranked.popularity end desc nulls last,
        ranked.created_at desc,
        ranked.id desc
    ) as position
    from ranked
    limit safe_limit
  )
  select
    coalesce(jsonb_agg(private.marketplace_listing_json(visible.id, caller) order by visible.position), '[]'::jsonb),
    (select count(*)::integer from ranked)
  into item_rows, row_count
  from visible;

  return jsonb_build_object(
    'items', coalesce(item_rows, '[]'::jsonb),
    'limit', safe_limit,
    'offset', safe_offset,
    'has_more', coalesce(row_count, 0) > safe_limit,
    'checkout_enabled', coalesce((
      select setting.checkout_enabled
      from private.marketplace_runtime_settings setting
      where setting.singleton = true
    ), false)
  );
end;
$$;

revoke all on function public.get_marketplace_feed(integer, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_feed(integer, integer, text, text, text, text)
  to authenticated;

create or replace function public.get_marketplace_listing(p_listing_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  result jsonb;
  offer_rows jsonb;
  is_transaction_participant boolean := false;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into listing_row from public.marketplace_listings where id = p_listing_id;
  if not found then raise exception 'Listing is unavailable'; end if;
  is_transaction_participant := listing_row.seller_id = caller or exists (
    select 1 from public.marketplace_orders orders
    where orders.listing_id = p_listing_id and orders.buyer_id = caller
  );
  if not is_transaction_participant then
    if caller_school is null
       or listing_row.school_key <> caller_school
       or listing_row.status not in ('active', 'reserved') then
      raise exception 'Listing is unavailable';
    end if;
    if not exists (
      select 1 from public.school_memberships seller_membership
      where seller_membership.user_id = listing_row.seller_id
        and seller_membership.school_key = listing_row.school_key
        and seller_membership.status = 'verified'
    ) then raise exception 'Listing is unavailable'; end if;
    if exists (
      select 1 from public.user_blocks block
      where (block.blocker_id = caller and block.blocked_id = listing_row.seller_id)
         or (block.blocker_id = listing_row.seller_id and block.blocked_id = caller)
    ) then raise exception 'Listing is unavailable'; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', offer.id,
    'buyer', private.marketplace_member_json(offer.buyer_id),
    'amount_minor', offer.amount_minor,
    'message', offer.message,
    'status', offer.status,
    'created_at', offer.created_at,
    'updated_at', offer.updated_at
  ) order by offer.created_at desc), '[]'::jsonb)
  into offer_rows
  from public.marketplace_offers offer
  where offer.listing_id = p_listing_id
    and (listing_row.seller_id = caller or offer.buyer_id = caller);

  result := private.marketplace_listing_json(p_listing_id, caller);
  return result || jsonb_build_object(
    'is_seller', listing_row.seller_id = caller,
    'offers', coalesce(offer_rows, '[]'::jsonb),
    'checkout_enabled', coalesce((
      select setting.checkout_enabled
      from private.marketplace_runtime_settings setting
      where setting.singleton = true
    ), false)
  );
end;
$$;

revoke all on function public.get_marketplace_listing(uuid) from public, anon, authenticated;
grant execute on function public.get_marketplace_listing(uuid) to authenticated;

create or replace function public.get_my_marketplace_listings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  items jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(
    private.marketplace_listing_json(listing.id, caller)
    order by listing.updated_at desc, listing.id desc
  ), '[]'::jsonb)
  into items
  from public.marketplace_listings listing
  where listing.seller_id = caller;
  return jsonb_build_object('items', items);
end;
$$;

revoke all on function public.get_my_marketplace_listings() from public, anon, authenticated;
grant execute on function public.get_my_marketplace_listings() to authenticated;

create or replace function public.get_my_marketplace_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  items jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(
    private.marketplace_order_json(orders.id, caller)
    order by orders.updated_at desc, orders.id desc
  ), '[]'::jsonb)
  into items
  from public.marketplace_orders orders
  where orders.seller_id = caller or orders.buyer_id = caller;
  return jsonb_build_object('items', items);
end;
$$;

revoke all on function public.get_my_marketplace_orders() from public, anon, authenticated;
grant execute on function public.get_my_marketplace_orders() to authenticated;

create or replace function public.get_marketplace_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  order_row public.marketplace_orders%rowtype;
  event_rows jsonb;
  dispute_row jsonb;
  review_row jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into order_row from public.marketplace_orders where id = p_order_id;
  if not found or (caller <> order_row.seller_id and caller <> order_row.buyer_id) then
    raise exception 'Order is unavailable';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event.id,
    'event_type', event.event_type,
    'from_status', event.from_status,
    'to_status', event.to_status,
    'metadata', event.metadata,
    'created_at', event.created_at
  ) order by event.id), '[]'::jsonb)
  into event_rows
  from public.marketplace_order_events event where event.order_id = p_order_id;

  select jsonb_build_object(
    'id', dispute.id, 'opened_by', dispute.opened_by, 'reason', dispute.reason,
    'details', dispute.details, 'status', dispute.status,
    'resolution_note', dispute.resolution_note, 'created_at', dispute.created_at,
    'resolved_at', dispute.resolved_at
  ) into dispute_row
  from public.marketplace_disputes dispute where dispute.order_id = p_order_id;

  select jsonb_build_object(
    'id', review.id, 'reviewer_id', review.reviewer_id,
    'reviewee_id', review.reviewee_id, 'rating', review.rating,
    'body', review.body, 'created_at', review.created_at
  ) into review_row
  from public.marketplace_reviews review
  where review.order_id = p_order_id and review.status = 'published';

  return jsonb_build_object(
    'order', private.marketplace_order_json(p_order_id, caller),
    'events', event_rows,
    'dispute', dispute_row,
    'review', review_row
  );
end;
$$;

revoke all on function public.get_marketplace_order(uuid) from public, anon, authenticated;
grant execute on function public.get_marketplace_order(uuid) to authenticated;

create or replace function public.create_marketplace_listing(
  p_listing_id uuid,
  p_payload jsonb,
  p_media jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_title text;
  new_description text;
  new_category text;
  new_mode text;
  new_condition text;
  new_course_code text;
  new_negotiable boolean;
  new_price bigint;
  new_currency text;
  new_delivery text[];
  new_location text;
  new_status text;
  new_attestation text;
  new_basis text;
  new_academic_confirmed boolean;
  media_item jsonb;
  media_id uuid;
  media_path text;
  media_kind text;
  media_mime text;
  media_alt text;
  media_position smallint;
  expected_suffix text;
  seen_media_ids uuid[] := '{}'::uuid[];
  seen_positions smallint[] := '{}'::smallint[];
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_listing_id is null then raise exception 'Listing identifier is required'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Listing payload must be a JSON object'; end if;
  if p_media is not null and jsonb_typeof(p_media) <> 'array' then raise exception 'Media must be a JSON array'; end if;
  if jsonb_array_length(coalesce(p_media, '[]'::jsonb)) > 8 then raise exception 'A listing can contain up to 8 media items'; end if;
  if exists (select 1 from public.marketplace_listings where id = p_listing_id) then
    raise exception 'Listing identifier is already in use';
  end if;
  if (select count(*) from public.marketplace_listings where seller_id = caller and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily listing limit reached';
  end if;

  new_title := trim(coalesce(p_payload ->> 'title', ''));
  new_description := trim(coalesce(p_payload ->> 'description', ''));
  new_category := lower(trim(coalesce(p_payload ->> 'category', '')));
  new_mode := lower(trim(coalesce(p_payload ->> 'mode', '')));
  new_condition := lower(trim(coalesce(p_payload ->> 'condition', '')));
  new_course_code := nullif(trim(p_payload ->> 'course_code'), '');
  new_currency := upper(trim(coalesce(p_payload ->> 'currency', '')));
  new_location := nullif(trim(p_payload ->> 'location_label'), '');
  new_status := lower(trim(coalesce(p_payload ->> 'status', 'active')));
  new_attestation := trim(coalesce(p_payload ->> 'rights_attestation', ''));
  new_basis := lower(trim(coalesce(p_payload ->> 'academic_rights_basis', 'not_applicable')));
  begin
    new_price := (p_payload ->> 'price_minor')::bigint;
  exception when others then raise exception 'Price must be an integer in minor currency units'; end;
  begin
    new_academic_confirmed := coalesce((p_payload ->> 'academic_rights_confirmed')::boolean, false);
  exception when others then raise exception 'Academic-rights confirmation must be true or false'; end;
  begin
    new_negotiable := coalesce((p_payload ->> 'negotiable')::boolean, false);
  exception when others then raise exception 'Negotiable must be true or false'; end;

  if jsonb_typeof(p_payload -> 'delivery_methods') <> 'array' then
    raise exception 'Delivery methods must be a JSON array';
  end if;
  select array_agg(method order by first_position)
  into new_delivery
  from (
    select lower(trim(value)) as method, min(ordinality) as first_position
    from jsonb_array_elements_text(p_payload -> 'delivery_methods') with ordinality as methods(value, ordinality)
    group by lower(trim(value))
  ) normalized_methods;

  if char_length(new_title) not between 3 and 120 then raise exception 'Title must contain 3 to 120 characters'; end if;
  if char_length(new_description) not between 10 and 5000 then raise exception 'Description must contain 10 to 5000 characters'; end if;
  if new_category not in ('notes', 'past_papers', 'textbooks', 'electronics', 'furniture', 'life_essentials', 'services', 'other') then raise exception 'Unsupported marketplace category'; end if;
  if new_mode not in ('sale', 'free', 'wanted') then raise exception 'Unsupported marketplace mode'; end if;
  if new_condition not in ('digital', 'new', 'like_new', 'good', 'fair', 'used', 'not_applicable') then raise exception 'Unsupported item condition'; end if;
  if new_course_code is not null and char_length(new_course_code) > 80 then raise exception 'Course code must contain no more than 80 characters'; end if;
  if new_price < 0 or new_price > 999999999999 or (new_mode = 'free' and new_price <> 0) or (new_mode = 'sale' and new_price = 0) then raise exception 'Price does not match the listing mode'; end if;
  if new_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if cardinality(coalesce(new_delivery, '{}'::text[])) not between 1 and 3 or not (new_delivery <@ array['digital', 'meetup', 'shipping']::text[]) then raise exception 'Choose one or more supported delivery methods'; end if;
  if new_location is not null and char_length(new_location) > 120 then raise exception 'Location must contain no more than 120 characters'; end if;
  if new_status not in ('draft', 'active') then raise exception 'A new listing must be a draft or active'; end if;
  if char_length(new_attestation) not between 20 and 600 then raise exception 'A complete seller rights attestation is required'; end if;
  if new_basis not in ('original', 'licensed', 'public_domain', 'not_applicable') then raise exception 'Unsupported academic-rights basis'; end if;
  if new_category in ('notes', 'past_papers') and (not new_academic_confirmed or new_basis = 'not_applicable') then raise exception 'Confirm the right to distribute this academic material'; end if;
  if new_category = 'past_papers' and new_basis not in ('licensed', 'public_domain') then raise exception 'Past papers require a licensed or public-domain distribution basis'; end if;

  insert into public.marketplace_listings (
    id, school_key, seller_id, title, description, category, mode,
    item_condition, course_code, negotiable, price_minor, currency, delivery_methods, location_label,
    status, rights_attestation, academic_rights_basis, academic_rights_confirmed_at
  ) values (
    p_listing_id, caller_school, caller, new_title, new_description, new_category, new_mode,
    new_condition, new_course_code, new_negotiable, new_price, new_currency, new_delivery, new_location,
    new_status, new_attestation, new_basis,
    case when new_category in ('notes', 'past_papers') then now() else null end
  );

  for media_item in select value from jsonb_array_elements(coalesce(p_media, '[]'::jsonb))
  loop
    if jsonb_typeof(media_item) <> 'object' then raise exception 'Each media item must be a JSON object'; end if;
    begin media_id := (media_item ->> 'id')::uuid;
    exception when others then raise exception 'Media identifier must be a UUID'; end;
    media_path := nullif(trim(media_item ->> 'storage_path'), '');
    media_kind := lower(nullif(trim(media_item ->> 'media_type'), ''));
    media_mime := lower(nullif(trim(media_item ->> 'mime_type'), ''));
    media_alt := nullif(trim(media_item ->> 'alt_text'), '');
    begin media_position := (media_item ->> 'position')::smallint;
    exception when others then raise exception 'Media position must be an integer from 0 to 7'; end;
    if media_id is null or media_id = any(seen_media_ids) then raise exception 'Media IDs must be present and unique'; end if;
    if media_position is null or media_position not between 0 and 7 or media_position = any(seen_positions) then raise exception 'Media positions must be unique integers from 0 to 7'; end if;
    seen_media_ids := array_append(seen_media_ids, media_id);
    seen_positions := array_append(seen_positions, media_position);
    if media_kind = 'image' and media_mime = 'image/webp' then expected_suffix := '.webp';
    elsif media_kind = 'image' and media_mime = 'image/jpeg' then expected_suffix := '.jpg';
    elsif media_kind = 'image' and media_mime = 'image/png' then expected_suffix := '.png';
    elsif media_kind = 'video' and media_mime = 'video/mp4' then expected_suffix := '.mp4';
    elsif media_kind = 'video' and media_mime = 'video/webm' then expected_suffix := '.webm';
    elsif media_kind = 'video' and media_mime = 'video/quicktime' then expected_suffix := '.mov';
    else raise exception 'Unsupported marketplace media type'; end if;
    if media_path <> caller::text || '/listings/' || p_listing_id::text || '/' || media_id::text || expected_suffix then raise exception 'Media path must match its owner, listing, identifier, and MIME type'; end if;
    if media_alt is not null and char_length(media_alt) > 300 then raise exception 'Media description must contain no more than 300 characters'; end if;
    if not exists (
      select 1 from storage.objects object
      where object.bucket_id = 'marketplace-media'
        and object.name = media_path and object.owner_id = caller::text
    ) then raise exception 'Upload each marketplace media object before publishing'; end if;

    insert into public.marketplace_listing_media (
      id, listing_id, owner_id, storage_path, media_type, mime_type,
      width, height, duration_seconds, alt_text, position
    ) values (
      media_id, p_listing_id, caller, media_path, media_kind, media_mime,
      case when coalesce(media_item ->> 'width', '') ~ '^[0-9]+$' then (media_item ->> 'width')::integer else null end,
      case when coalesce(media_item ->> 'height', '') ~ '^[0-9]+$' then (media_item ->> 'height')::integer else null end,
      case when coalesce(media_item ->> 'duration_seconds', '') ~ '^[0-9]+([.][0-9]+)?$' then (media_item ->> 'duration_seconds')::numeric else null end,
      media_alt, media_position
    );
  end loop;

  return private.marketplace_listing_json(p_listing_id, caller);
end;
$$;

revoke all on function public.create_marketplace_listing(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_marketplace_listing(uuid, jsonb, jsonb) to authenticated;

create or replace function public.update_marketplace_listing(
  p_listing_id uuid,
  p_expected_version integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  old_row public.marketplace_listings%rowtype;
  next_title text;
  next_description text;
  next_category text;
  next_mode text;
  next_condition text;
  next_course_code text;
  next_negotiable boolean;
  next_price bigint;
  next_currency text;
  next_delivery text[];
  next_location text;
  next_attestation text;
  next_basis text;
  next_academic_confirmed boolean;
  pending_order public.marketplace_orders%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Listing payload must be a JSON object'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:marketplace-order:' || p_listing_id::text, 0)
  );
  select * into old_row from public.marketplace_listings where id = p_listing_id for update;
  if not found or old_row.seller_id <> caller or old_row.school_key <> caller_school then raise exception 'Listing is unavailable'; end if;
  if old_row.version is distinct from p_expected_version then raise exception 'Listing changed; refresh before saving again'; end if;
  if old_row.status not in ('draft', 'active', 'paused') then raise exception 'This listing can no longer be edited'; end if;

  next_title := case when p_payload ? 'title' then trim(coalesce(p_payload ->> 'title', '')) else old_row.title end;
  next_description := case when p_payload ? 'description' then trim(coalesce(p_payload ->> 'description', '')) else old_row.description end;
  next_category := case when p_payload ? 'category' then lower(trim(coalesce(p_payload ->> 'category', ''))) else old_row.category end;
  next_mode := case when p_payload ? 'mode' then lower(trim(coalesce(p_payload ->> 'mode', ''))) else old_row.mode end;
  next_condition := case when p_payload ? 'condition' then lower(trim(coalesce(p_payload ->> 'condition', ''))) else old_row.item_condition end;
  next_course_code := case when p_payload ? 'course_code' then nullif(trim(p_payload ->> 'course_code'), '') else old_row.course_code end;
  next_currency := case when p_payload ? 'currency' then upper(trim(coalesce(p_payload ->> 'currency', ''))) else old_row.currency end;
  next_location := case when p_payload ? 'location_label' then nullif(trim(p_payload ->> 'location_label'), '') else old_row.location_label end;
  next_attestation := case when p_payload ? 'rights_attestation' then trim(coalesce(p_payload ->> 'rights_attestation', '')) else old_row.rights_attestation end;
  next_basis := case when p_payload ? 'academic_rights_basis' then lower(trim(coalesce(p_payload ->> 'academic_rights_basis', ''))) else old_row.academic_rights_basis end;
  begin
    next_price := case when p_payload ? 'price_minor' then (p_payload ->> 'price_minor')::bigint else old_row.price_minor end;
  exception when others then raise exception 'Price must be an integer in minor currency units'; end;
  begin
    next_academic_confirmed := case
      when p_payload ? 'academic_rights_confirmed' then coalesce((p_payload ->> 'academic_rights_confirmed')::boolean, false)
      else old_row.academic_rights_confirmed_at is not null
    end;
  exception when others then raise exception 'Academic-rights confirmation must be true or false'; end;
  begin
    next_negotiable := case when p_payload ? 'negotiable' then coalesce((p_payload ->> 'negotiable')::boolean, false) else old_row.negotiable end;
  exception when others then raise exception 'Negotiable must be true or false'; end;

  if p_payload ? 'delivery_methods' then
    if jsonb_typeof(p_payload -> 'delivery_methods') <> 'array' then raise exception 'Delivery methods must be a JSON array'; end if;
    select array_agg(method order by first_position) into next_delivery
    from (
      select lower(trim(value)) as method, min(ordinality) as first_position
      from jsonb_array_elements_text(p_payload -> 'delivery_methods') with ordinality as methods(value, ordinality)
      group by lower(trim(value))
    ) normalized_methods;
  else next_delivery := old_row.delivery_methods;
  end if;

  if char_length(next_title) not between 3 and 120 then raise exception 'Title must contain 3 to 120 characters'; end if;
  if char_length(next_description) not between 10 and 5000 then raise exception 'Description must contain 10 to 5000 characters'; end if;
  if next_category not in ('notes', 'past_papers', 'textbooks', 'electronics', 'furniture', 'life_essentials', 'services', 'other') then raise exception 'Unsupported marketplace category'; end if;
  if next_mode not in ('sale', 'free', 'wanted') then raise exception 'Unsupported marketplace mode'; end if;
  if next_condition not in ('digital', 'new', 'like_new', 'good', 'fair', 'used', 'not_applicable') then raise exception 'Unsupported item condition'; end if;
  if next_course_code is not null and char_length(next_course_code) > 80 then raise exception 'Course code must contain no more than 80 characters'; end if;
  if next_price < 0 or next_price > 999999999999 or (next_mode = 'free' and next_price <> 0) or (next_mode = 'sale' and next_price = 0) then raise exception 'Price does not match the listing mode'; end if;
  if next_currency !~ '^[A-Z]{3}$' then raise exception 'Currency must be a three-letter ISO code'; end if;
  if cardinality(coalesce(next_delivery, '{}'::text[])) not between 1 and 3 or not (next_delivery <@ array['digital', 'meetup', 'shipping']::text[]) then raise exception 'Choose one or more supported delivery methods'; end if;
  if next_location is not null and char_length(next_location) > 120 then raise exception 'Location must contain no more than 120 characters'; end if;
  if char_length(next_attestation) not between 20 and 600 then raise exception 'A complete seller rights attestation is required'; end if;
  if next_basis not in ('original', 'licensed', 'public_domain', 'not_applicable') then raise exception 'Unsupported academic-rights basis'; end if;
  if next_category in ('notes', 'past_papers') and (not next_academic_confirmed or next_basis = 'not_applicable') then raise exception 'Confirm the right to distribute this academic material'; end if;
  if next_category = 'past_papers' and next_basis not in ('licensed', 'public_domain') then raise exception 'Past papers require a licensed or public-domain distribution basis'; end if;

  update public.marketplace_listings set
    title = next_title, description = next_description, category = next_category,
    mode = next_mode, item_condition = next_condition, course_code = next_course_code,
    negotiable = next_negotiable, price_minor = next_price,
    currency = next_currency, delivery_methods = next_delivery,
    location_label = next_location, rights_attestation = next_attestation,
    academic_rights_basis = next_basis,
    academic_rights_confirmed_at = case when next_category in ('notes', 'past_papers') and next_academic_confirmed then now() else null end,
    version = version + 1
  where id = p_listing_id;

  -- An awaiting checkout is only a provider setup attempt, not a reservation.
  -- Any seller edit invalidates its immutable listing snapshot before funds can
  -- be held, preventing a stale price, delivery method, or rights claim.
  for pending_order in
    select * from public.marketplace_orders orders
    where orders.listing_id = p_listing_id and orders.status = 'awaiting_payment'
    for update
  loop
    update public.marketplace_orders set
      status = 'cancelled', cancelled_at = now(), version = version + 1
    where id = pending_order.id;
    update private.marketplace_payment_projections set
      payment_state = 'failed', updated_at = now()
    where order_id = pending_order.id and payment_state in ('provider_required', 'pending');
    update public.marketplace_offers set status = 'declined'
    where id = pending_order.offer_id and status = 'accepted';
    perform private.append_marketplace_order_event(
      pending_order.id, caller, 'cancelled', 'awaiting_payment', 'cancelled',
      jsonb_build_object('reason', 'listing_updated')
    );
  end loop;

  if old_row.price_minor <> next_price or old_row.currency <> next_currency or old_row.mode <> next_mode then
    update public.marketplace_offers set status = 'declined'
    where listing_id = p_listing_id and status = 'pending';
  end if;
  return private.marketplace_listing_json(p_listing_id, caller);
end;
$$;

revoke all on function public.update_marketplace_listing(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.update_marketplace_listing(uuid, integer, jsonb) to authenticated;

create or replace function public.set_marketplace_listing_status(p_listing_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  pending_order public.marketplace_orders%rowtype;
  next_status text := lower(trim(coalesce(p_status, '')));
begin
  if caller is null then raise exception 'Authentication required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:marketplace-order:' || p_listing_id::text, 0)
  );
  select * into listing_row from public.marketplace_listings where id = p_listing_id for update;
  if not found or listing_row.seller_id <> caller then raise exception 'Listing is unavailable'; end if;
  if next_status not in ('active', 'paused', 'sold', 'deleted') then raise exception 'Unsupported seller-controlled listing status'; end if;
  if listing_row.status not in ('draft', 'active', 'paused')
     and not (listing_row.status = 'sold' and next_status = 'deleted') then
    raise exception 'This listing status is managed by its order';
  end if;
  if next_status = 'active' and (caller_school is null or caller_school <> listing_row.school_key) then
    raise exception 'Verified school membership is required to activate a listing';
  end if;
  if next_status in ('active', 'sold') and exists (
    select 1 from public.marketplace_orders orders
    where orders.listing_id = p_listing_id and orders.status in ('payment_held', 'fulfilled', 'disputed')
  ) then raise exception 'This listing has an open order'; end if;

  if next_status in ('paused', 'sold', 'deleted') then
    for pending_order in
      select * from public.marketplace_orders orders
      where orders.listing_id = p_listing_id and orders.status = 'awaiting_payment'
      for update
    loop
      update public.marketplace_orders set
        status = 'cancelled', cancelled_at = now(), version = version + 1
      where id = pending_order.id;
      update private.marketplace_payment_projections set
        payment_state = 'failed', updated_at = now()
      where order_id = pending_order.id and payment_state in ('provider_required', 'pending');
      update public.marketplace_offers set status = 'declined'
      where id = pending_order.offer_id and status = 'accepted';
      perform private.append_marketplace_order_event(
        pending_order.id, caller, 'cancelled', 'awaiting_payment', 'cancelled',
        jsonb_build_object('reason', 'listing_' || next_status)
      );
    end loop;
  end if;

  update public.marketplace_listings set
    status = next_status,
    deleted_at = case when next_status = 'deleted' then now() else null end,
    version = version + 1
  where id = p_listing_id;
  if next_status in ('paused', 'sold', 'deleted') then
    update public.marketplace_offers set status = 'declined'
    where listing_id = p_listing_id and status = 'pending';
  end if;
  return private.marketplace_listing_json(p_listing_id, caller);
end;
$$;

revoke all on function public.set_marketplace_listing_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_marketplace_listing_status(uuid, text) to authenticated;

create or replace function public.toggle_marketplace_favorite(p_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  seller uuid;
  is_favorite boolean;
  total bigint;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select seller_id into seller from public.marketplace_listings
  where id = p_listing_id and school_key = caller_school and status in ('active', 'reserved');
  if seller is null then raise exception 'Listing is unavailable'; end if;
  if not exists (
    select 1 from public.school_memberships seller_membership
    where seller_membership.user_id = seller
      and seller_membership.school_key = caller_school
      and seller_membership.status = 'verified'
  ) then raise exception 'Listing is unavailable'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = seller)
       or (block.blocker_id = seller and block.blocked_id = caller)
  ) then raise exception 'Listing is unavailable'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'concourse:marketplace-favorite:' || caller::text || ':' || p_listing_id::text,
      0
    )
  );

  delete from public.marketplace_favorites where listing_id = p_listing_id and user_id = caller;
  if found then is_favorite := false;
  else
    insert into public.marketplace_favorites (listing_id, user_id) values (p_listing_id, caller);
    is_favorite := true;
  end if;
  select count(*) into total from public.marketplace_favorites where listing_id = p_listing_id;
  return jsonb_build_object('listing_id', p_listing_id, 'favorited', is_favorite, 'favorite_count', total);
end;
$$;

revoke all on function public.toggle_marketplace_favorite(uuid) from public, anon, authenticated;
grant execute on function public.toggle_marketplace_favorite(uuid) to authenticated;

create or replace function public.make_marketplace_offer(
  p_listing_id uuid,
  p_amount_minor bigint,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  offer_row public.marketplace_offers%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  select * into listing_row from public.marketplace_listings where id = p_listing_id for update;
  if not found
     or listing_row.school_key <> caller_school
     or listing_row.status <> 'active'
     or listing_row.mode <> 'sale'
     or not listing_row.negotiable then
    raise exception 'Listing is not accepting offers';
  end if;
  if not exists (
    select 1 from public.school_memberships seller_membership
    where seller_membership.user_id = listing_row.seller_id
      and seller_membership.school_key = caller_school
      and seller_membership.status = 'verified'
  ) then raise exception 'Listing is not accepting offers'; end if;
  if listing_row.seller_id = caller then raise exception 'You cannot offer on your own listing'; end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > listing_row.price_minor then raise exception 'Offer must be positive and no greater than the listing price'; end if;
  if char_length(coalesce(p_message, '')) > 500 then raise exception 'Offer message must contain no more than 500 characters'; end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = caller and block.blocked_id = listing_row.seller_id)
       or (block.blocker_id = listing_row.seller_id and block.blocked_id = caller)
  ) then raise exception 'Listing is unavailable'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'concourse:marketplace-offer:' || caller::text || ':' || p_listing_id::text,
      0
    )
  );
  if (select count(*) from public.marketplace_offers where buyer_id = caller and created_at > now() - interval '1 hour') >= 30 then raise exception 'Please wait before making another offer'; end if;

  select * into offer_row from public.marketplace_offers
  where listing_id = p_listing_id and buyer_id = caller and status = 'pending' for update;
  if found then
    update public.marketplace_offers set amount_minor = p_amount_minor, message = nullif(trim(p_message), '')
    where id = offer_row.id returning * into offer_row;
  else
    insert into public.marketplace_offers (listing_id, buyer_id, amount_minor, message)
    values (p_listing_id, caller, p_amount_minor, nullif(trim(p_message), '')) returning * into offer_row;
  end if;
  return jsonb_build_object(
    'offer_id', offer_row.id, 'listing_id', p_listing_id,
    'amount_minor', offer_row.amount_minor, 'currency', listing_row.currency,
    'status', offer_row.status, 'created_at', offer_row.created_at
  );
end;
$$;

revoke all on function public.make_marketplace_offer(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.make_marketplace_offer(uuid, bigint, text) to authenticated;

create or replace function public.create_marketplace_order(
  p_listing_id uuid,
  p_offer_id uuid,
  p_delivery_method text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  listing_row public.marketplace_listings%rowtype;
  offer_row public.marketplace_offers%rowtype;
  existing_order public.marketplace_orders%rowtype;
  expired_order public.marketplace_orders%rowtype;
  buyer uuid;
  order_amount bigint;
  order_id uuid;
  delivery text := lower(trim(coalesce(p_delivery_method, '')));
  snapshot jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_listing_id is null or p_idempotency_key is null then raise exception 'Listing and idempotency identifiers are required'; end if;

  select * into existing_order from public.marketplace_orders
  where idempotency_actor_id = caller and idempotency_key = p_idempotency_key;
  if found then
    if existing_order.listing_id <> p_listing_id then
      raise exception 'Idempotency key was already used for a different listing';
    end if;
    return jsonb_build_object(
      'order_id', existing_order.id, 'status', existing_order.status,
      'payment_state', (private.marketplace_payment_json(existing_order.id) ->> 'payment_state'),
      'amount_minor', existing_order.amount_minor, 'currency', existing_order.currency,
      'expires_at', existing_order.expires_at, 'idempotent_replay', true
    );
  end if;

  if not coalesce((
    select setting.checkout_enabled
    from private.marketplace_runtime_settings setting
    where setting.singleton = true
  ), false) then
    raise exception 'Secure checkout is not available until the payment provider is activated';
  end if;
  if (select count(*) from public.marketplace_orders
      where idempotency_actor_id = caller and created_at > now() - interval '1 hour') >= 12 then
    raise exception 'Please wait before starting another checkout';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:marketplace-order:' || p_listing_id::text, 0)
  );
  select * into listing_row from public.marketplace_listings where id = p_listing_id for update;
  if not found or listing_row.school_key <> caller_school then raise exception 'Listing is unavailable'; end if;
  if not exists (
    select 1 from public.school_memberships seller_membership
    where seller_membership.user_id = listing_row.seller_id
      and seller_membership.school_key = caller_school
      and seller_membership.status = 'verified'
  ) then raise exception 'Listing is unavailable'; end if;

  for expired_order in
    select * from public.marketplace_orders
    where listing_id = p_listing_id and status = 'awaiting_payment' and expires_at <= now()
    for update
  loop
    update public.marketplace_orders set status = 'cancelled', cancelled_at = now(), version = version + 1
    where id = expired_order.id;
    update private.marketplace_payment_projections set payment_state = 'failed', updated_at = now()
    where order_id = expired_order.id and payment_state in ('provider_required', 'pending');
    update public.marketplace_offers set status = 'expired'
    where id = expired_order.offer_id and status = 'accepted';
    perform private.append_marketplace_order_event(
      expired_order.id, null, 'cancelled', 'awaiting_payment', 'cancelled',
      jsonb_build_object('reason', 'payment_window_expired')
    );
  end loop;
  if listing_row.status <> 'active' or listing_row.mode = 'wanted' then raise exception 'Listing is not available for checkout'; end if;
  if not (delivery = any(listing_row.delivery_methods)) then raise exception 'Choose one of the listing delivery methods'; end if;

  if p_offer_id is null then
    if listing_row.seller_id = caller then raise exception 'You cannot buy your own listing'; end if;
    buyer := caller;
    order_amount := listing_row.price_minor;
  else
    if listing_row.seller_id <> caller then raise exception 'Only the seller can accept this offer'; end if;
    select * into offer_row from public.marketplace_offers
    where id = p_offer_id and listing_id = p_listing_id and status = 'pending' for update;
    if not found then raise exception 'Offer is unavailable'; end if;
    buyer := offer_row.buyer_id;
    order_amount := offer_row.amount_minor;
  end if;
  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = buyer and block.blocked_id = listing_row.seller_id)
       or (block.blocker_id = listing_row.seller_id and block.blocked_id = buyer)
  ) then raise exception 'Checkout is unavailable'; end if;
  if not exists (
    select 1 from public.school_memberships membership
    where membership.user_id = buyer and membership.school_key = caller_school and membership.status = 'verified'
  ) then raise exception 'Buyer is no longer a verified school member'; end if;

  select * into existing_order from public.marketplace_orders orders
  where orders.listing_id = p_listing_id
    and orders.buyer_id = buyer
    and orders.status = 'awaiting_payment'
  for update;
  if found then
    if p_offer_id is null then
      raise exception 'You already have an awaiting-payment checkout for this listing';
    end if;
    update public.marketplace_orders set status = 'cancelled', cancelled_at = now(), version = version + 1
    where id = existing_order.id;
    update private.marketplace_payment_projections set payment_state = 'failed', updated_at = now()
    where order_id = existing_order.id and payment_state in ('provider_required', 'pending');
    update public.marketplace_offers set status = 'declined'
    where id = existing_order.offer_id and status = 'accepted';
    perform private.append_marketplace_order_event(
      existing_order.id, caller, 'cancelled', 'awaiting_payment', 'cancelled',
      jsonb_build_object('reason', 'superseded_by_accepted_offer')
    );
  end if;
  if exists (
    select 1 from public.marketplace_orders orders where orders.listing_id = p_listing_id
      and orders.status in ('payment_held', 'fulfilled', 'disputed')
  ) then raise exception 'Listing already has an open order'; end if;

  snapshot := jsonb_build_object(
    'listing_id', listing_row.id, 'title', listing_row.title,
    'description', listing_row.description, 'category', listing_row.category,
    'mode', listing_row.mode, 'condition', listing_row.item_condition,
    'course_code', listing_row.course_code, 'negotiable', listing_row.negotiable,
    'price_minor', order_amount, 'currency', listing_row.currency,
    'delivery_method', delivery,
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', media.id, 'storage_path', media.storage_path,
        'media_type', media.media_type, 'mime_type', media.mime_type,
        'alt_text', media.alt_text, 'position', media.position
      ) order by media.position)
      from public.marketplace_listing_media media where media.listing_id = p_listing_id
    ), '[]'::jsonb)
  );

  insert into public.marketplace_orders (
    listing_id, school_key, seller_id, buyer_id, offer_id, amount_minor,
    currency, delivery_method, status, listing_snapshot,
    idempotency_actor_id, idempotency_key
  ) values (
    p_listing_id, caller_school, listing_row.seller_id, buyer, p_offer_id,
    order_amount, listing_row.currency, delivery, 'awaiting_payment', snapshot,
    caller, p_idempotency_key
  ) returning id into order_id;

  insert into private.marketplace_payment_projections (
    order_id, payment_state, gross_minor, fee_minor, seller_receivable_minor, currency
  ) values (order_id, 'provider_required', order_amount, 0, order_amount, listing_row.currency);
  if p_offer_id is not null then
    update public.marketplace_offers set status = 'accepted' where id = p_offer_id;
  end if;
  perform private.append_marketplace_order_event(
    order_id, caller, 'created', null, 'awaiting_payment',
    jsonb_build_object('delivery_method', delivery, 'payment_state', 'provider_required')
  );

  return jsonb_build_object(
    'order_id', order_id, 'status', 'awaiting_payment',
    'payment_state', 'provider_required', 'amount_minor', order_amount,
    'currency', listing_row.currency, 'expires_at', now() + interval '30 minutes',
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.create_marketplace_order(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_marketplace_order(uuid, uuid, text, uuid) to authenticated;

create or replace function public.mark_marketplace_order_fulfilled(p_order_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  order_row public.marketplace_orders%rowtype;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into order_row from public.marketplace_orders where id = p_order_id for update;
  if not found or order_row.seller_id <> caller then raise exception 'Order is unavailable'; end if;
  if order_row.status <> 'payment_held' then raise exception 'The payment provider must confirm held funds before fulfillment'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'Fulfillment note must contain no more than 1000 characters'; end if;
  if (private.marketplace_payment_json(p_order_id) ->> 'payment_state') <> 'held' then raise exception 'Held payment confirmation is required'; end if;
  update public.marketplace_orders set
    status = 'fulfilled', fulfilled_note = nullif(trim(p_note), ''),
    fulfilled_at = now(), version = version + 1
  where id = p_order_id;
  perform private.append_marketplace_order_event(
    p_order_id, caller, 'fulfilled', 'payment_held', 'fulfilled',
    jsonb_build_object('note_supplied', nullif(trim(p_note), '') is not null)
  );
  return jsonb_build_object('order_id', p_order_id, 'status', 'fulfilled', 'fulfilled_at', now());
end;
$$;

revoke all on function public.mark_marketplace_order_fulfilled(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_marketplace_order_fulfilled(uuid, text) to authenticated;

create or replace function public.accept_marketplace_order(
  p_order_id uuid,
  p_rating integer,
  p_review text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  order_row public.marketplace_orders%rowtype;
  order_listing_id uuid;
  review_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select orders.listing_id into order_listing_id
  from public.marketplace_orders orders
  where orders.id = p_order_id and orders.buyer_id = caller;
  if order_listing_id is null then raise exception 'Order is unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:marketplace-order:' || order_listing_id::text, 0)
  );
  select * into order_row from public.marketplace_orders where id = p_order_id for update;
  if not found or order_row.buyer_id <> caller then raise exception 'Order is unavailable'; end if;
  if order_row.status <> 'fulfilled' then raise exception 'The seller must mark this order fulfilled before acceptance'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if p_rating is null and nullif(trim(p_review), '') is not null then raise exception 'Choose a rating before writing a review'; end if;
  if char_length(coalesce(p_review, '')) > 1500 then raise exception 'Review must contain no more than 1500 characters'; end if;
  if (private.marketplace_payment_json(p_order_id) ->> 'payment_state') <> 'held' then raise exception 'Held payment confirmation is required'; end if;
  if exists (
    select 1 from public.marketplace_disputes dispute
    where dispute.order_id = p_order_id and dispute.status in ('open', 'under_review')
  ) then raise exception 'Resolve the open dispute before accepting the order'; end if;

  update public.marketplace_orders set status = 'accepted', accepted_at = now(), version = version + 1
  where id = p_order_id;
  update public.marketplace_listings set status = 'sold', version = version + 1
  where id = order_row.listing_id;
  if p_rating is not null then
    insert into public.marketplace_reviews (order_id, reviewer_id, reviewee_id, rating, body)
    values (p_order_id, caller, order_row.seller_id, p_rating::smallint, nullif(trim(p_review), ''))
    returning id into review_id;
  end if;
  perform private.append_marketplace_order_event(
    p_order_id, caller, 'accepted', 'fulfilled', 'accepted',
    jsonb_build_object('rating_supplied', p_rating is not null)
  );
  return jsonb_build_object(
    'order_id', p_order_id, 'status', 'accepted',
    'payment_state', 'held', 'accepted_at', now(), 'review_id', review_id
  );
end;
$$;

revoke all on function public.accept_marketplace_order(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.accept_marketplace_order(uuid, integer, text) to authenticated;

create or replace function public.open_marketplace_dispute(
  p_order_id uuid,
  p_reason text,
  p_details text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  order_row public.marketplace_orders%rowtype;
  dispute_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  select * into order_row from public.marketplace_orders where id = p_order_id for update;
  if not found or (caller <> order_row.buyer_id and caller <> order_row.seller_id) then raise exception 'Order is unavailable'; end if;
  if order_row.status not in ('payment_held', 'fulfilled') then raise exception 'This order cannot enter dispute review'; end if;
  if (private.marketplace_payment_json(p_order_id) ->> 'payment_state') not in ('held', 'release_pending') then
    raise exception 'The protected-payment dispute window has ended';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 80 then raise exception 'Dispute reason must contain 3 to 80 characters'; end if;
  if char_length(trim(coalesce(p_details, ''))) not between 10 and 2000 then raise exception 'Dispute details must contain 10 to 2000 characters'; end if;
  if exists (select 1 from public.marketplace_disputes where order_id = p_order_id) then raise exception 'This order already has a dispute record'; end if;
  if (select count(*) from public.marketplace_disputes where opened_by = caller and created_at > now() - interval '1 day') >= 10 then raise exception 'Daily dispute limit reached'; end if;

  insert into public.marketplace_disputes (
    order_id, opened_by, opened_from_status, reason, details
  ) values (
    p_order_id, caller, order_row.status, trim(p_reason), trim(p_details)
  ) returning id into dispute_id;
  update public.marketplace_orders set status = 'disputed', version = version + 1 where id = p_order_id;
  perform private.append_marketplace_order_event(
    p_order_id, caller, 'disputed', order_row.status, 'disputed',
    jsonb_build_object('dispute_id', dispute_id, 'reason', trim(p_reason))
  );
  return jsonb_build_object('dispute_id', dispute_id, 'order_id', p_order_id, 'status', 'open');
end;
$$;

revoke all on function public.open_marketplace_dispute(uuid, text, text) from public, anon, authenticated;
grant execute on function public.open_marketplace_dispute(uuid, text, text) to authenticated;

create or replace function public.report_marketplace_listing(p_listing_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  seller uuid;
  report_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 3 and 500 then raise exception 'Report reason must contain 3 to 500 characters'; end if;
  select seller_id into seller from public.marketplace_listings
  where id = p_listing_id and school_key = caller_school and status <> 'deleted';
  if seller is null or seller = caller then raise exception 'Listing is unavailable for reporting'; end if;
  if exists (
    select 1 from public.marketplace_reports report
    where report.listing_id = p_listing_id and report.reporter_id = caller
      and report.status in ('open', 'reviewing')
  ) then raise exception 'You already reported this listing'; end if;
  if (select count(*) from public.marketplace_reports where reporter_id = caller and created_at > now() - interval '1 hour') >= 20 then raise exception 'Please wait before submitting another report'; end if;
  insert into public.marketplace_reports (listing_id, reporter_id, reason)
  values (p_listing_id, caller, trim(p_reason)) returning id into report_id;
  return jsonb_build_object('report_id', report_id, 'listing_id', p_listing_id, 'status', 'open');
end;
$$;

revoke all on function public.report_marketplace_listing(uuid, text) from public, anon, authenticated;
grant execute on function public.report_marketplace_listing(uuid, text) to authenticated;

create or replace function public.configure_marketplace_checkout(
  p_enabled boolean,
  p_payment_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_name text := nullif(trim(p_payment_provider), '');
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if coalesce(p_enabled, false)
     and char_length(coalesce(provider_name, '')) not between 2 and 80 then
    raise exception 'A configured payment provider is required before enabling checkout';
  end if;
  insert into private.marketplace_runtime_settings (
    singleton, checkout_enabled, payment_provider, updated_at
  ) values (
    true, coalesce(p_enabled, false), provider_name, now()
  ) on conflict (singleton) do update set
    checkout_enabled = excluded.checkout_enabled,
    payment_provider = excluded.payment_provider,
    updated_at = excluded.updated_at;
  return jsonb_build_object(
    'checkout_enabled', coalesce(p_enabled, false),
    'payment_provider', provider_name
  );
end;
$$;

revoke all on function public.configure_marketplace_checkout(boolean, text)
  from public, anon, authenticated;
grant execute on function public.configure_marketplace_checkout(boolean, text)
  to service_role;

-- Trusted webhook-only state transition. Never grant this function to browser
-- roles. It is idempotent on the provider event ID and maintains the public
-- order state, private seller projection, immutable audit trail, and listing.
create or replace function public.apply_marketplace_payment_event(
  p_order_id uuid,
  p_provider text,
  p_provider_reference text,
  p_provider_event_id text,
  p_state text,
  p_fee_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.marketplace_orders%rowtype;
  payment_row private.marketplace_payment_projections%rowtype;
  existing_provider_event private.marketplace_payment_provider_events%rowtype;
  next_state text := lower(trim(coalesce(p_state, '')));
  old_order_status text;
  effective_fee bigint;
  configured_provider text;
  superseded_order public.marketplace_orders%rowtype;
  order_listing_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required'; end if;
  if char_length(trim(coalesce(p_provider, ''))) not between 2 and 80
     or char_length(trim(coalesce(p_provider_reference, ''))) not between 2 and 240
     or char_length(trim(coalesce(p_provider_event_id, ''))) not between 4 and 240 then
    raise exception 'Complete provider identifiers are required';
  end if;
  if next_state not in ('pending', 'held', 'released', 'refunded', 'failed') then raise exception 'Unsupported provider payment state'; end if;

  select orders.listing_id into order_listing_id
  from public.marketplace_orders orders where orders.id = p_order_id;
  if order_listing_id is null then raise exception 'Order is unavailable'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('concourse:marketplace-order:' || order_listing_id::text, 0)
  );
  select * into order_row from public.marketplace_orders where id = p_order_id for update;
  if not found then raise exception 'Order is unavailable'; end if;
  select * into payment_row from private.marketplace_payment_projections where order_id = p_order_id for update;
  if not found then raise exception 'Payment projection is unavailable'; end if;
  select setting.payment_provider into configured_provider
  from private.marketplace_runtime_settings setting where setting.singleton = true;
  if configured_provider is not null and configured_provider <> trim(p_provider) then
    raise exception 'Payment event provider does not match the configured provider';
  end if;
  effective_fee := coalesce(p_fee_minor, payment_row.fee_minor);
  if effective_fee < 0 or effective_fee > payment_row.gross_minor then raise exception 'Invalid provider fee'; end if;

  insert into private.marketplace_payment_provider_events (
    provider_event_id, order_id, provider, provider_reference, payment_state, fee_minor
  ) values (
    trim(p_provider_event_id), p_order_id, trim(p_provider), trim(p_provider_reference),
    next_state, effective_fee
  ) on conflict (provider_event_id) do nothing;
  if not found then
    select * into existing_provider_event
    from private.marketplace_payment_provider_events provider_event
    where provider_event.provider_event_id = trim(p_provider_event_id);
    if not found
       or existing_provider_event.order_id <> p_order_id
       or existing_provider_event.provider <> trim(p_provider)
       or existing_provider_event.provider_reference is distinct from trim(p_provider_reference)
       or existing_provider_event.payment_state <> next_state
       or existing_provider_event.fee_minor is distinct from effective_fee then
      raise exception 'Provider event replay payload does not match its original event';
    end if;
    return jsonb_build_object(
      'order_id', p_order_id, 'order_status', order_row.status,
      'payment_state', payment_row.payment_state, 'idempotent_replay', true
    );
  end if;

  if next_state = 'pending' and payment_row.payment_state not in ('provider_required', 'pending') then raise exception 'Invalid transition to pending payment'; end if;
  if next_state = 'held' and (
    payment_row.payment_state not in ('provider_required', 'pending')
    or order_row.status <> 'awaiting_payment'
    or order_row.expires_at <= now()
  ) then raise exception 'Invalid transition to held payment'; end if;
  if next_state = 'released' and (
    payment_row.payment_state not in ('held', 'release_pending')
    or order_row.status not in ('accepted', 'disputed')
  ) then raise exception 'Only an accepted or adjudicated held order may be released'; end if;
  if next_state = 'refunded' and payment_row.payment_state not in ('held', 'release_pending', 'refund_pending') then raise exception 'Invalid transition to refunded payment'; end if;
  if next_state = 'failed' and payment_row.payment_state not in ('provider_required', 'pending') then raise exception 'Invalid transition to failed payment'; end if;

  old_order_status := order_row.status;
  update private.marketplace_payment_projections set
    provider = trim(p_provider), provider_reference = trim(p_provider_reference),
    payment_state = next_state, fee_minor = effective_fee,
    seller_receivable_minor = gross_minor - effective_fee,
    held_at = case when next_state = 'held' then coalesce(held_at, now()) else held_at end,
    released_at = case when next_state = 'released' then now() else released_at end,
    refunded_at = case when next_state = 'refunded' then now() else refunded_at end,
    updated_at = now()
  where order_id = p_order_id;

  if next_state = 'pending' then
    perform private.append_marketplace_order_event(p_order_id, null, 'payment_pending', order_row.status, order_row.status, '{}'::jsonb);
  elsif next_state = 'held' then
    perform 1 from public.marketplace_listings listing
    where listing.id = order_row.listing_id and listing.status = 'active'
    for update;
    if not found then raise exception 'Listing is no longer available; provider must void or refund this payment'; end if;
    if exists (
      select 1 from public.marketplace_orders other_order
      where other_order.listing_id = order_row.listing_id
        and other_order.id <> p_order_id
        and other_order.status in ('payment_held', 'fulfilled', 'disputed')
    ) then raise exception 'Another payment already secured this listing; provider must void or refund this payment'; end if;
    update public.marketplace_orders set status = 'payment_held', version = version + 1 where id = p_order_id;
    update public.marketplace_listings set status = 'reserved', version = version + 1
    where id = order_row.listing_id;
    for superseded_order in
      select * from public.marketplace_orders other_order
      where other_order.listing_id = order_row.listing_id
        and other_order.id <> p_order_id
        and other_order.status = 'awaiting_payment'
      for update
    loop
      update public.marketplace_orders set
        status = 'cancelled', cancelled_at = now(), version = version + 1
      where id = superseded_order.id;
      update private.marketplace_payment_projections set
        payment_state = 'failed', updated_at = now()
      where order_id = superseded_order.id and payment_state in ('provider_required', 'pending');
      update public.marketplace_offers set status = 'declined'
      where id = superseded_order.offer_id and status = 'accepted';
      perform private.append_marketplace_order_event(
        superseded_order.id, null, 'cancelled', 'awaiting_payment', 'cancelled',
        jsonb_build_object('reason', 'another_payment_secured_listing')
      );
    end loop;
    update public.marketplace_offers set status = 'declined'
    where listing_id = order_row.listing_id and status = 'pending';
    perform private.append_marketplace_order_event(p_order_id, null, 'payment_held', old_order_status, 'payment_held', '{}'::jsonb);
  elsif next_state = 'released' then
    if old_order_status = 'disputed' then
      update public.marketplace_orders set
        status = 'accepted', accepted_at = coalesce(accepted_at, now()), version = version + 1
      where id = p_order_id;
      update public.marketplace_listings set status = 'sold', version = version + 1
      where id = order_row.listing_id and status = 'reserved';
    end if;
    perform private.append_marketplace_order_event(
      p_order_id, null, 'released', old_order_status,
      case when old_order_status = 'disputed' then 'accepted' else old_order_status end,
      '{}'::jsonb
    );
    update public.marketplace_disputes set status = 'resolved_seller', resolved_at = now()
    where order_id = p_order_id and status in ('open', 'under_review');
  elsif next_state = 'refunded' then
    update public.marketplace_orders set status = 'refunded', version = version + 1 where id = p_order_id;
    update public.marketplace_disputes set status = 'resolved_buyer', resolved_at = now()
    where order_id = p_order_id and status in ('open', 'under_review');
    if old_order_status in ('awaiting_payment', 'payment_held') then
      update public.marketplace_listings set status = 'active', version = version + 1
      where id = order_row.listing_id and status = 'reserved';
    else
      -- A fulfilled, accepted, or disputed return needs seller inspection before
      -- it can be offered again; never auto-resell it after a refund.
      update public.marketplace_listings set status = 'paused', version = version + 1
      where id = order_row.listing_id and status in ('reserved', 'sold');
    end if;
    perform private.append_marketplace_order_event(p_order_id, null, 'refunded', old_order_status, 'refunded', '{}'::jsonb);
  elsif next_state = 'failed' then
    update public.marketplace_orders set status = 'cancelled', cancelled_at = now(), version = version + 1 where id = p_order_id;
    update public.marketplace_offers set status = 'expired'
    where id = order_row.offer_id and status = 'accepted';
    update public.marketplace_listings set status = 'active', version = version + 1
    where id = order_row.listing_id and status = 'reserved';
    perform private.append_marketplace_order_event(p_order_id, null, 'payment_failed', old_order_status, 'cancelled', '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_status', (select status from public.marketplace_orders where id = p_order_id),
    'payment_state', next_state,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.apply_marketplace_payment_event(uuid, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.apply_marketplace_payment_event(uuid, text, text, text, text, bigint)
  to service_role;

-- A seller may promote only their own active listing in their own verified
-- school community. The existing v2 publisher performs all post/media/poll
-- validation first; any failed link validation rolls the entire transaction
-- back, so an orphan post cannot remain.
create or replace function public.publish_community_post_v3(
  p_body text,
  p_tags text[],
  p_media jsonb,
  p_poll_question text,
  p_poll_options text[],
  p_listing_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_school text := private.verified_school_key();
  new_post_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if caller_school is null then raise exception 'Verified school membership required'; end if;
  if p_listing_id is not null and not exists (
    select 1 from public.marketplace_listings listing
    where listing.id = p_listing_id
      and listing.seller_id = caller
      and listing.school_key = caller_school
      and listing.status = 'active'
  ) then raise exception 'Only your own active school listing can be linked'; end if;

  new_post_id := public.publish_community_post_v2(
    p_body, p_tags, p_media, p_poll_question, p_poll_options
  );
  if p_listing_id is not null then
    insert into public.community_post_listing_links (post_id, listing_id, seller_id, school_key)
    values (new_post_id, p_listing_id, caller, caller_school);
  end if;
  return new_post_id;
end;
$$;

revoke all on function public.publish_community_post_v3(text, text[], jsonb, text, text[], uuid)
  from public, anon, authenticated;
grant execute on function public.publish_community_post_v3(text, text[], jsonb, text, text[], uuid)
  to authenticated;

create or replace function public.get_school_feed_v2(
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
  bookmarked_by_me boolean,
  linked_listing jsonb
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
    feed.post_id, feed.author_id, feed.author_username, feed.display_name,
    feed.avatar_path, feed.avatar_revision, feed.major_of_study, feed.body,
    feed.tags, feed.media, feed.poll, feed.created_at, feed.like_count,
    feed.comment_count, feed.liked_by_me, feed.bookmarked_by_me,
    case
      when listing.id is null then null
      when listing.school_key <> caller_school then null
      when listing.seller_id <> feed.author_id then null
      when listing.status = 'deleted' then null
      when listing.status not in ('active', 'reserved') then jsonb_build_object(
        'id', listing.id, 'title', listing.title, 'status', listing.status
      )
      else private.marketplace_listing_json(listing.id, caller)
    end
  from public.get_school_feed(p_limit, p_offset, p_bookmarked_only, p_post_id) feed
  left join public.community_post_listing_links link on link.post_id = feed.post_id
  left join public.marketplace_listings listing
    on listing.id = link.listing_id
   and listing.school_key = link.school_key
   and listing.seller_id = link.seller_id;
end;
$$;

revoke all on function public.get_school_feed_v2(integer, integer, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.get_school_feed_v2(integer, integer, boolean, uuid)
  to authenticated;
