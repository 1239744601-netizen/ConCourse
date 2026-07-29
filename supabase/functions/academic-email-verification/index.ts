// ConCourse academic-email ownership challenge.
//
// Keep Supabase platform JWT verification enabled. The browser never receives
// the OTP pepper or service-role key, and the database stores only a peppered
// HMAC-SHA-256 digest of each eight-digit code.

import { createSupabaseContext } from "npm:@supabase/server@^1";

const MAX_REQUEST_BYTES = 1024;
const CODE_LENGTH = 8;
const CODE_RANGE = 100_000_000;
const EMAIL_TIMEOUT_MS = 12_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu;

type JsonRecord = Record<string, unknown>;
type SupabaseRpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

class HttpError extends Error {
  status: number;
  code: string;
  retryAfter?: number;

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

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

function responseHeaders(origin: string | null, retryAfter?: number): HeadersInit {
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
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return headers;
}

function jsonResponse(
  origin: string | null,
  body: unknown,
  status = 200,
  retryAfter?: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin, retryAfter),
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asRpcRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return value.length === 1 ? asRecord(value[0]) : null;
  return asRecord(value);
}

async function readJsonRequest(request: Request): Promise<JsonRecord> {
  const contentType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLocaleLowerCase();
  if (!/^application\/(?:[a-z0-9._-]+\+)?json$/u.test(contentType)) {
    throw new HttpError(415, "unsupported_request", "Send this request as JSON.");
  }

  const lengthHeader = request.headers.get("content-length");
  if (
    lengthHeader
    && (!/^\d+$/u.test(lengthHeader) || Number(lengthHeader) > MAX_REQUEST_BYTES)
  ) {
    throw new HttpError(413, "request_too_large", "The request is too large.");
  }
  if (!request.body) {
    throw new HttpError(400, "invalid_json", "Send a valid JSON request.");
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
        throw new HttpError(413, "request_too_large", "The request is too large.");
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
    throw new HttpError(400, "invalid_json", "Send valid UTF-8 JSON.");
  }

  try {
    const parsed = JSON.parse(text);
    const record = asRecord(parsed);
    if (!record) throw new Error("not_object");
    return record;
  } catch (_error) {
    throw new HttpError(400, "invalid_json", "Send a valid JSON request.");
  }
}

function exactKeys(payload: JsonRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(payload).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function parseEmail(value: unknown): string {
  const email = typeof value === "string"
    ? value.trim().toLocaleLowerCase()
    : "";
  const localPart = email.split("@", 1)[0] || "";
  if (
    email.length < 6
    || email.length > 254
    || !EMAIL_PATTERN.test(email)
    || localPart.startsWith(".")
    || localPart.endsWith(".")
    || localPart.includes("..")
  ) {
    throw new HttpError(
      400,
      "invalid_academic_email",
      "Enter a valid academic email address.",
    );
  }
  return email;
}

function parseUuid(value: unknown): string {
  const id = typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  if (!UUID_PATTERN.test(id)) {
    throw new HttpError(400, "invalid_challenge", "Request a new verification code.");
  }
  return id;
}

function parseCode(value: unknown): string {
  const code = typeof value === "string" ? value.trim() : "";
  if (!new RegExp(`^\\d{${CODE_LENGTH}}$`, "u").test(code)) {
    throw new HttpError(400, "invalid_code", `Enter the ${CODE_LENGTH}-digit code.`);
  }
  return code;
}

function otpPepper(): string {
  const pepper = Deno.env.get("ACADEMIC_EMAIL_OTP_PEPPER") || "";
  if (pepper.length < 32) {
    throw new HttpError(
      503,
      "verification_not_configured",
      "Email verification is not configured.",
    );
  }
  return pepper;
}

function generateCode(): string {
  const maximum = Math.floor(0x1_0000_0000 / CODE_RANGE) * CODE_RANGE;
  const random = new Uint32Array(1);
  do {
    crypto.getRandomValues(random);
  } while (random[0] >= maximum);
  return String(random[0] % CODE_RANGE).padStart(CODE_LENGTH, "0");
}

async function hmacCode(
  pepper: string,
  challengeId: string,
  userId: string,
  email: string,
  code: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${challengeId}|${userId}|${email}|${code}`),
  ));
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseTarget(value: unknown): {
  userId: string;
  email: string;
  maskedEmail: string;
} {
  const target = asRpcRecord(value);
  if (!target) {
    throw new HttpError(409, "verification_unavailable", "Email verification is unavailable.");
  }
  const userId = parseUuid(target.user_id);
  const email = parseEmail(target.normalized_email);
  const maskedEmail = typeof target.masked_email === "string"
    ? target.masked_email.slice(0, 300)
    : "";
  if (!maskedEmail) {
    throw new HttpError(409, "verification_unavailable", "Email verification is unavailable.");
  }
  return { userId, email, maskedEmail };
}

async function userRpc(
  client: SupabaseRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const record = asRecord(error);
    const code = String(record?.code || "").toLocaleLowerCase();
    const message = [
      record?.message,
      record?.details,
      record?.hint,
    ].map((value) => String(value || "")).join(" ");
    if (
      code === "pgrst202"
      || code === "42883"
      || /function .* does not exist|schema cache/iu.test(message)
    ) {
      throw new HttpError(
        503,
        "verification_not_configured",
        "Academic email verification is not configured.",
      );
    }
    if (/confirm your concourse account email|confirmed concourse account required/iu.test(message)) {
      throw new HttpError(
        409,
        "account_email_unconfirmed",
        "Confirm your ConCourse account email first.",
      );
    }
    if (/already verified/iu.test(message)) {
      throw new HttpError(409, "already_verified", "Student status is already verified.");
    }
    if (/already being reviewed|request is already active/iu.test(message)) {
      throw new HttpError(
        409,
        "review_already_active",
        "A student-status review is already active.",
      );
    }
    if (/approved academic email|academic email domain|claimed institution/iu.test(message)) {
      throw new HttpError(
        409,
        "academic_email_not_allowed",
        "Use an approved academic email for the claimed institution.",
      );
    }
    if (/complete your school profile|school membership|mapped to one supported institution/iu.test(message)) {
      throw new HttpError(
        409,
        "school_profile_required",
        "Complete the school profile before verifying an academic email.",
      );
    }
    throw new HttpError(
      409,
      "verification_unavailable",
      "Academic email verification is unavailable. Try again.",
    );
  }
  return data;
}

async function serviceRpc(
  client: SupabaseRpcClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const record = asRecord(error);
    const code = String(record?.code || "").toLocaleLowerCase();
    const message = [
      record?.message,
      record?.details,
      record?.hint,
    ].map((value) => String(value || "")).join(" ");
    if (/wait before|hourly|daily|too many codes/iu.test(message)) {
      throw new HttpError(429, "rate_limited", "Please wait before requesting another code.", 60);
    }
    if (
      code === "pgrst202"
      || code === "42883"
      || /function .* does not exist|schema cache/iu.test(message)
    ) {
      throw new HttpError(
        503,
        "verification_not_configured",
        "Academic email verification is not configured.",
      );
    }
    if (/already being reviewed|request is already active/iu.test(message)) {
      throw new HttpError(
        409,
        "review_already_active",
        "A student-status review is already active.",
      );
    }
    if (/approved academic email|academic email domain|claimed institution/iu.test(message)) {
      throw new HttpError(
        409,
        "academic_email_not_allowed",
        "Use an approved academic email for the claimed institution.",
      );
    }
    if (/confirmed concourse account required/iu.test(message)) {
      throw new HttpError(
        409,
        "account_email_unconfirmed",
        "Confirm your ConCourse account email first.",
      );
    }
    throw new HttpError(
      503,
      "verification_unavailable",
      "Email verification is temporarily unavailable. Try again.",
    );
  }
  return data;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function emailConfig(): {
  provider: "resend" | "brevo";
  apiKey: string;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
} {
  const provider = (Deno.env.get("ACADEMIC_EMAIL_PROVIDER") || "")
    .trim()
    .toLocaleLowerCase();
  if (provider !== "resend" && provider !== "brevo") {
    throw new HttpError(
      503,
      "verification_not_configured",
      "Email verification is not configured.",
    );
  }
  const apiKey = provider === "resend"
    ? Deno.env.get("RESEND_API_KEY") || ""
    : Deno.env.get("BREVO_API_KEY") || "";
  const fromName = (Deno.env.get("ACADEMIC_EMAIL_FROM_NAME") || "ConCourse")
    .trim()
    .slice(0, 80);
  const rawReplyTo = (Deno.env.get("ACADEMIC_EMAIL_REPLY_TO") || "").trim();
  let fromAddress = "";
  let replyTo: string | undefined;
  try {
    fromAddress = parseEmail(Deno.env.get("ACADEMIC_EMAIL_FROM_ADDRESS") || "");
    replyTo = rawReplyTo ? parseEmail(rawReplyTo) : undefined;
  } catch (_error) {
    throw new HttpError(
      503,
      "verification_not_configured",
      "Email verification is not configured.",
    );
  }
  if (apiKey.length < 16 || !fromName) {
    throw new HttpError(
      503,
      "verification_not_configured",
      "Email verification is not configured.",
    );
  }
  return { provider, apiKey, fromAddress, fromName, replyTo };
}

function verificationEmail(code: string): { subject: string; text: string; html: string } {
  const subject = "Your ConCourse student verification code";
  const text = [
    "Verify your academic email",
    "",
    `Your ConCourse verification code is: ${code}`,
    "",
    "This code expires in 10 minutes. After confirmation, your student status",
    "will still be reviewed by an authorised ConCourse reviewer.",
    "",
    "If you did not request this code, you can ignore this email.",
    "ConCourse Support",
  ].join("\n");
  const safeCode = escapeHtml(code);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#eef6fb;color:#071d35;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">Your ConCourse verification code expires in 10 minutes.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6fb">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #c9dce9;border-radius:28px">
          <tr><td style="padding:38px 40px 12px">
            <div style="font-size:24px;font-weight:800;color:#071d35">ConCourse</div>
            <div style="margin-top:8px;color:#52708a;font-size:13px;letter-spacing:.16em;text-transform:uppercase">Student Verification</div>
          </td></tr>
          <tr><td style="padding:18px 40px 8px">
            <h1 style="margin:0;font-size:34px;line-height:1.15;color:#071d35">Verify your academic email</h1>
            <p style="margin:18px 0 0;color:#49667f;font-size:17px;line-height:1.6">Enter this code in ConCourse. It expires in 10 minutes.</p>
          </td></tr>
          <tr><td style="padding:22px 40px">
            <div aria-label="Verification code ${safeCode}" style="padding:24px;border-radius:20px;background:#0a2a49;color:#ffffff;text-align:center;font-size:40px;font-weight:800;letter-spacing:.22em">${safeCode}</div>
          </td></tr>
          <tr><td style="padding:4px 40px 36px;color:#49667f;font-size:15px;line-height:1.6">
            <p style="margin:0">Confirming this address proves email ownership only. An authorised ConCourse reviewer still decides your student-status request.</p>
            <p style="margin:18px 0 0">If you did not request this code, you can safely ignore this email. Never share this code with anyone.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}

async function sendVerificationEmail(
  to: string,
  code: string,
): Promise<string | null> {
  const config = emailConfig();
  const message = verificationEmail(code);
  let url: string;
  let headers: Record<string, string>;
  let body: JsonRecord;

  if (config.provider === "resend") {
    url = "https://api.resend.com/emails";
    headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    };
    body = {
      from: `${config.fromName} <${config.fromAddress}>`,
      to: [to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    };
  } else {
    url = "https://api.brevo.com/v3/smtp/email";
    headers = {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
    };
    body = {
      sender: { name: config.fromName, email: config.fromAddress },
      to: [{ email: to }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html,
      ...(config.replyTo ? { replyTo: { email: config.replyTo } } : {}),
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
  } catch (_error) {
    throw new HttpError(503, "email_delivery_failed", "The email could not be sent. Try again.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(503, "email_delivery_failed", "The email could not be sent. Try again.");
  }
  let providerMessageId = "";
  try {
    const payload = asRecord(await response.json());
    providerMessageId = String(
      config.provider === "resend" ? payload?.id || "" : payload?.messageId || "",
    ).trim().slice(0, 500);
  } catch (_error) {
    // Provider acceptance is still valid when its optional receipt cannot be parsed.
  }
  return providerMessageId || null;
}

async function markDelivery(
  serviceClient: SupabaseRpcClient,
  challengeId: string,
  userId: string,
  delivered: boolean,
  failureCode: string | null,
  providerMessageId: string | null,
): Promise<void> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await serviceClient.rpc(
      "mark_academic_email_challenge_delivery",
      {
        p_challenge_id: challengeId,
        p_user_id: userId,
        p_delivered: delivered,
        p_failure_code: failureCode,
        p_provider_message_id: providerMessageId,
      },
    );
    if (!error && data === true) return;
    lastError = error;
  }
  void lastError;
  throw new HttpError(
    503,
    "delivery_state_failed",
    "The verification email state could not be recorded. Try again.",
  );
}

async function requestCode(
  userClient: SupabaseRpcClient,
  serviceClient: SupabaseRpcClient,
  payload: JsonRecord,
): Promise<JsonRecord> {
  if (!exactKeys(payload, ["action", "academic_email"])) {
    throw new HttpError(
      400,
      "invalid_request",
      "Send exactly action and academic_email.",
    );
  }
  const academicEmail = parseEmail(payload.academic_email);
  const target = parseTarget(await userRpc(
    userClient,
    "get_my_academic_email_verification_target",
    { p_academic_email: academicEmail },
  ));

  const pepper = otpPepper();
  emailConfig();
  const challengeId = crypto.randomUUID();
  const code = generateCode();
  const codeHash = await hmacCode(
    pepper,
    challengeId,
    target.userId,
    target.email,
    code,
  );

  const issueResult = asRpcRecord(await serviceRpc(
    serviceClient,
    "issue_academic_email_verification_challenge",
    {
      p_challenge_id: challengeId,
      p_user_id: target.userId,
      p_academic_email: target.email,
      p_code_hash: codeHash,
    },
  ));
  if (!issueResult || issueResult.challenge_id !== challengeId) {
    throw new HttpError(
      503,
      "verification_unavailable",
      "Email verification is temporarily unavailable. Try again.",
    );
  }

  try {
    const providerMessageId = await sendVerificationEmail(target.email, code);
    await markDelivery(
      serviceClient,
      challengeId,
      target.userId,
      true,
      null,
      providerMessageId,
    );
  } catch (error) {
    try {
      await markDelivery(
        serviceClient,
        challengeId,
        target.userId,
        false,
        "provider_delivery_failed",
        null,
      );
    } catch (_markError) {
      // Preserve the original delivery failure without exposing internals.
    }
    throw error;
  }

  return {
    status: "sent",
    challenge_id: challengeId,
    masked_email: target.maskedEmail,
    expires_in_seconds: 600,
    resend_after_seconds: 60,
  };
}

async function confirmCode(
  userClient: SupabaseRpcClient,
  serviceClient: SupabaseRpcClient,
  payload: JsonRecord,
): Promise<JsonRecord> {
  if (!exactKeys(payload, ["action", "challenge_id", "code"])) {
    throw new HttpError(
      400,
      "invalid_request",
      "Send exactly action, challenge_id, and code.",
    );
  }
  const challengeId = parseUuid(payload.challenge_id);
  const code = parseCode(payload.code);
  const target = parseTarget(await userRpc(
    userClient,
    "get_my_academic_email_challenge_target",
    { p_challenge_id: challengeId },
  ));
  const codeHash = await hmacCode(
    otpPepper(),
    challengeId,
    target.userId,
    target.email,
    code,
  );
  const result = asRpcRecord(await serviceRpc(
    serviceClient,
    "confirm_academic_email_verification_challenge",
    {
      p_challenge_id: challengeId,
      p_user_id: target.userId,
      p_code_hash: codeHash,
    },
  ));
  const status = typeof result?.status === "string" ? result.status : "";
  if (status === "submitted_for_review") {
    const requestId = parseUuid(result?.request_id);
    return {
      status,
      request_id: requestId,
      human_review_required: true,
    };
  }
  if (status === "invalid_code") {
    return {
      status,
      attempts_remaining: Number(result?.attempts_remaining) || 0,
    };
  }
  if (status === "locked") {
    throw new HttpError(
      429,
      "code_locked",
      "Too many incorrect attempts. Request a new code.",
      60,
    );
  }
  if (status === "expired") {
    throw new HttpError(410, "code_expired", "This code expired. Request a new code.");
  }
  if (status === "email_already_in_use") {
    throw new HttpError(
      409,
      "academic_email_in_use",
      "This academic email is already connected to another review.",
    );
  }
  if (status === "request_already_active") {
    throw new HttpError(
      409,
      "review_already_active",
      "A student-status review is already active.",
    );
  }
  if (status === "request_limit_reached") {
    throw new HttpError(
      429,
      "review_limit_reached",
      "The verification request limit has been reached.",
      3600,
    );
  }
  throw new HttpError(
    409,
    "verification_unavailable",
    "This verification code is unavailable. Request a new code.",
  );
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
        message: authError?.message || "Sign in before verifying an academic email.",
      }, authError?.status || 401);
    }

    try {
      const payload = await readJsonRequest(request);
      const action = typeof payload.action === "string"
        ? payload.action.trim().toLocaleLowerCase()
        : "";
      let result: JsonRecord;
      if (action === "send") {
        result = await requestCode(
          context.supabase as SupabaseRpcClient,
          context.supabaseAdmin as SupabaseRpcClient,
          payload,
        );
      } else if (action === "confirm") {
        result = await confirmCode(
          context.supabase as SupabaseRpcClient,
          context.supabaseAdmin as SupabaseRpcClient,
          payload,
        );
      } else {
        throw new HttpError(
          400,
          "invalid_action",
          "Choose send or confirm.",
        );
      }
      return jsonResponse(origin, result);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(origin, {
          error: error.code,
          message: error.message,
        }, error.status, error.retryAfter);
      }
      return jsonResponse(origin, {
        error: "verification_failed",
        message: "Email verification is temporarily unavailable. Try again.",
      }, 503);
    }
  },
};
