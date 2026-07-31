import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hub = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const marketplace = readFileSync(new URL("../marketplace.js", import.meta.url), "utf8");
const hubCss = readFileSync(new URL("../member-hub.css", import.meta.url), "utf8");
const marketCss = readFileSync(new URL("../marketplace.css", import.meta.url), "utf8");
const communityCss = readFileSync(new URL("../community-redesign.css", import.meta.url), "utf8");
const academicCss = readFileSync(new URL("../academic-tools.css", import.meta.url), "utf8");

test("Hub captions are concise in every supported language", () => {
  assert.match(hub, /communityTitle:"Community"/);
  assert.match(hub, /communityIntro:"Ask, share, and connect on campus\."/);
  assert.match(hub, /academicToolsIntro:"Create references and build a bibliography\."/);
  assert.match(hub, /communityTitle:"校园社区"/);
  assert.match(hub, /communityTitle:"校園社區"/);
  assert.match(hub, /communityComposerEyebrow:""/);
  assert.match(hub, /communityMediaDropHint:"Up to 4 photos or videos"/);
});

test("essential identity, deletion, payment, and rights notices remain", () => {
  assert.match(hub, /Only an approved academic email confirmed with its verification code can qualify this account/);
  assert.match(hub, /A seven-day safety window lets you cancel before processing/);
  assert.match(marketplace, /ConCourse does not currently collect, hold, or transfer money/);
  assert.match(marketplace, /I own this item or have permission to distribute it/);
  assert.match(marketplace, /marketplaceCampusBoundary:"Listings, offers, and messages are active\. Payments are not\."/);
  assert.match(marketplace, /marketplaceOrderSummary:"ConCourse does not process payment\."/);
});

test("Hub feature styles align copy and obey Day and Night contrast", () => {
  assert.match(hubCss, /\.hub-page-header :is\(\.hub-kicker, p\):empty/);
  assert.match(communityCss, /\.hub-compose-heading :is\([\s\S]*?\.hub-compose-eyebrow,[\s\S]*?p[\s\S]*?\):empty/);
  assert.match(marketCss, /html\[data-theme="night"\] \.member-hub\[data-active-view="marketplace"\][\s\S]*?--market-ink:\s*var\(--clarity-text/);
  assert.match(marketCss, /\.market-scope-description[\s\S]*?text-align:\s*start/);
  assert.match(academicCss, /html\[data-theme="night"\][\s\S]*?\.citation-library-head h2/);
  assert.match(academicCss, /html\[data-theme="day"\][\s\S]*?\.citation-library-head h2/);
});

test("empty status regions collapse without leaving the accessibility tree", () => {
  assert.doesNotMatch(
    hubCss,
    /:is\(\.hub-inline-status, \.hub-account-trust-status\):empty\s*\{\s*display:\s*none/
  );
  assert.doesNotMatch(
    marketCss,
    /:is\(\s*\.market-status,\s*\.marketplace-editor-status,\s*\.marketplace-comment-status\s*\):empty\s*\{\s*display:\s*none/
  );
  assert.doesNotMatch(
    academicCss,
    /:is\(\s*\.citation-engine-state,\s*\.citation-lookup-status\s*\):empty\s*\{\s*display:\s*none/
  );
});
