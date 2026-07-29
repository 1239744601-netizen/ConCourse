-- ConCourse private student-verification evidence
-- Run AFTER:
--   1. supabase-account-trust-and-data-fix.sql
--   2. supabase-verification-center.sql
--
-- Safe to rerun. This migration is additive: the existing email, SSO,
-- review statuses, queues, and review RPCs remain unchanged.

begin;

do $$
begin
  if to_regclass('public.school_verification_requests') is null
     or to_regclass('public.school_memberships') is null
     or to_regprocedure('public.get_my_school_verification()') is null
     or to_regprocedure('public.submit_school_verification_request(text,text,text)') is null
     or to_regprocedure('private.has_concourse_admin_scope(uuid,text)') is null
     or to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null then
    raise exception
      'Run supabase-account-trust-and-data-fix.sql and supabase-verification-center.sql before supabase-student-verification-evidence.sql';
  end if;
end;
$$;

-- Legacy requests remain compatible. Only v2 document submissions set these
-- fields, which lets approval fail closed even if every child row disappears.
alter table public.school_verification_requests
  add column if not exists requires_document_evidence boolean not null default false;
alter table public.school_verification_requests
  add column if not exists required_evidence_count smallint;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'public.school_verification_requests'::regclass
      and constraint_record.conname = 'school_verification_requests_document_count_ck'
  ) then
    alter table public.school_verification_requests
      add constraint school_verification_requests_document_count_ck
      check (
        (
          requires_document_evidence
          and required_evidence_count between 1 and 3
        )
        or
        (
          not requires_document_evidence
          and required_evidence_count is null
        )
      );
  end if;
end;
$$;

-- Evidence metadata stays outside the exposed public API schema. Browser
-- access is available only through the narrowly scoped RPCs below.
create table if not exists private.school_verification_evidence (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid references public.school_verification_requests(id) on delete restrict,
  document_type text not null
    check (document_type in (
      'student_id',
      'enrollment_letter',
      'class_schedule',
      'portal_screenshot',
      'other'
    )),
  storage_path text not null unique,
  original_file_name text not null
    check (
      original_file_name = trim(original_file_name)
      and char_length(original_file_name) between 1 and 180
      and original_file_name !~ '[\\/]'
      and original_file_name !~ '[[:cntrl:]]'
    ),
  mime_type text not null
    check (mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )),
  size_bytes bigint not null
    check (size_bytes between 1 and 8388608),
  status text not null default 'reserved'
    check (status in ('reserved', 'submitted')),
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'validated', 'rejected')),
  validation_object_id uuid,
  validated_at timestamptz,
  content_sha256 text
    check (
      content_sha256 is null
      or content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  validation_error_code text
    check (
      validation_error_code is null
      or (
        validation_error_code = trim(validation_error_code)
        and validation_error_code ~ '^[a-z0-9_]{2,80}$'
      )
    ),
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz not null default (now() + interval '1 hour'),
  finalized_at timestamptz,
  redaction_confirmed_at timestamptz,
  retention_until timestamptz,
  check (
    storage_path =
      user_id::text || '/requests/' || id::text ||
      case mime_type
        when 'application/pdf' then '.pdf'
        when 'image/jpeg' then '.jpg'
        when 'image/png' then '.png'
        when 'image/webp' then '.webp'
      end
  ),
  check (
    (status = 'reserved' and request_id is null and finalized_at is null)
    or
    (
      status = 'submitted'
      and request_id is not null
      and finalized_at is not null
      and redaction_confirmed_at is not null
    )
  ),
  check (
    (
      validation_status = 'pending'
      and validated_at is null
      and content_sha256 is null
      and validation_error_code is null
    )
    or
    (
      validation_status = 'validated'
      and validated_at is not null
      and content_sha256 is not null
      and validation_error_code is null
    )
    or
    (
      validation_status = 'rejected'
      and validated_at is not null
      and content_sha256 is null
      and validation_error_code is not null
    )
  )
);

alter table private.school_verification_evidence
  add column if not exists validation_status text not null default 'pending';
alter table private.school_verification_evidence
  add column if not exists validation_object_id uuid;
alter table private.school_verification_evidence
  add column if not exists validated_at timestamptz;
alter table private.school_verification_evidence
  add column if not exists content_sha256 text;
alter table private.school_verification_evidence
  add column if not exists validation_error_code text;
alter table private.school_verification_evidence
  add column if not exists retention_until timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'private.school_verification_evidence'::regclass
      and constraint_record.conname = 'school_verification_evidence_validation_status_ck'
  ) then
    alter table private.school_verification_evidence
      add constraint school_verification_evidence_validation_status_ck
      check (validation_status in ('pending', 'validated', 'rejected'));
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_record
    where constraint_record.conrelid = 'private.school_verification_evidence'::regclass
      and constraint_record.conname = 'school_verification_evidence_validation_state_ck'
  ) then
    alter table private.school_verification_evidence
      add constraint school_verification_evidence_validation_state_ck
      check (
        (
          validation_status = 'pending'
          and validated_at is null
          and content_sha256 is null
          and validation_error_code is null
        )
        or
        (
          validation_status = 'validated'
          and validated_at is not null
          and content_sha256 ~ '^[0-9a-f]{64}$'
          and validation_error_code is null
        )
        or
        (
          validation_status = 'rejected'
          and validated_at is not null
          and content_sha256 is null
          and validation_error_code ~ '^[a-z0-9_]{2,80}$'
        )
      );
  end if;
end;
$$;

create index if not exists school_verification_evidence_user_idx
  on private.school_verification_evidence (user_id, reserved_at desc, id);

create index if not exists school_verification_evidence_request_idx
  on private.school_verification_evidence (request_id, id)
  where request_id is not null;

create index if not exists school_verification_evidence_expiry_idx
  on private.school_verification_evidence (reservation_expires_at, id)
  where status = 'reserved';

create index if not exists school_verification_evidence_retention_idx
  on private.school_verification_evidence (retention_until, id)
  where retention_until is not null;

-- A reviewer receives a sign-only grant for one exact file and a maximum of
-- 90 seconds. The immutable log intentionally stores no path or filename.
create table if not exists private.school_verification_evidence_access_grants (
  evidence_id uuid not null
    references private.school_verification_evidence(id) on delete cascade,
  reviewer_id uuid not null,
  expires_at timestamptz not null,
  primary key (evidence_id, reviewer_id)
);

create table if not exists private.school_verification_evidence_access_log (
  id bigint generated always as identity primary key,
  evidence_id uuid not null,
  request_id uuid not null,
  reviewer_id uuid not null,
  created_at timestamptz not null default now()
);

-- This append-only ledger makes the rolling upload quota resistant to a
-- caller reserving and immediately discarding rows to reset the counter.
create table if not exists private.school_verification_evidence_reservation_log (
  evidence_id uuid primary key,
  user_id uuid not null,
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  reserved_at timestamptz not null default now()
);

create index if not exists school_verification_evidence_access_grant_expiry_idx
  on private.school_verification_evidence_access_grants (expires_at, evidence_id);

create index if not exists school_verification_evidence_reservation_log_user_idx
  on private.school_verification_evidence_reservation_log (
    user_id,
    reserved_at desc,
    evidence_id
  );

revoke all on table private.school_verification_evidence
  from public, anon, authenticated;
revoke all on table private.school_verification_evidence_access_grants
  from public, anon, authenticated;
revoke all on table private.school_verification_evidence_access_log
  from public, anon, authenticated;
revoke all on table private.school_verification_evidence_reservation_log
  from public, anon, authenticated;

create or replace function private.reject_school_verification_access_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'School verification evidence access logs are append-only';
end;
$$;

revoke all on function private.reject_school_verification_access_log_mutation()
  from public, anon, authenticated;

drop trigger if exists school_verification_evidence_access_log_immutable
  on private.school_verification_evidence_access_log;
create trigger school_verification_evidence_access_log_immutable
  before update or delete on private.school_verification_evidence_access_log
  for each row execute procedure
    private.reject_school_verification_access_log_mutation();

-- Storage metadata is untrusted JSON. Never cast it directly in a policy or
-- review RPC: malformed or over-sized numbers must fail closed, not abort the
-- entire query.
create or replace function private.safe_school_verification_object_size(
  p_metadata jsonb
)
returns bigint
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  size_text text := trim(coalesce(p_metadata ->> 'size', ''));
  parsed_size numeric;
begin
  if size_text !~ '^[0-9]{1,20}$' then
    return null;
  end if;

  begin
    parsed_size := size_text::numeric;
  exception when others then
    return null;
  end;

  if parsed_size < 1 or parsed_size > 9223372036854775807 then
    return null;
  end if;

  return parsed_size::bigint;
exception when others then
  return null;
end;
$$;

revoke all on function private.safe_school_verification_object_size(jsonb)
  from public, anon, authenticated;

-- A rerun over an earlier validator build can safely bind already-validated
-- rows to the current exact object only when every reserved attribute matches.
update private.school_verification_evidence evidence
set validation_object_id = object.id
from storage.objects object
where evidence.validation_status = 'validated'
  and evidence.validation_object_id is null
  and object.bucket_id = 'school-verification-evidence'
  and object.name = evidence.storage_path
  and object.owner_id = evidence.user_id::text
  and lower(coalesce(object.metadata ->> 'mimetype', '')) =
    evidence.mime_type
  and private.safe_school_verification_object_size(object.metadata) =
    evidence.size_bytes;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'school-verification-evidence',
  'school-verification-evidence',
  false,
  8388608,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies call these security-definer guards. They never accept a
-- user id from the browser; every decision is bound to auth.uid().
create or replace function public.can_upload_school_verification_evidence(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from private.school_verification_evidence evidence
      where evidence.user_id = auth.uid()
        and evidence.storage_path = p_storage_path
        and evidence.status = 'reserved'
        and evidence.request_id is null
        and evidence.reservation_expires_at > now()
    );
$$;

create or replace function public.can_view_school_verification_evidence(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from private.school_verification_evidence evidence
      where evidence.user_id = auth.uid()
        and evidence.storage_path = p_storage_path
        and evidence.status in ('reserved', 'submitted')
    );
$$;

-- Reviewers never receive general read access. The only permitted Storage
-- SELECT operation is signing one exact object after a short-lived grant has
-- been created and audited by authorize_school_verification_evidence_access.
create or replace function public.can_sign_school_verification_evidence(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from private.school_verification_evidence evidence
      join public.school_verification_requests request
        on request.id = evidence.request_id
       and request.user_id = evidence.user_id
      join private.school_verification_evidence_access_grants access_grant
        on access_grant.evidence_id = evidence.id
       and access_grant.reviewer_id = auth.uid()
       and access_grant.expires_at > now()
      join storage.objects object
        on object.bucket_id = 'school-verification-evidence'
       and object.name = evidence.storage_path
      where evidence.storage_path = p_storage_path
        and evidence.user_id <> auth.uid()
        and evidence.status = 'submitted'
        and evidence.validation_status = 'validated'
        and request.status in ('submitted', 'under_review')
        and private.has_concourse_admin_scope(
          auth.uid(),
          'school_verification.review'
        )
        and object.id = evidence.validation_object_id
        and object.owner_id = evidence.user_id::text
        and lower(coalesce(object.metadata ->> 'mimetype', '')) =
          evidence.mime_type
        and private.safe_school_verification_object_size(object.metadata) =
          evidence.size_bytes
    );
$$;

create or replace function public.can_delete_school_verification_evidence(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from private.school_verification_evidence evidence
      where evidence.user_id = auth.uid()
        and evidence.storage_path = p_storage_path
        and evidence.status = 'reserved'
        and evidence.request_id is null
    );
$$;

revoke all on function public.can_upload_school_verification_evidence(text)
  from public, anon, authenticated;
revoke all on function public.can_view_school_verification_evidence(text)
  from public, anon, authenticated;
revoke all on function public.can_sign_school_verification_evidence(text)
  from public, anon, authenticated;
revoke all on function public.can_delete_school_verification_evidence(text)
  from public, anon, authenticated;
grant execute on function public.can_upload_school_verification_evidence(text)
  to authenticated;
grant execute on function public.can_view_school_verification_evidence(text)
  to authenticated;
grant execute on function public.can_sign_school_verification_evidence(text)
  to authenticated;
grant execute on function public.can_delete_school_verification_evidence(text)
  to authenticated;

drop policy if exists "Student verification reservations can upload"
  on storage.objects;
create policy "Student verification reservations can upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'school-verification-evidence'
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/requests/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
  )
  and public.can_upload_school_verification_evidence(name)
);

drop policy if exists "Student verification evidence is private"
  on storage.objects;
drop policy if exists "Student verification owners can access exact evidence"
  on storage.objects;
create policy "Student verification owners can access exact evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'school-verification-evidence'
  and owner_id = (select auth.uid())::text
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated',
    'storage.object.sign',
    'storage.object.delete_many'
  ])
  and public.can_view_school_verification_evidence(name)
);

drop policy if exists "Student verification reviewers can sign exact evidence"
  on storage.objects;
create policy "Student verification reviewers can sign exact evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'school-verification-evidence'
  and storage.allow_any_operation(array['storage.object.sign'])
  and public.can_sign_school_verification_evidence(name)
);

drop policy if exists "Unsubmitted student evidence can be removed"
  on storage.objects;
create policy "Unsubmitted student evidence can be removed"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'school-verification-evidence'
  and owner_id = (select auth.uid())::text
  and public.can_delete_school_verification_evidence(name)
);

-- Reserve one exact, random path. Original filenames never appear in paths.
create or replace function public.reserve_school_verification_evidence(
  p_document_type text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_document_type text := lower(trim(coalesce(p_document_type, '')));
  safe_file_name text := trim(coalesce(p_original_file_name, ''));
  safe_mime_type text := lower(trim(coalesce(p_mime_type, '')));
  caller_email_confirmed_at timestamptz;
  membership_status text;
  evidence_id uuid := gen_random_uuid();
  extension text;
  storage_path text;
  recent_reservation_count integer;
  recent_reservation_bytes bigint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize reservation counting and cleanup for this account.
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));

  -- Metadata with no object can be reclaimed safely in SQL. Rows whose object
  -- still exists are intentionally left for the Storage-API cleanup worker.
  delete from private.school_verification_evidence expired_evidence
  where expired_evidence.user_id = caller
    and expired_evidence.status = 'reserved'
    and expired_evidence.request_id is null
    and expired_evidence.reservation_expires_at <= now()
    and not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'school-verification-evidence'
        and object.name = expired_evidence.storage_path
    );

  select app_user.email_confirmed_at
  into caller_email_confirmed_at
  from auth.users app_user
  where app_user.id = caller;

  if caller_email_confirmed_at is null then
    raise exception 'Confirm your account email before uploading verification evidence';
  end if;

  select membership.status
  into membership_status
  from public.school_memberships membership
  where membership.user_id = caller;

  if not found then
    raise exception 'Complete your school profile before uploading verification evidence';
  end if;
  if membership_status = 'verified' then
    raise exception 'Your school membership is already verified';
  end if;
  if exists (
    select 1
    from public.school_verification_requests active_request
    where active_request.user_id = caller
      and active_request.status in ('submitted', 'under_review')
  ) then
    raise exception 'A school verification request is already being reviewed';
  end if;
  if safe_document_type not in (
    'student_id',
    'enrollment_letter',
    'class_schedule',
    'portal_screenshot',
    'other'
  ) then
    raise exception 'Choose a supported student document type';
  end if;
  if char_length(safe_file_name) not between 1 and 180
     or safe_file_name ~ '[\\/]'
     or safe_file_name ~ '[[:cntrl:]]' then
    raise exception 'Invalid evidence filename';
  end if;
  if p_size_bytes is null or p_size_bytes not between 1 and 8388608 then
    raise exception 'Evidence files must be 8 MB or smaller';
  end if;

  extension := case safe_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    else null
  end;
  if extension is null then
    raise exception 'Choose a JPG, PNG, WebP, or PDF file';
  end if;

  select
    count(*)::integer,
    coalesce(sum(reservation.size_bytes), 0)::bigint
  into recent_reservation_count, recent_reservation_bytes
  from private.school_verification_evidence_reservation_log reservation
  where reservation.user_id = caller
    and reservation.reserved_at > now() - interval '24 hours';

  if recent_reservation_count >= 15 then
    raise exception 'Daily verification upload reservation limit reached';
  end if;
  if recent_reservation_bytes + p_size_bytes > 67108864 then
    raise exception 'Daily verification upload byte limit reached';
  end if;

  if (
    select count(*)
    from private.school_verification_evidence evidence
    where evidence.user_id = caller
      and evidence.status = 'reserved'
      and evidence.request_id is null
      and evidence.reservation_expires_at > now()
  ) >= 3 then
    raise exception 'Only three verification files may be reserved at once';
  end if;

  storage_path := caller::text || '/requests/' || evidence_id::text || '.' || extension;

  insert into private.school_verification_evidence (
    id,
    user_id,
    document_type,
    storage_path,
    original_file_name,
    mime_type,
    size_bytes,
    status,
    validation_status,
    reservation_expires_at
  ) values (
    evidence_id,
    caller,
    safe_document_type,
    storage_path,
    safe_file_name,
    safe_mime_type,
    p_size_bytes,
    'reserved',
    'pending',
    now() + interval '1 hour'
  );

  insert into private.school_verification_evidence_reservation_log (
    evidence_id,
    user_id,
    size_bytes
  ) values (
    evidence_id,
    caller,
    p_size_bytes
  );

  return jsonb_build_object(
    'evidence_id', evidence_id,
    'storage_path', storage_path,
    'expires_at', now() + interval '1 hour'
  );
end;
$$;

revoke all on function public.reserve_school_verification_evidence(text,text,text,bigint)
  from public, anon, authenticated;
grant execute on function public.reserve_school_verification_evidence(text,text,text,bigint)
  to authenticated;

-- The browser can ask the trusted validator to inspect only its own exact,
-- pending reservation after the object matches every reserved attribute.
create or replace function public.get_my_school_verification_evidence_validation_target(
  p_evidence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target jsonb;
  target_object_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select jsonb_build_object(
    'evidence_id', evidence.id,
    'storage_path', evidence.storage_path,
    'mime_type', evidence.mime_type,
    'declared_size_bytes', evidence.size_bytes,
    'reservation_expires_at', evidence.reservation_expires_at
  ),
  object.id
  into target, target_object_id
  from private.school_verification_evidence evidence
  join storage.objects object
    on object.bucket_id = 'school-verification-evidence'
   and object.name = evidence.storage_path
  where evidence.id = p_evidence_id
    and evidence.user_id = caller
    and evidence.status = 'reserved'
    and evidence.request_id is null
    and evidence.validation_status = 'pending'
    and evidence.reservation_expires_at > now()
    and object.owner_id = caller::text
    and lower(coalesce(object.metadata ->> 'mimetype', '')) =
      evidence.mime_type
    and private.safe_school_verification_object_size(object.metadata) =
      evidence.size_bytes
  for update of evidence
  for key share of object;

  if target is null or target_object_id is null then
    raise exception 'Verification evidence is unavailable for validation';
  end if;

  -- Bind the pending validation to this immutable Storage row identity. A
  -- delete-and-reupload at the same path invalidates completion and submit.
  update private.school_verification_evidence evidence
  set validation_object_id = target_object_id
  where evidence.id = p_evidence_id
    and evidence.user_id = caller
    and evidence.validation_status = 'pending';

  return target;
end;
$$;

revoke all on function
  public.get_my_school_verification_evidence_validation_target(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.get_my_school_verification_evidence_validation_target(uuid)
  to authenticated;

-- Only the trusted Edge validator's service-role client can attest to content.
-- A browser cannot set validation state, hashes, or rejection codes.
create or replace function public.complete_school_verification_evidence_validation(
  p_evidence_id uuid,
  p_validation_status text,
  p_content_sha256 text,
  p_validation_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_status text := lower(trim(coalesce(p_validation_status, '')));
  safe_sha256 text := lower(trim(coalesce(p_content_sha256, '')));
  safe_error_code text := lower(trim(coalesce(p_validation_error_code, '')));
  updated_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if safe_status not in ('validated', 'rejected') then
    raise exception 'Unsupported validation state';
  end if;
  if safe_status = 'validated' then
    if safe_sha256 !~ '^[0-9a-f]{64}$' then
      raise exception 'A valid SHA-256 digest is required';
    end if;
    if safe_error_code <> '' then
      raise exception 'Validated evidence cannot include an error code';
    end if;
  else
    if safe_error_code !~ '^[a-z0-9_]{2,80}$' then
      raise exception 'A safe validation error code is required';
    end if;
    if safe_sha256 <> '' then
      raise exception 'Rejected evidence cannot include a content digest';
    end if;
  end if;

  perform 1
  from private.school_verification_evidence evidence
  join storage.objects object
    on object.bucket_id = 'school-verification-evidence'
   and object.name = evidence.storage_path
  where evidence.id = p_evidence_id
    and evidence.status = 'reserved'
    and evidence.request_id is null
    and evidence.validation_status = 'pending'
    and evidence.reservation_expires_at > now()
    and object.id = evidence.validation_object_id
    and object.owner_id = evidence.user_id::text
    and lower(coalesce(object.metadata ->> 'mimetype', '')) =
      evidence.mime_type
    and private.safe_school_verification_object_size(object.metadata) =
      evidence.size_bytes
  for update of evidence
  for key share of object;

  if not found then
    return false;
  end if;

  update private.school_verification_evidence evidence
  set
    validation_status = safe_status,
    validated_at = now(),
    content_sha256 = case
      when safe_status = 'validated' then safe_sha256
      else null
    end,
    validation_error_code = case
      when safe_status = 'rejected' then safe_error_code
      else null
    end
  where evidence.id = p_evidence_id
    and evidence.validation_status = 'pending';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function
  public.complete_school_verification_evidence_validation(uuid,text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.complete_school_verification_evidence_validation(uuid,text,text,text)
  to service_role;

create or replace function public.discard_school_verification_evidence_reservation(
  p_evidence_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  evidence_row private.school_verification_evidence%rowtype;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select evidence.*
  into evidence_row
  from private.school_verification_evidence evidence
  where evidence.id = p_evidence_id
    and evidence.user_id = caller
    and evidence.status = 'reserved'
    and evidence.request_id is null
  for update;

  if not found then
    return false;
  end if;
  if exists (
    select 1
    from storage.objects object
    where object.bucket_id = 'school-verification-evidence'
      and object.name = evidence_row.storage_path
  ) then
    raise exception 'Remove the uploaded object before discarding its reservation';
  end if;

  delete from private.school_verification_evidence evidence
  where evidence.id = evidence_row.id;

  return true;
end;
$$;

revoke all on function public.discard_school_verification_evidence_reservation(uuid)
  from public, anon, authenticated;
grant execute on function public.discard_school_verification_evidence_reservation(uuid)
  to authenticated;

-- Submit either a legacy-compatible academic email / SSO request or a
-- document-backed request. Documents are finalized in the same transaction
-- as the existing review request.
create or replace function public.submit_school_verification_request_v2(
  p_submission_method text,
  p_evidence_reference text default null,
  p_user_note text default null,
  p_evidence_ids uuid[] default '{}'::uuid[],
  p_redaction_confirmed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  safe_method text := lower(trim(coalesce(p_submission_method, '')));
  safe_evidence_ids uuid[] := coalesce(p_evidence_ids, '{}'::uuid[]);
  evidence_count integer := cardinality(safe_evidence_ids);
  matched_count integer;
  new_request_id uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  -- Prevent parallel browser tabs from finalizing overlapping reservations.
  perform pg_advisory_xact_lock(hashtextextended(caller::text, 0));

  if safe_method not in ('academic_email', 'institution_sso', 'student_document') then
    raise exception 'Choose a supported verification method';
  end if;
  if evidence_count > 3 then
    raise exception 'Only three verification files may be submitted';
  end if;
  if (
    select count(distinct evidence_item.evidence_id)
    from unnest(safe_evidence_ids) as evidence_item(evidence_id)
  ) <> evidence_count then
    raise exception 'Duplicate verification evidence is not allowed';
  end if;

  if safe_method = 'student_document' then
    if evidence_count not between 1 and 3 then
      raise exception 'Choose at least one verification file';
    end if;
    if p_redaction_confirmed is not true then
      raise exception 'Confirm that unnecessary personal information was removed';
    end if;

    perform 1
    from private.school_verification_evidence evidence
    where evidence.id = any(safe_evidence_ids)
      and evidence.user_id = caller
      and evidence.status = 'reserved'
      and evidence.request_id is null
      and evidence.validation_status = 'validated'
      and evidence.reservation_expires_at > now()
    for update;

    get diagnostics matched_count = row_count;

    if matched_count <> evidence_count then
      raise exception 'One or more evidence files are invalid, unvalidated, or expired';
    end if;

    -- Lock matching Storage rows until the metadata is finalized. A concurrent
    -- delete cannot slip between the integrity check and the submitted state.
    perform 1
    from private.school_verification_evidence evidence
    join storage.objects object
      on object.bucket_id = 'school-verification-evidence'
     and object.name = evidence.storage_path
    where evidence.id = any(safe_evidence_ids)
      and evidence.user_id = caller
      and object.id = evidence.validation_object_id
      and object.owner_id = caller::text
      and lower(coalesce(object.metadata ->> 'mimetype', '')) = evidence.mime_type
      and private.safe_school_verification_object_size(object.metadata) =
        evidence.size_bytes
    for key share of object;

    get diagnostics matched_count = row_count;

    if matched_count <> evidence_count then
      raise exception 'Uploaded evidence does not match its protected reservation';
    end if;

    new_request_id := public.submit_school_verification_request(
      'manual_review',
      evidence_count::text || case when evidence_count = 1
        then ' protected attachment'
        else ' protected attachments'
      end,
      p_user_note
    );

    update public.school_verification_requests request
    set
      requires_document_evidence = true,
      required_evidence_count = evidence_count
    where request.id = new_request_id
      and request.user_id = caller
      and request.status in ('submitted', 'under_review');

    get diagnostics matched_count = row_count;
    if matched_count <> 1 then
      raise exception 'Verification request could not be bound to its evidence';
    end if;

    update private.school_verification_evidence evidence
    set
      request_id = new_request_id,
      status = 'submitted',
      finalized_at = now(),
      redaction_confirmed_at = now(),
      retention_until = null
    where evidence.id = any(safe_evidence_ids)
      and evidence.user_id = caller
      and evidence.status = 'reserved'
      and evidence.request_id is null
      and evidence.validation_status = 'validated';

    get diagnostics matched_count = row_count;
    if matched_count <> evidence_count then
      raise exception 'Verification evidence finalization was incomplete';
    end if;
  else
    if evidence_count <> 0 then
      raise exception 'Private files are allowed only for student document review';
    end if;
    new_request_id := public.submit_school_verification_request(
      safe_method,
      p_evidence_reference,
      p_user_note
    );
  end if;

  return new_request_id;
end;
$$;

revoke all on function public.submit_school_verification_request_v2(text,text,text,uuid[],boolean)
  from public, anon, authenticated;
grant execute on function public.submit_school_verification_request_v2(text,text,text,uuid[],boolean)
  to authenticated;

create or replace function public.get_my_school_verification_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  base_result jsonb;
  history_result jsonb;
  latest_request_id uuid;
  latest_evidence_count integer := 0;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  base_result := coalesce(public.get_my_school_verification(), '{}'::jsonb);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'request_id', history.id,
        'school_name', history.school_name,
        'school_key', history.school_key,
        'evidence_kind', history.evidence_kind,
        'submission_method', case
          when history.evidence_count > 0 then 'student_document'
          else history.evidence_kind
        end,
        'evidence_count', history.evidence_count,
        'status', history.status,
        'submitted_at', history.submitted_at,
        'reviewed_at', history.reviewed_at,
        'reviewer_note', history.reviewer_note,
        'verification_method', history.decision_verification_method,
        'updated_at', history.updated_at
      )
      order by history.submitted_at desc, history.id desc
    ),
    '[]'::jsonb
  )
  into history_result
  from (
    select
      request.*,
      (
        select count(*)
        from private.school_verification_evidence evidence
        where evidence.request_id = request.id
          and evidence.user_id = caller
          and evidence.status = 'submitted'
      )::integer as evidence_count
    from public.school_verification_requests request
    where request.user_id = caller
    order by request.submitted_at desc, request.id desc
    limit 10
  ) history;

  begin
    latest_request_id := nullif(
      base_result -> 'latest_request' ->> 'request_id',
      ''
    )::uuid;
  exception when others then
    latest_request_id := null;
  end;

  if latest_request_id is not null then
    select count(*)
    into latest_evidence_count
    from private.school_verification_evidence evidence
    where evidence.request_id = latest_request_id
      and evidence.user_id = caller
      and evidence.status = 'submitted';

    base_result := jsonb_set(
      base_result,
      '{latest_request}',
      coalesce(base_result -> 'latest_request', '{}'::jsonb)
      || jsonb_build_object(
        'submission_method', case
          when latest_evidence_count > 0 then 'student_document'
          else base_result -> 'latest_request' ->> 'evidence_kind'
        end,
        'evidence_count', latest_evidence_count
      ),
      true
    );
  end if;

  return base_result || jsonb_build_object(
    'history', history_result,
    'private_evidence_enabled', true,
    'private_evidence_policy', jsonb_build_object(
      'maximum_files', 3,
      'maximum_file_bytes', 8388608,
      'signed_url_seconds', 60
    )
  );
end;
$$;

revoke all on function public.get_my_school_verification_v2()
  from public, anon, authenticated;
grant execute on function public.get_my_school_verification_v2()
  to authenticated;

create or replace function public.authorize_school_verification_evidence_access(
  p_evidence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  evidence_path text;
  evidence_request_id uuid;
  grant_expires_at timestamptz := now() + interval '90 seconds';
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if not private.has_concourse_admin_scope(
    caller,
    'school_verification.review'
  ) then
    raise exception 'Administrator scope required';
  end if;

  select evidence.storage_path, evidence.request_id
  into evidence_path, evidence_request_id
  from private.school_verification_evidence evidence
  join public.school_verification_requests request
    on request.id = evidence.request_id
   and request.user_id = evidence.user_id
  join storage.objects object
    on object.bucket_id = 'school-verification-evidence'
   and object.name = evidence.storage_path
  where evidence.id = p_evidence_id
    and evidence.user_id <> caller
    and evidence.status = 'submitted'
    and evidence.validation_status = 'validated'
    and request.status in ('submitted', 'under_review')
    and object.id = evidence.validation_object_id
    and object.owner_id = evidence.user_id::text
    and lower(coalesce(object.metadata ->> 'mimetype', '')) =
      evidence.mime_type
    and private.safe_school_verification_object_size(object.metadata) =
      evidence.size_bytes
  for key share of object;

  if evidence_path is null then
    raise exception 'Private evidence is unavailable for active review';
  end if;

  delete from private.school_verification_evidence_access_grants access_grant
  where access_grant.reviewer_id = caller
    and access_grant.expires_at <= now();

  insert into private.school_verification_evidence_access_grants (
    evidence_id,
    reviewer_id,
    expires_at
  ) values (
    p_evidence_id,
    caller,
    grant_expires_at
  )
  on conflict (evidence_id, reviewer_id) do update set
    expires_at = excluded.expires_at;

  insert into private.school_verification_evidence_access_log (
    evidence_id,
    request_id,
    reviewer_id
  ) values (
    p_evidence_id,
    evidence_request_id,
    caller
  );

  return jsonb_build_object(
    'evidence_id', p_evidence_id,
    'storage_path', evidence_path,
    'expires_at', grant_expires_at
  );
end;
$$;

revoke all on function
  public.authorize_school_verification_evidence_access(uuid)
  from public, anon, authenticated, service_role;
grant execute on function
  public.authorize_school_verification_evidence_access(uuid)
  to authenticated;

create or replace function public.get_school_verification_case_evidence(
  p_request_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  request_user_id uuid;
  request_status text;
  result jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  select request.user_id, request.status
  into request_user_id, request_status
  from public.school_verification_requests request
  where request.id = p_request_id;

  if not found then
    raise exception 'School verification request is unavailable';
  end if;
  if caller = request_user_id then
    raise exception 'Reviewers cannot review their own verification evidence';
  end if;
  if not private.has_concourse_admin_scope(
    caller,
    'school_verification.review'
  ) then
    raise exception 'Administrator scope required';
  end if;
  if request_status not in ('submitted', 'under_review') then
    raise exception 'Private evidence is available only during active review';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidence_id', evidence.id,
        'document_type', evidence.document_type,
        'original_file_name', evidence.original_file_name,
        'mime_type', evidence.mime_type,
        'size_bytes', evidence.size_bytes,
        'validation_status', evidence.validation_status,
        'submitted_at', evidence.finalized_at
      )
      order by evidence.finalized_at, evidence.id
    ),
    '[]'::jsonb
  )
  into result
  from private.school_verification_evidence evidence
  join storage.objects object
    on object.bucket_id = 'school-verification-evidence'
   and object.name = evidence.storage_path
  where evidence.request_id = p_request_id
    and evidence.user_id = request_user_id
    and evidence.status = 'submitted'
    and evidence.validation_status = 'validated'
    and object.id = evidence.validation_object_id
    and object.owner_id = evidence.user_id::text
    and lower(coalesce(object.metadata ->> 'mimetype', '')) =
      evidence.mime_type
    and private.safe_school_verification_object_size(object.metadata) =
      evidence.size_bytes;

  return jsonb_build_object(
    'request_id', p_request_id,
    'items', result
  );
end;
$$;

revoke all on function public.get_school_verification_case_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.get_school_verification_case_evidence(uuid)
  to authenticated;

-- A document-backed request cannot be approved after an attachment is
-- removed or its metadata no longer matches the protected object.
create or replace function private.guard_school_verification_evidence_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence_count integer;
  expected_evidence_count integer;
  valid_object_count integer;
begin
  if new.status = 'approved'
     and old.status is distinct from 'approved' then
    select count(*)
    into evidence_count
    from private.school_verification_evidence evidence
    where evidence.request_id = new.id;

    if new.requires_document_evidence then
      expected_evidence_count := new.required_evidence_count;
      if expected_evidence_count is null
         or expected_evidence_count not between 1 and 3
         or evidence_count <> expected_evidence_count then
        raise exception 'Document-backed verification evidence is incomplete';
      end if;
    elsif evidence_count > 0 then
      -- Compatibility for any document rows finalized before the request
      -- flags were introduced.
      expected_evidence_count := evidence_count;
    else
      expected_evidence_count := 0;
    end if;

    if expected_evidence_count > 0 then
      select count(*)
      into valid_object_count
      from private.school_verification_evidence evidence
      join storage.objects object
        on object.bucket_id = 'school-verification-evidence'
       and object.name = evidence.storage_path
      where evidence.request_id = new.id
        and evidence.user_id = new.user_id
        and evidence.status = 'submitted'
        and evidence.validation_status = 'validated'
        and object.id = evidence.validation_object_id
        and object.owner_id = evidence.user_id::text
        and lower(coalesce(object.metadata ->> 'mimetype', '')) = evidence.mime_type
        and private.safe_school_verification_object_size(object.metadata) =
          evidence.size_bytes;

      if valid_object_count <> expected_evidence_count then
        raise exception 'Document-backed verification evidence is incomplete';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_school_verification_evidence_approval()
  from public, anon, authenticated;

drop trigger if exists school_verification_evidence_approval_guard
  on public.school_verification_requests;
create trigger school_verification_evidence_approval_guard
  before update of status on public.school_verification_requests
  for each row execute procedure private.guard_school_verification_evidence_approval();

create or replace function private.schedule_school_verification_evidence_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('approved', 'rejected', 'withdrawn') then
    update private.school_verification_evidence evidence
    set retention_until = now() + interval '30 days'
    where evidence.request_id = new.id;
  elsif new.status in ('submitted', 'under_review') then
    update private.school_verification_evidence evidence
    set retention_until = null
    where evidence.request_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function
  private.schedule_school_verification_evidence_retention()
  from public, anon, authenticated;

drop trigger if exists school_verification_evidence_retention_schedule
  on public.school_verification_requests;
create trigger school_verification_evidence_retention_schedule
  after update of status on public.school_verification_requests
  for each row execute procedure
    private.schedule_school_verification_evidence_retention();

update private.school_verification_evidence evidence
set retention_until =
  coalesce(request.reviewed_at, request.updated_at, now()) + interval '30 days'
from public.school_verification_requests request
where request.id = evidence.request_id
  and request.status in ('approved', 'rejected', 'withdrawn')
  and evidence.retention_until is null;

-- Edge cleanup worker contract:
--   1. Fetch due paths with the service role.
--   2. Delete each object through the Storage API.
--   3. Finalize metadata only after Storage confirms absence.
-- SQL intentionally never deletes from storage.objects directly.
create or replace function public.get_school_verification_evidence_cleanup_batch(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_limit integer := greatest(1, least(coalesce(p_limit, 100), 100));
  items jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  -- Keep the quota ledger bounded while retaining far more than the rolling
  -- 24-hour window used by reservation enforcement.
  delete from private.school_verification_evidence_reservation_log reservation
  where reservation.reserved_at < now() - interval '30 days';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evidence_id', due.id,
        'storage_path', due.storage_path
      )
      order by due.due_at, due.id
    ),
    '[]'::jsonb
  )
  into items
  from (
    select
      evidence.id,
      evidence.storage_path,
      coalesce(
        evidence.retention_until,
        evidence.reservation_expires_at
      ) as due_at
    from private.school_verification_evidence evidence
    where (
      evidence.retention_until is not null
      and evidence.retention_until <= now()
    )
    or (
      evidence.status = 'reserved'
      and evidence.request_id is null
      and evidence.reservation_expires_at <= now() - interval '24 hours'
    )
    order by due_at, evidence.id
    limit safe_limit
  ) due;

  return items;
end;
$$;

revoke all on function
  public.get_school_verification_evidence_cleanup_batch(integer)
  from public, anon, authenticated, service_role;
grant execute on function
  public.get_school_verification_evidence_cleanup_batch(integer)
  to service_role;

create or replace function public.finalize_school_verification_evidence_cleanup(
  p_evidence_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_evidence_ids uuid[] := coalesce(p_evidence_ids, '{}'::uuid[]);
  deleted_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if cardinality(safe_evidence_ids) = 0 then
    return 0;
  end if;
  if cardinality(safe_evidence_ids) > 500 then
    raise exception 'Cleanup batches are limited to 500 evidence rows';
  end if;
  if (
    select count(distinct evidence_item.evidence_id)
    from unnest(safe_evidence_ids) as evidence_item(evidence_id)
    where evidence_item.evidence_id is not null
  ) <> cardinality(safe_evidence_ids) then
    raise exception 'Cleanup evidence ids must be unique and non-null';
  end if;

  perform 1
  from private.school_verification_evidence evidence
  where evidence.id = any(safe_evidence_ids)
  for update;

  if exists (
    select 1
    from private.school_verification_evidence evidence
    join storage.objects object
      on object.bucket_id = 'school-verification-evidence'
     and object.name = evidence.storage_path
    where evidence.id = any(safe_evidence_ids)
      and (
        (
          evidence.retention_until is not null
          and evidence.retention_until <= now()
        )
        or (
          evidence.status = 'reserved'
          and evidence.request_id is null
          and evidence.reservation_expires_at <= now() - interval '24 hours'
        )
      )
  ) then
    raise exception 'Delete protected evidence through the Storage API first';
  end if;

  delete from private.school_verification_evidence evidence
  where evidence.id = any(safe_evidence_ids)
    and (
      (
        evidence.retention_until is not null
        and evidence.retention_until <= now()
      )
      or (
        evidence.status = 'reserved'
        and evidence.request_id is null
        and evidence.reservation_expires_at <= now() - interval '24 hours'
      )
    )
    and not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'school-verification-evidence'
        and object.name = evidence.storage_path
    );

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function
  public.finalize_school_verification_evidence_cleanup(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function
  public.finalize_school_verification_evidence_cleanup(uuid[])
  to service_role;

notify pgrst, 'reload schema';

commit;
