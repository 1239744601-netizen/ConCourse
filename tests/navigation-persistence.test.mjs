import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const navigation = require("../navigation-state.js");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const hub = readFileSync(new URL("../member-hub.js", import.meta.url), "utf8");

function memoryStorage(){
  const values = new Map();
  return {
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value),
    removeItem:key => values.delete(key)
  };
}

test("navigation state round-trips only allowlisted routes for the same user", () => {
  const storage = memoryStorage();
  const userId = "user-123";
  for(const screen of ["main", "planner", "timetable"]){
    const written = navigation.writeRoute(storage, userId, screen);
    assert.deepEqual(navigation.readRoute(storage, userId), written);
  }
  for(const view of navigation.HUB_VIEWS){
    const written = navigation.writeRoute(storage, userId, "hub", view);
    assert.deepEqual(navigation.readRoute(storage, userId), written);
  }

  assert.equal(navigation.createRoute(userId, "unknown"), null);
  assert.equal(navigation.createRoute(userId, "hub", "unknown"), null);
  navigation.writeRoute(storage, userId, "hub", "profile");
  assert.equal(navigation.readRoute(storage, "another-user"), null);
});

test("navigation storage failures and malformed state fail closed", () => {
  const throwingStorage = {
    getItem(){ throw new Error("blocked"); },
    setItem(){ throw new Error("blocked"); },
    removeItem(){ throw new Error("blocked"); }
  };
  assert.equal(navigation.readRoute(throwingStorage, "user-123"), null);
  assert.equal(navigation.writeRoute(throwingStorage, "user-123", "planner"), null);
  assert.equal(navigation.clearRoute(throwingStorage), false);
  assert.equal(navigation.writeRoute(null, "user-123", "planner"), null);
  assert.equal(navigation.clearRoute(null), false);

  const storage = memoryStorage();
  storage.setItem(navigation.STORAGE_KEY, "{not-json");
  assert.equal(navigation.readRoute(storage, "user-123"), null);
  storage.setItem(navigation.STORAGE_KEY, JSON.stringify({
    version:99,
    userId:"user-123",
    screen:"planner"
  }));
  assert.equal(navigation.readRoute(storage, "user-123"), null);
});

test("shared content and authentication hashes override a remembered route", () => {
  const id = "2f1c85c8-6b33-4e3b-8ee8-972819f3586c";
  assert.equal(navigation.hasAuthoritativeHash(`#listing-${id}`), true);
  assert.equal(navigation.hasAuthoritativeHash(`#post-${id}`), true);
  assert.equal(navigation.hasAuthoritativeHash(`#cross-post-${id}`), true);
  assert.equal(navigation.hasAuthoritativeHash("#access_token=secret&type=recovery"), true);
  assert.equal(navigation.hasAuthoritativeHash("#state=ready&type=recovery"), true);
  assert.equal(navigation.hasAuthoritativeHash("#planner"), false);
});

test("generated timetable routes regenerate results instead of falling back to the planner", () => {
  assert.equal(navigation.timetableRestoreAction({hasFinalTimetable:true}), "open");
  assert.equal(navigation.timetableRestoreAction({hasGeneratedSolutions:true}), "open");
  assert.equal(navigation.timetableRestoreAction({hasPlannerCourses:true}), "regenerate");
  assert.equal(navigation.timetableRestoreAction(), "planner");
});

test("visible destinations persist and restore after account hydration", () => {
  assert.match(html, /<script src="navigation-state\.js\?v=[^"]+"><\/script>/u);
  assert.match(html, /<script src="member-hub\.js\?v=20260731-refresh1"><\/script>/u);
  assert.match(html, /function enterPlanner\(\)\{[\s\S]*?rememberConCourseDestination\("planner"\)/u);
  assert.match(html, /function leavePlanner\(\)\{[\s\S]*?rememberConCourseDestination\("main"\)/u);
  assert.match(html, /function showSchedulePage\(\)\{[\s\S]*?rememberConCourseDestination\("timetable"\)/u);
  assert.match(html, /function showPlannerEditor\(\)\{[\s\S]*?rememberConCourseDestination\("planner"\)/u);
  assert.match(
    html,
    /loadedUserId = userId;\s*await restoreConCourseDestination\(\);\s*renderFinalTimetableStatus\(\);/u
  );
  assert.match(
    html,
    /action === "regenerate"\)\{\s*generate\(\);\s*if\(\$\("schedulePage"\)\.hidden\) showPlannerEditor\(\);/u
  );
  assert.match(
    html,
    /const restoredView = await window\.ConCourseHub\.restoreView\(route\.hubView\);\s*if\(!restoredView\)\{\s*if\(currentUser\?\.id === userId\) restoredNavigationUserId = null;/u
  );
  assert.match(html, /if\(previousUserId\) clearRememberedConCourseDestination\(\);/u);
});

test("Hub persistence records the validated visible view and guards owner restoration", () => {
  const normalized = hub.indexOf('if(!["overview", "community", "marketplace", "messages", "academic-tools", "profile", "owner-console"].includes(view)) view = "community";');
  const persisted = hub.indexOf('window.rememberConCourseDestination?.("hub", view);');
  assert.ok(normalized >= 0 && persisted > normalized);
  assert.match(hub, /if\(!\$\("memberHub"\)\.hidden\) window\.rememberConCourseDestination\?\.\("hub", view\);/u);
  assert.match(hub, /if\(view === "owner-console"\) await loadAdminContext\(\);/u);
  assert.match(hub, /syncAccess\(\);\s*void window\.restoreConCourseDestination\?\.\(\);/u);
  assert.match(
    hub,
    /if\(response\.error\)\{[\s\S]*?hubState\.adminQueue = \[\];[\s\S]*?hubState\.ownerSummary = null;[\s\S]*?hubState\.verificationEvidenceByCase = new Map\(\);[\s\S]*?hubState\.activeView === "owner-console" && !\$\("memberHub"\)\.hidden/u
  );
});
