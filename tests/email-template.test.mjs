import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const template = readFileSync(new URL("../supabase-confirm-signup-email.html", import.meta.url), "utf8");
const inviteTemplate = readFileSync(new URL("../supabase-invite-email.html", import.meta.url), "utf8");

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

test("invitation email uses the ConCourse navy identity and an invitation-only action", () => {
  assert.match(inviteTemplate, /<title>You&?rsquo;re invited to ConCourse<\/title>/);
  assert.match(inviteTemplate, /\{\{ \.ConfirmationURL \}\}/);
  assert.match(inviteTemplate, /\{\{ \.Email \}\}/);
  assert.match(inviteTemplate, /Accept invitation/);
  assert.match(inviteTemplate, /Protect your invitation/);
  assert.match(inviteTemplate, /bgcolor="#061625"/);
  assert.match(inviteTemplate, /bgcolor="#0b2238"/);
  assert.match(inviteTemplate, /bgcolor="#f1be4f"/);
  assert.match(inviteTemplate, /concourse-email-mark\.png/);
  assert.doesNotMatch(inviteTemplate, /\{\{ \.Token \}\}/);
  assert.doesNotMatch(inviteTemplate, /<svg|data:image|@import/i);
});

test("invitation email remains responsive and resists automatic link recoloring", () => {
  assert.match(inviteTemplate, /max-width:600px/);
  assert.match(inviteTemplate, /prefers-color-scheme: dark/);
  assert.match(inviteTemplate, /\[data-ogsc\]/);
  assert.match(inviteTemplate, /x-apple-data-detectors/);
  assert.match(inviteTemplate, /u \+ #body \.invite-address a/);
});
