const CANONICAL_ORIGIN = "https://concoursehk.com";

function canonicalLocation(url) {
  const canonical = new URL(CANONICAL_ORIGIN);
  canonical.pathname = url.pathname;
  canonical.search = url.search;
  return canonical.href;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.origin !== CANONICAL_ORIGIN) {
      return new Response(null, {
        status: 308,
        headers: {
          "Cache-Control": "public, max-age=3600",
          "Location": canonicalLocation(url),
          "X-Robots-Tag": "noindex"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
