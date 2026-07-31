import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  extractCourseCode,
  groupCourseRecords,
  searchCourseGroups
} from "../course-tools/course-tools.mjs";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("adds distinct Explore Courses and Course Selection Assistant destinations", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /id="courseSearchNav"[^>]+href="courses\/"[^>]+data-i18n="exploreCoursesNav"/,
  );
  assert.match(
    index,
    /id="courseSelectionNav"[^>]+href="assistant\/"[^>]+data-i18n="courseSelectionNav"/,
  );
  assert.match(index, /exploreCoursesNav:"Explore Courses"/);
  assert.match(index, /courseSelectionNav:"Select Courses"/);
  assert.match(index, /exploreCoursesNav:"探索课程"/);
  assert.match(index, /courseSelectionNav:"選科助手"/);
  assert.match(index, /courseSearchLink\.hidden = !signedIn/);
  assert.match(index, /courseSelectionLink\.hidden = !signedIn/);
});

test("keeps both course tools clean before an explicit search", async () => {
  const [searchHtml, assistantHtml] = await Promise.all([
    read("courses/index.html"),
    read("assistant/index.html"),
  ]);

  const searchStage = searchHtml.match(
    /<section class="course-search-stage"[\s\S]*?<\/section>/,
  )?.[0];
  const assistantStage = assistantHtml.match(
    /<section class="course-search-stage"[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(searchStage);
  assert.ok(assistantStage);
  assert.match(searchStage, /<h1[^>]+>Explore Courses<\/h1>/);
  assert.match(searchStage, /<form[^>]+id="courseSearchForm"[^>]+role="search"/);
  assert.doesNotMatch(searchStage, /<p\b|<article\b|statistics|filters/i);
  assert.match(searchHtml, /id="courseSearchResults" hidden/);

  assert.match(assistantStage, /<h1[^>]+>Course Selection Assistant<\/h1>/);
  assert.match(assistantStage, /<form[^>]+id="assistantForm"[^>]+role="search"/);
  assert.doesNotMatch(assistantStage, /<p\b|<article\b|statistics|filters/i);
  assert.match(assistantHtml, /id="assistantWorkspace" hidden/);
});

test("reveals course information only after form submission", async () => {
  const [searchScript, assistantScript] = await Promise.all([
    read("courses/courses.mjs"),
    read("assistant/assistant.mjs"),
  ]);

  assert.match(searchScript, /courseSearchForm"\)\.addEventListener\("submit"/);
  assert.match(searchScript, /await ensureCatalogue\(\)/);
  assert.match(searchScript, /courseSearchResults"\)\.hidden = false/);
  assert.doesNotMatch(searchScript, /courseSearchInput"\)\.addEventListener\("input"/);

  assert.match(assistantScript, /assistantForm"\)\.addEventListener\("submit"/);
  assert.match(assistantScript, /await ensureCatalogue\(\)/);
  assert.match(assistantScript, /assistantWorkspace"\)\.hidden = false/);
  assert.match(assistantScript, /concourse_course_selection_shortlist_v1/);
  assert.doesNotMatch(assistantScript, /ConCoursePlanner|\/planner|Plan this course/);
});

test("groups catalogue sections and ranks course, faculty, and instructor searches", () => {
  const records = [
    {
      institutionId: "test",
      institutionName: "Test University",
      institutionShortName: "TU",
      sourceCourseId: "1001",
      title: "FIN3010 Corporate Finance",
      faculty: "School of Business",
      academicPeriod: "Semester 1",
      sections: ["A1"],
      instructor: "Dr. Alex Wong",
      officialUrl: "https://example.edu/1001",
    },
    {
      institutionId: "test",
      institutionName: "Test University",
      institutionShortName: "TU",
      sourceCourseId: "1002",
      title: "FIN3010 Corporate Finance",
      faculty: "School of Business",
      academicPeriod: "Semester 1",
      sections: ["A2"],
      instructor: "Dr. Maya Chen",
      officialUrl: "https://example.edu/1002",
    },
    {
      institutionId: "test",
      institutionName: "Test University",
      institutionShortName: "TU",
      sourceCourseId: "2001",
      title: "HIST2001 World History",
      faculty: "Faculty of Arts",
      academicPeriod: "Semester 1",
      sections: ["B1"],
      instructor: "Dr. Lin",
      officialUrl: "https://example.edu/2001",
    },
  ];

  const groups = groupCourseRecords(records);
  assert.equal(groups.length, 2);
  const finance = groups.find((group) => group.code === "FIN3010");
  assert.deepEqual(finance.sections, ["A1", "A2"]);
  assert.deepEqual(finance.instructors, ["Dr. Alex Wong", "Dr. Maya Chen"]);
  assert.equal(extractCourseCode(finance.title), "FIN3010");

  assert.equal(searchCourseGroups(groups, "FIN3010")[0].title, "FIN3010 Corporate Finance");
  assert.equal(searchCourseGroups(groups, "Maya Chen")[0].title, "FIN3010 Corporate Finance");
  assert.equal(searchCourseGroups(groups, "Faculty of Arts")[0].title, "HIST2001 World History");
});

test("keeps CourseKeys separate while linking all three course destinations", async () => {
  const [courseKeysHtml, courseKeysScript] = await Promise.all([
    read("coursekeys/index.html"),
    read("coursekeys/coursekeys.js"),
  ]);

  assert.match(courseKeysHtml, /href="\.\.\/courses\/"[^>]+data-copy="exploreCourses"/);
  assert.match(courseKeysHtml, /href="\.\.\/assistant\/"[^>]+data-copy="selectionAssistant"/);
  assert.match(courseKeysHtml, /href="\.\/" aria-current="page">CourseKeys/);
  assert.match(
    courseKeysScript,
    /const COURSEKEYS_CAPABILITIES = Object\.freeze\(\{\s*uploads: false,\s*publishing: false,\s*downloads: false,\s*transactions: false,/s,
  );
});
