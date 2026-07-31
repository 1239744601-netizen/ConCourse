import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import worker from "../cloudflare-pages-worker.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalOrigin = "https://concoursehk.com";

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
      env:{...process.env, CONCOURSE_PUBLIC_ORIGIN:canonicalOrigin}
    }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const outputFiles = listFiles(path.join(projectRoot, "dist"));
  for (const required of [
    "index.html",
    "_headers",
    "favicon.ico",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "apple-touch-icon-precomposed.png",
    "_worker.js",
    "site.webmanifest",
    "concourse-favicon-32.png",
    "concourse-apple-touch-icon.png",
    "concourse-brand-favicon.svg",
    "member-hub.js",
    "assistant/index.html",
    "assistant/assistant.mjs",
    "assistant/handoff.mjs",
    "course-tools/course-tools.css",
    "course-tools/course-tools.mjs",
    "course-tools/institution-context.mjs",
    "coursekeys/index.html",
    "coursekeys/coursekeys.css",
    "coursekeys/coursekeys.js",
    "coursekeys/og-coursekeys.png",
    "coursekeys/data/course-catalogue.json",
    "coursekeys/data/course-material-seed.json",
    "courses/index.html",
    "courses/courses.mjs",
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
  assert.match(html, /rel="canonical" href="https:\/\/concoursehk\.com\/"/u);
  assert.match(html, /property="og:url" content="https:\/\/concoursehk\.com\/"/u);
  assert.doesNotMatch(html, /pages\.dev|github\.io/u);
  assert.match(
    html,
    /rel="icon"[^>]+href="\/favicon-32x32\.png\?v=20260731-double-c3"/u
  );
  assert.match(
    html,
    /rel="shortcut icon"[^>]+href="\/favicon\.ico\?v=20260731-double-c3"/u
  );
  assert.match(
    html,
    /rel="apple-touch-icon"[^>]+href="\/apple-touch-icon\.png\?v=20260731-double-c3"/u
  );
  assert.match(html, /rel="manifest"[^>]+href="\/site\.webmanifest\?v=20260731-double-c3"/u);

  assert.deepEqual(
    readFileSync(path.join(projectRoot, "dist/favicon-32x32.png")),
    readFileSync(path.join(projectRoot, "dist/concourse-favicon-32.png"))
  );
  assert.deepEqual(
    readFileSync(path.join(projectRoot, "dist/apple-touch-icon.png")),
    readFileSync(path.join(projectRoot, "dist/concourse-apple-touch-icon.png"))
  );
  assert.deepEqual(
    readFileSync(path.join(projectRoot, "dist/apple-touch-icon-precomposed.png")),
    readFileSync(path.join(projectRoot, "dist/concourse-apple-touch-icon.png"))
  );

  const connector = readFileSync(
    path.join(projectRoot, "dist/downloads/concourse-hkbu-portal-connector.zip")
  );
  assert.ok(connector.includes(Buffer.from("hkbu-portal-connector/popup.js")));
  assert.ok(connector.includes(Buffer.from(canonicalOrigin)));

  const memberHub = readFileSync(path.join(projectRoot, "dist/member-hub.js"), "utf8");
  assert.match(memberHub, /new URL\("\/", window\.location\.origin\)\.href/u);
  assert.doesNotMatch(memberHub, /SOCIAL_OAUTH_RETURN_URL = "https:\/\/concoursehk/u);
});

test("Pages build rejects a non-canonical public origin", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/build-pages.mjs"],
    {
      cwd:projectRoot,
      encoding:"utf8",
      env:{...process.env, CONCOURSE_PUBLIC_ORIGIN:"https://preview.concourse.example"}
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be https:\/\/concoursehk\.com/u);
});

test("Pages worker redirects every non-canonical origin and preserves the request target", async () => {
  let assetRequests = 0;
  const env = {
    ASSETS:{
      fetch(request) {
        assetRequests += 1;
        return new Response(`asset:${new URL(request.url).pathname}`);
      }
    }
  };

  for (const origin of [
    "https://concourse-95c.pages.dev",
    "https://preview.concourse-95c.pages.dev",
    "https://www.concoursehk.com",
    "http://concoursehk.com",
    "https://concoursehk.com.",
    "https://concoursehk.com:8443",
    "https://concoursehk.com.evil.example"
  ]) {
    const response = await worker.fetch(
      new Request(`${origin}/courses/?term=2026-s1`),
      env
    );
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("Location"),
      "https://concoursehk.com/courses/?term=2026-s1"
    );
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
  }

  const hostilePathResponse = await worker.fetch(
    new Request("https://concourse-95c.pages.dev//evil.example/x?y=1"),
    env
  );
  assert.equal(hostilePathResponse.status, 308);
  assert.equal(
    hostilePathResponse.headers.get("Location"),
    "https://concoursehk.com//evil.example/x?y=1"
  );

  const canonicalResponse = await worker.fetch(
    new Request("https://concoursehk.com/courses/"),
    env
  );
  assert.equal(canonicalResponse.status, 200);
  assert.equal(await canonicalResponse.text(), "asset:/courses/");
  assert.equal(assetRequests, 1);
});
