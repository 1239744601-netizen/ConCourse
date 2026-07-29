-- ConCourse capability-based Verification Center
-- Run after:
--   1. supabase-setup-part-1.sql
--   2. supabase-setup-part-2.sql
--   3. supabase-global-market-fix.sql
--   4. supabase-social-comments.sql
--   5. supabase-account-trust-and-data-fix.sql
--   6. supabase-owner-console.sql
--
-- This migration is intentionally separate and idempotent. Browser clients
-- never receive table access to administrator assignments, user evidence,
-- payment projections, reports, disputes, or the immutable review log.
--
-- Important payment boundary:
-- A ConCourse administrator may review user-supplied payment evidence and may
-- recommend a dispute outcome. No browser-accessible RPC in this migration
-- changes a payment-provider state. Only the existing service-role payment
-- webhook may record pending, held, released, refunded, or failed money states.

begin;

do $$
declare
  required_relation text;
  required_procedure text;
begin
  foreach required_relation in array array[
    'public.concourse_admins',
    'public.school_memberships',
    'public.school_verification_requests',
    'public.account_deletion_requests',
    'public.content_reports',
    'public.marketplace_listings',
    'public.marketplace_orders',
    'public.marketplace_disputes',
    'public.marketplace_reports',
    'private.marketplace_payment_projections'
  ]
  loop
    if to_regclass(required_relation) is null then
      raise exception 'Missing prerequisite relation: %', required_relation;
    end if;
  end loop;

  foreach required_procedure in array array[
    'public.set_concourse_updated_at()',
    'private.is_concourse_admin(uuid,text[])',
    'public.get_school_verification_review_queue(text,integer)',
    'public.review_school_verification_request(uuid,text,text,text)'
  ]
  loop
    if to_regprocedure(required_procedure) is null then
      raise exception 'Missing prerequisite procedure: %', required_procedure;
    end if;
  end loop;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Capability registry
-- ---------------------------------------------------------------------------

create table if not exists public.concourse_admin_scopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in (
    'school_verification.review',
    'payment_evidence.review',
    'marketplace_disputes.review',
    'marketplace_reports.review',
    'content_reports.review',
    'account_deletion.review',
    'support_requests.review'
  )),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, scope)
);

create index if not exists concourse_admin_scopes_scope_user_idx
  on public.concourse_admin_scopes (scope, user_id);

alter table public.concourse_admin_scopes enable row level security;
revoke all on table public.concourse_admin_scopes
  from public, anon, authenticated;

create or replace function private.allowed_concourse_admin_scopes()
returns text[]
language sql
immutable
security definer
set search_path = ''
as $$
  select array[
    'school_verification.review',
    'payment_evidence.review',
    'marketplace_disputes.review',
    'marketplace_reports.review',
    'content_reports.review',
    'account_deletion.review',
    'support_requests.review'
  ]::text[];
$$;

revoke all on function private.allowed_concourse_admin_scopes()
  from public, anon, authenticated;

create or replace function private.concourse_admin_scope_list(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct granted.scope order by granted.scope), '{}'::text[])
  from (
    select explicit_scope.scope
    from public.concourse_admin_scopes explicit_scope
    where explicit_scope.user_id = p_user_id

    union all

    select 'school_verification.review'::text
    from public.concourse_admins legacy
    where legacy.user_id = p_user_id
      and legacy.role = 'reviewer'

    union all

    select 'account_deletion.review'::text
    from public.concourse_admins legacy
    where legacy.user_id = p_user_id
      and legacy.role = 'privacy'

    union all

    select unnest(private.allowed_concourse_admin_scopes())
    from public.concourse_admins owner_admin
    where owner_admin.user_id = p_user_id
      and owner_admin.role = 'owner'
  ) granted;
$$;

revoke all on function private.concourse_admin_scope_list(uuid)
  from public, anon, authenticated;

create or replace function private.has_concourse_admin_scope(
  p_user_id uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_scope = any(private.allowed_concourse_admin_scopes())
    and p_scope = any(private.concourse_admin_scope_list(p_user_id));
$$;

revoke all on function private.has_concourse_admin_scope(uuid, text)
  from public, anon, authenticated;

create or replace function private.is_concourse_owner(p_user_id uuid)
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
      from public.concourse_admins owner_admin
      where owner_admin.user_id = p_user_id
        and owner_admin.role = 'owner'
    );
$$;

revoke all on function private.is_concourse_owner(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Immutable administrator audit trail
-- ---------------------------------------------------------------------------

create table if not exists public.verification_audit_events (
  id bigint generated always as identity primary key,
  workflow text not null check (workflow in (
    'admin_team',
    'school_verification',
    'payment_evidence',
    'marketplace_dispute',
    'marketplace_report',
    'content_report',
    'account_deletion',
    'support_request'
  )),
  case_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null
    check (action = trim(action) and char_length(action) between 2 and 80),
  from_status text,
  to_status text,
  note text check (
    note is null
    or (note = trim(note) and char_length(note) between 1 and 2000)
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
    and pg_column_size(metadata) <= 16384
  ),
  created_at timestamptz not null default now()
);

create index if not exists verification_audit_events_case_idx
  on public.verification_audit_events (workflow, case_id, created_at, id);
create index if not exists verification_audit_events_actor_idx
  on public.verification_audit_events (actor_id, created_at desc, id desc);

alter table public.verification_audit_events enable row level security;
revoke all on table public.verification_audit_events
  from public, anon, authenticated;

create or replace function private.prevent_verification_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Verification audit events are immutable';
end;
$$;

revoke all on function private.prevent_verification_audit_mutation()
  from public, anon, authenticated;

drop trigger if exists verification_audit_events_immutable
  on public.verification_audit_events;
create trigger verification_audit_events_immutable
  before update or delete on public.verification_audit_events
  for each row execute procedure private.prevent_verification_audit_mutation();

create or replace function private.append_verification_audit_event(
  p_workflow text,
  p_case_id uuid,
  p_actor_id uuid,
  p_action text,
  p_from_status text,
  p_to_status text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
  safe_note text := nullif(trim(coalesce(p_note, '')), '');
  safe_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if safe_metadata is null
     or jsonb_typeof(safe_metadata) <> 'object'
     or pg_column_size(safe_metadata) > 16384 then
    raise exception 'Invalid audit metadata';
  end if;

  insert into public.verification_audit_events (
    workflow,
    case_id,
    actor_id,
    action,
    from_status,
    to_status,
    note,
    metadata
  ) values (
    p_workflow,
    p_case_id,
    p_actor_id,
    trim(p_action),
    p_from_status,
    p_to_status,
    safe_note,
    safe_metadata
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function private.append_verification_audit_event(
  text, uuid, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payment-evidence and general support requests
-- ---------------------------------------------------------------------------

create table if not exists public.marketplace_payment_review_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete restrict,
  requested_by uuid references auth.users(id) on delete set null,
  evidence_kind text not null check (evidence_kind in (
    'provider_receipt',
    'bank_statement',
    'payment_issue',
    'other'
  )),
  evidence_reference text check (
    evidence_reference is null
    or (
      evidence_reference = trim(evidence_reference)
      and char_length(evidence_reference) between 1 and 500
    )
  ),
  user_note text check (
    user_note is null
    or (user_note = trim(user_note) and char_length(user_note) between 1 and 2000)
  ),
  status text not null default 'submitted' check (status in (
    'submitted',
    'under_review',
    'evidence_accepted',
    'rejected',
    'withdrawn'
  )),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text check (
    reviewer_note is null
    or (
      reviewer_note = trim(reviewer_note)
      and char_length(reviewer_note) between 1 and 2000
    )
  ),
  updated_at timestamptz not null default now(),
  check (
    status not in ('evidence_accepted', 'rejected')
    or reviewed_at is not null
  )
);

create unique index if not exists marketplace_payment_review_one_active_idx
  on public.marketplace_payment_review_requests (order_id, requested_by)
  where status in ('submitted', 'under_review');
create index if not exists marketplace_payment_review_queue_idx
  on public.marketplace_payment_review_requests (status, submitted_at, id);
create index if not exists marketplace_payment_review_requester_idx
  on public.marketplace_payment_review_requests (requested_by, submitted_at desc, id desc);

alter table public.marketplace_payment_review_requests enable row level security;
revoke all on table public.marketplace_payment_review_requests
  from public, anon, authenticated;

drop trigger if exists marketplace_payment_review_requests_set_updated_at
  on public.marketplace_payment_review_requests;
create trigger marketplace_payment_review_requests_set_updated_at
  before update on public.marketplace_payment_review_requests
  for each row execute procedure public.set_concourse_updated_at();

create table if not exists public.concourse_support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in (
    'account',
    'school',
    'marketplace',
    'payment',
    'community',
    'privacy',
    'safety',
    'technical',
    'other'
  )),
  subject text not null check (
    subject = trim(subject)
    and char_length(subject) between 3 and 160
  ),
  details text not null check (
    details = trim(details)
    and char_length(details) between 10 and 5000
  ),
  status text not null default 'submitted' check (status in (
    'submitted',
    'under_review',
    'resolved',
    'rejected',
    'withdrawn'
  )),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewer_note text check (
    reviewer_note is null
    or (
      reviewer_note = trim(reviewer_note)
      and char_length(reviewer_note) between 1 and 2000
    )
  ),
  updated_at timestamptz not null default now(),
  check (
    status not in ('resolved', 'rejected')
    or reviewed_at is not null
  )
);

create index if not exists concourse_support_requests_queue_idx
  on public.concourse_support_requests (status, submitted_at, id);
create index if not exists concourse_support_requests_user_idx
  on public.concourse_support_requests (user_id, submitted_at desc, id desc);

alter table public.concourse_support_requests enable row level security;
revoke all on table public.concourse_support_requests
  from public, anon, authenticated;

drop trigger if exists concourse_support_requests_set_updated_at
  on public.concourse_support_requests;
create trigger concourse_support_requests_set_updated_at
  before update on public.concourse_support_requests
  for each row execute procedure public.set_concourse_updated_at();

-- Existing review tables gain reviewer metadata without changing their current
-- public status vocabulary.
alter table public.marketplace_disputes
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.marketplace_disputes
  add column if not exists reviewed_at timestamptz;
alter table public.marketplace_disputes
  add column if not exists recommended_resolution text;

alter table public.marketplace_disputes
  drop constraint if exists marketplace_disputes_recommended_resolution_check;
alter table public.marketplace_disputes
  add constraint marketplace_disputes_recommended_resolution_check
  check (
    recommended_resolution is null
    or recommended_resolution in ('refund_buyer', 'release_seller', 'close')
  );

alter table public.marketplace_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.marketplace_reports
  add column if not exists reviewed_at timestamptz;
alter table public.marketplace_reports
  add column if not exists reviewer_note text;
alter table public.marketplace_reports
  add column if not exists updated_at timestamptz not null default now();

alter table public.marketplace_reports
  drop constraint if exists marketplace_reports_reviewer_note_bounded;
alter table public.marketplace_reports
  add constraint marketplace_reports_reviewer_note_bounded
  check (
    reviewer_note is null
    or (
      reviewer_note = trim(reviewer_note)
      and char_length(reviewer_note) between 1 and 2000
    )
  );

drop trigger if exists marketplace_reports_set_updated_at
  on public.marketplace_reports;
create trigger marketplace_reports_set_updated_at
  before update on public.marketplace_reports
  for each row execute procedure public.set_concourse_updated_at();

alter table public.content_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.content_reports
  add column if not exists reviewed_at timestamptz;
alter table public.content_reports
  add column if not exists reviewer_note text;
alter table public.content_reports
  add column if not exists updated_at timestamptz not null default now();

alter table public.content_reports
  drop constraint if exists content_reports_reviewer_note_bounded;
alter table public.content_reports
  add constraint content_reports_reviewer_note_bounded
  check (
    reviewer_note is null
    or (
      reviewer_note = trim(reviewer_note)
      and char_length(reviewer_note) between 1 and 2000
    )
  );

drop trigger if exists content_reports_set_updated_at
  on public.content_reports;
create trigger content_reports_set_updated_at
  before update on public.content_reports
  for each row execute procedure public.set_concourse_updated_at();

alter table public.account_deletion_requests
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.account_deletion_requests
  add column if not exists reviewed_at timestamptz;
alter table public.account_deletion_requests
  add column if not exists reviewer_note text;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_reviewer_note_bounded;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_reviewer_note_bounded
  check (
    reviewer_note is null
    or (
      reviewer_note = trim(reviewer_note)
      and char_length(reviewer_note) between 1 and 2000
    )
  );

-- Retain the existing deletion status vocabulary. A browser administrator may
-- triage a request into processing, but only the trusted deletion worker may
-- ever complete the actual auth/storage deletion and set completed.

-- ---------------------------------------------------------------------------
-- Caller context and owner-managed administrator team
-- ---------------------------------------------------------------------------

create or replace function public.get_my_concourse_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  legacy_role text;
  scope_list text[];
  is_owner boolean;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select legacy.role
  into legacy_role
  from public.concourse_admins legacy
  where legacy.user_id = caller;

  scope_list := private.concourse_admin_scope_list(caller);
  is_owner := private.is_concourse_owner(caller);

  return jsonb_build_object(
    'is_admin', is_owner
      or legacy_role is not null
      or cardinality(scope_list) > 0,
    'role', case
      when is_owner then 'owner'
      when legacy_role is not null then legacy_role
      when cardinality(scope_list) > 0 then 'admin'
      else null
    end,
    'scopes', to_jsonb(scope_list),
    'capabilities', jsonb_build_object(
      -- Backwards-compatible Owner Console keys.
      'view_school_verification_queue',
        private.has_concourse_admin_scope(caller, 'school_verification.review'),
      'review_school_verification_requests',
        private.has_concourse_admin_scope(caller, 'school_verification.review'),
      'view_owner_summary', is_owner,
      -- Verification Center keys.
      'view_verification_center', cardinality(scope_list) > 0,
      'manage_admin_team', is_owner,
      'review_school_verification',
        private.has_concourse_admin_scope(caller, 'school_verification.review'),
      'review_payment_evidence',
        private.has_concourse_admin_scope(caller, 'payment_evidence.review'),
      'review_marketplace_disputes',
        private.has_concourse_admin_scope(caller, 'marketplace_disputes.review'),
      'review_marketplace_reports',
        private.has_concourse_admin_scope(caller, 'marketplace_reports.review'),
      'review_content_reports',
        private.has_concourse_admin_scope(caller, 'content_reports.review'),
      'review_account_deletion',
        private.has_concourse_admin_scope(caller, 'account_deletion.review'),
      'review_support_requests',
        private.has_concourse_admin_scope(caller, 'support_requests.review')
    )
  );
end;
$$;

revoke all on function public.get_my_concourse_admin_context()
  from public, anon, authenticated;
grant execute on function public.get_my_concourse_admin_context()
  to authenticated;

create or replace function private.confirmed_concourse_user_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.id
  from auth.users app_user
  where lower(app_user.email) = lower(trim(p_email))
    and app_user.email_confirmed_at is not null
  limit 1;
$$;

revoke all on function private.confirmed_concourse_user_by_email(text)
  from public, anon, authenticated;

create or replace function public.get_concourse_admin_team()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  team_rows jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(caller) then
    raise exception 'Owner access required';
  end if;

  with team_users as (
    select legacy.user_id
    from public.concourse_admins legacy
    union
    select explicit_scope.user_id
    from public.concourse_admin_scopes explicit_scope
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', team_user.user_id,
        'email', app_user.email,
        'role', coalesce(
          legacy.role,
          case
            when cardinality(private.concourse_admin_scope_list(team_user.user_id)) > 0
              then 'admin'
            else null
          end
        ),
        'scopes', to_jsonb(private.concourse_admin_scope_list(team_user.user_id)),
        'is_owner', coalesce(legacy.role = 'owner', false),
        'appointed_at', coalesce(
          (
            select min(scope_row.granted_at)
            from public.concourse_admin_scopes scope_row
            where scope_row.user_id = team_user.user_id
          ),
          legacy.created_at
        )
      )
      order by
        coalesce(legacy.role = 'owner', false) desc,
        lower(app_user.email),
        team_user.user_id
    ),
    '[]'::jsonb
  )
  into team_rows
  from team_users team_user
  join auth.users app_user
    on app_user.id = team_user.user_id
  left join public.concourse_admins legacy
    on legacy.user_id = team_user.user_id;

  return jsonb_build_object('items', team_rows);
end;
$$;

revoke all on function public.get_concourse_admin_team()
  from public, anon, authenticated;
grant execute on function public.get_concourse_admin_team()
  to authenticated;

create or replace function private.validate_requested_admin_scopes(p_scopes text[])
returns text[]
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalized text[];
begin
  select coalesce(
    array_agg(distinct trim(scope_name) order by trim(scope_name)),
    '{}'::text[]
  )
  into normalized
  from unnest(coalesce(p_scopes, '{}'::text[])) scope_name
  where nullif(trim(scope_name), '') is not null;

  if cardinality(normalized) < 1 then
    raise exception 'Choose at least one administrator scope';
  end if;
  if exists (
    select 1
    from unnest(normalized) scope_name
    where not (scope_name = any(private.allowed_concourse_admin_scopes()))
  ) then
    raise exception 'Unsupported administrator scope';
  end if;

  return normalized;
end;
$$;

revoke all on function private.validate_requested_admin_scopes(text[])
  from public, anon, authenticated;

create or replace function public.appoint_concourse_admin(
  p_email text,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_user uuid;
  safe_email text := lower(trim(coalesce(p_email, '')));
  safe_scopes text[];
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(caller) then
    raise exception 'Owner access required';
  end if;
  if safe_email = '' then
    raise exception 'A confirmed account email is required';
  end if;

  target_user := private.confirmed_concourse_user_by_email(safe_email);
  if target_user is null then
    raise exception 'No confirmed ConCourse account has that exact email';
  end if;
  if private.is_concourse_owner(target_user) then
    raise exception 'Owner access cannot be changed from the Verification Center';
  end if;
  if exists (
    select 1
    from public.concourse_admins legacy
    where legacy.user_id = target_user
  ) or exists (
    select 1
    from public.concourse_admin_scopes explicit_scope
    where explicit_scope.user_id = target_user
  ) then
    raise exception 'This account is already on the administrator team';
  end if;

  safe_scopes := private.validate_requested_admin_scopes(p_scopes);

  insert into public.concourse_admin_scopes (user_id, scope, granted_by)
  select target_user, scope_name, caller
  from unnest(safe_scopes) scope_name
  on conflict (user_id, scope) do nothing;

  perform private.append_verification_audit_event(
    'admin_team',
    target_user,
    caller,
    'appointed',
    null,
    'active',
    null,
    jsonb_build_object('scopes', to_jsonb(safe_scopes))
  );

  return jsonb_build_object(
    'user_id', target_user,
    'email', safe_email,
    'role', 'admin',
    'scopes', to_jsonb(private.concourse_admin_scope_list(target_user))
  );
end;
$$;

revoke all on function public.appoint_concourse_admin(text, text[])
  from public, anon, authenticated;
grant execute on function public.appoint_concourse_admin(text, text[])
  to authenticated;

create or replace function public.update_concourse_admin(
  p_email text,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_user uuid;
  safe_email text := lower(trim(coalesce(p_email, '')));
  safe_scopes text[];
  old_scopes text[];
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(caller) then
    raise exception 'Owner access required';
  end if;

  target_user := private.confirmed_concourse_user_by_email(safe_email);
  if target_user is null then
    raise exception 'No confirmed ConCourse account has that exact email';
  end if;
  if private.is_concourse_owner(target_user) then
    raise exception 'Owner access cannot be changed from the Verification Center';
  end if;
  if not exists (
    select 1
    from public.concourse_admins legacy
    where legacy.user_id = target_user
  ) and not exists (
    select 1
    from public.concourse_admin_scopes explicit_scope
    where explicit_scope.user_id = target_user
  ) then
    raise exception 'This account is not on the administrator team';
  end if;

  safe_scopes := private.validate_requested_admin_scopes(p_scopes);
  old_scopes := private.concourse_admin_scope_list(target_user);

  delete from public.concourse_admin_scopes explicit_scope
  where explicit_scope.user_id = target_user;

  insert into public.concourse_admin_scopes (user_id, scope, granted_by)
  select target_user, scope_name, caller
  from unnest(safe_scopes) scope_name
  on conflict (user_id, scope) do update set
    granted_by = excluded.granted_by,
    granted_at = now();

  perform private.append_verification_audit_event(
    'admin_team',
    target_user,
    caller,
    'scopes_updated',
    'active',
    'active',
    null,
    jsonb_build_object(
      'old_scopes', to_jsonb(old_scopes),
      'new_scopes', to_jsonb(private.concourse_admin_scope_list(target_user))
    )
  );

  return jsonb_build_object(
    'user_id', target_user,
    'email', safe_email,
    'role', coalesce(
      (select legacy.role from public.concourse_admins legacy where legacy.user_id = target_user),
      'admin'
    ),
    'scopes', to_jsonb(private.concourse_admin_scope_list(target_user))
  );
end;
$$;

revoke all on function public.update_concourse_admin(text, text[])
  from public, anon, authenticated;
grant execute on function public.update_concourse_admin(text, text[])
  to authenticated;

create or replace function public.revoke_concourse_admin(
  p_email text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target_user uuid;
  safe_email text := lower(trim(coalesce(p_email, '')));
  safe_reason text := nullif(trim(coalesce(p_reason, '')), '');
  old_scopes text[];
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(caller) then
    raise exception 'Owner access required';
  end if;
  if safe_reason is not null and char_length(safe_reason) > 2000 then
    raise exception 'Revocation reason is too long';
  end if;

  target_user := private.confirmed_concourse_user_by_email(safe_email);
  if target_user is null then
    raise exception 'No confirmed ConCourse account has that exact email';
  end if;
  if private.is_concourse_owner(target_user) then
    raise exception 'Owners cannot be removed from the Verification Center';
  end if;

  old_scopes := private.concourse_admin_scope_list(target_user);
  if cardinality(old_scopes) = 0
     and not exists (
       select 1 from public.concourse_admins legacy
       where legacy.user_id = target_user
     ) then
    raise exception 'This account is not on the administrator team';
  end if;

  delete from public.concourse_admin_scopes explicit_scope
  where explicit_scope.user_id = target_user;
  delete from public.concourse_admins legacy
  where legacy.user_id = target_user
    and legacy.role <> 'owner';

  perform private.append_verification_audit_event(
    'admin_team',
    target_user,
    caller,
    'revoked',
    'active',
    'revoked',
    safe_reason,
    jsonb_build_object('old_scopes', to_jsonb(old_scopes))
  );

  return jsonb_build_object(
    'user_id', target_user,
    'email', safe_email,
    'revoked', true
  );
end;
$$;

revoke all on function public.revoke_concourse_admin(text, text)
  from public, anon, authenticated;
grant execute on function public.revoke_concourse_admin(text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- User submission/read APIs
-- ---------------------------------------------------------------------------

create or replace function public.submit_marketplace_payment_review_request(
  p_order_id uuid,
  p_reason text,
  p_evidence_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_reason text := nullif(trim(coalesce(p_reason, '')), '');
  safe_reference text := nullif(trim(coalesce(p_evidence_reference, '')), '');
  request_id uuid;
  existing_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_order_id is null then
    raise exception 'Order identifier is required';
  end if;
  if safe_reason is null or char_length(safe_reason) not between 3 and 2000 then
    raise exception 'Payment review reason must contain 3 to 2000 characters';
  end if;
  if safe_reference is not null
     and char_length(safe_reference) not between 2 and 500 then
    raise exception 'Payment evidence reference must contain 2 to 500 characters';
  end if;
  if not exists (
    select 1
    from public.marketplace_orders orders
    where orders.id = p_order_id
      and (orders.buyer_id = caller or orders.seller_id = caller)
  ) then
    raise exception 'Order is unavailable';
  end if;

  select payment_request.id
  into existing_id
  from public.marketplace_payment_review_requests payment_request
  where payment_request.order_id = p_order_id
    and payment_request.requested_by = caller
    and payment_request.status in ('submitted', 'under_review')
  order by payment_request.submitted_at desc, payment_request.id desc
  limit 1;

  if existing_id is not null then
    raise exception 'An active payment review request already exists for this order';
  end if;
  if (
    select count(*)
    from public.marketplace_payment_review_requests recent_request
    where recent_request.requested_by = caller
      and recent_request.submitted_at > now() - interval '30 days'
  ) >= 20 then
    raise exception 'Monthly payment review request limit reached';
  end if;

  insert into public.marketplace_payment_review_requests (
    order_id,
    requested_by,
    evidence_kind,
    evidence_reference,
    user_note,
    status
  ) values (
    p_order_id,
    caller,
    'payment_issue',
    safe_reference,
    safe_reason,
    'submitted'
  )
  returning id into request_id;

  perform private.append_verification_audit_event(
    'payment_evidence',
    request_id,
    caller,
    'submitted',
    null,
    'submitted',
    null,
    jsonb_build_object('order_id', p_order_id)
  );

  return request_id;
end;
$$;

revoke all on function public.submit_marketplace_payment_review_request(
  uuid, text, text
) from public, anon, authenticated;
grant execute on function public.submit_marketplace_payment_review_request(
  uuid, text, text
) to authenticated;

create or replace function public.get_my_marketplace_payment_review_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  request_rows jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'request_id', payment_request.id,
        'order_id', payment_request.order_id,
        'reason', payment_request.user_note,
        'evidence_kind', payment_request.evidence_kind,
        'evidence_reference', payment_request.evidence_reference,
        'status', payment_request.status,
        'submitted_at', payment_request.submitted_at,
        'reviewed_at', payment_request.reviewed_at,
        'reviewer_note', payment_request.reviewer_note,
        'updated_at', payment_request.updated_at,
        'order_status', orders.status,
        'payment_state', payment.payment_state,
        'amount_minor', orders.amount_minor,
        'currency', orders.currency,
        'payment_provider_state_unchanged', true
      )
      order by payment_request.submitted_at desc, payment_request.id desc
    ),
    '[]'::jsonb
  )
  into request_rows
  from public.marketplace_payment_review_requests payment_request
  join public.marketplace_orders orders
    on orders.id = payment_request.order_id
  left join private.marketplace_payment_projections payment
    on payment.order_id = payment_request.order_id
  where payment_request.requested_by = caller
    and (orders.buyer_id = caller or orders.seller_id = caller);

  return jsonb_build_object('requests', request_rows);
end;
$$;

revoke all on function public.get_my_marketplace_payment_review_requests()
  from public, anon, authenticated;
grant execute on function public.get_my_marketplace_payment_review_requests()
  to authenticated;

create or replace function public.submit_concourse_support_request(
  p_request_type text,
  p_subject text,
  p_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_type text := lower(trim(coalesce(p_request_type, '')));
  safe_subject text := nullif(trim(coalesce(p_subject, '')), '');
  safe_details text := nullif(trim(coalesce(p_details, '')), '');
  request_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if safe_type not in (
    'account',
    'school',
    'marketplace',
    'payment',
    'community',
    'privacy',
    'safety',
    'technical',
    'other'
  ) then
    raise exception 'Choose a supported request type';
  end if;
  if safe_subject is null or char_length(safe_subject) not between 3 and 160 then
    raise exception 'Subject must contain 3 to 160 characters';
  end if;
  if safe_details is null or char_length(safe_details) not between 10 and 5000 then
    raise exception 'Request details must contain 10 to 5000 characters';
  end if;
  if (
    select count(*)
    from public.concourse_support_requests recent_request
    where recent_request.user_id = caller
      and recent_request.submitted_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'Daily support request limit reached';
  end if;

  insert into public.concourse_support_requests (
    user_id,
    request_type,
    subject,
    details,
    status
  ) values (
    caller,
    safe_type,
    safe_subject,
    safe_details,
    'submitted'
  )
  returning id into request_id;

  perform private.append_verification_audit_event(
    'support_request',
    request_id,
    caller,
    'submitted',
    null,
    'submitted',
    null,
    jsonb_build_object('request_type', safe_type)
  );

  return request_id;
end;
$$;

revoke all on function public.submit_concourse_support_request(text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_concourse_support_request(text, text, text)
  to authenticated;

create or replace function public.get_my_concourse_support_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  request_rows jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'request_id', support_request.id,
        'request_type', support_request.request_type,
        'subject', support_request.subject,
        'details', support_request.details,
        'status', support_request.status,
        'submitted_at', support_request.submitted_at,
        'reviewed_at', support_request.reviewed_at,
        'reviewer_note', support_request.reviewer_note,
        'updated_at', support_request.updated_at
      )
      order by support_request.submitted_at desc, support_request.id desc
    ),
    '[]'::jsonb
  )
  into request_rows
  from public.concourse_support_requests support_request
  where support_request.user_id = caller;

  return jsonb_build_object('requests', request_rows);
end;
$$;

revoke all on function public.get_my_concourse_support_requests()
  from public, anon, authenticated;
grant execute on function public.get_my_concourse_support_requests()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Capability-filtered dashboard counts and queues
-- ---------------------------------------------------------------------------

create or replace function private.verification_workflow_scope(p_workflow text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case lower(trim(p_workflow))
    when 'school_verification' then 'school_verification.review'
    when 'payment_evidence' then 'payment_evidence.review'
    when 'marketplace_dispute' then 'marketplace_disputes.review'
    when 'marketplace_report' then 'marketplace_reports.review'
    when 'content_report' then 'content_reports.review'
    when 'account_deletion' then 'account_deletion.review'
    when 'support_request' then 'support_requests.review'
    else null
  end;
$$;

revoke all on function private.verification_workflow_scope(text)
  from public, anon, authenticated;

create or replace function public.get_verification_center_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  workflow_counts jsonb := '{}'::jsonb;
  pending_total bigint := 0;
  current_count bigint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if cardinality(private.concourse_admin_scope_list(caller)) = 0 then
    raise exception 'Administrator access required';
  end if;

  if private.has_concourse_admin_scope(caller, 'school_verification.review') then
    select count(*) filter (
      where verification_request.status in ('submitted', 'under_review')
    )
    into current_count
    from public.school_verification_requests verification_request;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'school_verification',
      jsonb_build_object(
        'pending', current_count,
        'submitted', (
          select count(*) from public.school_verification_requests
          where status = 'submitted'
        ),
        'under_review', (
          select count(*) from public.school_verification_requests
          where status = 'under_review'
        )
      )
    );
  end if;

  if private.has_concourse_admin_scope(caller, 'payment_evidence.review') then
    select count(*) filter (
      where payment_request.status in ('submitted', 'under_review')
    )
    into current_count
    from public.marketplace_payment_review_requests payment_request;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'payment_evidence',
      jsonb_build_object(
        'pending', current_count,
        'submitted', (
          select count(*) from public.marketplace_payment_review_requests
          where status = 'submitted'
        ),
        'under_review', (
          select count(*) from public.marketplace_payment_review_requests
          where status = 'under_review'
        )
      )
    );
  end if;

  if private.has_concourse_admin_scope(caller, 'marketplace_disputes.review') then
    select count(*) filter (
      where dispute.status in ('open', 'under_review')
    )
    into current_count
    from public.marketplace_disputes dispute;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'marketplace_dispute',
      jsonb_build_object(
        'pending', current_count,
        'open', (
          select count(*) from public.marketplace_disputes where status = 'open'
        ),
        'under_review', (
          select count(*) from public.marketplace_disputes
          where status = 'under_review'
        )
      )
    );
  end if;

  if private.has_concourse_admin_scope(caller, 'marketplace_reports.review') then
    select count(*) filter (
      where report.status in ('open', 'reviewing')
    )
    into current_count
    from public.marketplace_reports report;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'marketplace_report',
      jsonb_build_object(
        'pending', current_count,
        'open', (
          select count(*) from public.marketplace_reports where status = 'open'
        ),
        'reviewing', (
          select count(*) from public.marketplace_reports
          where status = 'reviewing'
        )
      )
    );
  end if;

  if private.has_concourse_admin_scope(caller, 'content_reports.review') then
    select count(*) filter (
      where report.status in ('open', 'reviewing')
    )
    into current_count
    from public.content_reports report;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'content_report',
      jsonb_build_object(
        'pending', current_count,
        'open', (
          select count(*) from public.content_reports where status = 'open'
        ),
        'reviewing', (
          select count(*) from public.content_reports where status = 'reviewing'
        )
      )
    );
  end if;

  if private.has_concourse_admin_scope(caller, 'account_deletion.review') then
    select count(*) filter (
      where deletion_request.status in ('submitted', 'processing')
    )
    into current_count
    from public.account_deletion_requests deletion_request;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'account_deletion',
      jsonb_build_object(
        'pending', current_count,
        'submitted', (
          select count(*) from public.account_deletion_requests
          where status = 'submitted'
        ),
        'processing', (
          select count(*) from public.account_deletion_requests
          where status = 'processing'
        ),
        'due', (
          select count(*) from public.account_deletion_requests
          where status in ('submitted', 'processing')
            and scheduled_for <= now()
        )
      )
    );
  end if;

  if private.has_concourse_admin_scope(caller, 'support_requests.review') then
    select count(*) filter (
      where support_request.status in ('submitted', 'under_review')
    )
    into current_count
    from public.concourse_support_requests support_request;
    pending_total := pending_total + current_count;
    workflow_counts := workflow_counts || jsonb_build_object(
      'support_request',
      jsonb_build_object(
        'pending', current_count,
        'submitted', (
          select count(*) from public.concourse_support_requests
          where status = 'submitted'
        ),
        'under_review', (
          select count(*) from public.concourse_support_requests
          where status = 'under_review'
        )
      )
    );
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'pending_total', pending_total,
    'workflows', workflow_counts
  );
end;
$$;

revoke all on function public.get_verification_center_counts()
  from public, anon, authenticated;
grant execute on function public.get_verification_center_counts()
  to authenticated;

create or replace function public.get_verification_center_queue(
  p_workflow text,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_workflow text := lower(trim(coalesce(p_workflow, '')));
  required_scope text;
  safe_status text;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  item_rows jsonb := '[]'::jsonb;
  total_count bigint := 0;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  required_scope := private.verification_workflow_scope(safe_workflow);
  if required_scope is null then
    raise exception 'Unsupported verification workflow';
  end if;
  if not private.has_concourse_admin_scope(caller, required_scope) then
    raise exception 'Administrator scope required';
  end if;

  safe_status := lower(trim(coalesce(
    nullif(p_status, ''),
    case safe_workflow
      when 'school_verification' then 'submitted'
      when 'payment_evidence' then 'submitted'
      when 'marketplace_dispute' then 'open'
      when 'marketplace_report' then 'open'
      when 'content_report' then 'open'
      when 'account_deletion' then 'submitted'
      when 'support_request' then 'submitted'
    end
  )));

  if safe_workflow = 'school_verification' then
    if safe_status not in (
      'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'
    ) then
      raise exception 'Invalid school verification status';
    end if;

    select count(*)
    into total_count
    from public.school_verification_requests verification_request
    where verification_request.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'school_verification',
          'case_id', page.id,
          'request_id', page.id,
          'status', page.status,
          'created_at', page.submitted_at,
          'updated_at', page.updated_at,
          'user_id', page.user_id,
          'account_email', page.account_email,
          'school_name', page.school_name,
          'school_key', page.school_key,
          'evidence_kind', page.evidence_kind,
          'evidence_reference', page.evidence_reference,
          'user_note', page.user_note,
          'reviewed_at', page.reviewed_at,
          'reviewer_note', page.reviewer_note
        )
        order by page.submitted_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select verification_request.*, app_user.email as account_email
      from public.school_verification_requests verification_request
      join auth.users app_user on app_user.id = verification_request.user_id
      where verification_request.status = safe_status
      order by verification_request.submitted_at, verification_request.id
      limit safe_limit offset safe_offset
    ) page;

  elsif safe_workflow = 'payment_evidence' then
    if safe_status not in (
      'submitted', 'under_review', 'evidence_accepted', 'rejected', 'withdrawn'
    ) then
      raise exception 'Invalid payment evidence status';
    end if;

    select count(*)
    into total_count
    from public.marketplace_payment_review_requests payment_request
    where payment_request.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'payment_evidence',
          'case_id', page.id,
          'request_id', page.id,
          'status', page.status,
          'created_at', page.submitted_at,
          'updated_at', page.updated_at,
          'requested_by', page.requested_by,
          'requester_email', page.requester_email,
          'order_id', page.order_id,
          'order_status', page.order_status,
          'payment_state', page.payment_state,
          'payment_provider_state_unchanged', true,
          'amount_minor', page.amount_minor,
          'currency', page.currency,
          'listing_title', page.listing_title,
          'evidence_kind', page.evidence_kind,
          'evidence_reference', page.evidence_reference,
          'reason', page.user_note,
          'reviewed_at', page.reviewed_at,
          'reviewer_note', page.reviewer_note
        )
        order by page.submitted_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select
        payment_request.*,
        app_user.email as requester_email,
        orders.status as order_status,
        orders.amount_minor,
        orders.currency,
        orders.listing_snapshot ->> 'title' as listing_title,
        payment.payment_state
      from public.marketplace_payment_review_requests payment_request
      join public.marketplace_orders orders
        on orders.id = payment_request.order_id
      left join auth.users app_user
        on app_user.id = payment_request.requested_by
      left join private.marketplace_payment_projections payment
        on payment.order_id = payment_request.order_id
      where payment_request.status = safe_status
      order by payment_request.submitted_at, payment_request.id
      limit safe_limit offset safe_offset
    ) page;

  elsif safe_workflow = 'marketplace_dispute' then
    if safe_status not in (
      'open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed'
    ) then
      raise exception 'Invalid marketplace dispute status';
    end if;

    select count(*)
    into total_count
    from public.marketplace_disputes dispute
    where dispute.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'marketplace_dispute',
          'case_id', page.id,
          'dispute_id', page.id,
          'status', page.status,
          'created_at', page.created_at,
          'updated_at', page.updated_at,
          'order_id', page.order_id,
          'opened_by', page.opened_by,
          'buyer_id', page.buyer_id,
          'seller_id', page.seller_id,
          'listing_title', page.listing_title,
          'amount_minor', page.amount_minor,
          'currency', page.currency,
          'order_status', page.order_status,
          'payment_state', page.payment_state,
          'reason', page.reason,
          'details', page.details,
          'recommended_resolution', page.recommended_resolution,
          'resolution_note', page.resolution_note,
          'reviewed_at', page.reviewed_at,
          'resolved_at', page.resolved_at
        )
        order by page.created_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select
        dispute.*,
        orders.buyer_id,
        orders.seller_id,
        orders.amount_minor,
        orders.currency,
        orders.status as order_status,
        orders.listing_snapshot ->> 'title' as listing_title,
        payment.payment_state
      from public.marketplace_disputes dispute
      join public.marketplace_orders orders on orders.id = dispute.order_id
      left join private.marketplace_payment_projections payment
        on payment.order_id = dispute.order_id
      where dispute.status = safe_status
      order by dispute.created_at, dispute.id
      limit safe_limit offset safe_offset
    ) page;

  elsif safe_workflow = 'marketplace_report' then
    if safe_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
      raise exception 'Invalid marketplace report status';
    end if;

    select count(*)
    into total_count
    from public.marketplace_reports report
    where report.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'marketplace_report',
          'case_id', page.id,
          'report_id', page.id,
          'status', page.status,
          'created_at', page.created_at,
          'updated_at', page.updated_at,
          'reporter_id', page.reporter_id,
          'listing_id', page.listing_id,
          'seller_id', page.seller_id,
          'listing_title', page.listing_title,
          'listing_status', page.listing_status,
          'reason', page.reason,
          'reviewed_at', page.reviewed_at,
          'reviewer_note', page.reviewer_note
        )
        order by page.created_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select
        report.*,
        listing.seller_id,
        listing.title as listing_title,
        listing.status as listing_status
      from public.marketplace_reports report
      join public.marketplace_listings listing on listing.id = report.listing_id
      where report.status = safe_status
      order by report.created_at, report.id
      limit safe_limit offset safe_offset
    ) page;

  elsif safe_workflow = 'content_report' then
    if safe_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
      raise exception 'Invalid content report status';
    end if;

    select count(*)
    into total_count
    from public.content_reports report
    where report.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'content_report',
          'case_id', page.id,
          'report_id', page.id,
          'status', page.status,
          'created_at', page.created_at,
          'updated_at', page.updated_at,
          'reporter_id', page.reporter_id,
          'target_type', page.target_type,
          'target_id', page.target_id,
          'target_preview', page.target_preview,
          'reason', page.reason,
          'reviewed_at', page.reviewed_at,
          'reviewer_note', page.reviewer_note
        )
        order by page.created_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select
        report.*,
        case report.target_type
          when 'post' then (
            select left(post.body, 500)
            from public.community_posts post
            where post.id = report.target_id
          )
          when 'comment' then (
            select left(comment.body, 500)
            from public.community_comments comment
            where comment.id = report.target_id
          )
          when 'message' then (
            select left(message.body, 500)
            from public.direct_messages message
            where message.id = report.target_id
          )
          when 'user' then (
            select profile.username
            from public.profiles profile
            where profile.user_id = report.target_id
          )
        end as target_preview
      from public.content_reports report
      where report.status = safe_status
      order by report.created_at, report.id
      limit safe_limit offset safe_offset
    ) page;

  elsif safe_workflow = 'account_deletion' then
    if safe_status not in ('submitted', 'processing', 'completed', 'cancelled') then
      raise exception 'Invalid account deletion status';
    end if;

    select count(*)
    into total_count
    from public.account_deletion_requests deletion_request
    where deletion_request.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'account_deletion',
          'case_id', page.id,
          'request_id', page.id,
          'status', page.status,
          'created_at', page.requested_at,
          'updated_at', page.updated_at,
          'user_id', page.user_id,
          'account_email', page.account_email,
          'reason', page.reason,
          'scheduled_for', page.scheduled_for,
          'reviewed_at', page.reviewed_at,
          'reviewer_note', page.reviewer_note,
          'completed_at', page.completed_at,
          'cancelled_at', page.cancelled_at
        )
        order by page.requested_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select deletion_request.*, app_user.email as account_email
      from public.account_deletion_requests deletion_request
      left join auth.users app_user on app_user.id = deletion_request.user_id
      where deletion_request.status = safe_status
      order by deletion_request.requested_at, deletion_request.id
      limit safe_limit offset safe_offset
    ) page;

  elsif safe_workflow = 'support_request' then
    if safe_status not in (
      'submitted', 'under_review', 'resolved', 'rejected', 'withdrawn'
    ) then
      raise exception 'Invalid support request status';
    end if;

    select count(*)
    into total_count
    from public.concourse_support_requests support_request
    where support_request.status = safe_status;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workflow', 'support_request',
          'case_id', page.id,
          'request_id', page.id,
          'status', page.status,
          'created_at', page.submitted_at,
          'updated_at', page.updated_at,
          'user_id', page.user_id,
          'account_email', page.account_email,
          'request_type', page.request_type,
          'subject', page.subject,
          'details', page.details,
          'reviewed_at', page.reviewed_at,
          'reviewer_note', page.reviewer_note
        )
        order by page.submitted_at, page.id
      ),
      '[]'::jsonb
    )
    into item_rows
    from (
      select support_request.*, app_user.email as account_email
      from public.concourse_support_requests support_request
      left join auth.users app_user on app_user.id = support_request.user_id
      where support_request.status = safe_status
      order by support_request.submitted_at, support_request.id
      limit safe_limit offset safe_offset
    ) page;
  end if;

  return jsonb_build_object(
    'workflow', safe_workflow,
    'status', safe_status,
    'items', item_rows,
    'total', total_count,
    'limit', safe_limit,
    'offset', safe_offset,
    'has_more', safe_offset + safe_limit < total_count
  );
end;
$$;

revoke all on function public.get_verification_center_queue(
  text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.get_verification_center_queue(
  text, text, integer, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic workflow review actions
-- ---------------------------------------------------------------------------

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
  required_scope text;
  from_status text;
  to_status text;
  audit_metadata jsonb := '{}'::jsonb;
  target_action text;
  safe_verification_method text;
  payment_state text;
  target_author uuid;
  school_row public.school_verification_requests%rowtype;
  membership_row public.school_memberships%rowtype;
  payment_review_row public.marketplace_payment_review_requests%rowtype;
  dispute_row public.marketplace_disputes%rowtype;
  order_row public.marketplace_orders%rowtype;
  market_report_row public.marketplace_reports%rowtype;
  listing_row public.marketplace_listings%rowtype;
  content_report_row public.content_reports%rowtype;
  deletion_row public.account_deletion_requests%rowtype;
  support_row public.concourse_support_requests%rowtype;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_case_id is null then
    raise exception 'Case identifier is required';
  end if;
  if safe_note is not null and char_length(safe_note) > 2000 then
    raise exception 'Reviewer note is too long';
  end if;
  if jsonb_typeof(safe_options) <> 'object'
     or pg_column_size(safe_options) > 8192 then
    raise exception 'Invalid review options';
  end if;

  required_scope := private.verification_workflow_scope(safe_workflow);
  if required_scope is null then
    raise exception 'Unsupported verification workflow';
  end if;
  if not private.has_concourse_admin_scope(caller, required_scope) then
    raise exception 'Administrator scope required';
  end if;

  if safe_workflow = 'school_verification' then
    select verification_request.*
    into school_row
    from public.school_verification_requests verification_request
    where verification_request.id = p_case_id
    for update;

    if not found or school_row.status not in ('submitted', 'under_review') then
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
      if safe_action = 'approve'
         and school_row.evidence_kind = 'academic_email' then
        raise exception
          'Academic email verification completes only through the code flow';
      end if;

      -- Reviewer-supplied options are never authorization evidence. SSO and
      -- document/manual cases may be reviewed, but only a successful separate
      -- academic-email code challenge may grant verified student status.
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

      if safe_action = 'approve' then
        update public.school_memberships membership
        set
          status = 'pending',
          verification_method = null,
          verified_at = null,
          updated_at = now()
        where membership.user_id = school_row.user_id
          and membership.school_key = school_row.school_key
          and membership.status not in ('verified', 'revoked');
      else
        update public.school_memberships membership
        set
          status = 'rejected',
          verification_method = null,
          verified_at = null,
          updated_at = now()
        where membership.user_id = school_row.user_id
          and membership.school_key = school_row.school_key
          and membership.status not in ('verified', 'revoked');
      end if;

      audit_metadata := jsonb_build_object(
        'verification_method',
        case
          when safe_action = 'approve' then safe_verification_method
          else null
        end,
        'student_status_granted',
        false
      );
    else
      raise exception 'Unsupported school verification action';
    end if;

  elsif safe_workflow = 'payment_evidence' then
    select payment_request.*
    into payment_review_row
    from public.marketplace_payment_review_requests payment_request
    where payment_request.id = p_case_id
    for update;

    if not found
       or payment_review_row.status not in ('submitted', 'under_review') then
      raise exception 'Payment evidence request is unavailable';
    end if;

    select orders.*
    into order_row
    from public.marketplace_orders orders
    where orders.id = payment_review_row.order_id
    for update;

    if payment_review_row.requested_by = caller
       or order_row.buyer_id = caller
       or order_row.seller_id = caller then
      raise exception 'Administrators cannot review their own transaction';
    end if;
    if payment_review_row.status = 'under_review'
       and payment_review_row.reviewed_by is not null
       and payment_review_row.reviewed_by <> caller
       and not private.is_concourse_owner(caller) then
      raise exception 'Another administrator is reviewing this request';
    end if;

    from_status := payment_review_row.status;
    if safe_action = 'start_review' then
      to_status := 'under_review';
      update public.marketplace_payment_review_requests payment_request
      set
        status = to_status,
        reviewed_by = caller,
        updated_at = now()
      where payment_request.id = p_case_id;
    elsif safe_action in ('accept_evidence', 'reject') then
      if safe_action = 'reject' and safe_note is null then
        raise exception 'A rejection note is required';
      end if;
      to_status := case
        when safe_action = 'accept_evidence' then 'evidence_accepted'
        else 'rejected'
      end;
      update public.marketplace_payment_review_requests payment_request
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        reviewer_note = safe_note,
        updated_at = now()
      where payment_request.id = p_case_id;
    else
      raise exception 'Unsupported payment evidence action';
    end if;

    select payment.payment_state
    into payment_state
    from private.marketplace_payment_projections payment
    where payment.order_id = payment_review_row.order_id;

    audit_metadata := jsonb_build_object(
      'order_id', payment_review_row.order_id,
      'payment_state_observed', payment_state,
      'payment_provider_state_changed', false
    );

  elsif safe_workflow = 'marketplace_dispute' then
    select dispute.*
    into dispute_row
    from public.marketplace_disputes dispute
    where dispute.id = p_case_id
    for update;

    if not found or dispute_row.status not in ('open', 'under_review') then
      raise exception 'Marketplace dispute is unavailable';
    end if;

    select orders.*
    into order_row
    from public.marketplace_orders orders
    where orders.id = dispute_row.order_id
    for update;

    if dispute_row.opened_by = caller
       or order_row.buyer_id = caller
       or order_row.seller_id = caller then
      raise exception 'Administrators cannot review their own transaction';
    end if;
    if dispute_row.status = 'under_review'
       and dispute_row.reviewed_by is not null
       and dispute_row.reviewed_by <> caller
       and not private.is_concourse_owner(caller) then
      raise exception 'Another administrator is reviewing this dispute';
    end if;

    from_status := dispute_row.status;
    select payment.payment_state
    into payment_state
    from private.marketplace_payment_projections payment
    where payment.order_id = dispute_row.order_id;

    if safe_action = 'start_review' then
      to_status := 'under_review';
      update public.marketplace_disputes dispute
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        updated_at = now()
      where dispute.id = p_case_id;
    elsif safe_action in ('recommend_refund', 'recommend_release') then
      if safe_note is null then
        raise exception 'A dispute recommendation note is required';
      end if;
      to_status := 'under_review';
      update public.marketplace_disputes dispute
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        recommended_resolution = case
          when safe_action = 'recommend_refund' then 'refund_buyer'
          else 'release_seller'
        end,
        resolution_note = safe_note,
        updated_at = now()
      where dispute.id = p_case_id;
    elsif safe_action = 'close' then
      if safe_note is null then
        raise exception 'A closure note is required';
      end if;
      if payment_state in ('held', 'release_pending', 'refund_pending') then
        raise exception
          'A held payment cannot be closed until the provider reports release or refund';
      end if;
      to_status := 'closed';
      update public.marketplace_disputes dispute
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        recommended_resolution = 'close',
        resolution_note = safe_note,
        resolved_at = now(),
        updated_at = now()
      where dispute.id = p_case_id;
    else
      raise exception 'Unsupported marketplace dispute action';
    end if;

    audit_metadata := jsonb_build_object(
      'order_id', dispute_row.order_id,
      'payment_state_observed', payment_state,
      'payment_provider_state_changed', false
    );

  elsif safe_workflow = 'marketplace_report' then
    select report.*
    into market_report_row
    from public.marketplace_reports report
    where report.id = p_case_id
    for update;

    if not found or market_report_row.status not in ('open', 'reviewing') then
      raise exception 'Marketplace report is unavailable';
    end if;

    select listing.*
    into listing_row
    from public.marketplace_listings listing
    where listing.id = market_report_row.listing_id
    for update;

    if market_report_row.reporter_id = caller
       or listing_row.seller_id = caller then
      raise exception 'Administrators cannot review their own marketplace case';
    end if;
    if market_report_row.status = 'reviewing'
       and market_report_row.reviewed_by is not null
       and market_report_row.reviewed_by <> caller
       and not private.is_concourse_owner(caller) then
      raise exception 'Another administrator is reviewing this report';
    end if;

    from_status := market_report_row.status;
    target_action := lower(trim(coalesce(
      safe_options ->> 'target_action',
      'none'
    )));

    if safe_action = 'start_review' then
      to_status := 'reviewing';
      target_action := 'none';
      update public.marketplace_reports report
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        updated_at = now()
      where report.id = p_case_id;
    elsif safe_action in ('resolve', 'dismiss') then
      if safe_note is null then
        raise exception 'A marketplace report decision note is required';
      end if;
      if safe_action = 'dismiss' and target_action <> 'none' then
        raise exception 'A dismissed report cannot modify the listing';
      end if;
      if target_action not in ('none', 'pause_listing', 'remove_listing') then
        raise exception 'Unsupported marketplace moderation action';
      end if;

      if target_action = 'pause_listing' then
        if listing_row.status not in ('draft', 'active', 'paused') then
          raise exception 'This listing cannot be paused while an order controls it';
        end if;
        update public.marketplace_listings listing
        set
          status = 'paused',
          version = version + 1,
          updated_at = now()
        where listing.id = listing_row.id;
      elsif target_action = 'remove_listing' then
        if exists (
          select 1
          from public.marketplace_orders orders
          where orders.listing_id = listing_row.id
            and orders.status in (
              'awaiting_payment', 'payment_held', 'fulfilled', 'disputed'
            )
        ) then
          raise exception 'A listing with an open order cannot be removed';
        end if;
        update public.marketplace_listings listing
        set
          status = 'deleted',
          deleted_at = coalesce(deleted_at, now()),
          version = version + 1,
          updated_at = now()
        where listing.id = listing_row.id;
      end if;

      to_status := case when safe_action = 'resolve' then 'resolved' else 'dismissed' end;
      update public.marketplace_reports report
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        reviewer_note = safe_note,
        updated_at = now()
      where report.id = p_case_id;
    else
      raise exception 'Unsupported marketplace report action';
    end if;

    audit_metadata := jsonb_build_object(
      'listing_id', market_report_row.listing_id,
      'target_action', target_action
    );

  elsif safe_workflow = 'content_report' then
    select report.*
    into content_report_row
    from public.content_reports report
    where report.id = p_case_id
    for update;

    if not found or content_report_row.status not in ('open', 'reviewing') then
      raise exception 'Content report is unavailable';
    end if;

    target_author := case content_report_row.target_type
      when 'post' then (
        select post.author_id
        from public.community_posts post
        where post.id = content_report_row.target_id
      )
      when 'comment' then (
        select comment.author_id
        from public.community_comments comment
        where comment.id = content_report_row.target_id
      )
      when 'message' then (
        select message.sender_id
        from public.direct_messages message
        where message.id = content_report_row.target_id
      )
      when 'user' then content_report_row.target_id
    end;

    if content_report_row.reporter_id = caller or target_author = caller then
      raise exception 'Administrators cannot review their own content case';
    end if;
    if content_report_row.status = 'reviewing'
       and content_report_row.reviewed_by is not null
       and content_report_row.reviewed_by <> caller
       and not private.is_concourse_owner(caller) then
      raise exception 'Another administrator is reviewing this report';
    end if;

    from_status := content_report_row.status;
    target_action := lower(trim(coalesce(
      safe_options ->> 'target_action',
      'none'
    )));

    if safe_action = 'start_review' then
      to_status := 'reviewing';
      target_action := 'none';
      update public.content_reports report
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        updated_at = now()
      where report.id = p_case_id;
    elsif safe_action in ('resolve', 'dismiss') then
      if safe_note is null then
        raise exception 'A content report decision note is required';
      end if;
      if safe_action = 'dismiss' and target_action <> 'none' then
        raise exception 'A dismissed report cannot modify content';
      end if;
      if target_action not in ('none', 'hide_content', 'remove_content') then
        raise exception 'Unsupported content moderation action';
      end if;

      if target_action <> 'none' then
        if content_report_row.target_type = 'post' then
          update public.community_posts post
          set
            status = case
              when target_action = 'hide_content' then 'hidden'
              else 'removed'
            end,
            deleted_at = case
              when target_action = 'remove_content' then coalesce(deleted_at, now())
              else deleted_at
            end,
            updated_at = now()
          where post.id = content_report_row.target_id;
        elsif content_report_row.target_type = 'comment' then
          update public.community_comments comment
          set
            status = case
              when target_action = 'hide_content' then 'hidden'
              else 'removed'
            end,
            deleted_at = case
              when target_action = 'remove_content' then coalesce(deleted_at, now())
              else deleted_at
            end
          where comment.id = content_report_row.target_id;
        elsif content_report_row.target_type = 'message' then
          if target_action <> 'remove_content' then
            raise exception 'Messages may only be removed, not hidden';
          end if;
          update public.direct_messages message
          set deleted_at = coalesce(deleted_at, now())
          where message.id = content_report_row.target_id;
        else
          raise exception 'User reports cannot directly modify an account';
        end if;

        if not found then
          raise exception 'Reported content is no longer available';
        end if;
      end if;

      to_status := case when safe_action = 'resolve' then 'resolved' else 'dismissed' end;
      update public.content_reports report
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        reviewer_note = safe_note,
        updated_at = now()
      where report.id = p_case_id;
    else
      raise exception 'Unsupported content report action';
    end if;

    audit_metadata := jsonb_build_object(
      'target_type', content_report_row.target_type,
      'target_id', content_report_row.target_id,
      'target_action', target_action
    );

  elsif safe_workflow = 'account_deletion' then
    select deletion_request.*
    into deletion_row
    from public.account_deletion_requests deletion_request
    where deletion_request.id = p_case_id
    for update;

    if not found or deletion_row.status not in ('submitted', 'processing') then
      raise exception 'Account deletion request is unavailable';
    end if;
    if deletion_row.user_id = caller then
      raise exception 'Administrators cannot review their own request';
    end if;
    if deletion_row.status = 'processing'
       and deletion_row.reviewed_by is not null
       and deletion_row.reviewed_by <> caller
       and not private.is_concourse_owner(caller) then
      raise exception 'Another administrator is processing this request';
    end if;

    from_status := deletion_row.status;
    if safe_action = 'start_review' then
      to_status := 'processing';
      update public.account_deletion_requests deletion_request
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        reviewer_note = safe_note,
        updated_at = now()
      where deletion_request.id = p_case_id;
    elsif safe_action = 'return_to_queue' then
      if deletion_row.status <> 'processing' then
        raise exception 'Only a processing request can return to the queue';
      end if;
      if deletion_row.reviewed_by <> caller
         and not private.is_concourse_owner(caller) then
        raise exception 'Only the assigned administrator can return this request';
      end if;
      to_status := 'submitted';
      update public.account_deletion_requests deletion_request
      set
        status = to_status,
        reviewed_by = null,
        reviewed_at = null,
        reviewer_note = safe_note,
        updated_at = now()
      where deletion_request.id = p_case_id;
    else
      raise exception
        'Deletion administrators may only start review or return a request; completion requires the trusted deletion worker';
    end if;

    audit_metadata := jsonb_build_object(
      'scheduled_for', deletion_row.scheduled_for,
      'deletion_completed', false
    );

  elsif safe_workflow = 'support_request' then
    select request.*
    into support_row
    from public.concourse_support_requests request
    where request.id = p_case_id
    for update;

    if not found or support_row.status not in ('submitted', 'under_review') then
      raise exception 'Support request is unavailable';
    end if;
    if support_row.user_id = caller then
      raise exception 'Administrators cannot review their own request';
    end if;
    if support_row.status = 'under_review'
       and support_row.reviewed_by is not null
       and support_row.reviewed_by <> caller
       and not private.is_concourse_owner(caller) then
      raise exception 'Another administrator is reviewing this request';
    end if;

    from_status := support_row.status;
    if safe_action = 'start_review' then
      to_status := 'under_review';
      update public.concourse_support_requests request
      set
        status = to_status,
        reviewed_by = caller,
        updated_at = now()
      where request.id = p_case_id;
    elsif safe_action in ('resolve', 'reject') then
      if safe_note is null then
        raise exception 'A support decision note is required';
      end if;
      to_status := case when safe_action = 'resolve' then 'resolved' else 'rejected' end;
      update public.concourse_support_requests request
      set
        status = to_status,
        reviewed_by = caller,
        reviewed_at = now(),
        reviewer_note = safe_note,
        updated_at = now()
      where request.id = p_case_id;
    else
      raise exception 'Unsupported support request action';
    end if;
  end if;

  perform private.append_verification_audit_event(
    safe_workflow,
    p_case_id,
    caller,
    safe_action,
    from_status,
    to_status,
    safe_note,
    audit_metadata
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
  text, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.review_verification_center_case(
  text, uuid, text, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Thin compatibility aliases
-- ---------------------------------------------------------------------------

-- Keep the established School Verification interface working while routing
-- authorization and decisions through the capability-based Verification Center.
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
  queue_result jsonb;
begin
  queue_result := public.get_verification_center_queue(
    'school_verification',
    p_status,
    p_limit,
    0
  );

  return coalesce(queue_result -> 'items', '[]'::jsonb);
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
begin
  perform public.review_verification_center_case(
    'school_verification',
    p_request_id,
    p_decision,
    p_reviewer_note,
    jsonb_build_object(
      'verification_method',
      lower(trim(coalesce(p_verification_method, 'manual')))
    )
  );

  return true;
end;
$$;

revoke all on function public.review_school_verification_request(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.review_school_verification_request(
  uuid, text, text, text
) to authenticated;

-- The Verification Center UI uses concise support RPC names. The ConCourse-
-- prefixed originals remain the canonical implementations.
create or replace function public.submit_support_request(
  p_request_type text,
  p_subject text,
  p_details text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.submit_concourse_support_request(
    p_request_type,
    p_subject,
    p_details
  );
$$;

revoke all on function public.submit_support_request(text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_support_request(text, text, text)
  to authenticated;

create or replace function public.get_my_support_requests()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_my_concourse_support_requests();
$$;

revoke all on function public.get_my_support_requests()
  from public, anon, authenticated;
grant execute on function public.get_my_support_requests()
  to authenticated;

create or replace function private.validate_legacy_admin_role(
  p_role text,
  p_scopes text[]
)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  safe_role text := lower(trim(coalesce(p_role, '')));
  safe_scopes text[] := private.validate_requested_admin_scopes(p_scopes);
begin
  if safe_role not in ('reviewer', 'privacy') then
    raise exception 'Administrator role must be reviewer or privacy';
  end if;

  -- Legacy roles imply one historical capability. Require that capability to
  -- be explicit so the role can never expand authority beyond the chosen list.
  if safe_role = 'reviewer'
     and not ('school_verification.review' = any(safe_scopes)) then
    raise exception
      'Reviewer role requires the school_verification.review scope';
  end if;
  if safe_role = 'privacy'
     and not ('account_deletion.review' = any(safe_scopes)) then
    raise exception
      'Privacy role requires the account_deletion.review scope';
  end if;

  return safe_role;
end;
$$;

revoke all on function private.validate_legacy_admin_role(text, text[])
  from public, anon, authenticated;

-- Exact Owner Console appointment contract. p_identifier is deliberately an
-- exact confirmed email; usernames and partial matches are never accepted.
create or replace function public.appoint_concourse_admin(
  p_identifier text,
  p_role text,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_role text;
  appointment jsonb;
  target_user uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(caller) then
    raise exception 'Owner access required';
  end if;

  safe_role := private.validate_legacy_admin_role(p_role, p_scopes);
  appointment := public.appoint_concourse_admin(p_identifier, p_scopes);
  target_user := (appointment ->> 'user_id')::uuid;

  insert into public.concourse_admins (
    user_id,
    role,
    created_by
  ) values (
    target_user,
    safe_role,
    caller
  )
  on conflict (user_id) do update set
    role = excluded.role,
    created_by = excluded.created_by;

  perform private.append_verification_audit_event(
    'admin_team',
    target_user,
    caller,
    'legacy_role_assigned',
    null,
    safe_role,
    null,
    jsonb_build_object(
      'role', safe_role,
      'authority_source', 'explicit_scopes'
    )
  );

  return appointment || jsonb_build_object('role', safe_role);
end;
$$;

revoke all on function public.appoint_concourse_admin(text, text, text[])
  from public, anon, authenticated;
grant execute on function public.appoint_concourse_admin(text, text, text[])
  to authenticated;

-- Owner Console compatibility aliases use immutable user identifiers. The
-- canonical implementations still re-resolve the exact confirmed email and
-- enforce owner-only access plus owner protection.
create or replace function public.update_concourse_admin_scopes(
  p_user_id uuid,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(auth.uid()) then
    raise exception 'Owner access required';
  end if;
  if p_user_id is null then
    raise exception 'Administrator identifier is required';
  end if;

  select app_user.email
  into target_email
  from auth.users app_user
  where app_user.id = p_user_id
    and app_user.email_confirmed_at is not null;

  if target_email is null then
    raise exception 'No confirmed ConCourse account has that identifier';
  end if;

  return public.update_concourse_admin(target_email, p_scopes);
end;
$$;

revoke all on function public.update_concourse_admin_scopes(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.update_concourse_admin_scopes(uuid, text[])
  to authenticated;

create or replace function public.update_concourse_admin_scopes(
  p_user_id uuid,
  p_role text,
  p_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_role text;
  old_role text;
  updated_admin jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(caller) then
    raise exception 'Owner access required';
  end if;
  if p_user_id is null then
    raise exception 'Administrator identifier is required';
  end if;
  if private.is_concourse_owner(p_user_id) then
    raise exception 'Owner access cannot be changed from the Verification Center';
  end if;

  safe_role := private.validate_legacy_admin_role(p_role, p_scopes);
  select legacy.role
  into old_role
  from public.concourse_admins legacy
  where legacy.user_id = p_user_id;

  updated_admin := public.update_concourse_admin_scopes(p_user_id, p_scopes);

  insert into public.concourse_admins (
    user_id,
    role,
    created_by
  ) values (
    p_user_id,
    safe_role,
    caller
  )
  on conflict (user_id) do update set
    role = excluded.role,
    created_by = excluded.created_by;

  if old_role is distinct from safe_role then
    perform private.append_verification_audit_event(
      'admin_team',
      p_user_id,
      caller,
      'legacy_role_updated',
      old_role,
      safe_role,
      null,
      jsonb_build_object(
        'role', safe_role,
        'authority_source', 'explicit_scopes'
      )
    );
  end if;

  return updated_admin || jsonb_build_object('role', safe_role);
end;
$$;

revoke all on function public.update_concourse_admin_scopes(
  uuid, text, text[]
) from public, anon, authenticated;
grant execute on function public.update_concourse_admin_scopes(
  uuid, text, text[]
) to authenticated;

create or replace function public.revoke_concourse_admin(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_concourse_owner(auth.uid()) then
    raise exception 'Owner access required';
  end if;
  if p_user_id is null then
    raise exception 'Administrator identifier is required';
  end if;

  select app_user.email
  into target_email
  from auth.users app_user
  where app_user.id = p_user_id
    and app_user.email_confirmed_at is not null;

  if target_email is null then
    raise exception 'No confirmed ConCourse account has that identifier';
  end if;

  return public.revoke_concourse_admin(target_email, null);
end;
$$;

revoke all on function public.revoke_concourse_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_concourse_admin(uuid)
  to authenticated;

-- Reassert the private-table boundary and refresh the PostgREST schema cache.
revoke all on table public.concourse_admin_scopes
  from public, anon, authenticated;
revoke all on table public.verification_audit_events
  from public, anon, authenticated;
revoke all on table public.marketplace_payment_review_requests
  from public, anon, authenticated;
revoke all on table public.concourse_support_requests
  from public, anon, authenticated;
revoke all on schema private
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
