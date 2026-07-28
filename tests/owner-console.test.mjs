import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * Legacy Owner Console compatibility checks.
 *
 * These are source-contract checks, not a live Supabase/RLS execution. The
 * capability-based Verification Center supersedes the school-only browser
 * flow while preserving the original route, role registry, context keys, and
 * school-review RPC signatures for already-deployed installations.
 */

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const ownerSql = readFileSync(
  new URL("../supabase-owner-console.sql", import.meta.url),
  "utf8"
);
const trustSql = readFileSync(
  new URL("../supabase-account-trust-and-data-fix.sql", import.meta.url),
  "utf8"
);
const verificationSql = readFileSync(
  new URL("../supabase-verification-center.sql", import.meta.url),
  "utf8"
);

function sourceBetween(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

function sqlFunction(source, name){
  return sourceBetween(
    source,
    `create or replace function public.${name}(`,
    `revoke all on function public.${name}(`
  );
}

test("the legacy owner-console route remains hidden and compatible with the Verification Center", () => {
  assert.match(
    html,
    /id="hubOwnerConsoleNav"[^>]+data-hub-target="owner-console"[^>]+aria-controls="hubOwnerConsoleView"[^>]+hidden/
  );
  assert.match(
    html,
    /id="hubOwnerConsoleView"[^>]+data-hub-view="owner-console"[^>]+hidden/
  );
  assert.match(html, /id="hubOwnerConsoleNavLabel">Verification Center</);
  assert.match(js, /data-hub-view="owner-console"|activeView === "owner-console"/);
  assert.match(
    js,
    /const canReviewSchoolVerifications = \(\) => canOpenVerificationCenter\(\)/
  );

  const switchView = sourceBetween(
    js,
    "async function switchView(view){",
    "function messageViewIsActive"
  );
  assert.match(
    switchView,
    /view === "owner-console" && !canReviewSchoolVerifications\(\)\) view = "community"/
  );
});

test("the original owner migration preserves its protected registry and school RPC signatures", () => {
  assert.match(
    ownerSql,
    /intentionally preserves the[\s\S]*existing school-verification queue and decision RPC signatures/
  );
  assert.match(
    ownerSql,
    /to_regprocedure\(\s*'public\.get_school_verification_review_queue\(text,integer\)'/
  );
  assert.match(
    ownerSql,
    /to_regprocedure\(\s*'public\.review_school_verification_request\(uuid,text,text,text\)'/
  );
  assert.match(
    ownerSql,
    /revoke all on table public\.concourse_admins\s+from public, anon, authenticated/
  );
  assert.doesNotMatch(
    ownerSql,
    /grant\s+(?:select|insert|update|delete|all)\s+on\s+(?:table\s+)?public\.concourse_admins\s+to\s+(?:anon|authenticated)/i
  );
});

test("legacy context keys are retained when capability context replaces the old role-only response", () => {
  const originalContext = sqlFunction(ownerSql, "get_my_concourse_admin_context");
  const capabilityContext = sqlFunction(
    verificationSql,
    "get_my_concourse_admin_context"
  );
  for(const body of [originalContext, capabilityContext]){
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(body, /where [a-z_]+\.user_id = caller/);
    assert.match(body, /'is_admin'/);
    assert.match(body, /'role'/);
    assert.match(body, /'view_school_verification_queue'/);
    assert.match(body, /'review_school_verification_requests'/);
    assert.match(body, /'view_owner_summary'/);
  }
  assert.match(capabilityContext, /'view_verification_center'/);
  assert.match(capabilityContext, /'manage_admin_team'/);
  assert.match(capabilityContext, /'scopes', to_jsonb\(scope_list\)/);

  const browserContext = sourceBetween(
    js,
    "async function loadAdminContext({force=false}={}){",
    "function adminDetail"
  );
  assert.match(browserContext, /hubRpc\("get_my_concourse_admin_context"\)/);
  assert.match(browserContext, /normalizeAdminCapabilities/);
  assert.match(browserContext, /payload\?\.is_admin === false/);
});

test("legacy reviewer and privacy roles map to their historical least-privilege workflows", () => {
  const scopeList = sourceBetween(
    verificationSql,
    "create or replace function private.concourse_admin_scope_list(",
    "revoke all on function private.concourse_admin_scope_list("
  );
  assert.match(
    scopeList,
    /select 'school_verification\.review'::text[\s\S]*?legacy\.role = 'reviewer'/
  );
  assert.match(
    scopeList,
    /select 'account_deletion\.review'::text[\s\S]*?legacy\.role = 'privacy'/
  );
  assert.match(
    scopeList,
    /select unnest\(private\.allowed_concourse_admin_scopes\(\)\)[\s\S]*?owner_admin\.role = 'owner'/
  );

  const normalize = sourceBetween(
    js,
    "function normalizeAdminCapabilities(payload={}, role=\"\"){",
    "const hasAdminCapability"
  );
  assert.match(
    normalize,
    /role === "reviewer"[\s\S]*?normalized\.add\("school_verification\.review"\)/
  );
  assert.match(
    normalize,
    /role === "privacy"[\s\S]*?normalized\.add\("account_deletion\.review"\)/
  );
});

test("the historical school queue and decision RPCs remain server-authorized", () => {
  const queue = sqlFunction(
    trustSql,
    "get_school_verification_review_queue"
  );
  const review = sqlFunction(
    trustSql,
    "review_school_verification_request"
  );
  for(const body of [queue, review]){
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.match(
      body,
      /private\.is_concourse_admin\(caller, array\['owner', 'reviewer'\]::text\[\]\)/
    );
    assert.match(body, /raise exception 'Administrator access required'/);
  }
  assert.match(queue, /p_status text/);
  assert.match(queue, /p_limit integer/);
  assert.match(review, /p_request_id uuid/);
  assert.match(review, /p_decision text/);
  assert.match(review, /p_verification_method text/);
  assert.match(review, /p_reviewer_note text/);

  assert.match(
    verificationSql,
    /'public\.get_school_verification_review_queue\(text,integer\)'/
  );
  assert.match(
    verificationSql,
    /'public\.review_school_verification_request\(uuid,text,text,text\)'/
  );
});

test("legacy school records stay safely representable in the generic queue", () => {
  const genericQueue = sqlFunction(
    verificationSql,
    "get_verification_center_queue"
  );
  const renderCase = sourceBetween(
    js,
    "function renderVerificationCase(record){",
    "function renderVerificationTeamCopy"
  );
  for(const field of [
    "'request_id'",
    "'account_email'",
    "'school_name'",
    "'school_key'",
    "'evidence_kind'",
    "'evidence_reference'",
    "'user_note'",
    "'reviewer_note'"
  ]){
    assert.ok(genericQueue.includes(field), `generic queue should preserve ${field}`);
  }
  assert.match(renderCase, /verificationCaseTitle/);
  assert.match(renderCase, /verificationCaseSubtitle/);
  assert.match(renderCase, /verificationCaseDetails/);
  assert.match(renderCase, /node\("p", "", record\.reviewer_note/);
  assert.doesNotMatch(renderCase, /innerHTML|insertAdjacentHTML|outerHTML/);

  const nodeHelper = sourceBetween(
    js,
    'const node = (tag, className="", content="") => {',
    "const setStatus"
  );
  assert.match(nodeHelper, /element\.textContent = String\(content\)/);
});

test("the legacy owner summary stays owner-only and returns aggregates instead of record bodies", () => {
  const summary = sqlFunction(ownerSql, "get_concourse_owner_summary");
  assert.match(
    summary,
    /private\.is_concourse_admin\(\s*caller,\s*array\['owner'\]::text\[\]\s*\)/
  );
  assert.match(summary, /raise exception 'Owner access required'/);
  for(const group of [
    "accounts",
    "school_verification",
    "account_deletion",
    "community",
    "marketplace",
    "messaging"
  ]){
    assert.ok(summary.includes(`'${group}'`), `missing summary group ${group}`);
  }
  assert.doesNotMatch(
    summary,
    /select\s+(?:app_user|request|post|report|listing|message)\.\*/i
  );

  const browserSummary = sourceBetween(
    js,
    "async function loadOwnerOperationalSummary({force=false}={}){",
    "async function loadOwnerConsoleQueue"
  );
  assert.match(
    browserSummary,
    /!hasAdminCapability\("owner_summary\.view"\)/
  );
  assert.match(browserSummary, /hubRpc\("get_concourse_owner_summary"\)/);
});
