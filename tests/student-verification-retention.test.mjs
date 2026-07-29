import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../supabase/functions/purge-school-verification-evidence/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const readme = readFileSync(
  new URL(
    "../supabase/functions/purge-school-verification-evidence/README.md",
    import.meta.url,
  ),
  "utf8",
);

test("retention cleanup is a secret-protected server-only JSON POST", () => {
  assert.match(source, /request\.method !== "POST"/);
  assert.match(source, /MAX_REQUEST_BYTES = 64/);
  assert.match(source, /contentType !== "application\/json"/);
  assert.match(source, /Object\.keys\(record\)\.length !== 0/);
  assert.match(source, /SCHOOL_VERIFICATION_CLEANUP_SECRET/);
  assert.match(source, /x-cleanup-secret/);
  assert.match(source, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(source, /difference \|= leftBytes\[index\] \^ rightBytes\[index\]/);
  assert.match(source, /request\.headers\.has\("origin"\)/);
  assert.match(source, /request\.headers\.has\("cookie"\)/);
});

test("browser and user credentials cannot authorize retention cleanup", () => {
  assert.match(source, /\^Bearer \(\[\^\\s\]\+\)\$/);
  assert.match(source, /constantTimeEqual\(match\[1\], serviceRoleKey\)/);
  assert.match(source, /user_jwt_not_allowed/);
  assert.match(source, /user_apikey_not_allowed/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin/);
  assert.doesNotMatch(source, /createSupabaseContext/);
});

test("the service client uses server credentials with session persistence disabled", () => {
  assert.match(source, /SUPABASE_URL/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /createClient\(supabaseUrl, serviceRoleKey/);
  assert.match(source, /autoRefreshToken: false/);
  assert.match(source, /detectSessionInUrl: false/);
  assert.match(source, /persistSession: false/);
});

test("the batch RPC is capped and private targets are strictly validated", () => {
  assert.match(source, /MAX_BATCH_SIZE = 100/);
  assert.match(
    source,
    /\.rpc\(\s*"get_school_verification_evidence_cleanup_batch",\s*\{\s*p_limit: Math\.max\(1, Math\.min\(MAX_BATCH_SIZE, limit\)\)\s*\}/,
  );
  assert.match(source, /PRIVATE_EVIDENCE_PATH_PATTERN/);
  assert.match(source, /pathMatch\[2\]\.toLocaleLowerCase\(\) !== evidenceId/);
  assert.match(source, /ids\.has\(evidenceId\)/);
  assert.match(source, /paths\.has\(storagePath\)/);
});

test("exact private paths are removed through Storage in modest chunks", () => {
  assert.match(source, /EVIDENCE_BUCKET = "school-verification-evidence"/);
  assert.match(source, /REMOVE_CHUNK_SIZE = 20/);
  assert.match(source, /targets\.slice\(offset, offset \+ REMOVE_CHUNK_SIZE\)/);
  assert.match(
    source,
    /\.from\(EVIDENCE_BUCKET\)\s*\.remove\(chunk\.map\(\(target\) => target\.storagePath\)\)/,
  );
  assert.doesNotMatch(source, /delete\s+from\s+storage\.objects/iu);
});

test("only successfully absent or deleted evidence is finalized", () => {
  assert.match(source, /if \(error\) \{\s*failed \+= chunk\.length;\s*continue;/);
  assert.match(source, /successfulIds\.push/);
  assert.match(
    source,
    /\.rpc\(\s*"finalize_school_verification_evidence_cleanup",\s*\{\s*p_evidence_ids: evidenceIds\s*\}/,
  );
  assert.match(source, /parseFinalizedCount\(data, evidenceIds\.length\)/);
});

test("responses are private no-store count summaries", () => {
  assert.match(source, /"Cache-Control": "no-store, max-age=0"/);
  assert.match(source, /"Cross-Origin-Resource-Policy": "same-origin"/);
  assert.match(source, /scanned: targets\.length/);
  assert.match(source, /removed_or_absent: successfulIds\.length/);
  assert.match(source, /finalized/);
  assert.match(source, /failed:/);
  assert.doesNotMatch(
    source,
    /jsonResponse\([^;]*?(?:storagePath|storage_path|evidenceId|evidence_id|content_sha256|hash)/,
    "responses must not expose private identifiers, paths, or hashes",
  );
});

test("documentation covers scheduling retention and non-SQL object deletion", () => {
  assert.match(readme, /constant-time secret check/i);
  assert.match(readme, /server-to-server/i);
  assert.match(readme, /--no-verify-jwt/);
  assert.match(readme, /Storage API/i);
  assert.match(readme, /never deleted directly with SQL/i);
  assert.match(readme, /retention period/i);
  assert.match(readme, /daily is sufficient/i);
  assert.match(readme, /No deployment was performed by Codex/i);
});
