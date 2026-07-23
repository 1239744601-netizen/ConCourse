import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../concourse-theme.css", import.meta.url), "utf8");
const artCss = readFileSync(new URL("../concourse-art.css", import.meta.url), "utf8");
const memberHubJs = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const academicToolsJs = readFileSync(new URL("../academic-tools.js", import.meta.url), "utf8");
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

test("the theme and Atlas layers cover every major ConCourse destination", () => {
  const themeLink = html.indexOf('href="concourse-theme.css');
  const artLink = html.indexOf('href="concourse-art.css');
  const academicLink = html.indexOf('href="academic-tools.css');

  assert.ok(themeLink > academicLink, "theme stylesheet should follow feature styles");
  assert.ok(artLink > themeLink, "Atlas stylesheet should be the final external visual layer");
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

test("each Hub destination has one original artwork and one visible-image rule", () => {
  const artworkMap = {
    community: "concourse-art-community.jpg",
    marketplace: "concourse-art-market.jpg",
    messages: "concourse-art-messages.jpg",
    overview: "concourse-art-insights.jpg",
    "academic-tools": "concourse-art-citations.jpg",
    profile: "concourse-art-profile.jpg"
  };

  for(const [destination, filename] of Object.entries(artworkMap)){
    assert.match(
      html,
      new RegExp(`src="${filename.replace(".", "\\.")}"[^>]+data-hub-hero="${destination}"`),
      `${destination} should use ${filename}`
    );
    assert.match(
      artCss,
      new RegExp(`data-active-view="${destination}"[^}]+data-hub-hero="${destination}"`),
      `${destination} should have an explicit visible-image rule`
    );
  }

  assert.match(artCss, /background-image:\s*none\s*!important/);
  assert.match(artCss, /overflow:\s*hidden\s*!important/);
  assert.match(artCss, /-webkit-mask-image:\s*none\s*!important/);
});

test("planner, timetable, and authentication use restrained Atlas artwork fields", () => {
  for(const filename of [
    "concourse-art-planner.jpg",
    "concourse-art-timetable.jpg",
    "concourse-art-auth.jpg"
  ]){
    assert.ok(artCss.includes(filename), `${filename} should be used by the final art layer`);
  }

  assert.match(artCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(artCss, /@media \(max-width: 1120px\)/);
  assert.match(artCss, /overflow-x:\s*clip/);
});

test("Atlas navigation uses a single active indicator without filled Day tabs", () => {
  assert.match(
    artCss,
    /html\[data-theme="day"\] \.member-hub \.hub-nav-button\.active[\s\S]*?background:\s*transparent\s*!important[\s\S]*?box-shadow:\s*none\s*!important/
  );
  assert.match(
    artCss,
    /\.member-hub\[data-active-view="marketplace"\] \.market-mode-tabs > button[\s\S]*?flex:\s*0 0 auto\s*!important/
  );
  assert.match(artCss, /linear-gradient\(90deg,\s*var\(--atlas-cobalt\),\s*var\(--atlas-cyan\)/);
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

test("Hub geometry stays identical when translated", () => {
  assert.match(
    artCss,
    /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)\s*!important/
  );
  assert.match(artCss, /min-height:\s*clamp\(132px,\s*12vw,\s*164px\)\s*!important/);
  assert.match(
    artCss,
    /\.member-hub \.hub-hero-art,[\s\S]*?position:\s*absolute\s*!important[\s\S]*?bottom:\s*-74px\s*!important/
  );
  assert.match(artCss, /html\[lang\^="zh"\] \.member-hub \.hub-nav-button b/);
  assert.match(memberHubJs, /const headingKey = view === "community"/);
  assert.match(memberHubJs, /\$\("hubGreeting"\)\.textContent = t\(headingKey\)/);
  assert.match(
    html,
    /hubCommunity:"Campus community",\s*hubMarketplace:"Campus market",\s*hubMessages:"Messages",\s*hubAcademicTools:"Academic tools",\s*hubInsights:"Academic insights",\s*hubProfile:"Profile"/
  );
  assert.doesNotMatch(html, /id="hubMarketplaceActions"/);
  assert.doesNotMatch(html, /VISUAL_QA_HARNESS/);
});

test("functional content begins directly beneath compact artwork headers", () => {
  assert.match(
    artCss,
    /\.member-hub\[data-active-view="academic-tools"\] \.academic-tools-view\s*\{[\s\S]*?padding-top:\s*8px\s*!important/
  );
  assert.match(
    artCss,
    /\.member-hub\[data-active-view="academic-tools"\] \.academic-tools-intro h2\s*\{[\s\S]*?font-size:\s*clamp\(28px,\s*3\.2vw,\s*42px\)/
  );
  assert.match(
    artCss,
    /\.member-hub\[data-active-view="marketplace"\] \.market-discovery-bar\s*\{[\s\S]*?position:\s*sticky\s*!important[\s\S]*?top:\s*calc\(var\(--app-bar-offset\) \+ 8px\)\s*!important/
  );
  assert.match(
    artCss,
    /@media \(max-width:\s*900px\)[\s\S]*?\.member-hub\[data-active-view="marketplace"\] \.market-discovery-bar\s*\{[\s\S]*?position:\s*static\s*!important[\s\S]*?top:\s*auto\s*!important/
  );
});

test("Chinese copy distinguishes saving from bookmarking and uses academic terminology", () => {
  assert.match(html, /Object\.assign\(TRANSLATIONS\["zh-CN"\]/);
  assert.match(html, /Object\.assign\(TRANSLATIONS\["zh-HK"\]/);
  assert.match(html, /saved:"已保存",\s*postSaved:"已收藏"/);
  assert.match(html, /saved:"已儲存",\s*postSaved:"已收藏"/);
  assert.equal((memberHubJs.match(/t\("postSaved"\)/g) || []).length, 2);
  assert.match(academicToolsJs, /toolsWorkspaceTitle:"参考文献工作室"/);
  assert.match(academicToolsJs, /toolsWorkspaceTitle:"參考文獻工作室"/);
  assert.match(academicToolsJs, /citationCopy:"复制参考文献"/);
  assert.match(academicToolsJs, /citationCopy:"複製參考文獻"/);
});
