import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../academic-tools.js", import.meta.url), "utf8");
const edgeSource = fs.readFileSync(new URL("../supabase/functions/fetch-citation-metadata/index.ts", import.meta.url), "utf8");
const document = {
  documentElement:{lang:"en"},
  getElementById:() => null,
  querySelector:() => null,
  querySelectorAll:() => []
};
const window = {setTimeout, clearTimeout};
const context = vm.createContext({
  window,
  document,
  URL,
  crypto:globalThis.crypto,
  console,
  navigator:{},
  localStorage:{getItem:() => null, setItem:() => {}},
  setTimeout,
  clearTimeout
});
window.window = window;
window.document = document;
vm.runInContext(source, context, {filename:"academic-tools.js"});

const tools = window.ConCourseAcademicTools.__test;
const person = (family, given) => ({kind:"person", family, given});
const base = {
  id:"test",
  source:"website",
  authors:[person("Austerlitz", "Saul")],
  title:"How long can a spinoff like Better Call Saul last?",
  year:"2015",
  publicationDate:"2015-03-03",
  accessDate:"2026-07-21",
  publisher:"",
  publisherPlace:"",
  edition:"",
  containerTitle:"FiveThirtyEight",
  volume:"",
  issue:"",
  pages:"",
  pinpoint:"42",
  locator:"https://fivethirtyeight.com/features/how-long-can-a-spinoff-like-better-call-saul-last/"
};

test("APA 7 website baseline", () => {
  assert.equal(
    tools.formatRecord(base, "apa").plain,
    "Austerlitz, S. (2015, March 3). How long can a spinoff like Better Call Saul last? FiveThirtyEight. https://fivethirtyeight.com/features/how-long-can-a-spinoff-like-better-call-saul-last/"
  );
});

test("MLA removes the protocol from ordinary website URLs", () => {
  const value = tools.formatRecord(base, "mla").plain;
  assert.match(value, /fivethirtyeight\.com\/features\//u);
  assert.doesNotMatch(value, /https?:\/\//u);
});

test("Harvard keeps three authors and changes to et al. at four", () => {
  const three = {...base, authors:[person("Ng", "Ada"), person("Patel", "Ravi"), person("Chen", "Mei")]};
  const four = {...three, authors:[...three.authors, person("Jones", "Sam")]};
  assert.equal(tools.formatRecord(three, "harvard").inline, "(Ng, Patel and Chen, 2015, p. 42)");
  assert.equal(tools.formatRecord(four, "harvard").inline, "(Ng et al., 2015, p. 42)");
  assert.match(tools.formatRecord(four, "harvard").plain, /^Ng, A\. et al\./u);
});

test("Harvard book includes publication place", () => {
  const book = {...base, source:"book", title:"Campus planning", publicationDate:"", accessDate:"", publisher:"Northbridge Press", publisherPlace:"Hong Kong", containerTitle:"", locator:""};
  assert.match(tools.formatRecord(book, "harvard").plain, /Hong Kong: Northbridge Press\./u);
});

test("Chicago short notes keep two authors and punctuation inside quotes", () => {
  const record = {...base, authors:[person("Chen", "Mei"), person("Patel", "Ravi")], title:"Designing resilient campuses"};
  assert.equal(tools.formatRecord(record, "chicago").inline, "Chen and Patel, “Designing resilient campuses,” 42.");
});

test("No-author parenthetical citations shorten and quote webpage titles", () => {
  const record = {...base, authors:[], title:"A very long webpage title about campus planning"};
  assert.equal(tools.formatRecord(record, "apa").inline, "(“A very long webpage”, 2015, p. 42)");
  assert.equal(tools.formatRecord(record, "mla").inline, "(“A very long webpage” 42)");
});

test("No-date suffixes remain distinguishable", () => {
  const record = {...base, year:"", publicationDate:"", yearSuffix:"b"};
  assert.match(tools.formatRecord(record, "apa").plain, /\(n\.d\.-b\)/u);
  assert.match(tools.formatRecord(record, "apa").inline, /n\.d\.-b/u);
  assert.match(tools.formatRecord(record, "harvard").inline, /no date b/u);
});

test("different book editions have different library identities", () => {
  const book = {...base, source:"book", title:"Campus planning", publicationDate:"", publisher:"Northbridge Press", containerTitle:"", locator:""};
  assert.notEqual(tools.fingerprint({...book, edition:"2"}), tools.fingerprint({...book, edition:"3"}));
});

test("pinpoint and access date changes update one source instead of duplicating it", () => {
  assert.equal(
    tools.fingerprint({...base, pinpoint:"15", accessDate:"2026-01-01"}),
    tools.fingerprint({...base, pinpoint:"88", accessDate:"2026-12-31"})
  );
});

test("validation rejects malformed years and dates", () => {
  assert.deepEqual(Array.from(tools.validateRecord({...base, year:"20"}).errors), ["citationInvalidYear"]);
  assert.deepEqual(Array.from(tools.validateRecord({...base, publicationDate:"2024-02-31"}).errors), ["citationInvalidDate"]);
});

test("DOIs and URLs are normalized safely", () => {
  assert.equal(tools.normalizeDoi("https://doi.org/10.1000/xyz.123."), "10.1000/xyz.123");
  assert.equal(tools.normalizedWebsiteUrl("example.edu/article#section"), "https://example.edu/article");
  assert.equal(tools.normalizedWebsiteUrl("https://user:pass@example.edu/article"), "");
  assert.equal(tools.normalizedWebsiteUrl("https://example.edu:8443/article"), "");
});

test("citation search accepts URLs and meaningful keywords but rejects malformed input", () => {
  assert.equal(tools.searchInputInfo("example.edu/article").url, "https://example.edu/article");
  assert.equal(tools.searchInputInfo("artificial intelligence ethics").valid, true);
  assert.equal(tools.searchInputInfo("a").valid, false);
  assert.equal(tools.searchInputInfo("a".repeat(400)).valid, true);
  assert.equal(tools.searchInputInfo("a".repeat(401)).valid, false);
  assert.equal(tools.searchInputInfo(Array(51).fill("word").join(" ")).valid, false);
  assert.deepEqual(
    {...tools.searchInputInfo("https://example.edu:8443/article")},
    {query:"https://example.edu:8443/article", url:"", kind:"url", valid:false}
  );
  const urlPrefix = "https://example.edu/article?query=";
  const urlSuffix = "&tail=end";
  const longUrl = `${urlPrefix}${"a".repeat(2048 - urlPrefix.length - urlSuffix.length)}${urlSuffix}`;
  assert.equal(longUrl.length, 2048);
  const longUrlInput = tools.searchInputInfo(longUrl);
  assert.equal(longUrlInput.valid, true);
  assert.equal(longUrlInput.kind, "url");
  assert.equal(longUrlInput.query, longUrl);
  assert.equal(longUrlInput.url, longUrl);
});

test("search candidates keep safe public URLs and display-only result dates", () => {
  const result = tools.normalizeSearchResult({
    url:"https://example.edu/article#summary",
    title:"A useful source",
    authors:["Ada Ng"],
    resultDate:"Updated two days ago",
    publicationDate:"",
    exactMatch:true,
    provider:"crossref"
  });
  assert.equal(result.url, "https://example.edu/article");
  assert.equal(result.displayDate, "Updated two days ago");
  assert.equal(result.publicationYear, "");
  assert.equal(result.publicationDate, "");
  assert.equal(result.exactMatch, true);
  assert.equal(result.provider, "crossref");
  const explicitDisplayDate = tools.normalizeSearchResult({
    url:"https://example.edu/second",
    title:"A second source",
    displayDate:"Spring 2025",
    resultDate:"Ignored fallback date"
  });
  assert.equal(explicitDisplayDate.displayDate, "Spring 2025");
  assert.equal(explicitDisplayDate.publicationYear, "");
  assert.equal(explicitDisplayDate.publicationDate, "");
  assert.equal(tools.normalizeSearchResult({url:"javascript:alert(1)", title:"Unsafe"}), null);
});

test("selecting a result never imports the unverified search candidate", () => {
  const selectionSource = source.match(/async function selectSearchResult\(index\)\{[\s\S]*?(?=\n  function editCurrentReference)/u)?.[0] || "";
  assert.ok(selectionSource, "selectSearchResult source should be present");
  assert.doesNotMatch(selectionSource, /applyWebsiteMetadata\(candidate/u);
  assert.match(selectionSource, /applyWebsiteMetadata\(data\)/u);
});

test("daily search limits are mapped before generic rate limits", () => {
  const dailyBranch = source.indexOf('code.includes("DAILY_RATE_LIMIT")');
  const genericBranch = source.indexOf('status === 429 || code.includes("RATE_LIMIT")');
  assert.ok(dailyBranch >= 0 && genericBranch > dailyBranch);
  assert.equal(source.match(/citationLookupDailyLimited:/gu)?.length, 3);
});

test("zero-cost source search uses Crossref without a paid API secret", () => {
  assert.match(edgeSource, /https:\/\/api\.crossref\.org\/works/u);
  assert.match(edgeSource, /query\.bibliographic/u);
  assert.match(edgeSource, /searchProvider: "crossref"/u);
  assert.doesNotMatch(edgeSource, /BRAVE_SEARCH_API_KEY|api\.search\.brave\.com/u);
  assert.doesNotMatch(source, /Brave Search/u);
});

test("exact-result messaging follows the backend flag and Crossref is attributed", () => {
  assert.match(source, /data\?\.exactMatchOnly === true/u);
  assert.match(source, /includes\("crossref"\) \? tr\("citationSearchAttribution"\)/u);
  assert.equal(source.match(/citationSearchAttribution:"Scholarly metadata provided by Crossref"/gu)?.length, 1);
  assert.equal(source.match(/citationSearchAttribution:/gu)?.length, 3);
});
