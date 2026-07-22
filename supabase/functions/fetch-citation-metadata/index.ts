// ConCourse automatic website citation metadata lookup.
// This endpoint is only for signed-in users. Keep Supabase's platform
// verify_jwt check enabled (the default); createSupabaseContext below also
// validates the user and creates an RLS-scoped client for the request.
// Broad candidate search additionally requires the BRAVE_SEARCH_API_KEY Edge
// Function secret. The key is read only on the server and is never returned.

import { createSupabaseContext } from "jsr:@supabase/server@1.4.0";

const PRODUCTION_ORIGIN = "https://1239744601-netizen.github.io";
const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 4;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_HEAD_CHARACTERS = 512 * 1024;
const CHARSET_SNIFF_BYTES = 16 * 1024;
const FETCH_TIMEOUT_MS = 8000;
const DNS_TIMEOUT_MS = 2500;
const SEARCH_TIMEOUT_MS = 12000;
const SEARCH_PROVIDER_TIMEOUT_MS = 5000;
const MAX_SEARCH_RESULTS = 10;
const MAX_SEARCH_RESPONSE_BYTES = 512 * 1024;
const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

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

type CitationCandidate = {
  id: string;
  url: string;
  title: string;
  description: string;
  siteName: string;
  authors: string[];
  organization: string;
  authorType: "person" | "organization";
  publicationDate: string;
  publicationYear: string;
  exactMatch: boolean;
};

type LookupRequest = {
  action?: unknown;
  url?: unknown;
  query?: unknown;
  language?: unknown;
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

function remainingTime(deadline: number, maximum = Number.POSITIVE_INFINITY): number {
  const remaining = Math.floor(deadline - performance.now());
  if (remaining <= 0) throw new HttpError(504, "lookup_timeout", "The website took too long to respond.");
  return Math.max(1, Math.min(remaining, maximum));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");
}

async function cancelBody(response: Response | null): Promise<void> {
  if (!response?.body || response.body.locked) return;
  try {
    await response.body.cancel();
  } catch (_error) {
    // Cancellation is best effort; the original response error is more useful.
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

async function consumePaidSearchQuota(supabase: UserSupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc("consume_citation_paid_search_quota");
  if (error) throw new HttpError(503, "search_not_configured", "Paid citation search limits are not configured.");
  if (data !== true) throw new HttpError(429, "daily_rate_limited", "The daily citation search limit has been reached. Try again tomorrow.");
}

function secondsUntilNextUtcDay(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

function rateLimitRetryAfter(code: string, now = new Date()): string {
  return code === "daily_rate_limited" ? String(secondsUntilNextUtcDay(now)) : "60";
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
  ["::", 96],
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["fc00::", 7],
  ["fe00::", 8],
  ["ff00::", 8],
];

function isPublicIpv6(value: string): boolean {
  const ip = parseIpv6(value);
  if (!ip) return false;
  const globalUnicast = parseIpv6("2000::");
  if (!globalUnicast || !ipv6HasPrefix(ip, globalUnicast, 3)) return false;
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

function parsePublicUrl(raw: string): URL {
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
  }
  return url;
}

async function validatePublicUrl(raw: string, deadline: number): Promise<URL> {
  const url = parsePublicUrl(raw);
  const hostname = url.hostname.toLocaleLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
  if (isIpLiteral(hostname)) return url;

  const resolve = async (type: "A" | "AAAA"): Promise<string[]> => {
    try {
      const timeout = remainingTime(deadline, DNS_TIMEOUT_MS);
      return await Deno.resolveDns(hostname, type, { signal: AbortSignal.timeout(timeout) }) as string[];
    } catch (error) {
      // A missing A or AAAA family is normal. Resolver failures and timeouts are
      // not: allowing the other family in that case would create an SSRF gap.
      if (error instanceof Error && error.name === "NotFound") return [];
      if (isAbortError(error) && performance.now() >= deadline) {
        throw new HttpError(504, "lookup_timeout", "The website took too long to respond.");
      }
      throw new HttpError(422, "dns_failed", "The website address could not be resolved safely.");
    }
  };
  const [ipv4, ipv6] = await Promise.all([resolve("A"), resolve("AAAA")]);
  remainingTime(deadline);
  const addresses = [...ipv4, ...ipv6];
  if (!addresses.length) throw new HttpError(422, "dns_failed", "The website address could not be resolved.");
  if (addresses.some((address) => !isPublicIp(address))) {
    throw new HttpError(400, "private_address", "The website resolves to a private or reserved network address.");
  }
  return url;
}

function decoderLabel(value: string): string {
  const label = value.trim().replace(/^['"]|['"]$/gu, "").toLocaleLowerCase();
  if (!/^[a-z0-9._:+-]{1,40}$/u.test(label)) return "";
  try {
    return new TextDecoder(label).encoding;
  } catch (_error) {
    return "";
  }
}

function detectEncoding(contentType: string, prefix: Uint8Array): string {
  const headerLabel = contentType.match(/charset\s*=\s*(?:["']\s*)?([a-z0-9._:+-]+)/iu)?.[1] || "";
  const headerEncoding = decoderLabel(headerLabel);
  if (headerEncoding) return headerEncoding;

  if (prefix[0] === 0xef && prefix[1] === 0xbb && prefix[2] === 0xbf) return "utf-8";
  if (prefix[0] === 0xff && prefix[1] === 0xfe) return "utf-16le";
  if (prefix[0] === 0xfe && prefix[1] === 0xff) return "utf-16be";

  const sample = new TextDecoder("windows-1252").decode(prefix);
  const metaLabel = sample.match(/<meta\b[^>]*\bcharset\s*=\s*(?:["']\s*)?([a-z0-9._:+-]+)/iu)?.[1]
    || sample.match(/<meta\b[^>]*\bcontent\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9._:+-]+)/iu)?.[1]
    || "";
  const metaEncoding = decoderLabel(metaLabel);
  if (metaEncoding) return metaEncoding;

  // UTF-8 is the modern default. Fall back to the HTML legacy encoding only
  // when the sampled bytes cannot form valid UTF-8.
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(prefix, { stream: true });
    return "utf-8";
  } catch (_error) {
    return "windows-1252";
  }
}

function combineChunks(chunks: Uint8Array[], length: number): Uint8Array {
  const output = new Uint8Array(length);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return output;
}

async function readHtml(response: Response, contentType: string, deadline: number): Promise<string> {
  if (!response.body) throw new HttpError(422, "empty_page", "The website returned an empty page.");
  const reader = response.body.getReader();
  const prefixChunks: Uint8Array[] = [];
  let prefixBytes = 0;
  let totalBytes = 0;
  let streamDone = false;

  const read = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    remainingTime(deadline);
    try {
      const result = await reader.read();
      remainingTime(deadline);
      return result;
    } catch (error) {
      if (isAbortError(error) || performance.now() >= deadline) {
        throw new HttpError(504, "lookup_timeout", "The website took too long to respond.");
      }
      throw error;
    }
  };
  const cancel = async (): Promise<void> => {
    try {
      await reader.cancel();
    } catch (_error) {
      // Best effort: the fetch signal may already have closed the stream.
    }
  };

  try {
    while (prefixBytes < CHARSET_SNIFF_BYTES) {
      const { value, done } = await read();
      if (done) {
        streamDone = true;
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await cancel();
        throw new HttpError(413, "page_too_large", "The website page is too large to inspect safely.");
      }
      prefixChunks.push(value);
      prefixBytes += value.byteLength;
    }

    const prefix = combineChunks(prefixChunks, prefixBytes);
    const decoder = new TextDecoder(detectEncoding(contentType, prefix), { fatal: false });
    let html = decoder.decode(prefix, { stream: !streamDone });
    if (html.length > MAX_HEAD_CHARACTERS || /<\/head\s*>/iu.test(html)) {
      if (!streamDone) await cancel();
      return html.slice(0, MAX_HEAD_CHARACTERS);
    }

    while (!streamDone) {
      const { value, done } = await read();
      if (done) {
        streamDone = true;
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await cancel();
        throw new HttpError(413, "page_too_large", "The website page is too large to inspect safely.");
      }
      html += decoder.decode(value, { stream: true });
      if (html.length > MAX_HEAD_CHARACTERS || /<\/head\s*>/iu.test(html)) {
        await cancel();
        return html.slice(0, MAX_HEAD_CHARACTERS);
      }
    }
    html += decoder.decode();
    return html.slice(0, MAX_HEAD_CHARACTERS);
  } catch (error) {
    await cancel();
    throw error;
  }
}

async function fetchHtml(source: URL, deadline = performance.now() + FETCH_TIMEOUT_MS): Promise<{ html: string; finalUrl: URL }> {
  let current = source;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    current = await validatePublicUrl(current.href, deadline);
    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(remainingTime(deadline)),
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
          "Accept-Language": "en;q=0.8",
          "User-Agent": "ConCourseCitationBot/1.0 (+https://1239744601-netizen.github.io/ConCourse/)",
        },
      });
      remainingTime(deadline);
    } catch (error) {
      if (isAbortError(error) || performance.now() >= deadline) {
        throw new HttpError(504, "lookup_timeout", "The website took too long to respond.");
      }
      throw error;
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await cancelBody(response);
      if (!location || redirectCount === MAX_REDIRECTS) throw new HttpError(422, "redirect_limit", "The website redirected too many times.");
      const next = new URL(location, current);
      if (current.protocol === "https:" && next.protocol === "http:") throw new HttpError(422, "unsafe_redirect", "The website redirected to an insecure address.");
      current = parsePublicUrl(next.href);
      continue;
    }
    if (!response.ok) {
      await cancelBody(response);
      throw new HttpError(422, "upstream_failed", "The website did not return a readable page.");
    }
    const contentType = (response.headers.get("content-type") || "").toLocaleLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      await cancelBody(response);
      throw new HttpError(415, "unsupported_content", "Only HTML website pages are supported.");
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      await cancelBody(response);
      throw new HttpError(413, "page_too_large", "The website page is too large to inspect safely.");
    }
    const html = await readHtml(response, contentType, deadline);
    return { html, finalUrl: current };
  }
  throw new HttpError(422, "redirect_limit", "The website redirected too many times.");
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
    copy: "©", reg: "®", trade: "™", euro: "€", cent: "¢", pound: "£", yen: "¥", sect: "§", para: "¶",
    middot: "·", bull: "•", hellip: "…", prime: "′", ndash: "–", mdash: "—", minus: "−",
    lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
    laquo: "«", raquo: "»", lsaquo: "‹", rsaquo: "›", dagger: "†", permil: "‰",
    times: "×", divide: "÷", plusmn: "±", ne: "≠", le: "≤", ge: "≥", deg: "°", micro: "µ",
    frac14: "¼", frac12: "½", frac34: "¾", sup1: "¹", sup2: "²", sup3: "³",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z0-9]+);/giu, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLocaleLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      const scalar = Number.isInteger(number)
        && number > 0
        && number <= 0x10ffff
        && !(number >= 0xd800 && number <= 0xdfff)
        && (number & 0xffff) !== 0xfffe
        && (number & 0xffff) !== 0xffff;
      return scalar ? String.fromCodePoint(number) : match;
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

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function exactDate(yearValue: string, monthValue: string | number, dayValue: string): string {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day)) return "";
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizedDate(value: unknown): string {
  const raw = cleanText(value, 100);
  if (!raw) return "";
  const numeric = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?=$|[Tt\s])/u);
  if (numeric) return exactDate(numeric[1], numeric[2], numeric[3]);

  const dayFirst = raw.match(/^(?:[a-z]{3,9},\s*)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})(?:\s*,\s*|\s+)(\d{4})(?=$|[Tt\s])/iu);
  if (dayFirst) {
    const month = MONTH_NUMBERS[dayFirst[2].toLocaleLowerCase()];
    return month ? exactDate(dayFirst[3], month, dayFirst[1]) : "";
  }

  const monthFirst = raw.match(/^([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,\s*|\s+)(\d{4})(?=$|[Tt\s])/iu);
  if (monthFirst) {
    const month = MONTH_NUMBERS[monthFirst[1].toLocaleLowerCase()];
    return month ? exactDate(monthFirst[3], month, monthFirst[2]) : "";
  }
  return "";
}

function normalizedYear(value: unknown): string {
  const raw = cleanText(value, 100);
  const year = raw.match(/(?:^|\D)(\d{4})(?=\D|$)/u)?.[1] || "";
  return year !== "0000" ? year : "";
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
  const rawPublicationDate = firstMeta(meta, ["citation_publication_date", "citation_date", "article:published_time", "dc.date", "dcterms.date"]) || primary.datePublished;
  const publicationDate = normalizedDate(rawPublicationDate);
  const publicationYear = publicationDate.slice(0, 4) || normalizedYear(rawPublicationDate);
  const languageMatch = html.match(/<html\b[^>]*>/iu);
  const language = cleanText(languageMatch ? attributes(languageMatch[0]).lang : "", 30);
  const canonicalUrl = sameOriginCanonical(html, finalUrl, meta);

  const warnings: string[] = [];
  if (!title) warnings.push("missing_title");
  if (!authors.length && !organization) warnings.push("missing_author");
  if (!publicationDate) warnings.push("missing_publication_date");
  if (rawPublicationDate && !publicationDate) warnings.push(publicationYear ? "partial_publication_date" : "invalid_publication_date");

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
    publicationYear,
    language,
    warnings,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanCandidateText(value: unknown, limit: number): string {
  return cleanText(value, limit).replace(/[<>]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit);
}

function candidateId(url: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `source-${(hash >>> 0).toString(36)}`;
}

function candidateFromMetadata(metadata: MetadataResult, description: string, exactMatch: boolean): CitationCandidate {
  const url = parsePublicUrl(metadata.canonicalUrl || metadata.finalUrl || metadata.sourceUrl);
  const siteName = cleanCandidateText(metadata.siteName, 250) || url.hostname.replace(/^www\./u, "");
  const authors = Array.isArray(metadata.authors) ? metadata.authors.map((author) => cleanCandidateText(author, 250)).filter(Boolean).slice(0, 20) : [];
  const organization = cleanCandidateText(metadata.organization, 250);
  return {
    id: candidateId(url.href),
    url: url.href,
    title: cleanCandidateText(metadata.title, 600),
    description: cleanCandidateText(description, 1000),
    siteName,
    authors,
    organization,
    authorType: metadata.authorType === "organization" && organization ? "organization" : "person",
    publicationDate: normalizedDate(metadata.publicationDate),
    publicationYear: normalizedYear(metadata.publicationYear || metadata.publicationDate),
    exactMatch,
  };
}

function candidateFromBrave(value: unknown): CitationCandidate | null {
  const result = asRecord(value);
  if (typeof result.url !== "string") return null;
  let url: URL;
  try {
    url = parsePublicUrl(result.url.trim());
  } catch (_error) {
    return null;
  }
  const profile = asRecord(result.profile);
  const siteName = cleanCandidateText(profile.long_name || profile.name, 250) || url.hostname.replace(/^www\./u, "");
  const title = cleanCandidateText(result.title, 600);
  if (!title) return null;
  return {
    id: candidateId(url.href),
    url: url.href,
    title,
    description: cleanCandidateText(result.description, 1000),
    siteName,
    authors: [],
    organization: "",
    authorType: "person",
    // Search-index freshness is not necessarily the source publication date.
    // Citation dates are populated only by the authoritative URL lookup.
    publicationDate: "",
    publicationYear: "",
    exactMatch: false,
  };
}

function uniqueCandidates(values: CitationCandidate[]): CitationCandidate[] {
  const output: CitationCandidate[] = [];
  const positions = new Map<string, number>();
  values.forEach((candidate) => {
    const position = positions.get(candidate.url);
    if (position === undefined) {
      positions.set(candidate.url, output.length);
      output.push(candidate);
      return;
    }
    const current = output[position];
    const genericTitle = !current.title || current.title === current.siteName;
    const genericSite = !current.siteName || current.siteName === new URL(current.url).hostname.replace(/^www\./u, "");
    output[position] = {
      ...current,
      title: genericTitle && candidate.title ? candidate.title : current.title,
      description: current.description || candidate.description,
      siteName: genericSite && candidate.siteName ? candidate.siteName : current.siteName,
      authors: current.authors.length ? current.authors : [...candidate.authors],
      organization: current.organization || candidate.organization,
      authorType: current.organization ? current.authorType : candidate.authorType,
      publicationDate: current.publicationDate || candidate.publicationDate,
      publicationYear: current.publicationYear || candidate.publicationYear,
      exactMatch: current.exactMatch || candidate.exactMatch,
    };
  });
  return output;
}

function validateSearchQuery(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "invalid_query", "Enter a search query.");
  const query = value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const length = Array.from(query).length;
  const wordCount = query ? query.split(/\s+/u).length : 0;
  if (length < 2 || length > 400 || wordCount > 50) {
    throw new HttpError(400, "invalid_query", "Use a search query between 2 and 400 characters and no more than 50 words.");
  }
  return query;
}

function normalizeSearchLanguage(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new HttpError(400, "invalid_language", "Use a supported search language.");
  const raw = value.trim().toLocaleLowerCase().replace(/_/gu, "-");
  const aliases: Record<string, string> = {
    english: "en", "en-us": "en", "en-gb": "en",
    mandarin: "zh-hans", "zh-cn": "zh-hans", "zh-sg": "zh-hans", "zh-hans": "zh-hans",
    cantonese: "zh-hant", yue: "zh-hant", "zh-hk": "zh-hant", "zh-mo": "zh-hant", "zh-tw": "zh-hant", "zh-hant": "zh-hant",
  };
  const language = aliases[raw] || raw;
  if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/u.test(language) || language.length > 12) {
    throw new HttpError(400, "invalid_language", "Use a supported search language.");
  }
  return language;
}

function searchQueryUrl(query: string): URL | null {
  const anyScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(query);
  const complete = /^https?:\/\//iu.test(query);
  const protocolRelative = /^\/\//u.test(query);
  const bareDomain = !/\s/u.test(query)
    && /^(?:www\.)?[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?\.[\p{L}]{2,63}(?::\d+)?(?:[/?#].*)?$/iu.test(query);
  if (anyScheme && !complete) return parsePublicUrl(query);
  if (!complete && !protocolRelative && !bareDomain) return null;
  return parsePublicUrl(complete ? query : protocolRelative ? `https:${query}` : `https://${query}`);
}

function containsUrlToken(query: string): boolean {
  return /[a-z][a-z0-9+.-]*:\/\/\S+/iu.test(query)
    || /(?:^|\s)(?:www\.)?[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?\.[\p{L}]{2,63}(?::\d+)?(?:[/?#][^\s]*)?/iu.test(query);
}

function validateSearchInput(value: unknown): { query: string; exactUrl: URL | null } {
  if (typeof value !== "string") throw new HttpError(400, "invalid_query", "Enter a search query.");
  const raw = value.trim();
  // URL lookup uses the existing 2,048-character URL limit. It is deliberately
  // classified before applying Brave's smaller 400-character keyword limit.
  const exactUrl = searchQueryUrl(raw);
  if (exactUrl) return { query: raw, exactUrl };
  return { query: validateSearchQuery(value), exactUrl: null };
}

function braveApiKey(): string {
  try {
    return (Deno.env.get("BRAVE_SEARCH_API_KEY") || "").trim();
  } catch (_error) {
    return "";
  }
}

async function readLimitedJson(response: Response, deadline: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_SEARCH_RESPONSE_BYTES) {
    await cancelBody(response);
    throw new HttpError(502, "search_failed", "The search provider returned too much data.");
  }
  if (!response.body) throw new HttpError(502, "search_failed", "The search provider returned an empty response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  const cancel = async (): Promise<void> => {
    try {
      await reader.cancel();
    } catch (_error) {
      // The provider connection may already be closed.
    }
  };
  try {
    while (true) {
      remainingTime(deadline);
      const { value, done } = await reader.read();
      remainingTime(deadline);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_SEARCH_RESPONSE_BYTES) {
        await cancel();
        throw new HttpError(502, "search_failed", "The search provider returned too much data.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    await cancel();
    if (error instanceof HttpError && error.code === "search_failed") throw error;
    throw new HttpError(502, "search_failed", "The search provider returned an unreadable response.");
  }
}

async function searchBrave(query: string, language: string, key: string, deadline: number): Promise<CitationCandidate[]> {
  const endpoint = new URL(BRAVE_SEARCH_ENDPOINT);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("count", String(MAX_SEARCH_RESULTS));
  endpoint.searchParams.set("safesearch", "strict");
  endpoint.searchParams.set("text_decorations", "false");
  endpoint.searchParams.set("result_filter", "web");
  if (language) endpoint.searchParams.set("search_lang", language);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(remainingTime(deadline, SEARCH_PROVIDER_TIMEOUT_MS)),
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
    });
    remainingTime(deadline);
  } catch (_error) {
    throw new HttpError(502, "search_failed", "Search is temporarily unavailable.");
  }

  if (response.status === 429) {
    await cancelBody(response);
    throw new HttpError(429, "rate_limited", "Search is busy. Wait one minute and try again.");
  }
  if (response.status === 401 || response.status === 403) {
    await cancelBody(response);
    throw new HttpError(503, "search_not_configured", "Citation search is not configured.");
  }
  if (!response.ok) {
    await cancelBody(response);
    throw new HttpError(502, "search_failed", "Search is temporarily unavailable.");
  }
  const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLocaleLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    await cancelBody(response);
    throw new HttpError(502, "search_failed", "The search provider returned an unreadable response.");
  }

  const payload = asRecord(await readLimitedJson(response, deadline));
  const web = asRecord(payload.web);
  const results = Array.isArray(web.results) ? web.results : [];
  return uniqueCandidates(results.slice(0, MAX_SEARCH_RESULTS).map(candidateFromBrave).filter((candidate): candidate is CitationCandidate => !!candidate));
}

function descriptionFromHtml(html: string): string {
  const meta = metadataMap(html);
  return firstMeta(meta, ["description", "og:description", "twitter:description", "dc.description", "dcterms.description"]);
}

async function fetchCandidate(url: URL, exactMatch: boolean, deadline: number, timeout: number, fallbackDescription = ""): Promise<CitationCandidate> {
  const itemDeadline = Math.min(deadline, performance.now() + timeout);
  const { html, finalUrl } = await fetchHtml(url, itemDeadline);
  const metadata = extractMetadata(html, url, finalUrl);
  if (!cleanCandidateText(metadata.title, 600)) {
    throw new HttpError(422, "metadata_not_found", "No reliable citation title was found at this URL.");
  }
  return candidateFromMetadata(metadata, descriptionFromHtml(html) || fallbackDescription, exactMatch);
}

async function searchCandidates(query: string, language: string, supabase: UserSupabaseClient, preclassifiedUrl: URL | null = searchQueryUrl(query)): Promise<{
  results: CitationCandidate[];
  searchProvider: "brave" | "exact";
  exactMatchOnly: boolean;
}> {
  const deadline = performance.now() + SEARCH_TIMEOUT_MS;
  const exactUrl = preclassifiedUrl;
  if (exactUrl) {
    // URL inputs may contain private tokens in their path or query string. They
    // are fetched only by the exact SSRF-safe lookup and are never sent to a
    // third-party search provider.
    const exact = await fetchCandidate(exactUrl, true, deadline, FETCH_TIMEOUT_MS);
    return { results: [exact], searchProvider: "exact", exactMatchOnly: true };
  }
  if (containsUrlToken(query)) {
    throw new HttpError(400, "invalid_query", "Search a website URL by itself so it is not shared with a search provider.");
  }

  const key = braveApiKey();
  if (!key) throw new HttpError(503, "search_not_configured", "Citation search is not configured.");
  await consumePaidSearchQuota(supabase);
  const results = await searchBrave(query, language, key, deadline);
  return { results, searchProvider: "brave", exactMatchOnly: false };
}

async function readJsonRequest(request: Request): Promise<LookupRequest> {
  const contentType = (request.headers.get("content-type") || "").split(";", 1)[0].trim().toLocaleLowerCase();
  if (!/^application\/(?:[a-z0-9._-]+\+)?json$/u.test(contentType)) {
    throw new HttpError(415, "unsupported_request", "Send the lookup request as JSON.");
  }

  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && (!/^\d+$/u.test(lengthHeader) || Number(lengthHeader) > MAX_REQUEST_BYTES)) {
    throw new HttpError(413, "request_too_large", "The lookup request is too large.");
  }
  if (!request.body) throw new HttpError(400, "invalid_json", "Send a valid JSON lookup request.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "request_too_large", "The lookup request is too large.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    try {
      await reader.cancel();
    } catch (_cancelError) {
      // The request may already be closed.
    }
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json", "Send a valid UTF-8 JSON lookup request.");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (_error) {
    throw new HttpError(400, "invalid_json", "Send a valid JSON lookup request.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_json", "Send a JSON object containing a website URL.");
  }
  return value as LookupRequest;
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
      const body = await readJsonRequest(request);
      const action = body.action === undefined ? "lookup" : body.action;
      if (action === "search") {
        const search = validateSearchInput(body.query);
        const language = normalizeSearchLanguage(body.language);
        await consumeQuota(context.supabase);
        return jsonResponse(origin, await searchCandidates(search.query, language, context.supabase, search.exactUrl));
      }
      if (action !== "lookup") throw new HttpError(400, "invalid_action", "Use lookup or search.");
      const raw = typeof body.url === "string" ? body.url.trim() : "";
      const sourceUrl = parsePublicUrl(raw);
      await consumeQuota(context.supabase);
      const { html, finalUrl } = await fetchHtml(sourceUrl);
      const result = extractMetadata(html, sourceUrl, finalUrl);
      if (!result.title && !result.siteName) throw new HttpError(422, "metadata_not_found", "No useful citation metadata was found.");
      return jsonResponse(origin, result);
    } catch (error) {
      if (error instanceof HttpError) {
        const headers = responseHeaders(origin) as Record<string, string>;
        if (error.status === 429) headers["Retry-After"] = rateLimitRetryAfter(error.code);
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
