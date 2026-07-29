// ConCourse school-verification evidence validator.
//
// Keep Supabase platform JWT verification enabled. This function additionally
// authenticates the caller, obtains an owner-scoped validation target through
// an RPC, and uses the service role only for the exact object returned by that
// RPC and for the service-only completion RPC.

import { createSupabaseContext } from "jsr:@supabase/server@1.4.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EVIDENCE_BUCKET = "school-verification-evidence";
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 512;
const PDF_EOF_WINDOW_BYTES = 2048;

const MIME_EXTENSIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const normalizeOrigin = (value: string): string => {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.origin
      : "";
  } catch (_error) {
    return "";
  }
};

const CONFIGURED_ORIGINS = new Set(
  [
    ...(Deno.env.get("VERIFICATION_ALLOWED_ORIGINS") || "").split(","),
    Deno.env.get("SITE_URL") || "",
  ].map(normalizeOrigin).filter(Boolean),
);

type JsonRecord = Record<string, unknown>;

type ValidationTarget = {
  storagePath: string;
  mimeType: keyof typeof MIME_EXTENSIONS;
  declaredSizeBytes: number;
};

type UserSupabaseClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

type ServiceSupabaseClient = ReturnType<typeof createClient>;

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

class ValidationFailure extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return "";
  try {
    const value = new URL(origin);
    if (
      !["http:", "https:"].includes(value.protocol)
      || value.username
      || value.password
      || value.origin !== origin
    ) return null;
    if (CONFIGURED_ORIGINS.has(value.origin)) return value.origin;
    if (
      ["localhost", "127.0.0.1", "::1"].includes(value.hostname)
      && ["http:", "https:"].includes(value.protocol)
    ) return value.origin;
  } catch (_error) {
    // Invalid origins are rejected below.
  }
  return null;
}

function responseHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    "Cross-Origin-Resource-Policy": "same-site",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(origin: string | null, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

async function readJsonRequest(request: Request): Promise<JsonRecord> {
  const contentType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase();
  if (!/^application\/(?:[a-z0-9._-]+\+)?json$/u.test(contentType)) {
    throw new HttpError(
      415,
      "unsupported_request",
      "Send the validation request as JSON.",
    );
  }

  const lengthHeader = request.headers.get("content-length");
  if (
    lengthHeader
    && (!/^\d+$/u.test(lengthHeader) || Number(lengthHeader) > MAX_REQUEST_BYTES)
  ) {
    throw new HttpError(413, "request_too_large", "The validation request is too large.");
  }
  if (!request.body) {
    throw new HttpError(400, "invalid_json", "Send a valid JSON validation request.");
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
        throw new HttpError(413, "request_too_large", "The validation request is too large.");
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
    throw new HttpError(400, "invalid_json", "Send a valid JSON validation request.");
  }
  const record = asRecord(payload);
  if (!record || Object.keys(record).length !== 1 || !("evidence_id" in record)) {
    throw new HttpError(
      400,
      "invalid_request",
      "Send exactly one evidence_id.",
    );
  }
  return record;
}

function parseEvidenceId(payload: JsonRecord): string {
  const evidenceId = typeof payload.evidence_id === "string"
    ? payload.evidence_id.trim().toLocaleLowerCase()
    : "";
  if (!UUID_PATTERN.test(evidenceId)) {
    throw new HttpError(400, "invalid_evidence_id", "Choose valid verification evidence.");
  }
  return evidenceId;
}

function parseDeclaredSize(value: unknown): number {
  const size = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/u.test(value)
    ? Number(value)
    : Number.NaN;
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_EVIDENCE_BYTES) {
    throw new HttpError(409, "invalid_validation_target", "The evidence cannot be validated.");
  }
  return size;
}

function parseValidationTarget(value: unknown): ValidationTarget {
  const row = Array.isArray(value)
    ? value.length === 1
      ? asRecord(value[0])
      : null
    : asRecord(value);
  if (!row) {
    throw new HttpError(404, "evidence_not_available", "The evidence is not available.");
  }

  const storagePath = typeof row.storage_path === "string" ? row.storage_path : "";
  const mimeType = typeof row.mime_type === "string"
    ? row.mime_type.trim().toLocaleLowerCase()
    : "";
  const declaredSizeBytes = parseDeclaredSize(row.declared_size_bytes);

  if (
    !storagePath
    || storagePath.length > 512
    || storagePath.startsWith("/")
    || storagePath.includes("\\")
    || storagePath.includes("\0")
    || storagePath.split("/").some((part) => !part || part === "." || part === "..")
    || !(mimeType in MIME_EXTENSIONS)
  ) {
    throw new HttpError(409, "invalid_validation_target", "The evidence cannot be validated.");
  }
  const extensions = MIME_EXTENSIONS[mimeType];
  if (!extensions.some((extension) => storagePath.toLocaleLowerCase().endsWith(extension))) {
    throw new HttpError(409, "invalid_validation_target", "The evidence cannot be validated.");
  }

  return {
    storagePath,
    mimeType: mimeType as keyof typeof MIME_EXTENSIONS,
    declaredSizeBytes,
  };
}

async function getValidationTarget(
  supabase: UserSupabaseClient,
  evidenceId: string,
): Promise<ValidationTarget> {
  const { data, error } = await supabase.rpc(
    "get_my_school_verification_evidence_validation_target",
    { p_evidence_id: evidenceId },
  );
  if (error) {
    throw new HttpError(404, "evidence_not_available", "The evidence is not available.");
  }
  return parseValidationTarget(data);
}

function createServiceClient(): ServiceSupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError(
      503,
      "validator_not_configured",
      "Evidence validation is not configured.",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "concourse-evidence-validator/1.0" },
    },
  });
}

async function downloadEvidence(
  serviceClient: ServiceSupabaseClient,
  target: ValidationTarget,
): Promise<Uint8Array> {
  const { data, error } = await serviceClient.storage
    .from(EVIDENCE_BUCKET)
    .download(target.storagePath);
  if (error || !data) {
    throw new HttpError(
      503,
      "evidence_download_failed",
      "The evidence could not be inspected. Try again.",
    );
  }

  if (data.size > MAX_EVIDENCE_BYTES) {
    throw new ValidationFailure("file_too_large");
  }
  if (data.size !== target.declaredSizeBytes) {
    throw new ValidationFailure("declared_size_mismatch");
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength !== target.declaredSizeBytes) {
    throw new ValidationFailure("declared_size_mismatch");
  }
  return bytes;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3]
  ) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]
    + (bytes[offset + 1] << 8)
    + (bytes[offset + 2] << 16)
    + bytes[offset + 3] * 0x1000000
  ) >>> 0;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let output = "";
  for (let index = offset; index < offset + length; index += 1) {
    output += String.fromCharCode(bytes[index]);
  }
  return output;
}

function validateJpeg(bytes: Uint8Array): void {
  if (
    bytes.length < 20
    || bytes[0] !== 0xff
    || bytes[1] !== 0xd8
    || bytes[bytes.length - 2] !== 0xff
    || bytes[bytes.length - 1] !== 0xd9
  ) {
    throw new ValidationFailure("invalid_jpeg_signature");
  }

  const frameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  let hasFrame = false;
  let hasScan = false;

  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) throw new ValidationFailure("invalid_jpeg_structure");
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) throw new ValidationFailure("invalid_jpeg_structure");
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9) break;
    if (marker === 0x00 || marker === 0xd8) {
      throw new ValidationFailure("invalid_jpeg_structure");
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new ValidationFailure("invalid_jpeg_structure");

    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new ValidationFailure("invalid_jpeg_structure");
    }
    if (frameMarkers.has(marker)) {
      if (segmentLength < 8) throw new ValidationFailure("invalid_jpeg_structure");
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      if (!width || !height) throw new ValidationFailure("invalid_jpeg_dimensions");
      hasFrame = true;
    }
    if (marker === 0xda) {
      hasScan = true;
      break;
    }
    offset += segmentLength;
  }

  if (!hasFrame || !hasScan) throw new ValidationFailure("invalid_jpeg_structure");
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePng(bytes: Uint8Array): void {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < 45
    || !signature.every((value, index) => bytes[index] === value)
  ) {
    throw new ValidationFailure("invalid_png_signature");
  }

  let offset = 8;
  let chunkIndex = 0;
  let hasImageData = false;
  let hasEnd = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new ValidationFailure("invalid_png_structure");
    const dataLength = readUint32BE(bytes, offset);
    const chunkEnd = offset + 12 + dataLength;
    if (chunkEnd > bytes.length) throw new ValidationFailure("invalid_png_structure");
    const type = ascii(bytes, offset + 4, 4);
    if (!/^[A-Za-z]{4}$/u.test(type)) throw new ValidationFailure("invalid_png_structure");
    const expectedCrc = readUint32BE(bytes, offset + 8 + dataLength);
    const actualCrc = crc32(bytes, offset + 4, offset + 8 + dataLength);
    if (actualCrc !== expectedCrc) throw new ValidationFailure("invalid_png_crc");

    if (chunkIndex === 0) {
      if (type !== "IHDR" || dataLength !== 13) {
        throw new ValidationFailure("invalid_png_structure");
      }
      const width = readUint32BE(bytes, offset + 8);
      const height = readUint32BE(bytes, offset + 12);
      if (!width || !height) throw new ValidationFailure("invalid_png_dimensions");
    }
    if (type === "IDAT") hasImageData = true;
    if (type === "IEND") {
      if (dataLength !== 0 || chunkEnd !== bytes.length) {
        throw new ValidationFailure("invalid_png_structure");
      }
      hasEnd = true;
      break;
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }
  if (!hasImageData || !hasEnd) throw new ValidationFailure("invalid_png_structure");
}

function validateWebpChunk(type: string, bytes: Uint8Array, dataOffset: number, size: number): boolean {
  if (type === "VP8 ") {
    if (
      size < 10
      || bytes[dataOffset + 3] !== 0x9d
      || bytes[dataOffset + 4] !== 0x01
      || bytes[dataOffset + 5] !== 0x2a
    ) throw new ValidationFailure("invalid_webp_structure");
    return true;
  }
  if (type === "VP8L") {
    if (size < 5 || bytes[dataOffset] !== 0x2f) {
      throw new ValidationFailure("invalid_webp_structure");
    }
    return true;
  }
  if (type === "VP8X" && size !== 10) {
    throw new ValidationFailure("invalid_webp_structure");
  }
  if (type === "ANMF") {
    if (size < 16) throw new ValidationFailure("invalid_webp_structure");
    return true;
  }
  return false;
}

function validateWebp(bytes: Uint8Array): void {
  if (
    bytes.length < 20
    || ascii(bytes, 0, 4) !== "RIFF"
    || ascii(bytes, 8, 4) !== "WEBP"
    || readUint32LE(bytes, 4) + 8 !== bytes.length
  ) {
    throw new ValidationFailure("invalid_webp_signature");
  }

  let offset = 12;
  let hasImagePayload = false;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new ValidationFailure("invalid_webp_structure");
    const type = ascii(bytes, offset, 4);
    const size = readUint32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + size;
    if (dataEnd > bytes.length) throw new ValidationFailure("invalid_webp_structure");
    hasImagePayload = validateWebpChunk(type, bytes, dataOffset, size) || hasImagePayload;
    offset = dataEnd + (size % 2);
    if (offset > bytes.length) throw new ValidationFailure("invalid_webp_structure");
  }
  if (offset !== bytes.length || !hasImagePayload) {
    throw new ValidationFailure("invalid_webp_structure");
  }
}

function decodePdfBytes(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    const end = Math.min(bytes.length, start + chunkSize);
    let chunk = "";
    for (let index = start; index < end; index += 1) {
      chunk += String.fromCharCode(bytes[index]);
    }
    chunks.push(chunk);
  }
  return chunks.join("");
}

const PDF_DANGEROUS_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["JavaScript", "pdf_javascript_not_allowed"],
  ["JS", "pdf_javascript_not_allowed"],
  ["Launch", "pdf_launch_not_allowed"],
  ["EmbeddedFile", "pdf_embedded_file_not_allowed"],
  ["EmbeddedFiles", "pdf_embedded_file_not_allowed"],
  ["Filespec", "pdf_embedded_file_not_allowed"],
  ["OpenAction", "pdf_open_action_not_allowed"],
  ["AA", "pdf_additional_actions_not_allowed"],
  ["RichMedia", "pdf_rich_media_not_allowed"],
  ["XFA", "pdf_xfa_not_allowed"],
  ["AcroForm", "pdf_interactive_form_not_allowed"],
  ["SubmitForm", "pdf_interactive_form_not_allowed"],
  ["ImportData", "pdf_interactive_form_not_allowed"],
  ["GoToE", "pdf_embedded_file_not_allowed"],
  ["Encrypt", "pdf_encryption_not_allowed"],
  ["ObjStm", "pdf_unsupported_object_stream"],
];

function validatePdf(bytes: Uint8Array): void {
  if (bytes.length < 32) throw new ValidationFailure("invalid_pdf_signature");
  const text = decodePdfBytes(bytes);
  if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:[\r\n\t ])/u.test(text)) {
    throw new ValidationFailure("invalid_pdf_signature");
  }

  const eofIndex = text.lastIndexOf("%%EOF");
  if (
    eofIndex < 0
    || eofIndex < text.length - PDF_EOF_WINDOW_BYTES
    || !/^[\x00\t\n\f\r ]*$/u.test(text.slice(eofIndex + 5))
  ) {
    throw new ValidationFailure("invalid_pdf_eof");
  }
  const tailStart = Math.max(0, eofIndex - PDF_EOF_WINDOW_BYTES);
  if (!/startxref[\x00\t\n\f\r ]+\d+[\x00\t\n\f\r ]*%%EOF/iu.test(text.slice(tailStart))) {
    throw new ValidationFailure("invalid_pdf_xref");
  }

  // PDF names may encode characters as #xx. Decode those escapes before
  // looking for active-content dictionary keys.
  const normalizedNames = text.replace(
    /#([0-9a-f]{2})/giu,
    (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)),
  );
  for (const [name, errorCode] of PDF_DANGEROUS_NAMES) {
    const token = new RegExp(`/${name}(?![#A-Za-z0-9])`, "iu");
    if (token.test(normalizedNames)) throw new ValidationFailure(errorCode);
  }
}

function validateEvidence(bytes: Uint8Array, mimeType: string): void {
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_EVIDENCE_BYTES) {
    throw new ValidationFailure("file_size_not_allowed");
  }
  if (mimeType === "image/jpeg") return validateJpeg(bytes);
  if (mimeType === "image/png") return validatePng(bytes);
  if (mimeType === "image/webp") return validateWebp(bytes);
  if (mimeType === "application/pdf") return validatePdf(bytes);
  throw new ValidationFailure("file_type_not_allowed");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function completeValidation(
  serviceClient: ServiceSupabaseClient,
  evidenceId: string,
  validationStatus: "validated" | "rejected",
  contentSha256: string | null,
  validationErrorCode: string | null,
): Promise<void> {
  const { data, error } = await serviceClient.rpc(
    "complete_school_verification_evidence_validation",
    {
      p_evidence_id: evidenceId,
      p_validation_status: validationStatus,
      p_content_sha256: contentSha256,
      p_validation_error_code: validationErrorCode,
    },
  );
  if (error || data !== true) {
    throw new HttpError(
      503,
      "validation_completion_failed",
      "The evidence result could not be recorded. Try again.",
    );
  }
}

async function deleteRejectedObject(
  serviceClient: ServiceSupabaseClient,
  storagePath: string,
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await serviceClient.storage
      .from(EVIDENCE_BUCKET)
      .remove([storagePath]);
    if (!error) return;
    lastError = error;
  }
  void lastError;
  throw new HttpError(
    503,
    "rejection_cleanup_failed",
    "The rejected evidence is quarantined but still needs cleanup.",
  );
}

async function recordRejection(
  serviceClient: ServiceSupabaseClient,
  evidenceId: string,
  target: ValidationTarget,
  errorCode: string,
): Promise<void> {
  let completionError: unknown = null;
  try {
    await completeValidation(
      serviceClient,
      evidenceId,
      "rejected",
      null,
      errorCode,
    );
  } catch (error) {
    completionError = error;
  }

  let cleanupError: unknown = null;
  try {
    await deleteRejectedObject(serviceClient, target.storagePath);
  } catch (error) {
    cleanupError = error;
  }

  if (completionError instanceof Error) throw completionError;
  if (cleanupError instanceof Error) throw cleanupError;
}

export default {
  fetch: async (request: Request): Promise<Response> => {
    const requestOrigin = request.headers.get("origin");
    const origin = allowedOrigin(requestOrigin);
    if (requestOrigin && origin === null) {
      return jsonResponse(null, { error: "origin_not_allowed" }, 403);
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: responseHeaders(origin) });
    }
    if (request.method !== "POST") {
      return jsonResponse(origin, { error: "method_not_allowed" }, 405);
    }

    const { data: context, error: authError } = await createSupabaseContext(
      request,
      { auth: "user" },
    );
    if (authError || !context) {
      return jsonResponse(origin, {
        error: authError?.code || "authentication_required",
        message: authError?.message || "Sign in before validating evidence.",
      }, authError?.status || 401);
    }

    try {
      const payload = await readJsonRequest(request);
      const evidenceId = parseEvidenceId(payload);
      const target = await getValidationTarget(
        context.supabase as UserSupabaseClient,
        evidenceId,
      );
      const serviceClient = createServiceClient();
      let bytes: Uint8Array;
      try {
        bytes = await downloadEvidence(serviceClient, target);
        validateEvidence(bytes, target.mimeType);
      } catch (error) {
        if (!(error instanceof ValidationFailure)) throw error;
        await recordRejection(
          serviceClient,
          evidenceId,
          target,
          error.code,
        );
        return jsonResponse(origin, {
          status: "rejected",
          error: "evidence_rejected",
        }, 422);
      }

      const contentSha256 = await sha256Hex(bytes);
      await completeValidation(
        serviceClient,
        evidenceId,
        "validated",
        contentSha256,
        null,
      );
      return jsonResponse(origin, { status: "validated" });
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(origin, {
          error: error.code,
          message: error.message,
        }, error.status);
      }
      return jsonResponse(origin, {
        error: "validation_failed",
        message: "The evidence could not be validated. Try again.",
      }, 503);
    }
  },
};
