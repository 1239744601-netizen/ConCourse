import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("Timetable makes the Assistant the guided start of course selection", () => {
  const workflow = sourceBetween(
    indexHtml,
    '<div class="wrap" id="appWrap" hidden>',
    '<div class="panel" id="courseBuilderPanel">'
  );

  assert.match(
    workflow,
    /class="configurator-nav"[\s\S]*?href="#courseSelectionHandoffPanel"/
  );
  assert.match(
    workflow,
    /id="courseSelectionHandoffPanel"[\s\S]*?id="selectionAssistantGuide"/
  );
  assert.equal(
    [...workflow.matchAll(/data-selection-step="(search|shortlist|complete)"/g)]
      .map((match) => match[1])
      .join(","),
    "search,shortlist,complete"
  );
  assert.match(
    workflow,
    /class="selection-assistant-launch" href="assistant\/"/
  );
  assert.doesNotMatch(
    workflow.match(/class="selection-assistant-launch"[\s\S]*?<\/a>/)?.[0] || "",
    /target=/
  );
  assert.match(
    workflow,
    /data-i18n="selectionSessionNote"[\s\S]*?href="#courseBuilderPanel"[^>]+data-i18n="selectionManualEntry"/
  );
});

test("Assistant guidance advances from search to returned-course completion", () => {
  const renderer = sourceBetween(
    indexHtml,
    "function renderSelectionAssistantGuide(){",
    "\nfunction renderSelectionHandoffDrafts(){"
  );

  assert.match(renderer, /const pendingCount = selectionHandoffDrafts\.length/);
  assert.match(
    renderer,
    /course\?\.source\?\.kind === "course_selection_assistant"/
  );
  assert.match(
    renderer,
    /search: "complete",\s*shortlist: "complete",\s*complete: pendingCount > 0 \? "current" : "complete"/
  );
  assert.match(
    renderer,
    /search: "current",\s*shortlist: "upcoming",\s*complete: "upcoming"/
  );
  assert.match(renderer, /setAttribute\("aria-current", "step"\)/);
  assert.match(renderer, /removeAttribute\("aria-current"\)/);
  assert.match(
    renderer,
    /t\(completedCount > 0 \? "selectionAllComplete" : "selectionStartHint"\)/
  );
});

test("Returned choices name missing details before focusing Course Builder", () => {
  const requirements = sourceBetween(
    indexHtml,
    "function selectionDraftRequirements(draft){",
    "\nfunction renderSelectionAssistantGuide(){"
  );
  const renderer = sourceBetween(
    indexHtml,
    "function renderSelectionHandoffDrafts(){",
    "\nfunction beginSelectionDraft("
  );
  const begin = sourceBetween(
    indexHtml,
    "function beginSelectionDraft(draftId){",
    "\nfunction clearSelectionRouteParameters(){"
  );

  assert.match(requirements, /draft\.creditsKnown \? "" : t\("selectionMissingCredits"\)/);
  assert.match(requirements, /draft\.sessions\.length \? "" : t\("selectionMissingMeetings"\)/);
  assert.match(renderer, /t\("selectionStillNeeded", \{details:missingDetails\}\)/);
  assert.match(renderer, /t\("selectionReviewDetails"\)/);
  assert.match(begin, /resetCourseOptions\(\)/);
  assert.match(begin, /courseBuilderPanel"\)\.scrollIntoView/);
  assert.match(begin, /t\("selectionCompletePrompt"/);
  assert.match(begin, /selectionDraftRequirements\(draft\)\.join\(" \+ "\)/);
});

test("guided access preserves the account-bound one-time session handoff", () => {
  const consume = sourceBetween(
    indexHtml,
    "function consumeCourseSelectionHandoff(){",
    "\nfunction readCourseContextRoute(){"
  );
  const session = sourceBetween(
    indexHtml,
    "function applySession(session){",
    "\nasync function submitAuth("
  );

  assert.match(
    indexHtml,
    /const ACTIVE_USER_STORAGE_KEY = "concourse_active_user_id_v1"/
  );
  assert.match(
    indexHtml,
    /const SELECTION_HANDOFF_STORAGE_KEY = "concourse_timetable_selection_handoff_v1"/
  );
  assert.match(consume, /sessionStorage\.getItem\(SELECTION_HANDOFF_STORAGE_KEY\)/);
  assert.match(
    consume,
    /payload\.version !== 1 \|\| payload\.kind !== "course-selection"/
  );
  assert.match(
    consume,
    /payloadUserId\.toLowerCase\(\) !== String\(currentUser\.id\)\.toLowerCase\(\)/
  );
  assert.match(consume, /payload\.selections\s*\.slice\(0, 20\)/);
  assert.match(
    consume,
    /sessionStorage\.removeItem\(SELECTION_HANDOFF_STORAGE_KEY\)/
  );
  assert.match(
    session,
    /sessionStorage\.setItem\(ACTIVE_USER_STORAGE_KEY, String\(currentUser\.id\)\.toLowerCase\(\)\)/
  );
  assert.match(
    session,
    /sessionStorage\.removeItem\(ACTIVE_USER_STORAGE_KEY\)/
  );
});
