import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../academic-experiences.css", import.meta.url), "utf8");
const tools = readFileSync(new URL("../academic-tools.js", import.meta.url), "utf8");
const hub = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");

test("the night Market search uses a white caret without changing Day mode", () => {
  assert.match(
    css,
    /html\[data-theme="night"\][\s\S]*?data-active-view="marketplace"[\s\S]*?#marketplaceSearch\s*\{[\s\S]*?caret-color:\s*#fff\s*!important/
  );
  assert.doesNotMatch(css, /html\[data-theme="day"\][\s\S]{0,180}#marketplaceSearch[\s\S]{0,120}caret-color/u);
});

test("Academic artwork movement is object-level, scoped and reduced-motion safe", () => {
  assert.match(css, /data-active-view="academic-tools"[\s\S]*?academic-string-tension-primary/);
  assert.match(css, /data-active-view="overview"[\s\S]*?concourse-art-insights-v2\.jpg[\s\S]*?clip-path:\s*circle/);
  assert.match(css, /@keyframes academic-insight-lens/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation:\s*none\s*!important/);
  assert.doesNotMatch(
    css,
    /data-active-view="(?:community|messages|profile)"/,
    "the scoped academic layer must not modify unrelated Hub views"
  );
  for(const filename of [
    "concourse-art-citations-motion.jpg",
    "concourse-art-insights-v2.jpg"
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
  assert.match(hub, /const INSIGHT_DEMO_ROWS/);
  assert.match(hub, /insightExampleStatus/);
  assert.match(hub, /dataset\.insightExampleAction = "preview"/);
  assert.match(hub, /hubState\.insightDemoMode = ""/);
  for(const filename of [
    "concourse-demo-citation.jpg",
    "concourse-demo-insights.jpg"
  ]){
    assert.ok(existsSync(new URL(`../${filename}`, import.meta.url)), `${filename} should exist`);
  }
});
