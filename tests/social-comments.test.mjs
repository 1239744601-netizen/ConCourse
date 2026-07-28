import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const hub = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const market = readFileSync(new URL("../marketplace.js", import.meta.url), "utf8");
const marketCss = readFileSync(new URL("../marketplace.css", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase-social-comments.sql", import.meta.url), "utf8");

test("community comments stay collapsed until Comment is selected", () => {
  assert.match(hub, /comments\.hidden = !commentsVisible/);
  assert.match(hub, /commentButton\.setAttribute\("aria-expanded", commentsVisible \? "true" : "false"\)/);
  assert.match(hub, /commentArea\.hidden = !state\.commentsOpen/);
  assert.match(hub, /toggle_community_comment_like/);
  assert.match(hub, /p_parent_comment_id:replyTarget\?\.commentId \|\| null/);
  assert.match(hub, /if\(!isReply\)\{[\s\S]*?commentId:comment\.comment_id/);
  assert.match(hub, /if\(!parentKey\)\{[\s\S]*?commentKey,/);

  for(const key of ["commentLike", "commentUnlike", "reply", "replyingTo", "cancelReply"]){
    assert.equal((html.match(new RegExp(`${key}:"`, "g")) || []).length, 3);
  }
});

test("market cards expose comments and private seller contact without messaging owners", () => {
  assert.match(market, /function marketplaceContactButton\(listing/);
  assert.match(market, /function marketplaceCommentsAvailable\(listing\)/);
  assert.match(market, /status === "active" \|\| status === "reserved"/);
  assert.match(market, /if\(marketplaceCommentsAvailable\(listing\)\)/);
  assert.match(market, /if\(isOwnListing\(listing\)\) return null/);
  assert.match(market, /marketplace-card-comment-action/);
  assert.match(market, /get_marketplace_listing_comments/);
  assert.match(market, /add_marketplace_listing_comment/);
  assert.match(market, /toggle_marketplace_listing_comment_like/);
  assert.match(market, /contactMarketplaceSeller\(listing, button\)/);
  assert.match(market, /startGlobalMarketplaceConversation\(listing, trigger\)/);
  assert.match(market, /messageSeller\(listing\)/);

  assert.match(marketCss, /\.marketplace-comment-list[\s\S]*?overflow-y:\s*auto/);
  assert.match(marketCss, /\.marketplace-comment-like\.liked/);
});

test("the social-comments migration is RPC-only and supports replies and likes", () => {
  for(const object of [
    "community_comment_likes",
    "marketplace_listing_comments",
    "marketplace_listing_comment_likes",
    "toggle_community_comment_like",
    "get_marketplace_listing_comments",
    "add_marketplace_listing_comment",
    "toggle_marketplace_listing_comment_like",
    "delete_marketplace_listing_comment"
  ]){
    assert.match(sql, new RegExp(object));
  }

  assert.match(sql, /add column if not exists parent_comment_id uuid/);
  assert.match(sql, /create or replace function public\.delete_community_comment/);
  assert.match(sql, /target_parent is null[\s\S]*?comment\.parent_comment_id = p_comment_id/);
  assert.match(sql, /revoke all on table public\.marketplace_listing_comments[\s\S]*?from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.get_marketplace_listing_comments\(uuid, integer, integer\)[\s\S]*?to authenticated/);
  assert.match(sql, /notify pgrst, 'reload schema'/);
});
