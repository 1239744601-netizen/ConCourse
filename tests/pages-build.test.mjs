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
const gsapArtifacts = Object.freeze([
  "vendor/gsap/gsap.min.js",
  "vendor/gsap/ScrollTrigger.min.js"
]);
const timetableMachineArtifacts = Object.freeze([
  "timetable-machine-3d.mjs",
  "vendor/three/three.module.min.js",
  "vendor/three/three.core.min.js",
  "vendor/three/LICENSE.txt",
  "concourse-timetable-machine-interior-v2.png"
]);
const aquariumArtifacts = Object.freeze([
  "courses/course-ambient.css",
  "courses/course-ambient.mjs",
  "courses/course-aquarium-model.mjs",
  "courses/assets/course-aquarium-night-1280.avif",
  "courses/assets/course-aquarium-night-1280.jpg",
  "courses/assets/course-aquarium-day-1280.avif",
  "courses/assets/course-aquarium-day-1280.jpg",
  "courses/assets/course-aquarium-night-cinematic-v2.avif",
  "courses/assets/course-aquarium-night-cinematic-v2.jpg",
  "courses/assets/course-aquarium-day-cinematic-v2.avif",
  "courses/assets/course-aquarium-day-cinematic-v2.jpg",
  "courses/assets/course-fish-sprites.webp",
  "courses/assets/course-reef-sprites.webp"
]);

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
    "timetable-immersive.css",
    "timetable-immersive.js",
    "concourse-timetable-journey-v1.png",
    "concourse-timetable-monitor-blank-v1.png",
    ...gsapArtifacts,
    ...timetableMachineArtifacts,
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
    ...aquariumArtifacts,
    "data/hkbu-catalogue-current.json",
    "data/hkbu-2026-27-s1-catalog.json",
    "downloads/concourse-hkbu-portal-connector.zip"
  ]) {
    assert.ok(outputFiles.includes(required), required);
  }
  for (const immersiveAsset of [
    "timetable-immersive.css",
    "timetable-immersive.js",
    "concourse-timetable-journey-v1.png",
    "concourse-timetable-monitor-blank-v1.png"
  ]) {
    assert.deepEqual(
      readFileSync(path.join(projectRoot, "dist", immersiveAsset)),
      readFileSync(path.join(projectRoot, immersiveAsset)),
      immersiveAsset
    );
  }
  for (const gsapArtifact of gsapArtifacts) {
    assert.deepEqual(
      readFileSync(path.join(projectRoot, "dist", gsapArtifact)),
      readFileSync(path.join(projectRoot, gsapArtifact)),
      gsapArtifact
    );
  }
  for (const timetableMachineArtifact of timetableMachineArtifacts) {
    assert.deepEqual(
      readFileSync(path.join(projectRoot, "dist", timetableMachineArtifact)),
      readFileSync(path.join(projectRoot, timetableMachineArtifact)),
      timetableMachineArtifact
    );
  }
  for (const aquariumArtifact of aquariumArtifacts) {
    assert.deepEqual(
      readFileSync(path.join(projectRoot, "dist", aquariumArtifact)),
      readFileSync(path.join(projectRoot, aquariumArtifact)),
      aquariumArtifact
    );
  }
  assert.equal(outputFiles.some(file => file.endsWith(".sql")), false);
  assert.equal(outputFiles.some(file => file.endsWith(".md")), false);
  assert.equal(outputFiles.some(file => file.startsWith("tests/")), false);
  assert.equal(outputFiles.some(file => file.startsWith("supabase/")), false);

  const html = readFileSync(path.join(projectRoot, "dist/index.html"), "utf8");
  assert.match(html, /rel="canonical" href="https:\/\/concoursehk\.com\/"/u);
  assert.match(html, /property="og:url" content="https:\/\/concoursehk\.com\/"/u);
  assert.doesNotMatch(html, /pages\.dev|github\.io|beta\.concoursehk\.com/u);
  assert.match(html, /const CONCOURSE_BUILD_PROFILE = "production";/u);
  assert.match(html, /@supabase\/supabase-js/u);
  assert.match(html, /https:\/\/uqnwvxceznsxbxhkspeo\.supabase\.co/u);
  assert.match(html, /sb_publishable_Sl_mKACQoAp70JNH3og2uw_hMFXSZn4/u);
  assert.match(html, /window\.supabase\.createClient/u);
  assert.match(html, /<script src="member-hub\.js/u);
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

test("beta build is a public, data-isolated Timetable preview", async () => {
  const result = runBuild(betaOrigin);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const outputFiles = listFiles(path.join(projectRoot, "dist"));
  for (const required of [
    "index.html",
    "_worker.js",
    "timetable-immersive.css",
    "timetable-immersive.js",
    "timetable-machine-3d.mjs",
    ...gsapArtifacts,
    ...timetableMachineArtifacts
  ]) {
    assert.ok(outputFiles.includes(required), required);
  }
  for (const excluded of [
    "navigation-state.js",
    "institution-portal-policy.js",
    "course-catalog.js",
    "member-hub.js",
    "hkbu-portal.js",
    "marketplace.js",
    "academic-tools.js",
    "assistant/index.html",
    "course-tools/course-tools.mjs",
    "coursekeys/index.html",
    "courses/index.html",
    "data/hkbu-catalogue-current.json",
    "downloads/concourse-hkbu-portal-connector.zip"
  ]) {
    assert.equal(outputFiles.includes(excluded), false, excluded);
  }
  for (const file of outputFiles) {
    const contents = readFileSync(path.join(projectRoot, "dist", file));
    for (const forbiddenPattern of [
      "@supabase/supabase-js",
      ".supabase.co",
      "sb_publishable_",
      "window.supabase.createClient",
      "api.ror.org",
      "universities.hipolabs.com"
    ]) {
      assert.equal(
        contents.includes(Buffer.from(forbiddenPattern, "utf8")),
        false,
        `${file}: ${forbiddenPattern}`
      );
    }
  }

  const html = readFileSync(path.join(projectRoot, "dist/index.html"), "utf8");
  assert.match(html, /rel="canonical" href="https:\/\/concoursehk\.com\/"/u);
  assert.match(html, /property="og:url" content="https:\/\/concoursehk\.com\/"/u);
  assert.match(html, /const CONCOURSE_BUILD_PROFILE = "beta-timetable-preview";/u);
  assert.match(html, /const CONCOURSE_SAFE_PREVIEW = CONCOURSE_BUILD_PROFILE !== "production";/u);
  assert.match(html, /const SUPABASE_URL = "";/u);
  assert.match(html, /const SUPABASE_PUBLISHABLE_KEY = "";/u);
  assert.match(html, /const SUPABASE_CONFIGURED = false;/u);
  assert.match(html, /authClient = null;/u);
  assert.doesNotMatch(html, /@supabase\/supabase-js/u);
  assert.doesNotMatch(html, /window\.supabase\.createClient/u);
  assert.doesNotMatch(html, /uqnwvxceznsxbxhkspeo|sb_publishable_|api\.ror\.org|universities\.hipolabs\.com/u);
  assert.doesNotMatch(html, /<script[^>]+(?:navigation-state|member-hub|hkbu-portal|marketplace|academic-tools)\.js/u);
  assert.match(html, /\$\("authModal"\)\.inert = true;/u);
  assert.match(html, /profileButton\.hidden = true;/u);

  const worker = await importWorker(
    readFileSync(path.join(projectRoot, "dist/_worker.js"), "utf8")
  );
  const assets = assetEnvironment();
  const betaResponse = await worker.fetch(
    new Request(`${betaOrigin}/`),
    assets.env
  );
  assert.equal(betaResponse.status, 200);
  assert.equal(await betaResponse.text(), "asset:/");
  assert.equal(betaResponse.headers.get("Cache-Control"), "private, no-store");
  assert.match(betaResponse.headers.get("X-Robots-Tag"), /noindex/u);
  assert.match(betaResponse.headers.get("Content-Security-Policy"), /connect-src 'none'/u);
  assert.doesNotMatch(betaResponse.headers.get("Content-Security-Policy"), /supabase/u);
  assert.equal(betaResponse.headers.has("WWW-Authenticate"), false);
  assert.equal(assets.requestCount(), 1);

  for (const disabledPath of [
    "/api/coursekeys/resources",
    "/assistant/",
    "/course-tools/",
    "/coursekeys/",
    "/courses/",
    "/data/hkbu-catalogue-current.json",
    "/downloads/concourse-hkbu-portal-connector.zip"
  ]) {
    const disabledResponse = await worker.fetch(
      new Request(`${betaOrigin}${disabledPath}`),
      assets.env
    );
    assert.equal(disabledResponse.status, 404, disabledPath);
  }
  assert.equal(assets.requestCount(), 1);

  const mutationResponse = await worker.fetch(
    new Request(`${betaOrigin}/`, {method:"POST"}),
    assets.env
  );
  assert.equal(mutationResponse.status, 405);
  assert.equal(mutationResponse.headers.get("Allow"), "GET, HEAD");
  assert.equal(assets.requestCount(), 1);

  const productionResponse = await worker.fetch(
    new Request(`${productionOrigin}/`),
    assets.env
  );
  assert.equal(productionResponse.status, 421);

  const previewResponse = await worker.fetch(
    new Request("https://beta.concourse-95c.pages.dev/"),
    assets.env
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
