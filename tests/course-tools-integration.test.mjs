import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  adaptHkbuCatalogue,
  extractCourseCode,
  groupCourseRecords,
  isLocalCourseReviewLocation,
  loadCourseCatalogue,
  loadCourseKeysReadiness,
  safeOfficialUrl,
  searchCourseGroups
} from "../course-tools/course-tools.mjs";

const read = (relativePath) =>
  readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("adds Course Engine as the root course-search destination", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /id="courseSearchNav"[^>]+href="courses\/"[^>]+data-i18n="courseEngineNav"/,
  );
  assert.match(index, /courseEngineNav:"Course Engine"/);
  assert.match(index, /courseEngineNav:"课程引擎"/);
  assert.match(index, /courseEngineNav:"課程引擎"/);
  assert.match(index, /courseSearchLink\.hidden = !signedIn/);
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
  assert.match(searchStage, /<h1[^>]+>Course Engine<\/h1>/);
  assert.match(searchStage, /<form[^>]+id="courseSearchForm"[^>]+role="search"/);
  assert.doesNotMatch(searchStage, /<p\b|<article\b|statistics|filters/i);
  assert.match(searchHtml, /id="courseSearchResults" hidden/);
  assert.match(searchHtml, /href="\.\.\/\?destination=timetable"[^>]+data-copy="timetable"/);
  assert.doesNotMatch(searchHtml, /href="\.\.\/assistant\/"/);
  assert.doesNotMatch(searchHtml, /href="\.\.\/coursekeys\/"/);

  assert.match(assistantStage, /<h1[^>]+>Course Selection Assistant<\/h1>/);
  assert.match(assistantStage, /<form[^>]+id="assistantForm"[^>]+role="search"/);
  assert.doesNotMatch(assistantStage, /<p\b|<article\b|statistics|filters/i);
  assert.match(assistantHtml, /id="assistantWorkspace" hidden/);
  assert.doesNotMatch(assistantHtml, /href="\.\.\/coursekeys\/"/);
});

test("keeps official references on the exact HTTPS allowlist", () => {
  assert.equal(
    safeOfficialUrl("https://ispace.uic.edu.cn/course/view.php?id=42", "bnbu"),
    "https://ispace.uic.edu.cn/course/view.php?id=42",
  );
  assert.equal(
    safeOfficialUrl("https://arcourseoutline.hkbu.edu.hk/outline/ACCT1005.pdf", "hkbu"),
    "https://arcourseoutline.hkbu.edu.hk/outline/ACCT1005.pdf",
  );
  assert.equal(safeOfficialUrl("http://ispace.uic.edu.cn/course/42", "bnbu"), "");
  assert.equal(safeOfficialUrl("https://ispace.uic.edu.cn.evil.test/42", "bnbu"), "");
  assert.equal(safeOfficialUrl("https://user@ispace.uic.edu.cn/course/42", "bnbu"), "");
  assert.equal(safeOfficialUrl("https://ispace.uic.edu.cn:8443/course/42", "bnbu"), "");
  assert.equal(safeOfficialUrl("javascript:alert(1)", "hkbu"), "");
});

test("adapts rich HKBU records without exposing personalized quota fields", () => {
  const catalogue = {
    schema_version: 1,
    institution: "hkbu",
    term: "Semester 1 2026-27",
    captured_at: "2026-07-28",
    source_mode: "authenticated_developer_snapshot",
    publication_status: "reference_only",
    caveats: ["Point-in-time reference only."],
    counts: { courses: 2, sections: 2 },
    courses: [
      {
        course_code: "TEST1005",
        title: "Shared Course Title",
        chinese_title: "共同课程",
        units: 3,
        level: "Undergraduate",
        academic_group: "School of Testing",
        unit_code: "TEST",
        teaching_medium: "English",
        prerequisite_text: "Year 2 standing",
        corequisite_text: null,
        target_students: "Test students",
        description: "A rich course description.",
        outline_url: "https://arcourseoutline.hkbu.edu.hk/outline/TEST1005.pdf",
        sections: [{
          section: "00001",
          day_time: "Mon 09:30-12:20",
          instructor: "Dr Test",
          teaching_medium: "English",
          available_quota: "12",
          quota_scope: "unknown",
          remarks: "Instructor approval required"
        }],
        prerequisite_rules: [{ condition: "Year 2 standing" }],
        corequisite_rules: []
      },
      {
        course_code: "TEST2005",
        title: "Shared Course Title",
        units: 3,
        level: "Undergraduate",
        academic_group: "School of Testing",
        teaching_medium: "English",
        outline_url: "https://evil.test/outline.pdf",
        sections: [{
          section: "00002",
          day_time: "Tue 09:30-12:20",
          instructor: "Dr Example",
          available_quota: "Full"
        }],
        prerequisite_rules: [],
        corequisite_rules: []
      }
    ]
  };
  const manifest = {
    schema_version: 1,
    institution: "hkbu",
    term: "Semester 1 2026-27",
    captured_at: "2026-07-28",
    publication_status: "reference_only",
    course_count: 2,
    section_count: 2
  };

  const records = adaptHkbuCatalogue(catalogue, manifest);
  const groups = groupCourseRecords(records);
  assert.equal(groups.length, 2, "different course codes must not merge by title");
  assert.equal(records[0].courseKey, "hkbu:TEST1005");
  assert.equal(records[0].courseKeysKey, "");
  assert.equal(records[0].sectionDetails[0].dayTime, "Mon 09:30-12:20");
  assert.deepEqual(
    groups.find((group) => group.code === "TEST1005")?.instructors,
    ["Dr Test"]
  );
  assert.equal(records[1].officialUrl, "");
  assert.doesNotMatch(JSON.stringify(records), /available_quota|availableQuota|quota_scope/i);
});

test("never requests the authenticated HKBU snapshot on a public host", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          generatedDate: "2026-07-29",
          institutions: [{ id: "bnbu", status: "reference" }],
          courses: [{
            institutionId: "bnbu",
            sourceCourseId: "42",
            title: "TEST1005 Public Course",
            officialUrl: "https://ispace.uic.edu.cn/course/view.php?id=42"
          }]
        };
      }
    };
  };

  const catalogue = await loadCourseCatalogue({
    locationLike: { hostname: "concourse.example" },
    fetchImpl
  });
  assert.equal(catalogue.courses.length, 1);
  assert.equal(requests.length, 1);
  assert.doesNotMatch(requests.join("\n"), /hkbu-catalogue-current|hkbu-2026/i);
  assert.equal(isLocalCourseReviewLocation({ hostname: "0.0.0.0" }), false);
});

test("loads and authenticates the HKBU snapshot only for local review", async () => {
  const snapshot = {
    schema_version: 1,
    institution: "hkbu",
    term: "Semester 1 2026-27",
    captured_at: "2026-07-28",
    source_mode: "authenticated_developer_snapshot",
    publication_status: "reference_only",
    caveats: ["Reference only."],
    counts: { courses: 1, sections: 1 },
    courses: [{
      course_code: "ACCT1005",
      title: "Principles of Accounting I",
      units: 3,
      academic_group: "School of Business",
      teaching_medium: "English",
      outline_url: "https://arcourseoutline.hkbu.edu.hk/outline/ACCT1005.pdf",
      sections: [{
        section: "00001",
        day_time: "Fri 12:30-15:20",
        instructor: "Dr Test",
        available_quota: "50"
      }],
      prerequisite_rules: [],
      corequisite_rules: []
    }]
  };
  const snapshotText = JSON.stringify(snapshot);
  const checksum = createHash("sha256").update(snapshotText).digest("hex");
  const manifest = {
    schema_version: 1,
    institution: "hkbu",
    term: "Semester 1 2026-27",
    catalogue_url: "hkbu-test-catalog.json",
    captured_at: "2026-07-28",
    publication_status: "reference_only",
    course_count: 1,
    section_count: 1,
    content_sha256: checksum
  };
  const requests = [];
  const fetchImpl = async (url) => {
    const request = String(url);
    requests.push(request);
    if (request.endsWith("course-catalogue.json")) {
      return {
        ok: true,
        async json() {
          return { institutions: [], courses: [] };
        }
      };
    }
    if (request.endsWith("hkbu-catalogue-current.json")) {
      return { ok: true, async json() { return manifest; } };
    }
    if (request.endsWith("hkbu-test-catalog.json")) {
      return { ok: true, async text() { return snapshotText; } };
    }
    return { ok: false, status: 404 };
  };

  const catalogue = await loadCourseCatalogue({
    locationLike: { hostname: "localhost" },
    fetchImpl,
    cryptoLike: webcrypto
  });
  assert.equal(catalogue.groups[0].courseKey, "hkbu:ACCT1005");
  assert.ok(requests.some((request) => request.endsWith("hkbu-catalogue-current.json")));
  assert.ok(requests.some((request) => request.endsWith("hkbu-test-catalog.json")));

  const tamperedCatalogue = await loadCourseCatalogue({
    locationLike: { hostname: "localhost" },
    cryptoLike: webcrypto,
    fetchImpl: async (url) => {
      const request = String(url);
      if (request.endsWith("course-catalogue.json")) {
        return {
          ok: true,
          async json() {
            return {
              institutions: [{ id: "bnbu", status: "reference" }],
              courses: [{
                institutionId: "bnbu",
                sourceCourseId: "42",
                title: "TEST1005 Public Fallback"
              }]
            };
          }
        };
      }
      if (request.endsWith("hkbu-catalogue-current.json")) {
        return { ok: true, async json() { return manifest; } };
      }
      if (request.endsWith("hkbu-test-catalog.json")) {
        return { ok: true, async text() { return `${snapshotText}\n`; } };
      }
      return { ok: false, status: 404 };
    }
  });
  assert.equal(tamperedCatalogue.courses.length, 1);
  assert.equal(tamperedCatalogue.courses[0].institutionId, "bnbu");
  assert.equal(
    tamperedCatalogue.sources.find((source) => source.id === "hkbu-local-review")?.status,
    "unavailable"
  );
});

test("keeps CourseKeys contribution capabilities locked even if a server reports otherwise", async () => {
  const readiness = await loadCourseKeysReadiness(async () => ({
    ok: true,
    async json() {
      return {
        uploads: true,
        publishing: true,
        downloads: true,
        transactions: true,
        credits: true
      };
    }
  }));

  assert.equal(readiness.reachable, true);
  assert.equal(readiness.integrationLocked, true);
  assert.equal(readiness.uploads, false);
  assert.equal(readiness.publishing, false);
  assert.equal(readiness.transactions, false);
  assert.equal(readiness.credits, false);
});

test("renders explicit handoffs and a fail-closed syllabus contribution control", async () => {
  const [html, script] = await Promise.all([
    read("courses/index.html"),
    read("courses/courses.mjs")
  ]);

  assert.match(html, /<title>Course Engine · ConCourse<\/title>/);
  assert.match(script, /destination === "timetable" \? "add-course" : "search"/);
  assert.match(script, /"timetable",\s*group/);
  assert.match(script, /"community",\s*group/);
  assert.match(script, /"marketplace",\s*group/);
  assert.match(script, /dataset\.syllabusContribution = "locked"/);
  assert.match(script, /lockedButton\.disabled = true/);
  assert.doesNotMatch(`${html}\n${script}`, /type=["']file["']/i);
  assert.doesNotMatch(script, /method:\s*["']POST["']|FormData\s*\(/);
});

test("reveals course information only after form submission", async () => {
  const [searchScript, assistantScript] = await Promise.all([
    read("courses/courses.mjs"),
    read("assistant/assistant.mjs"),
  ]);

  assert.match(searchScript, /courseSearchForm"\)\.addEventListener\("submit"/);
  assert.match(searchScript, /Promise\.all\(\[ensureCatalogue\(\), ensureReadiness\(\)\]\)/);
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
