import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalogueApi = require("../course-catalog.js");
const parserSource = readFileSync(
  new URL("../extensions/hkbu-portal-connector/parser.js", import.meta.url),
  "utf8"
);
const parserContext = vm.createContext({URL, console});
vm.runInContext(parserSource, parserContext, {filename:"parser.js"});
const parser = parserContext.HKBUPortalParser;
const clone = value => JSON.parse(JSON.stringify(value));
const baseMetadata = {
  origin:"https://buniport.hkbu.edu.hk",
  capturedAt:"2026-07-28T10:00:00.000Z"
};

const referenceCatalogue = () => ({
  schema_version:1,
  institution:"hkbu",
  term:"Semester 1 2026-27",
  captured_at:"2026-07-28",
  source_mode:"authenticated_developer_snapshot",
  publication_status:"reference_only",
  caveats:[
    "This is a point-in-time reference snapshot, not an official live feed.",
    "Confirm registration in BUniPort."
  ],
  courses:[{
    course_code:"COMP3005",
    title:"Algorithms",
    units:3,
    level:"Undergraduate",
    academic_group:"Department of Computer Science",
    prerequisite_text:null,
    corequisite_text:null,
    target_students:"All students",
    sections:[{
      section:"01",
      day_time:"Wed 12:30-15:20 AAB502",
      available_quota:"unknown",
      quota_scope:"unknown"
    }],
    prerequisite_rules:[],
    corequisite_rules:[]
  }, {
    course_code:"COMP3999",
    title:"Open Computing Topics",
    units:3,
    level:"Undergraduate",
    academic_group:"Department of Computer Science",
    prerequisite_text:null,
    corequisite_text:null,
    target_students:"All students",
    sections:[{
      section:"01",
      day_time:"Tue 09:30-12:20 AAB503",
      available_quota:"unknown",
      quota_scope:"unknown"
    }],
    prerequisite_rules:[],
    corequisite_rules:[]
  }]
});

test("the shared reference catalogue validates and can be searched without a personal snapshot", () => {
  const result = catalogueApi.validateCatalogue(referenceCatalogue());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.value.publication_status, "reference_only");
  assert.equal(result.value.term, "Semester 1 2026-27");
  assert.equal(result.value.courses.length, 2);

  const query = "open computing";
  const matches = result.value.courses.filter(course => [
    course.course_code,
    course.title,
    course.academic_group
  ].some(value => String(value || "").toLowerCase().includes(query)));
  assert.deepEqual(matches.map(course => course.course_code), ["COMP3999"]);
  assert.equal(Object.hasOwn(result.value, "academic_profile"), false);
  assert.equal(Object.hasOwn(result.value, "assigned_courses"), false);
});

test("an optional personal scan adds assigned and requirement-only guidance without mutating the catalogue", () => {
  const timetable = parser.parseSerializedTables([{
    headers:["Course Code", "Course Title", "Units", "Section", "Day/Time"],
    rows:[["COMP1005", "Programming Fundamentals", "3", "01", "Mon 09:30-11:20"]]
  }], {...baseMetadata, term:"Semester 1 2026-27"});
  const profile = parser.parseSerializedTables([{
    headers:["Programme", "Major", "Study Year", "Curriculum Year", "Degree Level"],
    rows:[["BSc Computer Science", "Computer Science", "Year 3", "2024-25", "Undergraduate"]]
  }], baseMetadata);
  const requirements = parser.parseSerializedTables([{
    headers:["Requirement Category", "Requirement", "Required Units", "Completed Units", "Status"],
    rows:[["Major elective", "Complete COMP3005", "6", "3", "In progress"]]
  }], baseMetadata);

  for(const result of [timetable, profile, requirements]) assert.equal(result.ok, true);
  const merged = parser.mergeSnapshots(
    parser.mergeSnapshots(timetable.payload, profile.payload),
    requirements.payload
  );
  const validation = catalogueApi.validateSnapshot(clone(merged));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.deepEqual(validation.value.source.pages, [
    "personal_timetable",
    "academic_profile",
    "degree_progress"
  ]);
  assert.equal(validation.value.academic_profile.degree_level, "bachelor");

  const catalogue = referenceCatalogue();
  const catalogueBeforeImport = clone(catalogue);
  const built = catalogueApi.buildPlannerCandidates(validation.value, catalogue);
  assert.equal(built.assigned.length, 1);
  assert.equal(built.assigned[0].required, true);
  assert.equal(built.candidates.length, 2);
  assert.equal(built.candidates[0].course_code, "COMP3005");

  const recommendation = catalogueApi.recommendCourses(built, {limit:10});
  assert.equal(recommendation.recommendations[0].course_code, "COMP3005");
  assert.ok(
    recommendation.recommendations[0].recommendation_reason_codes.includes(
      "REMAINING_REQUIREMENT_COURSE_MATCH"
    )
  );
  const openElective = recommendation.recommendations.find(
    course => course.course_code === "COMP3999"
  );
  assert.ok(openElective);
  assert.deepEqual(
    openElective.recommendation_reason_codes,
    ["OPEN_ELECTIVE_ELIGIBLE"]
  );

  const requirementReasonCodes = new Set([
    "REMAINING_REQUIREMENT_COURSE_MATCH",
    "REMAINING_REQUIREMENT_TEXT_MATCH",
    "REMAINING_REQUIREMENT_CATEGORY_MATCH"
  ]);
  const personalized = recommendation.recommendations.filter(course =>
    course.recommendation_reason_codes.some(reason => requirementReasonCodes.has(reason))
  );
  assert.deepEqual(personalized.map(course => course.course_code), ["COMP3005"]);
  assert.equal(recommendation.disclaimer_code, "VERIFY_IN_BUNIPORT");
  assert.deepEqual(catalogue, catalogueBeforeImport);

  const mismatchedSnapshot = clone(validation.value);
  mismatchedSnapshot.source.term = "Semester 2 2026-27";
  const mismatchedValidation = catalogueApi.validateSnapshot(mismatchedSnapshot);
  assert.equal(mismatchedValidation.ok, true);
  const assignedOnly = catalogueApi.buildPlannerCandidates(
    mismatchedValidation.value,
    {schema_version:1, institution:"hkbu", courses:[]}
  );
  assert.equal(assignedOnly.assigned.length, 1);
  assert.deepEqual(catalogue, catalogueBeforeImport);
});
