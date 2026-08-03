import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(
  new URL("../timetable-immersive.css", import.meta.url),
  "utf8"
);
const client = readFileSync(
  new URL("../timetable-immersive.js", import.meta.url),
  "utf8"
);

test("the immersive timetable assets load without replacing the existing planner", () => {
  const immersiveStyle = html.indexOf("timetable-immersive.css");
  const stabilizationStyle = html.indexOf("concourse-stabilization.css");

  assert.ok(immersiveStyle > -1);
  assert.ok(stabilizationStyle > immersiveStyle);
  assert.match(html, /timetable-immersive\.js/);
  assert.match(html, /id="courseSelectionHandoffPanel"/);
  assert.match(html, /id="wishlistPanel"/);
  assert.ok(
    existsSync(new URL("../concourse-timetable-journey-v1.png", import.meta.url))
  );
});

test("desktop planning prioritizes the Assistant and keeps the wishlist compact", () => {
  assert.match(
    styles,
    /grid-template-columns: minmax\(300px, 360px\) minmax\(680px, 1fr\)/
  );
  assert.match(styles, /grid-template-areas: "wishlist config"/);
  assert.match(styles, /\.selection-assistant-panel[\s\S]*?min-height: 390px/);
  assert.match(styles, /#wishlistPanel #courseList[\s\S]*?overflow-y: auto/);
  assert.match(
    styles,
    /@media \(max-width: 1120px\)[\s\S]*?"config"[\s\S]*?"wishlist"/
  );
});

test("particles respond to pointer and focus while respecting accessibility preferences", () => {
  assert.match(client, /canvas class="planner-particle-field"/);
  assert.match(client, /const routes = \[/);
  assert.match(client, /workspace\.addEventListener\("pointermove"/);
  assert.match(client, /focusElement = element/);
  assert.match(client, /navigator\.connection\?\.saveData/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(styles, /mix-blend-mode: screen/);
  assert.match(
    styles,
    /html\[data-theme="day"\][\s\S]*?\.planner-particle-field[\s\S]*?mix-blend-mode: multiply/
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/
  );
  assert.match(styles, /@media \(forced-colors: active\)/);
});
