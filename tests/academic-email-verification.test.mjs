import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase-academic-email-verification.sql", import.meta.url),
  "utf8",
);
const source = readFileSync(
  new URL(
    "../supabase/functions/academic-email-verification/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const readme = readFileSync(
  new URL(
    "../supabase/functions/academic-email-verification/README.md",
    import.meta.url,
  ),
  "utf8",
);

function sqlFunction(name, signatureStart = "") {
  const escaped = name.replaceAll(".", "\\.");
  const match = migration.match(
    new RegExp(
      `create or replace function ${escaped}\\(${signatureStart}[\\s\\S]*?\\n\\$\\$;`,
      "iu",
    ),
  );
  return match?.[0] || "";
}

test("academic domains are administrator-maintained and browser-inaccessible", () => {
  assert.match(
    migration,
    /create table if not exists public\.institution_academic_email_domains/,
  );
  assert.match(
    migration,
    /primary key \(school_key, email_domain\)/,
  );
  assert.match(
    migration,
    /revoke all on table public\.institution_academic_email_domains\s+from public, anon, authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant\s+(?:select|insert|update|delete)[\s\S]{0,160}institution_academic_email_domains/iu,
  );
  assert.match(
    migration,
    /private\.academic_email_domain_is_allowed\(\s*membership\.school_key,\s*normalized_email\s*\)/,
  );
  assert.doesNotMatch(
    migration,
    /profiles[\s\S]{0,160}insert into public\.institution_academic_email_domains/iu,
    "user profile fields must never populate the trusted domain allow-list",
  );
});

test("a unique allow-listed domain can create only a pending legacy membership", () => {
  const target = sqlFunction("public.get_my_academic_email_verification_target");
  const issue = sqlFunction("public.issue_academic_email_verification_challenge");
  assert.match(
    migration,
    /create or replace function private\.resolve_academic_email_institution/,
  );
  assert.match(
    migration,
    /select distinct\s+allowed_domain\.canonical_school_key,\s*allowed_domain\.canonical_school_name/,
  );
  assert.match(migration, /having count\(\*\) = 1/);
  assert.match(target, /private\.resolve_academic_email_institution/);
  assert.match(target, /insert into public\.school_memberships/);
  assert.match(target, /resolved_school_key[\s\S]*?'pending'/);
  assert.match(issue, /private\.resolve_academic_email_institution/);
  assert.match(issue, /resolved_school_key[\s\S]*?'pending'/);
  assert.doesNotMatch(target, /values\s*\([\s\S]{0,180}'verified'/);
  assert.doesNotMatch(issue, /values\s*\([\s\S]{0,180}'verified'/);
});

test("the database stores a peppered digest and never a plaintext code", () => {
  const challengeTable = migration.match(
    /create table if not exists private\.academic_email_verification_challenges \(([\s\S]*?)\n\);/,
  )?.[1] || "";
  assert.match(
    migration,
    /create table if not exists private\.academic_email_verification_challenges/,
  );
  assert.match(migration, /code_hash text not null[\s\S]{0,80}\^\[0-9a-f\]\{64\}\$/);
  assert.doesNotMatch(
    challengeTable,
    /^\s*(?:otp_code|verification_code|plaintext_code|plain_code)\s+/imu,
  );
  assert.match(
    migration,
    /revoke all on table private\.academic_email_verification_challenges\s+from public, anon, authenticated/,
  );
  assert.match(source, /ACADEMIC_EMAIL_OTP_PEPPER/);
  assert.match(source, /pepper\.length < 32/);
  assert.match(source, /crypto\.subtle\.sign\(\s*"HMAC"/);
  assert.match(
    source,
    /crypto\.subtle\.importKey\(\s*"raw",\s*encoder\.encode\(pepper\),\s*\{ name: "HMAC", hash: "SHA-256" \},\s*false,\s*\["sign"\]/,
  );
  const successResponse = source.match(
    /return \{\s*status: "sent",[\s\S]*?\n\s*\};/u,
  )?.[0] || "";
  assert.ok(successResponse, "the send action should have a success response");
  assert.doesNotMatch(
    successResponse,
    /\bcode\b\s*:/u,
    "an API response must never include the generated code",
  );
});

test("issue and confirmation RPCs are service-only and user-bound", () => {
  const issue = sqlFunction("public.issue_academic_email_verification_challenge");
  const confirm = sqlFunction("public.confirm_academic_email_verification_challenge");
  assert.match(issue, /auth\.role\(\)[\s\S]{0,40}'service_role'/);
  assert.match(confirm, /auth\.role\(\)[\s\S]{0,40}'service_role'/);
  assert.match(
    migration,
    /grant execute on function\s+public\.issue_academic_email_verification_challenge\([^)]*\)\s+to service_role/,
  );
  assert.match(
    migration,
    /grant execute on function\s+public\.confirm_academic_email_verification_challenge\([^)]*\)\s+to service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function\s+public\.(?:issue|confirm)_academic_email_verification_challenge\([^)]*\)\s+to authenticated/,
  );
  assert.match(confirm, /challenge_row\.user_id = p_user_id/);
  assert.match(confirm, /membership\.school_key <> challenge\.school_key/);
});

test("resends and guesses are bounded and audit events are append-only", () => {
  const issue = sqlFunction("public.issue_academic_email_verification_challenge");
  const confirm = sqlFunction("public.confirm_academic_email_verification_challenge");
  assert.match(issue, /interval '60 seconds'/);
  assert.match(issue, /interval '1 hour'[\s\S]*?>= 3/);
  assert.match(issue, /interval '24 hours'[\s\S]*?>= 8/);
  assert.match(issue, /recent\.academic_email = normalized_email[\s\S]*?>= 5/);
  assert.match(confirm, /challenge\.attempt_count >= 8/);
  assert.match(confirm, /attempt_count = challenge_row\.attempt_count \+ 1/);
  assert.match(confirm, /'invalid_code'/);
  assert.match(confirm, /'locked'/);
  assert.match(
    migration,
    /before update or delete on private\.academic_email_verification_events/,
  );
  const actions = migration.match(
    /action text not null check \(action in \(([\s\S]*?)\)\)/,
  )?.[1] || "";
  assert.equal(
    (actions.match(/'confirmed'/gu) || []).length,
    1,
    "the event action CHECK must not contain duplicate confirmed values",
  );
  assert.match(
    issue,
    /pg_advisory_xact_lock\(\s*hashtextextended\('academic_email:' \|\| normalized_email, 0\)/,
    "destination limits must be serialised across accounts",
  );
  assert.match(
    confirm,
    /pg_advisory_xact_lock\(\s*hashtextextended\('academic_email:' \|\| challenge\.academic_email, 0\)/,
    "the same academic address must not be confirmed concurrently by two accounts",
  );
  assert.match(
    migration,
    /create unique index if not exists school_verification_active_academic_email_uidx[\s\S]*?lower\(evidence_reference\)[\s\S]*?evidence_kind = 'academic_email'/,
  );
});

test("a correct academic-email code is the only path that auto-verifies student status", () => {
  const confirm = sqlFunction("public.confirm_academic_email_verification_challenge");
  assert.match(confirm, /challenge\.code_hash <> safe_hash/);
  assert.match(confirm, /challenge_row\.user_id = p_user_id/);
  assert.match(confirm, /membership\.school_key <> challenge\.school_key/);
  assert.match(
    confirm,
    /private\.academic_email_domain_is_allowed\(\s*membership\.school_key,\s*challenge\.academic_email\s*\)/
  );
  assert.match(confirm, /update public\.school_memberships/);
  assert.match(confirm, /status = 'verified'/);
  assert.match(confirm, /verification_method = 'academic_email'/);
  assert.match(confirm, /confirmed_at_value := now\(\)/);
  assert.match(confirm, /verified_at = confirmed_at_value/);
  assert.match(confirm, /'academic_email'/);
  assert.match(confirm, /private\.append_verification_audit_event/);
  assert.match(confirm, /'status', 'verified'/);
  assert.doesNotMatch(confirm, /'human_review_required', true/);
  assert.match(source, /status === "verified"/);
  assert.doesNotMatch(source, /status === "submitted_for_review"/);
});

test("the Edge Function authenticates, validates strict requests, and allows exact origins", () => {
  assert.match(
    source,
    /import \{ createSupabaseContext \} from "npm:@supabase\/server@\^1";/,
  );
  assert.match(source, /MAX_REQUEST_BYTES = 1024/);
  assert.match(source, /request\.method === "OPTIONS"/);
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /createSupabaseContext\([\s\S]*?\{ auth: "user" \}/);
  assert.match(source, /VERIFICATION_ALLOWED_ORIGINS/);
  assert.match(source, /CONFIGURED_ORIGINS\.has\(value\.origin\)/);
  assert.match(source, /exactKeys\(payload, \["action", "academic_email"\]\)/);
  assert.match(
    source,
    /exactKeys\(payload, \["action", "challenge_id", "code"\]\)/,
  );
  assert.match(source, /"Cache-Control": "no-store, max-age=0"/);
  assert.match(source, /"X-Content-Type-Options": "nosniff"/);
  assert.match(source, /action === "send"/);
  assert.match(source, /context\.supabaseAdmin as SupabaseRpcClient/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(
    readme,
    /VERIFICATION_ALLOWED_ORIGINS="https:\/\/concoursehk\.com"/,
  );
});

test("mail delivery uses server secrets and failed delivery is recorded", () => {
  assert.match(source, /RESEND_API_KEY/);
  assert.match(source, /BREVO_API_KEY/);
  assert.match(source, /ACADEMIC_EMAIL_FROM_ADDRESS/);
  assert.match(source, /https:\/\/api\.resend\.com\/emails/);
  assert.match(source, /https:\/\/api\.brevo\.com\/v3\/smtp\/email/);
  assert.match(source, /AbortSignal\.timeout\(EMAIL_TIMEOUT_MS\)/);
  assert.match(source, /provider_delivery_failed/);
  assert.match(source, /mark_academic_email_challenge_delivery/);
  assert.match(source, /providerMessageId/);
  assert.match(migration, /provider_message_id text/);
  assert.doesNotMatch(source, /console\.(?:log|info|debug|error)\(/);
});

test("restored challenge state is safe and distinguishes expiry and lockout", () => {
  const state = sqlFunction("public.get_my_academic_email_verification_state");
  assert.match(state, /'challenge_status'/);
  assert.match(state, /challenge\.expires_at <= now\(\) then 'expired'/);
  assert.match(state, /challenge\.attempt_count >= 8 then 'locked'/);
  assert.match(state, /challenge\.superseded_at is not null then 'superseded'/);
  assert.doesNotMatch(state, /'normalized_email'|'academic_email'/);
});

test("immutable audit rows cannot block Auth account deletion", () => {
  assert.match(
    migration,
    /drop constraint if exists academic_email_verification_events_user_id_fkey/,
  );
  assert.match(
    migration,
    /drop constraint if exists verification_audit_events_actor_id_fkey/,
  );
});

test("deployment and deliverability guidance states the real boundary", () => {
  assert.match(
    readme,
    /supabase functions deploy academic-email-verification(?:\s|$)/,
  );
  assert.match(readme, /Do not use `--no-verify-jwt`/);
  assert.match(readme, /SPF and DKIM/);
  assert.match(readme, /DMARC/);
  assert.match(readme, /cannot guarantee inbox placement/i);
  assert.match(readme, /cannot be\s+reused directly by an Edge Function/i);
  assert.match(readme, /human_review_required/);
  assert.match(readme, /action: "send"/);
  assert.match(readme, /action: "confirm"/);
});
