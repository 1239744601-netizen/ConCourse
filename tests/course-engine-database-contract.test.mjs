import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase-course-engine-integration.sql", import.meta.url),
  "utf8",
);

test("course integration migration is transactional and idempotent", () => {
  assert.match(migration, /^\s*--[\s\S]*\bbegin;/i);
  assert.match(migration, /\bcommit;\s*$/i);
  assert.match(migration, /create schema if not exists private/i);
  assert.match(
    migration,
    /create table if not exists private\.course_catalog_sources/i,
  );
  assert.match(
    migration,
    /alter table public\.community_posts add column if not exists course_key text/i,
  );
  assert.match(
    migration,
    /alter table public\.marketplace_listings add column if not exists course_key text/i,
  );
});

test("HKBU is registered only as locked local-review metadata", () => {
  assert.match(migration, /'hkbu-local-review'/);
  assert.match(migration, /'local_review_only'/);
  assert.match(migration, /'permission_unconfirmed'/);
  assert.match(migration, /'authorization_pending'/);
  assert.match(migration, /'course_rows_imported', false/);
  assert.match(migration, /'public_deployment_allowed', false/);
  assert.doesNotMatch(
    migration,
    /insert into private\.course_catalog_(?:courses|sections)/i,
  );
  assert.doesNotMatch(
    migration,
    /(?:\/Users\/|\/home\/|file:\/\/|[A-Za-z]:\\)/,
  );
});

test("private catalogue contracts cover sources, courses, sections, and missing meeting times", () => {
  assert.match(
    migration,
    /create table if not exists private\.course_catalog_import_batches/i,
  );
  assert.match(
    migration,
    /create table if not exists private\.course_catalog_courses/i,
  );
  assert.match(
    migration,
    /create table if not exists private\.course_catalog_sections/i,
  );
  assert.match(migration, /meeting_status in \('missing', 'tba', 'published'\)/);
  assert.match(
    migration,
    /User-entered timetable slots belong to the user planner/i,
  );
  assert.match(migration, /official_source_url ~ '\^https:\/\/'/);
  assert.match(
    migration,
    /create trigger course_catalog_courses_import_gate[\s\S]*before insert/i,
  );
  assert.match(migration, /Course catalogue imports are locked/);
  assert.match(
    migration,
    /HKBU catalogue imports are locked pending authorization/,
  );
});

test("contributions remain in opaque private quarantine with complete safety states", () => {
  assert.match(
    migration,
    /create table if not exists private\.course_resource_contributions/i,
  );
  assert.match(migration, /quarantine_provider text not null default 'cloudflare_r2'/);
  assert.match(migration, /quarantine_binding text not null default 'COURSE_MATERIALS'/);
  assert.match(migration, /quarantine_object_key text not null unique/);
  assert.match(migration, /scan_status in \('pending', 'running', 'clean', 'infected', 'failed'\)/);
  assert.match(migration, /moderation_status text not null default 'not_requested'/);
  assert.match(migration, /quota_state text not null default 'not_reserved'/);
  assert.match(migration, /deletion_state text not null default 'not_requested'/);
  assert.match(migration, /credit_award_state text not null default 'locked'/);
  assert.match(migration, /lifecycle_state <> 'approved_private'[\s\S]*scan_status = 'clean'[\s\S]*moderation_status = 'approved'/);
  assert.match(
    migration,
    /create trigger course_resource_contributions_feature_gate[\s\S]*before insert/i,
  );
  assert.match(migration, /Course resource contributions are locked/);
  assert.doesNotMatch(migration, /\b(?:public_url|download_url|signed_url|presigned_url)\b/i);
});

test("risky features are present only as locked disabled gates", () => {
  for (const feature of [
    "hkbu_catalog_imports",
    "syllabus_contributions",
    "coursekeys_publishing",
    "coursekeys_public_downloads",
    "course_credit_awards",
    "course_credit_purchases",
    "coursekeys_transactions",
  ]) {
    assert.match(
      migration,
      new RegExp(`'${feature}',\\s*false,\\s*true`, "i"),
      `${feature} must be disabled and locked`,
    );
  }
  assert.match(migration, /check \(not enabled or not locked\)/);
  assert.match(migration, /Course credit ledger capability is locked/);
  assert.match(migration, /CourseKeys transactions are locked/);
});

test("credit and operational histories are append-only with derived balances", () => {
  assert.match(
    migration,
    /create table if not exists private\.course_credit_ledger/i,
  );
  assert.match(
    migration,
    /create or replace view private\.course_credit_account_balances/i,
  );
  assert.match(migration, /coalesce\(sum\(ledger\.amount\), 0\)/i);
  assert.match(migration, /idempotency_key text not null unique/i);
  assert.match(
    migration,
    /create trigger course_credit_ledger_immutable[\s\S]*before update or delete/i,
  );
  assert.match(
    migration,
    /create trigger course_resource_quota_events_immutable[\s\S]*before update or delete/i,
  );
  assert.match(migration, /Course integration history is append-only/);
});

test("browser roles have no direct access to private course integration state", () => {
  assert.match(
    migration,
    /revoke all on schema private from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /alter table private\.course_catalog_courses\s+enable row level security/i,
  );
  assert.match(
    migration,
    /alter table private\.course_catalog_courses\s+force row level security/i,
  );
  assert.match(
    migration,
    /revoke all on table private\.course_credit_ledger\s+from public, anon, authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:all|select|insert|update|delete|execute)[\s\S]{0,160}\bto\s+(?:anon|authenticated)\b/i,
  );
  assert.doesNotMatch(migration, /create policy/i);
});

test("Student Hub course links are optional metadata and do not weaken access checks", () => {
  assert.match(
    migration,
    /if to_regclass\('public\.community_posts'\) is not null/i,
  );
  assert.match(
    migration,
    /if to_regclass\('public\.marketplace_listings'\) is not null/i,
  );
  assert.match(migration, /community_posts_course_key_ck/);
  assert.match(migration, /marketplace_listings_course_key_ck/);
  assert.match(migration, /course_key is null/);
  assert.doesNotMatch(migration, /alter table public\.(?:community_posts|marketplace_listings)\s+(?:disable row level security|no force row level security)/i);
});
