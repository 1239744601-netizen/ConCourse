/*
 * Cloudflare Pages Function boundary for the integrated CourseKeys preview.
 *
 * This route intentionally does not read or write D1/R2 yet. The approved
 * prototype's metadata schema and private quarantine binding are retained in
 * coursekeys/cloudflare/, but ConCourse uses Supabase authentication rather
 * than the prototype's trusted Sites identity header. Keeping this route
 * fail-closed prevents a browser-supplied identity from reaching storage.
 */

const INTEGRATION_LOCKED = true;

function enabled(value) {
  return value === "true";
}

function capabilityState(env = {}) {
  return Object.freeze({
    secureAuth: enabled(env.COURSEKEYS_SECURE_AUTH_READY),
    verification: enabled(env.COURSEKEYS_VERIFICATION_READY),
    scanning: enabled(env.COURSEKEYS_SCANNING_READY),
    moderation: enabled(env.COURSEKEYS_MODERATION_READY),
    quotas: enabled(env.COURSEKEYS_QUOTAS_READY),
    deletion: enabled(env.COURSEKEYS_DELETION_READY),
    ledger: enabled(env.COURSEKEYS_LEDGER_READY),
    uploads: false,
    publishing: false,
    downloads: false,
    transactions: false,
  });
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function onRequestGet(context) {
  return json({
    courseKeys: "preview",
    integrationLocked: INTEGRATION_LOCKED,
    storage: {
      metadataBinding: "DB",
      quarantineBinding: "COURSE_MATERIALS",
      quarantinePrivate: true,
    },
    capabilities: capabilityState(context.env),
    message:
      "Course workspaces are available. Uploads, publication, downloads, and transactions are disabled.",
  });
}

export async function onRequestPost() {
  return json(
    {
      integrationLocked: INTEGRATION_LOCKED,
      message:
        "CourseKeys uploads remain disabled until server authentication, verification, scanning, moderation, quotas, deletion, and ledger enforcement are complete.",
    },
    503,
  );
}

export async function onRequestPut() {
  return json({ message: "CourseKeys mutation routes are disabled." }, 405);
}

export async function onRequestPatch() {
  return json({ message: "CourseKeys mutation routes are disabled." }, 405);
}

export async function onRequestDelete() {
  return json({ message: "CourseKeys deletion is not active." }, 405);
}
