import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../supabase/functions/validate-school-verification-evidence/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const readme = readFileSync(
  new URL(
    "../supabase/functions/validate-school-verification-evidence/README.md",
    import.meta.url,
  ),
  "utf8",
);

test("validator requires an authenticated bounded JSON POST from an allowed origin", () => {
  assert.match(source, /MAX_REQUEST_BYTES = 512/);
  assert.match(source, /request\.method === "OPTIONS"/);
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /application\\\/\(\?:\[a-z0-9\._-\]\+\\\+\)\?json/);
  assert.match(source, /Object\.keys\(record\)\.length !== 1/);
  assert.match(source, /createSupabaseContext\([\s\S]*?\{ auth: "user" \}/);
  assert.match(source, /VERIFICATION_ALLOWED_ORIGINS/);
  assert.doesNotMatch(source, /VERIFICATION_ALLOWED_HOST_SUFFIXES|ALLOWED_HOST_SUFFIXES/);
  assert.match(source, /CONFIGURED_ORIGINS\.has\(value\.origin\)/);
  assert.match(source, /"Cache-Control": "no-store, max-age=0"/);
  assert.match(source, /"X-Content-Type-Options": "nosniff"/);
});

test("the user-scoped RPC supplies the only exact validation target", () => {
  assert.match(
    source,
    /\.rpc\(\s*"get_my_school_verification_evidence_validation_target",\s*\{\s*p_evidence_id: evidenceId\s*\}/,
  );
  assert.match(source, /row\.storage_path/);
  assert.match(source, /row\.mime_type/);
  assert.match(source, /row\.declared_size_bytes/);
  assert.match(source, /storagePath\.split\("\/"\)\.some/);
  assert.match(source, /MIME_EXTENSIONS\[mimeType\]/);
});

test("private downloads are service-role scoped, size capped, and exact", () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /createClient\(supabaseUrl, serviceRoleKey/);
  assert.match(source, /EVIDENCE_BUCKET = "school-verification-evidence"/);
  assert.match(source, /\.from\(EVIDENCE_BUCKET\)\s*\.download\(target\.storagePath\)/);
  assert.match(source, /MAX_EVIDENCE_BYTES = 8 \* 1024 \* 1024/);
  assert.match(source, /data\.size !== target\.declaredSizeBytes/);
  assert.match(source, /bytes\.byteLength !== target\.declaredSizeBytes/);
});

test("JPEG PNG and WebP require real container structure", () => {
  assert.match(source, /bytes\[0\] !== 0xff[\s\S]*?bytes\[1\] !== 0xd8/);
  assert.match(source, /bytes\[bytes\.length - 2\] !== 0xff/);
  assert.match(source, /hasFrame[\s\S]*?hasScan/);
  assert.match(source, /0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a/);
  assert.match(source, /actualCrc !== expectedCrc/);
  assert.match(source, /type !== "IHDR"[\s\S]*?type === "IDAT"[\s\S]*?type === "IEND"/);
  assert.match(source, /ascii\(bytes, 0, 4\) !== "RIFF"/);
  assert.match(source, /ascii\(bytes, 8, 4\) !== "WEBP"/);
  assert.match(source, /readUint32LE\(bytes, 4\) \+ 8 !== bytes\.length/);
  assert.match(source, /"VP8 "[\s\S]*?"VP8L"[\s\S]*?"VP8X"[\s\S]*?"ANMF"/);
});

test("PDF validation rejects active content encryption and hidden object streams", () => {
  assert.match(source, /\^%PDF-/);
  assert.match(source, /text\.lastIndexOf\("%%EOF"\)/);
  assert.match(source, /PDF_EOF_WINDOW_BYTES = 2048/);
  assert.match(source, /startxref/);
  for (const token of [
    "JavaScript",
    "Launch",
    "EmbeddedFile",
    "OpenAction",
    "RichMedia",
    "XFA",
    "Encrypt",
    "ObjStm",
  ]) {
    assert.match(source, new RegExp(`\\["${token}",`));
  }
  assert.match(source, /#\(\[0-9a-f\]\{2\}\)/);
});

test("the validator hashes privately and completes only through the service RPC", () => {
  assert.match(source, /crypto\.subtle\.digest\("SHA-256", bytes\)/);
  assert.match(
    source,
    /\.rpc\(\s*"complete_school_verification_evidence_validation"/,
  );
  assert.match(source, /p_validation_status: validationStatus/);
  assert.match(source, /p_content_sha256: contentSha256/);
  assert.match(source, /p_validation_error_code: validationErrorCode/);
  assert.match(source, /if \(error \|\| data !== true\)/);
  assert.match(source, /"validated"/);
  assert.match(source, /"rejected"/);
  assert.doesNotMatch(
    source,
    /jsonResponse\([^;]*?(?:storagePath|storage_path|contentSha256|content_sha256)/,
    "responses must not expose private paths or hashes",
  );
});

test("rejected evidence is recorded and removed through the Storage API", () => {
  const rejection = source.match(
    /async function recordRejection\([\s\S]*?\n\}/,
  )?.[0] || "";
  assert.match(rejection, /completeValidation\([\s\S]*?"rejected"/);
  assert.match(rejection, /"rejected",\s*null,\s*errorCode/);
  assert.match(rejection, /deleteRejectedObject\(serviceClient, target\.storagePath\)/);
  assert.match(source, /\.from\(EVIDENCE_BUCKET\)\s*\.remove\(\[storagePath\]\)/);
  assert.match(source, /for \(let attempt = 0; attempt < 2/);
  assert.match(
    source,
    /bytes = await downloadEvidence\(serviceClient, target\);[\s\S]*?validateEvidence\(bytes, target\.mimeType\);[\s\S]*?recordRejection\(/,
  );
});

test("deployment documentation keeps JWT verification on and states the security boundary", () => {
  assert.match(readme, /structural and active-content validation, not antivirus or malware[\s\S]*?scanning/i);
  assert.match(
    readme,
    /supabase functions deploy validate-school-verification-evidence(?:\s|$)/,
  );
  assert.match(readme, /Do not use `--no-verify-jwt`/);
  assert.match(readme, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(readme, /Never expose the service-role key to the browser/);
  assert.match(readme, /Only exact origins/i);
  assert.match(readme, /unrelated `pages\.dev` or `github\.io` site is not trusted/i);
});
