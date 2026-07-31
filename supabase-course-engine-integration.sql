-- ConCourse Course Engine, semester selection, and CourseKeys contracts
--
-- This migration is intentionally fail closed and safe to rerun.
--
-- Important activation boundaries:
--   * The HKBU source registered below is metadata only. No HKBU course row,
--     section row, private portal payload, or local file path is inserted.
--   * HKBU remains local-review-only until redistribution permission or an
--     institution-authorized access path is documented.
--   * Browser clients receive no direct table grants from this migration.
--   * Syllabus uploads, publishing, public downloads, credit awards,
--     purchases, and CourseKeys transactions all remain locked and disabled.
--   * Quarantine objects stay private. This schema stores an opaque R2 binding
--     and object key only; it never stores or returns a public download URL.
--   * Future administrator operations must run through reviewed server-side
--     service-role tooling. Do not put a service-role key in browser code.
--
-- This file creates contracts only. It does not deploy an Edge Function,
-- create an R2 bucket, copy source files, import HKBU data, or award credits.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Feature gates
-- ---------------------------------------------------------------------------

create table if not exists private.course_integration_feature_flags (
  feature_key text primary key
    check (feature_key ~ '^[a-z][a-z0-9_]{2,80}$'),
  enabled boolean not null default false,
  locked boolean not null default true,
  prerequisites jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(prerequisites) = 'array'
      and pg_column_size(prerequisites) <= 16384
    ),
  lock_reason text not null
    check (
      lock_reason = trim(lock_reason)
      and char_length(lock_reason) between 3 and 500
    ),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not enabled or not locked)
);

insert into private.course_integration_feature_flags (
  feature_key,
  enabled,
  locked,
  prerequisites,
  lock_reason
)
values
  (
    'catalog_imports',
    false,
    true,
    '["source authorization","schema validation","provenance review"]'::jsonb,
    'No production catalogue importer has completed authorization and provenance review.'
  ),
  (
    'hkbu_catalog_imports',
    false,
    true,
    '["HKBU authorization or redistribution permission","authorized access controls","provenance audit"]'::jsonb,
    'HKBU data is local-review-only and must not be imported into a public deployment.'
  ),
  (
    'syllabus_contributions',
    false,
    true,
    '["verified student enforcement","private quarantine storage","malware scanning","moderation","quotas","deletion"]'::jsonb,
    'Syllabus contribution intake is not active until every safety control is enforced server-side.'
  ),
  (
    'coursekeys_publishing',
    false,
    true,
    '["rights review","malware scanning","moderation","deletion enforcement"]'::jsonb,
    'CourseKeys publishing remains disabled.'
  ),
  (
    'coursekeys_public_downloads',
    false,
    true,
    '["authorized access policy","rights review","malware scanning","moderation","quota enforcement"]'::jsonb,
    'No CourseKeys resource may be downloaded publicly.'
  ),
  (
    'course_credit_awards',
    false,
    true,
    '["immutable ledger review","idempotency","approved contribution workflow","fraud controls"]'::jsonb,
    'Course credit awards remain disabled.'
  ),
  (
    'course_credit_purchases',
    false,
    true,
    '["immutable ledger review","atomic balance enforcement","refund policy","fraud controls"]'::jsonb,
    'Course credit purchases remain disabled.'
  ),
  (
    'coursekeys_transactions',
    false,
    true,
    '["verified participants","moderation","ledger enforcement","dispute handling","deletion policy"]'::jsonb,
    'CourseKeys transactions remain disabled.'
  )
on conflict (feature_key) do nothing;

comment on table private.course_integration_feature_flags is
  'Private, fail-closed activation gates. A reviewed service-role migration must unlock and enable a capability only after every listed prerequisite is enforced.';

-- ---------------------------------------------------------------------------
-- Private catalogue provenance and import contracts
-- ---------------------------------------------------------------------------

create table if not exists private.course_catalog_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique
    check (source_key ~ '^[a-z0-9][a-z0-9._-]{2,100}$'),
  institution_key text not null
    check (institution_key ~ '^[a-z0-9][a-z0-9._-]{1,80}$'),
  display_name text not null
    check (
      display_name = trim(display_name)
      and char_length(display_name) between 2 and 200
    ),
  source_kind text not null
    check (source_kind in (
      'institution_api',
      'authorized_portal',
      'portal_snapshot',
      'licensed_feed',
      'manual_admin_import'
    )),
  access_scope text not null default 'private_authorized'
    check (access_scope in (
      'local_review_only',
      'private_authorized',
      'public_redistributable'
    )),
  redistribution_status text not null default 'permission_unconfirmed'
    check (redistribution_status in (
      'permission_unconfirmed',
      'permission_denied',
      'authorized_access_only',
      'redistribution_confirmed'
    )),
  import_status text not null default 'registered'
    check (import_status in (
      'registered',
      'authorization_pending',
      'ready',
      'paused',
      'retired'
    )),
  import_enabled boolean not null default false,
  browser_visible boolean not null default false,
  manifest_sha256 text
    check (
      manifest_sha256 is null
      or manifest_sha256 ~ '^[0-9a-f]{64}$'
    ),
  source_revision text
    check (
      source_revision is null
      or (
        source_revision = trim(source_revision)
        and char_length(source_revision) between 1 and 160
      )
    ),
  data_as_of timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and pg_column_size(metadata) <= 32768
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    access_scope <> 'public_redistributable'
    or redistribution_status = 'redistribution_confirmed'
  ),
  check (
    not browser_visible
    or access_scope = 'public_redistributable'
  ),
  check (
    not import_enabled
    or import_status = 'ready'
  )
);

-- Metadata registration only: this does not import or expose HKBU course data.
insert into private.course_catalog_sources (
  source_key,
  institution_key,
  display_name,
  source_kind,
  access_scope,
  redistribution_status,
  import_status,
  import_enabled,
  browser_visible,
  metadata
)
values (
  'hkbu-local-review',
  'hkbu',
  'Hong Kong Baptist University local review source',
  'portal_snapshot',
  'local_review_only',
  'permission_unconfirmed',
  'authorization_pending',
  false,
  false,
  jsonb_build_object(
    'purpose', 'schema readiness only',
    'course_rows_imported', false,
    'public_deployment_allowed', false,
    'requires', 'redistribution permission or institution-authorized access controls'
  )
)
on conflict (source_key) do nothing;

comment on table private.course_catalog_sources is
  'Private source registry. hkbu-local-review is readiness metadata only and is not permission to copy, import, expose, or redistribute HKBU data.';

create table if not exists private.course_catalog_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references private.course_catalog_sources(id) on delete restrict,
  batch_key text not null unique
    check (batch_key ~ '^[a-z0-9][a-z0-9._:-]{2,160}$'),
  state text not null default 'registered'
    check (state in (
      'registered',
      'validating',
      'validated',
      'importing',
      'imported',
      'rejected',
      'rolled_back'
    )),
  manifest_sha256 text not null
    check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  schema_version integer not null check (schema_version between 1 and 1000),
  redistribution_reviewed boolean not null default false,
  authorization_reference text
    check (
      authorization_reference is null
      or (
        authorization_reference = trim(authorization_reference)
        and char_length(authorization_reference) between 3 and 500
        and authorization_reference !~ '(?:^|[[:space:]])/(?:Users|home|var|tmp)/'
      )
    ),
  record_counts jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(record_counts) = 'object'
      and pg_column_size(record_counts) <= 8192
    ),
  validation_report jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(validation_report) = 'object'
      and pg_column_size(validation_report) <= 32768
    ),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (state in ('registered', 'validating', 'validated') and completed_at is null)
    or
    (state in ('imported', 'rejected', 'rolled_back') and completed_at is not null)
    or state = 'importing'
  )
);

create index if not exists course_catalog_import_batches_source_idx
  on private.course_catalog_import_batches (source_id, created_at desc, id);

create table if not exists private.course_catalog_courses (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references private.course_catalog_sources(id) on delete restrict,
  import_batch_id uuid
    references private.course_catalog_import_batches(id) on delete restrict,
  course_key text not null unique
    check (
      course_key = trim(course_key)
      and char_length(course_key) between 4 and 160
      and course_key ~ '^[a-z0-9][a-z0-9._-]{1,47}:[A-Za-z0-9][A-Za-z0-9._/-]{1,110}$'
    ),
  institution_key text not null
    check (institution_key ~ '^[a-z0-9][a-z0-9._-]{1,80}$'),
  source_course_id text not null
    check (
      source_course_id = trim(source_course_id)
      and char_length(source_course_id) between 1 and 120
    ),
  course_code text not null
    check (
      course_code = trim(course_code)
      and char_length(course_code) between 1 and 80
    ),
  title text not null
    check (
      title = trim(title)
      and char_length(title) between 2 and 300
    ),
  description text
    check (
      description is null
      or (
        description = trim(description)
        and char_length(description) between 1 and 12000
      )
    ),
  faculty text
    check (
      faculty is null
      or (
        faculty = trim(faculty)
        and char_length(faculty) between 1 and 240
      )
    ),
  department text
    check (
      department is null
      or (
        department = trim(department)
        and char_length(department) between 1 and 240
      )
    ),
  credits numeric(6,2) check (credits is null or credits between 0 and 100),
  prerequisites jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(prerequisites) = 'array'
      and pg_column_size(prerequisites) <= 32768
    ),
  teaching_information jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(teaching_information) = 'object'
      and pg_column_size(teaching_information) <= 32768
    ),
  official_source_url text
    check (
      official_source_url is null
      or (
        official_source_url ~ '^https://'
        and char_length(official_source_url) <= 2048
      )
    ),
  access_scope text not null default 'private_authorized'
    check (access_scope in (
      'local_review_only',
      'private_authorized',
      'public_redistributable'
    )),
  record_status text not null default 'staged'
    check (record_status in ('staged', 'approved', 'rejected', 'withdrawn')),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, source_course_id)
);

create index if not exists course_catalog_courses_code_idx
  on private.course_catalog_courses (institution_key, course_code, id);
create index if not exists course_catalog_courses_source_status_idx
  on private.course_catalog_courses (source_id, record_status, id);

create table if not exists private.course_catalog_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null
    references private.course_catalog_courses(id) on delete restrict,
  import_batch_id uuid
    references private.course_catalog_import_batches(id) on delete restrict,
  term_key text not null
    check (
      term_key = trim(term_key)
      and char_length(term_key) between 2 and 80
    ),
  section_key text not null
    check (
      section_key = trim(section_key)
      and char_length(section_key) between 1 and 120
    ),
  section_label text
    check (
      section_label is null
      or (
        section_label = trim(section_label)
        and char_length(section_label) between 1 and 160
      )
    ),
  instructor_names text[] not null default '{}'::text[]
    check (cardinality(instructor_names) <= 30),
  credits numeric(6,2) check (credits is null or credits between 0 and 100),
  meeting_status text not null default 'missing'
    check (meeting_status in ('missing', 'tba', 'published')),
  meeting_slots jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(meeting_slots) = 'array'
      and jsonb_array_length(meeting_slots) <= 40
      and pg_column_size(meeting_slots) <= 32768
    ),
  teaching_information jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(teaching_information) = 'object'
      and pg_column_size(teaching_information) <= 32768
    ),
  official_source_url text
    check (
      official_source_url is null
      or (
        official_source_url ~ '^https://'
        and char_length(official_source_url) <= 2048
      )
    ),
  record_status text not null default 'staged'
    check (record_status in ('staged', 'approved', 'rejected', 'withdrawn')),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, term_key, section_key),
  check (
    meeting_status = 'published'
    or meeting_slots = '[]'::jsonb
  )
);

create index if not exists course_catalog_sections_term_idx
  on private.course_catalog_sections (term_key, course_id, section_key);
create index if not exists course_catalog_sections_course_status_idx
  on private.course_catalog_sections (course_id, record_status, id);

comment on column private.course_catalog_sections.meeting_status is
  'missing and tba are explicit source states. User-entered timetable slots belong to the user planner and must never be written back as institution catalogue facts.';

create or replace function private.enforce_course_catalog_import_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  selected_source private.course_catalog_sources%rowtype;
  catalogue_enabled boolean := false;
  hkbu_enabled boolean := false;
begin
  if tg_table_name = 'course_catalog_courses' then
    select source_record.*
      into selected_source
    from private.course_catalog_sources source_record
    where source_record.id = new.source_id;
  else
    select source_record.*
      into selected_source
    from private.course_catalog_courses course_record
    join private.course_catalog_sources source_record
      on source_record.id = course_record.source_id
    where course_record.id = new.course_id;
  end if;

  if selected_source.id is null then
    raise exception 'Course catalogue source is unavailable';
  end if;

  select flag.enabled and not flag.locked
    into catalogue_enabled
  from private.course_integration_feature_flags flag
  where flag.feature_key = 'catalog_imports';

  if coalesce(catalogue_enabled, false) is not true
     or selected_source.import_enabled is not true
     or selected_source.import_status <> 'ready' then
    raise exception 'Course catalogue imports are locked';
  end if;

  if selected_source.institution_key = 'hkbu' then
    select flag.enabled and not flag.locked
      into hkbu_enabled
    from private.course_integration_feature_flags flag
    where flag.feature_key = 'hkbu_catalog_imports';

    if coalesce(hkbu_enabled, false) is not true
       or selected_source.access_scope = 'local_review_only'
       or selected_source.redistribution_status = 'permission_unconfirmed' then
      raise exception 'HKBU catalogue imports are locked pending authorization';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_course_catalog_import_gate()
  from public, anon, authenticated;

drop trigger if exists course_catalog_courses_import_gate
  on private.course_catalog_courses;
create trigger course_catalog_courses_import_gate
  before insert on private.course_catalog_courses
  for each row execute procedure private.enforce_course_catalog_import_gate();

drop trigger if exists course_catalog_sections_import_gate
  on private.course_catalog_sections;
create trigger course_catalog_sections_import_gate
  before insert on private.course_catalog_sections
  for each row execute procedure private.enforce_course_catalog_import_gate();

-- ---------------------------------------------------------------------------
-- Private CourseKeys contribution, scanning, moderation, quota, and deletion
-- ---------------------------------------------------------------------------

create table if not exists private.course_resource_contributions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid references private.course_catalog_courses(id) on delete restrict,
  course_key text not null
    check (
      course_key = trim(course_key)
      and char_length(course_key) between 4 and 160
      and course_key ~ '^[a-z0-9][a-z0-9._-]{1,47}:[A-Za-z0-9][A-Za-z0-9._/-]{1,110}$'
    ),
  resource_kind text not null
    check (resource_kind in (
      'syllabus',
      'lecture_notes',
      'revision_notes',
      'past_paper',
      'study_guide',
      'other'
    )),
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
      'image/webp',
      'text/plain'
    )),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  rights_basis text not null
    check (rights_basis in (
      'own_original_work',
      'institution_authorized',
      'licensed_for_sharing',
      'permission_pending'
    )),
  rights_attested_at timestamptz,
  quarantine_provider text not null default 'cloudflare_r2'
    check (quarantine_provider = 'cloudflare_r2'),
  quarantine_binding text not null default 'COURSE_MATERIALS'
    check (quarantine_binding = 'COURSE_MATERIALS'),
  quarantine_object_key text not null unique
    check (
      quarantine_object_key = trim(quarantine_object_key)
      and char_length(quarantine_object_key) between 20 and 500
      and quarantine_object_key ~ '^quarantine/[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'
      and quarantine_object_key !~ '(?:^|/)\.\.(?:/|$)'
    ),
  content_sha256 text
    check (
      content_sha256 is null
      or content_sha256 ~ '^[0-9a-f]{64}$'
    ),
  lifecycle_state text not null default 'reserved'
    check (lifecycle_state in (
      'reserved',
      'quarantined',
      'scanning',
      'awaiting_moderation',
      'approved_private',
      'rejected',
      'deletion_queued',
      'deleted'
    )),
  scan_status text not null default 'pending'
    check (scan_status in ('pending', 'running', 'clean', 'infected', 'failed')),
  moderation_status text not null default 'not_requested'
    check (moderation_status in (
      'not_requested',
      'queued',
      'approved',
      'rejected',
      'needs_information'
    )),
  quota_state text not null default 'not_reserved'
    check (quota_state in ('not_reserved', 'reserved', 'consumed', 'released')),
  deletion_state text not null default 'not_requested'
    check (deletion_state in ('not_requested', 'requested', 'queued', 'completed', 'failed')),
  credit_award_state text not null default 'locked'
    check (credit_award_state in ('locked', 'not_eligible', 'pending', 'awarded', 'reversed')),
  rejection_code text
    check (
      rejection_code is null
      or rejection_code ~ '^[a-z0-9_]{2,80}$'
    ),
  reserved_at timestamptz not null default now(),
  uploaded_at timestamptz,
  scanned_at timestamptz,
  moderated_at timestamptz,
  deletion_requested_at timestamptz,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    rights_basis = 'permission_pending'
    or rights_attested_at is not null
  ),
  check (
    lifecycle_state <> 'approved_private'
    or (
      scan_status = 'clean'
      and moderation_status = 'approved'
      and rights_basis <> 'permission_pending'
      and content_sha256 is not null
    )
  ),
  check (
    lifecycle_state <> 'deleted'
    or (
      deletion_state = 'completed'
      and deleted_at is not null
    )
  )
);

create index if not exists course_resource_contributions_submitter_idx
  on private.course_resource_contributions (submitter_id, reserved_at desc, id);
create index if not exists course_resource_contributions_course_idx
  on private.course_resource_contributions (course_key, lifecycle_state, id);
create index if not exists course_resource_contributions_scan_queue_idx
  on private.course_resource_contributions (scan_status, reserved_at, id)
  where scan_status in ('pending', 'running', 'failed');
create index if not exists course_resource_contributions_moderation_queue_idx
  on private.course_resource_contributions (moderation_status, reserved_at, id)
  where moderation_status in ('queued', 'needs_information');
create index if not exists course_resource_contributions_deletion_queue_idx
  on private.course_resource_contributions (deletion_state, deletion_requested_at, id)
  where deletion_state in ('requested', 'queued', 'failed');

comment on column private.course_resource_contributions.quarantine_object_key is
  'Opaque private R2 quarantine reference only. Never convert this value into a browser URL or expose it through a public RPC.';

create or replace function private.enforce_course_contribution_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean := false;
begin
  select flag.enabled and not flag.locked
    into allowed
  from private.course_integration_feature_flags flag
  where flag.feature_key = 'syllabus_contributions';

  if coalesce(allowed, false) is not true then
    raise exception 'Course resource contributions are locked';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_course_contribution_gate()
  from public, anon, authenticated;

drop trigger if exists course_resource_contributions_feature_gate
  on private.course_resource_contributions;
create trigger course_resource_contributions_feature_gate
  before insert on private.course_resource_contributions
  for each row execute procedure private.enforce_course_contribution_gate();

create table if not exists private.course_resource_scan_events (
  id bigint generated always as identity primary key,
  contribution_id uuid not null
    references private.course_resource_contributions(id) on delete restrict,
  scanner text not null
    check (scanner = trim(scanner) and char_length(scanner) between 2 and 120),
  result text not null check (result in ('clean', 'infected', 'failed')),
  engine_revision text
    check (
      engine_revision is null
      or char_length(engine_revision) between 1 and 160
    ),
  result_code text
    check (
      result_code is null
      or result_code ~ '^[a-z0-9_.-]{2,120}$'
    ),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and pg_column_size(metadata) <= 16384
    ),
  created_at timestamptz not null default now()
);

create table if not exists private.course_resource_moderation_events (
  id bigint generated always as identity primary key,
  contribution_id uuid not null
    references private.course_resource_contributions(id) on delete restrict,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null
    check (decision in ('approved', 'rejected', 'needs_information')),
  reason_code text
    check (
      reason_code is null
      or reason_code ~ '^[a-z0-9_]{2,80}$'
    ),
  note text
    check (
      note is null
      or (
        note = trim(note)
        and char_length(note) between 1 and 2000
      )
    ),
  created_at timestamptz not null default now()
);

create table if not exists private.course_resource_deletion_events (
  id bigint generated always as identity primary key,
  contribution_id uuid not null
    references private.course_resource_contributions(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (event_type in ('requested', 'queued', 'object_removed', 'finalized', 'failed')),
  reason_code text
    check (
      reason_code is null
      or reason_code ~ '^[a-z0-9_]{2,80}$'
    ),
  created_at timestamptz not null default now()
);

create table if not exists private.course_resource_quota_config (
  singleton boolean primary key default true check (singleton),
  per_user_daily_item_limit integer not null default 3
    check (per_user_daily_item_limit between 1 and 100),
  per_user_daily_byte_limit bigint not null default 104857600
    check (per_user_daily_byte_limit between 1048576 and 10737418240),
  per_user_total_private_byte_limit bigint not null default 536870912
    check (per_user_total_private_byte_limit between 1048576 and 1099511627776),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into private.course_resource_quota_config (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists private.course_resource_quota_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  contribution_id uuid not null
    references private.course_resource_contributions(id) on delete restrict,
  event_type text not null check (event_type in ('reserve', 'release', 'expire')),
  item_delta smallint not null,
  byte_delta bigint not null,
  idempotency_key text not null unique
    check (
      idempotency_key = trim(idempotency_key)
      and char_length(idempotency_key) between 8 and 160
    ),
  created_at timestamptz not null default now(),
  check (
    (event_type = 'reserve' and item_delta = 1 and byte_delta > 0)
    or
    (event_type in ('release', 'expire') and item_delta = -1 and byte_delta < 0)
  )
);

create index if not exists course_resource_quota_events_user_time_idx
  on private.course_resource_quota_events (user_id, created_at desc, id desc);

-- ---------------------------------------------------------------------------
-- Append-only course credit ledger
-- ---------------------------------------------------------------------------

create table if not exists private.course_credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  contribution_id uuid
    references private.course_resource_contributions(id) on delete restrict,
  entry_kind text not null
    check (entry_kind in (
      'contribution_award',
      'purchase_debit',
      'refund_credit',
      'admin_credit_adjustment',
      'admin_debit_adjustment',
      'expiry_debit'
    )),
  amount integer not null check (amount <> 0 and abs(amount) <= 1000000),
  idempotency_key text not null unique
    check (
      idempotency_key = trim(idempotency_key)
      and char_length(idempotency_key) between 8 and 160
    ),
  reason_code text not null
    check (reason_code ~ '^[a-z0-9_]{2,80}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (
      entry_kind in (
        'contribution_award',
        'refund_credit',
        'admin_credit_adjustment'
      )
      and amount > 0
    )
    or
    (
      entry_kind in (
        'purchase_debit',
        'admin_debit_adjustment',
        'expiry_debit'
      )
      and amount < 0
    )
  ),
  check (
    entry_kind <> 'contribution_award'
    or contribution_id is not null
  )
);

create index if not exists course_credit_ledger_user_time_idx
  on private.course_credit_ledger (user_id, created_at, id);

create or replace view private.course_credit_account_balances
with (security_invoker = true)
as
select
  ledger.user_id,
  coalesce(sum(ledger.amount), 0)::bigint as balance,
  count(*)::bigint as entry_count,
  max(ledger.created_at) as last_entry_at
from private.course_credit_ledger ledger
group by ledger.user_id;

comment on view private.course_credit_account_balances is
  'Derived account balances. The append-only ledger is the source of truth; there is no client-writable balance column.';

create or replace function private.reject_course_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Course integration history is append-only';
end;
$$;

revoke all on function private.reject_course_history_mutation()
  from public, anon, authenticated;

create or replace function private.enforce_course_credit_feature_gate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  required_feature text;
  allowed boolean := false;
  transactions_allowed boolean := false;
begin
  required_feature := case
    when new.entry_kind in ('contribution_award', 'admin_credit_adjustment')
      then 'course_credit_awards'
    when new.entry_kind in (
      'purchase_debit',
      'refund_credit',
      'admin_debit_adjustment',
      'expiry_debit'
    )
      then 'course_credit_purchases'
  end;

  select flag.enabled and not flag.locked
    into allowed
  from private.course_integration_feature_flags flag
  where flag.feature_key = required_feature;

  if coalesce(allowed, false) is not true then
    raise exception 'Course credit ledger capability is locked';
  end if;

  if required_feature = 'course_credit_purchases' then
    select flag.enabled and not flag.locked
      into transactions_allowed
    from private.course_integration_feature_flags flag
    where flag.feature_key = 'coursekeys_transactions';

    if coalesce(transactions_allowed, false) is not true then
      raise exception 'CourseKeys transactions are locked';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_course_credit_feature_gate()
  from public, anon, authenticated;

drop trigger if exists course_credit_ledger_feature_gate
  on private.course_credit_ledger;
create trigger course_credit_ledger_feature_gate
  before insert on private.course_credit_ledger
  for each row execute procedure private.enforce_course_credit_feature_gate();

drop trigger if exists course_credit_ledger_immutable
  on private.course_credit_ledger;
create trigger course_credit_ledger_immutable
  before update or delete on private.course_credit_ledger
  for each row execute procedure private.reject_course_history_mutation();

drop trigger if exists course_resource_scan_events_immutable
  on private.course_resource_scan_events;
create trigger course_resource_scan_events_immutable
  before update or delete on private.course_resource_scan_events
  for each row execute procedure private.reject_course_history_mutation();

drop trigger if exists course_resource_moderation_events_immutable
  on private.course_resource_moderation_events;
create trigger course_resource_moderation_events_immutable
  before update or delete on private.course_resource_moderation_events
  for each row execute procedure private.reject_course_history_mutation();

drop trigger if exists course_resource_deletion_events_immutable
  on private.course_resource_deletion_events;
create trigger course_resource_deletion_events_immutable
  before update or delete on private.course_resource_deletion_events
  for each row execute procedure private.reject_course_history_mutation();

drop trigger if exists course_resource_quota_events_immutable
  on private.course_resource_quota_events;
create trigger course_resource_quota_events_immutable
  before update or delete on private.course_resource_quota_events
  for each row execute procedure private.reject_course_history_mutation();

-- ---------------------------------------------------------------------------
-- Optional, nullable course context on existing Student Hub content
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.community_posts') is not null then
    execute 'alter table public.community_posts add column if not exists course_key text';

    if not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = 'public.community_posts'::regclass
        and constraint_record.conname = 'community_posts_course_key_ck'
    ) then
      execute $constraint$
        alter table public.community_posts
          add constraint community_posts_course_key_ck
          check (
            course_key is null
            or (
              course_key = trim(course_key)
              and char_length(course_key) between 4 and 160
              and course_key ~ '^[a-z0-9][a-z0-9._-]{1,47}:[A-Za-z0-9][A-Za-z0-9._/-]{1,110}$'
            )
          )
      $constraint$;
    end if;

    execute
      'create index if not exists community_posts_course_key_created_idx ' ||
      'on public.community_posts (course_key, created_at desc, id desc) ' ||
      'where course_key is not null and deleted_at is null';

    execute
      'comment on column public.community_posts.course_key is ' ||
      quote_literal(
        'Optional validated Course Engine context. This column does not grant access to private catalogue or CourseKeys resources.'
      );
  end if;

  if to_regclass('public.marketplace_listings') is not null then
    execute 'alter table public.marketplace_listings add column if not exists course_key text';

    if not exists (
      select 1
      from pg_catalog.pg_constraint constraint_record
      where constraint_record.conrelid = 'public.marketplace_listings'::regclass
        and constraint_record.conname = 'marketplace_listings_course_key_ck'
    ) then
      execute $constraint$
        alter table public.marketplace_listings
          add constraint marketplace_listings_course_key_ck
          check (
            course_key is null
            or (
              course_key = trim(course_key)
              and char_length(course_key) between 4 and 160
              and course_key ~ '^[a-z0-9][a-z0-9._-]{1,47}:[A-Za-z0-9][A-Za-z0-9._/-]{1,110}$'
            )
          )
      $constraint$;
    end if;

    execute
      'create index if not exists marketplace_listings_course_key_created_idx ' ||
      'on public.marketplace_listings (course_key, created_at desc, id desc) ' ||
      'where course_key is not null';

    execute
      'comment on column public.marketplace_listings.course_key is ' ||
      quote_literal(
        'Optional validated Course Engine context. It does not prove ownership, rights, verification, or resource approval.'
      );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants: no browser-readable or browser-writable private tables
-- ---------------------------------------------------------------------------

alter table private.course_integration_feature_flags
  enable row level security;
alter table private.course_integration_feature_flags
  force row level security;
alter table private.course_catalog_sources
  enable row level security;
alter table private.course_catalog_sources
  force row level security;
alter table private.course_catalog_import_batches
  enable row level security;
alter table private.course_catalog_import_batches
  force row level security;
alter table private.course_catalog_courses
  enable row level security;
alter table private.course_catalog_courses
  force row level security;
alter table private.course_catalog_sections
  enable row level security;
alter table private.course_catalog_sections
  force row level security;
alter table private.course_resource_contributions
  enable row level security;
alter table private.course_resource_contributions
  force row level security;
alter table private.course_resource_scan_events
  enable row level security;
alter table private.course_resource_scan_events
  force row level security;
alter table private.course_resource_moderation_events
  enable row level security;
alter table private.course_resource_moderation_events
  force row level security;
alter table private.course_resource_deletion_events
  enable row level security;
alter table private.course_resource_deletion_events
  force row level security;
alter table private.course_resource_quota_config
  enable row level security;
alter table private.course_resource_quota_config
  force row level security;
alter table private.course_resource_quota_events
  enable row level security;
alter table private.course_resource_quota_events
  force row level security;
alter table private.course_credit_ledger
  enable row level security;
alter table private.course_credit_ledger
  force row level security;

revoke all on table private.course_integration_feature_flags
  from public, anon, authenticated;
revoke all on table private.course_catalog_sources
  from public, anon, authenticated;
revoke all on table private.course_catalog_import_batches
  from public, anon, authenticated;
revoke all on table private.course_catalog_courses
  from public, anon, authenticated;
revoke all on table private.course_catalog_sections
  from public, anon, authenticated;
revoke all on table private.course_resource_contributions
  from public, anon, authenticated;
revoke all on table private.course_resource_scan_events
  from public, anon, authenticated;
revoke all on table private.course_resource_moderation_events
  from public, anon, authenticated;
revoke all on table private.course_resource_deletion_events
  from public, anon, authenticated;
revoke all on table private.course_resource_quota_config
  from public, anon, authenticated;
revoke all on table private.course_resource_quota_events
  from public, anon, authenticated;
revoke all on table private.course_credit_ledger
  from public, anon, authenticated;
revoke all on table private.course_credit_account_balances
  from public, anon, authenticated;

comment on table private.course_resource_contributions is
  'Private metadata for future quarantined contributions. No upload RPC or public download path is created by this migration.';
comment on table private.course_credit_ledger is
  'Append-only credit source of truth. Inserts are feature-gated and all browser roles are denied direct access.';

commit;
