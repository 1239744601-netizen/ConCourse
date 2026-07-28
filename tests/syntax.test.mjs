import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("every inline script in index.html parses as JavaScript", () => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 2, "expected the theme bootstrap and main application script");
  scripts.forEach((match, index) => {
    assert.doesNotThrow(
      () => new Script(match[1], {filename:`index-inline-${index + 1}.js`}),
      `inline script ${index + 1} should parse`
    );
  });
});
