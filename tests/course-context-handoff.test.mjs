import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hubJs = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const marketplaceJs = readFileSync(new URL("../marketplace.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function sourceBetween(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Hub view activation is awaitable and preserves its signed-in state gate", () => {
  const showHub = sourceBetween(
    hubJs,
    'async function showHub(view="community"){',
    "\n  async function switchView(view){"
  );
  const switchView = sourceBetween(
    hubJs,
    "async function switchView(view){",
    "\n  function communityComposerHasDraft(){"
  );

  assert.match(showHub, /if\(!hubAccessAllowed\(\)\)/);
  assert.match(showHub, /return false/);
  assert.match(showHub, /const activeView = await switchView\(view\)/);
  assert.match(showHub, /return activeView/);
  assert.match(switchView, /return view/);
  assert.match(hubJs, /switchView,\s*openCourseCommunity,/);
  const accessGate = sourceBetween(
    hubJs,
    "const hubAccessAllowed = () =>",
    ";\n  const requestContext"
  );
  assert.match(accessGate, /currentUser/);
  assert.match(accessGate, /loadedUserId === currentUser\.id/);
  assert.doesNotMatch(accessGate, /finalTimetable/);
});

test("Root resolves allowlisted course routes before opening Timetable, Community, or Marketplace", () => {
  const selectionRouter = sourceBetween(
    indexHtml,
    "function consumeCourseSelectionHandoff(){",
    "\nfunction readCourseContextRoute"
  );
  const routeReader = sourceBetween(
    indexHtml,
    "function readCourseContextRoute(){",
    "\nfunction clearCourseContextRoute"
  );
  const router = sourceBetween(
    indexHtml,
    "async function consumeCourseContextRoute(){",
    "\nfunction normalizeImportedPlannerCourse"
  );

  assert.match(indexHtml, /const COURSE_CONTEXT_DESTINATIONS = Object\.freeze\(\{/);
  assert.match(indexHtml, /timetable: new Set\(\["add-course"\]\)/);
  assert.match(indexHtml, /community: new Set\(\["search", "compose"\]\)/);
  assert.match(indexHtml, /marketplace: new Set\(\["search", "sell"\]\)/);
  assert.match(selectionRouter, /\|\| readCourseContextRoute\(\)\s*\) return;/u);
  assert.match(
    selectionRouter,
    /hasAuthCallbackLocation\(navigationLocation\)[\s\S]*?hasContentDeepLink\(navigationLocation\.hash\)/u
  );
  assert.match(routeReader, /hasCourseHandoffLocation\(\{search:url\.search\}\)/u);
  assert.match(
    router,
    /hasAuthCallbackLocation\(navigationLocation\)[\s\S]*?hasContentDeepLink\(navigationLocation\.hash\)[\s\S]*?\) return false;/u
  );
  assert.match(router, /await resolveCourseContext\(route\.courseKey\)/);
  assert.match(router, /stageCourseContextForTimetable\(resolved\.group\)/);
  assert.match(router, /openCourseCommunity/);
  assert.match(router, /openCourseSearch/);
  assert.match(router, /openCreateForCourse/);
  assert.match(
    router,
    /if\(!resolved\)\{[\s\S]*?clearCourseContextRoute\(\);\s*showPlannerEditor\(\);\s*return false;/u
  );
  assert.match(
    router,
    /if\(!opened\)\{[\s\S]*?showSiteNotice[\s\S]*?showPlannerEditor\(\);/u
  );
  assert.match(
    router,
    /catch\(error\) \{[\s\S]*?clearCourseContextRoute\(\);\s*showPlannerEditor\(\);\s*return false;/u
  );
  assert.doesNotMatch(router, /url\.searchParams\.get\("code"\)/);
});

test("Community course handoff searches the exact normalized code and never publishes", () => {
  const handoff = sourceBetween(
    hubJs,
    'async function openCourseCommunity({intent="search", course}={}){',
    "\n  function messageViewIsActive(){"
  );

  assert.match(handoff, /const activeView = await showHub\("community"\)/);
  assert.match(handoff, /hubState\.feedTopic = "all"/);
  assert.match(handoff, /hubState\.feedQuery = context\.code/);
  assert.match(handoff, /\$\("communitySearch"\)\.value = context\.code/);
  assert.doesNotMatch(handoff, /publishCommunityPost|publish_community_post/);
});

test("Community compose handoff preserves every non-empty draft surface", () => {
  const draftCheck = sourceBetween(
    hubJs,
    "function communityComposerHasDraft(){",
    '\n  async function openCourseCommunity({intent="search", course}={}){'
  );
  const handoff = sourceBetween(
    hubJs,
    'async function openCourseCommunity({intent="search", course}={}){',
    "\n  function messageViewIsActive(){"
  );

  assert.match(draftCheck, /communityPostBody/);
  assert.match(draftCheck, /communityPostTags/);
  assert.match(draftCheck, /communityCrossCampus/);
  assert.match(draftCheck, /hubState\.composerMedia\.length/);
  assert.match(draftCheck, /communityPollOptions/);
  assert.match(draftCheck, /selectedCommunityListingId/);
  assert.match(handoff, /if\(body && tags && !communityComposerHasDraft\(\)\)/);
  assert.match(handoff, /tags\.value = context\.code/);
  assert.match(handoff, /body\?\.focus\(\{preventScroll:true\}\)/);
});

test("Marketplace course search uses Discover with the exact normalized code", () => {
  const search = sourceBetween(
    marketplaceJs,
    "async function openCourseSearch({course}={}){",
    "\n  async function openCreateForCourse({course}={}){"
  );

  assert.match(search, /const activeView = await hub\(\)\.show\("marketplace"\)/);
  assert.match(search, /state\.query = context\.code/);
  assert.match(search, /marketplaceSearch"\)\.value = context\.code/);
  assert.match(search, /await setMode\("discover"\)/);
  assert.doesNotMatch(search, /submitEditor|create_marketplace_listing|update_marketplace_listing/);
});

test("Marketplace course creation keeps defaults separate from edit state", () => {
  const editor = sourceBetween(
    marketplaceJs,
    "async function openListingEditor(",
    "\n  function closeEditor("
  );
  const create = sourceBetween(
    marketplaceJs,
    "async function openCreateForCourse({course}={}){",
    "\n  function refreshLanguage(){"
  );

  assert.match(editor, /\{creationDefaults=null\}/);
  assert.match(editor, /state\.editorListing = fullListing/);
  assert.match(editor, /if\(!fullListing\) fillCreationDefaults\(creationDefaults\)/);
  assert.match(create, /if\(state\.scope !== "campus"\) await setScope\("campus"\)/);
  assert.match(create, /openListingEditor\(\s*null,/);
  assert.match(create, /creationDefaults:\{course_code:context\.code\}/);
  assert.doesNotMatch(create, /marketplaceRightsInput|submitEditor|create_marketplace_listing/);
  assert.match(marketplaceJs, /openListing,\s*openCourseSearch,\s*openCreateForCourse/);
});
