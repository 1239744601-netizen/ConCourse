import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase-account-trust-and-data-fix.sql", import.meta.url),
  "utf8"
);

test("legacy school review remains pending and cannot grant Verified Student status", () => {
  assert.match(migration, /create table if not exists public\.school_verification_requests/);
  assert.match(migration, /create table if not exists public\.concourse_admins/);
  assert.match(migration, /create or replace function public\.get_my_school_verification\(\)/);
  assert.match(migration, /create or replace function public\.submit_school_verification_request\(/);
  assert.match(migration, /create or replace function public\.review_school_verification_request\(/);
  assert.match(migration, /private\.is_concourse_admin\(caller, array\['owner', 'reviewer'\]::text\[\]\)/);
  const submitFunction = migration.match(
    /create or replace function public\.submit_school_verification_request\([\s\S]*?\n\$\$;/
  )?.[0] || "";
  const reviewFunction = migration.match(
    /create or replace function public\.review_school_verification_request\([\s\S]*?\n\$\$;/
  )?.[0] || "";
  assert.doesNotMatch(
    submitFunction,
    /set\s+status\s*=\s*'verified'/,
    "submitting evidence must never verify a membership"
  );
  assert.doesNotMatch(
    reviewFunction,
    /update public\.school_memberships[\s\S]{0,500}?status\s*=\s*'verified'/,
    "legacy/manual administrator review must not grant Verified Student status"
  );
  assert.doesNotMatch(
    reviewFunction,
    /update public\.school_memberships[\s\S]{0,500}?verification_method\s*=\s*safe_method/,
    "legacy/manual administrator review must not assign a verified method"
  );
  assert.match(
    migration,
    /revoke all on table public\.school_verification_requests[\s\S]*?from public, anon, authenticated/
  );
});

test("privacy choices and delayed account deletion are owner-scoped", () => {
  assert.match(migration, /create table if not exists public\.privacy_notice_acceptances/);
  assert.match(migration, /create or replace function public\.record_privacy_notice_acceptance/);
  assert.match(migration, /create table if not exists public\.account_deletion_requests/);
  assert.match(migration, /scheduled_for timestamptz not null default \(now\(\) \+ interval '7 days'\)/);
  assert.match(migration, /create or replace function public\.request_account_deletion/);
  assert.match(migration, /create or replace function public\.cancel_account_deletion_request\(\)/);
  assert.match(
    migration,
    /Users can read their own account deletion requests[\s\S]*?auth\.uid\(\)\) = user_id/
  );
  assert.match(
    migration,
    /revoke all on table public\.account_deletion_requests[\s\S]*?from public, anon, authenticated/
  );
});

test("final schedule synchronization preserves professor, section, and meeting details", () => {
  assert.match(migration, /add column if not exists professor text/);
  assert.match(migration, /add column if not exists section_label text/);
  assert.match(migration, /add column if not exists meeting_times jsonb/);
  assert.match(migration, /course_record ->> 'professor'/);
  assert.match(migration, /course_record ->> 'sectionLabel'/);
  assert.match(migration, /course_record -> 'slots'/);
  assert.match(migration, /create function public\.get_course_choice_dimensions/);
  assert.match(migration, /cohort\.size >= 5/);
  assert.match(migration, /dimension\.selected >= 5/);
});

test("messages and community comments expose bounded cursor pagination", () => {
  assert.match(migration, /create or replace function public\.get_conversation_messages_page/);
  assert.match(migration, /create or replace function public\.get_post_comments_page/);
  assert.match(migration, /safe_limit integer := least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/);
  assert.match(migration, /'has_more'/);
  assert.match(migration, /'next_cursor'/);
  assert.match(migration, /private\.can_read_direct_conversation/);
  assert.match(migration, /from public\.get_post_comments\(p_post_id\)/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});

test("the incremental migration documents its required execution order", () => {
  for (const prerequisite of [
    "supabase-setup-part-1.sql",
    "supabase-setup-part-2.sql",
    "supabase-global-market-fix.sql",
    "supabase-social-comments.sql"
  ]) {
    assert.match(migration, new RegExp(prerequisite.replaceAll(".", "\\.")));
  }
});
