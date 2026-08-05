import { Buffer } from "node:buffer";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const canonicalPublicOrigin = "https://concoursehk.com";
const betaPublicOrigin = "https://beta.concoursehk.com";
const primaryConnectorOrigin = "https://concoursehk.com";
const workerOriginToken = "__CONCOURSE_DEPLOYMENT_ORIGIN__";
const buildProfileToken = "__CONCOURSE_BUILD_PROFILE__";
const supabaseSdkToken = "<!-- __CONCOURSE_SUPABASE_SDK__ -->";
const productionBuildProfile = "production";
const betaBuildProfile = "beta-timetable-preview";
const productionSupabaseSdk = `<script
  src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.6/dist/umd/supabase.js"
  integrity="sha256-DuMHOPEzedO06xqfV3c99eVcC+pkOq13OC1HMzLfS3s="
  crossorigin="anonymous"
  referrerpolicy="no-referrer"
></script>`;
const allowedDeploymentOrigins = new Set([
  canonicalPublicOrigin,
  betaPublicOrigin
]);

const publicFiles = Object.freeze([
  "index.html",
  "_headers",
  "_worker.js",
  "member-hub.css",
  "marketplace.css",
  "hkbu-portal.css",
  "concourse-navy.css",
  "concourse-controls.css",
  "marketplace-stage.css",
  "academic-tools.css",
  "concourse-theme.css",
  "concourse-art.css",
  "community-redesign.css",
  "academic-experiences.css",
  "timetable-immersive.css",
  "concourse-stabilization.css",
  "institution-portal-policy.js",
  "course-catalog.js",
  "navigation-state.js",
  "member-hub.js",
  "hkbu-portal.js",
  "marketplace.js",
  "academic-tools.js",
  "timetable-immersive.js",
  "timetable-machine-3d.mjs",
  "vendor/gsap/gsap.min.js",
  "vendor/gsap/ScrollTrigger.min.js",
  "vendor/three/three.module.min.js",
  "vendor/three/three.core.min.js",
  "vendor/three/LICENSE.txt",
  "favicon.ico",
  "concourse-favicon-32.png",
  "concourse-apple-touch-icon.png",
  "site.webmanifest",
  "concourse-favicon.svg",
  "concourse-brand-favicon.svg",
  "concourse-mark.svg",
  "concourse-icon.svg",
  "concourse-course-odyssey.webp",
  "concourse-timetable-journey-v1.png",
  "concourse-timetable-monitor-blank-v1.png",
  "concourse-timetable-machine-interior-v2.png",
  "concourse-art-community.jpg",
  "concourse-art-market.jpg",
  "concourse-art-insights-v3.jpg",
  "concourse-art-citations-v2.jpg",
  "concourse-art-messages.jpg",
  "concourse-art-profile.jpg",
  "concourse-art-citations-wheel.jpg",
  "concourse-art-citations.jpg",
  "concourse-art-insights.jpg",
  "concourse-art-planner.jpg",
  "concourse-art-timetable.jpg",
  "concourse-art-auth.jpg",
  "concourse-campus-community.jpg",
  "concourse-community-library.jpg",
  "concourse-community-club.jpg",
  "concourse-campus-market.jpg",
  "concourse-market-study-bundle.jpg",
  "concourse-market-dorm-set.jpg",
  "concourse-marketplace-og.png",
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
  "courses/assets/course-reef-sprites.webp",
  "data/hkbu-catalogue-current.json",
  "data/hkbu-2026-27-s1-catalog.json"
]);

const betaPreviewExcludedFiles = new Set([
  "navigation-state.js",
  "institution-portal-policy.js",
  "course-catalog.js",
  "member-hub.js",
  "hkbu-portal.js",
  "marketplace.js",
  "academic-tools.js"
]);
const betaPreviewExcludedPrefixes = Object.freeze([
  "assistant/",
  "course-tools/",
  "coursekeys/",
  "courses/",
  "data/"
]);
const betaPreviewRemovedScriptSources = Object.freeze([
  "navigation-state.js",
  "institution-portal-policy.js",
  "course-catalog.js",
  "member-hub.js",
  "hkbu-portal.js",
  "marketplace.js",
  "academic-tools.js"
]);
const betaForbiddenContentPatterns = Object.freeze([
  "@supabase/supabase-js",
  ".supabase.co",
  "sb_publishable_",
  "window.supabase.createClient",
  "api.ror.org",
  "universities.hipolabs.com"
]);

const publicAliases = Object.freeze([
  ["concourse-favicon-32.png", "favicon-32x32.png"],
  ["concourse-apple-touch-icon.png", "apple-touch-icon.png"],
  ["concourse-apple-touch-icon.png", "apple-touch-icon-precomposed.png"]
]);

const connectorFiles = Object.freeze([
  "manifest.json",
  "popup.html",
  "popup.css",
  "popup.js",
  "parser.js",
  "README.md"
]);

const connectorArchivePath = "downloads/concourse-hkbu-portal-connector.zip";

function normalizeDeploymentOrigin(value) {
  if (!value) {
    throw new Error("CONCOURSE_DEPLOYMENT_ORIGIN must be set");
  }
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error("CONCOURSE_DEPLOYMENT_ORIGIN must be an absolute HTTPS origin");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
  ) {
    throw new Error("CONCOURSE_DEPLOYMENT_ORIGIN must contain only an HTTPS scheme and hostname");
  }
  return parsed.origin;
}

function assertSafeRelativePath(relativePath) {
  if (
    !relativePath
    || path.isAbsolute(relativePath)
    || relativePath.split("/").includes("..")
    || relativePath.includes("\\")
  ) {
    throw new Error(`Unsafe build path: ${relativePath}`);
  }
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function replaceExactlyOnce(source, token, replacement, label) {
  const segments = source.split(token);
  if (segments.length !== 2) {
    throw new Error(`${label} token must appear exactly once`);
  }
  return segments.join(replacement);
}

function removeScriptSource(source, scriptSource) {
  const pattern = new RegExp(
    `<script\\b[^>]*\\bsrc="${escapeRegularExpression(scriptSource)}(?:\\?[^\"]*)?"[^>]*>\\s*</script>\\s*`,
    "u"
  );
  if (!pattern.test(source)) {
    throw new Error(`Missing Beta-excluded script: ${scriptSource}`);
  }
  return source.replace(pattern, "");
}

function replaceMetaContent(html, attributeName, attributeValue, content) {
  const escapedValue = escapeRegularExpression(attributeValue);
  const pattern = new RegExp(
    `(<meta\\s+${attributeName}="${escapedValue}"\\s+content=")[^"]*("\\s*\\/?>)`,
    "u"
  );
  if (!pattern.test(html)) {
    throw new Error(`Missing metadata field ${attributeName}="${attributeValue}"`);
  }
  return html.replace(pattern, `$1${content}$2`);
}

function renderIndex(source, publicOrigin, deploymentOrigin) {
  let output = source;
  output = replaceMetaContent(output, "property", "og:url", `${publicOrigin}/`);
  output = replaceMetaContent(
    output,
    "property",
    "og:image",
    `${publicOrigin}/concourse-marketplace-og.png`
  );
  output = replaceMetaContent(
    output,
    "name",
    "twitter:image",
    `${publicOrigin}/concourse-marketplace-og.png`
  );
  const isBetaPreview = deploymentOrigin === betaPublicOrigin;
  const buildProfile = isBetaPreview ? betaBuildProfile : productionBuildProfile;
  output = replaceExactlyOnce(
    output,
    buildProfileToken,
    buildProfile,
    "ConCourse build profile"
  );
  output = replaceExactlyOnce(
    output,
    supabaseSdkToken,
    isBetaPreview ? "" : productionSupabaseSdk,
    "Supabase SDK"
  );

  if (isBetaPreview) {
    for (const scriptSource of betaPreviewRemovedScriptSources) {
      output = removeScriptSource(output, scriptSource);
    }
    output = replaceExactlyOnce(
      output,
      'const SUPABASE_URL = "https://uqnwvxceznsxbxhkspeo.supabase.co";',
      'const SUPABASE_URL = "";',
      "Supabase URL"
    );
    output = replaceExactlyOnce(
      output,
      'const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Sl_mKACQoAp70JNH3og2uw_hMFXSZn4";',
      'const SUPABASE_PUBLISHABLE_KEY = "";',
      "Supabase publishable key"
    );
    output = replaceExactlyOnce(
      output,
      'const ROR_DIRECTORY_URL = "https://api.ror.org/v2/organizations";',
      'const ROR_DIRECTORY_URL = "";',
      "ROR directory URL"
    );
    output = replaceExactlyOnce(
      output,
      'const HIPO_DIRECTORY_URL = "https://universities.hipolabs.com/search";',
      'const HIPO_DIRECTORY_URL = "";',
      "HIPO directory URL"
    );
    output = replaceExactlyOnce(
      output,
      `const SUPABASE_CONFIGURED =
  !CONCOURSE_SAFE_PREVIEW &&
  /^https:\\/\\/.+\\.supabase\\.co$/.test(SUPABASE_URL) &&
  !SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_");`,
      "const SUPABASE_CONFIGURED = false;",
      "Supabase configured guard"
    );
    output = replaceExactlyOnce(
      output,
      "authClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);",
      "authClient = null;",
      "Supabase client initialization"
    );
    for (const forbiddenPattern of betaForbiddenContentPatterns) {
      if (output.includes(forbiddenPattern)) {
        throw new Error(`Beta Timetable preview contains forbidden dependency: ${forbiddenPattern}`);
      }
    }
    if (!output.includes(`const CONCOURSE_BUILD_PROFILE = "${betaBuildProfile}";`)) {
      throw new Error("Beta Timetable preview profile injection failed");
    }
  }
  return output;
}

function renderWorker(source, deploymentOrigin) {
  const segments = source.split(workerOriginToken);
  if (segments.length !== 2) {
    throw new Error("Pages worker must contain exactly one deployment-origin token");
  }
  const rendered = segments.join(deploymentOrigin);
  if (rendered.includes(workerOriginToken)) {
    throw new Error("Pages worker deployment-origin injection failed");
  }
  return rendered;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  endRecord.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

async function readRequiredFile(relativePath) {
  assertSafeRelativePath(relativePath);
  const sourcePath = path.join(projectRoot, relativePath);
  const stats = await lstat(sourcePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Build input must be a regular file: ${relativePath}`);
  }
  return readFile(sourcePath);
}

async function writeBuildFile(stagingDirectory, relativePath, data) {
  assertSafeRelativePath(relativePath);
  const destination = path.join(stagingDirectory, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

async function listOutputFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await listOutputFiles(path.join(directory, entry.name), relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Unexpected non-file build output: ${relativePath}`);
    }
  }
  return files;
}

async function build() {
  const deploymentOrigin = normalizeDeploymentOrigin(
    process.env.CONCOURSE_DEPLOYMENT_ORIGIN
  );
  if (!allowedDeploymentOrigins.has(deploymentOrigin)) {
    throw new Error(
      `CONCOURSE_DEPLOYMENT_ORIGIN must be ${canonicalPublicOrigin} or ${betaPublicOrigin}`
    );
  }
  const publicOrigin = canonicalPublicOrigin;
  const isBetaPreview = deploymentOrigin === betaPublicOrigin;
  const filesToPublish = isBetaPreview
    ? publicFiles.filter(relativePath =>
        !betaPreviewExcludedFiles.has(relativePath)
        && !betaPreviewExcludedPrefixes.some(prefix => relativePath.startsWith(prefix))
      )
    : [...publicFiles];
  let stagingDirectory = await mkdtemp(path.join(projectRoot, ".pages-build-"));
  try {
    for (const relativePath of filesToPublish) {
      const source = await readRequiredFile(relativePath);
      let output = source;
      if (relativePath === "index.html") {
        output = Buffer.from(
          renderIndex(source.toString("utf8"), publicOrigin, deploymentOrigin),
          "utf8"
        );
      } else if (relativePath === "_worker.js") {
        output = Buffer.from(
          renderWorker(source.toString("utf8"), deploymentOrigin),
          "utf8"
        );
      }
      await writeBuildFile(stagingDirectory, relativePath, output);
    }

    for (const [sourcePath, destinationPath] of publicAliases) {
      await writeBuildFile(
        stagingDirectory,
        destinationPath,
        await readRequiredFile(sourcePath)
      );
    }

    if (!isBetaPreview) {
      const connectorEntries = [];
      for (const fileName of connectorFiles) {
        const relativePath = `extensions/hkbu-portal-connector/${fileName}`;
        let source = await readRequiredFile(relativePath);
        if (fileName === "popup.js") {
          const rendered = source.toString("utf8").replaceAll(
            primaryConnectorOrigin,
            deploymentOrigin
          );
          const connectorOriginIsIsolated = [...allowedDeploymentOrigins].every(
            allowedOrigin =>
              rendered.includes(allowedOrigin) === (allowedOrigin === deploymentOrigin)
          );
          if (!connectorOriginIsIsolated) {
            throw new Error("Connector origin injection failed");
          }
          source = Buffer.from(rendered, "utf8");
        }
        connectorEntries.push({
          name: `hkbu-portal-connector/${fileName}`,
          data: source
        });
      }
      await writeBuildFile(
        stagingDirectory,
        connectorArchivePath,
        createStoredZip(connectorEntries)
      );
    }

    const expectedFiles = [
      ...filesToPublish,
      ...publicAliases.map(([, destinationPath]) => destinationPath),
      ...(!isBetaPreview ? [connectorArchivePath] : [])
    ].sort();
    const actualFiles = (await listOutputFiles(stagingDirectory)).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error("Build output differs from the explicit public allowlist");
    }
    const forbidden = actualFiles.filter(file =>
      /\.(?:sql|md|patch)$/iu.test(file)
      || file.startsWith("tests/")
      || file.startsWith("supabase/")
    );
    if (forbidden.length) {
      throw new Error(`Forbidden public files: ${forbidden.join(", ")}`);
    }
    if (isBetaPreview) {
      for (const file of actualFiles) {
        const contents = await readFile(path.join(stagingDirectory, file));
        for (const forbiddenPattern of betaForbiddenContentPatterns) {
          if (contents.includes(Buffer.from(forbiddenPattern, "utf8"))) {
            throw new Error(
              `Beta Timetable preview file ${file} contains forbidden dependency: ${forbiddenPattern}`
            );
          }
        }
      }
    }

    await rm(distDirectory, { recursive: true, force: true });
    await rename(stagingDirectory, distDirectory);
    stagingDirectory = "";

    const totalBytes = (await Promise.all(
      actualFiles.map(async file => (await lstat(path.join(distDirectory, file))).size)
    )).reduce((sum, size) => sum + size, 0);
    console.log(
      `Built ${actualFiles.length} allowlisted files (${totalBytes} bytes) for ${deploymentOrigin}`
    );
  } finally {
    if (stagingDirectory) {
      await rm(stagingDirectory, { recursive: true, force: true });
    }
  }
}

await build();
