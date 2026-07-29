import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

/*
 * Browser/source contract coverage.
 *
 * These checks do not claim that HKBU has authorized the connector or that a
 * live BUniPort page still matches the helper parser. That boundary requires
 * an institutional integration or a user-operated staging check.
 */

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const portalJs = readFileSync(new URL("../hkbu-portal.js", import.meta.url), "utf8");
const portalCss = readFileSync(new URL("../hkbu-portal.css", import.meta.url), "utf8");
const memberHubJs = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const catalogue = JSON.parse(
  readFileSync(
    new URL("../data/hkbu-2026-27-s1-catalog.json", import.meta.url),
    "utf8"
  )
);
const catalogueText = readFileSync(
  new URL("../data/hkbu-2026-27-s1-catalog.json", import.meta.url),
  "utf8"
);
const catalogueManifest = JSON.parse(
  readFileSync(
    new URL("../data/hkbu-catalogue-current.json", import.meta.url),
    "utf8"
  )
);

test("the Profile catalogue and optional planner adapter are loaded in dependency order", () => {
  assert.match(html, /href="hkbu-portal\.css\?v=/);
  const institutionPolicy = html.indexOf('<script src="institution-portal-policy.js');
  const engine = html.indexOf('<script src="course-catalog.js');
  const portal = html.indexOf('<script src="hkbu-portal.js');
  const academic = html.indexOf('<script src="academic-tools.js');
  assert.ok(institutionPolicy >= 0, "institution policy should be loaded");
  assert.ok(engine > institutionPolicy, "course engine should load after institution policy");
  assert.ok(portal > engine, "portal controller should load after the engine");
  assert.ok(academic > portal, "existing academic tools should still load after the portal");
  assert.match(html, /window\.ConCoursePlanner = Object\.assign/);
  assert.match(html, /function importCourseSelection\(/);
  assert.match(html, /source:\s*\{\s*kind:\s*"hkbu_portal_import"/);
});

test("personal imports are optional, consent-gated, and separate from catalogue access", () => {
  assert.match(portalJs, /officialSsoEnabled:false/);
  assert.match(portalJs, /personalImportEnabled:true/);
  assert.match(portalJs, /user_portal_import/);
  assert.match(portalJs, /concourse:hkbu-portal-snapshot/);
  assert.match(portalJs, /hkbuPortalPrivateConsent/);
  assert.match(portalJs, /hkbuPortalCatalogueConsent/);
  assert.match(portalJs, /id="hkbuPortalCourseSearch"/);
  assert.match(portalJs, /state\.allCandidates\.filter/);
  assert.match(
    portalJs,
    /state\.allCandidates\.filter\(candidate => state\.selected\.has\(candidateKey\(candidate\)\)\)/
  );
  assert.match(
    portalJs,
    /const catalogueMatches = loadedCatalogue && sameAcademicTerm\([\s\S]*?const catalogue = catalogueMatches \? loadedCatalogue : null/
  );
  assert.match(portalJs, /Verify your institution to see semester courses/);
  assert.match(portalJs, /\{school\} semester course catalogue/);
  assert.match(portalJs, /Student status verified for \{school\}/);
  assert.match(portalJs, /semester catalogue source is not configured for this institution yet/);
  assert.match(
    portalJs,
    /The shared semester catalogue works without access to your personal student portal/
  );
  assert.match(portalJs, /No personal academic snapshot has been imported/);
  assert.match(portalJs, /Open student portal \(optional\)/);
  assert.match(portalJs, /Remove imported academic data/);
  assert.match(portalJs, /User-imported · not independently verified/);
  assert.match(
    portalJs,
    /never asks for your institution password, multifactor-authentication response, recovery code, or portal cookies/
  );
  assert.doesNotMatch(
    portalJs,
    /Connect \{school\} student portal|Portal not connected|Portal snapshot imported|Disconnect the student portal/
  );
  assert.doesNotMatch(portalJs, /Connect HKBU Portal/);
  assert.doesNotMatch(portalJs, /never asks for your HKBU password/);
  assert.doesNotMatch(portalJs, /type\s*=\s*["']password["']/i);
  assert.doesNotMatch(portalJs, /document\.cookie|localStorage\.setItem\([^)]*snapshot/i);
  assert.match(portalJs, /`\$\{STATUS_KEY\}:\$\{userId\.slice\(0,\s*100\)\}`/);
  assert.match(
    portalJs,
    /function syncStatusForCurrentUser\(\)\{[\s\S]*?clearSnapshotState\(\)/
  );
  assert.match(portalCss, /\.hkbu-portal-trust-badge/);
});

test("verified institution identity is authoritative and catalogue/import gates are independent", () => {
  assert.match(
    memberHubJs,
    /verified\s*\?\s*String\(hubState\.membership\?\.school_name/
  );
  assert.match(
    memberHubJs,
    /verified\s*\?\s*String\(hubState\.membership\?\.school_key/
  );
  assert.match(memberHubJs, /getInstitutionContext,/);
  assert.match(memberHubJs, /concourse:institution-context/);
  assert.match(memberHubJs, /isVerified \? copy\.verifiedSchool : copy\.claimedSchool/);
  assert.match(
    memberHubJs,
    /copy\.verifiedFor\.replace\("\{school\}", membership\?\.school_name/
  );
  assert.doesNotMatch(memberHubJs, /Hong Kong Baptist University · Finance/);
  assert.doesNotMatch(memberHubJs, /HKBU Sustainability Society/);
  assert.match(
    portalJs,
    /supportedSchoolKeys:\["ror:0145fw131", "domain:hkbu\.edu\.hk", "domain:life\.hkbu\.edu\.hk"\]/
  );
  assert.match(
    portalJs,
    /context\.catalogueId === "hkbu" \? "verifiedTitle" : "unsupportedTitle"/
  );
  assert.match(portalJs, /return resolver\(raw, \{connectors:\[\]\}\)/);
  assert.match(portalJs, /const catalogueSupported = context\.catalogueId === "hkbu"/);
  assert.match(portalJs, /const importSupported = context\.importAdapterId === "hkbu"/);
  assert.match(portalJs, /browseButton\.hidden = !catalogueSupported/);
  assert.match(portalJs, /portalButton\.hidden = !importSupported/);
  assert.match(portalJs, /importButton\.hidden = !importSupported/);
  assert.match(portalJs, /helperButton\.hidden = !helperUrl/);
  assert.match(portalJs, /fileInput\.disabled = !importSupported/);
  assert.match(portalJs, /plannerPanel\.hidden = !catalogueSupported/);
  assert.match(
    portalJs,
    /async function processSnapshot[\s\S]*?institutionContext\(\)\.importAdapterId !== "hkbu"/
  );
  assert.match(
    portalJs,
    /async function persistSnapshot[\s\S]*?institutionContext\(\)\.importAdapterId !== "hkbu"/
  );
  assert.match(
    portalJs,
    /async function loadRemoteState[\s\S]*?institutionContext\(\)\.importAdapterId !== "hkbu"/
  );
  assert.match(
    memberHubJs,
    /if\(error\)\{[\s\S]*?hubState\.membership = null;/
  );
  assert.match(memberHubJs, /const isApprovalSyncPending = requestStatus === "approved" && !isVerified/);
  assert.match(memberHubJs, /isVerified \? " success"/);
});

test("the shared semester catalogue loads and renders without a personal snapshot", () => {
  assert.match(portalJs, /id="hkbuCatalogueBrowser"/);
  assert.match(portalJs, /id="hkbuCatalogueSearch"/);
  assert.match(portalJs, /id="hkbuCatalogueCourses"/);
  assert.match(
    portalJs,
    /if\(catalogueSupported && !state\.catalogue && !state\.catalogueAttempted\)\{\s*void loadCatalogue\(\)/
  );
  assert.match(
    portalJs,
    /if\(context\.catalogueId === "hkbu" && !state\.catalogue && !state\.catalogueAttempted\)\{\s*void loadCatalogue\(\)/
  );

  const catalogueRendererStart = portalJs.indexOf("function renderCatalogueBrowser(");
  const snapshotRendererStart = portalJs.indexOf("function renderSnapshotReview(", catalogueRendererStart);
  assert.ok(
    catalogueRendererStart >= 0 && snapshotRendererStart > catalogueRendererStart,
    "catalogue renderer should be independently extractable"
  );
  const catalogueRenderer = portalJs.slice(catalogueRendererStart, snapshotRendererStart);
  assert.match(catalogueRenderer, /state\.catalogue\.courses/);
  assert.match(catalogueRenderer, /hkbuCatalogueSearch/);
  assert.doesNotMatch(
    catalogueRenderer,
    /state\.snapshot/,
    "shared catalogue rendering must not require a personal snapshot"
  );
  assert.match(portalJs, /Reference snapshot only\. Confirm live availability, eligibility, quota, and registration/);
});

test("removing or mismatching a personal snapshot preserves the shared catalogue", () => {
  const clearStart = portalJs.indexOf("function clearSnapshotState(");
  const clearEnd = portalJs.indexOf("function syncStatusForCurrentUser(", clearStart);
  assert.ok(clearStart >= 0 && clearEnd > clearStart);
  const clearSnapshot = portalJs.slice(clearStart, clearEnd);
  assert.match(clearSnapshot, /state\.snapshot = null/);
  assert.doesNotMatch(clearSnapshot, /state\.catalogue\s*=/);
  assert.doesNotMatch(clearSnapshot, /state\.catalogueManifest\s*=/);

  const processStart = portalJs.indexOf("async function processSnapshot(");
  const importFileStart = portalJs.indexOf("async function importSnapshotFile(", processStart);
  assert.ok(processStart >= 0 && importFileStart > processStart);
  const processSnapshot = portalJs.slice(processStart, importFileStart);
  assert.match(processSnapshot, /const catalogue = catalogueMatches \? loadedCatalogue : null/);
  assert.match(processSnapshot, /setStatus\(text\("catalogueTermMismatch"\)\)/);
  assert.doesNotMatch(processSnapshot, /state\.catalogue\s*=\s*null/);
  assert.match(
    portalJs,
    /async function addSelectedToPlanner\(\)\{[\s\S]*?if\(!state\.catalogueTermMatches\)\{[\s\S]*?personalTermMismatch/
  );
  assert.match(
    portalJs,
    /addButton\.disabled = !state\.catalogueTermMatches/
  );

  const removeStart = portalJs.indexOf("async function disconnectPortal(");
  const remoteIdStart = portalJs.indexOf("function remoteUserId(", removeStart);
  assert.ok(removeStart >= 0 && remoteIdStart > removeStart);
  const removeImport = portalJs.slice(removeStart, remoteIdStart);
  assert.match(removeImport, /if\(state\.processing \|\| state\.privateMutation\)/);
  assert.match(removeImport, /const removalRequestId = \+\+state\.plannerImportRequestId/);
  assert.match(removeImport, /userId === remoteUserId\(\)/);
  assert.match(removeImport, /signature === institutionSignature\(\)/);
  assert.match(
    removeImport,
    /await authClient\.rpc\("disconnect_my_hkbu_portal"\);[\s\S]*?if\(!isCurrentRequest\(\)\) return/
  );
  assert.match(removeImport, /clearSnapshotState\(\)/);
  assert.doesNotMatch(removeImport, /state\.catalogue\s*=/);
  assert.match(portalJs, /shared semester catalogue remains available/i);
});

test("personalized suggestions are limited to assigned and remaining-requirement matches", () => {
  assert.match(portalJs, /personalTitle:"Assigned courses and possible requirement matches"/);
  assert.match(portalJs, /possible:"Possible requirement matches"/);
  assert.match(
    portalJs,
    /const requirementReasonCodes = new Set\(\[\s*"REMAINING_REQUIREMENT_COURSE_MATCH",\s*"REMAINING_REQUIREMENT_TEXT_MATCH"\s*\]\)/
  );
  assert.match(
    portalJs,
    /const requirementMatches = recommendations\.filter\(candidate => \{[\s\S]*?reasons\.some\(reason => requirementReasonCodes\.has\(reason\)\)/
  );
  assert.match(portalJs, /state\.allCandidates = requirementMatches/);
  assert.doesNotMatch(
    portalJs,
    /Possible electives|Search eligible courses|OPEN_ELECTIVE_ELIGIBLE|REMAINING_REQUIREMENT_CATEGORY_MATCH/
  );
});

test("planner normalization rejects unusable meetings and bounds imported data", () => {
  const normalizerStart = html.indexOf("function normalizeImportedPlannerCourse(");
  const importerStart = html.indexOf("function importCourseSelection(", normalizerStart);
  assert.ok(normalizerStart >= 0 && importerStart > normalizerStart);
  const normalizer = html.slice(normalizerStart, importerStart);
  assert.match(normalizer, /\.slice\(0,\s*24\)/);
  assert.match(normalizer, /\.slice\(0,\s*6\)/);
  assert.match(normalizer, /day >= 1 && day <= 6/);
  assert.match(normalizer, /end <= start/);
  assert.match(normalizer, /if\(!options\.length\) return null/);
  assert.match(html, /Array\.isArray\(values\) \? values\.slice\(0,\s*60\)/);
  assert.match(html, /retainedCapacity = Math\.max\(0,\s*60 - normalized\.length\)/);
});

test("planner normalization converts a bounded portal candidate into the live planner shape", () => {
  const normalizerStart = html.indexOf("function normalizeImportedPlannerCourse(");
  const importerStart = html.indexOf("function importCourseSelection(", normalizerStart);
  const context = {uid:() => "fixture-id", result:null};
  vm.runInNewContext(
    `${html.slice(normalizerStart, importerStart)}
     result = normalizeImportedPlannerCourse({
       course_code:"acct1005",
       title:" Principles of Accounting I ",
       units:3,
       assignment:"assigned",
       options:[
         {section:"00001", sessions:[{days:[5, 5], start:"12:30", end:"15:20"}]},
         {section:"broken", sessions:[{days:[0], start:"15:20", end:"12:30"}]}
       ],
       source:{term:"Semester 1 2026-27", captured_at:"2026-07-28T10:00:00+08:00"}
     }, 0);`,
    context
  );
  assert.equal(context.result.code, "ACCT1005");
  assert.equal(context.result.required, true);
  assert.equal(context.result.options.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.result.options[0].sessions[0])),
    {days:[5], start:750, end:920, venue:null}
  );
  assert.equal(context.result.source.kind, "hkbu_portal_import");
});

test("the bundled catalogue is labelled as a point-in-time reference snapshot", () => {
  assert.equal(catalogue.schema_version, 1);
  assert.equal(catalogue.institution, "hkbu");
  assert.equal(catalogue.publication_status, "reference_only");
  assert.ok(Array.isArray(catalogue.caveats) && catalogue.caveats.length >= 3);
  assert.equal(catalogue.counts.courses, catalogue.courses.length);
  assert.equal(
    catalogue.counts.sections,
    catalogue.courses.reduce(
      (total, course) => total + (Array.isArray(course.sections) ? course.sections.length : 0),
      0
    )
  );
  assert.ok(catalogue.courses.length > 1000);
  for(const course of catalogue.courses){
    assert.match(course.course_code, /^[A-Z0-9]/);
    assert.ok(course.title);
    for(const section of course.sections){
      assert.equal(section.quota_scope, "unknown");
    }
  }
});

test("the current-catalogue manifest selects and fingerprints the versioned artifact", () => {
  assert.equal(catalogueManifest.schema_version, 1);
  assert.equal(catalogueManifest.institution, "hkbu");
  assert.equal(catalogueManifest.term, catalogue.term);
  assert.equal(catalogueManifest.publication_status, "reference_only");
  assert.equal(catalogueManifest.publication_status, catalogue.publication_status);
  assert.equal(catalogueManifest.course_count, catalogue.counts.courses);
  assert.equal(catalogueManifest.section_count, catalogue.counts.sections);
  assert.equal(
    catalogueManifest.content_sha256,
    createHash("sha256").update(catalogueText).digest("hex")
  );
  assert.match(portalJs, /resolveCatalogueUrl/);
  assert.match(portalJs, /Catalogue checksum does not match the published manifest/);
  assert.match(
    portalJs,
    /value\?\.publication_status !== manifest\.publication_status/
  );
  assert.match(
    portalJs,
    /Catalogue publication status does not match the published manifest/
  );
  assert.match(portalJs, /Catalogue publication status is not allowed/);
  assert.match(portalJs, /id="hkbuCatalogueRetry"/);
  assert.match(portalJs, /resolved\.origin === location\.origin/);
});

test("private remote loads are discarded after an account or institution change", () => {
  const remoteStart = portalJs.indexOf("async function loadRemoteState(");
  const syncStart = portalJs.indexOf("function syncInstitutionContext(", remoteStart);
  assert.ok(remoteStart >= 0 && syncStart > remoteStart);
  const remoteLoader = portalJs.slice(remoteStart, syncStart);
  assert.match(remoteLoader, /const requestId = \+\+state\.remoteRequestId/);
  assert.match(remoteLoader, /userId === remoteUserId\(\)/);
  assert.match(remoteLoader, /signature === institutionSignature\(\)/);
  assert.match(remoteLoader, /if\(!isCurrentRequest\(\)\) return/);
  assert.match(remoteLoader, /expectedUserId:userId/);
  assert.match(remoteLoader, /expectedInstitutionSignature:signature/);
  assert.match(
    portalJs,
    /function syncStatusForCurrentUser\(\)\{[\s\S]*?state\.remoteRequestId \+= 1;[\s\S]*?clearSnapshotState\(\)/
  );
});

test("a successful catalogue retry re-evaluates an existing private snapshot", () => {
  assert.match(portalJs, /id="hkbuCatalogueRetry"/);
  assert.match(
    portalJs,
    /const snapshotToReconcile = requestId === state\.catalogueRequestId[\s\S]*?&& state\.snapshot[\s\S]*?&& !state\.catalogueTermMatches[\s\S]*?&& !state\.processing[\s\S]*?&& !state\.privateMutation/
  );
  assert.match(
    portalJs,
    /if\(snapshotToReconcile\)\{[\s\S]*?processSnapshot\(snapshotToReconcile,[\s\S]*?expectedInstitutionSignature:reconcileSignature/
  );
});

test("the catalogue artifact contains no student identity or session fields", () => {
  const serialized = JSON.stringify(catalogue);
  for(const forbiddenKey of [
    "student_number",
    "student_id",
    "legal_name",
    "email_address",
    "password",
    "cookie",
    "access_token",
    "refresh_token",
    "raw_html"
  ]){
    assert.doesNotMatch(
      serialized,
      new RegExp(`"${forbiddenKey}"\\s*:`, "i"),
      `catalogue should not contain ${forbiddenKey}`
    );
  }
});
