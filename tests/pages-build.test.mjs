import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionOrigin = "https://concoursehk.com";
const betaOrigin = "https://beta.concoursehk.com";
const workerToken = "__CONCOURSE_DEPLOYMENT_ORIGIN__";

function listFiles(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? listFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  });
}

function runBuild(deploymentOrigin) {
  const env = {...process.env};
  delete env.CONCOURSE_PUBLIC_ORIGIN;
  delete env.CONCOURSE_DEPLOYMENT_ORIGIN;
  if (deploymentOrigin !== undefined) {
    env.CONCOURSE_DEPLOYMENT_ORIGIN = deploymentOrigin;
  }
  return spawnSync(
    process.execPath,
    ["scripts/build-pages.mjs"],
    {
      cwd:projectRoot,
      encoding:"utf8",
      env
    }
  );
}

async function importWorker(source) {
  return (
    await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)
  ).default;
}

function assetEnvironment() {
  let requests = 0;
  return {
    env:{
      ASSETS:{
        fetch(request) {
          requests += 1;
          return new Response(`asset:${new URL(request.url).pathname}`, {
            headers:{"Cache-Control":"public, max-age=60"}
          });
        }
      }
    },
    requestCount() {
      return requests;
    }
  };
}

test("production Pages build publishes only the explicit frontend artifact", () => {
  const result = runBuild(productionOrigin);
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
  assert.doesNotMatch(html, /pages\.dev|github\.io|beta\.concoursehk\.com/u);
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
  assert.ok(connector.includes(Buffer.from(productionOrigin)));
  assert.equal(connector.includes(Buffer.from(betaOrigin)), false);

  const renderedWorker = readFileSync(path.join(projectRoot, "dist/_worker.js"), "utf8");
  assert.equal(renderedWorker.includes(workerToken), false);
  assert.match(renderedWorker, /const SITE_ORIGIN = "https:\/\/concoursehk\.com";/u);

  const memberHub = readFileSync(path.join(projectRoot, "dist/member-hub.js"), "utf8");
  assert.match(memberHub, /new URL\("\/", window\.location\.origin\)\.href/u);
  assert.doesNotMatch(memberHub, /SOCIAL_OAUTH_RETURN_URL = "https:\/\/concoursehk/u);
});

test("an unrendered Pages worker fails closed", async () => {
  const source = readFileSync(path.join(projectRoot, "_worker.js"), "utf8");
  const worker = await importWorker(source);
  const assets = assetEnvironment();
  const response = await worker.fetch(
    new Request(`${productionOrigin}/courses/`),
    assets.env
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.match(response.headers.get("X-Robots-Tag"), /noindex/u);
  assert.equal(assets.requestCount(), 0);
});

test("production worker serves only the production origin", async () => {
  const result = runBuild(productionOrigin);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const worker = await importWorker(
    readFileSync(path.join(projectRoot, "dist/_worker.js"), "utf8")
  );
  const assets = assetEnvironment();

  for (const origin of [
    "https://concourse-95c.pages.dev",
    "https://beta.concourse-95c.pages.dev",
    "https://a1b2c3d4.concourse-95c.pages.dev",
    "https://pages.dev",
    "http://concourse-95c.pages.dev",
    "https://CONCOURSE-95C.PAGES.DEV.",
    "https://concourse-95c.pages.dev..",
    "https://concourse-95c.pages.dev:8443"
  ]) {
    const response = await worker.fetch(
      new Request(`${origin}/courses/?term=2026-s1`),
      assets.env
    );
    assert.equal(response.status, 410, origin);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
    assert.match(response.headers.get("Content-Security-Policy"), /default-src 'none'/u);
    assert.match(response.headers.get("X-Robots-Tag"), /noindex/u);
    const body = await response.text();
    assert.match(body, /This address has retired/u);
    assert.doesNotMatch(body, /concourse-95c|courses|2026-s1/u);
  }

  const headResponse = await worker.fetch(
    new Request("https://preview.concourse-95c.pages.dev/", {method:"HEAD"}),
    assets.env
  );
  assert.equal(headResponse.status, 410);
  assert.equal(await headResponse.text(), "");

  for (const origin of [
    betaOrigin,
    "https://www.concoursehk.com",
    "http://concoursehk.com",
    "https://concoursehk.com.",
    "https://concoursehk.com:8443",
    "https://concoursehk.com.evil.example",
    "https://evilpages.dev",
    "https://foo.pages.dev.evil.test"
  ]) {
    const response = await worker.fetch(
      new Request(`${origin}/courses/?term=2026-s1`),
      assets.env
    );
    assert.equal(response.status, 421, origin);
    assert.equal(response.headers.get("Location"), null);
  }

  const canonicalResponse = await worker.fetch(
    new Request(`${productionOrigin}/courses/`),
    assets.env
  );
  assert.equal(canonicalResponse.status, 200);
  assert.equal(await canonicalResponse.text(), "asset:/courses/");
  assert.equal(assets.requestCount(), 1);

  const readinessResponse = await worker.fetch(
    new Request(`${productionOrigin}/api/coursekeys/resources`),
    assets.env
  );
  assert.equal(readinessResponse.status, 200);
  assert.deepEqual(await readinessResponse.json(), {
    courseKeys:"preview",
    integrationLocked:true,
    storage:{
      metadataBinding:"DB",
      quarantineBinding:"COURSE_MATERIALS",
      quarantinePrivate:true
    },
    capabilities:{
      secureAuth:false,
      verification:false,
      scanning:false,
      moderation:false,
      quotas:false,
      deletion:false,
      ledger:false,
      uploads:false,
      publishing:false,
      downloads:false,
      transactions:false
    },
    message:"Course workspaces are available. Uploads, publication, downloads, and transactions are disabled."
  });
  assert.equal(assets.requestCount(), 1);

  const lockedPost = await worker.fetch(
    new Request(`${productionOrigin}/api/coursekeys/resources`, {method:"POST"}),
    assets.env
  );
  assert.equal(lockedPost.status, 503);
  assert.equal((await lockedPost.json()).integrationLocked, true);
  assert.equal(assets.requestCount(), 1);
});

test("beta build is origin-bound, functional, and excluded from indexing", async () => {
  const result = runBuild(betaOrigin);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const html = readFileSync(path.join(projectRoot, "dist/index.html"), "utf8");
  assert.match(html, /rel="canonical" href="https:\/\/concoursehk\.com\/"/u);
  assert.match(html, /property="og:url" content="https:\/\/concoursehk\.com\/"/u);

  const connector = readFileSync(
    path.join(projectRoot, "dist/downloads/concourse-hkbu-portal-connector.zip")
  );
  assert.ok(connector.includes(Buffer.from(betaOrigin)));
  assert.equal(connector.includes(Buffer.from(productionOrigin)), false);

  const worker = await importWorker(
    readFileSync(path.join(projectRoot, "dist/_worker.js"), "utf8")
  );
  const assets = assetEnvironment();
  const unconfiguredResponse = await worker.fetch(
    new Request(`${betaOrigin}/courses/`),
    assets.env
  );
  assert.equal(unconfiguredResponse.status, 503);
  assert.equal(assets.requestCount(), 0);

  const betaToken = "unit-test-private-beta-token";
  const betaEnv = {
    ...assets.env,
    CONCOURSE_BETA_ACCESS_TOKEN:betaToken
  };
  const deniedResponse = await worker.fetch(
    new Request(`${betaOrigin}/courses/`),
    betaEnv
  );
  assert.equal(deniedResponse.status, 401);
  assert.match(deniedResponse.headers.get("WWW-Authenticate"), /ConCourse Beta/u);
  assert.equal(assets.requestCount(), 0);

  const authorization = `Basic ${Buffer.from(`concourse-beta:${betaToken}`).toString("base64")}`;
  const betaResponse = await worker.fetch(
    new Request(`${betaOrigin}/courses/`, {
      headers:{Authorization:authorization}
    }),
    betaEnv
  );
  assert.equal(betaResponse.status, 200);
  assert.equal(await betaResponse.text(), "asset:/courses/");
  assert.equal(betaResponse.headers.get("Cache-Control"), "private, no-store");
  assert.match(betaResponse.headers.get("X-Robots-Tag"), /noindex/u);
  assert.equal(assets.requestCount(), 1);

  const productionResponse = await worker.fetch(
    new Request(`${productionOrigin}/courses/`, {
      headers:{Authorization:authorization}
    }),
    betaEnv
  );
  assert.equal(productionResponse.status, 421);

  const previewResponse = await worker.fetch(
    new Request("https://beta.concourse-95c.pages.dev/courses/"),
    betaEnv
  );
  assert.equal(previewResponse.status, 410);
  assert.equal(assets.requestCount(), 1);
});

test("Pages build rejects missing, malformed, and unapproved deployment origins", () => {
  for (const deploymentOrigin of [
    undefined,
    "",
    "https://preview.concourse.example",
    "http://concoursehk.com",
    "https://www.concoursehk.com",
    "https://concoursehk.com.evil.example",
    "https://concoursehk.com/path",
    "https://concoursehk.com?preview=1",
    "https://concoursehk.com#preview",
    "https://user:password@concoursehk.com",
    "https://concoursehk.com:8443"
  ]) {
    const result = runBuild(deploymentOrigin);
    assert.notEqual(result.status, 0, String(deploymentOrigin));
    assert.match(result.stderr, /CONCOURSE_DEPLOYMENT_ORIGIN/u);
  }
});
