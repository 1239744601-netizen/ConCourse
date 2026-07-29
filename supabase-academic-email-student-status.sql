-- ConCourse verified-student academic-email gate
--
-- RUN THIS MIGRATION LAST.
--
-- A confirmed ConCourse login/private email authenticates an account only.
-- Verified student status requires all of the following:
--   1. a separately entered academic email on the institution allow-list;
--   2. a delivered, unexpired challenge confirmed with the correct code;
--   3. the approved academic-email request linked to that exact challenge.
--
-- SSO references, student documents, and manual review remain useful review
-- evidence, but they never grant school_memberships.status = 'verified'.
--
-- This migration is incremental, atomic, and safe to rerun.

begin;

do $$
begin
  if to_regclass('public.school_memberships') is null
     or to_regclass('public.school_verification_requests') is null
     or to_regclass(
       'private.academic_email_verification_challenges'
     ) is null
     or to_regclass('public.institution_academic_email_domains') is null
     or to_regclass('public.verification_audit_events') is null
     or to_regprocedure(
       'private.academic_email_domain_is_allowed(text,text)'
     ) is null
     or to_regprocedure(
       'private.append_verification_audit_event(text,uuid,uuid,text,text,text,text,jsonb)'
     ) is null then
    raise exception
      'Run the account-trust, Verification Center, evidence, and academic-email migrations first';
  end if;
end;
$$;

-- One canonical proof predicate is shared by reconciliation and the write
-- guard. The request must be the exact request referenced by the challenge.
create or replace function private.has_confirmed_academic_email_student_proof(
  p_user_id uuid,
  p_school_key text,
  p_school_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.academic_email_verification_challenges challenge
    join public.school_verification_requests verification_request
      on verification_request.id = challenge.request_id
     and verification_request.user_id = challenge.user_id
     and verification_request.school_key = challenge.school_key
     and verification_request.school_name = challenge.school_name
     and verification_request.evidence_kind = 'academic_email'
     and lower(verification_request.evidence_reference) =
       challenge.academic_email
     and verification_request.status = 'approved'
     and verification_request.decision_verification_method =
       'academic_email'
    where challenge.user_id = p_user_id
      and challenge.school_key = p_school_key
      and challenge.school_name = p_school_name
      and challenge.delivery_status = 'sent'
      and challenge.confirmed_at is not null
      and challenge.confirmed_at <= challenge.expires_at
      and challenge.superseded_at is null
      and private.academic_email_domain_is_allowed(
        challenge.school_key,
        challenge.academic_email
      )
  );
$$;

revoke all on function
  private.has_confirmed_academic_email_student_proof(uuid,text,text)
  from public, anon, authenticated;

-- Preserve successful codes created by the previous human-review version:
-- the challenge already proves control, so approve its exact linked request.
with promoted_request as (
  update public.school_verification_requests verification_request
  set
    status = 'approved',
    reviewed_at = coalesce(
      verification_request.reviewed_at,
      challenge.confirmed_at
    ),
    reviewed_by = null,
    reviewer_note =
      'Approved by the academic-email proof policy migration.',
    decision_verification_method = 'academic_email',
    updated_at = now()
  from private.academic_email_verification_challenges challenge
  where challenge.request_id = verification_request.id
    and challenge.user_id = verification_request.user_id
    and challenge.school_key = verification_request.school_key
    and challenge.school_name = verification_request.school_name
    and verification_request.evidence_kind = 'academic_email'
    and lower(verification_request.evidence_reference) =
      challenge.academic_email
    and verification_request.status in (
      'submitted',
      'under_review',
      'approved'
    )
    and challenge.delivery_status = 'sent'
    and challenge.confirmed_at is not null
    and challenge.confirmed_at <= challenge.expires_at
    and challenge.superseded_at is null
    and private.academic_email_domain_is_allowed(
      challenge.school_key,
      challenge.academic_email
    )
    and (
      verification_request.status is distinct from 'approved'
      or verification_request.decision_verification_method
        is distinct from 'academic_email'
    )
  returning
    verification_request.id,
    verification_request.user_id,
    verification_request.school_key
)
insert into public.verification_audit_events (
  workflow,
  case_id,
  actor_id,
  action,
  from_status,
  to_status,
  note,
  metadata
)
select
  'school_verification',
  promoted_request.id,
  null,
  'academic_email_proof_reconciled',
  'legacy',
  'approved',
  'A previously confirmed academic-email code was reconciled.',
  jsonb_build_object(
    'school_key',
    promoted_request.school_key,
    'student_status_policy',
    'academic_email_only'
  )
from promoted_request;

-- Prevent every future verified transition unless the exact database proof
-- above exists. A dashboard edit, service-role script, or old review RPC
-- cannot bypass this invariant.
create or replace function private.enforce_academic_email_student_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'verified'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'verified'
       or old.user_id is distinct from new.user_id
       or old.school_key is distinct from new.school_key
       or old.school_name is distinct from new.school_name
       or old.verification_method is distinct from new.verification_method
       or old.verified_at is distinct from new.verified_at
     ) then
    if tg_op = 'UPDATE' and old.status = 'revoked' then
      raise exception
        'A revoked membership cannot be restored by email verification';
    end if;
    if new.verification_method is distinct from 'academic_email'
       or new.verified_at is null then
      raise exception
        'Verified student status requires a confirmed academic-email code';
    end if;

    if not private.has_confirmed_academic_email_student_proof(
      new.user_id,
      new.school_key,
      new.school_name
    ) then
      raise exception
        'Verified student status requires its linked approved academic-email proof';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_academic_email_student_status()
  from public, anon, authenticated;

drop trigger if exists school_memberships_academic_email_status_guard
  on public.school_memberships;
create trigger school_memberships_academic_email_status_guard
  before insert or update on public.school_memberships
  for each row execute procedure
    private.enforce_academic_email_student_status();

-- Promote only memberships backed by a successful code. This also restores
-- users whose old code was confirmed while the previous flow waited for a
-- human reviewer.
with confirmed_proof as (
  select
    membership.user_id,
    membership.school_key,
    max(challenge.confirmed_at) as confirmed_at
  from public.school_memberships membership
  join private.academic_email_verification_challenges challenge
    on challenge.user_id = membership.user_id
   and challenge.school_key = membership.school_key
   and challenge.school_name = membership.school_name
  join public.school_verification_requests verification_request
    on verification_request.id = challenge.request_id
   and verification_request.user_id = challenge.user_id
   and verification_request.school_key = challenge.school_key
   and verification_request.school_name = challenge.school_name
   and verification_request.evidence_kind = 'academic_email'
   and lower(verification_request.evidence_reference) =
     challenge.academic_email
   and verification_request.status = 'approved'
   and verification_request.decision_verification_method =
     'academic_email'
  where membership.status <> 'revoked'
    and challenge.delivery_status = 'sent'
    and challenge.confirmed_at is not null
    and challenge.confirmed_at <= challenge.expires_at
    and challenge.superseded_at is null
    and private.academic_email_domain_is_allowed(
      challenge.school_key,
      challenge.academic_email
    )
  group by membership.user_id, membership.school_key
),
promoted_membership as (
  update public.school_memberships membership
  set
    status = 'verified',
    verification_method = 'academic_email',
    verified_at = proof.confirmed_at,
    updated_at = now()
  from confirmed_proof proof
  where proof.user_id = membership.user_id
    and proof.school_key = membership.school_key
    and (
      membership.status is distinct from 'verified'
      or membership.verification_method is distinct from 'academic_email'
      or membership.verified_at is distinct from proof.confirmed_at
    )
  returning membership.user_id, membership.school_key
)
insert into public.verification_audit_events (
  workflow,
  case_id,
  actor_id,
  action,
  from_status,
  to_status,
  note,
  metadata
)
select
  'school_verification',
  promoted_membership.user_id,
  null,
  'academic_email_student_status_granted',
  'legacy',
  'verified',
  'Student status was granted from a confirmed academic-email code.',
  jsonb_build_object(
    'school_key',
    promoted_membership.school_key,
    'student_status_policy',
    'academic_email_only'
  )
from promoted_membership;

-- An academic request without a matching successful challenge is not proof.
with rejected_request as (
  update public.school_verification_requests verification_request
  set
    status = 'rejected',
    reviewed_at = coalesce(verification_request.reviewed_at, now()),
    reviewed_by = null,
    reviewer_note =
      'Rejected by the academic-email proof policy: no matching confirmed code.',
    decision_verification_method = null,
    updated_at = now()
  where verification_request.evidence_kind = 'academic_email'
    and verification_request.status in (
      'submitted',
      'under_review',
      'approved'
    )
    and not exists (
      select 1
      from private.academic_email_verification_challenges challenge
      where challenge.request_id = verification_request.id
        and challenge.user_id = verification_request.user_id
        and challenge.school_key = verification_request.school_key
        and challenge.school_name = verification_request.school_name
        and challenge.academic_email =
          lower(verification_request.evidence_reference)
        and challenge.delivery_status = 'sent'
        and challenge.confirmed_at is not null
        and challenge.confirmed_at <= challenge.expires_at
        and challenge.superseded_at is null
        and private.academic_email_domain_is_allowed(
          challenge.school_key,
          challenge.academic_email
        )
    )
  returning
    verification_request.id,
    verification_request.user_id,
    verification_request.school_key
)
insert into public.verification_audit_events (
  workflow,
  case_id,
  actor_id,
  action,
  from_status,
  to_status,
  note,
  metadata
)
select
  'school_verification',
  rejected_request.id,
  null,
  'unproven_academic_email_request_rejected',
  'legacy',
  'rejected',
  'No matching successfully confirmed academic-email challenge existed.',
  jsonb_build_object(
    'school_key',
    rejected_request.school_key,
    'student_status_policy',
    'academic_email_only'
  )
from rejected_request;

-- Demote every legacy row that cannot prove the academic-email chain.
with demoted_membership as (
  update public.school_memberships membership
  set
    status = 'pending',
    verification_method = null,
    verified_at = null,
    updated_at = now()
  where membership.status = 'verified'
    and not private.has_confirmed_academic_email_student_proof(
      membership.user_id,
      membership.school_key,
      membership.school_name
    )
  returning membership.user_id, membership.school_key
)
insert into public.verification_audit_events (
  workflow,
  case_id,
  actor_id,
  action,
  from_status,
  to_status,
  note,
  metadata
)
select
  'school_verification',
  demoted_membership.user_id,
  null,
  'unproven_student_status_demoted',
  'verified',
  'pending',
  'Legacy status had no matching confirmed academic-email proof.',
  jsonb_build_object(
    'school_key',
    demoted_membership.school_key,
    'student_status_policy',
    'academic_email_only'
  )
from demoted_membership;

alter table public.school_memberships
  drop constraint if exists school_memberships_verified_evidence;
alter table public.school_memberships
  add constraint school_memberships_verified_evidence
  check (
    status <> 'verified'
    or (
      verification_method is not distinct from 'academic_email'
      and verified_at is not null
    )
  );

-- Retain the complete legacy submission implementation for SSO/document
-- evidence, but put a strict academic-email gate in front of it.
do $$
begin
  if to_regprocedure(
    'public.submit_school_verification_request_before_academic_gate(text,text,text)'
  ) is null then
    if to_regprocedure(
      'public.submit_school_verification_request(text,text,text)'
    ) is null then
      raise exception 'School verification submission RPC is missing';
    end if;
    execute
      'alter function public.submit_school_verification_request(text,text,text) '
      || 'rename to submit_school_verification_request_before_academic_gate';
  end if;
end;
$$;

revoke all on function
  public.submit_school_verification_request_before_academic_gate(text,text,text)
  from public, anon, authenticated;

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
begin
  if lower(trim(coalesce(p_evidence_kind, ''))) = 'academic_email' then
    raise exception
      'Use the academic email code flow to verify student status';
  end if;

  return public.submit_school_verification_request_before_academic_gate(
    p_evidence_kind,
    p_evidence_reference,
    p_user_note
  );
end;
$$;

revoke all on function
  public.submit_school_verification_request(text,text,text)
  from public, anon, authenticated;
grant execute on function
  public.submit_school_verification_request(text,text,text)
  to authenticated;

-- Preserve every non-school Verification Center workflow in the established
-- implementation. The school branch is replaced with a policy-safe branch
-- that can review evidence but cannot grant verified student status.
do $$
begin
  if to_regprocedure(
    'public.review_verification_center_case_before_academic_gate(text,uuid,text,text,jsonb)'
  ) is null then
    if to_regprocedure(
      'public.review_verification_center_case(text,uuid,text,text,jsonb)'
    ) is null then
      raise exception 'Verification Center review RPC is missing';
    end if;
    execute
      'alter function public.review_verification_center_case(text,uuid,text,text,jsonb) '
      || 'rename to review_verification_center_case_before_academic_gate';
  end if;
end;
$$;

revoke all on function
  public.review_verification_center_case_before_academic_gate(
    text,uuid,text,text,jsonb
  )
  from public, anon, authenticated;

create or replace function public.review_verification_center_case(
  p_workflow text,
  p_case_id uuid,
  p_action text,
  p_note text default null,
  p_options jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_workflow text := lower(trim(coalesce(p_workflow, '')));
  safe_action text := lower(trim(coalesce(p_action, '')));
  safe_note text := nullif(trim(coalesce(p_note, '')), '');
  safe_options jsonb := coalesce(p_options, '{}'::jsonb);
  from_status text;
  to_status text;
  safe_verification_method text;
  school_row public.school_verification_requests%rowtype;
  membership_row public.school_memberships%rowtype;
begin
  if safe_workflow <> 'school_verification' then
    return public.review_verification_center_case_before_academic_gate(
      p_workflow,
      p_case_id,
      p_action,
      p_note,
      p_options
    );
  end if;

  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_case_id is null then
    raise exception 'Case identifier is required';
  end if;
  if safe_note is not null and char_length(safe_note) > 1000 then
    raise exception 'Reviewer note is too long';
  end if;
  if jsonb_typeof(safe_options) <> 'object'
     or pg_column_size(safe_options) > 8192 then
    raise exception 'Invalid review options';
  end if;
  if not private.has_concourse_admin_scope(
    caller,
    'school_verification.review'
  ) then
    raise exception 'Administrator scope required';
  end if;

  select verification_request.*
  into school_row
  from public.school_verification_requests verification_request
  where verification_request.id = p_case_id
  for update;

  if not found
     or school_row.status not in ('submitted', 'under_review') then
    raise exception 'School verification request is unavailable';
  end if;
  if school_row.user_id = caller then
    raise exception 'Administrators cannot review their own request';
  end if;
  if school_row.status = 'under_review'
     and school_row.reviewed_by is not null
     and school_row.reviewed_by <> caller
     and not private.is_concourse_owner(caller) then
    raise exception 'Another administrator is reviewing this request';
  end if;

  from_status := school_row.status;

  if safe_action = 'start_review' then
    update public.school_verification_requests verification_request
    set
      status = 'under_review',
      reviewed_by = caller,
      updated_at = now()
    where verification_request.id = p_case_id;
    to_status := 'under_review';
  elsif safe_action in ('approve', 'reject') then
    if safe_action = 'reject' and safe_note is null then
      raise exception 'A rejection note is required';
    end if;
    if safe_action = 'approve'
       and school_row.evidence_kind = 'academic_email' then
      raise exception
        'Academic email verification completes only through the code flow';
    end if;

    select membership.*
    into membership_row
    from public.school_memberships membership
    where membership.user_id = school_row.user_id
    for update;

    if not found
       or membership_row.school_key <> school_row.school_key
       or membership_row.school_name <> school_row.school_name then
      raise exception 'The school profile changed after submission';
    end if;
    if membership_row.status = 'verified' then
      raise exception 'This membership has already been verified';
    end if;
    if safe_action = 'approve'
       and membership_row.status = 'revoked' then
      raise exception 'A revoked membership cannot be approved';
    end if;

    safe_verification_method := case school_row.evidence_kind
      when 'institution_sso' then 'institution_sso'
      when 'manual_review' then 'manual'
      else null
    end;
    to_status := case
      when safe_action = 'approve' then 'approved'
      else 'rejected'
    end;

    update public.school_verification_requests verification_request
    set
      status = to_status,
      reviewed_at = now(),
      reviewed_by = caller,
      reviewer_note = safe_note,
      decision_verification_method = case
        when safe_action = 'approve' then safe_verification_method
        else null
      end,
      updated_at = now()
    where verification_request.id = p_case_id;

    update public.school_memberships membership
    set
      status = case
        when safe_action = 'reject' then 'rejected'
        else 'pending'
      end,
      verification_method = null,
      verified_at = null,
      updated_at = now()
    where membership.user_id = school_row.user_id
      and membership.school_key = school_row.school_key
      and membership.status not in ('verified', 'revoked');
  else
    raise exception 'Unsupported school verification action';
  end if;

  perform private.append_verification_audit_event(
    'school_verification',
    p_case_id,
    caller,
    safe_action,
    from_status,
    to_status,
    safe_note,
    jsonb_build_object(
      'evidence_kind',
      school_row.evidence_kind,
      'verification_method',
      case
        when safe_action = 'approve' then safe_verification_method
        else null
      end,
      'student_status_granted',
      false
    )
  );

  return jsonb_build_object(
    'workflow', safe_workflow,
    'case_id', p_case_id,
    'action', safe_action,
    'from_status', from_status,
    'status', to_status,
    'payment_provider_state_changed', false
  );
end;
$$;

revoke all on function public.review_verification_center_case(
  text,uuid,text,text,jsonb
) from public, anon, authenticated;
grant execute on function public.review_verification_center_case(
  text,uuid,text,text,jsonb
) to authenticated;

-- Wrap either version of the existing confirmation RPC. On an older database
-- it upgrades the old submitted_for_review result inside the same transaction.
-- On a fresh database the updated RPC already returns verified.
do $$
begin
  if to_regprocedure(
    'public.confirm_academic_email_challenge_before_student_status(uuid,uuid,text)'
  ) is null then
    if to_regprocedure(
      'public.confirm_academic_email_verification_challenge(uuid,uuid,text)'
    ) is null then
      raise exception 'Academic email confirmation RPC is missing';
    end if;
    execute
      'alter function public.confirm_academic_email_verification_challenge(uuid,uuid,text) '
      || 'rename to confirm_academic_email_challenge_before_student_status';
  end if;
end;
$$;

revoke all on function
  public.confirm_academic_email_challenge_before_student_status(
    uuid,uuid,text
  )
  from public, anon, authenticated, service_role;
grant execute on function
  public.confirm_academic_email_challenge_before_student_status(
    uuid,uuid,text
  )
  to service_role;

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
  result jsonb;
  result_status text;
  result_request_id uuid;
  challenge private.academic_email_verification_challenges%rowtype;
  verification_request public.school_verification_requests%rowtype;
  membership public.school_memberships%rowtype;
  prior_membership_status text;
  active_nonacademic_request_id uuid;
  active_nonacademic_request_status text;
  confirmed_at_value timestamptz;
  challenge_found boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select school_membership.*
  into membership
  from public.school_memberships school_membership
  where school_membership.user_id = p_user_id
  for update;

  if found and membership.status = 'revoked' then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- The legacy RPC enforces one active request of any evidence kind. Move one
  -- non-academic request out of the way within this transaction; unsuccessful
  -- code attempts restore it below, while a successful code supersedes it.
  select
    active_request.id,
    active_request.status
  into
    active_nonacademic_request_id,
    active_nonacademic_request_status
  from public.school_verification_requests active_request
  where active_request.user_id = p_user_id
    and active_request.evidence_kind <> 'academic_email'
    and active_request.status in ('submitted', 'under_review')
  order by active_request.submitted_at, active_request.id
  limit 1
  for update;

  if active_nonacademic_request_id is not null then
    update public.school_verification_requests active_request
    set status = 'withdrawn', updated_at = now()
    where active_request.id = active_nonacademic_request_id;
  end if;

  result :=
    public.confirm_academic_email_challenge_before_student_status(
      p_challenge_id,
      p_user_id,
      p_code_hash
    );
  result_status := coalesce(result ->> 'status', '');

  if result_status = 'verified' then
    return result;
  end if;
  if result_status = 'request_limit_reached'
     and (
       select count(*)
       from public.school_verification_requests recent_request
       where recent_request.user_id = p_user_id
         and recent_request.evidence_kind = 'academic_email'
         and recent_request.submitted_at > now() - interval '30 days'
     ) < 5 then
    -- Older deployments counted unrelated SSO/document requests. A correct
    -- code reaches this status only after its digest has matched, so complete
    -- the academic-only flow without weakening the academic request limit.
    select challenge_row.*
    into challenge
    from private.academic_email_verification_challenges challenge_row
    where challenge_row.id = p_challenge_id
      and challenge_row.user_id = p_user_id
    for update;
    challenge_found := found;

    select school_membership.*
    into membership
    from public.school_memberships school_membership
    where school_membership.user_id = p_user_id
    for update;

    if not challenge_found
       or not found
       or membership.status in ('verified', 'revoked')
       or membership.school_key <> challenge.school_key
       or membership.school_name <> challenge.school_name
       or challenge.delivery_status <> 'sent'
       or challenge.confirmed_at is not null
       or challenge.superseded_at is not null
       or challenge.expires_at <= now()
       or challenge.code_hash <> lower(trim(coalesce(p_code_hash, '')))
       or not private.academic_email_domain_is_allowed(
         challenge.school_key,
         challenge.academic_email
       ) then
      raise exception 'Academic email proof is unavailable';
    end if;
    if exists (
      select 1
      from public.school_verification_requests active_request
      where active_request.user_id = p_user_id
        and active_request.evidence_kind = 'academic_email'
        and active_request.status in ('submitted', 'under_review')
    ) then
      raise exception 'An academic email request is already active';
    end if;
    if exists (
      select 1
      from public.school_verification_requests used_email
      where used_email.user_id <> p_user_id
        and used_email.evidence_kind = 'academic_email'
        and lower(used_email.evidence_reference) =
          challenge.academic_email
        and used_email.status in ('submitted', 'under_review', 'approved')
    ) then
      raise exception 'Academic email is already in use';
    end if;

    prior_membership_status := membership.status;
    confirmed_at_value := now();

    insert into public.school_verification_requests (
      user_id,
      school_name,
      school_key,
      evidence_kind,
      evidence_reference,
      user_note,
      status,
      reviewed_at,
      reviewed_by,
      reviewer_note,
      decision_verification_method
    ) values (
      p_user_id,
      challenge.school_name,
      challenge.school_key,
      'academic_email',
      challenge.academic_email,
      'Academic email ownership confirmed by an expiring code.',
      'approved',
      confirmed_at_value,
      null,
      'Automatically approved after successful academic-email code confirmation.',
      'academic_email'
    )
    returning id into result_request_id;

    update private.academic_email_verification_challenges challenge_row
    set
      confirmed_at = confirmed_at_value,
      request_id = result_request_id
    where challenge_row.id = challenge.id
      and challenge_row.user_id = p_user_id;

    update private.academic_email_verification_challenges other_challenge
    set superseded_at = confirmed_at_value
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

    update public.school_memberships school_membership
    set
      status = 'verified',
      verification_method = 'academic_email',
      verified_at = confirmed_at_value,
      updated_at = confirmed_at_value
    where school_membership.user_id = p_user_id
      and school_membership.school_key = challenge.school_key
      and school_membership.school_name = challenge.school_name;

    perform private.append_verification_audit_event(
      'school_verification',
      result_request_id,
      p_user_id,
      'academic_email_verified',
      prior_membership_status,
      'verified',
      null,
      jsonb_build_object(
        'school_key',
        challenge.school_key,
        'academic_email',
        private.mask_academic_email(challenge.academic_email),
        'human_review_required',
        false
      )
    );

    return jsonb_build_object(
      'status', 'verified',
      'request_id', result_request_id,
      'verified_at', confirmed_at_value
    );
  end if;
  if result_status <> 'submitted_for_review' then
    if active_nonacademic_request_id is not null then
      update public.school_verification_requests active_request
      set
        status = active_nonacademic_request_status,
        updated_at = now()
      where active_request.id = active_nonacademic_request_id
        and active_request.status = 'withdrawn';
    end if;
    return result;
  end if;

  begin
    result_request_id := (result ->> 'request_id')::uuid;
  exception
    when others then
      raise exception 'Academic email confirmation returned an invalid request';
  end;

  select challenge_row.*
  into challenge
  from private.academic_email_verification_challenges challenge_row
  where challenge_row.id = p_challenge_id
    and challenge_row.user_id = p_user_id
    and challenge_row.request_id = result_request_id
  for update;

  if not found
     or challenge.delivery_status <> 'sent'
     or challenge.confirmed_at is null
     or challenge.confirmed_at > challenge.expires_at
     or challenge.superseded_at is not null
     or not private.academic_email_domain_is_allowed(
       challenge.school_key,
       challenge.academic_email
     ) then
    raise exception 'Academic email proof is unavailable';
  end if;

  select request_row.*
  into verification_request
  from public.school_verification_requests request_row
  where request_row.id = result_request_id
    and request_row.user_id = p_user_id
  for update;

  if not found
     or verification_request.school_key <> challenge.school_key
     or verification_request.school_name <> challenge.school_name
     or verification_request.evidence_kind <> 'academic_email'
     or lower(verification_request.evidence_reference) <>
       challenge.academic_email
     or verification_request.status not in ('submitted', 'under_review') then
    raise exception 'Academic email request does not match its proof';
  end if;

  select school_membership.*
  into membership
  from public.school_memberships school_membership
  where school_membership.user_id = p_user_id
  for update;

  if not found
     or membership.school_key <> challenge.school_key
     or membership.school_name <> challenge.school_name
     or membership.status in ('verified', 'revoked') then
    raise exception 'School membership is unavailable for verification';
  end if;

  prior_membership_status := membership.status;

  update public.school_verification_requests request_row
  set
    status = 'approved',
    reviewed_at = challenge.confirmed_at,
    reviewed_by = null,
    reviewer_note =
      'Automatically approved after successful academic-email code confirmation.',
    decision_verification_method = 'academic_email',
    updated_at = now()
  where request_row.id = result_request_id;

  update public.school_memberships school_membership
  set
    status = 'verified',
    verification_method = 'academic_email',
    verified_at = challenge.confirmed_at,
    updated_at = now()
  where school_membership.user_id = p_user_id
    and school_membership.school_key = challenge.school_key
    and school_membership.school_name = challenge.school_name;

  perform private.append_verification_audit_event(
    'school_verification',
    result_request_id,
    p_user_id,
    'academic_email_verified',
    prior_membership_status,
    'verified',
    null,
    jsonb_build_object(
      'school_key',
      challenge.school_key,
      'academic_email',
      private.mask_academic_email(challenge.academic_email),
      'human_review_required',
      false
    )
  );

  return jsonb_build_object(
    'status', 'verified',
    'request_id', result_request_id,
    'verified_at', challenge.confirmed_at
  );
end;
$$;

revoke all on function
  public.confirm_academic_email_verification_challenge(uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.confirm_academic_email_verification_challenge(uuid,uuid,text)
  to service_role;

notify pgrst, 'reload schema';

commit;
