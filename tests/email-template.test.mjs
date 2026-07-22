import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const template = readFileSync(new URL("../supabase-confirm-signup-email.html", import.meta.url), "utf8");

test("confirmation email is branded, accessible, and uses scanner-safe OTP verification", () => {
  assert.match(template, /<title>Verify your email for ConCourse<\/title>/);
  assert.match(template, /\{\{ \.Token \}\}/);
  assert.match(template, /\{\{ \.Email \}\}/);
  assert.match(template, /https:\/\/1239744601-netizen\.github\.io\/ConCourse\/concourse-email-mark\.png/);
  assert.match(template, /<img[^>]*alt=""[^>]*role="presentation"/);
  assert.match(template, /Open ConCourse/);
  assert.match(template, /Never share this code/);
  assert.doesNotMatch(template, /\{\{ \.ConfirmationURL \}\}/);
  assert.doesNotMatch(template, /<svg|data:image|@import/i);
});

test("confirmation email includes responsive and dark-mode safeguards", () => {
  assert.match(template, /max-width:600px/);
  assert.match(template, /prefers-color-scheme: dark/);
  assert.match(template, /\[data-ogsc\]/);
  assert.match(template, /x-apple-disable-message-reformatting/);
});
