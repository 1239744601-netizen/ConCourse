import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../community-redesign.css", import.meta.url), "utf8");

test("the Community redesign is isolated and loaded after older visual layers", () => {
  const artLink = html.indexOf('href="concourse-art.css');
  const communityLink = html.indexOf('href="community-redesign.css');

  assert.ok(artLink > -1);
  assert.ok(communityLink > artLink, "Community overrides should be the final stylesheet");
  assert.doesNotMatch(
    css,
    /data-active-view="(?:overview|marketplace|messages|academic-tools|profile)"/,
    "Community CSS must not target another Hub destination"
  );
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
});

test("Community posts accept several photos or videos with accessible previews", () => {
  assert.match(
    html,
    /id="communityMediaInput"[^>]+type="file"[^>]+accept="[^"]*image\/jpeg[^"]*video\/mp4[^"]*"[^>]+multiple/
  );
  assert.match(html, /id="communityMediaPreview"[^>]+aria-live="polite"/);
  assert.match(html, /id="communityMediaDropHint"[^>]*>Add, paste, or drop up to 4 photos or videos/);
  assert.match(js, /communityPostBody"\)\?\.addEventListener\("paste"/);
  assert.match(js, /composer\?\.addEventListener\("drop"/);
  assert.match(js, /is-media-dragging/);
  assert.match(js, /const available = 4 - hubState\.composerMedia\.length/);
  assert.match(js, /video\/mp4/);
  assert.match(js, /normalizeRasterUpload/);
});

test("the poll and survey builder supports voting choices and clear state", () => {
  assert.match(html, /id="addCommunityPoll"[^>]+aria-controls="communityPollBuilder"[^>]+aria-expanded="false"/);
  assert.match(html, /data-i18n="pollSurvey">Poll \/ survey/);
  assert.equal((html.match(/addPollSurvey:"/g) || []).length, 3);
  assert.equal((html.match(/pollSurveyHint:"/g) || []).length, 3);
  assert.match(js, /length >= 6/);
  assert.match(js, /trigger\.setAttribute\("aria-expanded", "false"\)/);
  assert.match(js, /event\.currentTarget\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(js, /vote_community_poll/);
});

test("Community feed keeps the essential social interactions", () => {
  for(const actionClass of [
    "hub-post-action--comment",
    "hub-post-action--like",
    "hub-post-action--save",
    "hub-post-action--share"
  ]){
    assert.ok(js.includes(actionClass), `${actionClass} should be rendered`);
    assert.ok(css.includes(actionClass), `${actionClass} should be styled`);
  }

  assert.match(js, /togglePostLike\(post\.post_id\)/);
  assert.match(js, /togglePostBookmark\(post\.post_id\)/);
  assert.match(js, /shareCommunityPost\(post\.post_id\)/);
  assert.match(js, /loadPostComments\(post\.post_id, comments\)/);
});
