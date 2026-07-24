import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../academic-experiences.css", import.meta.url), "utf8");
const tools = readFileSync(new URL("../academic-tools.js", import.meta.url), "utf8");
const hub = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const marketplace = readFileSync(new URL("../marketplace.js", import.meta.url), "utf8");

function sourceSection(source, start, end){
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

function cssRule(source, selector){
  const standaloneSelector = `${selector} {`;
  const standaloneIndex = source.indexOf(standaloneSelector);
  const selectorIndex = standaloneIndex >= 0 ? standaloneIndex : source.indexOf(selector);
  assert.ok(selectorIndex >= 0, `Expected CSS selector: ${selector}`);
  const openIndex = source.indexOf("{", selectorIndex + selector.length);
  const closeIndex = source.indexOf("}", openIndex + 1);
  assert.ok(openIndex > selectorIndex && closeIndex > openIndex, `Expected CSS rule for: ${selector}`);
  return source.slice(selectorIndex, closeIndex + 1);
}

test("the night Market search uses a white caret without changing Day mode", () => {
  assert.match(
    css,
    /html\[data-theme="night"\][\s\S]*?data-active-view="marketplace"[\s\S]*?#marketplaceSearch\s*\{[\s\S]*?caret-color:\s*#fff\s*!important/
  );
  assert.doesNotMatch(css, /html\[data-theme="day"\][\s\S]{0,180}#marketplaceSearch[\s\S]{0,120}caret-color/u);
});

test("Academic artwork movement is object-level, scoped and reduced-motion safe", () => {
  assert.match(css, /data-active-view="academic-tools"[\s\S]*?academic-index-wheel/);
  assert.match(html, /src="concourse-art-insights-v3\.jpg"[^>]+data-hub-hero="overview"/);
  assert.doesNotMatch(html, /src="concourse-art-insights-v2\.jpg"[^>]+data-hub-hero="overview"/);

  const overviewImage = cssRule(css, '.hub-hero-art img[data-hub-hero="overview"]');
  assert.match(overviewImage, /transform:\s*none\s*!important/);
  assert.match(overviewImage, /animation:\s*none\s*!important/);

  const rotor = cssRule(
    css,
    '.member-hub[data-active-view="overview"] .hub-art-fragment-primary'
  );
  assert.match(rotor, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(rotor, /border-radius:\s*50%\s*!important/);
  assert.match(rotor, /clip-path:\s*none\s*!important/);
  assert.match(rotor, /animation:\s*none\s*!important/);

  const needle = cssRule(
    css,
    '.member-hub[data-active-view="overview"] .hub-art-fragment-primary::before'
  );
  assert.match(needle, /transform-origin:\s*0 50%/);
  assert.match(needle, /animation:\s*academic-insight-needle/);
  assert.match(css, /@keyframes academic-insight-needle/);
  assert.doesNotMatch(`${overviewImage}\n${rotor}\n${needle}`, /clip-path:\s*circle/);
  assert.doesNotMatch(css, /@keyframes academic-insight-lens/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
  const academicMotion = sourceSection(
    css,
    "/* Academic artwork motion",
    "/* Academic Tools example"
  );
  assert.doesNotMatch(
    academicMotion,
    /data-active-view="(?:community|messages|profile)"/,
    "the scoped academic layer must not modify unrelated Hub views"
  );
  for(const filename of [
    "concourse-art-citations-v2.jpg",
    "concourse-art-citations-wheel.jpg",
    "concourse-art-insights-v3.jpg"
  ]){
    assert.ok(existsSync(new URL(`../${filename}`, import.meta.url)), `${filename} should exist`);
  }
});

test("Academic Tools and Insights include clearly labeled, non-saving examples", () => {
  assert.match(html, /class="citation-example-strip"/);
  assert.match(html, /data-citation-example="website"/);
  assert.match(html, /data-citation-example="journal"/);
  assert.match(html, /data-citation-example="book"/);
  assert.match(tools, /const CITATION_EXAMPLES/);
  assert.match(tools, /function loadCitationExample/);
  assert.doesNotMatch(
    tools.match(/function loadCitationExample[\s\S]*?\n  \}/u)?.[0] || "",
    /saveLibrary|localStorage/,
    "loading a citation example must not save it"
  );
  assert.match(hub, /const INSIGHT_DEMO = Object\.freeze\(\{/);
  for(const section of [
    "summary",
    "courses",
    "sections",
    "professors",
    "creditDistribution",
    "timetablePatterns"
  ]){
    assert.match(hub, new RegExp(`${section}:Object\\.freeze`), `Insights demo should include ${section}`);
  }
  for(const renderer of [
    "appendInsightDemoSummary",
    "appendInsightCourseDemand",
    "appendInsightSectionDemand",
    "appendInsightProfessorPatterns",
    "appendInsightDistribution",
    "appendInsightTimetablePatterns"
  ]){
    assert.match(hub, new RegExp(`function ${renderer}\\(`), `${renderer} should render richer demo data`);
  }
  assert.match(hub, /table\.className = "hub-insight-demo-table"/);
  assert.match(hub, /track\.setAttribute\("role", "progressbar"\)/);
  assert.match(hub, /dashboard\.dataset\.insightExample = mode/);
  assert.match(hub, /insightExampleStatus/);
  assert.match(hub, /dataset\.insightExampleAction = "preview"/);
  assert.match(hub, /hubState\.insightDemoMode = ""/);

  const deletedDemoImages = [
    "concourse-demo-citation.jpg",
    "concourse-demo-insights.jpg"
  ];
  const shippedSources = [html, css, tools, hub].join("\n");
  for(const filename of deletedDemoImages){
    assert.equal(existsSync(new URL(`../${filename}`, import.meta.url)), false, `${filename} should be removed`);
    assert.ok(!shippedSources.includes(filename), `${filename} should not remain referenced`);
  }
});

test("Community, Market, and Messages seed interactions stay client-only", () => {
  const forbiddenLivePath = /\bhubRpc\s*\(|\bauthClient\b|\.rpc\s*\(|crypto\.randomUUID|(?:post|listing|conversation)_id/;

  const communitySeeds = sourceSection(
    hub,
    "function renderCommunitySeedPosts(feed){",
    "function renderCommunityFeed(posts){"
  );
  assert.match(hub, /hubState\.communitySeedState/);
  assert.match(communitySeeds, /communitySeedPostState\(seed\.key\)/);
  assert.match(communitySeeds, /state\.selectedPoll = index/);
  assert.match(communitySeeds, /state\.comments\.push\(value\)/);
  assert.match(communitySeeds, /hub-post-action--like/);
  assert.match(communitySeeds, /hub-post-action--comment/);
  assert.match(communitySeeds, /hub-post-action--save/);
  assert.match(communitySeeds, /hub-post-action--share/);
  assert.doesNotMatch(communitySeeds, forbiddenLivePath);

  const marketSeeds = sourceSection(
    marketplace,
    "function marketplaceSeedCard(seed){",
    "function updateResultsLabel("
  );
  assert.match(marketSeeds, /card\.dataset\.marketplaceSeed/);
  assert.match(marketSeeds, /state\.seedDetails/);
  assert.match(marketSeeds, /state\.seedSaved/);
  assert.doesNotMatch(marketSeeds, forbiddenLivePath);
  assert.doesNotMatch(marketSeeds, /state\.items/);

  const messageExample = sourceSection(
    hub,
    "function messageExampleSeed(){",
    "function renderConversations(conversations){"
  );
  assert.match(messageExample, /hubState\.messageDemoMessages/);
  assert.match(messageExample, /hubState\.messageDemoMode = true/);
  assert.doesNotMatch(messageExample, forbiddenLivePath);

  const sendMessage = sourceSection(
    hub,
    "async function sendMessage(){",
    "async function reportConversation("
  );
  const demoReply = sendMessage.match(
    /if\(hubState\.messageDemoMode\)\{[\s\S]*?\n\s+return;\n\s+\}/
  )?.[0] || "";
  assert.ok(demoReply, "Messages should have a local-only seeded reply branch");
  assert.match(demoReply, /hubState\.messageDemoMessages\.push/);
  assert.doesNotMatch(demoReply, forbiddenLivePath);

  const nightIncomingMessage = cssRule(
    css,
    'html[data-theme="night"] .member-hub .hub-message:not(.mine)'
  );
  assert.match(nightIncomingMessage, /color:\s*#071d32\s*!important/);
  assert.match(nightIncomingMessage, /background:\s*#edf2f6\s*!important/);
});

test("Community and Market preserve realistic seed content during feed RPC failures", () => {
  const communityLoader = sourceSection(
    hub,
    "async function loadCommunityFeed(",
    "async function publishCommunityPost("
  );
  assert.match(communityLoader, /const canShowSeedPosts = \(/);
  assert.match(communityLoader, /hubState\.feedScope === "school"/);
  assert.match(communityLoader, /hubState\.feedTopic === "all"/);
  assert.match(communityLoader, /renderCommunityFeed\(\[\]\)/);
  assert.match(communityLoader, /setStatus\("communityFeedStatus", message, "error"\)/);

  const marketLoader = sourceSection(
    marketplace,
    "async function loadMarketplace(",
    "function loadNextLocalPage("
  );
  assert.match(marketLoader, /if\(marketplaceSeedAvailable\(\)\)\{/);
  assert.match(marketLoader, /renderGrid\(\)/);
  assert.match(marketLoader, /catalogue\.dataset\.feedState = "degraded"/);
  assert.match(marketLoader, /setStatus\(message, "error"\)/);
  assert.match(
    marketplace,
    /!String\(state\.query \|\| ""\)\.trim\(\)/
  );
});

test("Hub artwork, paper surface, and Community edge labels use the final full-bleed geometry", () => {
  assert.match(
    css,
    /\/\* Full-bleed Hub landscape[\s\S]*?body\.hub-active \.member-hub\s*\{[\s\S]*?padding-inline:\s*0\s*!important[\s\S]*?\.member-hub \.hub-page-header,[\s\S]*?width:\s*100%\s*!important[\s\S]*?border-radius:\s*0\s*!important/
  );
  assert.match(
    css,
    /\.member-hub \.hub-page-header \.hub-hero-art,[\s\S]*?inset:\s*0\s*!important[\s\S]*?height:\s*100%\s*!important[\s\S]*?aspect-ratio:\s*auto\s*!important/
  );
  assert.match(
    css,
    /\.member-hub \.hub-view\s*\{[\s\S]*?width:\s*100%\s*!important[\s\S]*?padding-inline:[\s\S]*?calc\(\(100% - 1440px\) \/ 2 \+ var\(--atlas-gutter\)\)[\s\S]*?border-radius:[\s\S]*?48% 52% 0 0/
  );
  assert.match(
    css,
    /data-active-view="community"\] \.hub-compose-heading,[\s\S]*?\.hub-feed-toolbar\s*\{[\s\S]*?padding-inline-end:\s*clamp\(14px,\s*1\.6vw,\s*22px\)/
  );
  assert.match(
    css,
    /#refreshCommunityFeed\s*\{[\s\S]*?padding-inline:\s*10px/
  );
});

test("the sticky Hub destination rail has an opaque background in both themes", () => {
  assert.match(html, /<nav class="hub-navigation"[^>]+aria-label="Student hub sections"/);

  const nightRail = cssRule(css, ".member-hub .hub-sidebar");
  assert.match(nightRail, /position:\s*sticky\s*!important/);
  assert.match(nightRail, /top:\s*var\(--app-bar-offset,\s*76px\)\s*!important/);
  assert.match(nightRail, /z-index:\s*80\s*!important/);
  assert.match(nightRail, /background:\s*#06182a\s*!important/);
  assert.match(nightRail, /backdrop-filter:\s*none\s*!important/);

  const dayRail = cssRule(css, 'html[data-theme="day"] .member-hub .hub-sidebar');
  assert.match(dayRail, /background:\s*#ddecf7\s*!important/);
  assert.doesNotMatch(`${nightRail}\n${dayRail}`, /background:\s*(?:transparent|rgba\()/);
  assert.match(
    hub,
    /document\.querySelectorAll\("\[data-hub-target\]"\)[\s\S]*?window\.scrollTo\(\{[\s\S]*?prefers-reduced-motion/
  );
});
