import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * Source-contract coverage only.
 *
 * These tests deliberately inspect the checked-in browser and SQL sources.
 * They do not execute PostgreSQL, Supabase Auth, RLS policies, storage, or a
 * payment provider. The migration still requires a real staging deployment,
 * two-account authorization checks, and service-role payment tests before
 * production use.
 */

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const hubJs = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const marketJs = readFileSync(new URL("../marketplace.js", import.meta.url), "utf8");
const verificationSql = readFileSync(
  new URL("../supabase-verification-center.sql", import.meta.url),
  "utf8"
);
const marketSql = readFileSync(
  new URL("../supabase-setup-part-2.sql", import.meta.url),
  "utf8"
);

const workflows = [
  ["school_verification", "school_verification.review"],
  ["payment_evidence", "payment_evidence.review"],
  ["marketplace_dispute", "marketplace_disputes.review"],
  ["marketplace_report", "marketplace_reports.review"],
  ["content_report", "content_reports.review"],
  ["account_deletion", "account_deletion.review"],
  ["support_request", "support_requests.review"]
];

function sourceBetween(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

function sqlFunction(source, schema, name){
  return sourceBetween(
    source,
    `create or replace function ${schema}.${name}(`,
    `revoke all on function ${schema}.${name}(`
  );
}

function assertProtectedRpc(name){
  const body = sqlFunction(verificationSql, "public", name);
  assert.match(body, /security definer/);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /auth\.uid\(\)/);
  assert.match(
    verificationSql,
    new RegExp(
      `revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated;[\\s\\S]*?grant execute on function public\\.${name}\\([\\s\\S]*?to authenticated;`
    )
  );
  return body;
}

test("Verification Center coverage is explicitly source-contract coverage, not a simulated database pass", () => {
  const ownSource = readFileSync(new URL(import.meta.url), "utf8");
  assert.match(ownSource, /Source-contract coverage only/);
  assert.match(ownSource, /do not execute PostgreSQL, Supabase Auth, RLS policies/);
  assert.doesNotMatch(ownSource, /from ["']@supabase\/supabase-js["']/);
  assert.doesNotMatch(ownSource, /from ["']pg["']/);
});

test("the separate migration fails closed on prerequisites and keeps protected tables behind RPCs", () => {
  for(const prerequisite of [
    "public.concourse_admins",
    "public.school_memberships",
    "public.school_verification_requests",
    "public.account_deletion_requests",
    "public.content_reports",
    "public.marketplace_orders",
    "public.marketplace_disputes",
    "public.marketplace_reports",
    "private.marketplace_payment_projections"
  ]){
    assert.ok(
      verificationSql.includes(`'${prerequisite}'`),
      `migration should validate ${prerequisite}`
    );
  }
  for(const table of [
    "concourse_admin_scopes",
    "verification_audit_events",
    "marketplace_payment_review_requests",
    "concourse_support_requests"
  ]){
    assert.match(
      verificationSql,
      new RegExp(`alter table public\\.${table} enable row level security`)
    );
    assert.match(
      verificationSql,
      new RegExp(
        `revoke all on table public\\.${table}\\s+from public, anon, authenticated`
      )
    );
  }
  assert.doesNotMatch(
    verificationSql,
    /language plpgsql\s+language plpgsql/,
    "duplicate language clauses make the migration invalid"
  );
});

test("capability scopes are explicit, least-privilege, and retain legacy owner/reviewer/privacy mappings", () => {
  const scopeList = sqlFunction(
    verificationSql,
    "private",
    "concourse_admin_scope_list"
  );
  const context = assertProtectedRpc("get_my_concourse_admin_context");

  for(const [, scope] of workflows){
    assert.ok(verificationSql.includes(`'${scope}'`), `missing scope ${scope}`);
    assert.ok(hubJs.includes(`scope:"${scope}"`), `browser registry missing ${scope}`);
  }
  assert.match(
    scopeList,
    /legacy\.role = 'reviewer'[\s\S]*?'school_verification\.review'|select 'school_verification\.review'[\s\S]*?legacy\.role = 'reviewer'/
  );
  assert.match(
    scopeList,
    /legacy\.role = 'privacy'[\s\S]*?'account_deletion\.review'|select 'account_deletion\.review'[\s\S]*?legacy\.role = 'privacy'/
  );
  assert.match(scopeList, /owner_admin\.role = 'owner'/);
  assert.match(scopeList, /private\.allowed_concourse_admin_scopes\(\)/);
  assert.match(context, /'view_school_verification_queue'/);
  assert.match(context, /'review_school_verification_requests'/);
  assert.match(context, /'view_verification_center'/);
  assert.match(context, /'manage_admin_team', is_owner/);
});

test("navigation starts hidden and is revealed only after protected capability context is loaded", () => {
  assert.match(
    html,
    /<button[^>]+id="hubOwnerConsoleNav"[^>]+data-hub-target="owner-console"[^>]+hidden/
  );
  assert.match(
    html,
    /<section[^>]+id="hubOwnerConsoleView"[^>]+data-hub-view="owner-console"[^>]+hidden/
  );
  for(const id of [
    "verificationTabSchool",
    "verificationTabPayments",
    "verificationTabDisputes",
    "verificationTabMarketReports",
    "verificationTabContentReports",
    "verificationTabDeletion",
    "verificationTabSupport",
    "verificationTabTeam"
  ]){
    assert.match(html, new RegExp(`id="${id}"[^>]+hidden`));
  }

  const loadContext = sourceBetween(
    hubJs,
    "async function loadAdminContext({force=false}={}){",
    "function adminDetail"
  );
  assert.match(loadContext, /hubRpc\("get_my_concourse_admin_context"\)/);
  assert.match(loadContext, /normalizeAdminCapabilities/);
  assert.match(loadContext, /payload\?\.is_admin === false/);
  assert.match(loadContext, /switchView\("community"\)/);

  const access = sourceBetween(
    hubJs,
    "function renderAdminAccess(){",
    "async function loadAdminContext"
  );
  assert.match(access, /canOpenVerificationCenter\(\)|canReviewSchoolVerifications\(\)/);
  assert.match(access, /navigation\.hidden = !allowed/);
  assert.match(access, /badge\.hidden = !allowed/);
});

test("each queue is checked against its workflow scope on both the server and browser", () => {
  const mapping = sqlFunction(
    verificationSql,
    "private",
    "verification_workflow_scope"
  );
  const queue = assertProtectedRpc("get_verification_center_queue");
  const counts = assertProtectedRpc("get_verification_center_counts");

  for(const [workflow, scope] of workflows){
    assert.ok(mapping.includes(`'${workflow}'`), `missing workflow ${workflow}`);
    assert.ok(mapping.includes(`'${scope}'`), `missing mapping for ${scope}`);
    assert.ok(queue.includes(`safe_workflow = '${workflow}'`), `queue missing ${workflow}`);
    assert.ok(counts.includes(`'${scope}'`), `counts missing ${scope} gate`);
  }
  assert.match(queue, /private\.verification_workflow_scope\(safe_workflow\)/);
  assert.match(queue, /private\.has_concourse_admin_scope\(caller, required_scope\)/);
  assert.match(queue, /raise exception 'Administrator scope required'/);
  assert.match(queue, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/);
  assert.match(queue, /'has_more', safe_offset \+ safe_limit < total_count/);

  assert.match(hubJs, /VERIFICATION_WORKFLOWS/);
  assert.match(hubJs, /hasAdminCapability\(workflow\.scope\)/);
  assert.match(hubJs, /get_verification_center_queue/);
  assert.match(hubJs, /p_workflow:/);
});

test("browser status filters, review actions, and route events match the generic RPC contract", () => {
  const statusRegistry = sourceBetween(
    hubJs,
    "const VERIFICATION_STATUS_KEYS = Object.freeze({",
    "const VERIFICATION_ACTIONS"
  );
  const actionRegistry = sourceBetween(
    hubJs,
    "const VERIFICATION_ACTIONS = Object.freeze({",
    "let hubStickyGeometryFrame"
  );
  const expectedStatuses = {
    school_verification:["submitted", "under_review", "approved", "rejected", "withdrawn"],
    payment_evidence:["submitted", "under_review", "evidence_accepted", "rejected", "withdrawn"],
    marketplace_dispute:["open", "under_review", "resolved_buyer", "resolved_seller", "closed"],
    marketplace_report:["open", "reviewing", "resolved", "dismissed"],
    content_report:["open", "reviewing", "resolved", "dismissed"],
    account_deletion:["submitted", "processing", "completed", "cancelled"],
    support_request:["submitted", "under_review", "resolved", "rejected", "withdrawn"]
  };
  const expectedActions = {
    school_verification:["start_review", "approve", "reject"],
    payment_evidence:["start_review", "accept_evidence", "reject"],
    marketplace_dispute:["start_review", "recommend_refund", "recommend_release", "close"],
    marketplace_report:["start_review", "resolve", "dismiss"],
    content_report:["start_review", "resolve", "dismiss"],
    account_deletion:["start_review", "return_to_queue"],
    support_request:["start_review", "resolve", "reject"]
  };
  for(const [workflow, statuses] of Object.entries(expectedStatuses)){
    assert.ok(
      statusRegistry.includes(`${workflow}:${JSON.stringify(statuses)}`),
      `${workflow} browser statuses must match the server vocabulary`
    );
  }
  for(const [workflow, actions] of Object.entries(expectedActions)){
    assert.ok(
      actionRegistry.includes(`${workflow}:${JSON.stringify(actions)}`),
      `${workflow} browser actions must match the atomic review RPC`
    );
  }

  const switchView = sourceBetween(
    hubJs,
    "async function switchView(view){",
    "function messageViewIsActive"
  );
  assert.match(switchView, /renderVerificationCenter\(\)/);
  assert.match(switchView, /loadVerificationCenterCounts/);
  assert.match(switchView, /loadVerificationCenterQueue/);
  assert.doesNotMatch(switchView, /loadOwnerConsoleQueue/);

  const handlers = sourceBetween(
    hubJs,
    '$("ownerVerificationStatusFilter")?.addEventListener',
    '$("previewCourseInsights")?.addEventListener'
  );
  assert.match(handlers, /loadVerificationCenterQueue/);
  assert.match(handlers, /loadVerificationCenterCounts/);
  assert.doesNotMatch(handlers, /loadOwnerConsoleQueue/);
});

test("only the owner can appoint, update, or revoke scoped administrators", () => {
  for(const name of [
    "get_concourse_admin_team",
    "appoint_concourse_admin",
    "update_concourse_admin",
    "revoke_concourse_admin"
  ]){
    const body = assertProtectedRpc(name);
    assert.match(body, /private\.is_concourse_owner\(caller\)/);
    assert.match(body, /raise exception 'Owner access required'/);
  }

  const appoint = sqlFunction(
    verificationSql,
    "public",
    "appoint_concourse_admin"
  );
  const update = sqlFunction(
    verificationSql,
    "public",
    "update_concourse_admin"
  );
  const revoke = sqlFunction(
    verificationSql,
    "public",
    "revoke_concourse_admin"
  );
  assert.match(appoint, /private\.confirmed_concourse_user_by_email/);
  assert.match(appoint, /private\.validate_requested_admin_scopes/);
  assert.match(update, /private\.validate_requested_admin_scopes/);
  assert.match(appoint, /Owner access cannot be changed/);
  assert.match(update, /Owner access cannot be changed/);
  assert.match(revoke, /Owners cannot be removed/);
  for(const body of [appoint, update, revoke]){
    assert.match(body, /private\.append_verification_audit_event/);
  }

  assert.match(hubJs, /hubRpc\("get_concourse_admin_team"\)/);
  assert.match(hubJs, /hubRpc\("appoint_concourse_admin"/);
  assert.match(hubJs, /hubRpc\("update_concourse_admin_scopes"/);
  assert.match(hubJs, /hubRpc\("revoke_concourse_admin"/);
  assert.match(hubJs, /hasAdminCapability\("team\.manage"\)/);
  assert.match(
    hubJs,
    /hubRpc\("appoint_concourse_admin", \{\s*p_identifier:identifier,\s*p_role:role,\s*p_scopes:scopes/
  );
  assert.match(
    hubJs,
    /hubRpc\("update_concourse_admin_scopes", \{\s*p_user_id:userId,\s*p_role:role,\s*p_scopes:scopes/
  );
  assert.match(
    hubJs,
    /hubRpc\("revoke_concourse_admin", \{p_user_id:userId\}\)/
  );
});

test("audit history is append-only and every administrative mutation records an event", () => {
  const preventMutation = sqlFunction(
    verificationSql,
    "private",
    "prevent_verification_audit_mutation"
  );
  const append = sqlFunction(
    verificationSql,
    "private",
    "append_verification_audit_event"
  );
  const review = assertProtectedRpc("review_verification_center_case");

  assert.match(
    verificationSql,
    /create trigger verification_audit_events_immutable\s+before update or delete/
  );
  assert.match(preventMutation, /raise exception 'Verification audit events are immutable'/);
  assert.match(append, /insert into public\.verification_audit_events/);
  assert.match(review, /private\.append_verification_audit_event/);
  assert.match(review, /from_status/);
  assert.match(review, /to_status/);
  assert.doesNotMatch(
    verificationSql,
    /grant\s+(?:insert|update|delete|all)[\s\S]{0,120}verification_audit_events[\s\S]{0,120}authenticated/i
  );
});

test("atomic review actions prevent self-review and enforce assignment conflicts", () => {
  const review = assertProtectedRpc("review_verification_center_case");
  assert.match(review, /for update/);
  for(const phrase of [
    "Administrators cannot review their own request",
    "Administrators cannot review their own transaction",
    "Administrators cannot review their own marketplace case",
    "Administrators cannot review their own content case"
  ]){
    assert.ok(review.includes(phrase), `missing conflict guard: ${phrase}`);
  }
  assert.match(review, /Another administrator is reviewing this request/);
  assert.match(review, /Another administrator is reviewing this dispute/);
  assert.match(review, /Another administrator is reviewing this report/);
  assert.match(review, /private\.is_concourse_owner\(caller\)/);
  assert.match(review, /Deletion administrators may only start review or return a request/);
  assert.doesNotMatch(
    review,
    /safe_workflow = 'account_deletion'[\s\S]*?safe_action = 'complete'/
  );
});

test("browser review can annotate payment evidence but cannot mutate provider money state", () => {
  const review = assertProtectedRpc("review_verification_center_case");
  const paymentBranch = sourceBetween(
    review,
    "elsif safe_workflow = 'payment_evidence' then",
    "elsif safe_workflow = 'marketplace_dispute' then"
  );
  const disputeBranch = sourceBetween(
    review,
    "elsif safe_workflow = 'marketplace_dispute' then",
    "elsif safe_workflow = 'marketplace_report' then"
  );

  assert.match(verificationSql, /No browser-accessible RPC[\s\S]*changes a payment-provider state/);
  assert.match(paymentBranch, /payment_provider_state_changed', false/);
  assert.match(disputeBranch, /payment_provider_state_changed', false/);
  for(const body of [paymentBranch, disputeBranch]){
    assert.doesNotMatch(body, /update\s+private\.marketplace_payment_projections/i);
    assert.doesNotMatch(body, /apply_marketplace_payment_event\s*\(/i);
    assert.doesNotMatch(body, /configure_marketplace_checkout\s*\(/i);
  }
  assert.match(marketSql, /apply_marketplace_payment_event/);
  assert.match(marketSql, /to service_role/);
  assert.match(marketJs, /submit_marketplace_payment_review_request/);
  assert.match(marketJs, /This review does not move, release, or refund money/);
});

test("untrusted queue values are rendered as text and workflow CSS tokens are constrained", () => {
  const nodeHelper = sourceBetween(
    hubJs,
    'const node = (tag, className="", content="") => {',
    "const setStatus"
  );
  assert.match(nodeHelper, /element\.textContent = String\(content\)/);
  assert.doesNotMatch(nodeHelper, /innerHTML|insertAdjacentHTML|outerHTML/);

  const centerRenderer = sourceBetween(
    hubJs,
    "function renderVerificationCenter(){",
    "async function loadVerificationCenterCounts"
  );
  const caseRenderer = sourceBetween(
    hubJs,
    "function renderVerificationCase(record){",
    "function renderVerificationTeamCopy"
  );
  assert.match(centerRenderer, /replaceChildren\(\)/);
  assert.match(caseRenderer, /node\(/);
  assert.doesNotMatch(centerRenderer, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(caseRenderer, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.match(caseRenderer, /replace\(\/\[\^a-z_\]\/g, ""\)/);
});

test("Verification Center and user request copy exists in English, Mandarin, and Cantonese", () => {
  const copy = sourceBetween(
    hubJs,
    "function ownerConsoleCopy(){",
    "function normalizeAdminCapabilities"
  );
  for(const marker of ["en:", '"zh-CN":', '"zh-HK":']){
    assert.ok(copy.includes(marker), `missing locale block ${marker}`);
  }
  for(const key of [
    "workflowSchool",
    "workflowPayments",
    "workflowDisputes",
    "workflowMarketReports",
    "workflowContentReports",
    "workflowDeletion",
    "workflowSupport",
    "teamTitle",
    "actionConfirm"
  ]){
    assert.equal(
      (copy.match(new RegExp(`${key}:`, "g")) || []).length,
      3,
      `${key} should be translated in all three locale blocks`
    );
  }
  for(const key of [
    "marketplacePaymentReviewReason",
    "marketplacePaymentReviewSubmitted"
  ]){
    assert.equal(
      (marketJs.match(new RegExp(`${key}:`, "g")) || []).length,
      3,
      `${key} should be translated in all three locale blocks`
    );
  }
});

test("students can submit payment and support requests without direct table access", () => {
  const paymentSubmit = assertProtectedRpc(
    "submit_marketplace_payment_review_request"
  );
  const paymentList = assertProtectedRpc(
    "get_my_marketplace_payment_review_requests"
  );
  const supportSubmit = assertProtectedRpc("submit_concourse_support_request");
  const supportList = assertProtectedRpc("get_my_concourse_support_requests");

  assert.match(
    paymentSubmit,
    /\(orders\.buyer_id = caller or orders\.seller_id = caller\)/
  );
  assert.match(paymentSubmit, /insert into public\.marketplace_payment_review_requests/);
  assert.match(paymentList, /where payment_request\.requested_by = caller/);
  assert.match(supportSubmit, /insert into public\.concourse_support_requests/);
  assert.match(supportList, /where support_request\.user_id = caller/);
  assert.match(paymentSubmit, /private\.append_verification_audit_event/);
  assert.match(supportSubmit, /private\.append_verification_audit_event/);

  assert.match(marketJs, /hubRpc|authClient\.rpc/);
  assert.match(marketJs, /submit_marketplace_payment_review_request/);
  assert.match(hubJs, /get_my_concourse_support_requests/);
  assert.match(
    hubJs,
    /hubRpc\("submit_concourse_support_request", \{\s*p_request_type:category,\s*p_subject:subject,\s*p_details:details/
  );
});
