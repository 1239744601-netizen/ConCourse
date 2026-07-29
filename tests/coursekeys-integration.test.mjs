import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("adds CourseKeys to the signed-in ConCourse primary navigation", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /id="courseKeysNav"[^>]+href="coursekeys\/"[^>]+data-i18n="courseKeysNav"/,
  );
  assert.match(index, /courseKeysNav:"CourseKeys"/);
  assert.match(index, /courseKeysNav:"课程资源库"/);
  assert.match(index, /courseKeysNav:"課程資源庫"/);
  assert.match(index, /courseKeysLink\.hidden = !signedIn/);
});

test("integrates a same-theme, accessible /coursekeys page", async () => {
  const [html, css, script] = await Promise.all([
    read("coursekeys/index.html"),
    read("coursekeys/coursekeys.css"),
    read("coursekeys/coursekeys.js"),
  ]);

  assert.match(html, /<title>CourseKeys · ConCourse<\/title>/);
  assert.match(html, /href="\.\.\/"/);
  assert.match(html, /href="\.\/" aria-current="page">CourseKeys/);
  assert.match(html, /id="coursekeysLibrary"/);
  assert.match(html, /id="languageSelect"/);
  assert.match(html, /data-theme-value="day"/);
  assert.match(html, /data-theme-value="night"/);
  assert.match(css, /--navy-950:\s*#03101e/);
  assert.match(css, /html\[data-theme="day"\]/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(`${html}\n${script}`, /localStorage\.getItem\("concourse_theme"\)/);
  assert.match(script, /localStorage\.getItem\("concourse_language"\)/);
});

test("retains the approved source-aware CourseKeys catalogue and aggregate-only audit", async () => {
  const [catalogue, audit] = await Promise.all([
    read("coursekeys/data/course-catalogue.json").then(JSON.parse),
    read("coursekeys/data/course-material-seed.json").then(JSON.parse),
  ]);

  assert.equal(catalogue.version, 1);
  assert.equal(catalogue.courses.length, 2174);
  assert.equal(
    new Set(
      catalogue.courses.map(
        (course) => `${course.institutionId}:${course.sourceCourseId}`,
      ),
    ).size,
    catalogue.courses.length,
  );

  assert.equal(audit.scope.courseFolderCount, 25);
  assert.equal(audit.scope.inventoryCount, 839);
  assert.equal(audit.scope.publishedFileCount, 0);
  assert.equal(audit.policy.storage, "metadata_only");
  assert.equal(audit.policy.sourceFilesCopied, false);
  assert.equal(audit.policy.absolutePathsStored, false);
  assert.equal("courses" in audit, false);
  assert.doesNotMatch(
    JSON.stringify(audit),
    /(?:\/Users\/|\/home\/|file:\/\/|[A-Za-z]:[\\/])/,
  );
});

test("retains D1 metadata and a private R2 quarantine binding without live identifiers", async () => {
  const [migration, bindings, readme] = await Promise.all([
    read("coursekeys/cloudflare/migrations/0001_coursekeys_metadata.sql"),
    read("coursekeys/cloudflare/bindings.example.json").then(JSON.parse),
    read("coursekeys/cloudflare/README.md"),
  ]);

  assert.match(migration, /CREATE TABLE `coursekeys_resources`/);
  assert.match(migration, /`storage_key` text NOT NULL/);
  assert.match(migration, /`status` text DEFAULT 'quarantined'/);
  assert.match(migration, /`scan_status` text DEFAULT 'pending'/);
  assert.match(migration, /`moderation_status` text DEFAULT 'not_requested'/);
  assert.match(migration, /DO NOT APPLY THIS MIGRATION TO SUPABASE/);
  assert.equal(bindings.d1.binding, "DB");
  assert.equal(bindings.r2.binding, "COURSE_MATERIALS");
  assert.equal(bindings.r2.public_access, false);
  assert.equal(bindings.r2.r2_dev_domain, false);
  assert.deepEqual(bindings.r2.custom_domains, []);
  assert.doesNotMatch(JSON.stringify(bindings), /[0-9a-f]{32}/i);
  assert.match(readme, /Keep the R2 `r2\.dev`\s+domain disabled/);
});

test("keeps uploads, publication, downloads, and CourseKeys transactions fail closed", async () => {
  const [pageScript, functionSource] = await Promise.all([
    read("coursekeys/coursekeys.js"),
    read("functions/api/coursekeys/resources.js"),
  ]);
  const functionFiles = await readdir(
    new URL("../functions/api/coursekeys/", import.meta.url),
  );

  assert.match(
    pageScript,
    /const COURSEKEYS_CAPABILITIES = Object\.freeze\(\{\s*uploads: false,\s*publishing: false,\s*downloads: false,\s*transactions: false,/s,
  );
  assert.match(functionSource, /const INTEGRATION_LOCKED = true/);
  assert.match(functionSource, /uploads: false/);
  assert.match(functionSource, /publishing: false/);
  assert.match(functionSource, /downloads: false/);
  assert.match(functionSource, /transactions: false/);
  assert.match(functionSource, /export async function onRequestPost\(\)/);
  assert.match(functionSource, /503/);
  assert.doesNotMatch(functionSource, /oai-authenticated-user-email/i);
  assert.doesNotMatch(functionSource, /COURSE_MATERIALS\s*\.\s*(?:get|put|createMultipartUpload)\s*\(/);
  assert.doesNotMatch(functionSource, /\b(?:publicUrl|downloadUrl|presignedUrl|signedUrl)\b/i);
  assert.deepEqual(functionFiles.sort(), ["resources.js"]);

  const route = await import(
    `data:text/javascript;base64,${Buffer.from(functionSource).toString("base64")}`
  );
  const statusResponse = await route.onRequestGet({
    env: {
      COURSEKEYS_SECURE_AUTH_READY: "true",
      COURSEKEYS_VERIFICATION_READY: "true",
      COURSEKEYS_SCANNING_READY: "true",
      COURSEKEYS_MODERATION_READY: "true",
      COURSEKEYS_QUOTAS_READY: "true",
      COURSEKEYS_DELETION_READY: "true",
      COURSEKEYS_LEDGER_READY: "true",
    },
  });
  const status = await statusResponse.json();
  assert.equal(statusResponse.headers.get("cache-control"), "private, no-store");
  assert.equal(status.integrationLocked, true);
  assert.deepEqual(
    {
      uploads: status.capabilities.uploads,
      publishing: status.capabilities.publishing,
      downloads: status.capabilities.downloads,
      transactions: status.capabilities.transactions,
    },
    {
      uploads: false,
      publishing: false,
      downloads: false,
      transactions: false,
    },
  );

  const postResponse = await route.onRequestPost();
  assert.equal(postResponse.status, 503);
});

test("does not expose download, exchange, purchase, or transaction actions in CourseKeys", async () => {
  const [html, script] = await Promise.all([
    read("coursekeys/index.html"),
    read("coursekeys/coursekeys.js"),
  ]);
  const source = `${html}\n${script}`;

  assert.match(source, /Transactions Disabled/);
  assert.match(source, /Uploads Disabled/);
  assert.match(source, /No Public File/);
  assert.doesNotMatch(
    source,
    /href=["'][^"']*(?:download|purchase|transaction|exchange)[^"']*["']/i,
  );
  assert.doesNotMatch(
    source,
    /fetch\(["'][^"']*\/api\/coursekeys\/(?:download|purchase|transaction|exchange)/i,
  );
});
