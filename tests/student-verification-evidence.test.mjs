import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase-student-verification-evidence.sql", import.meta.url),
  "utf8"
);
const client = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../member-hub.css", import.meta.url), "utf8");

test("student documents use a dedicated private bucket and non-public metadata", () => {
  assert.match(migration, /create table if not exists private\.school_verification_evidence/);
  assert.match(
    migration,
    /values \(\s*'school-verification-evidence',\s*'school-verification-evidence',\s*false,\s*8388608/
  );
  assert.match(migration, /'application\/pdf'[\s\S]*?'image\/jpeg'[\s\S]*?'image\/png'[\s\S]*?'image\/webp'/);
  assert.match(
    migration,
    /revoke all on table private\.school_verification_evidence\s+from public, anon, authenticated/
  );
  assert.doesNotMatch(migration, /grant\s+(?:select|insert|update|delete)[\s\S]*?private\.school_verification_evidence/i);
});

test("upload reservations are owner-bound, bounded, expiring, exact, and not replaceable", () => {
  const reserve = migration.match(
    /create or replace function public\.reserve_school_verification_evidence\([\s\S]*?\n\$\$;/
  )?.[0] || "";
  assert.match(migration, /create or replace function public\.reserve_school_verification_evidence/);
  assert.match(reserve, /storage_path := caller::text \|\| '\/requests\/' \|\| evidence_id::text/);
  assert.match(reserve, /pg_advisory_xact_lock/);
  assert.match(reserve, /interval '24 hours'/);
  assert.match(reserve, /15/);
  assert.match(reserve, /67108864/);
  assert.match(migration, /evidence\.user_id = auth\.uid\(\)/);
  assert.match(migration, /evidence\.reservation_expires_at > now\(\)/);
  assert.match(migration, /for insert[\s\S]*?public\.can_upload_school_verification_evidence\(name\)/);
  assert.match(migration, /for delete[\s\S]*?public\.can_delete_school_verification_evidence\(name\)/);
  assert.doesNotMatch(
    migration,
    /create policy "Student verification[^"]*"[\s\S]{0,120}\bfor update\b/i,
    "verification evidence must not be replaceable through Storage UPDATE"
  );
});

test("document submission remains human-review gated and legacy compatible", () => {
  const submit = migration.match(
    /create or replace function public\.submit_school_verification_request_v2\([\s\S]*?\n\$\$;/
  )?.[0] || "";
  assert.match(submit, /safe_method not in \('academic_email', 'institution_sso', 'student_document'\)/);
  assert.match(submit, /public\.submit_school_verification_request\(\s*'manual_review'/);
  assert.match(submit, /p_redaction_confirmed is not true/);
  assert.match(submit, /for update/);
  assert.match(submit, /validation_status = 'validated'/);
  assert.match(submit, /object\.owner_id = caller::text/);
  assert.match(submit, /object\.metadata ->> 'mimetype'/);
  assert.match(submit, /private\.safe_school_verification_object_size/);
  assert.match(submit, /requires_document_evidence = true/);
  assert.match(submit, /required_evidence_count = evidence_count/);
  assert.match(submit, /get diagnostics matched_count = row_count/);
  assert.doesNotMatch(submit, /status\s*=\s*'verified'/);
});

test("reviewer access is scoped, audited, sign-only, and short-lived in the browser", () => {
  const listing = migration.match(
    /create or replace function public\.get_school_verification_case_evidence\([\s\S]*?\n\$\$;/
  )?.[0] || "";
  assert.match(
    migration,
    /private\.has_concourse_admin_scope\(\s*auth\.uid\(\),\s*'school_verification\.review'/
  );
  assert.match(migration, /request\.status in \('submitted', 'under_review'\)/);
  assert.match(migration, /create or replace function public\.get_school_verification_case_evidence/);
  assert.match(migration, /create or replace function public\.authorize_school_verification_evidence_access/);
  assert.match(migration, /private\.school_verification_evidence_access_grants/);
  assert.match(migration, /private\.school_verification_evidence_access_log/);
  assert.match(migration, /storage\.allow_any_operation\(array\[\s*'storage\.object\.sign'\s*\]\)/);
  assert.doesNotMatch(listing, /'storage_path'/);
  assert.match(client, /SCHOOL_VERIFICATION_EVIDENCE_TTL_SECONDS = 60/);
  assert.match(client, /authorize_school_verification_evidence_access/);
  assert.match(
    client,
    /createSignedUrl\(storagePath, SCHOOL_VERIFICATION_EVIDENCE_TTL_SECONDS\)/
  );
  assert.doesNotMatch(client, /verificationEvidenceUrlCache|schoolVerificationEvidenceUrlCache/);
});

test("approval fails closed and terminal evidence receives a retention deadline", () => {
  const guard = migration.match(
    /create or replace function private\.guard_school_verification_evidence_approval\(\)[\s\S]*?\n\$\$;/
  )?.[0] || "";
  assert.match(migration, /create or replace function private\.guard_school_verification_evidence_approval/);
  assert.match(guard, /new\.status = 'approved'/);
  assert.match(guard, /new\.requires_document_evidence/);
  assert.match(guard, /new\.required_evidence_count/);
  assert.match(guard, /validation_status = 'validated'/);
  assert.match(guard, /valid_object_count <> expected_evidence_count/);
  assert.match(guard, /Document-backed verification evidence is incomplete/);
  assert.match(migration, /retention_until = now\(\) \+ interval '30 days'/);
  assert.match(migration, /get_school_verification_evidence_cleanup_batch/);
  assert.match(migration, /finalize_school_verification_evidence_cleanup/);
});

test("student UI is a three-step accessible form with private files and history", () => {
  assert.match(client, /hub-student-verification-progress/);
  assert.match(client, /verificationStepProfile/);
  assert.match(client, /verificationStepEvidence/);
  assert.match(client, /verificationStepReview/);
  assert.match(client, /node\("form", "hub-account-trust-form hub-student-verification-form"\)/);
  assert.match(client, /radio\.name = "hubVerificationMethodChoice"/);
  assert.match(client, /fileInput\.accept = "\.jpg,\.jpeg,\.png,\.webp,\.pdf/);
  assert.match(client, /fileInput\.tabIndex = -1/);
  assert.match(client, /node\("button", "btn-ghost hub-student-verification-file-picker"\)/);
  assert.match(client, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(client, /hubVerificationRedaction/);
  assert.match(client, /renderSchoolVerificationHistory/);
  assert.match(client, /"zh-CN"[\s\S]*?evidencePrivacy/);
  assert.match(client, /"zh-HK"[\s\S]*?evidencePrivacy/);
  assert.match(styles, /hub-student-verification-methods/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?hub-student-verification-documents/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?hub-student-verification-method/);
});

test("uploaded evidence must pass the trusted validation function before submission", () => {
  assert.match(migration, /create or replace function public\.get_my_school_verification_evidence_validation_target/);
  assert.match(migration, /create or replace function public\.complete_school_verification_evidence_validation/);
  assert.match(migration, /auth\.role\(\)[\s\S]{0,40}'service_role'/);
  assert.match(client, /functions\.invoke\(\s*"validate-school-verification-evidence"/);
  assert.match(client, /validationPayload\.status !== "validated"/);
  assert.match(client, /evidenceValidationUnavailable/);
});

test("generic school review normalizes legacy manual requests and honors the 1000 character schema limit", () => {
  assert.match(
    client,
    /record\?\.evidence_kind === "manual_review" \? "manual"/
  );
  assert.match(
    client,
    /note\.maxLength = workflowId === "school_verification" \? 1000 : 2000/
  );
});
