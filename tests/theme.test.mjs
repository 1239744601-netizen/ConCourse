import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../concourse-theme.css", import.meta.url), "utf8");
const dayMark = readFileSync(new URL("../concourse-icon.svg", import.meta.url), "utf8");

test("appearance choice is applied before styles render and persists locally", () => {
  const bootstrap = html.indexOf('localStorage.getItem("concourse_theme")');
  const firstStylesheet = html.indexOf('<link rel="stylesheet"');

  assert.ok(bootstrap > -1, "theme bootstrap should exist");
  assert.ok(bootstrap < firstStylesheet, "theme bootstrap should run before external styles");
  assert.match(html, /savedTheme === "day" \|\| savedTheme === "night"/);
  assert.match(html, /localStorage\.setItem\("concourse_theme", nextTheme\)/);
  assert.match(html, /themeColor\.content = nextTheme === "day" \? "#dff2ff" : "#061526"/);
});

test("day and night controls are accessible and translated", () => {
  assert.match(html, /class="theme-control"[^>]*role="group"[^>]*data-i18n-aria-label="appearance"/);
  assert.match(html, /id="dayThemeBtn"[^>]*data-theme-value="day"[^>]*aria-pressed="false"/);
  assert.match(html, /id="nightThemeBtn"[^>]*data-theme-value="night"[^>]*aria-pressed="true"/);
  assert.equal((html.match(/dayMode:/g) || []).length, 3);
  assert.equal((html.match(/nightMode:/g) || []).length, 3);
  assert.match(html, /initializeTheme\(\);\s*initializeLanguage\(\);/);
});

test("the final theme layer covers every major ConCourse destination", () => {
  const themeLink = html.indexOf('href="concourse-theme.css');
  const academicLink = html.indexOf('href="academic-tools.css');

  assert.ok(themeLink > academicLink, "theme stylesheet should be the final external visual layer");
  for(const selector of [
    'body:not(.app-active) #landingScreen',
    'body.app-active:not(.schedule-active):not(.hub-active)',
    'body.schedule-active',
    '.member-hub',
    '[data-active-view="marketplace"]',
    '.academic-tools-view'
  ]){
    assert.ok(css.includes(selector), `Day theme should cover ${selector}`);
  }
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /@media print/);
});

test("Day mode uses the navy ConCourse mark while Night keeps the ivory mark", () => {
  assert.match(html, /class="brand-mark-image brand-mark-night"[^>]+concourse-mark\.svg/);
  assert.match(html, /class="brand-mark-image brand-mark-day"[^>]+concourse-icon\.svg/);
  assert.match(dayMark, /#061A30/i);
  assert.match(css, /html\[data-theme="day"\] \.brand-mark-night\s*\{\s*display:\s*none/);
  assert.match(css, /html\[data-theme="day"\] \.brand-mark-day\s*\{\s*display:\s*block/);
});

test("Day contrast lock covers Hub rails, controls, market, and citation surfaces", () => {
  for(const selector of [
    ".hub-rail-profile-row b",
    ".hub-conversation-preview-button b",
    ".hub-filter-row select",
    ".market-scope-button",
    ".citation-field > :is(span, label)",
    ".citation-library-entry",
    ".citation-style-compass > h2",
    ".hub-profile-preview"
  ]){
    assert.ok(css.includes(selector), `Day contrast layer should cover ${selector}`);
  }

  assert.match(css, /#chatMessageInput::placeholder[\s\S]*-webkit-text-fill-color:\s*var\(--day-muted\)/);
});

test("English community search never exposes its translation key", () => {
  assert.match(html, /searchCommunity:"Search recent campus conversations"/);
  assert.match(html, /searchAcrossCampuses:"Search posts, universities and topics worldwide"/);
});
