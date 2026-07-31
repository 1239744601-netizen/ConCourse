import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const extensionRoot = new URL("../extensions/hkbu-portal-connector/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", extensionRoot), "utf8"));
const parserSource = readFileSync(new URL("parser.js", extensionRoot), "utf8");
const popupSource = readFileSync(new URL("popup.js", extensionRoot), "utf8");
const popupHtml = readFileSync(new URL("popup.html", extensionRoot), "utf8");
const readme = readFileSync(new URL("README.md", extensionRoot), "utf8");

const parserContext = vm.createContext({
  URL,
  console
});
vm.runInContext(parserSource, parserContext, {filename:"parser.js"});
const parser = parserContext.HKBUPortalParser;
const clone = (value) => JSON.parse(JSON.stringify(value));
const metadata = {
  origin:"https://buniport.hkbu.edu.hk",
  capturedAt:"2026-07-28T10:00:00.000Z"
};

const TOP_LEVEL_KEYS = [
  "academic_profile",
  "assigned_courses",
  "completed_courses",
  "remaining_requirements",
  "schema_version",
  "source"
];
const SOURCE_KEYS = [
  "captured_at",
  "institution",
  "mode",
  "pages",
  "parser_version",
  "term"
];

test("manifest is MV3 with activeTab-only host access", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ["activeTab", "scripting", "storage"]
  );
  assert.equal(manifest.host_permissions, undefined);
  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /cookies|webRequest|<all_urls>/iu);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.content_scripts, undefined);
});

test("course tables produce only the canonical payload and omit sensitive columns", () => {
  const result = parser.parseSerializedTables([
    {
      headers:[
        "Course Code",
        "Course Title",
        "Section",
        "Day",
        "Time",
        "Room",
        "Instructor Name",
        "Student Number",
        "Email"
      ],
      rows:[
        [
          "COMP1005",
          "Programming Fundamentals",
          "01",
          "Mon",
          "09:30 - 10:20",
          "WLB 101",
          "Dr Private Person",
          "12345678",
          "private@life.hkbu.edu.hk"
        ]
      ]
    }
  ], metadata);

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(clone(result.payload)).sort(), TOP_LEVEL_KEYS);
  assert.deepEqual(Object.keys(clone(result.payload.source)).sort(), SOURCE_KEYS);
  assert.equal(result.payload.schema_version, 1);
  assert.equal(result.payload.source.institution, "hkbu");
  assert.equal(result.payload.source.mode, "user_portal_import");
  assert.equal(result.payload.source.captured_at, metadata.capturedAt);
  assert.equal(result.payload.source.term, "unknown");
  assert.match(result.payload.source.parser_version, /^hkbu-browser-helper\//u);
  assert.deepEqual(clone(result.payload.source.pages), ["personal_timetable"]);
  assert.deepEqual(clone(result.payload.academic_profile), {});
  assert.deepEqual(clone(result.payload.assigned_courses), [
    {
      course_code:"COMP1005",
      title:"Programming Fundamentals",
      section:"01",
      meetings:[{
        days:[1],
        start:"09:30",
        end:"10:20",
        venue:"WLB 101"
      }]
    }
  ]);
  assert.deepEqual(clone(result.payload.completed_courses), []);
  assert.deepEqual(clone(result.payload.remaining_requirements), []);
  assert.equal(result.payload.catalogue_courses, undefined);
  const serialized = JSON.stringify(result.payload);
  assert.doesNotMatch(serialized, /Private Person|12345678|private@|"grade"|origin|page_kind|fragments|counts|privacy/iu);
});

test("HKBU combined Day/Time aliases become multiple meetings and dotted codes remain valid", () => {
  for (const header of ["Day/Time", "Class Day/Time", "Meeting Day/Time"]) {
    const result = parser.parseSerializedTables([
      {
        headers:[
          "Course Code",
          "Course Title",
          "Units",
          "Section",
          header,
          "Venue",
          "Prerequisite"
        ],
        rows:[[
          "A.F.7430",
          "Advanced Film",
          "3",
          "01",
          "Tue 09:30-11:20 ; Fri 12:30-13:20",
          "CVA 102",
          "A.F.2430"
        ]]
      }
    ], metadata);

    assert.equal(result.ok, true, header);
    assert.deepEqual(clone(result.payload.catalogue_courses), [
      {
        course_code:"A.F.7430",
        title:"Advanced Film",
        units:3,
        prerequisite_text:"A.F.2430",
        sections:[{
          section:"01",
          meetings:[
            {days:[2], start:"09:30", end:"11:20", venue:"CVA 102"},
            {days:[5], start:"12:30", end:"13:20", venue:"CVA 102"}
          ]
        }]
      }
    ]);
  }
});

test("result tables retain completion facts but discard every grade value", () => {
  const result = parser.parseSerializedTables([
    {
      headers:["Term", "Course Code", "Course Title", "Units", "Grade"],
      rows:[["Semester 1 2025-26", "MATH1006", "University Mathematics", "3", "A-"]]
    }
  ], metadata);

  assert.equal(result.ok, true);
  assert.deepEqual(clone(result.payload.assigned_courses), []);
  assert.deepEqual(clone(result.payload.completed_courses), [
    {
      course_code:"MATH1006",
      units:3,
      result_scope:"completion_only"
    }
  ]);
  assert.equal(result.payload.source.term, "Semester 1 2025-26");
  const serialized = JSON.stringify(result.payload);
  assert.doesNotMatch(serialized, /University Mathematics|"A-"|"grade"\s*:/iu);
});

test("email- or student-number-like values are dropped even inside allowed columns", () => {
  const result = parser.parseSerializedTables([
    {
      headers:["Course Code", "Course Title", "Section"],
      rows:[
        ["COMP1005", "Contact private@life.hkbu.edu.hk", "01"],
        ["MATH1006", "Reference 12345678", "02"]
      ]
    }
  ], metadata);

  assert.equal(result.ok, true);
  assert.deepEqual(clone(result.payload.assigned_courses), [
    {course_code:"COMP1005", title:"COMP1005", meetings:[], section:"01"},
    {course_code:"MATH1006", title:"MATH1006", meetings:[], section:"02"}
  ]);
  assert.doesNotMatch(JSON.stringify(result.payload), /private@|12345678/iu);
});

test("graduation requirements use stable IDs, remaining units, and safe course codes", () => {
  const result = parser.parseSerializedTables([
    {
      headers:["Requirement Category", "Requirement", "Required Units", "Completed Units", "Status", "GPA"],
      rows:[[
        "University Core",
        "Complete A.F.7430 or COMP 2005 within the University Core",
        "13",
        "10",
        "In progress",
        "3.75"
      ]]
    }
  ], metadata);

  assert.equal(result.ok, true);
  assert.deepEqual(clone(result.payload.source.pages), ["degree_progress"]);
  const [requirement] = clone(result.payload.remaining_requirements);
  assert.match(requirement.requirement_id, /^portal_[0-9a-f]{8}$/u);
  assert.deepEqual(requirement, {
    requirement_id:requirement.requirement_id,
    portal_text:"Complete A.F.7430 or COMP 2005 within the University Core",
    group:"University Core",
    units_required:13,
    units_remaining:3,
    allowed_course_codes:["A.F.7430", "COMP2005"]
  });
  assert.doesNotMatch(JSON.stringify(result.payload), /3\.75|gpa|"status"/iu);
});

test("profile tables retain only allowlisted academic context", () => {
  const result = parser.parseSerializedTables([
    {
      headers:[
        "Programme",
        "Major",
        "Study Year",
        "Curriculum Year",
        "Degree Level",
        "Student Name",
        "Student Number"
      ],
      rows:[[
        "BSc",
        "Computer Science",
        "Year 2",
        "2025-26",
        "Undergraduate",
        "Private Person",
        "12345678"
      ]]
    }
  ], metadata);

  assert.equal(result.ok, true);
  assert.deepEqual(clone(result.payload.source.pages), ["academic_profile"]);
  assert.deepEqual(clone(result.payload.academic_profile), {
    programme:"BSc",
    major:"Computer Science",
    study_year:2,
    catalogue_year:"2025-26",
    degree_level:"Undergraduate"
  });
  assert.doesNotMatch(JSON.stringify(result.payload), /Private Person|12345678/iu);
});

test("scanDocument extracts only one bounded visible semester token", () => {
  const visibleNode = (text = "") => ({
    innerText:text,
    hidden:false,
    getAttribute:() => null,
    closest:() => null,
    getClientRects:() => [{}]
  });
  const headerRow = {
    ...visibleNode(),
    cells:[
      visibleNode("Course Code"),
      visibleNode("Course Title"),
      visibleNode("Section"),
      visibleNode("Day/Time")
    ]
  };
  const dataRow = {
    ...visibleNode(),
    cells:[
      visibleNode("COMP1005"),
      visibleNode("Programming Fundamentals"),
      visibleNode("01"),
      visibleNode("Tue 09:30-11:20")
    ]
  };
  const table = {
    ...visibleNode(),
    rows:[headerRow, dataRow],
    parentElement:{closest:() => null}
  };
  const selectedOption = {...visibleNode("Current choice — Semester 1 2026/27"), selected:true};
  const select = {...visibleNode(), selectedOptions:[selectedOption]};
  const documentObject = {
    location:{origin:metadata.origin},
    defaultView:{getComputedStyle:() => ({display:"table", visibility:"visible", opacity:"1"})},
    querySelectorAll:(selector) => {
      if (selector === "table") return [table];
      if (selector === "select") return [select];
      return [];
    }
  };

  const resolved = parser.scanDocument(documentObject, {capturedAt:metadata.capturedAt});
  assert.equal(resolved.ok, true);
  assert.equal(resolved.payload.source.term, "Semester 1 2026-27");
  assert.deepEqual(clone(resolved.payload.source.pages), ["personal_timetable"]);

  const conflictingHeading = visibleNode("Semester 2 2026-27");
  const ambiguousDocument = {
    ...documentObject,
    querySelectorAll:(selector) => {
      if (selector === "table") return [table];
      if (selector === "select") return [select];
      if (selector === "caption,h1,h2,h3,h4,[role='heading']") return [conflictingHeading];
      return [];
    }
  };
  const ambiguous = parser.scanDocument(ambiguousDocument, {capturedAt:metadata.capturedAt});
  assert.equal(ambiguous.payload.source.term, "unknown");
});

test("repeated deliberate scans merge and dedupe canonical arrays and page kinds", () => {
  const courses = parser.parseSerializedTables([
    {
      headers:["Course Code", "Course Title", "Section", "Day", "Time"],
      rows:[["COMP1005", "Programming Fundamentals", "01", "Mon", "09:30-10:20"]]
    }
  ], metadata).payload;
  const requirements = parser.parseSerializedTables([
    {
      headers:["Requirement", "Required Units", "Completed Units", "Status"],
      rows:[["University Core", "13", "10", "In progress"]]
    }
  ], {...metadata, capturedAt:"2026-07-28T10:05:00.000Z"}).payload;

  const once = parser.mergeSnapshots(courses, requirements);
  const twice = parser.mergeSnapshots(once, courses);
  assert.deepEqual(Object.keys(clone(twice)).sort(), TOP_LEVEL_KEYS);
  assert.equal(twice.assigned_courses.length, 1);
  assert.equal(twice.remaining_requirements.length, 1);
  assert.deepEqual(
    clone(twice.source.pages),
    ["personal_timetable", "degree_progress"]
  );
  assert.doesNotMatch(JSON.stringify(twice.source.pages), /path|query|html|title|origin/iu);
  assert.equal(twice.source.captured_at, "2026-07-28T10:05:00.000Z");
});

test("unknown or identity-only structures fail closed", () => {
  const unknown = parser.parseSerializedTables([
    {headers:["Label", "Value"], rows:[["Welcome", "Portal"]]}
  ], metadata);
  const identityOnly = parser.parseSerializedTables([
    {headers:["Student Name", "Student Number", "Email"], rows:[["Private", "12345678", "p@example.edu"]]}
  ], metadata);

  assert.deepEqual(clone(unknown), {ok:false, code:"unsupported_structure"});
  assert.deepEqual(clone(identityOnly), {ok:false, code:"unsupported_structure"});
});

test("course-code allowlist rejects malformed or overlong dotted prefixes", () => {
  const result = parser.parseSerializedTables([
    {
      headers:["Course Code", "Course Title", "Section"],
      rows:[
        ["A.F.7430", "Valid dotted code", "01"],
        ["A..F.7430", "Consecutive dots", "02"],
        ["A.B.C.D.E.F.G.H.I.7430", "Nine prefix letters", "03"],
        ["A.74", "Too few digits", "04"]
      ]
    }
  ], metadata);

  assert.equal(result.ok, true);
  assert.deepEqual(
    clone(result.payload.assigned_courses).map((course) => course.course_code),
    ["A.F.7430"]
  );
});

test("origin validation accepts only exact HTTPS HKBU portal hosts", () => {
  assert.equal(parser.supportedOrigin("https://buniport.hkbu.edu.hk"), true);
  assert.equal(parser.supportedOrigin("https://buniport03.hkbu.edu.hk"), true);
  assert.equal(parser.supportedOrigin("https://iss.hkbu.edu.hk"), true);
  assert.equal(parser.supportedOrigin("http://buniport.hkbu.edu.hk"), false);
  assert.equal(parser.supportedOrigin("https://evil.buniport.hkbu.edu.hk"), false);
  assert.equal(parser.supportedOrigin("https://buniport.hkbu.edu.hk.evil.example"), false);
  assert.equal(parser.supportedOrigin("https://buniport.hkbu.edu.hk/path"), false);
});

test("popup uses session-only storage and user-triggered scripting delivery", () => {
  assert.match(popupSource, /chrome\.storage\.session\.set/u);
  assert.match(popupSource, /chrome\.storage\.session\.remove/u);
  assert.match(popupSource, /mergeSnapshots\(storedPayload, result\.payload\)/u);
  assert.match(popupSource, /chrome\.scripting\.executeScript/u);
  assert.match(popupSource, /concourse:hkbu-portal-snapshot/u);
  assert.match(popupSource, /https:\/\/concoursehk\.com/u);
  assert.doesNotMatch(popupSource, /pages\.dev|github\.io/u);
  assert.match(popupSource, /CONCOURSE_ORIGINS\.has\(probe\.origin\)/u);
  assert.match(popupSource, /new CustomEvent\(eventName/u);
  assert.match(popupSource, /world:"MAIN"/u);
  assert.match(popupSource, /addEventListener\("click", scanPage\)/u);
  assert.match(popupSource, /addEventListener\("click", sendToConcourse\)/u);
  assert.match(popupSource, /!hasResolvedTerm\(storedPayload\)/u);
  assert.match(popupSource, /needs one unambiguous semester term/u);
  assert.doesNotMatch(popupSource, /localStorage|storage\.local|storage\.sync|document\.cookie|webRequest/iu);
});

test("popup and documentation state the trust and privacy limits", () => {
  assert.match(popupHtml, /Nothing runs until you click/u);
  assert.match(popupHtml, /never reads passwords, cookies, login form values/iu);
  assert.match(popupHtml, /user-provided and unverified/iu);
  assert.match(readme, /does not prove current enrolment/iu);
  assert.match(readme, /fails closed/iu);
  assert.match(readme, /chrome\.storage\.session/u);
  assert.match(readme, /safe page-kind strings only/iu);
});
