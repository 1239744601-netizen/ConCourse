// ConCourse automatic website citation metadata lookup.
// Deploy as an authenticated Supabase Edge Function with JWT verification enabled.

import { createSupabaseContext } from "jsr:@supabase/server@^1";

const PRODUCTION_ORIGIN = "https://1239744601-netizen.github.io";
const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_HEAD_CHARACTERS = 512 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const DNS_TIMEOUT_MS = 2500;

type MetadataResult = {
  sourceUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  title: string;
  authors: string[];
  organization: string;
  authorType: "person" | "organization";
  siteName: string;
  publicationDate: string;
  publicationYear: string;
  language: string;
  warnings: string[];
};

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return PRODUCTION_ORIGIN;
  if (origin === PRODUCTION_ORIGIN) return origin;
  try {
    const value = new URL(origin);
    if ((value.hostname === "localhost" || value.hostname === "127.0.0.1") && ["http:", "https:"].includes(value.protocol)) {
      return origin;
    }
  } catch (_error) {
    // Invalid origins are rejected below.
  }
  return null;
}

function responseHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(origin: string, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

type UserSupabaseClient = {
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
};

async function consumeQuota(supabase: UserSupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc("consume_citation_fetch_quota");
  if (error) throw new HttpError(503, "quota_unavailable", "Citation lookup is not configured.");
  if (data !== true) throw new HttpError(429, "rate_limited", "Too many lookups. Wait one minute and try again.");
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => (/^\d{1,3}$/u.test(part) ? Number(part) : Number.NaN));
  return numbers.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? numbers : null;
}

function ipv4InRange(ip: number[], base: number[], prefix: number): boolean {
  let remaining = prefix;
  for (let index = 0; index < 4; index += 1) {
    if (remaining <= 0) return true;
    const bits = Math.min(8, remaining);
    const mask = (0xff << (8 - bits)) & 0xff;
    if ((ip[index] & mask) !== (base[index] & mask)) return false;
    remaining -= bits;
  }
  return true;
}

const BLOCKED_IPV4_RANGES: Array<[number[], number]> = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 88, 99, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
  [[240, 0, 0, 0], 4],
];

function isPublicIpv4(value: string): boolean {
  const ip = parseIpv4(value);
  return !!ip && !BLOCKED_IPV4_RANGES.some(([base, prefix]) => ipv4InRange(ip, base, prefix));
}

function parseIpv6(value: string): number[] | null {
  let input = value.toLocaleLowerCase().replace(/^\[|\]$/gu, "").split("%")[0];
  if (!input.includes(":")) return null;
  const ipv4Match = input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/u);
  if (ipv4Match) {
    const ipv4 = parseIpv4(ipv4Match[1]);
    if (!ipv4) return null;
    input = input.slice(0, -ipv4Match[1].length) + `${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
  }
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array(missing).fill("0"), ...right];
  if (words.length !== 8 || words.some((word) => !/^[\da-f]{1,4}$/u.test(word))) return null;
  return words.flatMap((word) => {
    const number = Number.parseInt(word, 16);
    return [number >> 8, number & 0xff];
  });
}

function ipv6HasPrefix(ip: number[], prefix: number[], bits: number): boolean {
  let remaining = bits;
  for (let index = 0; index < 16; index += 1) {
    if (remaining <= 0) return true;
    const count = Math.min(8, remaining);
    const mask = (0xff << (8 - count)) & 0xff;
    if ((ip[index] & mask) !== (prefix[index] & mask)) return false;
    remaining -= count;
  }
  return true;
}

const BLOCKED_IPV6_PREFIXES: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];

function isPublicIpv6(value: string): boolean {
  const ip = parseIpv6(value);
  if (!ip) return false;
  return !BLOCKED_IPV6_PREFIXES.some(([base, bits]) => {
    const prefix = parseIpv6(base);
    return !!prefix && ipv6HasPrefix(ip, prefix, bits);
  });
}

function isIpLiteral(hostname: string): boolean {
  const value = hostname.replace(/^\[|\]$/gu, "");
  return !!parseIpv4(value) || !!parseIpv6(value);
}

function isPublicIp(value: string): boolean {
  const normalized = value.replace(/^\[|\]$/gu, "");
  return normalized.includes(":") ? isPublicIpv6(normalized) : isPublicIpv4(normalized);
}

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".onion",
  ".test",
  ".invalid",
];

async function validatePublicUrl(raw: string): Promise<URL> {
  if (!raw || raw.length > MAX_URL_LENGTH || /[\\\u0000-\u001f\u007f]/u.test(raw)) {
    throw new HttpError(400, "invalid_url", "Use a complete public website URL.");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch (_error) {
    throw new HttpError(400, "invalid_url", "Use a complete public website URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new HttpError(400, "invalid_url", "Only public HTTP and HTTPS websites are supported.");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new HttpError(400, "invalid_port", "Only standard web ports are supported.");
  }
  url.hash = "";
  const hostname = url.hostname.toLocaleLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
  if (!hostname || hostname === "localhost" || hostname === "metadata.google.internal" || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new HttpError(400, "private_host", "Private or local websites cannot be fetched.");
  }
  if (isIpLiteral(hostname)) {
    if (!isPublicIp(hostname)) throw new HttpError(400, "private_address", "Private or reserved network addresses cannot be fetched.");
    return url;
  }

  const resolve = async (type: "A" | "AAAA"): Promise<string[]> => {
    try {
      return await Deno.resolveDns(hostname, type, { signal: AbortSignal.timeout(DNS_TIMEOUT_MS) }) as string[];
    } catch (_error) {
      return [];
    }
  };
  const [ipv4, ipv6] = await Promise.all([resolve("A"), resolve("AAAA")]);
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length) throw new HttpError(422, "dns_failed", "The website address could not be resolved.");
  if (addresses.some((address) => !isPublicIp(address))) {
    throw new HttpError(400, "private_address", "The website resolves to a private or reserved network address.");
  }
  return url;
}

async function fetchHtml(source: URL): Promise<{ html: string; finalUrl: URL }> {
  let current = source;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    current = await validatePublicUrl(current.href);
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9",
        "Accept-Language": "en;q=0.8",
        "User-Agent": "ConCourseCitationBot/1.0 (+https://1239744601-netizen.github.io/ConCourse/)",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) throw new HttpError(422, "redirect_limit", "The website redirected too many times.");
      const next = new URL(location, current);
      if (current.protocol === "https:" && next.protocol === "http:") throw new HttpError(422, "unsafe_redirect", "The website redirected to an insecure address.");
      current = await validatePublicUrl(next.href);
      continue;
    }
    if (!response.ok) throw new HttpError(422, "upstream_failed", "The website did not return a readable page.");
    const contentType = (response.headers.get("content-type") || "").toLocaleLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new HttpError(415, "unsupported_content", "Only HTML website pages are supported.");
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) throw new HttpError(413, "page_too_large", "The website page is too large to inspect safely.");
    if (!response.body) throw new HttpError(422, "empty_page", "The website returned an empty page.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let bytes = 0;
    let html = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "page_too_large", "The website page is too large to inspect safely.");
      }
      html += decoder.decode(value, { stream: true });
      if (html.length > MAX_HEAD_CHARACTERS || /<\/head\s*>/iu.test(html)) {
        await reader.cancel();
        break;
      }
    }
    html += decoder.decode();
    return { html: html.slice(0, MAX_HEAD_CHARACTERS), finalUrl: current };
  }
  throw new HttpError(422, "redirect_limit", "The website redirected too many times.");
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLocaleLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : match;
    }
    return named[entity.toLocaleLowerCase()] ?? match;
  });
}

function cleanText(value: unknown, limit = 600): string {
  return decodeEntities(String(value || ""))
    .replace(/<[^>]*>/gu, " ")
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, limit);
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const matcher = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(tag))) result[match[1].toLocaleLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  return result;
}

function metadataMap(html: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const match of html.matchAll(/<meta\b[^>]*>/giu)) {
    const attrs = attributes(match[0]);
    const key = cleanText(attrs.name || attrs.property || attrs.itemprop, 120).toLocaleLowerCase();
    const value = cleanText(attrs.content, 1000);
    if (!key || !value) continue;
    const values = result.get(key) || [];
    if (values.length < 20) values.push(value);
    result.set(key, values);
  }
  return result;
}

function firstMeta(map: Map<string, string[]>, names: string[]): string {
  for (const name of names) {
    const value = map.get(name.toLocaleLowerCase())?.find(Boolean);
    if (value) return value;
  }
  return "";
}

function jsonLdNodes(html: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  let totalCharacters = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)) {
    const attrs = attributes(match[1]);
    if ((attrs.type || "").split(";")[0].trim().toLocaleLowerCase() !== "application/ld+json") continue;
    const raw = match[2].trim();
    if (!raw || raw.length > 64 * 1024 || totalCharacters + raw.length > 128 * 1024) continue;
    totalCharacters += raw.length;
    try {
      const parsed = JSON.parse(raw.replace(/^\s*<!--|-->\s*$/gu, ""));
      const queue: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
      let visited = 0;
      while (queue.length && visited < 240) {
        const item = queue.shift()!;
        visited += 1;
        if (item.depth > 6 || item.value === null || typeof item.value !== "object") continue;
        if (Array.isArray(item.value)) {
          item.value.slice(0, 40).forEach((value) => queue.push({ value, depth: item.depth + 1 }));
          continue;
        }
        const object = item.value as Record<string, unknown>;
        result.push(object);
        Object.values(object).slice(0, 40).forEach((value) => {
          if (value && typeof value === "object") queue.push({ value, depth: item.depth + 1 });
        });
      }
    } catch (_error) {
      // Invalid JSON-LD is ignored; normal metadata fallbacks remain available.
    }
  }
  return result.slice(0, 240);
}

function typeNames(node: Record<string, unknown>): string[] {
  const value = node["@type"];
  return (Array.isArray(value) ? value : [value]).map((type) => cleanText(type, 80).toLocaleLowerCase()).filter(Boolean);
}

function nameFrom(value: unknown): string {
  if (typeof value === "string") return cleanText(value);
  if (value && typeof value === "object" && !Array.isArray(value)) return cleanText((value as Record<string, unknown>).name);
  return "";
}

function authorsFromJson(value: unknown): { people: string[]; organization: string } {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const people: string[] = [];
  let organization = "";
  values.slice(0, 20).forEach((author) => {
    if (typeof author === "string") {
      const name = cleanText(author, 250);
      if (name) people.push(name);
      return;
    }
    if (!author || typeof author !== "object" || Array.isArray(author)) return;
    const object = author as Record<string, unknown>;
    const name = cleanText(object.name, 250) || [cleanText(object.givenName, 120), cleanText(object.familyName, 120)].filter(Boolean).join(" ");
    if (!name) return;
    if (typeNames(object).includes("organization")) organization ||= name;
    else people.push(name);
  });
  return { people: [...new Set(people)].slice(0, 20), organization };
}

function normalizedDate(value: unknown): string {
  const raw = cleanText(value, 100);
  if (!raw) return "";
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (direct) {
    const date = new Date(`${direct[1]}-${direct[2]}-${direct[3]}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === `${direct[1]}-${direct[2]}-${direct[3]}`) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function sameOriginCanonical(html: string, finalUrl: URL, meta: Map<string, string[]>): string {
  let candidate = "";
  for (const match of html.matchAll(/<link\b[^>]*>/giu)) {
    const attrs = attributes(match[0]);
    if ((attrs.rel || "").toLocaleLowerCase().split(/\s+/u).includes("canonical")) {
      candidate = attrs.href || "";
      break;
    }
  }
  candidate ||= firstMeta(meta, ["og:url"]);
  try {
    const url = new URL(candidate || finalUrl.href, finalUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.origin !== finalUrl.origin) return finalUrl.href;
    url.hash = "";
    return url.href;
  } catch (_error) {
    return finalUrl.href;
  }
}

function extractMetadata(html: string, sourceUrl: URL, finalUrl: URL): MetadataResult {
  const meta = metadataMap(html);
  const nodes = jsonLdNodes(html);
  const preferredTypes = new Set(["newsarticle", "article", "scholarlyarticle", "techarticle", "blogposting", "webpage"]);
  const primary = nodes.find((node) => typeNames(node).some((type) => preferredTypes.has(type))) || nodes[0] || {};

  const titleTag = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu)?.[1], 600);
  const title = firstMeta(meta, ["citation_title"]) || cleanText(primary.headline || primary.name, 600) || firstMeta(meta, ["og:title", "twitter:title", "dc.title", "dcterms.title"]) || titleTag;

  const citationAuthors = (meta.get("citation_author") || []).map((value) => cleanText(value, 250)).filter(Boolean);
  const jsonAuthors = authorsFromJson(primary.author);
  const normalAuthor = firstMeta(meta, ["author", "dc.creator", "dcterms.creator", "article:author"]);
  const organization = jsonAuthors.organization;
  const authors = [...new Set(citationAuthors.length ? citationAuthors : jsonAuthors.people.length ? jsonAuthors.people : normalAuthor ? [normalAuthor] : [])].slice(0, 20);

  const publisher = nameFrom(primary.publisher) || nameFrom(primary.isPartOf);
  const siteName = firstMeta(meta, ["og:site_name", "application-name"]) || publisher || finalUrl.hostname.replace(/^www\./u, "");
  const publicationDate = normalizedDate(firstMeta(meta, ["citation_publication_date", "citation_date", "article:published_time", "dc.date", "dcterms.date"]) || primary.datePublished);
  const languageMatch = html.match(/<html\b[^>]*>/iu);
  const language = cleanText(languageMatch ? attributes(languageMatch[0]).lang : "", 30);
  const canonicalUrl = sameOriginCanonical(html, finalUrl, meta);

  const warnings: string[] = [];
  if (!title) warnings.push("missing_title");
  if (!authors.length && !organization) warnings.push("missing_author");
  if (!publicationDate) warnings.push("missing_publication_date");

  return {
    sourceUrl: sourceUrl.href,
    finalUrl: finalUrl.href,
    canonicalUrl,
    title,
    authors,
    organization,
    authorType: organization && !authors.length ? "organization" : "person",
    siteName,
    publicationDate,
    publicationYear: publicationDate.slice(0, 4),
    language,
    warnings,
  };
}

export default {
  fetch: async (request: Request) => {
    const origin = allowedOrigin(request.headers.get("origin"));
    if (!origin) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders(origin) });
    if (request.method !== "POST") return jsonResponse(origin, { error: "method_not_allowed" }, 405);

    const { data: context, error: authError } = await createSupabaseContext(request, { auth: "user" });
    if (authError || !context) {
      return jsonResponse(origin, {
        error: authError?.code || "authentication_required",
        message: authError?.message || "Sign in before using automatic citation lookup.",
      }, authError?.status || 401);
    }

    try {
      await consumeQuota(context.supabase);
      const body = await request.json().catch(() => null) as { url?: unknown } | null;
      const raw = typeof body?.url === "string" ? body.url.trim() : "";
      const sourceUrl = await validatePublicUrl(raw);
      const { html, finalUrl } = await fetchHtml(sourceUrl);
      const result = extractMetadata(html, sourceUrl, finalUrl);
      if (!result.title && !result.siteName) throw new HttpError(422, "metadata_not_found", "No useful citation metadata was found.");
      return jsonResponse(origin, result);
    } catch (error) {
      if (error instanceof HttpError) {
        const headers = responseHeaders(origin) as Record<string, string>;
        if (error.status === 429) headers["Retry-After"] = "60";
        return new Response(JSON.stringify({ error: error.code, message: error.message }), { status: error.status, headers });
      }
      const timeout = error instanceof DOMException && error.name === "TimeoutError";
      return jsonResponse(origin, {
        error: timeout ? "lookup_timeout" : "lookup_failed",
        message: timeout ? "The website took too long to respond." : "The website could not be inspected.",
      }, timeout ? 504 : 422);
    }
  },
};
