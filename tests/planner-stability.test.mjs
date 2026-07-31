import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../concourse-stabilization.css", import.meta.url), "utf8");
const headers = readFileSync(new URL("../_headers", import.meta.url), "utf8");

test("the planner search is bounded and never presents an incomplete ranking", () => {
  assert.match(html, /const MAX_SEARCH_NODES = 400000;/);
  assert.match(html, /const SEARCH_TIME_BUDGET_MS = 850;/);
  assert.match(html, /performance\.now\(\) - searchStartedAt > SEARCH_TIME_BUDGET_MS/);
  assert.match(html, /if\(resultsTruncated\)\{\s*solutions = \[\];\s*renderSearchLimit/);
});

test("the sample demonstrates a complete 21-credit semester without stale criteria", () => {
  const sampleStart = html.indexOf('$("loadSample").addEventListener("click"');
  const sampleEnd = html.indexOf('$("clearAll").addEventListener("click"', sampleStart);
  assert.ok(sampleStart > 0 && sampleEnd > sampleStart);
  const sample = html.slice(sampleStart, sampleEnd);
  assert.equal((sample.match(/credits:3/g) || []).length, 7);
  assert.match(sample, /\$\("degreeLevel"\)\.value = "bachelor"/);
  assert.match(sample, /\$\("studyYear"\)\.value = "3"/);
  assert.match(sample, /\$\("minCredits"\)\.value = "21"/);
  assert.match(sample, /\$\("maxCredits"\)\.value = "21"/);
});

test("saving the final schedule reports analytics synchronization failures", () => {
  assert.match(html, /finalTimetableSyncComplete:/);
  assert.match(html, /finalTimetableSyncFailed:/);
  assert.match(html, /showSiteNotice\(t\("finalTimetableSyncFailed"\), \{error:true/);
  assert.match(html, /showSiteNotice\(t\("finalTimetableSyncComplete"\)\)/);
  assert.match(html, /showSiteNotice\(t\("stateSaveFailed"\), \{error:true/);
  assert.match(html, /showSiteNotice\(t\("stateLoadFailed"\), \{error:true/);
});

test("planner validation and conflict guidance are available in all languages", () => {
  for(const key of [
    "semesterCreditsRequired",
    "creditRangeConflict",
    "courseCountConflict",
    "noScheduleTitle",
    "searchTooBroadTitle"
  ]){
    assert.equal((html.match(new RegExp(`${key}:`, "g")) || []).length, 3, `${key} should have three translations`);
  }
});

test("the final stabilization stylesheet owns focus, compact viewport, and header overlap fixes", () => {
  assert.ok(
    html.lastIndexOf("concourse-stabilization.css") > html.lastIndexOf("academic-experiences.css"),
    "stabilization styles should load after every feature stylesheet"
  );
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 1380px\) and \(min-width: 761px\)/);
  assert.match(css, /grid-template-areas:\s*"brand nav utility"/);
  assert.match(css, /row-gap:\s*0 !important/);
  assert.doesNotMatch(css, /"brand utility"\s*"nav nav"/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("the Cloudflare deployment applies baseline browser security headers", () => {
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Permissions-Policy:/);
  assert.match(headers, /Strict-Transport-Security:/);
});
