import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Script, createContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const navigation = require("../navigation-state.js");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const hub = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");
const bootMatch = html.match(/<script id="concourseNavigationBoot">([\s\S]*?)<\/script>/u);
assert.ok(bootMatch, "the synchronous navigation boot gate should be present");
const bootSource = bootMatch[1];

function memoryStorage(route=null){
  const values = new Map();
  if(route) values.set(navigation.STORAGE_KEY, JSON.stringify(route));
  return {
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value),
    removeItem:key => values.delete(key)
  };
}

function runBoot({storage=memoryStorage(), hash="", search=""}={}){
  const attributes = new Map();
  const timers = [];
  const clearedTimers = [];
  const root = {
    setAttribute(name, value){ attributes.set(name, String(value)); },
    removeAttribute(name){ attributes.delete(name); },
    hasAttribute(name){ return attributes.has(name); }
  };
  const fakeWindow = {
    ConCourseNavigationState:navigation,
    sessionStorage:storage,
    location:{hash, search},
    setTimeout(callback, delay){
      const id = timers.length + 1;
      timers.push({id, callback, delay});
      return id;
    },
    clearTimeout(id){ clearedTimers.push(id); }
  };
  const context = createContext({
    document:{documentElement:root},
    window:fakeWindow
  });
  new Script(bootSource, {filename:"concourse-navigation-boot.js"}).runInContext(context);
  return {attributes, timers, clearedTimers, window:fakeWindow};
}

test("the neutral first-paint gate is limited to restorable pages and content deep links", () => {
  for(const route of [
    navigation.createRoute("user-1", "planner"),
    navigation.createRoute("user-1", "timetable"),
    navigation.createRoute("user-1", "hub", "messages")
  ]){
    assert.equal(navigation.shouldHoldInitialPaint(memoryStorage(route)), true);
  }
  assert.equal(
    navigation.shouldHoldInitialPaint(memoryStorage(navigation.createRoute("user-1", "main"))),
    false
  );
  assert.equal(navigation.shouldHoldInitialPaint(memoryStorage()), false);
  assert.equal(
    navigation.shouldHoldInitialPaint({getItem(){ throw new Error("blocked"); }}),
    false
  );

  const id = "2f1c85c8-6b33-4e3b-8ee8-972819f3586c";
  assert.equal(navigation.shouldHoldInitialPaint(memoryStorage(), {hash:`#post-${id}`}), true);
  assert.equal(navigation.shouldHoldInitialPaint(memoryStorage(), {hash:`#listing-${id}`}), true);
  assert.equal(navigation.shouldHoldInitialPaint(memoryStorage(), {hash:"#type=recovery"}), false);
  assert.equal(navigation.shouldHoldInitialPaint(memoryStorage(), {search:"?auth_action=recovery"}), false);
  assert.equal(navigation.shouldHoldInitialPaint(memoryStorage(), {search:"?code=pkce-code"}), false);
});

test("the head bootstrap holds and releases first paint idempotently", () => {
  const route = navigation.createRoute("user-1", "hub", "profile");
  const boot = runBoot({storage:memoryStorage(route)});
  assert.equal(boot.attributes.has("data-concourse-nav-pending"), true);
  assert.equal(boot.attributes.get("aria-busy"), "true");
  assert.equal(boot.timers.length, 1);
  assert.equal(boot.timers[0].delay, 10000);

  boot.window.releaseConCourseInitialPaint();
  assert.equal(boot.attributes.has("data-concourse-nav-pending"), false);
  assert.equal(boot.attributes.has("aria-busy"), false);
  boot.window.releaseConCourseInitialPaint();
  assert.deepEqual(boot.clearedTimers, [1]);

  const timedBoot = runBoot({storage:memoryStorage(route)});
  timedBoot.timers[0].callback();
  assert.equal(timedBoot.attributes.has("data-concourse-nav-pending"), false);
  assert.equal(timedBoot.attributes.has("aria-busy"), false);
});

test("main, malformed, and authentication callback starts never hide the public page", () => {
  const main = runBoot({
    storage:memoryStorage(navigation.createRoute("user-1", "main"))
  });
  assert.equal(main.attributes.has("data-concourse-nav-pending"), false);
  assert.equal(main.timers.length, 0);

  const malformed = runBoot({
    storage:{getItem(){ return "{not-json"; }}
  });
  assert.equal(malformed.attributes.has("data-concourse-nav-pending"), false);

  const callback = runBoot({
    storage:memoryStorage(navigation.createRoute("user-1", "hub", "community")),
    search:"?error=access_denied"
  });
  assert.equal(callback.attributes.has("data-concourse-nav-pending"), false);
});

test("the neutral gate is installed before style and never reveals protected surfaces", () => {
  const navigationScript = html.indexOf('<script src="navigation-state.js?v=20260731-paint1"></script>');
  const bootstrap = html.indexOf('<script id="concourseNavigationBoot">');
  const firstStyle = html.indexOf("<style>");
  const body = html.indexOf("<body>");
  assert.ok(navigationScript >= 0 && navigationScript < bootstrap);
  assert.ok(bootstrap < firstStyle && firstStyle < body);

  assert.match(html, /html\[data-concourse-nav-pending\] body > :not\(#concourseInitialPaint\)[\s\S]*?visibility: hidden !important/u);
  assert.match(html, /html\[data-concourse-nav-pending\] #concourseInitialPaint[\s\S]*?display: grid !important;[\s\S]*?visibility: visible !important/u);
  assert.match(html, /id="concourseInitialPaint" hidden role="status"/u);
  assert.match(html, /id="appWrap" hidden/u);
  assert.match(html, /id="schedulePage" class="schedule-page" hidden/u);
  assert.match(html, /id="memberHub" class="member-hub" hidden/u);
  assert.doesNotMatch(bootSource, /app-active|schedule-active|hub-active|getElementById|\.hidden|restoreView/u);
});

test("real destinations settle before the neutral gate is released", () => {
  for(const [functionName, visibleState] of [
    ["enterPlanner", '$("appWrap").hidden = false;'],
    ["showSchedulePage", '$("schedulePage").hidden = false;'],
    ["showPlannerEditor", '$("appWrap").hidden = false;']
  ]){
    const start = html.indexOf(`function ${functionName}(`);
    const next = html.indexOf("\nfunction ", start + 10);
    const source = html.slice(start, next);
    assert.ok(source.indexOf(visibleState) >= 0, `${functionName} should reveal its destination`);
    assert.ok(
      source.indexOf(visibleState) < source.indexOf("finishConCourseInitialPaint()"),
      `${functionName} should reveal its destination before releasing first paint`
    );
  }

  const showHubStart = hub.indexOf("function showHub(");
  const switchViewStart = hub.indexOf("async function switchView", showHubStart);
  const showHubSource = hub.slice(showHubStart, switchViewStart);
  assert.ok(showHubSource.indexOf('$("memberHub").hidden = false;') < showHubSource.indexOf("window.releaseConCourseInitialPaint?.();"));
  assert.ok(showHubSource.indexOf("switchView(view);") < showHubSource.indexOf("window.releaseConCourseInitialPaint?.();"));
});

test("every terminal authentication path releases safely while pending Hub restore stays gated", () => {
  assert.match(html, /if\(!route\)\{\s*clearRememberedConCourseDestination\(\);[\s\S]*?leavePlanner\(\);/u);
  assert.match(html, /if\(route\.screen === "hub" && !window\.ConCourseHub\?\.restoreView\) return false;/u);
  assert.match(
    hub,
    /else \{[\s\S]*?const postHash = String\(window\.location\.hash \|\| ""\)\.match[\s\S]*?loadedUserId === currentUser\.id[\s\S]*?window\.openTimetableDestination\?\.\(\);[\s\S]*?return;/
  );
  assert.match(html, /console\.error\("Could not load ConCourse state:"[\s\S]*?finishConCourseInitialPaint\(\);/u);
  assert.match(html, /if\(!SUPABASE_CONFIGURED \|\| !window\.supabase\)[\s\S]*?finishConCourseInitialPaint\(\);[\s\S]*?return;/u);
  assert.match(html, /Could not restore the ConCourse session:[\s\S]*?applySession\(null\);[\s\S]*?finishConCourseInitialPaint\(\);/u);
  assert.match(html, /if\(event === "PASSWORD_RECOVERY"\)[\s\S]*?setAuthMode\("recovery"\);[\s\S]*?finishConCourseInitialPaint\(\);/u);
  assert.match(html, /function leavePlanner\(\)\{\s*if\(currentUser\) rememberConCourseDestination\("main"\);\s*else clearRememberedConCourseDestination\(\);/u);
});
