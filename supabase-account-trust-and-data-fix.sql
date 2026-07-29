-- ConCourse account trust, privacy, and analytics migration
-- Run after:
--   1. supabase-setup-part-1.sql
--   2. supabase-setup-part-2.sql
--   3. supabase-global-market-fix.sql
--   4. supabase-social-comments.sql
--
-- This migration is safe to run more than once. It intentionally does not
-- auto-verify a school from a typed name, directory result, or email domain.
-- Verification requests always require a separate ConCourse administrator
-- review before a membership can become verified.

do $$
begin
  if to_regclass('public.school_memberships') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.final_schedules') is null
     or to_regclass('public.final_course_choices') is null then
    raise exception
      'Run supabase-setup-part-1.sql and supabase-setup-part-2.sql before this migration';
  end if;

  if to_regclass('public.direct_conversations') is null
     or to_regclass('public.direct_messages') is null then
    raise exception
      'Run supabase-global-market-fix.sql before this migration';
  end if;

  if to_regclass('public.community_comment_likes') is null then
    raise exception
      'Run supabase-social-comments.sql before this migration';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Administrator registry
-- ---------------------------------------------------------------------------
-- The project owner bootstraps an administrator from the SQL editor:
--
-- insert into public.concourse_admins (user_id, role)
-- values ('AUTH-USER-UUID', 'owner')
-- on conflict (user_id) do update set role = excluded.role;
--
-- Browser users cannot read or modify this registry. Supabase's service role
-- continues to bypass RLS for trusted operational work.

create table if not exists public.concourse_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'reviewer'
    check (role in ('owner', 'reviewer', 'privacy')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.concourse_admins enable row level security;
revoke all on table public.concourse_admins from public, anon, authenticated;

create or replace function private.is_concourse_admin(
  p_user_id uuid,
  p_allowed_roles text[] default array['owner', 'reviewer']::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.concourse_admins admin_user
      where admin_user.user_id = p_user_id
        and admin_user.role = any(p_allowed_roles)
    );
$$;

revoke all on function private.is_concourse_admin(uuid, text[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- School verification requests
-- ---------------------------------------------------------------------------

create table if not exists public.school_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_name text not null
    check (school_name = trim(school_name) and char_length(school_name) between 2 and 220),
  school_key text not null
    check (school_key = trim(school_key) and char_length(school_key) between 2 and 500),
  evidence_kind text not null
    check (evidence_kind in ('academic_email', 'institution_sso', 'manual_review')),
  evidence_reference text
    check (
      evidence_reference is null
      or (
        evidence_reference = trim(evidence_reference)
        and char_length(evidence_reference) between 1 and 500
      )
    ),
  user_note text
    check (
      user_note is null
      or (
        user_note = trim(user_note)
        and char_length(user_note) between 1 and 1000
      )
    ),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text
    check (
      reviewer_note is null
      or (
        reviewer_note = trim(reviewer_note)
        and char_length(reviewer_note) between 1 and 1000
      )
    ),
  decision_verification_method text
    check (
      decision_verification_method is null
      or decision_verification_method in ('academic_email', 'institution_sso', 'manual')
    ),
  updated_at timestamptz not null default now(),
  check (
    status not in ('approved', 'rejected')
    or reviewed_at is not null
  ),
  check (
    status <> 'approved'
    or decision_verification_method is not null
  )
);

create unique index if not exists school_verification_requests_one_active_idx
  on public.school_verification_requests (user_id)
  where status in ('submitted', 'under_review');

create index if not exists school_verification_requests_review_queue_idx
  on public.school_verification_requests (status, submitted_at, id);

create index if not exists school_verification_requests_user_history_idx
  on public.school_verification_requests (user_id, submitted_at desc, id desc);

alter table public.school_verification_requests enable row level security;

drop policy if exists "Users can read their own school verification requests"
  on public.school_verification_requests;
create policy "Users can read their own school verification requests"
on public.school_verification_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.school_verification_requests
  from public, anon, authenticated;
grant select (
  id,
  user_id,
  school_name,
  school_key,
  evidence_kind,
  evidence_reference,
  user_note,
  status,
  submitted_at,
  reviewed_at,
  reviewer_note,
  decision_verification_method,
  updated_at
) on table public.school_verification_requests
to authenticated;

drop trigger if exists school_verification_requests_set_updated_at
  on public.school_verification_requests;
create trigger school_verification_requests_set_updated_at
  before update on public.school_verification_requests
  for each row execute procedure public.set_concourse_updated_at();

create or replace function public.get_my_school_verification()
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
    'membership',
    case
      when membership.user_id is null then null
      else jsonb_build_object(
        'school_name', membership.school_name,
        'school_key', membership.school_key,
        'status', membership.status,
        'verification_method', membership.verification_method,
        'verified_at', membership.verified_at,
        'updated_at', membership.updated_at
      )
    end,
    'latest_request',
    case
      when request.id is null then null
      else jsonb_build_object(
        'request_id', request.id,
        'school_name', request.school_name,
        'school_key', request.school_key,
        'evidence_kind', request.evidence_kind,
        'evidence_reference', request.evidence_reference,
        'user_note', request.user_note,
        'status', request.status,
        'submitted_at', request.submitted_at,
        'reviewed_at', request.reviewed_at,
        'reviewer_note', request.reviewer_note,
        'verification_method', request.decision_verification_method,
        'updated_at', request.updated_at
      )
    end,
    'action_required',
    case
      when membership.status = 'verified' then 'none'
      when request.status in ('submitted', 'under_review') then 'awaiting_review'
      when request.status = 'rejected' then 'resubmit_evidence'
      when membership.user_id is null then 'complete_school_profile'
      else 'submit_evidence'
    end
  )
  into result
  from (select 1) seed
  left join public.school_memberships membership
    on membership.user_id = caller
  left join lateral (
    select verification_request.*
    from public.school_verification_requests verification_request
    where verification_request.user_id = caller
    order by verification_request.submitted_at desc, verification_request.id desc
    limit 1
  ) request on true;

  return coalesce(
    result,
    jsonb_build_object(
      'membership', null,
      'latest_request', null,
      'action_required', 'complete_school_profile'
    )
  );
end;
$$;

revoke all on function public.get_my_school_verification()
  from public, anon, authenticated;
grant execute on function public.get_my_school_verification()
  to authenticated;

create or replace function public.submit_school_verification_request(
  p_evidence_kind text,
  p_evidence_reference text default null,
  p_user_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_email_confirmed_at timestamptz;
  caller_school public.school_memberships%rowtype;
  safe_evidence_kind text := lower(trim(coalesce(p_evidence_kind, '')));
  safe_evidence_reference text := nullif(trim(coalesce(p_evidence_reference, '')), '');
  safe_user_note text := nullif(trim(coalesce(p_user_note, '')), '');
  request_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select app_user.email_confirmed_at
  into caller_email_confirmed_at
  from auth.users app_user
  where app_user.id = caller;

  if caller_email_confirmed_at is null then
    raise exception 'Confirm your account email before requesting school verification';
  end if;

  select membership.*
  into caller_school
  from public.school_memberships membership
  where membership.user_id = caller
  for update;

  if not found then
    raise exception 'Complete your school profile before requesting verification';
  end if;
  if caller_school.status = 'verified' then
    raise exception 'Your school membership is already verified';
  end if;
  if safe_evidence_kind not in ('academic_email', 'institution_sso', 'manual_review') then
    raise exception 'Choose a supported verification method';
  end if;
  if safe_evidence_reference is not null
     and char_length(safe_evidence_reference) > 500 then
    raise exception 'Evidence reference is too long';
  end if;
  if safe_user_note is not null and char_length(safe_user_note) > 1000 then
    raise exception 'Verification note is too long';
  end if;

  if exists (
    select 1
    from public.school_verification_requests active_request
    where active_request.user_id = caller
      and active_request.status in ('submitted', 'under_review')
  ) then
    raise exception 'A school verification request is already being reviewed';
  end if;

  if (
    select count(*)
    from public.school_verification_requests recent_request
    where recent_request.user_id = caller
      and recent_request.submitted_at > now() - interval '30 days'
  ) >= 5 then
    raise exception 'Monthly school verification request limit reached';
  end if;

  if safe_evidence_kind = 'academic_email' then
    -- A confirmed private/login address is account authentication, not
    -- student-status evidence. Academic email ownership must go through the
    -- separate expiring-code flow.
    raise exception
      'Use the academic email code flow to verify student status';
  elsif safe_evidence_kind = 'institution_sso'
        and safe_evidence_reference is null then
    raise exception 'An institution SSO reference is required';
  elsif safe_evidence_kind = 'manual_review'
        and safe_evidence_reference is null
        and safe_user_note is null then
    raise exception 'Add a short note describing the verification evidence';
  end if;

  update public.school_memberships membership
  set
    status = case
      when membership.status = 'rejected' then 'pending'
      else membership.status
    end,
    verification_method = null,
    verified_at = null,
    updated_at = now()
  where membership.user_id = caller
    and membership.status <> 'verified';

  insert into public.school_verification_requests (
    user_id,
    school_name,
    school_key,
    evidence_kind,
    evidence_reference,
    user_note,
    status
  ) values (
    caller,
    caller_school.school_name,
    caller_school.school_key,
    safe_evidence_kind,
    safe_evidence_reference,
    safe_user_note,
    'submitted'
  )
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.submit_school_verification_request(text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_school_verification_request(text, text, text)
  to authenticated;

create or replace function public.withdraw_school_verification_request(
  p_request_id uuid
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

  update public.school_verification_requests verification_request
  set status = 'withdrawn', updated_at = now()
  where verification_request.id = p_request_id
    and verification_request.user_id = caller
    and verification_request.status in ('submitted', 'under_review');

  if not found then
    raise exception 'Verification request is unavailable';
  end if;

  return true;
end;
$$;

revoke all on function public.withdraw_school_verification_request(uuid)
  from public, anon, authenticated;
grant execute on function public.withdraw_school_verification_request(uuid)
  to authenticated;

create or replace function public.get_school_verification_review_queue(
  p_status text default 'submitted',
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_status text := lower(trim(coalesce(p_status, 'submitted')));
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  result jsonb;
begin
  if not private.is_concourse_admin(caller, array['owner', 'reviewer']::text[]) then
    raise exception 'Administrator access required';
  end if;
  if safe_status not in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn') then
    raise exception 'Invalid request status';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'request_id', queue.id,
        'user_id', queue.user_id,
        'account_email', queue.account_email,
        'school_name', queue.school_name,
        'school_key', queue.school_key,
        'evidence_kind', queue.evidence_kind,
        'evidence_reference', queue.evidence_reference,
        'user_note', queue.user_note,
        'status', queue.status,
        'submitted_at', queue.submitted_at,
        'reviewed_at', queue.reviewed_at,
        'reviewer_note', queue.reviewer_note
      )
      order by queue.submitted_at, queue.id
    ),
    '[]'::jsonb
  )
  into result
  from (
    select
      verification_request.*,
      app_user.email as account_email
    from public.school_verification_requests verification_request
    join auth.users app_user
      on app_user.id = verification_request.user_id
    where verification_request.status = safe_status
    order by verification_request.submitted_at, verification_request.id
    limit safe_limit
  ) queue;

  return result;
end;
$$;

revoke all on function public.get_school_verification_review_queue(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_school_verification_review_queue(text, integer)
  to authenticated;

create or replace function public.review_school_verification_request(
  p_request_id uuid,
  p_decision text,
  p_verification_method text default 'manual',
  p_reviewer_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_decision text := lower(trim(coalesce(p_decision, '')));
  safe_method text;
  safe_note text := nullif(trim(coalesce(p_reviewer_note, '')), '');
  request_row public.school_verification_requests%rowtype;
  membership_row public.school_memberships%rowtype;
begin
  if not private.is_concourse_admin(caller, array['owner', 'reviewer']::text[]) then
    raise exception 'Administrator access required';
  end if;
  if safe_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject';
  end if;
  if safe_note is not null and char_length(safe_note) > 1000 then
    raise exception 'Reviewer note is too long';
  end if;

  select verification_request.*
  into request_row
  from public.school_verification_requests verification_request
  where verification_request.id = p_request_id
  for update;

  if not found or request_row.status not in ('submitted', 'under_review') then
    raise exception 'Verification request is unavailable';
  end if;
  if request_row.user_id = caller then
    raise exception 'Administrators cannot review their own verification request';
  end if;

  select membership.*
  into membership_row
  from public.school_memberships membership
  where membership.user_id = request_row.user_id
  for update;

  if not found
     or membership_row.school_key <> request_row.school_key
     or membership_row.school_name <> request_row.school_name then
    raise exception 'The school profile changed after this request was submitted';
  end if;
  if membership_row.status = 'verified' then
    raise exception 'This membership has already been verified';
  end if;
  if safe_decision = 'approve'
     and membership_row.status = 'revoked' then
    raise exception 'A revoked membership cannot be approved';
  end if;

  if safe_decision = 'approve'
     and request_row.evidence_kind = 'academic_email' then
    raise exception
      'Academic email verification completes only through the code flow';
  end if;

  safe_method := case request_row.evidence_kind
    when 'institution_sso' then 'institution_sso'
    when 'manual_review' then 'manual'
    else null
  end;

  update public.school_verification_requests verification_request
  set
    status = case when safe_decision = 'approve' then 'approved' else 'rejected' end,
    reviewed_at = now(),
    reviewed_by = caller,
    reviewer_note = safe_note,
    decision_verification_method = case
      when safe_decision = 'approve' then safe_method
      else null
    end,
    updated_at = now()
  where verification_request.id = p_request_id;

  if safe_decision = 'approve' then
    update public.school_memberships membership
    set
      status = 'pending',
      verification_method = null,
      verified_at = null,
      updated_at = now()
    where membership.user_id = request_row.user_id
      and membership.school_key = request_row.school_key
      and membership.status not in ('verified', 'revoked');
  else
    update public.school_memberships membership
    set
      status = 'rejected',
      verification_method = null,
      verified_at = null,
      updated_at = now()
    where membership.user_id = request_row.user_id
      and membership.school_key = request_row.school_key
      and membership.status not in ('verified', 'revoked');
  end if;

  return true;
end;
$$;

revoke all on function public.review_school_verification_request(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_school_verification_request(uuid, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privacy notice records and account-deletion requests
-- ---------------------------------------------------------------------------

create table if not exists public.privacy_notice_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  notice_version text not null
    check (
      notice_version = trim(notice_version)
      and char_length(notice_version) between 1 and 80
    ),
  accepted_at timestamptz not null default now(),
  source text not null default 'web'
    check (source in ('web', 'mobile', 'support')),
  primary key (user_id, notice_version)
);

alter table public.privacy_notice_acceptances enable row level security;

drop policy if exists "Users can read their own privacy notice acceptances"
  on public.privacy_notice_acceptances;
create policy "Users can read their own privacy notice acceptances"
on public.privacy_notice_acceptances
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.privacy_notice_acceptances
  from public, anon, authenticated;
grant select (user_id, notice_version, accepted_at, source)
  on table public.privacy_notice_acceptances
  to authenticated;

create or replace function public.record_privacy_notice_acceptance(
  p_notice_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_version text := trim(coalesce(p_notice_version, ''));
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if char_length(safe_version) not between 1 and 80 then
    raise exception 'Invalid privacy notice version';
  end if;

  insert into public.privacy_notice_acceptances (
    user_id,
    notice_version,
    accepted_at,
    source
  ) values (
    caller,
    safe_version,
    now(),
    'web'
  )
  on conflict (user_id, notice_version) do update set
    accepted_at = excluded.accepted_at,
    source = excluded.source;

  return true;
end;
$$;

revoke all on function public.record_privacy_notice_acceptance(text)
  from public, anon, authenticated;
grant execute on function public.record_privacy_notice_acceptance(text)
  to authenticated;

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'processing', 'completed', 'cancelled')),
  reason text
    check (
      reason is null
      or (
        reason = trim(reason)
        and char_length(reason) between 1 and 1000
      )
    ),
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '7 days'),
  cancelled_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'cancelled' or cancelled_at is not null),
  check (status <> 'completed' or completed_at is not null)
);

create unique index if not exists account_deletion_requests_one_active_idx
  on public.account_deletion_requests (user_id)
  where status in ('submitted', 'processing');

create index if not exists account_deletion_requests_operations_idx
  on public.account_deletion_requests (status, scheduled_for, id);

create index if not exists account_deletion_requests_user_history_idx
  on public.account_deletion_requests (user_id, requested_at desc, id desc);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can read their own account deletion requests"
  on public.account_deletion_requests;
create policy "Users can read their own account deletion requests"
on public.account_deletion_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.account_deletion_requests
  from public, anon, authenticated;
grant select (
  id,
  user_id,
  status,
  reason,
  requested_at,
  scheduled_for,
  cancelled_at,
  completed_at,
  updated_at
) on table public.account_deletion_requests
to authenticated;

drop trigger if exists account_deletion_requests_set_updated_at
  on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
  before update on public.account_deletion_requests
  for each row execute procedure public.set_concourse_updated_at();

create or replace function public.get_my_account_deletion_request()
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
    'request_id', deletion_request.id,
    'status', deletion_request.status,
    'reason', deletion_request.reason,
    'requested_at', deletion_request.requested_at,
    'scheduled_for', deletion_request.scheduled_for,
    'cancelled_at', deletion_request.cancelled_at,
    'completed_at', deletion_request.completed_at,
    'updated_at', deletion_request.updated_at
  )
  into result
  from public.account_deletion_requests deletion_request
  where deletion_request.user_id = caller
  order by deletion_request.requested_at desc, deletion_request.id desc
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_my_account_deletion_request()
  from public, anon, authenticated;
grant execute on function public.get_my_account_deletion_request()
  to authenticated;

create or replace function public.request_account_deletion(
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_reason text := nullif(trim(coalesce(p_reason, '')), '');
  existing_id uuid;
  request_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if safe_reason is not null and char_length(safe_reason) > 1000 then
    raise exception 'Deletion reason is too long';
  end if;

  select deletion_request.id
  into existing_id
  from public.account_deletion_requests deletion_request
  where deletion_request.user_id = caller
    and deletion_request.status in ('submitted', 'processing')
  order by deletion_request.requested_at desc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  if (
    select count(*)
    from public.account_deletion_requests recent_request
    where recent_request.user_id = caller
      and recent_request.requested_at > now() - interval '30 days'
  ) >= 3 then
    raise exception 'Monthly account deletion request limit reached';
  end if;

  insert into public.account_deletion_requests (
    user_id,
    status,
    reason,
    requested_at,
    scheduled_for
  ) values (
    caller,
    'submitted',
    safe_reason,
    now(),
    now() + interval '7 days'
  )
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.request_account_deletion(text)
  from public, anon, authenticated;
grant execute on function public.request_account_deletion(text)
  to authenticated;

create or replace function public.cancel_account_deletion_request()
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

  update public.account_deletion_requests deletion_request
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where deletion_request.id = (
    select current_request.id
    from public.account_deletion_requests current_request
    where current_request.user_id = caller
      and current_request.status = 'submitted'
    order by current_request.requested_at desc, current_request.id desc
    limit 1
  );

  if not found then
    raise exception 'No cancellable account deletion request was found';
  end if;

  return true;
end;
$$;

revoke all on function public.cancel_account_deletion_request()
  from public, anon, authenticated;
grant execute on function public.cancel_account_deletion_request()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Rich final-schedule dimensions
-- ---------------------------------------------------------------------------

alter table public.final_course_choices
  add column if not exists professor text;
alter table public.final_course_choices
  add column if not exists section_label text;
alter table public.final_course_choices
  add column if not exists meeting_times jsonb not null default '[]'::jsonb;

update public.final_course_choices
set
  professor = nullif(left(trim(professor), 160), ''),
  section_label = nullif(left(trim(section_label), 120), ''),
  meeting_times = case
    when jsonb_typeof(meeting_times) = 'array' then meeting_times
    else '[]'::jsonb
  end;

alter table public.final_course_choices
  drop constraint if exists final_course_choices_professor_bounded;
alter table public.final_course_choices
  add constraint final_course_choices_professor_bounded
  check (
    professor is null
    or (
      professor = trim(professor)
      and char_length(professor) between 1 and 160
    )
  );

alter table public.final_course_choices
  drop constraint if exists final_course_choices_section_label_bounded;
alter table public.final_course_choices
  add constraint final_course_choices_section_label_bounded
  check (
    section_label is null
    or (
      section_label = trim(section_label)
      and char_length(section_label) between 1 and 120
    )
  );

alter table public.final_course_choices
  drop constraint if exists final_course_choices_meeting_times_array;
alter table public.final_course_choices
  add constraint final_course_choices_meeting_times_array
  check (jsonb_typeof(meeting_times) = 'array');

create index if not exists final_course_choices_professor_idx
  on public.final_course_choices (professor, user_id)
  where professor is not null;

create index if not exists final_course_choices_section_idx
  on public.final_course_choices (section_label, user_id)
  where section_label is not null;

create or replace function private.safe_snapshot_credits(
  p_value text
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  parsed numeric;
begin
  begin
    parsed := nullif(trim(coalesce(p_value, '')), '')::numeric;
  exception when others then
    parsed := 0;
  end;
  return greatest(0, least(99, coalesce(parsed, 0)));
end;
$$;

revoke all on function private.safe_snapshot_credits(text)
  from public, anon, authenticated;

create or replace function private.safe_snapshot_timestamp(
  p_value text,
  p_fallback timestamptz
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  parsed timestamptz;
begin
  begin
    parsed := nullif(trim(coalesce(p_value, '')), '')::timestamptz;
  exception when others then
    parsed := p_fallback;
  end;
  return coalesce(parsed, p_fallback);
end;
$$;

revoke all on function private.safe_snapshot_timestamp(text, timestamptz)
  from public, anon, authenticated;

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
  safe_degree text;
  safe_study_year smallint;
  safe_course_name text;
  safe_course_code text;
  safe_professor text;
  safe_section_label text;
  safe_meeting_times jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object'
     or jsonb_typeof(p_snapshot -> 'courses') is distinct from 'array' then
    raise exception 'Invalid final timetable';
  end if;
  if jsonb_array_length(p_snapshot -> 'courses') > 40 then
    raise exception 'A final timetable cannot contain more than 40 courses';
  end if;

  safe_degree := nullif(trim(coalesce(p_snapshot ->> 'degreeLevel', '')), '');
  if safe_degree is not null
     and safe_degree not in ('bachelor', 'master', 'phd') then
    raise exception 'Invalid degree level';
  end if;

  begin
    safe_study_year := nullif(trim(coalesce(p_snapshot ->> 'studyYear', '')), '')::smallint;
  exception when others then
    raise exception 'Invalid study year';
  end;
  if safe_study_year is not null and safe_study_year not between 1 and 8 then
    raise exception 'Invalid study year';
  end if;

  select
    membership.school_key,
    public.normalized_school_key(profile.major_of_study),
    coalesce(member.analytics_consent, false)
  into caller_school, caller_major, consent
  from public.school_memberships membership
  left join public.profiles profile
    on profile.user_id = membership.user_id
  left join public.member_profiles member
    on member.user_id = membership.user_id
  where membership.user_id = caller;

  if caller_school is null then
    raise exception 'School membership setup required';
  end if;

  insert into public.final_schedules (
    user_id,
    school_key,
    major_key,
    degree_level,
    study_year,
    snapshot,
    analytics_consent,
    finalized_at,
    updated_at
  ) values (
    caller,
    caller_school,
    caller_major,
    safe_degree,
    safe_study_year,
    p_snapshot,
    consent,
    private.safe_snapshot_timestamp(p_snapshot ->> 'savedAt', now()),
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

  delete from public.final_course_choices
  where user_id = caller;

  for course_record
  in select value from jsonb_array_elements(p_snapshot -> 'courses')
  loop
    if jsonb_typeof(course_record) is distinct from 'object' then
      continue;
    end if;

    safe_course_name := nullif(
      left(trim(coalesce(course_record ->> 'name', '')), 220),
      ''
    );
    safe_course_code := nullif(
      left(trim(coalesce(course_record ->> 'code', '')), 80),
      ''
    );
    safe_professor := nullif(
      left(trim(coalesce(course_record ->> 'professor', '')), 160),
      ''
    );
    safe_section_label := nullif(
      left(
        trim(
          coalesce(
            course_record ->> 'sectionLabel',
            course_record ->> 'section',
            course_record ->> 'selectedSection',
            ''
          )
        ),
        120
      ),
      ''
    );
    safe_meeting_times := case
      when jsonb_typeof(course_record -> 'slots') = 'array'
        then course_record -> 'slots'
      when jsonb_typeof(course_record -> 'meetingTimes') = 'array'
        then course_record -> 'meetingTimes'
      else '[]'::jsonb
    end;

    normalized_course_key := public.normalized_school_key(
      concat(
        coalesce(safe_course_code, 'no-code'),
        '|',
        coalesce(safe_course_name, '')
      )
    );

    if normalized_course_key is not null and safe_course_name is not null then
      insert into public.final_course_choices (
        user_id,
        course_key,
        course_name,
        course_code,
        credits,
        professor,
        section_label,
        meeting_times
      ) values (
        caller,
        left(normalized_course_key, 220),
        safe_course_name,
        safe_course_code,
        private.safe_snapshot_credits(course_record ->> 'credits'),
        safe_professor,
        safe_section_label,
        safe_meeting_times
      )
      on conflict (user_id, course_key) do update set
        course_name = excluded.course_name,
        course_code = excluded.course_code,
        credits = excluded.credits,
        professor = excluded.professor,
        section_label = excluded.section_label,
        meeting_times = excluded.meeting_times;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.sync_final_schedule(jsonb)
  from public, anon, authenticated;
grant execute on function public.sync_final_schedule(jsonb)
  to authenticated;

drop function if exists public.get_course_choice_dimensions(text, smallint, text);
create function public.get_course_choice_dimensions(
  p_scope text default 'same_major_year',
  p_study_year smallint default null,
  p_course_key text default null
)
returns table (
  dimension_type text,
  dimension_key text,
  course_key text,
  primary_label text,
  secondary_label text,
  meeting_times jsonb,
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
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_scope not in (
    'same_major_year',
    'same_major',
    'university_year',
    'university'
  ) then
    raise exception 'Invalid analytics scope';
  end if;
  if p_study_year is not null and p_study_year not between 1 and 8 then
    raise exception 'Invalid study year';
  end if;

  select
    membership.school_key,
    public.normalized_school_key(profile.major_of_study),
    profile.study_year
  into caller_school, caller_major, caller_year
  from public.school_memberships membership
  left join public.profiles profile
    on profile.user_id = membership.user_id
  where membership.user_id = caller
    and membership.status = 'verified';

  if caller_school is null then
    raise exception 'Verified school membership required';
  end if;

  return query
  with eligible as (
    select schedule.user_id
    from public.final_schedules schedule
    join public.school_memberships school_member
      on school_member.user_id = schedule.user_id
    join public.member_profiles member
      on member.user_id = schedule.user_id
    where schedule.school_key = caller_school
      and school_member.school_key = caller_school
      and school_member.status = 'verified'
      and schedule.analytics_consent = true
      and member.analytics_consent = true
      and (
        p_scope in ('university_year', 'university')
        or schedule.major_key = caller_major
      )
      and (
        case
          when p_scope in ('same_major_year', 'university_year')
            then schedule.study_year = coalesce(p_study_year, caller_year)
          else true
        end
      )
  ),
  cohort as (
    select count(*)::bigint as size
    from eligible
  ),
  chosen as (
    select choice.*
    from public.final_course_choices choice
    join eligible
      on eligible.user_id = choice.user_id
    where p_course_key is null
       or choice.course_key = p_course_key
  ),
  dimensions as (
    select
      'course'::text as kind,
      choice.course_key as key,
      choice.course_key,
      max(choice.course_name)::text as label,
      max(choice.course_code)::text as sublabel,
      '[]'::jsonb as schedule,
      count(distinct choice.user_id)::bigint as selected
    from chosen choice
    group by choice.course_key

    union all

    select
      'professor'::text,
      left(
        coalesce(
          public.normalized_school_key('professor|' || choice.professor),
          'professor:unknown'
        ),
        220
      ),
      null::text,
      choice.professor,
      string_agg(
        distinct coalesce(choice.course_code, choice.course_name),
        ' · '
        order by coalesce(choice.course_code, choice.course_name)
      ),
      '[]'::jsonb,
      count(distinct choice.user_id)::bigint
    from chosen choice
    where choice.professor is not null
    group by choice.professor

    union all

    select
      'section'::text,
      left(
        coalesce(
          public.normalized_school_key(
            concat(
              'section|',
              choice.course_key,
              '|',
              choice.section_label,
              '|',
              coalesce(choice.professor, ''),
              '|',
              choice.meeting_times::text
            )
          ),
          'section:unknown'
        ),
        220
      ),
      choice.course_key,
      choice.section_label,
      concat_ws(' · ', max(choice.course_name), choice.professor),
      choice.meeting_times,
      count(distinct choice.user_id)::bigint
    from chosen choice
    where choice.section_label is not null
    group by
      choice.course_key,
      choice.section_label,
      choice.professor,
      choice.meeting_times
  )
  select
    dimension.kind,
    dimension.key,
    dimension.course_key,
    dimension.label,
    dimension.sublabel,
    dimension.schedule,
    greatest(
      5,
      (round(dimension.selected::numeric / 5) * 5)::bigint
    ),
    greatest(
      5,
      (round(cohort.size::numeric / 5) * 5)::bigint
    ),
    round(
      round(
        (
          dimension.selected::numeric
          / nullif(cohort.size, 0)::numeric
        ) * 100 / 5
      ) * 5,
      0
    )
  from dimensions dimension
  cross join cohort
  where cohort.size >= 5
    and dimension.selected >= 5
  order by
    case dimension.kind
      when 'course' then 1
      when 'section' then 2
      when 'professor' then 3
      else 4
    end,
    dimension.selected desc,
    dimension.label;
end;
$$;

revoke all on function public.get_course_choice_dimensions(text, smallint, text)
  from public, anon, authenticated;
grant execute on function public.get_course_choice_dimensions(text, smallint, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Cursor pagination for messages and community comments
-- ---------------------------------------------------------------------------

create or replace function public.get_conversation_messages_page(
  p_conversation_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  result jsonb;
begin
  if caller is null
     or not private.can_read_direct_conversation(p_conversation_id, caller) then
    raise exception 'Conversation is unavailable';
  end if;

  with message_page as (
    select
      message.id,
      message.sender_id,
      message.body,
      message.created_at
    from public.direct_messages message
    where message.conversation_id = p_conversation_id
      and message.deleted_at is null
      and (
        p_before_created_at is null
        or (
          p_before_id is null
          and message.created_at < p_before_created_at
        )
        or (
          p_before_id is not null
          and (message.created_at, message.id)
            < (p_before_created_at, p_before_id)
        )
      )
    order by message.created_at desc, message.id desc
    limit safe_limit + 1
  ),
  trimmed_page as (
    select page.*
    from message_page page
    order by page.created_at desc, page.id desc
    limit safe_limit
  ),
  oldest_item as (
    select page.created_at, page.id
    from trimmed_page page
    order by page.created_at, page.id
    limit 1
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'message_id', page.id,
            'sender_id', page.sender_id,
            'body', page.body,
            'created_at', page.created_at
          )
          order by page.created_at, page.id
        )
        from trimmed_page page
      ),
      '[]'::jsonb
    ),
    'has_more',
    (select count(*) > safe_limit from message_page),
    'next_cursor',
    (
      select jsonb_build_object(
        'created_at', oldest.created_at,
        'message_id', oldest.id
      )
      from oldest_item oldest
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_conversation_messages_page(
  uuid,
  integer,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public.get_conversation_messages_page(
  uuid,
  integer,
  timestamptz,
  uuid
) to authenticated;

create or replace function public.get_post_comments_page(
  p_post_id uuid,
  p_limit integer default 30,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  result jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  with visible_comments as materialized (
    select *
    from public.get_post_comments(p_post_id)
  ),
  root_page as (
    select comment.comment_id, comment.created_at
    from visible_comments comment
    where comment.parent_comment_id is null
      and (
        p_before_created_at is null
        or (
          p_before_id is null
          and comment.created_at < p_before_created_at
        )
        or (
          p_before_id is not null
          and (comment.created_at, comment.comment_id)
            < (p_before_created_at, p_before_id)
        )
      )
    order by comment.created_at desc, comment.comment_id desc
    limit safe_limit + 1
  ),
  trimmed_roots as (
    select root.comment_id, root.created_at
    from root_page root
    order by root.created_at desc, root.comment_id desc
    limit safe_limit
  ),
  selected_comments as (
    select comment.*
    from visible_comments comment
    where comment.comment_id in (
      select root.comment_id
      from trimmed_roots root
    )
       or comment.parent_comment_id in (
         select root.comment_id
         from trimmed_roots root
       )
  ),
  oldest_root as (
    select root.created_at, root.comment_id
    from trimmed_roots root
    order by root.created_at, root.comment_id
    limit 1
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(comment)
          order by
            coalesce(parent.created_at, comment.created_at),
            coalesce(comment.parent_comment_id, comment.comment_id),
            (comment.parent_comment_id is not null),
            comment.created_at,
            comment.comment_id
        )
        from selected_comments comment
        left join selected_comments parent
          on parent.comment_id = comment.parent_comment_id
      ),
      '[]'::jsonb
    ),
    'total_count',
    (
      select count(*)
      from visible_comments comment
    ),
    'has_more',
    (select count(*) > safe_limit from root_page),
    'next_cursor',
    (
      select jsonb_build_object(
        'created_at', oldest.created_at,
        'comment_id', oldest.comment_id
      )
      from oldest_root oldest
    )
  )
  into result;

  return result;
end;
$$;

revoke all on function public.get_post_comments_page(
  uuid,
  integer,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public.get_post_comments_page(
  uuid,
  integer,
  timestamptz,
  uuid
) to authenticated;

notify pgrst, 'reload schema';
