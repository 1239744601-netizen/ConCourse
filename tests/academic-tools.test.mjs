import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../academic-tools.js", import.meta.url), "utf8");
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
