import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewOrigin = "https://preview.concourse.example";

function listFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? listFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  });
}

test("Pages build publishes only the explicit frontend artifact", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/build-pages.mjs"],
    {
      cwd:projectRoot,
      encoding:"utf8",
      env:{...process.env, CONCOURSE_PUBLIC_ORIGIN:previewOrigin}
    }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const outputFiles = listFiles(path.join(projectRoot, "dist"));
  for (const required of [
    "index.html",
    "_headers",
    "favicon.ico",
    "concourse-favicon-32.png",
    "concourse-apple-touch-icon.png",
    "concourse-brand-favicon.svg",
    "member-hub.js",
    "data/hkbu-catalogue-current.json",
    "data/hkbu-2026-27-s1-catalog.json",
    "downloads/concourse-hkbu-portal-connector.zip"
  ]) {
    assert.ok(outputFiles.includes(required), required);
  }
  assert.equal(outputFiles.some(file => file.endsWith(".sql")), false);
  assert.equal(outputFiles.some(file => file.endsWith(".md")), false);
  assert.equal(outputFiles.some(file => file.startsWith("tests/")), false);
  assert.equal(outputFiles.some(file => file.startsWith("supabase/")), false);

  const html = readFileSync(path.join(projectRoot, "dist/index.html"), "utf8");
  assert.match(html, new RegExp(`${previewOrigin}/`, "u"));
  assert.doesNotMatch(html, /https:\/\/concoursehk\.pages\.dev/u);
  assert.match(
    html,
    /rel="icon"[^>]+href="\/concourse-favicon-32\.png\?v=20260731-double-c2"/u
  );
  assert.match(
    html,
    /rel="shortcut icon"[^>]+href="\/favicon\.ico\?v=20260731-double-c2"/u
  );
  assert.match(
    html,
    /rel="apple-touch-icon"[^>]+href="\/concourse-apple-touch-icon\.png\?v=20260731-double-c2"/u
  );

  const connector = readFileSync(
    path.join(projectRoot, "dist/downloads/concourse-hkbu-portal-connector.zip")
  );
  assert.ok(connector.includes(Buffer.from("hkbu-portal-connector/popup.js")));
  assert.ok(connector.includes(Buffer.from(previewOrigin)));

  const memberHub = readFileSync(path.join(projectRoot, "dist/member-hub.js"), "utf8");
  assert.match(memberHub, /new URL\("\/", window\.location\.origin\)\.href/u);
  assert.doesNotMatch(memberHub, /SOCIAL_OAUTH_RETURN_URL = "https:\/\/concoursehk/u);
});
