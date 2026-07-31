const SITE_ORIGIN = "__CONCOURSE_DEPLOYMENT_ORIGIN__";
const PRODUCTION_ORIGIN = "https://concoursehk.com";
const BETA_ORIGIN = "https://beta.concoursehk.com";
const BETA_USERNAME = "concourse-beta";
const ALLOWED_SITE_ORIGINS = new Set([PRODUCTION_ORIGIN, BETA_ORIGIN]);

function responseHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Content-Type": "text/html; charset=utf-8",
    "Link": `<${PRODUCTION_ORIGIN}/>; rel="canonical"`,
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet"
  };
}

function messageResponse(request, status, title, message, extraHeaders = {}) {
  const body = request.method === "HEAD"
    ? null
    : `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} · ConCourse</title>
  <style>
    :root{color-scheme:light;background:#f4f7fb;color:#10253f;font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
    main{width:min(620px,100%);background:#fff;border:1px solid #dbe4ef;border-radius:24px;padding:40px;box-sizing:border-box;box-shadow:0 18px 60px rgba(16,37,63,.12)}
    p{color:#50657c;margin:12px 0 24px}
    a{display:inline-block;color:#fff;background:#1677c8;border-radius:999px;padding:11px 18px;text-decoration:none;font-weight:700}
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${PRODUCTION_ORIGIN}/">Open ConCourse</a>
  </main>
</body>
</html>`;

  return new Response(body, {
    status,
    headers:{
      ...responseHeaders(),
      ...extraHeaders
    }
  });
}

function isPagesHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.+$/u, "");
  return normalized === "pages.dev" || normalized.endsWith(".pages.dev");
}

function enabled(value) {
  return value === "true";
}

function courseKeysCapabilities(env = {}) {
  return {
    secureAuth:enabled(env.COURSEKEYS_SECURE_AUTH_READY),
    verification:enabled(env.COURSEKEYS_VERIFICATION_READY),
    scanning:enabled(env.COURSEKEYS_SCANNING_READY),
    moderation:enabled(env.COURSEKEYS_MODERATION_READY),
    quotas:enabled(env.COURSEKEYS_QUOTAS_READY),
    deletion:enabled(env.COURSEKEYS_DELETION_READY),
    ledger:enabled(env.COURSEKEYS_LEDGER_READY),
    uploads:false,
    publishing:false,
    downloads:false,
    transactions:false
  };
}

function courseKeysJson(request, body, status = 200) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  if (SITE_ORIGIN === BETA_ORIGIN) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
  return new Response(
    request.method === "HEAD" ? null : JSON.stringify(body),
    {status, headers}
  );
}

function courseKeysResponse(request, env) {
  if (request.method === "GET" || request.method === "HEAD") {
    return courseKeysJson(request, {
      courseKeys:"preview",
      integrationLocked:true,
      storage:{
        metadataBinding:"DB",
        quarantineBinding:"COURSE_MATERIALS",
        quarantinePrivate:true
      },
      capabilities:courseKeysCapabilities(env),
      message:"Course workspaces are available. Uploads, publication, downloads, and transactions are disabled."
    });
  }
  if (request.method === "POST") {
    return courseKeysJson(request, {
      integrationLocked:true,
      message:"CourseKeys uploads remain disabled until server authentication, verification, scanning, moderation, quotas, deletion, and ledger enforcement are complete."
    }, 503);
  }
  if (request.method === "DELETE") {
    return courseKeysJson(request, {
      message:"CourseKeys deletion is not active."
    }, 405);
  }
  return courseKeysJson(request, {
    message:"CourseKeys mutation routes are disabled."
  }, 405);
}

function secureEqual(left, right) {
  const leftValue = String(left);
  const rightValue = String(right);
  const length = Math.max(leftValue.length, rightValue.length);
  let difference = leftValue.length ^ rightValue.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftValue.charCodeAt(index) || 0) ^ (rightValue.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function betaAccessState(request, env) {
  const token = typeof env.CONCOURSE_BETA_ACCESS_TOKEN === "string"
    ? env.CONCOURSE_BETA_ACCESS_TOKEN
    : "";
  if (!token) {
    return "unconfigured";
  }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Basic ")) {
    return "denied";
  }

  let supplied;
  try {
    supplied = atob(authorization.slice(6));
  } catch {
    return "denied";
  }
  return secureEqual(supplied, `${BETA_USERNAME}:${token}`)
    ? "allowed"
    : "denied";
}

export default {
  async fetch(request, env) {
    if (!ALLOWED_SITE_ORIGINS.has(SITE_ORIGIN)) {
      return messageResponse(
        request,
        503,
        "Deployment unavailable",
        "This copy was not prepared for a verified ConCourse address."
      );
    }

    const url = new URL(request.url);

    if (isPagesHostname(url.hostname)) {
      return messageResponse(
        request,
        410,
        "This address has retired",
        "Use the official ConCourse domain. Provider preview links no longer serve the application."
      );
    }

    if (url.origin !== SITE_ORIGIN) {
      return messageResponse(
        request,
        421,
        "Address not available",
        "This deployment is not authorized to serve the requested address."
      );
    }

    if (SITE_ORIGIN === BETA_ORIGIN) {
      const accessState = betaAccessState(request, env);
      if (accessState === "unconfigured") {
        return messageResponse(
          request,
          503,
          "Beta unavailable",
          "The private beta access credential has not been configured."
        );
      }
      if (accessState !== "allowed") {
        return messageResponse(
          request,
          401,
          "Private beta",
          "Sign in with the owner beta credential to review this release.",
          {"WWW-Authenticate": 'Basic realm="ConCourse Beta", charset="UTF-8"'}
        );
      }
    }

    if (
      url.pathname === "/api/coursekeys/resources"
      || url.pathname === "/api/coursekeys/resources/"
    ) {
      return courseKeysResponse(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    if (SITE_ORIGIN !== BETA_ORIGIN) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return new Response(response.body, {
      status:response.status,
      statusText:response.statusText,
      headers
    });
  }
};
