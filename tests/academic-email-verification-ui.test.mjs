import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase-academic-email-verification.sql", import.meta.url),
  "utf8"
);

function sourceBetween(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

function functionBlock(source, name){
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = signature.exec(source);
  assert.ok(match, `Expected function ${name}`);
  const bodyStart = source.indexOf("{", match.index);
  assert.ok(bodyStart >= 0, `Expected body for ${name}`);
  let depth = 0;
  for(let index = bodyStart; index < source.length; index += 1){
    if(source[index] === "{") depth += 1;
    else if(source[index] === "}"){
      depth -= 1;
      if(depth === 0) return source.slice(match.index, index + 1);
    }
  }
  assert.fail(`Expected closing brace for ${name}`);
}

test("academic email ownership has separate email, delivery, code, and confirmation controls", () => {
  const controls = sourceBetween(
    client,
    "function ensureAccountTrustControls(){",
    "\n  function schoolVerificationMethodLabel"
  );

  for(const id of [
    "hubAcademicEmailPanel",
    "hubAcademicEmailInput",
    "hubSendAcademicEmailCode",
    "hubAcademicEmailCode",
    "hubVerifyAcademicEmailCode",
    "hubAcademicEmailStatus"
  ]){
    assert.ok(controls.includes(`"${id}"`), `missing academic-email control ${id}`);
  }

  assert.match(
    controls,
    /hubAcademicEmailInput[\s\S]*?\.type = "email"[\s\S]*?\.autocomplete = "email"/
  );
  assert.match(
    controls,
    /hubAcademicEmailCode[\s\S]*?\.inputMode = "numeric"/
  );
  assert.match(controls, /\.pattern = "\[0-9\]\{8\}"/);
  assert.match(controls, /\.maxLength = 8/);
  assert.match(controls, /\.autocomplete = "one-time-code"/);
  assert.match(
    controls,
    /hubAcademicEmailStatus[\s\S]*?setAttribute\("role", "status"\)[\s\S]*?setAttribute\("aria-live", "polite"\)/
  );
});

test("the academic-email code field stays visible and is disabled until a delivered challenge is active", () => {
  const controls = sourceBetween(
    client,
    "function ensureAccountTrustControls(){",
    "\n  function schoolVerificationMethodLabel"
  );
  const renderer = functionBlock(client, "renderAccountTrustControls");

  assert.doesNotMatch(controls, /academicCodeField\.hidden = true/);
  assert.doesNotMatch(renderer, /hubAcademicEmailCodeField"\)\.hidden/);
  assert.match(
    renderer,
    /hubAcademicEmailCode"\)\.disabled = locked \|\| !academicChallengeActive/
  );
  assert.match(
    renderer,
    /hubVerifyAcademicEmailCode"\)\.disabled = locked \|\| !academicChallengeActive/
  );
});

test("Send Code and Verify Code invoke distinct authenticated actions", () => {
  const controls = sourceBetween(
    client,
    "function ensureAccountTrustControls(){",
    "\n  function schoolVerificationMethodLabel"
  );
  const send = functionBlock(client, "sendAcademicEmailVerificationCode");
  const confirm = functionBlock(client, "confirmAcademicEmailVerificationCode");
  const invoke = functionBlock(client, "academicEmailFunction");

  assert.match(
    controls,
    /hubSendAcademicEmailCode[\s\S]*?sendAcademicEmailVerificationCode/
  );
  assert.match(
    controls,
    /hubVerifyAcademicEmailCode[\s\S]*?confirmAcademicEmailVerificationCode/
  );
  assert.match(invoke, /functions\.invoke\(\s*"academic-email-verification"/);
  assert.match(invoke, /body:\s*\{action,\s*\.\.\.body\}/);
  assert.match(send, /academicEmailFunction\("send"/);
  assert.match(send, /hubAcademicEmailInput/);
  assert.match(confirm, /academicEmailFunction\("confirm"/);
  assert.match(confirm, /hubAcademicEmailCode/);
  assert.match(confirm, /loadSchoolVerificationRequest\(\)/);
});

test("challenge state exposes only a masked destination in a live status region", () => {
  const loader = functionBlock(client, "loadAcademicEmailVerificationState");
  const renderer = functionBlock(client, "renderAccountTrustControls");
  const stateRpc = sourceBetween(
    migration,
    "create or replace function public.get_my_academic_email_verification_state()",
    "\nrevoke all on function\n  public.get_my_academic_email_verification_state()"
  );

  assert.match(loader, /get_my_academic_email_verification_state/);
  assert.match(renderer, /academicPayload\.masked_email/);
  assert.match(renderer, /hubAcademicEmailStatus/);
  assert.match(stateRpc, /'masked_email'/);
  assert.doesNotMatch(
    stateRpc,
    /'normalized_email'|'academic_email'/,
    "the state RPC must not expose the stored full destination"
  );
});

test("academic-email delivery and code failures stay visible and keyboard recoverable", () => {
  const errorMapper = functionBlock(client, "academicEmailUserError");
  const confirmation = functionBlock(
    client,
    "confirmAcademicEmailVerificationCode"
  );
  const renderer = functionBlock(client, "renderAccountTrustControls");

  for(const failure of [
    "academic_email_not_allowed",
    "email_delivery_failed",
    "invalid_code",
    "code_expired",
    "code_locked"
  ]){
    assert.ok(
      errorMapper.includes(`"${failure}"`),
      `missing user-facing academic-email failure ${failure}`
    );
  }
  assert.match(confirmation, /\^\\d\{8\}\$/);
  assert.match(confirmation, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(confirmation, /codeInput\.focus\(\)/);
  assert.match(
    renderer,
    /academicState\.error[\s\S]*?hubAcademicEmailStatus/
  );
});

test("identity-review errors provide a user-triggered retry path", () => {
  const controls = sourceBetween(
    client,
    "function ensureAccountTrustControls(){",
    "\n  function schoolVerificationMethodLabel"
  );
  const retry = functionBlock(client, "retrySchoolVerificationLoad");

  assert.match(controls, /retrySchoolVerificationLoad/);
  assert.match(retry, /loadSchoolVerificationRequest\(\)/);
  assert.match(retry, /loadAcademicEmailVerificationState\(\)/);
});

test("school profile progress fails closed when the membership institution is missing", () => {
  const render = functionBlock(client, "renderAccountTrustControls");

  assert.match(
    render,
    /const schoolProfileComplete = Boolean\(\s*membership\?\.school_name\s*&&\s*membership\?\.school_key\s*\)/
  );
  assert.match(
    render,
    /step === "profile"\s*&&\s*schoolProfileComplete/
  );
  assert.doesNotMatch(
    render,
    /const completed = step === "profile"\s*\n/,
    "Step 1 must not be completed merely because the Profile view rendered"
  );
});

test("confirming an academic email refreshes a strictly academic-email verified membership", () => {
  const confirmation = sourceBetween(
    migration,
    "create or replace function public.confirm_academic_email_verification_challenge(",
    "\nrevoke all on function\n  public.confirm_academic_email_verification_challenge"
  );
  const clientConfirmation = functionBlock(
    client,
    "confirmAcademicEmailVerificationCode"
  );
  const membershipLoader = functionBlock(client, "loadMembership");
  const renderer = functionBlock(client, "renderAccountTrustControls");

  assert.match(confirmation, /status = 'verified'/);
  assert.match(confirmation, /verification_method = 'academic_email'/);
  assert.match(confirmation, /'status', 'verified'/);
  assert.match(clientConfirmation, /response\.data\.status !== "verified"/);
  assert.match(
    clientConfirmation,
    /loadMembership\(\)/
  );
  assert.match(
    membershipLoader,
    /\.select\("school_name, school_key, status, verification_method/
  );
  assert.match(
    renderer,
    /membership\?\.status === "verified"\s*&&\s*membership\?\.verification_method === "academic_email"/
  );
});
