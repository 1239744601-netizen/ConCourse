-- ConCourse academic-email ownership challenge
--
-- Run AFTER:
--   1. supabase-account-trust-and-data-fix.sql
--   2. supabase-verification-center.sql
--   3. supabase-student-verification-evidence.sql
--
-- This migration is incremental and safe to rerun. Confirming an email proves
-- control of that address only. It creates a submitted verification request;
-- it never verifies a school membership without an authorised human review.

begin;

do $$
begin
  if to_regclass('public.school_memberships') is null
     or to_regclass('public.school_verification_requests') is null
     or to_regclass('public.verification_audit_events') is null
     or to_regprocedure(
       'private.append_verification_audit_event(text,uuid,uuid,text,text,text,text,jsonb)'
     ) is null then
    raise exception
      'Run the account-trust, Verification Center, and student-evidence migrations first';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- This is an administrator-maintained allow-list, not a user profile field.
-- A typed school domain or institution-directory result must never populate it
-- automatically. Add each exact recipient domain for each authoritative
-- school_key that is allowed to use email verification.
create table if not exists public.institution_academic_email_domains (
  school_key text not null
    check (
      school_key = trim(school_key)
      and char_length(school_key) between 2 and 500
    ),
  email_domain text not null
    check (
      email_domain = lower(trim(email_domain))
      and email_domain ~
        '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
      and char_length(email_domain) <= 253
    ),
  institution_label text
    check (
      institution_label is null
      or (
        institution_label = trim(institution_label)
        and char_length(institution_label) between 2 and 160
      )
    ),
  canonical_school_key text not null
    check (
      canonical_school_key = trim(canonical_school_key)
      and char_length(canonical_school_key) between 2 and 500
    ),
  canonical_school_name text not null
    check (
      canonical_school_name = trim(canonical_school_name)
      and char_length(canonical_school_name) between 2 and 220
    ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (school_key, email_domain)
);

create index if not exists institution_academic_email_domains_active_idx
  on public.institution_academic_email_domains (school_key, email_domain)
  where active;

alter table public.institution_academic_email_domains enable row level security;
revoke all on table public.institution_academic_email_domains
  from public, anon, authenticated;

drop trigger if exists institution_academic_email_domains_set_updated_at
  on public.institution_academic_email_domains;
create trigger institution_academic_email_domains_set_updated_at
  before update on public.institution_academic_email_domains
  for each row execute procedure public.set_concourse_updated_at();

-- Known HKBU identity keys used by the current institution directory. These
-- rows are deliberately explicit; no wildcard or user-entered domain is used.
insert into public.institution_academic_email_domains (
  school_key,
  email_domain,
  institution_label,
  canonical_school_key,
  canonical_school_name
)
values
  (
    'ror:0145fw131',
    'life.hkbu.edu.hk',
    'Hong Kong Baptist University',
    'ror:0145fw131',
    'Hong Kong Baptist University'
  ),
  (
    'ror:0145fw131',
    'hkbu.edu.hk',
    'Hong Kong Baptist University',
    'ror:0145fw131',
    'Hong Kong Baptist University'
  ),
  (
    'domain:hkbu.edu.hk',
    'life.hkbu.edu.hk',
    'Hong Kong Baptist University',
    'ror:0145fw131',
    'Hong Kong Baptist University'
  ),
  (
    'domain:hkbu.edu.hk',
    'hkbu.edu.hk',
    'Hong Kong Baptist University',
    'ror:0145fw131',
    'Hong Kong Baptist University'
  ),
  (
    'domain:life.hkbu.edu.hk',
    'life.hkbu.edu.hk',
    'Hong Kong Baptist University',
    'ror:0145fw131',
    'Hong Kong Baptist University'
  ),
  (
    'domain:life.hkbu.edu.hk',
    'hkbu.edu.hk',
    'Hong Kong Baptist University',
    'ror:0145fw131',
    'Hong Kong Baptist University'
  )
on conflict (school_key, email_domain) do update set
  institution_label = excluded.institution_label,
  canonical_school_key = excluded.canonical_school_key,
  canonical_school_name = excluded.canonical_school_name,
  active = true,
  updated_at = now();

create or replace function private.normalize_academic_email(p_email text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(coalesce(p_email, '')));
  local_part text;
  domain_part text;
begin
  if char_length(normalized) < 6 or char_length(normalized) > 254 then
    return null;
  end if;
  if normalized !~
    '^[a-z0-9!#$%&''*+/=?^_`{|}~.-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  then
    return null;
  end if;

  local_part := split_part(normalized, '@', 1);
  domain_part := split_part(normalized, '@', 2);
  if local_part = ''
     or domain_part = ''
     or local_part like '.%'
     or local_part like '%.'
     or local_part like '%..%'
     or domain_part like '%..%' then
    return null;
  end if;

  return normalized;
end;
$$;

revoke all on function private.normalize_academic_email(text)
  from public, anon, authenticated;

create or replace function private.academic_email_domain_is_allowed(
  p_school_key text,
  p_academic_email text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_academic_email_domains allowed_domain
    where allowed_domain.school_key = p_school_key
      and allowed_domain.email_domain =
        split_part(private.normalize_academic_email(p_academic_email), '@', 2)
      and allowed_domain.active
  );
$$;

revoke all on function private.academic_email_domain_is_allowed(text,text)
  from public, anon, authenticated;

-- Legacy accounts may not have a school_memberships row. In that one case,
-- resolve the email domain only when every active alias points to one and the
-- same administrator-maintained canonical institution. The result is used to
-- create a pending claim, never a verified membership.
create or replace function private.resolve_academic_email_institution(
  p_academic_email text
)
returns table (
  school_key text,
  school_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidates as (
    select distinct
      allowed_domain.canonical_school_key,
      allowed_domain.canonical_school_name
    from public.institution_academic_email_domains allowed_domain
    where allowed_domain.email_domain =
      split_part(private.normalize_academic_email(p_academic_email), '@', 2)
      and allowed_domain.active
  ),
  unique_candidate as (
    select
      min(candidates.canonical_school_key) as canonical_school_key,
      min(candidates.canonical_school_name) as canonical_school_name
    from candidates
    having count(*) = 1
  )
  select
    unique_candidate.canonical_school_key,
    unique_candidate.canonical_school_name
  from unique_candidate;
$$;

revoke all on function private.resolve_academic_email_institution(text)
  from public, anon, authenticated;

create or replace function private.mask_academic_email(p_email text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalized text := private.normalize_academic_email(p_email);
  local_part text;
  domain_part text;
begin
  if normalized is null then
    return null;
  end if;
  local_part := split_part(normalized, '@', 1);
  domain_part := split_part(normalized, '@', 2);
  return left(local_part, 1)
    || repeat('•', least(greatest(char_length(local_part) - 2, 2), 8))
    || case when char_length(local_part) > 1 then right(local_part, 1) else '' end
    || '@'
    || domain_part;
end;
$$;

revoke all on function private.mask_academic_email(text)
  from public, anon, authenticated;

-- The eight-digit code is never stored. The Edge Function stores only a
-- peppered HMAC-SHA-256 digest. The pepper remains an Edge Function secret.
create table if not exists private.academic_email_verification_challenges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  school_key text not null,
  school_name text not null,
  academic_email text not null
    check (
      academic_email = private.normalize_academic_email(academic_email)
    ),
  code_hash text not null
    check (code_hash ~ '^[0-9a-f]{64}$'),
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  attempt_count smallint not null default 0
    check (attempt_count between 0 and 8),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  superseded_at timestamptz,
  request_id uuid references public.school_verification_requests(id)
    on delete restrict,
  provider_message_id text
    check (
      provider_message_id is null
      or char_length(provider_message_id) between 1 and 500
    ),
  failure_code text
    check (
      failure_code is null
      or failure_code ~ '^[a-z0-9_]{2,80}$'
    ),
  check (expires_at > created_at),
  check (
    (delivery_status = 'pending' and sent_at is null and failure_code is null)
    or
    (delivery_status = 'sent' and sent_at is not null and failure_code is null)
    or
    (delivery_status = 'failed' and failure_code is not null)
  ),
  check (
    confirmed_at is null
    or (
      delivery_status = 'sent'
      and request_id is not null
      and superseded_at is null
    )
  )
);

alter table private.academic_email_verification_challenges
  add column if not exists provider_message_id text;

create index if not exists academic_email_challenges_user_created_idx
  on private.academic_email_verification_challenges (
    user_id,
    created_at desc,
    id
  );
create index if not exists academic_email_challenges_address_created_idx
  on private.academic_email_verification_challenges (
    academic_email,
    created_at desc,
    id
  );
create index if not exists academic_email_challenges_expiry_idx
  on private.academic_email_verification_challenges (expires_at, id)
  where confirmed_at is null and superseded_at is null;

-- Prevent two accounts from attaching the same confirmed academic address,
-- even when confirmation requests arrive at the same instant.
create unique index if not exists school_verification_active_academic_email_uidx
  on public.school_verification_requests (
    lower(evidence_reference)
  )
  where evidence_kind = 'academic_email'
    and status in ('submitted', 'under_review', 'approved');

create table if not exists private.academic_email_verification_events (
  id bigint generated always as identity primary key,
  challenge_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'issued',
    'delivered',
    'delivery_failed',
    'code_rejected',
    'expired',
    'locked',
    'confirmed',
    'request_submitted'
  )),
  created_at timestamptz not null default now()
);

-- Audit events retain the historical user UUID. Keeping an ON DELETE SET NULL
-- foreign key would conflict with the immutable-row trigger during account
-- deletion, so the retained identifier is deliberately not a live FK.
alter table private.academic_email_verification_events
  drop constraint if exists academic_email_verification_events_user_id_fkey;
alter table public.verification_audit_events
  drop constraint if exists verification_audit_events_actor_id_fkey;

create index if not exists academic_email_verification_events_challenge_idx
  on private.academic_email_verification_events (
    challenge_id,
    created_at,
    id
  );

revoke all on table private.academic_email_verification_challenges
  from public, anon, authenticated;
revoke all on table private.academic_email_verification_events
  from public, anon, authenticated;

create or replace function private.reject_academic_email_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Academic email verification events are append-only';
end;
$$;

revoke all on function private.reject_academic_email_event_mutation()
  from public, anon, authenticated;

drop trigger if exists academic_email_verification_events_immutable
  on private.academic_email_verification_events;
create trigger academic_email_verification_events_immutable
  before update or delete on private.academic_email_verification_events
  for each row execute procedure
    private.reject_academic_email_event_mutation();

-- Authenticated, user-scoped preflight. It validates the claimed institution
-- against the administrator allow-list before the Edge Function sends mail.
create or replace function public.get_my_academic_email_verification_target(
  p_academic_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  normalized_email text := private.normalize_academic_email(p_academic_email);
  membership public.school_memberships%rowtype;
  account_confirmed_at timestamptz;
  resolved_school_key text;
  resolved_school_name text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if normalized_email is null then
    raise exception 'Enter a valid academic email address';
  end if;

  select app_user.email_confirmed_at
  into account_confirmed_at
  from auth.users app_user
  where app_user.id = caller;

  if account_confirmed_at is null then
    raise exception 'Confirm your ConCourse account email first';
  end if;

  select school_membership.*
  into membership
  from public.school_memberships school_membership
  where school_membership.user_id = caller;

  if not found then
    select resolved.school_key, resolved.school_name
    into resolved_school_key, resolved_school_name
    from private.resolve_academic_email_institution(normalized_email) resolved;

    if resolved_school_key is null or resolved_school_name is null then
      raise exception
        'Complete your school profile or use an academic domain mapped to one supported institution';
    end if;

    insert into public.school_memberships (
      user_id,
      school_name,
      school_key,
      status
    ) values (
      caller,
      resolved_school_name,
      resolved_school_key,
      'pending'
    )
    on conflict (user_id) do nothing;

    select school_membership.*
    into membership
    from public.school_memberships school_membership
    where school_membership.user_id = caller;

    if not found then
      raise exception 'School membership could not be prepared';
    end if;
  end if;
  if membership.status = 'verified' then
    raise exception 'Your school membership is already verified';
  end if;
  if not private.academic_email_domain_is_allowed(
    membership.school_key,
    normalized_email
  ) then
    raise exception 'Use an approved academic email for your claimed institution';
  end if;
  if exists (
    select 1
    from public.school_verification_requests active_request
    where active_request.user_id = caller
      and active_request.status in ('submitted', 'under_review')
  ) then
    raise exception 'A school verification request is already being reviewed';
  end if;

  return jsonb_build_object(
    'user_id', caller,
    'school_key', membership.school_key,
    'school_name', membership.school_name,
    'normalized_email', normalized_email,
    'masked_email', private.mask_academic_email(normalized_email)
  );
end;
$$;

revoke all on function
  public.get_my_academic_email_verification_target(text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.get_my_academic_email_verification_target(text)
  to authenticated;

-- This user-scoped lookup lets the confirmation action bind its service RPC
-- to the authenticated caller without exposing the stored digest.
create or replace function public.get_my_academic_email_challenge_target(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  result jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'challenge_id', challenge.id,
    'user_id', challenge.user_id,
    'normalized_email', challenge.academic_email,
    'masked_email', private.mask_academic_email(challenge.academic_email),
    'expires_at', challenge.expires_at
  )
  into result
  from private.academic_email_verification_challenges challenge
  where challenge.id = p_challenge_id
    and challenge.user_id = caller;

  if result is null then
    raise exception 'Academic email challenge is unavailable';
  end if;

  return result;
end;
$$;

revoke all on function
  public.get_my_academic_email_challenge_target(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.get_my_academic_email_challenge_target(uuid)
  to authenticated;

create or replace function public.get_my_academic_email_verification_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  result jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'challenge_id', challenge.id,
    'masked_email', private.mask_academic_email(challenge.academic_email),
    'delivery_status', challenge.delivery_status,
    'challenge_status', case
      when challenge.confirmed_at is not null
           and challenge.request_id is not null then 'confirmed'
      when challenge.superseded_at is not null then 'superseded'
      when challenge.delivery_status = 'failed' then 'delivery_failed'
      when challenge.expires_at <= now() then 'expired'
      when challenge.attempt_count >= 8 then 'locked'
      when challenge.delivery_status = 'sent' then 'sent'
      else 'pending'
    end,
    'expires_at', challenge.expires_at,
    'confirmed_at', challenge.confirmed_at,
    'request_id', challenge.request_id,
    'attempts_remaining', greatest(8 - challenge.attempt_count, 0),
    'resend_available_at', challenge.created_at + interval '60 seconds'
  )
  into result
  from private.academic_email_verification_challenges challenge
  where challenge.user_id = caller
  order by challenge.created_at desc, challenge.id desc
  limit 1;

  return coalesce(result, jsonb_build_object('challenge_id', null));
end;
$$;

revoke all on function
  public.get_my_academic_email_verification_state()
  from public, anon, authenticated, service_role;
grant execute on function
  public.get_my_academic_email_verification_state()
  to authenticated;

-- Service-only issue. It repeats every security check from the user preflight,
-- rate-limits by both account and destination, and invalidates older codes.
create or replace function public.issue_academic_email_verification_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_academic_email text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := private.normalize_academic_email(p_academic_email);
  safe_hash text := lower(trim(coalesce(p_code_hash, '')));
  membership public.school_memberships%rowtype;
  account_confirmed_at timestamptz;
  expires_at_value timestamptz := now() + interval '10 minutes';
  resolved_school_key text;
  resolved_school_name text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_challenge_id is null or p_user_id is null then
    raise exception 'Invalid academic email challenge';
  end if;
  if normalized_email is null or safe_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid academic email challenge';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  perform pg_advisory_xact_lock(
    hashtextextended('academic_email:' || normalized_email, 0)
  );

  select app_user.email_confirmed_at
  into account_confirmed_at
  from auth.users app_user
  where app_user.id = p_user_id;
  if account_confirmed_at is null then
    raise exception 'Confirmed ConCourse account required';
  end if;

  select school_membership.*
  into membership
  from public.school_memberships school_membership
  where school_membership.user_id = p_user_id
  for update;

  if not found then
    select resolved.school_key, resolved.school_name
    into resolved_school_key, resolved_school_name
    from private.resolve_academic_email_institution(normalized_email) resolved;

    if resolved_school_key is null or resolved_school_name is null then
      raise exception 'School membership is unavailable for verification';
    end if;

    insert into public.school_memberships (
      user_id,
      school_name,
      school_key,
      status
    ) values (
      p_user_id,
      resolved_school_name,
      resolved_school_key,
      'pending'
    )
    on conflict (user_id) do nothing;

    select school_membership.*
    into membership
    from public.school_memberships school_membership
    where school_membership.user_id = p_user_id
    for update;
  end if;

  if not found or membership.status = 'verified' then
    raise exception 'School membership is unavailable for verification';
  end if;
  if not private.academic_email_domain_is_allowed(
    membership.school_key,
    normalized_email
  ) then
    raise exception 'Academic email domain is not approved for this institution';
  end if;
  if exists (
    select 1
    from public.school_verification_requests active_request
    where active_request.user_id = p_user_id
      and active_request.status in ('submitted', 'under_review')
  ) then
    raise exception 'A school verification request is already being reviewed';
  end if;

  if exists (
    select 1
    from private.academic_email_verification_challenges recent
    where recent.user_id = p_user_id
      and recent.created_at > now() - interval '60 seconds'
  ) then
    raise exception 'Wait before requesting another verification code';
  end if;
  if (
    select count(*)
    from private.academic_email_verification_challenges recent
    where recent.user_id = p_user_id
      and recent.created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Hourly academic email verification limit reached';
  end if;
  if (
    select count(*)
    from private.academic_email_verification_challenges recent
    where recent.user_id = p_user_id
      and recent.created_at > now() - interval '24 hours'
  ) >= 8 then
    raise exception 'Daily academic email verification limit reached';
  end if;
  if (
    select count(*)
    from private.academic_email_verification_challenges recent
    where recent.academic_email = normalized_email
      and recent.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'This academic email has received too many codes today';
  end if;

  update private.academic_email_verification_challenges previous
  set superseded_at = now()
  where previous.user_id = p_user_id
    and previous.confirmed_at is null
    and previous.superseded_at is null;

  insert into private.academic_email_verification_challenges (
    id,
    user_id,
    school_key,
    school_name,
    academic_email,
    code_hash,
    delivery_status,
    expires_at
  ) values (
    p_challenge_id,
    p_user_id,
    membership.school_key,
    membership.school_name,
    normalized_email,
    safe_hash,
    'pending',
    expires_at_value
  );

  insert into private.academic_email_verification_events (
    challenge_id,
    user_id,
    action
  ) values (
    p_challenge_id,
    p_user_id,
    'issued'
  );

  return jsonb_build_object(
    'challenge_id', p_challenge_id,
    'masked_email', private.mask_academic_email(normalized_email),
    'expires_at', expires_at_value,
    'resend_available_at', now() + interval '60 seconds'
  );
end;
$$;

revoke all on function
  public.issue_academic_email_verification_challenge(uuid,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.issue_academic_email_verification_challenge(uuid,uuid,text,text)
  to service_role;

drop function if exists
  public.mark_academic_email_challenge_delivery(uuid,uuid,boolean,text);

create or replace function public.mark_academic_email_challenge_delivery(
  p_challenge_id uuid,
  p_user_id uuid,
  p_delivered boolean,
  p_failure_code text default null,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_failure_code text := lower(trim(coalesce(p_failure_code, '')));
  safe_provider_message_id text :=
    nullif(left(trim(coalesce(p_provider_message_id, '')), 500), '');
  event_action text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if not p_delivered
     and safe_failure_code !~ '^[a-z0-9_]{2,80}$' then
    raise exception 'Safe failure code required';
  end if;

  update private.academic_email_verification_challenges challenge
  set
    delivery_status = case when p_delivered then 'sent' else 'failed' end,
    sent_at = case when p_delivered then now() else null end,
    failure_code = case when p_delivered then null else safe_failure_code end,
    provider_message_id = case
      when p_delivered then safe_provider_message_id
      else null
    end
  where challenge.id = p_challenge_id
    and challenge.user_id = p_user_id
    and challenge.delivery_status = 'pending'
    and challenge.confirmed_at is null;

  if not found then
    return false;
  end if;

  event_action := case when p_delivered then 'delivered' else 'delivery_failed' end;
  insert into private.academic_email_verification_events (
    challenge_id,
    user_id,
    action
  ) values (
    p_challenge_id,
    p_user_id,
    event_action
  );

  return true;
end;
$$;

revoke all on function
  public.mark_academic_email_challenge_delivery(uuid,uuid,boolean,text,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.mark_academic_email_challenge_delivery(uuid,uuid,boolean,text,text)
  to service_role;

-- Service-only confirmation. A correct code submits evidence to the existing
-- reviewer queue. It does not set school_memberships.status = 'verified'.
create or replace function public.confirm_academic_email_verification_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_hash text := lower(trim(coalesce(p_code_hash, '')));
  challenge private.academic_email_verification_challenges%rowtype;
  membership public.school_memberships%rowtype;
  new_request_id uuid;
  attempts_remaining integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if safe_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid code digest';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select challenge_row.*
  into challenge
  from private.academic_email_verification_challenges challenge_row
  where challenge_row.id = p_challenge_id
    and challenge_row.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if challenge.request_id is not null and challenge.confirmed_at is not null then
    return jsonb_build_object(
      'status', 'submitted_for_review',
      'request_id', challenge.request_id
    );
  end if;
  if challenge.delivery_status <> 'sent'
     or challenge.superseded_at is not null then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if challenge.expires_at <= now() then
    insert into private.academic_email_verification_events (
      challenge_id,
      user_id,
      action
    ) values (
      challenge.id,
      challenge.user_id,
      'expired'
    );
    return jsonb_build_object('status', 'expired');
  end if;
  if challenge.attempt_count >= 8 then
    return jsonb_build_object('status', 'locked');
  end if;

  -- Serialise confirmation across different accounts using the same address.
  -- The user lock is always acquired first, matching the issue path.
  perform pg_advisory_xact_lock(
    hashtextextended('academic_email:' || challenge.academic_email, 0)
  );

  update private.academic_email_verification_challenges challenge_row
  set attempt_count = challenge_row.attempt_count + 1
  where challenge_row.id = challenge.id;
  challenge.attempt_count := challenge.attempt_count + 1;
  attempts_remaining := greatest(8 - challenge.attempt_count, 0);

  if challenge.code_hash <> safe_hash then
    insert into private.academic_email_verification_events (
      challenge_id,
      user_id,
      action
    ) values (
      challenge.id,
      challenge.user_id,
      case when attempts_remaining = 0 then 'locked' else 'code_rejected' end
    );
    return jsonb_build_object(
      'status', case when attempts_remaining = 0 then 'locked' else 'invalid_code' end,
      'attempts_remaining', attempts_remaining
    );
  end if;

  select school_membership.*
  into membership
  from public.school_memberships school_membership
  where school_membership.user_id = p_user_id
  for update;

  if not found
     or membership.school_key <> challenge.school_key
     or membership.school_name <> challenge.school_name
     or membership.status = 'verified'
     or not private.academic_email_domain_is_allowed(
       membership.school_key,
       challenge.academic_email
     ) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if exists (
    select 1
    from public.school_verification_requests active_request
    where active_request.user_id = p_user_id
      and active_request.status in ('submitted', 'under_review')
  ) then
    return jsonb_build_object('status', 'request_already_active');
  end if;
  if (
    select count(*)
    from public.school_verification_requests recent_request
    where recent_request.user_id = p_user_id
      and recent_request.submitted_at > now() - interval '30 days'
  ) >= 5 then
    return jsonb_build_object('status', 'request_limit_reached');
  end if;
  if exists (
    select 1
    from public.school_verification_requests used_email
    where used_email.user_id <> p_user_id
      and used_email.evidence_kind = 'academic_email'
      and lower(used_email.evidence_reference) = challenge.academic_email
      and used_email.status in ('submitted', 'under_review', 'approved')
  ) then
    return jsonb_build_object('status', 'email_already_in_use');
  end if;

  update public.school_memberships school_membership
  set
    status = case
      when school_membership.status in ('rejected', 'revoked') then 'pending'
      else school_membership.status
    end,
    verification_method = null,
    verified_at = null,
    updated_at = now()
  where school_membership.user_id = p_user_id
    and school_membership.status <> 'verified';

  insert into public.school_verification_requests (
    user_id,
    school_name,
    school_key,
    evidence_kind,
    evidence_reference,
    user_note,
    status
  ) values (
    p_user_id,
    challenge.school_name,
    challenge.school_key,
    'academic_email',
    challenge.academic_email,
    'Academic email ownership confirmed by an expiring code; human review required.',
    'submitted'
  )
  returning id into new_request_id;

  update private.academic_email_verification_challenges challenge_row
  set
    confirmed_at = now(),
    request_id = new_request_id
  where challenge_row.id = challenge.id
    and challenge_row.user_id = p_user_id;

  update private.academic_email_verification_challenges other_challenge
  set superseded_at = now()
  where other_challenge.user_id = p_user_id
    and other_challenge.id <> challenge.id
    and other_challenge.confirmed_at is null
    and other_challenge.superseded_at is null;

  insert into private.academic_email_verification_events (
    challenge_id,
    user_id,
    action
  ) values
    (challenge.id, p_user_id, 'confirmed'),
    (challenge.id, p_user_id, 'request_submitted');

  perform private.append_verification_audit_event(
    'school_verification',
    new_request_id,
    p_user_id,
    'academic_email_confirmed',
    null,
    'submitted',
    null,
    jsonb_build_object(
      'school_key', challenge.school_key,
      'evidence_kind', 'academic_email',
      'human_review_required', true
    )
  );

  return jsonb_build_object(
    'status', 'submitted_for_review',
    'request_id', new_request_id
  );
end;
$$;

revoke all on function
  public.confirm_academic_email_verification_challenge(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.confirm_academic_email_verification_challenge(uuid,uuid,text)
  to service_role;

commit;
