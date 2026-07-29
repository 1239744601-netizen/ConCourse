(function attachCourseCatalog(root, factory){
  "use strict";
  const api = factory();
  if(typeof module === "object" && module && module.exports) module.exports = api;
  if(root && typeof root === "object") root.ConCourseCourseCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCourseCatalog(){
  "use strict";

  const SCHEMA_VERSION = 1;
  const INSTITUTION = "hkbu";
  const SOURCE_MODE = "user_portal_import";
  const CONTRIBUTION_KIND = "hkbu_course_catalogue_contribution";
  const MAX_PLANNER_OPTIONS = 24;
  const MAX_PLANNER_MEETINGS = 6;

  const LIMITS = Object.freeze({
    depth:12,
    nodes:150000,
    objectKeys:80,
    string:12000,
    pages:20,
    assignedCourses:200,
    completedCourses:1000,
    remainingRequirements:500,
    catalogueCourses:2000,
    sectionsPerCourse:100,
    meetingsPerSection:30,
    rulesPerCourse:50
  });

  const SAFE_PAGE_KINDS = new Set([
    "academic_profile",
    "student_enrolment",
    "personal_timetable",
    "degree_progress",
    "course_information"
  ]);
  const DAY_TOKEN_PATTERN = "(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?|星期[一二三四五六日天]|週[一二三四五六日天]|周[一二三四五六日天])";
  const TIME_TOKEN_PATTERN = "(?:\\d{1,2}(?::|\\.)\\d{2}|\\d{3,4})(?:\\s*[AaPp]\\.?[Mm]\\.?)?";
  const COURSE_CODE_IN_TEXT = /\b([A-Z][A-Z.]{1,18})\s*-?\s*(\d{3,5}[A-Z]?)\b/gu;

  const FORBIDDEN_KEYS = new Set([
    "__proto__", "prototype", "constructor"
  ]);
  const PII_KEYS = new Set([
    "studentid", "studentnumber", "studentno", "studentname",
    "userid", "username", "useridnumber", "ssoid", "loginid",
    "email", "emailaddress", "personalemail",
    "phone", "phonenumber", "mobile", "mobilenumber", "telephone",
    "hkid", "hkidnumber", "passport", "passportnumber", "identitynumber",
    "dateofbirth", "dob", "birthday",
    "fullname", "legalname", "firstname", "lastname", "givenname", "surname",
    "homeaddress", "postaladdress", "mailingaddress",
    "ipaddress", "photo", "avatar",
    "emergencycontact", "emergencycontactname", "emergencycontactnumber",
    "cookie", "cookies", "sessiontoken", "accesstoken", "refreshtoken", "password",
    "grade", "grades", "mark", "marks", "gpa", "cgpa"
  ]);

  const SNAPSHOT_KEYS = new Set([
    "schema_version", "source", "academic_profile", "assigned_courses",
    "completed_courses", "remaining_requirements", "catalogue_courses"
  ]);
  const SOURCE_KEYS = new Set([
    "institution", "mode", "captured_at", "term", "parser_version", "pages"
  ]);
  const PROFILE_KEYS = new Set([
    "programme", "major", "catalogue_year", "degree_level", "study_year"
  ]);
  const ASSIGNED_KEYS = new Set([
    "course_code", "title", "units", "section", "status", "meetings"
  ]);
  const MEETING_KEYS = new Set([
    "days", "start", "end", "venue"
  ]);
  const COMPLETED_KEYS = new Set([
    "course_code", "units", "result_scope"
  ]);
  const REQUIREMENT_KEYS = new Set([
    "requirement_id", "group", "units_required", "units_remaining",
    "allowed_course_codes", "portal_text"
  ]);
  const CATALOGUE_WRAPPER_KEYS = new Set([
    "schema_version", "institution", "term", "captured_at", "generated_at",
    "source_mode", "publication_status", "caveats", "counts", "courses",
    "catalogue_courses"
  ]);
  const COURSE_KEYS = new Set([
    "course_code", "code", "title", "name", "chinese_title", "units", "credits",
    "level", "academic_group", "unit_code", "teaching_medium",
    "prerequisite_text", "prerequisite", "corequisite_text", "corequisite",
    "target_students", "targetStudents", "description", "outline_url", "sections",
    "section", "status", "meetings", "day_time", "instructor", "remarks",
    "available_quota", "quota_scope", "prerequisite_rules", "corequisite_rules"
  ]);
  const SNAPSHOT_COURSE_KEYS = new Set([
    "course_code", "title", "units", "teaching_medium", "prerequisite_text",
    "corequisite_text", "target_students", "sections"
  ]);
  const SECTION_KEYS = new Set([
    "section", "day_time", "dayTime", "instructor", "teaching_medium",
    "available_quota", "quota", "quota_scope", "remarks", "status", "meetings",
    "unresolved_meetings"
  ]);
  const SNAPSHOT_SECTION_KEYS = new Set(["section", "meetings"]);
  const RULE_KEYS = new Set([
    "condition", "study_programme", "study_year", "basis_of_admission"
  ]);

  class CourseCatalogValidationError extends Error {
    constructor(code, path, message){
      super(`${message} (${path})`);
      this.name = "CourseCatalogValidationError";
      this.code = code;
      this.path = path;
    }
  }

  function fail(code, path, message){
    throw new CourseCatalogValidationError(code, path, message);
  }

  function isPlainObject(value){
    if(!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function normalizedKey(value){
    return String(value || "").replace(/[^a-z0-9]/giu, "").toLowerCase();
  }

  function structuralScan(value, label){
    const seen = new WeakSet();
    let nodes = 0;

    function visit(current, path, depth){
      nodes += 1;
      if(nodes > LIMITS.nodes) fail("LIMIT_EXCEEDED", path, "Input contains too many values");
      if(depth > LIMITS.depth) fail("LIMIT_EXCEEDED", path, "Input nesting is too deep");
      if(current === null || typeof current === "boolean") return;
      if(typeof current === "number"){
        if(!Number.isFinite(current)) fail("INVALID_NUMBER", path, "Numbers must be finite");
        return;
      }
      if(typeof current === "string"){
        if(current.length > LIMITS.string) fail("LIMIT_EXCEEDED", path, "String is too long");
        if(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(current)){
          fail("PII_VALUE_REJECTED", path, "Email-like values are not accepted");
        }
        if(/(?:^|[^\d])\d{8,10}(?:[^\d]|$)/u.test(current)){
          fail("PII_VALUE_REJECTED", path, "Student-number-like values are not accepted");
        }
        return;
      }
      if(typeof current !== "object") fail("INVALID_TYPE", path, "Only JSON values are accepted");
      if(seen.has(current)) fail("CYCLE_REJECTED", path, "Cyclic input is not accepted");
      seen.add(current);
      if(Array.isArray(current)){
        if(current.length > LIMITS.catalogueCourses + LIMITS.completedCourses){
          fail("LIMIT_EXCEEDED", path, "Array is too long");
        }
        current.forEach((entry, index) => visit(entry, `${path}[${index}]`, depth + 1));
        return;
      }
      if(!isPlainObject(current)) fail("INVALID_TYPE", path, "Objects must be plain JSON objects");
      const keys = Object.keys(current);
      if(keys.length > LIMITS.objectKeys) fail("LIMIT_EXCEEDED", path, "Object has too many fields");
      for(const key of keys){
        if(FORBIDDEN_KEYS.has(key)) fail("UNSAFE_FIELD", `${path}.${key}`, "Unsafe field name");
        if(PII_KEYS.has(normalizedKey(key))){
          fail("PII_FIELD_REJECTED", `${path}.${key}`, "Personally identifying field is not accepted");
        }
        visit(current[key], `${path}.${key}`, depth + 1);
      }
    }

    visit(value, label || "$", 0);
  }

  function assertObject(value, path){
    if(!isPlainObject(value)) fail("INVALID_TYPE", path, "Expected an object");
    return value;
  }

  function assertArray(value, path, max, required){
    if(value == null && !required) return [];
    if(!Array.isArray(value)) fail("INVALID_TYPE", path, "Expected an array");
    if(value.length > max) fail("LIMIT_EXCEEDED", path, `At most ${max} entries are accepted`);
    return value;
  }

  function assertKeys(value, allowed, path){
    assertObject(value, path);
    for(const key of Object.keys(value)){
      if(!allowed.has(key)) fail("UNKNOWN_FIELD", `${path}.${key}`, "Unexpected field");
    }
  }

  function cleanString(value, path, options){
    const config = Object.assign({required:false, max:1000, lower:false}, options || {});
    if(value == null || value === ""){
      if(config.required) fail("REQUIRED_FIELD", path, "Required string is missing");
      return null;
    }
    if(typeof value !== "string"){
      fail("INVALID_TYPE", path, "Expected text");
    }
    let cleaned = String(value).replace(/\s+/gu, " ").trim();
    if(!cleaned && config.required) fail("REQUIRED_FIELD", path, "Required string is empty");
    if(cleaned.length > config.max) fail("LIMIT_EXCEEDED", path, `Text exceeds ${config.max} characters`);
    if(config.lower) cleaned = cleaned.toLowerCase();
    return cleaned || null;
  }

  function finiteNumber(value, path, options){
    const config = Object.assign({required:false, min:0, max:999}, options || {});
    if(value == null || value === ""){
      if(config.required) fail("REQUIRED_FIELD", path, "Required number is missing");
      return null;
    }
    const number = typeof value === "number" ? value : Number(String(value).trim());
    if(!Number.isFinite(number) || number < config.min || number > config.max){
      fail("INVALID_NUMBER", path, `Expected a number from ${config.min} to ${config.max}`);
    }
    return number;
  }

  function isoTimestamp(value, path){
    const cleaned = cleanString(value, path, {required:true, max:80});
    const parsed = Date.parse(cleaned);
    if(Number.isNaN(parsed)) fail("INVALID_DATE", path, "Expected an ISO-compatible date");
    return new Date(parsed).toISOString();
  }

  function normalizeCourseCode(value, path){
    const cleaned = cleanString(value, path, {required:true, max:32})
      .toUpperCase()
      .replace(/[\s.-]+/gu, "");
    if(!/^[A-Z]{2,10}\d{3,5}[A-Z]?$/u.test(cleaned)){
      fail("INVALID_COURSE_CODE", path, "Expected an HKBU-style course code");
    }
    return cleaned;
  }

  function normalizeDegreeLevel(value, path){
    const cleaned = cleanString(value, path, {required:true, max:80}).toLowerCase();
    if(/^(?:undergraduate|ug|bachelor|bachelors|bachelor's)$/u.test(cleaned)) return "bachelor";
    if(/^(?:postgraduate|pg|master|masters|master's|taught postgraduate)$/u.test(cleaned)) return "master";
    if(/^(?:doctoral|doctorate|phd|research postgraduate)$/u.test(cleaned)) return "phd";
    fail("INVALID_DEGREE_LEVEL", path, "Unsupported degree level");
  }

  function normalizeDayToken(value){
    const compact = String(value || "").trim().toLowerCase().replace(/\./gu, "");
    const latin = {
      m:1, mon:1, monday:1,
      t:2, tu:2, tue:2, tues:2, tuesday:2,
      w:3, wed:3, weds:3, wednesday:3,
      th:4, thu:4, thur:4, thurs:4, thursday:4,
      f:5, fri:5, friday:5,
      sa:6, sat:6, saturday:6,
      su:7, sun:7, sunday:7
    };
    if(latin[compact]) return latin[compact];
    const chinese = compact.match(/(?:星期|週|周)([一二三四五六日天])/u);
    if(chinese){
      return {"一":1, "二":2, "三":3, "四":4, "五":5, "六":6, "日":7, "天":7}[chinese[1]];
    }
    return null;
  }

  function parseHkbuDays(value){
    if(value == null || value === "") fail("INVALID_DAY", "$.days", "Meeting day is missing");
    const values = Array.isArray(value)
      ? value
      : typeof value === "number"
        ? [value]
        : String(value).trim().split(/\s*(?:\/|,|&|\+|\band\b|、)\s*/iu);
    if(!values.length) fail("INVALID_DAY", "$.days", "Meeting day is missing");
    const parsed = [];
    for(const token of values){
      if(typeof token === "number" || /^\d+$/u.test(String(token).trim())){
        const number = Number(token);
        if(Number.isInteger(number) && number >= 1 && number <= 6){
          parsed.push(number);
          continue;
        }
      }
      const day = normalizeDayToken(token);
      if(!day || day === 7){
        fail("INVALID_DAY", "$.days", `Unrecognised or unsupported meeting day: ${String(token)}`);
      }
      parsed.push(day);
    }
    return Array.from(new Set(parsed)).sort((a, b) => a - b);
  }

  function parseHkbuTime(value){
    if(typeof value === "number"){
      if(Number.isInteger(value) && value >= 0 && value < 24 * 60) return value;
      fail("INVALID_TIME", "$.time", "Minute value is outside one day");
    }
    const cleaned = cleanString(value, "$.time", {required:true, max:30})
      .replace(/[：]/gu, ":")
      .replace(/[．]/gu, ".")
      .replace(/\s+/gu, "");
    const match = cleaned.match(/^(\d{1,2})(?:(?::|\.)(\d{2})|(\d{2}))?([AaPp])?\.?[Mm]?\.?$/u);
    if(!match) fail("INVALID_TIME", "$.time", `Unrecognised time: ${cleaned}`);
    let hour = Number(match[1]);
    const minute = Number(match[2] || match[3] || "0");
    const meridiem = match[4] ? match[4].toLowerCase() : null;
    if(minute > 59) fail("INVALID_TIME", "$.time", "Minutes must be from 00 to 59");
    if(meridiem){
      if(hour < 1 || hour > 12) fail("INVALID_TIME", "$.time", "12-hour time has an invalid hour");
      if(meridiem === "a") hour = hour === 12 ? 0 : hour;
      if(meridiem === "p") hour = hour === 12 ? 12 : hour + 12;
    } else if(hour > 23){
      fail("INVALID_TIME", "$.time", "24-hour time has an invalid hour");
    }
    return hour * 60 + minute;
  }

  function formatHkbuTime(minutes){
    const value = parseHkbuTime(minutes);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function parseHkbuTimeRange(value, maybeEnd){
    let startValue = value;
    let endValue = maybeEnd;
    if(maybeEnd == null){
      const cleaned = cleanString(value, "$.time_range", {required:true, max:80});
      const match = cleaned.match(/^(.+?)\s*(?:-|–|—|−|\bto\b|至)\s*(.+)$/iu);
      if(!match) fail("INVALID_TIME_RANGE", "$.time_range", "Expected a start and end time");
      startValue = match[1];
      endValue = match[2];
    }
    const start = parseHkbuTime(startValue);
    const end = parseHkbuTime(endValue);
    if(end <= start) fail("INVALID_TIME_RANGE", "$.time_range", "Meeting end must be after its start");
    return {start, end};
  }

  function parseHkbuMeetingText(value){
    const cleaned = cleanString(value, "$.day_time", {required:true, max:1000});
    if(/\b(?:tba|tbc)\b|to be arranged|arranged by (?:dept|department|prog)/iu.test(cleaned)){
      return {
        meetings:[],
        unresolved_fragments:[{code:"MEETING_TBA", text:cleaned}]
      };
    }
    const matcher = new RegExp(
      `(${DAY_TOKEN_PATTERN}(?:\\s*(?:/|,|&|\\+|and|、)\\s*${DAY_TOKEN_PATTERN})*)\\s+(${TIME_TOKEN_PATTERN})\\s*(?:-|–|—|−|to|至)\\s*(${TIME_TOKEN_PATTERN})`,
      "giu"
    );
    const matches = Array.from(cleaned.matchAll(matcher));
    if(!matches.length){
      return {
        meetings:[],
        unresolved_fragments:[{code:"MEETING_TEXT_UNPARSED", text:cleaned}]
      };
    }
    const meetings = [];
    const unresolved = [];
    const prefix = cleaned.slice(0, matches[0].index).replace(/[\s;,/]+/gu, "");
    if(prefix) unresolved.push({code:"MEETING_TEXT_PREFIX_UNPARSED", text:prefix});
    matches.forEach((match, index) => {
      try {
        const days = parseHkbuDays(match[1]);
        const range = parseHkbuTimeRange(match[2], match[3]);
        const nextIndex = index + 1 < matches.length ? matches[index + 1].index : cleaned.length;
        const venue = cleaned.slice(match.index + match[0].length, nextIndex)
          .replace(/^[\s;,/]+|[\s;,/]+$/gu, "")
          .replace(/\s+/gu, " ")
          .trim();
        meetings.push({
          days,
          start:formatHkbuTime(range.start),
          end:formatHkbuTime(range.end),
          venue:venue || null
        });
      } catch(error){
        unresolved.push({
          code:error && error.code ? error.code : "MEETING_TEXT_UNPARSED",
          text:match[0]
        });
      }
    });
    return {meetings, unresolved_fragments:unresolved};
  }

  function normalizeMeeting(value, path){
    assertKeys(value, MEETING_KEYS, path);
    const days = parseHkbuDays(value.days);
    const range = parseHkbuTimeRange(value.start, value.end);
    return {
      days,
      start:formatHkbuTime(range.start),
      end:formatHkbuTime(range.end),
      venue:cleanString(value.venue, `${path}.venue`, {max:160})
    };
  }

  function normalizeAssignedCourse(value, path){
    assertKeys(value, ASSIGNED_KEYS, path);
    const meetings = assertArray(value.meetings, `${path}.meetings`, LIMITS.meetingsPerSection, false)
      .map((meeting, index) => normalizeMeeting(meeting, `${path}.meetings[${index}]`));
    return {
      course_code:normalizeCourseCode(value.course_code, `${path}.course_code`),
      title:cleanString(value.title, `${path}.title`, {required:true, max:240}),
      units:finiteNumber(value.units, `${path}.units`, {min:0, max:30}),
      section:cleanString(value.section, `${path}.section`, {max:40}),
      status:cleanString(value.status, `${path}.status`, {max:120}),
      meetings
    };
  }

  function normalizeCompletedCourse(value, path){
    assertKeys(value, COMPLETED_KEYS, path);
    return {
      course_code:normalizeCourseCode(value.course_code, `${path}.course_code`),
      units:finiteNumber(value.units, `${path}.units`, {min:0, max:30}),
      result_scope:(() => {
        const scope = cleanString(value.result_scope, `${path}.result_scope`, {required:true, max:40});
        if(scope !== "completion_only"){
          fail("INVALID_RESULT_SCOPE", `${path}.result_scope`, "Completed courses must use completion_only");
        }
        return scope;
      })()
    };
  }

  function stringArray(value, path, maxEntries, normalizer){
    const entries = assertArray(value, path, maxEntries, false);
    return Array.from(new Set(entries.map((entry, index) => normalizer
      ? normalizer(entry, `${path}[${index}]`)
      : cleanString(entry, `${path}[${index}]`, {required:true, max:240})
    )));
  }

  function normalizeRequirement(value, path){
    assertKeys(value, REQUIREMENT_KEYS, path);
    return {
      requirement_id:cleanString(value.requirement_id, `${path}.requirement_id`, {required:true, max:120}),
      group:cleanString(value.group, `${path}.group`, {required:true, max:240}),
      units_required:finiteNumber(value.units_required, `${path}.units_required`, {min:0, max:300}),
      units_remaining:finiteNumber(value.units_remaining, `${path}.units_remaining`, {min:0, max:300}),
      allowed_course_codes:stringArray(
        value.allowed_course_codes,
        `${path}.allowed_course_codes`,
        500,
        normalizeCourseCode
      ),
      portal_text:cleanString(value.portal_text, `${path}.portal_text`, {max:2000})
    };
  }

  function normalizeRule(value, path){
    assertKeys(value, RULE_KEYS, path);
    return {
      condition:cleanString(value.condition, `${path}.condition`, {max:1000}),
      study_programme:cleanString(value.study_programme, `${path}.study_programme`, {max:300}),
      study_year:cleanString(value.study_year, `${path}.study_year`, {max:120}),
      basis_of_admission:cleanString(value.basis_of_admission, `${path}.basis_of_admission`, {max:300})
    };
  }

  function normalizeSection(value, path, snapshotShape){
    assertKeys(value, snapshotShape ? SNAPSHOT_SECTION_KEYS : SECTION_KEYS, path);
    const meetings = [];
    const unresolvedMeetings = [];
    if(Array.isArray(value.meetings)){
      assertArray(value.meetings, `${path}.meetings`, LIMITS.meetingsPerSection, false)
        .forEach((meeting, index) => meetings.push(normalizeMeeting(meeting, `${path}.meetings[${index}]`)));
    } else {
      const dayTime = value.day_time != null ? value.day_time : value.dayTime;
      if(dayTime){
        const parsed = parseHkbuMeetingText(dayTime);
        meetings.push(...parsed.meetings);
        unresolvedMeetings.push(...parsed.unresolved_fragments);
      }
    }
    const sectionName = cleanString(value.section, `${path}.section`, {required:true, max:40});
    if(snapshotShape){
      return {
        section:sectionName,
        meetings
      };
    }
    return {
      section:sectionName,
      day_time:cleanString(value.day_time != null ? value.day_time : value.dayTime, `${path}.day_time`, {max:1000}),
      instructor:cleanString(value.instructor, `${path}.instructor`, {max:500}),
      teaching_medium:cleanString(value.teaching_medium, `${path}.teaching_medium`, {max:160}),
      available_quota:value.available_quota != null
        ? cleanString(value.available_quota, `${path}.available_quota`, {max:80})
        : value.quota != null ? cleanString(value.quota, `${path}.quota`, {max:80}) : null,
      quota_scope:cleanString(value.quota_scope, `${path}.quota_scope`, {max:80}) || "unknown",
      remarks:cleanString(value.remarks, `${path}.remarks`, {max:1000}),
      status:cleanString(value.status, `${path}.status`, {max:120}),
      meetings,
      unresolved_meetings:unresolvedMeetings
    };
  }

  function normalizeCatalogueCourse(value, path, snapshotShape){
    assertKeys(value, snapshotShape ? SNAPSHOT_COURSE_KEYS : COURSE_KEYS, path);
    const sections = [];
    if(Array.isArray(value.sections)){
      assertArray(value.sections, `${path}.sections`, LIMITS.sectionsPerCourse, false)
        .forEach((section, index) => sections.push(normalizeSection(
          section,
          `${path}.sections[${index}]`,
          snapshotShape
        )));
    } else if(value.section != null || value.day_time != null || value.meetings != null){
      sections.push(normalizeSection({
        section:value.section || "00000",
        day_time:value.day_time,
        instructor:value.instructor,
        available_quota:value.available_quota,
        quota_scope:value.quota_scope,
        remarks:value.remarks,
        status:value.status,
        meetings:value.meetings
      }, `${path}.sections[0]`, false));
    }
    const normalized = {
      course_code:normalizeCourseCode(value.course_code != null ? value.course_code : value.code, `${path}.course_code`),
      title:cleanString(value.title != null ? value.title : value.name, `${path}.title`, {required:true, max:300}),
      chinese_title:cleanString(value.chinese_title, `${path}.chinese_title`, {max:240}),
      units:finiteNumber(
        value.units != null ? value.units : value.credits,
        `${path}.units`,
        {required:!snapshotShape, min:0, max:30}
      ),
      level:cleanString(value.level, `${path}.level`, {max:80}),
      academic_group:cleanString(value.academic_group, `${path}.academic_group`, {max:240}),
      unit_code:cleanString(value.unit_code, `${path}.unit_code`, {max:40}),
      teaching_medium:cleanString(value.teaching_medium, `${path}.teaching_medium`, {max:160}),
      prerequisite_text:cleanString(
        value.prerequisite_text != null ? value.prerequisite_text : value.prerequisite,
        `${path}.prerequisite_text`,
        {max:1500}
      ),
      corequisite_text:cleanString(
        value.corequisite_text != null ? value.corequisite_text : value.corequisite,
        `${path}.corequisite_text`,
        {max:1500}
      ),
      target_students:cleanString(
        value.target_students != null ? value.target_students : value.targetStudents,
        `${path}.target_students`,
        {max:1500}
      ),
      description:cleanString(value.description, `${path}.description`, {max:12000}),
      outline_url:cleanString(value.outline_url, `${path}.outline_url`, {max:800}),
      status:cleanString(value.status, `${path}.status`, {max:120}),
      remarks:cleanString(value.remarks, `${path}.remarks`, {max:1000}),
      sections,
      prerequisite_rules:assertArray(value.prerequisite_rules, `${path}.prerequisite_rules`, LIMITS.rulesPerCourse, false)
        .map((rule, index) => normalizeRule(rule, `${path}.prerequisite_rules[${index}]`)),
      corequisite_rules:assertArray(value.corequisite_rules, `${path}.corequisite_rules`, LIMITS.rulesPerCourse, false)
        .map((rule, index) => normalizeRule(rule, `${path}.corequisite_rules[${index}]`))
    };
    if(snapshotShape){
      return {
        course_code:normalized.course_code,
        title:normalized.title,
        units:normalized.units,
        teaching_medium:normalized.teaching_medium,
        prerequisite_text:normalized.prerequisite_text,
        corequisite_text:normalized.corequisite_text,
        target_students:normalized.target_students,
        sections:normalized.sections
      };
    }
    return normalized;
  }

  function normalizeSnapshot(input){
    structuralScan(input, "$");
    assertKeys(input, SNAPSHOT_KEYS, "$");
    if(input.schema_version !== SCHEMA_VERSION){
      fail("UNSUPPORTED_SCHEMA", "$.schema_version", `Expected schema_version ${SCHEMA_VERSION}`);
    }
    assertKeys(input.source, SOURCE_KEYS, "$.source");
    const institution = cleanString(input.source.institution, "$.source.institution", {required:true, max:40, lower:true});
    if(institution !== INSTITUTION) fail("WRONG_INSTITUTION", "$.source.institution", "Only HKBU snapshots are accepted");
    const mode = cleanString(input.source.mode, "$.source.mode", {required:true, max:80, lower:true});
    if(mode !== SOURCE_MODE) fail("WRONG_SOURCE_MODE", "$.source.mode", "Snapshot must be a user portal import");
    const pages = assertArray(input.source.pages, "$.source.pages", LIMITS.pages, true)
      .map((page, index) => {
        const pageKind = cleanString(page, `$.source.pages[${index}]`, {required:true, max:64});
        if(!/^[a-z][a-z0-9_]{0,63}$/u.test(pageKind) || !SAFE_PAGE_KINDS.has(pageKind)){
          fail("UNSAFE_PAGE_KIND", `$.source.pages[${index}]`, "Unsupported academic page kind");
        }
        return pageKind;
      });
    if(!pages.length) fail("REQUIRED_FIELD", "$.source.pages", "At least one academic page kind is required");

    assertKeys(input.academic_profile, PROFILE_KEYS, "$.academic_profile");
    const academicProfile = {
      programme:cleanString(input.academic_profile.programme, "$.academic_profile.programme", {max:240}),
      major:cleanString(input.academic_profile.major, "$.academic_profile.major", {max:240}),
      catalogue_year:cleanString(input.academic_profile.catalogue_year, "$.academic_profile.catalogue_year", {max:240}),
      degree_level:input.academic_profile.degree_level == null
        ? null
        : normalizeDegreeLevel(input.academic_profile.degree_level, "$.academic_profile.degree_level"),
      study_year:finiteNumber(input.academic_profile.study_year, "$.academic_profile.study_year", {min:1, max:8})
    };
    if(academicProfile.study_year != null && !Number.isInteger(academicProfile.study_year)){
      fail("INVALID_STUDY_YEAR", "$.academic_profile.study_year", "Study year must be a whole number");
    }
    const term = cleanString(input.source.term, "$.source.term", {required:true, max:120});
    if(!/^[A-Za-z0-9][A-Za-z0-9 ._:/()&+-]{0,119}$/u.test(term)){
      fail("INVALID_TERM", "$.source.term", "Academic term contains unsafe characters");
    }

    return {
      schema_version:SCHEMA_VERSION,
      source:{
        institution:INSTITUTION,
        mode:SOURCE_MODE,
        captured_at:isoTimestamp(input.source.captured_at, "$.source.captured_at"),
        term,
        parser_version:cleanString(input.source.parser_version, "$.source.parser_version", {required:true, max:40}),
        pages
      },
      academic_profile:academicProfile,
      assigned_courses:assertArray(input.assigned_courses, "$.assigned_courses", LIMITS.assignedCourses, true)
        .map((course, index) => normalizeAssignedCourse(course, `$.assigned_courses[${index}]`)),
      completed_courses:assertArray(input.completed_courses, "$.completed_courses", LIMITS.completedCourses, true)
        .map((course, index) => normalizeCompletedCourse(course, `$.completed_courses[${index}]`)),
      remaining_requirements:assertArray(input.remaining_requirements, "$.remaining_requirements", LIMITS.remainingRequirements, true)
        .map((requirement, index) => normalizeRequirement(requirement, `$.remaining_requirements[${index}]`)),
      catalogue_courses:assertArray(input.catalogue_courses, "$.catalogue_courses", LIMITS.catalogueCourses, false)
        .map((course, index) => normalizeCatalogueCourse(course, `$.catalogue_courses[${index}]`, true))
    };
  }

  function validateSnapshot(input){
    try {
      const value = normalizeSnapshot(input);
      return {ok:true, valid:true, value, snapshot:value, errors:[]};
    } catch(error){
      if(error instanceof CourseCatalogValidationError){
        return {
          ok:false,
          valid:false,
          value:null,
          snapshot:null,
          errors:[{code:error.code, path:error.path, message:error.message}]
        };
      }
      throw error;
    }
  }

  function normalizeCatalogue(input){
    structuralScan(input, "$");
    const wrapper = Array.isArray(input) ? {courses:input} : input;
    assertObject(wrapper, "$");
    if(!Array.isArray(input)) assertKeys(wrapper, CATALOGUE_WRAPPER_KEYS, "$");
    if(wrapper.schema_version != null && wrapper.schema_version !== SCHEMA_VERSION){
      fail("UNSUPPORTED_SCHEMA", "$.schema_version", `Expected schema_version ${SCHEMA_VERSION}`);
    }
    const institution = wrapper.institution == null
      ? INSTITUTION
      : cleanString(wrapper.institution, "$.institution", {required:true, max:40, lower:true});
    if(institution !== INSTITUTION) fail("WRONG_INSTITUTION", "$.institution", "Only HKBU catalogues are accepted");
    const courseInput = wrapper.courses != null ? wrapper.courses : wrapper.catalogue_courses;
    const courses = assertArray(courseInput, "$.courses", LIMITS.catalogueCourses, true)
      .map((course, index) => normalizeCatalogueCourse(course, `$.courses[${index}]`));
    return {
      schema_version:SCHEMA_VERSION,
      institution:INSTITUTION,
      term:cleanString(wrapper.term, "$.term", {max:120}),
      captured_at:wrapper.captured_at ? isoTimestamp(wrapper.captured_at, "$.captured_at") : null,
      source_mode:cleanString(wrapper.source_mode, "$.source_mode", {max:120}),
      publication_status:cleanString(wrapper.publication_status, "$.publication_status", {max:120}),
      caveats:assertArray(wrapper.caveats, "$.caveats", 50, false)
        .map((entry, index) => cleanString(entry, `$.caveats[${index}]`, {required:true, max:1000})),
      courses
    };
  }

  function validateCatalogue(input){
    try {
      const value = normalizeCatalogue(input);
      return {ok:true, valid:true, value, data:value, errors:[]};
    } catch(error){
      if(error instanceof CourseCatalogValidationError){
        return {
          ok:false,
          valid:false,
          value:null,
          data:null,
          errors:[{code:error.code, path:error.path, message:error.message}]
        };
      }
      throw error;
    }
  }

  function unwrapSnapshot(input){
    if(input && input.ok === true && input.value) return input.value;
    return normalizeSnapshot(input);
  }

  function unwrapCatalogue(input){
    if(input && input.ok === true && input.value) return input.value;
    return normalizeCatalogue(input || {courses:[]});
  }

  function issue(code, detail, section){
    const value = {code, detail:detail || null};
    if(section) value.section = section;
    return value;
  }

  function evaluateDegreeLevel(course, profile){
    if(!course.level) return {state:"met", codes:[]};
    if(!profile.degree_level) return {state:"unresolved", codes:["DEGREE_LEVEL_UNRESOLVED"]};
    const lower = course.level.toLowerCase();
    const undergraduate = /undergraduate|\bug\b|bachelor/u.test(lower);
    const postgraduate = /postgraduate|\bpg\b|master|doctoral|phd/u.test(lower);
    if(undergraduate && !["bachelor", "associate", "higher_diploma"].includes(profile.degree_level)){
      return {state:"unmet", codes:["DEGREE_LEVEL_MISMATCH"]};
    }
    if(postgraduate && !["master", "phd"].includes(profile.degree_level)){
      return {state:"unmet", codes:["DEGREE_LEVEL_MISMATCH"]};
    }
    return {state:"met", codes:["DEGREE_LEVEL_MATCH"]};
  }

  function evaluateCondition(text, completedCodes, profile, kind){
    if(!text || /^(?:none|n\/a|nil|not applicable|no prerequisite)s?\.?$/iu.test(text.trim())){
      return {state:"met", codes:[]};
    }
    const cleaned = text.replace(/\s+/gu, " ").trim();
    const year = cleaned.match(/^(?:year|study year)\s*(\d)(?:\s*(?:standing|or above|and above|\+))?\.?$/iu);
    if(year){
      if(profile.study_year == null) return {state:"unresolved", codes:["STUDY_YEAR_UNRESOLVED"]};
      return Number(profile.study_year) >= Number(year[1])
        ? {state:"met", codes:["STUDY_YEAR_MET"]}
        : {state:kind === "corequisite" ? "unresolved" : "unmet", codes:["STUDY_YEAR_NOT_MET"]};
    }
    const codes = [];
    for(const match of cleaned.toUpperCase().matchAll(COURSE_CODE_IN_TEXT)){
      codes.push(`${match[1].replace(/\./gu, "")}${match[2]}`);
    }
    const uniqueCodes = Array.from(new Set(codes));
    if(!uniqueCodes.length){
      return {state:"unresolved", codes:["RESTRICTION_UNPARSED"]};
    }
    if(/\b(?:grade|gpa|cgpa|equivalent|approval|permission|consent|waiver|programme|program|major|admission)\b/iu.test(cleaned)){
      return {state:"unresolved", codes:["RESTRICTION_UNPARSED"]};
    }
    const hasOr = /\bor\b|\//iu.test(cleaned);
    const hasAnd = /\band\b|&|\+/iu.test(cleaned);
    if(hasOr && hasAnd) return {state:"unresolved", codes:["RESTRICTION_UNPARSED"]};
    if(uniqueCodes.length > 1 && !hasOr && !hasAnd){
      return {state:"unresolved", codes:["RESTRICTION_UNPARSED"]};
    }
    const met = hasOr
      ? uniqueCodes.some(code => completedCodes.has(code))
      : uniqueCodes.every(code => completedCodes.has(code));
    if(met) return {state:"met", codes:[kind === "corequisite" ? "COREQUISITE_MET" : "PREREQUISITE_MET"]};
    return {
      state:kind === "corequisite" ? "unresolved" : "unmet",
      codes:[kind === "corequisite" ? "COREQUISITE_NOT_PROVEN" : "PREREQUISITE_NOT_MET"]
    };
  }

  function evaluateRules(course, completedCodes, profile, kind){
    const rules = kind === "corequisite" ? course.corequisite_rules : course.prerequisite_rules;
    const fallback = kind === "corequisite" ? course.corequisite_text : course.prerequisite_text;
    const values = [];
    for(const rule of rules){
      if(rule.study_programme || rule.basis_of_admission){
        values.push({state:"unresolved", codes:["PROFILE_RESTRICTION_UNRESOLVED"]});
        continue;
      }
      if(rule.study_year){
        const numeric = rule.study_year.match(/\d/u);
        if(!numeric || profile.study_year == null){
          values.push({state:"unresolved", codes:["STUDY_YEAR_UNRESOLVED"]});
        } else {
          values.push(Number(profile.study_year) >= Number(numeric[0])
            ? {state:"met", codes:["STUDY_YEAR_MET"]}
            : {state:kind === "corequisite" ? "unresolved" : "unmet", codes:["STUDY_YEAR_NOT_MET"]});
        }
      }
      if(rule.condition) values.push(evaluateCondition(rule.condition, completedCodes, profile, kind));
    }
    if(!rules.length && fallback) values.push(evaluateCondition(fallback, completedCodes, profile, kind));
    if(!values.length) return {state:"met", codes:[]};
    const codes = Array.from(new Set(values.flatMap(value => value.codes)));
    if(values.some(value => value.state === "unmet")) return {state:"unmet", codes};
    if(values.some(value => value.state === "unresolved")) return {state:"unresolved", codes};
    return {state:"met", codes};
  }

  function evaluateCourseRestrictions(course, snapshot, completedCodes){
    const excluded = [];
    const unresolved = [];
    const positive = [];
    const statusText = [course.status, course.remarks].filter(Boolean).join(" ");
    if(/\b(?:cancelled|canceled|not offered|withdrawn)\b/iu.test(statusText)){
      excluded.push(issue("COURSE_CANCELLED", statusText));
    }

    const degree = evaluateDegreeLevel(course, snapshot.academic_profile);
    if(degree.state === "unmet") excluded.push(...degree.codes.map(code => issue(code, course.level)));
    else if(degree.state === "unresolved") unresolved.push(...degree.codes.map(code => issue(code, course.level)));
    else positive.push(...degree.codes);

    if(course.units == null) unresolved.push(issue("UNITS_UNRESOLVED", null));

    const prerequisite = evaluateRules(course, completedCodes, snapshot.academic_profile, "prerequisite");
    if(prerequisite.state === "unmet") excluded.push(...prerequisite.codes.map(code => issue(code, course.prerequisite_text)));
    if(prerequisite.state === "unresolved") unresolved.push(...prerequisite.codes.map(code => issue(code, course.prerequisite_text)));
    if(prerequisite.state === "met") positive.push(...prerequisite.codes);

    const corequisite = evaluateRules(course, completedCodes, snapshot.academic_profile, "corequisite");
    if(corequisite.state !== "met") unresolved.push(...corequisite.codes.map(code => issue(code, course.corequisite_text)));
    else positive.push(...corequisite.codes);

    if(course.target_students && !/^(?:(?:open|available) to |for )?all (?:hkbu )?students?\.?$/iu.test(course.target_students)){
      unresolved.push(issue("TARGET_STUDENTS_UNRESOLVED", course.target_students));
    }
    if(course.remarks && !/\b(?:cancelled|canceled|not offered|withdrawn)\b/iu.test(course.remarks)){
      unresolved.push(issue("COURSE_REMARK_UNRESOLVED", course.remarks));
    }
    return {excluded, unresolved, positive:Array.from(new Set(positive))};
  }

  function sectionToOption(section){
    const unresolved = [...(section.unresolved_meetings || [])];
    const statusText = [section.status, section.remarks].filter(Boolean).join(" ");
    if(/\b(?:cancelled|canceled|not offered|withdrawn)\b/iu.test(statusText)){
      return {state:"excluded", issues:[issue("SECTION_CANCELLED", statusText, section.section)]};
    }
    if(section.remarks){
      unresolved.push(issue("SECTION_REMARK_UNRESOLVED", section.remarks, section.section));
    }
    if(!section.meetings.length){
      unresolved.push(issue("MEETING_UNAVAILABLE", section.day_time, section.section));
    }
    if(section.meetings.length > MAX_PLANNER_MEETINGS){
      unresolved.push(issue("TOO_MANY_MEETINGS_FOR_PLANNER", String(section.meetings.length), section.section));
    }
    if(section.meetings.some(meeting => meeting.days.includes(7))){
      unresolved.push(issue("SUNDAY_NOT_SUPPORTED_BY_PLANNER", null, section.section));
    }
    if(unresolved.length) return {state:"unresolved", issues:unresolved};
    return {
      state:"eligible",
      option:{
        section:section.section,
        sessions:section.meetings.map(meeting => ({
          days:meeting.days.slice(),
          start:parseHkbuTime(meeting.start),
          end:parseHkbuTime(meeting.end),
          venue:meeting.venue
        }))
      }
    };
  }

  function plannerCourse(course, options, assignment, source, reasonCodes){
    const instructors = Array.from(new Set(course.sections
      .filter(section => options.some(option => option.section === section.section))
      .map(section => section.instructor)
      .filter(Boolean)));
    const professor = instructors.join("; ");
    const codes = Array.from(new Set(reasonCodes || []));
    return {
      external_id:`hkbu:${source.term || "unknown"}:${course.course_code}:${assignment}`,
      name:course.title,
      title:course.title,
      code:course.course_code,
      course_code:course.course_code,
      professor,
      instructor:professor || null,
      academic_group:course.academic_group || null,
      unit_code:course.unit_code || null,
      teaching_medium:course.teaching_medium || null,
      credits:course.units,
      units:course.units,
      required:assignment === "assigned",
      assignment,
      sessionsPerWeek:options.reduce((max, option) => Math.max(max, option.sessions.length), 0),
      multiOffer:options.length > 1,
      options,
      source:{
        institution:source.institution,
        term:source.term,
        captured_at:source.captured_at,
        parser_version:source.parser_version
      },
      eligibility:{
        state:"eligible",
        reason_codes:codes,
        unresolved_restrictions:[],
        blocking_restrictions:[]
      },
      reason_codes:codes,
      reasons:codes
    };
  }

  function assignedPlannerEntry(course, source){
    if(course.units == null){
      return {
        bucket:"unresolved",
        value:{
          course_code:course.course_code,
          title:course.title,
          section:course.section,
          eligibility:{
            state:"unresolved",
            reason_codes:["UNITS_UNRESOLVED"],
            unresolved_restrictions:[issue("UNITS_UNRESOLVED", null)],
            blocking_restrictions:[]
          }
        }
      };
    }
    const section = {
      section:course.section || "ASSIGNED",
      instructor:null,
      remarks:null,
      status:course.status,
      day_time:null,
      meetings:course.meetings,
      unresolved_meetings:[]
    };
    if(/\b(?:dropped|withdrawn|cancelled|canceled)\b/iu.test(course.status || "")){
      return {
        bucket:"excluded",
        value:{
          course_code:course.course_code,
          title:course.title,
          eligibility:{
            state:"ineligible",
            reason_codes:["ASSIGNED_STATUS_INACTIVE"],
            blocking_restrictions:[issue("ASSIGNED_STATUS_INACTIVE", course.status)]
          }
        }
      };
    }
    const option = sectionToOption(section);
    if(option.state !== "eligible"){
      return {
        bucket:option.state,
        value:{
          course_code:course.course_code,
          title:course.title,
          section:course.section,
          eligibility:{
            state:option.state === "excluded" ? "ineligible" : "unresolved",
            reason_codes:option.issues.map(entry => entry.code),
            unresolved_restrictions:option.state === "unresolved" ? option.issues : [],
            blocking_restrictions:option.state === "excluded" ? option.issues : []
          }
        }
      };
    }
    const catalogueShape = {
      course_code:course.course_code,
      title:course.title,
      units:course.units,
      sections:[section]
    };
    return {
      bucket:"assigned",
      value:plannerCourse(catalogueShape, [option.option], "assigned", source, ["ASSIGNED_BY_PORTAL"])
    };
  }

  function unresolvedRecord(course, issues, sections){
    return {
      course_code:course.course_code,
      title:course.title,
      units:course.units,
      sections:sections || [],
      eligibility:{
        state:"unresolved",
        reason_codes:Array.from(new Set(issues.map(entry => entry.code))),
        unresolved_restrictions:issues,
        blocking_restrictions:[]
      }
    };
  }

  function excludedRecord(course, issues){
    return {
      course_code:course.course_code,
      title:course.title,
      units:course.units,
      eligibility:{
        state:"ineligible",
        reason_codes:Array.from(new Set(issues.map(entry => entry.code))),
        unresolved_restrictions:[],
        blocking_restrictions:issues
      }
    };
  }

  function buildPlannerCandidates(snapshotInput, catalogueInput){
    const snapshot = unwrapSnapshot(snapshotInput);
    const externalCatalogue = catalogueInput == null ? null : unwrapCatalogue(catalogueInput);
    const embeddedCourses = snapshot.catalogue_courses || [];
    const courses = externalCatalogue && externalCatalogue.courses.length
      ? externalCatalogue.courses
      : embeddedCourses;
    const source = Object.assign({}, snapshot.source);
    if(externalCatalogue && externalCatalogue.term) source.term = externalCatalogue.term;
    if(externalCatalogue && externalCatalogue.captured_at) source.catalogue_captured_at = externalCatalogue.captured_at;

    const assigned = [];
    const candidates = [];
    const unresolved = [];
    const excluded = [];
    const assignedCodes = new Set();
    snapshot.assigned_courses.forEach(course => {
      assignedCodes.add(course.course_code);
      const result = assignedPlannerEntry(course, source);
      if(result.bucket === "assigned") assigned.push(result.value);
      else if(result.bucket === "unresolved") unresolved.push(result.value);
      else excluded.push(result.value);
    });
    const completedCodes = new Set(snapshot.completed_courses.map(course => course.course_code));
    for(const code of assignedCodes) completedCodes.add(code);

    let truncatedOptions = 0;
    for(const course of courses){
      if(completedCodes.has(course.course_code)){
        excluded.push(excludedRecord(course, [issue(
          assignedCodes.has(course.course_code) ? "ALREADY_ASSIGNED" : "ALREADY_COMPLETED",
          null
        )]));
        continue;
      }
      const restriction = evaluateCourseRestrictions(course, snapshot, completedCodes);
      if(restriction.excluded.length){
        excluded.push(excludedRecord(course, restriction.excluded));
        continue;
      }
      if(restriction.unresolved.length){
        unresolved.push(unresolvedRecord(course, restriction.unresolved));
        continue;
      }
      const options = [];
      const sectionIssues = [];
      const sectionExcluded = [];
      for(const section of course.sections){
        const result = sectionToOption(section);
        if(result.state === "eligible") options.push(result.option);
        else if(result.state === "unresolved") sectionIssues.push(...result.issues);
        else sectionExcluded.push(...result.issues);
      }
      if(!options.length){
        if(sectionIssues.length){
          unresolved.push(unresolvedRecord(course, sectionIssues));
        } else {
          excluded.push(excludedRecord(course, sectionExcluded.length
            ? sectionExcluded
            : [issue("NO_SCHEDULED_SECTION", null)]));
        }
        continue;
      }
      const selectedOptions = options.slice(0, MAX_PLANNER_OPTIONS);
      if(options.length > MAX_PLANNER_OPTIONS) truncatedOptions += options.length - MAX_PLANNER_OPTIONS;
      const candidate = plannerCourse(
        course,
        selectedOptions,
        "catalogue",
        source,
        [...restriction.positive, "KNOWN_RESTRICTIONS_SATISFIED"]
      );
      candidates.push(candidate);
      if(sectionIssues.length){
        unresolved.push(unresolvedRecord(course, sectionIssues, sectionIssues.map(entry => entry.section).filter(Boolean)));
      }
    }

    return {
      schema_version:SCHEMA_VERSION,
      source,
      academic_profile:snapshot.academic_profile,
      remaining_requirements:snapshot.remaining_requirements,
      assigned,
      candidates,
      unresolved,
      excluded,
      all:[...assigned, ...candidates],
      diagnostics:{
        catalogue_courses:courses.length,
        assigned:assigned.length,
        eligible_candidates:candidates.length,
        unresolved:unresolved.length,
        excluded:excluded.length,
        truncated_options:truncatedOptions,
        quota_policy:"informational_only"
      }
    };
  }

  function requirementReasons(candidate, requirements){
    const reasons = [];
    let score = 0;
    const code = candidate.course_code;
    for(const requirement of requirements){
      if(requirement.allowed_course_codes.includes(code)){
        score += 100;
        reasons.push("REMAINING_REQUIREMENT_COURSE_MATCH");
      }
      const text = [requirement.requirement_id, requirement.group, requirement.portal_text]
        .filter(Boolean)
        .join(" ")
        .toUpperCase();
      if(new RegExp(`\\b${code}\\b`, "u").test(text)){
        score += 100;
        reasons.push("REMAINING_REQUIREMENT_TEXT_MATCH");
      } else if(requirement.group && [
        candidate.academic_group,
        candidate.unit_code,
        candidate.title
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(requirement.group.toLowerCase()))){
        score += 40;
        reasons.push("REMAINING_REQUIREMENT_CATEGORY_MATCH");
      }
    }
    if(!reasons.length){
      score += 10;
      reasons.push("OPEN_ELECTIVE_ELIGIBLE");
    }
    if(candidate.options.length > 1){
      score += Math.min(10, candidate.options.length);
      reasons.push("MULTIPLE_SCHEDULE_OPTIONS");
    }
    if(candidate.reason_codes.includes("PREREQUISITE_MET")){
      score += 10;
      reasons.push("PREREQUISITE_VERIFIED");
    }
    return {score, reasons:Array.from(new Set(reasons))};
  }

  function recommendCourses(snapshotOrBuilt, catalogueOrOptions, maybeOptions){
    let built;
    let options;
    if(snapshotOrBuilt && Array.isArray(snapshotOrBuilt.candidates) && Array.isArray(snapshotOrBuilt.unresolved)){
      built = snapshotOrBuilt;
      options = catalogueOrOptions || {};
    } else {
      built = buildPlannerCandidates(snapshotOrBuilt, catalogueOrOptions);
      options = maybeOptions || {};
    }
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 30));
    const recommendations = built.candidates
      .filter(candidate => candidate.eligibility && candidate.eligibility.state === "eligible")
      .map(candidate => {
        const ranking = requirementReasons(candidate, built.remaining_requirements || []);
        return Object.assign({}, candidate, {
          score:ranking.score,
          recommendation_reason_codes:ranking.reasons,
          reason_codes:Array.from(new Set([...(candidate.reason_codes || []), ...ranking.reasons])),
          reasons:Array.from(new Set([...(candidate.reasons || []), ...ranking.reasons]))
        });
      })
      .sort((left, right) => right.score - left.score
        || left.course_code.localeCompare(right.course_code)
        || left.title.localeCompare(right.title))
      .slice(0, limit);
    return {
      schema_version:SCHEMA_VERSION,
      recommendations,
      needs_review:built.unresolved.slice(),
      excluded:built.excluded.slice(),
      summary:{
        recommended:recommendations.length,
        needs_review:built.unresolved.length,
        excluded:built.excluded.length
      },
      disclaimer_code:"VERIFY_IN_BUNIPORT"
    };
  }

  function publicCourseFacts(course){
    const output = {
      course_code:course.course_code,
      title:course.title,
      units:course.units,
      sections:course.sections.map(section => ({
        section:section.section,
        meetings:section.meetings.map(meeting => ({
          days:meeting.days.slice(),
          start:meeting.start,
          end:meeting.end,
          venue:meeting.venue || ""
        }))
      }))
    };
    if(course.prerequisite_text) output.prerequisite_text = course.prerequisite_text;
    if(course.corequisite_text) output.corequisite_text = course.corequisite_text;
    if(course.target_students) output.target_students = course.target_students;
    if(course.teaching_medium) output.teaching_medium = course.teaching_medium;
    return output;
  }

  function assignedCourseFacts(course){
    return {
      course_code:course.course_code,
      title:course.title,
      units:course.units,
      sections:[{
        section:course.section || "UNKNOWN",
        meetings:course.meetings.map(meeting => ({
          days:meeting.days.slice(),
          start:meeting.start,
          end:meeting.end,
          venue:meeting.venue || ""
        }))
      }]
    };
  }

  function dedupeContributionCourses(courses){
    const byCode = new Map();
    for(const course of courses){
      let target = byCode.get(course.course_code);
      if(!target){
        target = {
          course_code:course.course_code,
          title:course.title,
          units:course.units,
          sections:[]
        };
        for(const field of ["prerequisite_text", "corequisite_text", "target_students", "teaching_medium"]){
          if(course[field]) target[field] = course[field];
        }
        byCode.set(course.course_code, target);
      }
      const knownSections = new Set(target.sections.map(section => JSON.stringify(section)));
      for(const section of course.sections){
        const identity = JSON.stringify(section);
        if(!knownSections.has(identity)){
          target.sections.push(section);
          knownSections.add(identity);
        }
      }
    }
    return Array.from(byCode.values()).sort((left, right) => left.course_code.localeCompare(right.course_code));
  }

  function buildDeidentifiedContribution(snapshotInput, catalogueInput){
    const snapshot = unwrapSnapshot(snapshotInput);
    let courseFacts;
    if(catalogueInput != null){
      courseFacts = unwrapCatalogue(catalogueInput).courses.map(publicCourseFacts);
    } else if(snapshot.catalogue_courses.length){
      courseFacts = snapshot.catalogue_courses.map(publicCourseFacts);
    } else {
      courseFacts = snapshot.assigned_courses.map(assignedCourseFacts);
    }
    return {
      schema_version:SCHEMA_VERSION,
      kind:CONTRIBUTION_KIND,
      source:{
        institution:INSTITUTION,
        term:snapshot.source.term,
        captured_on:snapshot.source.captured_at.slice(0, 10),
        parser_version:snapshot.source.parser_version
      },
      privacy:{
        classification:"deidentified_course_metadata",
        excluded:[
          "academic_profile",
          "completion_history",
          "requirement_progress",
          "registration_status",
          "instructors",
          "personalized_quota",
          "portal_pages",
          "precise_timestamps"
        ]
      },
      courses:dedupeContributionCourses(
        courseFacts.filter(course => Number.isFinite(course.units))
      ).slice(0, 2000)
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    LIMITS,
    CourseCatalogValidationError,
    normalizeSnapshot,
    validateSnapshot,
    normalizeCatalogue,
    validateCatalogue,
    parseHkbuDays,
    parseHkbuTime,
    parseHkbuTimeRange,
    parseHkbuMeetingText,
    buildPlannerCandidates,
    recommendCourses,
    buildDeidentifiedContribution
  });
});
