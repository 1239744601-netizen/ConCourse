import { Buffer } from "node:buffer";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const defaultPublicOrigin = "https://concourse-95c.pages.dev";
const primaryConnectorOrigin = "https://concourse-95c.pages.dev";

const publicFiles = Object.freeze([
  "index.html",
  "_headers",
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
  "concourse-stabilization.css",
  "institution-portal-policy.js",
  "course-catalog.js",
  "member-hub.js",
  "hkbu-portal.js",
  "marketplace.js",
  "academic-tools.js",
  "concourse-favicon.svg",
  "concourse-mark.svg",
  "concourse-icon.svg",
  "concourse-course-odyssey.webp",
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
  "data/hkbu-catalogue-current.json",
  "data/hkbu-2026-27-s1-catalog.json"
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

function normalizePublicOrigin(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error("CONCOURSE_PUBLIC_ORIGIN must be an absolute HTTPS origin");
  }
  if (
    parsed.protocol !== "https:"
    || parsed.username
    || parsed.password
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
  ) {
    throw new Error("CONCOURSE_PUBLIC_ORIGIN must contain only an HTTPS scheme and hostname");
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

function replaceMetaContent(html, attributeName, attributeValue, content) {
  const escapedValue = attributeValue.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(
    `(<meta\\s+${attributeName}="${escapedValue}"\\s+content=")[^"]*("\\s*\\/?>)`,
    "u"
  );
  if (!pattern.test(html)) {
    throw new Error(`Missing metadata field ${attributeName}="${attributeValue}"`);
  }
  return html.replace(pattern, `$1${content}$2`);
}

function renderIndex(source, publicOrigin) {
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
  return output;
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
  const publicOrigin = normalizePublicOrigin(
    process.env.CONCOURSE_PUBLIC_ORIGIN || defaultPublicOrigin
  );
  let stagingDirectory = await mkdtemp(path.join(projectRoot, ".pages-build-"));
  try {
    for (const relativePath of publicFiles) {
      const source = await readRequiredFile(relativePath);
      const output = relativePath === "index.html"
        ? Buffer.from(renderIndex(source.toString("utf8"), publicOrigin), "utf8")
        : source;
      await writeBuildFile(stagingDirectory, relativePath, output);
    }

    const connectorEntries = [];
    for (const fileName of connectorFiles) {
      const relativePath = `extensions/hkbu-portal-connector/${fileName}`;
      let source = await readRequiredFile(relativePath);
      if (fileName === "popup.js") {
        const rendered = source.toString("utf8").replaceAll(primaryConnectorOrigin, publicOrigin);
        if (!rendered.includes(publicOrigin)) {
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

    const expectedFiles = [...publicFiles, connectorArchivePath].sort();
    const actualFiles = (await listOutputFiles(stagingDirectory)).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error("Build output differs from the explicit public allowlist");
    }
    const forbidden = actualFiles.filter(file =>
      /\.(?:sql|md|mjs|patch)$/iu.test(file)
      || file.startsWith("tests/")
      || file.startsWith("supabase/")
    );
    if (forbidden.length) {
      throw new Error(`Forbidden public files: ${forbidden.join(", ")}`);
    }

    await rm(distDirectory, { recursive: true, force: true });
    await rename(stagingDirectory, distDirectory);
    stagingDirectory = "";

    const totalBytes = (await Promise.all(
      actualFiles.map(async file => (await lstat(path.join(distDirectory, file))).size)
    )).reduce((sum, size) => sum + size, 0);
    console.log(
      `Built ${actualFiles.length} allowlisted files (${totalBytes} bytes) for ${publicOrigin}`
    );
  } finally {
    if (stagingDirectory) {
      await rm(stagingDirectory, { recursive: true, force: true });
    }
  }
}

await build();
