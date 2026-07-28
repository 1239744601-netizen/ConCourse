import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const ownerSql = readFileSync(new URL("../supabase-owner-console.sql", import.meta.url), "utf8");
const trustSql = readFileSync(new URL("../supabase-account-trust-and-data-fix.sql", import.meta.url), "utf8");

function sourceBetween(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Owner Console navigation and content are hidden until access is confirmed", () => {
  assert.match(html, /<small[^>]+id="hubAdminRoleBadge"[^>]+hidden/);
  assert.match(html, /<button[^>]+id="hubOwnerConsoleNav"[^>]+data-hub-target="owner-console"[^>]+hidden/);
  assert.match(html, /<section[^>]+id="hubOwnerConsoleView"[^>]+data-hub-view="owner-console"[^>]+hidden/);

  const renderAccess = sourceBetween(js, "function renderAdminAccess(){", "async function loadAdminContext");
  assert.match(renderAccess, /const allowed = canReviewSchoolVerifications\(\)/);
  assert.match(renderAccess, /badge\.hidden = !allowed/);
  assert.match(renderAccess, /navigation\.hidden = !allowed/);
  assert.match(renderAccess, /if\(!allowed\)\{[\s\S]*?badge\.textContent = ""/);

  const switchView = sourceBetween(js, "async function switchView(view){", "function messageViewIsActive");
  assert.match(switchView, /view === "owner-console" && !canReviewSchoolVerifications\(\)\) view = "community"/);
});

test("the signed-in user's protected administrator context controls owner and reviewer access", () => {
  const loadContext = sourceBetween(js, "async function loadAdminContext({force=false}={}){", "function adminDetail");

  assert.match(loadContext, /hubRpc\("get_my_concourse_admin_context"\)/);
  assert.match(loadContext, /\["owner", "reviewer"\]\.includes\(role\)/);
  assert.match(loadContext, /payload\?\.is_admin === false[\s\S]*?\? "" : role/);
  assert.match(loadContext, /if\(!hubState\.adminRole\)\{[\s\S]*?hubState\.adminQueue = \[\]/);
  assert.match(loadContext, /hubState\.activeView === "owner-console"\) void switchView\("community"\)/);

  assert.match(ownerSql, /where admin_user\.user_id = caller/);
  assert.match(ownerSql, /'is_admin', admin_role is not null/);
  assert.match(ownerSql, /coalesce\(admin_role in \('owner', 'reviewer'\), false\)/);
  assert.match(
    ownerSql,
    /revoke all on table public\.concourse_admins\s+from public, anon, authenticated/
  );
});

test("ordinary users are denied both in the interface and by the review RPCs", () => {
  const loadQueue = sourceBetween(
    js,
    "async function loadOwnerConsoleQueue({force=false}={}){",
    "async function reviewSchoolVerification"
  );
  const reviewRequest = sourceBetween(
    js,
    "async function reviewSchoolVerification(request, decision, method, reviewerNote, noteInput){",
    "async function syncFinalSchedule"
  );

  assert.match(loadQueue, /if\(!canReviewSchoolVerifications\(\) \|\| !authClient \|\| !currentUser\) return \[\]/);
  assert.match(reviewRequest, /if\(!canReviewSchoolVerifications\(\) \|\| !request\?\.request_id\) return/);

  const queueRpc = sourceBetween(
    trustSql,
    "create or replace function public.get_school_verification_review_queue(",
    "revoke all on function public.get_school_verification_review_queue"
  );
  const reviewRpc = sourceBetween(
    trustSql,
    "create or replace function public.review_school_verification_request(",
    "revoke all on function public.review_school_verification_request"
  );
  for(const rpc of [queueRpc, reviewRpc]){
    assert.match(rpc, /private\.is_concourse_admin\(caller, array\['owner', 'reviewer'\]::text\[\]\)/);
    assert.match(rpc, /raise exception 'Administrator access required'/);
  }
});

test("the verification queue requests the selected status and renders complete review records", () => {
  const loadQueue = sourceBetween(
    js,
    "async function loadOwnerConsoleQueue({force=false}={}){",
    "async function reviewSchoolVerification"
  );
  const renderQueue = sourceBetween(
    js,
    "function renderOwnerConsole(){",
    "async function loadOwnerOperationalSummary"
  );

  assert.match(
    loadQueue,
    /hubRpc\("get_school_verification_review_queue", \{\s*p_status:hubState\.adminQueueStatus,\s*p_limit:50\s*\}\)/
  );
  assert.match(loadQueue, /Array\.isArray\(payload\?\.requests\)/);
  assert.match(loadQueue, /Array\.isArray\(payload\?\.queue\)/);

  assert.match(renderQueue, /queue\.replaceChildren\(\)/);
  assert.match(renderQueue, /card\.setAttribute\("role", "listitem"\)/);
  assert.match(renderQueue, /card\.dataset\.requestId = requestId/);
  for(const field of [
    "request.school_name",
    "request.account_email",
    "request.school_key",
    "request.evidence_kind",
    "request.evidence_reference",
    "request.submitted_at",
    "request.reviewed_at",
    "request.user_note"
  ]){
    assert.ok(renderQueue.includes(field), `${field} should be represented in the review queue`);
  }
});

test("Approve and Reject actions call the protected decision RPC with the reviewer's inputs", () => {
  const renderQueue = sourceBetween(
    js,
    "function renderOwnerConsole(){",
    "async function loadOwnerOperationalSummary"
  );
  const reviewRequest = sourceBetween(
    js,
    "async function reviewSchoolVerification(request, decision, method, reviewerNote, noteInput){",
    "async function syncFinalSchedule"
  );

  assert.match(
    renderQueue,
    /approve\.onclick = \(\) => void reviewSchoolVerification\(request, "approve", method\.value, note\.value, note\)/
  );
  assert.match(
    renderQueue,
    /reject\.onclick = \(\) => void reviewSchoolVerification\(request, "reject", method\.value, note\.value, note\)/
  );
  assert.match(reviewRequest, /decision === "reject" && !note/);
  assert.match(reviewRequest, /copy\.rejectNoteRequired/);
  assert.match(
    reviewRequest,
    /hubRpc\("review_school_verification_request", \{\s*p_request_id:requestId,\s*p_decision:decision,\s*p_verification_method:method \|\| "manual",\s*p_reviewer_note:note \|\| null\s*\}\)/
  );
  assert.match(reviewRequest, /await loadOwnerConsoleQueue\(\{force:true\}\)/);
});

test("evidence and review notes are rendered as text rather than executable markup", () => {
  const nodeHelper = sourceBetween(js, "const node = (tag, className=\"\", content=\"\") => {", "const setStatus");
  const renderQueue = sourceBetween(
    js,
    "function renderOwnerConsole(){",
    "async function loadOwnerOperationalSummary"
  );
  const reviewRequest = sourceBetween(
    js,
    "async function reviewSchoolVerification(request, decision, method, reviewerNote, noteInput){",
    "async function syncFinalSchedule"
  );

  assert.match(nodeHelper, /element\.textContent = String\(content\)/);
  assert.doesNotMatch(nodeHelper, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(renderQueue, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.match(renderQueue, /adminDetail\(copy, copy\.evidenceReference, request\.evidence_reference\)/);
  assert.match(renderQueue, /node\("p", "", request\.user_note \|\| copy\.noValue\)/);
  assert.match(renderQueue, /node\("p", "", request\.reviewer_note\)/);
  assert.match(renderQueue, /status\.replace\(\/\[\^a-z_\]\/g, ""\)/);
  assert.match(reviewRequest, /CSS\.escape\(requestId\)/);
});
