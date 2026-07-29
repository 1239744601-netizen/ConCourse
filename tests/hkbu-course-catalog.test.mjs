import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const api = require("../course-catalog.js");
const moduleSource = fs.readFileSync(new URL("../course-catalog.js", import.meta.url), "utf8");
const fixture = JSON.parse(
  fs.readFileSync(new URL("./fixtures/hkbu-portal-snapshot.json", import.meta.url), "utf8")
);

const clone = value => JSON.parse(JSON.stringify(value));

function externalCatalogue(){
  return {
    schema_version:1,
    institution:"hkbu",
    term:"Semester 1 2026-27",
    captured_at:"2026-07-28",
    source_mode:"authenticated_developer_snapshot",
    publication_status:"reference_only",
    caveats:["Quota is informational only."],
    counts:{courses:5, sections:5},
    courses:[
      {
        course_code:"COMP3005",
        title:"Algorithms",
        units:3,
        level:"Undergraduate",
        academic_group:"Department of Computer Science",
        unit_code:"COMP",
        teaching_medium:"English",
        prerequisite_text:"COMP2005",
        corequisite_text:null,
        target_students:"All students",
        sections:[
          {
            section:"00001",
            day_time:"Mon 12:30-15:20 AAB502",
            instructor:"Teaching Staff",
            available_quota:"Full",
            quota_scope:"unknown",
            remarks:null
          },
          {
            section:"00002",
            day_time:"Wed 09:30-12:20 SCT502",
            instructor:"Teaching Staff",
            available_quota:"12",
            quota_scope:"unknown",
            remarks:null
          }
        ],
        prerequisite_rules:[],
        corequisite_rules:[]
      },
      {
        course_code:"ACCT1005",
        title:"Principles of Accounting I",
        units:3,
        level:"Undergraduate",
        prerequisite_text:null,
        corequisite_text:null,
        target_students:"For BBA Accountancy students only",
        sections:[{
          section:"00001",
          day_time:"Fri 12:30-15:20",
          instructor:"Teaching Staff",
          available_quota:"20",
          quota_scope:"unknown",
          remarks:null
        }],
        prerequisite_rules:[],
        corequisite_rules:[]
      },
      {
        course_code:"COMP4005",
        title:"Advanced Systems",
        units:3,
        level:"Undergraduate",
        prerequisite_text:"COMP3999",
        corequisite_text:null,
        target_students:null,
        sections:[{
          section:"00001",
          day_time:"Thu 15:30-18:20",
          instructor:"Teaching Staff",
          available_quota:"8",
          quota_scope:"unknown",
          remarks:null
        }],
        prerequisite_rules:[],
        corequisite_rules:[]
      },
      {
        course_code:"ARTT1005",
        title:"Arts Technology",
        units:3,
        level:"Undergraduate",
        prerequisite_text:null,
        corequisite_text:null,
        target_students:null,
        sections:[{
          section:"00001",
          day_time:"Fri 09:30-13:20 AVA217",
          instructor:"Teaching Staff",
          available_quota:"42",
          quota_scope:"unknown",
          remarks:"Instructor Approval Required"
        }],
        prerequisite_rules:[],
        corequisite_rules:[]
      },
      {
        course_code:"VACD7010",
        title:"Studio Project",
        units:4.5,
        level:"Undergraduate",
        prerequisite_text:null,
        corequisite_text:null,
        target_students:null,
        sections:[{
          section:"00001",
          day_time:"To be arranged by dept./prog.",
          instructor:"Teaching Staff",
          available_quota:null,
          quota_scope:"unknown",
          remarks:null
        }],
        prerequisite_rules:[],
        corequisite_rules:[]
      }
    ]
  };
}

test("exports a CommonJS API and a browser global", () => {
  assert.equal(typeof api.validateSnapshot, "function");
  assert.equal(typeof api.buildPlannerCandidates, "function");

  const context = {};
  vm.createContext(context);
  vm.runInContext(moduleSource, context, {filename:"course-catalog.js"});
  assert.equal(typeof context.ConCourseCourseCatalog, "object");
  assert.equal(typeof context.ConCourseCourseCatalog.recommendCourses, "function");
});

test("validates and canonicalizes the fixed normalized snapshot schema", () => {
  const result = api.validateSnapshot(fixture);
  assert.equal(result.ok, true);
  assert.equal(result.value.schema_version, 1);
  assert.equal(result.value.source.institution, "hkbu");
  assert.equal(result.value.source.mode, "user_portal_import");
  assert.equal(result.value.source.captured_at, "2026-07-28T00:15:00.000Z");
  assert.equal(result.value.academic_profile.degree_level, "bachelor");
  assert.equal(result.value.assigned_courses[0].course_code, "COMP1005");
  assert.deepEqual(result.value.assigned_courses[0].meetings[0].days, [1]);
  assert.deepEqual(Object.keys(result.value.completed_courses[0]), [
    "course_code",
    "units",
    "result_scope"
  ]);
  assert.deepEqual(result.value.remaining_requirements[0].allowed_course_codes, [
    "COMP3005",
    "MATH2005"
  ]);
});

test("fails closed on PII-named fields, unknown aliases, and bounded arrays", () => {
  const pii = clone(fixture);
  pii.academic_profile.student_id = "hidden";
  const piiResult = api.validateSnapshot(pii);
  assert.equal(piiResult.ok, false);
  assert.equal(piiResult.errors[0].code, "PII_FIELD_REJECTED");

  const camelCase = clone(fixture);
  camelCase.assigned_courses[0].meetings[0].startsAt = camelCase.assigned_courses[0].meetings[0].start;
  delete camelCase.assigned_courses[0].meetings[0].start;
  const camelResult = api.validateSnapshot(camelCase);
  assert.equal(camelResult.ok, false);
  assert.equal(camelResult.errors[0].code, "UNKNOWN_FIELD");

  const tooManyPages = clone(fixture);
  tooManyPages.source.pages = Array.from({length:25}, (_, index) => `page-${index}`);
  const boundedResult = api.validateSnapshot(tooManyPages);
  assert.equal(boundedResult.ok, false);
  assert.equal(boundedResult.errors[0].code, "LIMIT_EXCEEDED");
});

test("canonicalizes spaced and dotted HKBU course codes consistently", () => {
  const snapshot = clone(fixture);
  snapshot.completed_courses[0].course_code = "A.F.7430";
  const validated = api.validateSnapshot(snapshot);
  assert.equal(validated.ok, true);
  assert.equal(validated.value.completed_courses[0].course_code, "AF7430");

  const catalogue = {
    institution:"hkbu",
    courses:[{
      course_code:"ITS 1005",
      title:"Information Technology",
      units:3,
      sections:[]
    }]
  };
  const catalogueResult = api.validateCatalogue(catalogue);
  assert.equal(catalogueResult.ok, true);
  assert.equal(catalogueResult.value.courses[0].course_code, "ITS1005");
});

test("parses HKBU days, times, multi-meeting strings, and venue alternatives", () => {
  assert.deepEqual(api.parseHkbuDays("Mon/Wed"), [1, 3]);
  assert.deepEqual(api.parseHkbuDays(["星期二", "Thu"]), [2, 4]);
  assert.equal(api.parseHkbuTime("9:30 PM"), 21 * 60 + 30);
  assert.deepEqual(api.parseHkbuTimeRange("09:30–12:20"), {
    start:9 * 60 + 30,
    end:12 * 60 + 20
  });

  const parsed = api.parseHkbuMeetingText(
    "Mon 10:30-12:20 SCT502; Fri 16:30-18:20 AAB711; WYS711"
  );
  assert.equal(parsed.unresolved_fragments.length, 0);
  assert.equal(parsed.meetings.length, 2);
  assert.deepEqual(parsed.meetings[0], {
    days:[1],
    start:"10:30",
    end:"12:20",
    venue:"SCT502"
  });
  assert.equal(parsed.meetings[1].venue, "AAB711; WYS711");

  const tba = api.parseHkbuMeetingText("To be arranged by dept./prog.");
  assert.equal(tba.meetings.length, 0);
  assert.equal(tba.unresolved_fragments[0].code, "MEETING_TBA");

  const venueOnly = api.parseHkbuMeetingText("AAB502");
  assert.equal(venueOnly.meetings.length, 0);
  assert.equal(venueOnly.unresolved_fragments[0].code, "MEETING_TEXT_UNPARSED");
});

test("builds planner-safe assigned and eligible courses while preserving uncertainty", () => {
  const built = api.buildPlannerCandidates(fixture, externalCatalogue());
  assert.equal(built.assigned.length, 1);
  assert.equal(built.assigned[0].required, true);
  assert.equal(built.assigned[0].options[0].sessions[0].start, 9 * 60 + 30);

  assert.deepEqual(built.candidates.map(course => course.course_code), ["COMP3005"]);
  assert.equal(built.candidates[0].options.length, 2);
  assert.ok(built.candidates[0].reason_codes.includes("PREREQUISITE_MET"));
  assert.equal(built.diagnostics.quota_policy, "informational_only");

  const unresolvedCodes = new Set(built.unresolved.map(course => course.course_code));
  assert.ok(unresolvedCodes.has("ACCT1005"));
  assert.ok(unresolvedCodes.has("ARTT1005"));
  assert.ok(unresolvedCodes.has("VACD7010"));
  assert.ok(!built.candidates.some(course => unresolvedCodes.has(course.course_code)));

  const excluded = built.excluded.find(course => course.course_code === "COMP4005");
  assert.ok(excluded);
  assert.ok(excluded.eligibility.reason_codes.includes("PREREQUISITE_NOT_MET"));
});

test("accepts partial scans without inventing profile or numeric facts", () => {
  const partial = {
    schema_version:1,
    source:{
      institution:"hkbu",
      mode:"user_portal_import",
      captured_at:"2026-07-28T08:15:00+08:00",
      term:"Semester 1 2026-27",
      parser_version:"1.2.0",
      pages:["student_enrolment"]
    },
    academic_profile:{},
    assigned_courses:[{
      course_code:"COMP1005",
      title:"Programming Fundamentals",
      meetings:[]
    }],
    completed_courses:[],
    remaining_requirements:[],
    catalogue_courses:[]
  };
  const result = api.validateSnapshot(partial);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.academic_profile, {
    programme:null,
    major:null,
    catalogue_year:null,
    degree_level:null,
    study_year:null
  });
  assert.equal(result.value.assigned_courses[0].units, null);

  const built = api.buildPlannerCandidates(result);
  assert.equal(built.assigned.length, 0);
  assert.equal(built.unresolved[0].eligibility.reason_codes[0], "UNITS_UNRESOLVED");
});

test("rejects Sunday and preserves exact persisted snapshot keys", () => {
  const sunday = clone(fixture);
  sunday.assigned_courses[0].meetings[0].days = ["Sun"];
  assert.equal(api.validateSnapshot(sunday).ok, false);

  const result = api.validateSnapshot(fixture);
  assert.deepEqual(Object.keys(result.value.catalogue_courses[0]), [
    "course_code",
    "title",
    "units",
    "teaching_medium",
    "prerequisite_text",
    "corequisite_text",
    "target_students",
    "sections"
  ]);
  assert.deepEqual(Object.keys(result.value.catalogue_courses[0].sections[0]), [
    "section",
    "meetings"
  ]);
  assert.deepEqual(Object.keys(result.value.catalogue_courses[0].sections[0].meetings[0]), [
    "days",
    "start",
    "end",
    "venue"
  ]);
});

test("recommendations are deterministic and expose transparent reason codes", () => {
  const result = api.recommendCourses(fixture, externalCatalogue(), {limit:10});
  assert.deepEqual(result.recommendations.map(course => course.course_code), ["COMP3005"]);
  assert.ok(
    result.recommendations[0].recommendation_reason_codes.includes(
      "REMAINING_REQUIREMENT_COURSE_MATCH"
    )
  );
  assert.equal(result.disclaimer_code, "VERIFY_IN_BUNIPORT");
  assert.ok(result.needs_review.every(course => course.eligibility.state === "unresolved"));
  assert.ok(!result.recommendations.some(course => course.course_code === "ACCT1005"));
});

test("deidentified contributions contain only bounded public course facts", () => {
  const result = api.buildDeidentifiedContribution(fixture);
  assert.equal(result.schema_version, 1);
  assert.equal(result.kind, "hkbu_course_catalogue_contribution");
  assert.deepEqual(result.source, {
    institution:"hkbu",
    term:"Semester 1 2026-27",
    captured_on:"2026-07-28",
    parser_version:"1.2.0"
  });
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0].course_code, "MATH2005");
  assert.equal(result.courses[0].prerequisite_text, "COMP2005");
  assert.equal(result.courses[0].teaching_medium, "English");
  assert.equal(result.courses[0].sections[0].meetings[0].venue, "AAB502");
  assert.equal(Object.hasOwn(result, "academic_profile"), false);
  assert.equal(Object.hasOwn(result, "completed_courses"), false);
  assert.equal(Object.hasOwn(result, "remaining_requirements"), false);
  assert.equal(Object.hasOwn(result.source, "captured_at"), false);
  assert.equal(Object.hasOwn(result.courses[0], "registration_status"), false);
  assert.equal(Object.hasOwn(result.courses[0], "available_quota"), false);
  assert.equal(
    Object.hasOwn(result.courses[0].sections[0].meetings[0], "instructor"),
    false
  );

  const noVenue = clone(fixture);
  noVenue.catalogue_courses = [];
  noVenue.assigned_courses[0].meetings[0].venue = null;
  const fallback = api.buildDeidentifiedContribution(noVenue);
  assert.equal(fallback.courses[0].sections[0].meetings[0].venue, "");
});

test("snapshot catalogue input is capped at 2,000 courses", () => {
  const manyCourses = clone(fixture);
  manyCourses.catalogue_courses = Array.from({length:2001}, (_, index) => ({
    course_code:`CS${String(index).padStart(4, "0")}`,
    title:`Course ${index}`,
    units:3,
    sections:[]
  }));
  const result = api.validateSnapshot(manyCourses);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "LIMIT_EXCEEDED");
});
