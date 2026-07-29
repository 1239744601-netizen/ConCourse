// ConCourse private school-verification evidence retention worker.
//
// This is a server-to-server endpoint. Deploy it without platform JWT
// verification and protect it with SCHOOL_VERIFICATION_CLEANUP_SECRET. The
// function deliberately rejects browser origins and any bearer/API key other
// than the configured service-role key. The service-role client is used only
// for the two cleanup RPCs and exact Storage paths returned by the batch RPC.

import { createClient } from "jsr:@supabase/supabase-js@2";

const EVIDENCE_BUCKET = "school-verification-evidence";
const MAX_REQUEST_BYTES = 64;
const MAX_BATCH_SIZE = 100;
const DEFAULT_BATCH_SIZE = 50;
const REMOVE_CHUNK_SIZE = 20;
const MIN_SECRET_BYTES = 32;
const MAX_SECRET_CHARACTERS = 512;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PRIVATE_EVIDENCE_PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/requests\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(pdf|jpe?g|png|webp)$/iu;

type JsonRecord = Record<string, unknown>;

type CleanupTarget = {
  evidenceId: string;
  storagePath: string;
};

type ServiceClient = ReturnType<typeof createClient>;

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function responseHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(extra),
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function configuredBatchSize(): number {
  const raw = Deno.env.get("SCHOOL_VERIFICATION_CLEANUP_BATCH_LIMIT") || "";
  if (!/^\d{1,3}$/u.test(raw)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Number(raw)));
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function constantTimeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function requireServerAuthorization(
  request: Request,
  cleanupSecret: string,
  serviceRoleKey: string,
): Promise<void> {
  if (
    utf8Length(cleanupSecret) < MIN_SECRET_BYTES
    || cleanupSecret.length > MAX_SECRET_CHARACTERS
  ) {
    throw new HttpError(
      503,
      "cleanup_not_configured",
      "Evidence cleanup is not configured.",
    );
  }

  // This endpoint has no browser use case. Rejecting Origin and Cookie keeps a
  // leaked user session from becoming an alternate invocation mechanism.
  if (request.headers.has("origin") || request.headers.has("cookie")) {
    throw new HttpError(
      403,
      "browser_requests_not_allowed",
      "Evidence cleanup is server-only.",
    );
  }

  const providedSecret = request.headers.get("x-cleanup-secret") || "";
  if (
    !providedSecret
    || providedSecret.length > MAX_SECRET_CHARACTERS
    || !(await constantTimeEqual(providedSecret, cleanupSecret))
  ) {
    throw new HttpError(401, "invalid_cleanup_secret", "Cleanup authorization failed.");
  }

  // A schedule may omit Authorization entirely. If a bearer token or apikey is
  // supplied, it must be the service-role credential; user/anon JWTs are
  // rejected even when the cleanup secret is otherwise correct.
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Bearer ([^\s]+)$/u);
    if (!match || !(await constantTimeEqual(match[1], serviceRoleKey))) {
      throw new HttpError(401, "user_jwt_not_allowed", "Cleanup authorization failed.");
    }
  }

  const apiKey = request.headers.get("apikey");
  if (apiKey && !(await constantTimeEqual(apiKey, serviceRoleKey))) {
    throw new HttpError(401, "user_apikey_not_allowed", "Cleanup authorization failed.");
  }
}

async function readExactEmptyJson(request: Request): Promise<void> {
  const contentType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase();
  if (contentType !== "application/json") {
    throw new HttpError(415, "unsupported_request", "Send an empty JSON object.");
  }

  const lengthHeader = request.headers.get("content-length");
  if (
    lengthHeader
    && (!/^\d+$/u.test(lengthHeader) || Number(lengthHeader) > MAX_REQUEST_BYTES)
  ) {
    throw new HttpError(413, "request_too_large", "The cleanup request is too large.");
  }
  if (!request.body) {
    throw new HttpError(400, "invalid_json", "Send an empty JSON object.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "request_too_large", "The cleanup request is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    try {
      await reader.cancel();
    } catch (_cancelError) {
      // The stream may already be closed.
    }
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json", "Send a valid UTF-8 JSON request.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    throw new HttpError(400, "invalid_json", "Send an empty JSON object.");
  }
  const record = asRecord(payload);
  if (!record || Object.keys(record).length !== 0) {
    throw new HttpError(400, "invalid_request", "Send exactly an empty JSON object.");
  }
}

function parseCleanupTargets(value: unknown, limit: number): CleanupTarget[] {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > limit || value.length > MAX_BATCH_SIZE) {
    throw new HttpError(502, "invalid_cleanup_batch", "The cleanup batch was invalid.");
  }

  const ids = new Set<string>();
  const paths = new Set<string>();
  return value.map((item) => {
    const row = asRecord(item);
    const evidenceId = typeof row?.evidence_id === "string"
      ? row.evidence_id.toLocaleLowerCase()
      : "";
    const storagePath = typeof row?.storage_path === "string"
      ? row.storage_path
      : "";
    const pathMatch = storagePath.match(PRIVATE_EVIDENCE_PATH_PATTERN);
    if (
      !UUID_PATTERN.test(evidenceId)
      || !pathMatch
      || pathMatch[2].toLocaleLowerCase() !== evidenceId
      || ids.has(evidenceId)
      || paths.has(storagePath)
    ) {
      throw new HttpError(502, "invalid_cleanup_batch", "The cleanup batch was invalid.");
    }
    ids.add(evidenceId);
    paths.add(storagePath);
    return { evidenceId, storagePath };
  });
}

async function getCleanupBatch(
  serviceClient: ServiceClient,
  limit: number,
): Promise<CleanupTarget[]> {
  const { data, error } = await serviceClient.rpc(
    "get_school_verification_evidence_cleanup_batch",
    { p_limit: Math.max(1, Math.min(MAX_BATCH_SIZE, limit)) },
  );
  if (error) {
    throw new HttpError(
      503,
      "cleanup_batch_unavailable",
      "The evidence cleanup batch is unavailable.",
    );
  }
  return parseCleanupTargets(data, limit);
}

async function removeTargets(
  serviceClient: ServiceClient,
  targets: CleanupTarget[],
): Promise<{ successfulIds: string[]; failed: number }> {
  const successfulIds: string[] = [];
  let failed = 0;

  for (let offset = 0; offset < targets.length; offset += REMOVE_CHUNK_SIZE) {
    const chunk = targets.slice(offset, offset + REMOVE_CHUNK_SIZE);
    const { error } = await serviceClient.storage
      .from(EVIDENCE_BUCKET)
      .remove(chunk.map((target) => target.storagePath));
    if (error) {
      failed += chunk.length;
      continue;
    }

    // Storage remove is idempotent: a successful response means every exact
    // path is deleted or already absent. Only those IDs may be finalized.
    successfulIds.push(...chunk.map((target) => target.evidenceId));
  }

  return { successfulIds, failed };
}

function parseFinalizedCount(value: unknown, maximum: number): number {
  const record = asRecord(Array.isArray(value) && value.length === 1 ? value[0] : value);
  const candidate = record?.finalized_count ?? value;
  const count = typeof candidate === "number"
    ? candidate
    : typeof candidate === "string" && /^\d+$/u.test(candidate)
    ? Number(candidate)
    : Number.NaN;
  if (!Number.isSafeInteger(count) || count < 0 || count > maximum) {
    throw new HttpError(
      502,
      "invalid_cleanup_result",
      "The cleanup finalization result was invalid.",
    );
  }
  return count;
}

async function finalizeCleanup(
  serviceClient: ServiceClient,
  evidenceIds: string[],
): Promise<number> {
  if (!evidenceIds.length) return 0;
  const { data, error } = await serviceClient.rpc(
    "finalize_school_verification_evidence_cleanup",
    { p_evidence_ids: evidenceIds },
  );
  if (error) {
    throw new HttpError(
      503,
      "cleanup_finalize_unavailable",
      "The evidence cleanup could not be finalized.",
    );
  }
  return parseFinalizedCount(data, evidenceIds.length);
}

function createServiceClient(): ServiceClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(
      503,
      "cleanup_not_configured",
      "Evidence cleanup is not configured.",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(
      { error: { code: "method_not_allowed", message: "Use POST." } },
      405,
      { Allow: "POST" },
    );
  }

  try {
    const cleanupSecret = Deno.env.get("SCHOOL_VERIFICATION_CLEANUP_SECRET") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!serviceRoleKey) {
      throw new HttpError(
        503,
        "cleanup_not_configured",
        "Evidence cleanup is not configured.",
      );
    }
    await requireServerAuthorization(request, cleanupSecret, serviceRoleKey);
    await readExactEmptyJson(request);

    const batchLimit = configuredBatchSize();
    const serviceClient = createServiceClient();
    const targets = await getCleanupBatch(serviceClient, batchLimit);
    const { successfulIds, failed } = await removeTargets(serviceClient, targets);
    const finalized = await finalizeCleanup(serviceClient, successfulIds);

    return jsonResponse({
      scanned: targets.length,
      removed_or_absent: successfulIds.length,
      finalized,
      failed: failed + Math.max(0, successfulIds.length - finalized),
    });
  } catch (error) {
    const known = error instanceof HttpError
      ? error
      : new HttpError(500, "cleanup_failed", "Evidence cleanup failed.");
    return jsonResponse(
      { error: { code: known.code, message: known.message } },
      known.status,
    );
  }
});
