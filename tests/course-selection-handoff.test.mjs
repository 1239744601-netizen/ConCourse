import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACTIVE_USER_SESSION_KEY,
  TIMETABLE_HANDOFF_LIMIT,
  TIMETABLE_HANDOFF_SESSION_KEY,
  TIMETABLE_HANDOFF_VERSION,
  createTimetableHandoff,
  readActiveUserId,
  resolveCourseKeySelection,
  resolveSelectedChoices,
  sessionsFromDayTime
} from "../assistant/handoff.mjs";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

function courseGroup(index = 1) {
  return {
    id: `test|course ${index}|semester 1`,
    institutionId: "test",
    institutionName: "Test\u0000 University",
    institutionShortName: "TU",
    title: `COMP${1000 + index}  Secure   Systems`,
    code: `COMP${1000 + index}`,
    faculty: "Computing",
    academicPeriod: "Semester 1",
    entries: [
      {
        id: `test:${index}`,
        sourceCourseId: String(index),
        sections: ["A1", "A2"],
        sectionDetails: [
          {
            section: "A1",
            instructor: "Dr. Section One",
            dayTime: "Mon 09:30-12:20 ROOM101"
          },
          {
            section: "A2",
            instructor: "Dr. Section Two",
            dayTime: "To be arranged by dept./prog."
          }
        ],
        instructor: "Dr. Example"
      }
    ]
  };
}

test("resolves exact Course Engine handoffs to a catalogue choice", () => {
  const group = courseGroup();

  assert.equal(
    resolveCourseKeySelection([group], "test:1::A2")?.choiceId,
    "test:1::A2"
  );
  assert.equal(
    resolveCourseKeySelection([group], "test:1")?.choiceId,
    "test:1::A1"
  );
  assert.equal(
    resolveCourseKeySelection([group], group.id)?.group,
    group
  );
  assert.equal(
    resolveCourseKeySelection([group], "1")?.group,
    group
  );
  assert.equal(resolveCourseKeySelection([group], "missing"), null);
});

test("resolves, sanitizes, deduplicates, and caps shortlist choices", () => {
  const groups = Array.from(
    { length: TIMETABLE_HANDOFF_LIMIT + 2 },
    (_, index) => courseGroup(index + 1)
  );
  const selections = new Map(
    groups.map((group, index) => [
      group.id,
      `${group.entries[0].id}::${index % 2 ? "A2" : "A1"}`
    ])
  );
  selections.set("tampered", "tampered::choice");

  const resolved = resolveSelectedChoices(groups, selections);

  assert.equal(resolved.length, TIMETABLE_HANDOFF_LIMIT);
  assert.equal(resolved[0].institutionName, "Test University");
  assert.equal(resolved[0].courseTitle, "COMP1001 Secure Systems");
  assert.equal(resolved[0].section, "A1");
  assert.equal(resolved[0].instructor, "Dr. Section One");
  assert.deepEqual(resolved[0].sessions, [{
    days: [1],
    start: 570,
    end: 740
  }]);
  assert.equal(resolved[0].credits, null);
  assert.ok(resolved.every((selection) => selection.groupId !== "tampered"));
});

test("accepts only unambiguous timetable strings and leaves missing times manual", () => {
  assert.deepEqual(
    sessionsFromDayTime("Thu 09:30-12:20 ; Thu 13:30-16:20"),
    [
      { days: [4], start: 570, end: 740 },
      { days: [4], start: 810, end: 980 }
    ]
  );
  assert.deepEqual(sessionsFromDayTime("To be arranged by dept./prog."), []);
  assert.deepEqual(sessionsFromDayTime("Some Fridays"), []);
  assert.deepEqual(sessionsFromDayTime("Mon 12:00-11:00"), []);
});

test("creates a versioned, user-bound one-time timetable payload", () => {
  const userId = "A8B7C6D5-E4F3-4210-9876-1234567890AB";
  const selections = resolveSelectedChoices(
    [courseGroup()],
    new Map([["test|course 1|semester 1", "test:1::A1"]])
  );
  const payload = createTimetableHandoff({
    userId,
    selections,
    createdAt: new Date("2026-07-31T08:00:00.000Z"),
    handoffId: "handoff-test"
  });

  assert.equal(payload.version, TIMETABLE_HANDOFF_VERSION);
  assert.equal(payload.kind, "course-selection");
  assert.equal(payload.handoffId, "handoff-test");
  assert.equal(payload.createdAt, "2026-07-31T08:00:00.000Z");
  assert.equal(payload.userId, userId.toLowerCase());
  assert.equal(payload.selections.length, 1);
  assert.deepEqual(payload.selections[0].sessions, [{
    days: [1],
    start: 570,
    end: 740
  }]);
  assert.throws(
    () => createTimetableHandoff({ userId: "not-a-user", selections }),
    /valid active user id/
  );
  assert.throws(
    () => createTimetableHandoff({ userId, selections: [] }),
    /At least one resolved/
  );
});

test("reads the active user only from the defined session key", () => {
  const userId = "a8b7c6d5-e4f3-4210-9876-1234567890ab";
  const storage = new Map([[ACTIVE_USER_SESSION_KEY, userId]]);
  const adapter = { getItem: (key) => storage.get(key) || null };

  assert.equal(ACTIVE_USER_SESSION_KEY, "concourse_active_user_id_v1");
  assert.equal(readActiveUserId(adapter), userId);
  storage.set(ACTIVE_USER_SESSION_KEY, "invalid");
  assert.equal(readActiveUserId(adapter), "");
});

test("keeps Assistant in the timetable flow and exposes an explicit timetable action", async () => {
  const [html, script] = await Promise.all([
    read("assistant/index.html"),
    read("assistant/assistant.mjs")
  ]);

  const navigation = html.match(
    /<nav[\s\S]*?class="course-primary-navigation"[\s\S]*?<\/nav>/
  )?.[0];
  assert.ok(navigation);
  assert.match(
    navigation,
    /href="\.\.\/"[^>]+aria-current="page"[^>]+data-course-route="timetable"[^>]+data-copy="timetable"/
  );
  assert.match(navigation, /data-course-route="hub"[^>]+data-copy="studentHub"/);
  assert.doesNotMatch(navigation, /course-navigation-context|data-copy="selectionAssistant"/);
  assert.match(
    html,
    /id="continueToTimetable"[\s\S]*?disabled[\s\S]*?data-copy="continueToTimetable"/
  );
  assert.match(script, /new URL\(window\.location\.href\)\.searchParams\.get\("courseKey"\)/);
  assert.match(script, /resolveSelectedChoices\(/);
  assert.match(script, /sessionStorage\.setItem\(\s*TIMETABLE_HANDOFF_SESSION_KEY/);
  assert.match(
    script,
    /window\.location\.assign\("\.\.\/\?destination=timetable&selection=1"\)/
  );
  assert.equal(
    TIMETABLE_HANDOFF_SESSION_KEY,
    "concourse_timetable_selection_handoff_v1"
  );
});
