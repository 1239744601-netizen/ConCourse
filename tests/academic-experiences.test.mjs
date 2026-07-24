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

test("Citation guidance is removed while Academic Insights keeps its comprehensive example", () => {
  assert.doesNotMatch(html, /class="citation-example-strip"/);
  assert.doesNotMatch(html, /data-citation-example=/);
  assert.match(html, /id="citationForm"/);
  assert.match(html, /data-academic-i18n="citationStyleLegend"/);
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

test("live Community posts and Market listings coexist with realistic seeded content", () => {
  const communityRender = sourceSection(
    hub,
    "function renderCommunityFeed(posts){",
    "function updateCommunityLoadMore(){"
  );
  assert.match(
    communityRender,
    /orderedPosts\.forEach[\s\S]*?feed\.append\(card\)[\s\S]*?if\(showSeedPosts\) renderCommunitySeedPosts\(feed\)/
  );
  assert.match(hub, /avatar:Object\.freeze\(\{src:"concourse-community-library\.jpg"/);
  assert.match(hub, /author:"Jason Ho"[\s\S]*?author:"Chloe Lam"[\s\S]*?author:"Ethan Wong"/);
  assert.match(hub, /function communitySeedCommentRow\(/);
  assert.match(hub, /hub-community-example-avatar-image/);

  const marketRender = sourceSection(
    marketplace,
    "function renderGrid(){",
    "function feedParams(){"
  );
  assert.match(marketRender, /const showSeedListings = marketplaceSeedAvailable\(\)/);
  assert.match(
    marketRender,
    /state\.items\.forEach\(listing => grid\.append\(listingCard\(listing\)\)\)[\s\S]*?MARKETPLACE_SEED_LISTINGS\.forEach/
  );
  assert.match(marketRender, /const renderedCount = state\.items\.length \+ seedCount/);
  assert.match(marketRender, /liveTotal \+ seedCount/);
});

test("seed post comment totals match their complete scrollable conversations", () => {
  const seeds = sourceSection(
    hub,
    "const COMMUNITY_SEED_POSTS",
    "const INSIGHT_DEMO"
  );
  const expectations = [
    ["finance-revision", "campus-plant-swap", 8],
    ["campus-plant-swap", "project-courtyard", 14],
    ["project-courtyard", null, 5]
  ];

  for(const [key, nextKey, expectedCount] of expectations){
    const start = seeds.indexOf(`key:"${key}"`);
    const end = nextKey ? seeds.indexOf(`key:"${nextKey}"`, start + 1) : seeds.length;
    assert.ok(start >= 0 && end > start, `Expected complete seed definition for ${key}`);
    const seed = seeds.slice(start, end);
    const comments = sourceSection(seed, "comments:Object.freeze([", "])");
    assert.equal(
      (comments.match(/\bauthor:"/g) || []).length,
      expectedCount,
      `${key} should provide every displayed comment`
    );
    assert.match(seed, new RegExp(`commentCount:${expectedCount}`));
    for(const locale of ['en:', '"zh-CN":', '"zh-HK":']){
      assert.equal(
        (comments.match(new RegExp(locale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length >= expectedCount,
        true,
        `${key} comments should all include ${locale.replace(/[:"]/g, "")}`
      );
    }
  }

  const seedRenderer = sourceSection(
    hub,
    "function renderCommunitySeedPosts(feed){",
    "function renderCommunityFeed(posts){"
  );
  assert.match(
    seedRenderer,
    /\$\{t\("comment"\)\} · \$\{seed\.comments\.length \+ state\.comments\.length\}/
  );
  assert.match(seedRenderer, /const commentList = node\("div", "hub-community-example-comment-list"\)/);
  assert.match(seedRenderer, /commentList\.append\(communitySeedCommentRow\(comment\)\)/);
  assert.match(seedRenderer, /commentArea\.append\(commentList\)[\s\S]*?commentArea\.append\(form\)/);

  const scrollableComments = cssRule(css, ".hub-community-example-comment-list");
  assert.match(scrollableComments, /max-height:\s*286px/);
  assert.match(scrollableComments, /overflow-y:\s*auto/);
  assert.match(scrollableComments, /overscroll-behavior:\s*contain/);
});

test("owners delete listings from the Edit modal and deleted listings stay removed", () => {
  const listingCardSource = sourceSection(
    marketplace,
    "function listingCard(listing, options={}){",
    "function marketplaceSeedText("
  );
  assert.doesNotMatch(listingCardSource, /marketplaceDeleteConfirm/);
  assert.doesNotMatch(listingCardSource, /updateListingStatus\(id, "deleted"/);

  const listingDetailSource = sourceSection(
    marketplace,
    "function renderListingDetail(listing){",
    "async function ask(options){"
  );
  assert.doesNotMatch(listingDetailSource, /updateListingStatus\(id, "deleted"/);

  const editorDeleteSource = sourceSection(
    marketplace,
    "async function deleteEditedListing(){",
    "function syncListingModeFields(){"
  );
  assert.match(editorDeleteSource, /marketplaceDeleteConfirm/);
  assert.match(editorDeleteSource, /updateListingStatus\(id, "deleted", remove\)/);
  assert.match(editorDeleteSource, /if\(deleted\) closeEditor\(\{restoreFocus:false, force:true\}\)/);
  assert.match(html, /id="marketplaceEditorDelete"[\s\S]*?data-i18n="marketplaceDelete"[\s\S]*?hidden/);

  const marketLoader = sourceSection(
    marketplace,
    "async function loadMarketplace(",
    "function loadNextLocalPage("
  );
  assert.match(
    marketLoader,
    /state\.mode !== "mine" \|\| String\(item\.status \|\| ""\) !== "deleted"/
  );
});

test("message polling preserves stable rows and uses a real circular demo portrait", () => {
  const messageLauncher = sourceSection(
    hub,
    "function appendMessageExampleLauncher(list){",
    "function renderConversations(conversations){"
  );
  assert.match(messageLauncher, /createAvatar\("Alex Wong", null, 0, "hub-message-demo-avatar"\)/);
  assert.match(messageLauncher, /photo\.src = "concourse-campus-community\.jpg"/);

  const conversationLoader = sourceSection(
    hub,
    "async function loadConversations(",
    "function renderMessages(messages){"
  );
  assert.match(conversationLoader, /querySelector\("\.hub-conversation-button"\)/);
  assert.match(conversationLoader, /conversationRenderSignature\(hubState\.conversations\)/);
  assert.match(conversationLoader, /conversationRenderSignature\(nextConversations\)/);
  assert.match(conversationLoader, /if\(shouldRenderConversationList\) renderConversations/);
  assert.doesNotMatch(
    conversationLoader,
    /if\(hubState\.messageDemoMode\)\{\s*renderMessageExample\(\)/
  );
  for(const field of [
    "conversation_id",
    "other_avatar_path",
    "other_avatar_revision",
    "last_message",
    "can_send"
  ]){
    assert.match(hub, new RegExp(`"${field}"`), `conversation signature should include ${field}`);
  }
});

test("Community and Market preserve realistic seed content during feed RPC failures", () => {
  const communityLoader = sourceSection(
    hub,
    "async function loadCommunityFeed(",
    "async function publishCommunityPost("
  );
  assert.match(communityLoader, /const canShowSeedPosts = !append && communitySeedAvailable\(\)/);
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

test("Community and Market render their empty-state examples before live feeds settle", () => {
  const communityReset = sourceSection(
    hub,
    "function resetSensitiveState(",
    "function academicLabel("
  );
  assert.match(communityReset, /renderCommunityFeed\(\[\]\)/);

  const communityLoader = sourceSection(
    hub,
    "async function loadCommunityFeed(",
    "async function publishCommunityPost("
  );
  assert.match(
    communityLoader,
    /if\(!authClient \|\| !currentUser\)\{[\s\S]*?communitySeedAvailable\(\)[\s\S]*?renderCommunityFeed\(\[\]\)/
  );
  assert.match(
    communityLoader,
    /if\(!append && \(!hubState\.feed\.length \|\| hubState\.feedMode !== mode\)\)\{[\s\S]*?communitySeedAvailable\(\)[\s\S]*?renderCommunityFeed\(\[\]\)/
  );

  const marketLoading = sourceSection(
    marketplace,
    "function renderMarketplaceLoading(){",
    "function renderMarketplaceError("
  );
  assert.match(marketLoading, /marketplaceSeedAvailable\(\)/);
  assert.match(marketLoading, /renderGrid\(\)/);
  assert.match(marketLoading, /dataset\.feedState = "loading"/);

  const marketLoader = sourceSection(
    marketplace,
    "async function loadMarketplace(",
    "function loadNextLocalPage("
  );
  assert.match(
    marketLoader,
    /if\(!authClient \|\| !state\.userId\)\{[\s\S]*?marketplaceSeedAvailable\(\)[\s\S]*?renderGrid\(\)/
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

test("Course Choice Intelligence is one solid circular surface without nested boxes", () => {
  const insightControls = cssRule(
    css,
    '.member-hub\n  .hub-view[data-hub-view="overview"]\n  .hub-insight-controls'
  );
  assert.match(insightControls, /aspect-ratio:\s*1/);
  assert.match(insightControls, /background:[\s\S]*?#0a3558\s*!important/);
  assert.match(insightControls, /border-radius:\s*50%\s*!important/);

  const filterRow = cssRule(
    css,
    '.member-hub\n  .hub-view[data-hub-view="overview"]\n  .hub-insight-controls .hub-filter-row'
  );
  assert.match(filterRow, /background:\s*transparent\s*!important/);
  assert.match(filterRow, /border:\s*0\s*!important/);
  assert.match(filterRow, /box-shadow:\s*none\s*!important/);

  const select = cssRule(
    css,
    '.member-hub\n  .hub-view[data-hub-view="overview"]\n  .hub-insight-controls .hub-filter-row :is(#courseInsightScope, #courseInsightYear)'
  );
  assert.match(select, /background-color:\s*transparent\s*!important/);
  assert.match(select, /border:\s*0\s*!important/);
  assert.match(select, /box-shadow:\s*none\s*!important/);

  const refresh = cssRule(
    css,
    '.member-hub\n  .hub-view[data-hub-view="overview"]\n  .hub-insight-controls #loadCourseInsights'
  );
  assert.match(refresh, /background:\s*#efbb45\s*!important/);
  assert.match(refresh, /border-radius:\s*999px\s*!important/);
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

test("Academic Tools and Community right panels meet the measured sticky destination rail", () => {
  assert.match(hub, /new ResizeObserver\(scheduleHubStickyGeometry\)/);
  assert.match(hub, /destinationRail\.getBoundingClientRect\(\)\.height/);
  assert.match(
    hub,
    /setProperty\("--hub-destination-rail-height",\s*`\$\{railHeight\}px`\)/
  );

  assert.match(
    css,
    /--hub-sticky-content-top:[\s\S]*?var\(--app-bar-offset,\s*76px\)[\s\S]*?var\(--hub-destination-rail-height\)/
  );
  assert.match(
    css,
    /@media \(min-width:\s*1081px\)[\s\S]*?data-active-view="academic-tools"\] \.citation-preview\s*\{[\s\S]*?top:\s*var\(--hub-sticky-content-top\)\s*!important/
  );
  assert.match(
    css,
    /@media \(min-width:\s*1181px\)[\s\S]*?data-active-view="community"\] \.hub-community-rail\s*\{[\s\S]*?top:\s*var\(--hub-sticky-content-top\)\s*!important/
  );
});

test("transaction steps connect continuously and the sticky Hub row spans the viewport", () => {
  assert.match(
    css,
    /\.market-protection-steps > li:not\(:last-child\)::after\s*\{[\s\S]*?display:\s*block\s*!important[\s\S]*?height:\s*auto\s*!important/
  );
  assert.match(
    css,
    /\.market-protection-steps > li:last-child::after\s*\{[\s\S]*?display:\s*none\s*!important[\s\S]*?content:\s*none\s*!important/
  );

  const fullBleed = sourceSection(
    css,
    "/* Full-bleed Hub landscape",
    ".member-hub .hub-page-header,"
  );
  assert.match(fullBleed, /width:\s*100%\s*!important/);
  assert.match(fullBleed, /max-width:\s*none\s*!important/);
  assert.match(fullBleed, /margin-inline:\s*0\s*!important/);
  assert.match(fullBleed, /--hub-rail-inner-pad:\s*clamp\(12px,\s*1\.6vw,\s*22px\)/);
  assert.match(fullBleed, /calc\(\(100% - 1440px\) \/ 2 \+ var\(--hub-rail-inner-pad\)\)/);
  assert.doesNotMatch(fullBleed, /width:\s*min\(1440px/);
});
