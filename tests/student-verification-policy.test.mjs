import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const academicSql = readFileSync(
  new URL("../supabase-academic-email-verification.sql", import.meta.url),
  "utf8"
);
const legacySql = readFileSync(
  new URL("../supabase-account-trust-and-data-fix.sql", import.meta.url),
  "utf8"
);
const evidenceSql = readFileSync(
  new URL("../supabase-student-verification-evidence.sql", import.meta.url),
  "utf8"
);
const finalPolicySql = readFileSync(
  new URL("../supabase-academic-email-student-status.sql", import.meta.url),
  "utf8"
);

function sqlFunction(source, name){
  const escaped = name.replaceAll(".", "\\.");
  return source.match(
    new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\n\\$\\$;`, "iu")
  )?.[0] || "";
}

function functionBody(name, nextName){
  const match = html.match(
    new RegExp(
      `function ${name}\\([^)]*\\)\\{([\\s\\S]*?)\\n\\}\\n\\n(?:async )?function ${nextName}`
    )
  );
  assert.ok(match, `${name} should remain available for verification-policy tests`);
  return match[1];
}

test("confirming the private ConCourse login email never grants Verified Student status", () => {
  const submitAuth = functionBody("submitAuth", "initializeAccount");
  const target = sqlFunction(
    academicSql,
    "public.get_my_academic_email_verification_target"
  );

  assert.match(submitAuth, /auth\.verifyOtp\(\{ email, token, type:"email" \}\)/);
  assert.doesNotMatch(
    submitAuth,
    /school_memberships|verification_method|academic-email-verification/
  );
  assert.match(target, /select app_user\.email_confirmed_at/);
  assert.match(target, /Confirm your ConCourse account email first/);
  assert.doesNotMatch(
    target,
    /set[\s\S]{0,400}status\s*=\s*'verified'|verification_method\s*=\s*'academic_email'/
  );
});

test("wrong, mismatched, ambiguous, and unsupported academic domains fail closed", () => {
  const target = sqlFunction(
    academicSql,
    "public.get_my_academic_email_verification_target"
  );
  const issue = sqlFunction(
    academicSql,
    "public.issue_academic_email_verification_challenge"
  );
  const confirm = sqlFunction(
    academicSql,
    "public.confirm_academic_email_verification_challenge"
  );
  const resolver = sqlFunction(
    academicSql,
    "private.resolve_academic_email_institution"
  );

  assert.match(resolver, /having count\(\*\) = 1/);
  for(const body of [target, issue, confirm]){
    assert.match(body, /private\.academic_email_domain_is_allowed/);
  }
  assert.match(issue, /membership\.school_key/);
  assert.match(confirm, /membership\.school_key <> challenge\.school_key/);
  assert.match(confirm, /membership\.school_name <> challenge\.school_name/);
  assert.match(confirm, /return jsonb_build_object\('status', 'unavailable'\)/);
});

test("SSO and student documents remain non-verifying evidence paths", () => {
  const legacySubmit = sqlFunction(
    legacySql,
    "public.submit_school_verification_request"
  );
  const evidenceSubmit = sqlFunction(
    evidenceSql,
    "public.submit_school_verification_request_v2"
  );

  assert.match(legacySubmit, /'institution_sso'|'manual_review'/);
  assert.match(evidenceSubmit, /'institution_sso', 'student_document'/);
  for(const body of [legacySubmit, evidenceSubmit]){
    assert.doesNotMatch(
      body,
      /set[\s\S]{0,400}status\s*=\s*'verified'|verification_method\s*=\s*'academic_email'/i
    );
  }
});

test("the final migration makes academic-email proof a database invariant", () => {
  const proof = sqlFunction(
    finalPolicySql,
    "private.has_confirmed_academic_email_student_proof"
  );
  const guard = sqlFunction(
    finalPolicySql,
    "private.enforce_academic_email_student_status"
  );

  assert.match(finalPolicySql, /RUN THIS MIGRATION LAST/);
  assert.match(
    proof,
    /join public\.school_verification_requests[\s\S]*?challenge\.request_id/
  );
  assert.match(proof, /challenge\.confirmed_at is not null/);
  assert.match(proof, /challenge\.confirmed_at <= challenge\.expires_at/);
  assert.match(proof, /verification_request\.status = 'approved'/);
  assert.match(
    proof,
    /verification_request\.decision_verification_method[\s\S]*?'academic_email'/
  );
  assert.match(
    guard,
    /old\.user_id is distinct from new\.user_id/,
    "changing the owner of a verified row must revalidate its academic proof"
  );
  assert.match(guard, /new\.verification_method is distinct from 'academic_email'/);
  assert.match(guard, /private\.has_confirmed_academic_email_student_proof/);
  assert.match(
    finalPolicySql,
    /where membership\.status = 'verified'[\s\S]*?not private\.has_confirmed_academic_email_student_proof/
  );
  assert.match(
    finalPolicySql,
    /before insert or update on public\.school_memberships/
  );
});

test("unrelated evidence cannot block academic email, while revoked status stays closed", () => {
  const target = sqlFunction(
    academicSql,
    "public.get_my_academic_email_verification_target"
  );
  const issue = sqlFunction(
    academicSql,
    "public.issue_academic_email_verification_challenge"
  );
  const confirm = sqlFunction(
    academicSql,
    "public.confirm_academic_email_verification_challenge"
  );
  const finalConfirm = sqlFunction(
    finalPolicySql,
    "public.confirm_academic_email_verification_challenge"
  );
  const guard = sqlFunction(
    finalPolicySql,
    "private.enforce_academic_email_student_status"
  );

  for(const body of [target, issue, confirm, finalConfirm]){
    assert.match(body, /revoked/);
  }
  assert.match(
    guard,
    /old\.status = 'revoked'[\s\S]*?cannot be restored by email verification/
  );
  assert.match(
    confirm,
    /active_request\.evidence_kind = 'academic_email'[\s\S]*?request_already_active/
  );
  assert.match(
    confirm,
    /recent_request\.evidence_kind = 'academic_email'[\s\S]*?interval '30 days'/
  );
  assert.match(
    confirm,
    /status = 'withdrawn'[\s\S]*?active_request\.evidence_kind <> 'academic_email'/
  );
  assert.match(
    finalConfirm,
    /active_nonacademic_request_id[\s\S]*?active_nonacademic_request_status[\s\S]*?status = active_nonacademic_request_status/
  );
  assert.match(
    finalPolicySql,
    /membership\.status <> 'revoked'[\s\S]*?promoted_membership/
  );
});
