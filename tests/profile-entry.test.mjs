import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const hubJs = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");

function sourceBetween(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

function openingTag(source, marker){
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `Expected element marker: ${marker}`);
  const startIndex = source.lastIndexOf("<", markerIndex);
  const endIndex = source.indexOf(">", markerIndex);
  assert.ok(startIndex >= 0 && endIndex > markerIndex, `Expected opening tag around: ${marker}`);
  return source.slice(startIndex, endIndex + 1);
}

test("both top-left Edit Profile controls open the complete Profile view", () => {
  const sidebar = sourceBetween(
    html,
    '<aside class="hub-sidebar">',
    "\n    </aside>"
  );
  const avatarButton = openingTag(sidebar, 'id="hubEditProfileShortcut"');
  const textButton = openingTag(sidebar, 'class="hub-profile-shortcut"');

  for(const control of [avatarButton, textButton]){
    assert.match(control, /data-hub-target="profile"/);
    assert.match(control, /\bdata-profile-entry(?:\s|>)/);
    assert.match(control, /aria-controls="hubProfileView"/);
  }
  assert.equal(
    (sidebar.match(/\bdata-profile-entry(?:\s|>)/g) || []).length,
    2,
    "the avatar and Edit Profile label should be the two top-left Profile entry controls"
  );
});

test("the duplicate Profile navigation tab is absent", () => {
  const navigation = sourceBetween(
    html,
    '<nav class="hub-navigation"',
    "\n      </nav>"
  );
  assert.doesNotMatch(
    navigation,
    /<button(?=[^>]*\bhub-nav-button\b)(?=[^>]*data-hub-target="profile")[^>]*>/
  );
});

test("the complete Profile view has a stable accessible destination", () => {
  const profileTag = openingTag(html, 'id="hubProfileView"');
  const headingTag = openingTag(html, 'id="hubProfileHeading"');

  assert.match(profileTag, /data-hub-view="profile"/);
  assert.match(profileTag, /aria-labelledby="hubProfileHeading"/);
  assert.match(profileTag, /\bhidden(?:\s|>)/);
  assert.match(headingTag, /tabindex="-1"/);

  for(const requiredControl of [
    "profileDisplayName",
    "profileAvatarInput",
    "providerConnections",
    "profileAllowMessages",
    "saveMemberProfile"
  ]){
    assert.ok(
      html.includes(`id="${requiredControl}"`),
      `the complete Profile view should retain ${requiredControl}`
    );
  }
});

test("Profile entry activation focuses the Profile heading and exposes expanded state", () => {
  const switchView = sourceBetween(
    hubJs,
    "async function switchView(view){",
    "\n  function messageViewIsActive(){"
  );
  const targetHandler = sourceBetween(
    hubJs,
    'document.querySelectorAll("[data-hub-target]")',
    '\n  $("loadCourseInsights")'
  );

  assert.match(
    switchView,
    /button\.hasAttribute\("data-profile-entry"\)[\s\S]*?button\.setAttribute\("aria-expanded", String\(active\)\)/
  );
  assert.match(
    targetHandler,
    /button\.hasAttribute\("data-profile-entry"\)[\s\S]*?\$\("hubProfileHeading"\)\?\.focus\(\{preventScroll:true\}\)/
  );
});

test("opening Profile initializes and loads all trust and account controls", () => {
  const switchView = sourceBetween(
    hubJs,
    "async function switchView(view){",
    "\n  function messageViewIsActive(){"
  );
  const trustControls = sourceBetween(
    hubJs,
    "function ensureAccountTrustControls(){",
    "\n  function schoolVerificationMethodLabel"
  );

  assert.match(
    switchView,
    /view === "profile"[\s\S]*?ensureAccountTrustControls\(\)[\s\S]*?loadMemberProfile\(\)[\s\S]*?loadSocialConnections\(\{force:true\}\)[\s\S]*?loadSchoolVerificationRequest\(\)[\s\S]*?loadAccountDeletionRequest\(\)[\s\S]*?loadSupportRequests\(\)/
  );
  for(const id of [
    "hubAccountTrustControls",
    "hubSchoolVerification",
    "hubStudentVerificationForm",
    "hubAccountDeletion",
    "hubSupportRequest"
  ]){
    assert.ok(
      trustControls.includes(`"${id}"`),
      `Profile initialization should include ${id}`
    );
  }
});

test("identity review falls back to the compatible status RPC before reporting failure", () => {
  const loader = sourceBetween(
    hubJs,
    "async function loadSchoolVerificationRequest(){",
    "\n  async function loadAccountDeletionRequest(){"
  );
  const enhancedCall = loader.indexOf('hubRpc("get_my_school_verification_v2")');
  const compatibleCall = loader.indexOf('hubRpc("get_my_school_verification")');

  assert.ok(enhancedCall >= 0, "the enhanced identity-review RPC should be attempted");
  assert.ok(
    compatibleCall > enhancedCall,
    "the compatible identity-review RPC should be attempted only after the enhanced endpoint"
  );
  assert.match(loader, /if\(response\.error\)[\s\S]*?enhanced = false/);
  assert.match(
    loader,
    /hubState\.schoolVerificationEnhanced = enhanced && !response\.error/
  );
  assert.match(
    loader,
    /setupMissing:missingRpcError\(response\.error\)[\s\S]*?error:missingRpcError\(response\.error\) \? "" : schoolVerificationUserError\(response\.error\)/
  );
});
