import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const [, , inputPath, outputPath, manifestPath] = process.argv;

if(!inputPath || !outputPath){
  console.error("Usage: node scripts/build-hkbu-catalog.mjs <source.json> <output.json> [current-manifest.json]");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if(!source || !Array.isArray(source.courses) || !source.metadata){
  throw new Error("Expected an HKBU course export with metadata and courses");
}

const clean = (value, max=1000) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const finiteNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const courses = source.courses.map(course => ({
  course_code: clean(course.code, 32).toUpperCase(),
  title: clean(course.title, 240),
  chinese_title: clean(course.chineseTitle, 240) || null,
  units: finiteNumber(course.units),
  level: clean(course.level, 40) || null,
  academic_group: clean(course.academicGroup, 160) || null,
  unit_code: clean(course.unitCode, 32) || null,
  teaching_medium: clean(course.mediums || course.handbook?.mediumOfInstruction, 160) || null,
  prerequisite_text: clean(course.prerequisite || course.handbook?.prerequisite, 1000) || null,
  corequisite_text: clean(course.corequisite || course.handbook?.corequisite, 1000) || null,
  target_students: clean(course.targetStudents, 1200) || null,
  description: clean(course.handbook?.description, 4000) || null,
  outline_url: clean(course.outlineUrl, 500) || null,
  sections: (Array.isArray(course.sections) ? course.sections : []).slice(0, 80).map(section => ({
    section: clean(section.section, 32),
    day_time: clean(section.dayTime, 240) || null,
    instructor: clean(section.instructor, 240) || null,
    teaching_medium: clean(section.medium, 120) || null,
    available_quota: clean(section.availableQuota, 40) || null,
    quota_scope: "unknown",
    remarks: clean([section.others, section.remarks].filter(Boolean).join(" "), 800) || null
  })),
  prerequisite_rules: (Array.isArray(course.prerequisites) ? course.prerequisites : []).slice(0, 40).map(rule => ({
    condition: clean(rule["Condition Description"], 800) || null,
    study_programme: clean(rule["Study Programme"], 240) || null,
    study_year: clean(rule["Study Year"], 80) || null,
    basis_of_admission: clean(rule["Basis of Admission"], 240) || null
  })),
  corequisite_rules: (Array.isArray(course.corequisites) ? course.corequisites : []).slice(0, 40).map(rule => ({
    condition: clean(rule["Condition Description"], 800) || null,
    study_programme: clean(rule["Study Programme"], 240) || null,
    study_year: clean(rule["Study Year"], 80) || null,
    basis_of_admission: clean(rule["Basis of Admission"], 240) || null
  }))
})).filter(course => course.course_code && course.title);

const output = {
  schema_version: 1,
  institution: "hkbu",
  term: clean(source.metadata.term, 120),
  captured_at: clean(source.metadata.capturedAt, 80),
  generated_at: new Date().toISOString(),
  source_mode: "authenticated_developer_snapshot",
  publication_status: "reference_only",
  caveats: [
    "This is a point-in-time reference snapshot, not an official live feed.",
    "Available quota may be personalized or reserved and must not be treated as universal.",
    "Students must confirm eligibility, availability, and registration in BUniPort."
  ],
  counts: {
    courses: courses.length,
    sections: courses.reduce((total, course) => total + course.sections.length, 0)
  },
  courses
};

fs.mkdirSync(path.dirname(outputPath), {recursive:true});
const serializedOutput = `${JSON.stringify(output)}\n`;
fs.writeFileSync(outputPath, serializedOutput, "utf8");
console.log(`Wrote ${output.counts.courses} courses and ${output.counts.sections} sections to ${outputPath}`);

if(manifestPath){
  const relativeCatalogueUrl = path.relative(
    path.dirname(path.resolve(manifestPath)),
    path.resolve(outputPath)
  ).split(path.sep).join("/");
  const manifest = {
    schema_version:1,
    institution:"hkbu",
    term:output.term,
    catalogue_url:relativeCatalogueUrl,
    captured_at:output.captured_at,
    publication_status:output.publication_status,
    course_count:output.counts.courses,
    section_count:output.counts.sections,
    content_sha256:createHash("sha256").update(serializedOutput).digest("hex")
  };
  fs.mkdirSync(path.dirname(manifestPath), {recursive:true});
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Updated current-catalogue manifest at ${manifestPath}`);
}
