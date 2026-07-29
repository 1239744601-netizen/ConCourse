(() => {
  "use strict";

  const SCHEMA = "org.concourse.hkbu.portal-fragments";
  const SCHEMA_VERSION = 1;
  const SUPPORTED_HOSTS = new Set([
    "buniport.hkbu.edu.hk",
    "buniport03.hkbu.edu.hk",
    "iss.hkbu.edu.hk"
  ]);
  const MAX_TABLES = 30;
  const MAX_ROWS = 1000;
  const MAX_CELL_LENGTH = 500;
  const MAX_FRAGMENTS = 1000;
  const MAX_MERGED_PAGES = 30;
  const PAGE_KINDS = new Set([
    "academic_profile",
    "student_enrolment",
    "personal_timetable",
    "degree_progress",
    "course_information"
  ]);
  const COURSE_PREFIX_PATTERN = "(?:[A-Z]{2,8}|[A-Z]{1,4}(?:\\.[A-Z]{1,4}){1,7}\\.?)";
  const COURSE_CODE_PATTERN = new RegExp(
    `^${COURSE_PREFIX_PATTERN}\\s*-?\\s*\\d{3,5}[A-Z]?$`,
    "u"
  );
  const COURSE_IN_TEXT_PATTERN = new RegExp(
    `\\b(${COURSE_PREFIX_PATTERN}\\s*-?\\s*\\d{3,5}[A-Z]?)\\b`,
    "u"
  );
  const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
  const STUDENT_NUMBER_PATTERN = /(?:^|[^\d])\d{8,10}(?:[^\d]|$)/u;

  const HEADER_ALIASES = Object.freeze({
    combinedCourse: [
      "course",
      "subject",
      "科目",
      "課程",
      "课程"
    ],
    courseCode: [
      "coursecode",
      "courseno",
      "coursenumber",
      "subjectcode",
      "subjectno",
      "subjectnumber",
      "科目編號",
      "科目编号",
      "課程編號",
      "课程编号",
      "科目代碼",
      "科目代码",
      "課程代碼",
      "课程代码"
    ],
    courseTitle: [
      "coursetitle",
      "coursename",
      "subjecttitle",
      "subjectname",
      "科目名稱",
      "科目名称",
      "課程名稱",
      "课程名称"
    ],
    section: [
      "section",
      "sectionno",
      "sectionnumber",
      "sect",
      "classsection",
      "班別",
      "班别",
      "組別",
      "组别"
    ],
    term: [
      "term",
      "semester",
      "academicterm",
      "teachingterm",
      "學期",
      "学期"
    ],
    units: [
      "unit",
      "units",
      "credit",
      "credits",
      "creditunit",
      "creditunits",
      "學分",
      "学分"
    ],
    day: [
      "day",
      "weekday",
      "meetingday",
      "classday",
      "星期",
      "上課日",
      "上课日"
    ],
    time: [
      "time",
      "classtime",
      "meetingtime",
      "timeslot",
      "上課時間",
      "上课时间",
      "時間",
      "时间"
    ],
    dayTime: [
      "daytime",
      "classdaytime",
      "meetingdaytime",
      "weekdaytime",
      "上課日期時間",
      "上课日期时间",
      "上課日時間",
      "上课日时间"
    ],
    startTime: [
      "start",
      "starttime",
      "from",
      "開始時間",
      "开始时间"
    ],
    endTime: [
      "end",
      "endtime",
      "to",
      "結束時間",
      "结束时间"
    ],
    venue: [
      "venue",
      "location",
      "room",
      "classroom",
      "上課地點",
      "上课地点",
      "地點",
      "地点",
      "課室",
      "课室"
    ],
    status: [
      "status",
      "enrolmentstatus",
      "enrollmentstatus",
      "registrationstatus",
      "狀態",
      "状态"
    ],
    quota: [
      "quota",
      "classquota",
      "capacity",
      "限額",
      "限额",
      "名額",
      "名额"
    ],
    seatsAvailable: [
      "available",
      "availability",
      "vacancy",
      "vacancies",
      "seatsavailable",
      "placesavailable",
      "餘額",
      "余额",
      "空缺"
    ],
    prerequisite: [
      "prerequisite",
      "prerequisites",
      "prerequisiterequirement",
      "先修科",
      "先修課程",
      "先修课程"
    ],
    corequisite: [
      "corequisite",
      "corequisites",
      "corequisiterequirement",
      "並修科",
      "并修科",
      "共修科"
    ],
    targetStudents: [
      "targetstudent",
      "targetstudents",
      "targetgroup",
      "eligiblestudents",
      "適用學生",
      "适用学生",
      "對象",
      "对象"
    ],
    teachingMedium: [
      "teachingmedium",
      "mediumofinstruction",
      "instructionmedium",
      "languageofinstruction",
      "授課語言",
      "授课语言",
      "教學語言",
      "教学语言"
    ],
    requirementCategory: [
      "category",
      "requirementcategory",
      "requirementgroup",
      "area",
      "類別",
      "类别",
      "範疇",
      "范畴"
    ],
    requirement: [
      "requirement",
      "requirements",
      "graduationrequirement",
      "requirementdescription",
      "規定",
      "规定",
      "畢業要求",
      "毕业要求",
      "要求"
    ],
    requiredUnits: [
      "requiredunits",
      "unitsrequired",
      "minimumunits",
      "requiredcredits",
      "creditsrequired",
      "所需學分",
      "所需学分",
      "要求學分",
      "要求学分"
    ],
    completedUnits: [
      "completedunits",
      "unitscompleted",
      "earnedunits",
      "unitsearned",
      "completedcredits",
      "earnedcredits",
      "已修學分",
      "已修学分",
      "取得學分",
      "取得学分"
    ],
    programme: [
      "programme",
      "program",
      "studyprogramme",
      "programmeofstudy",
      "programofstudy",
      "degreeprogramme",
      "就讀課程",
      "就读课程",
      "修讀課程",
      "修读课程"
    ],
    major: [
      "major",
      "majorprogramme",
      "concentration",
      "specialisation",
      "specialization",
      "stream",
      "主修",
      "專修",
      "专修",
      "專業",
      "专业"
    ],
    studyYear: [
      "studyyear",
      "yearofstudy",
      "currentstudyyear",
      "yearlevel",
      "修讀年級",
      "修读年级",
      "就讀年級",
      "就读年级",
      "年級",
      "年级"
    ],
    catalogueYear: [
      "catalogueyear",
      "catalogyear",
      "curriculumyear",
      "entryyear",
      "admissionyear",
      "admittedyear",
      "課程年度",
      "课程年度",
      "入學年份",
      "入学年份"
    ],
    degreeLevel: [
      "degreelevel",
      "awardlevel",
      "levelofstudy",
      "學位程度",
      "学位程度",
      "學位級別",
      "学位级别"
    ]
  });

  const SENSITIVE_HEADERS = new Set([
    "name",
    "studentname",
    "candidate",
    "candidatename",
    "student",
    "studentid",
    "studentno",
    "studentnumber",
    "userid",
    "username",
    "email",
    "emailaddress",
    "hkid",
    "idcard",
    "identitynumber",
    "dateofbirth",
    "dob",
    "gender",
    "sex",
    "phone",
    "telephone",
    "mobile",
    "address",
    "instructor",
    "instructorname",
    "teacher",
    "teachername",
    "lecturer",
    "lecturername",
    "tutor",
    "tutorname",
    "professor",
    "professorname",
    "staff",
    "staffname",
    "grade",
    "grades",
    "mark",
    "marks",
    "result",
    "results",
    "gpa",
    "cumulativegpa",
    "cgpa",
    "姓名",
    "學生姓名",
    "学生姓名",
    "學生編號",
    "学生编号",
    "學號",
    "学号",
    "電郵",
    "电邮",
    "電子郵件",
    "电子邮件",
    "身份證",
    "身份证",
    "出生日期",
    "性別",
    "性别",
    "電話",
    "电话",
    "地址",
    "導師",
    "导师",
    "講師",
    "讲师",
    "教師",
    "教师",
    "任課老師",
    "任课老师",
    "成績",
    "成绩",
    "分數",
    "分数"
  ]);
  const GRADE_HEADERS = new Set([
    "grade",
    "grades",
    "mark",
    "marks",
    "result",
    "results",
    "gpa",
    "cumulativegpa",
    "cgpa",
    "成績",
    "成绩",
    "分數",
    "分数"
  ]);

  const FIELD_BY_ALIAS = new Map();
  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    aliases.forEach((alias) => FIELD_BY_ALIAS.set(alias, field));
  });

  function normalizeWhitespace(value) {
    return String(value ?? "").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
  }

  function normalizeHeader(value) {
    return normalizeWhitespace(value)
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/[\s_.:/\\()[\]{}#*+\-–—]+/gu, "");
  }

  function safeCellValue(value) {
    const cleaned = normalizeWhitespace(value).slice(0, MAX_CELL_LENGTH);
    if (!cleaned || EMAIL_PATTERN.test(cleaned) || STUDENT_NUMBER_PATTERN.test(` ${cleaned} `)) {
      return "";
    }
    return cleaned;
  }

  function parseNumber(value) {
    const cleaned = safeCellValue(value).replace(/,/gu, "");
    if (!/^\d+(?:\.\d+)?$/u.test(cleaned)) return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function normalizeCourseCode(value) {
    const cleaned = safeCellValue(value).toLocaleUpperCase("en").replace(/\s*-\s*/gu, "-");
    if (!COURSE_CODE_PATTERN.test(cleaned)) return "";
    const prefix = cleaned.match(/^[A-Z.]+/u)?.[0] || "";
    const letterCount = prefix.replace(/\./gu, "").length;
    if (letterCount < 2 || letterCount > 8) return "";
    return cleaned.replace(/\s+/gu, "");
  }

  function splitCombinedCourse(value) {
    const cleaned = safeCellValue(value);
    const match = cleaned.toLocaleUpperCase("en").match(COURSE_IN_TEXT_PATTERN);
    if (!match) return {};
    const courseCode = normalizeCourseCode(match[1]);
    if (!courseCode) return {};
    const title = safeCellValue(
      `${cleaned.slice(0, match.index)} ${cleaned.slice((match.index || 0) + match[1].length)}`
        .replace(/^[\s:–—-]+|[\s:–—-]+$/gu, "")
    );
    return title ? {courseCode, courseTitle:title} : {courseCode};
  }

  function classifyHeaders(headers) {
    if (!Array.isArray(headers) || headers.length < 2 || headers.length > 40) {
      return {kind:"unknown", mapping:[], score:0};
    }

    const seenFields = new Set();
    const mapping = [];
    let score = 0;
    let hasSensitiveHeader = false;
    let hasGradeHeader = false;

    for (const header of headers) {
      const normalized = normalizeHeader(header);
      if (SENSITIVE_HEADERS.has(normalized)) {
        mapping.push(null);
        hasSensitiveHeader = true;
        hasGradeHeader ||= GRADE_HEADERS.has(normalized);
        continue;
      }
      const field = FIELD_BY_ALIAS.get(normalized) || null;
      if (!field || seenFields.has(field)) {
        mapping.push(null);
        continue;
      }
      seenFields.add(field);
      mapping.push(field);
      score += 1;
    }

    const hasCourseCode = seenFields.has("courseCode") || seenFields.has("combinedCourse");
    const courseDetailFields = [
      "courseTitle",
      "section",
      "term",
      "units",
      "day",
      "time",
      "dayTime",
      "startTime",
      "endTime",
      "venue",
      "status",
      "quota",
      "seatsAvailable",
      "prerequisite",
      "corequisite",
      "targetStudents",
      "teachingMedium"
    ];
    const isCourse = hasCourseCode && courseDetailFields.some((field) => seenFields.has(field));
    const isRequirement = seenFields.has("requirement") && [
      "requirementCategory",
      "requiredUnits",
      "completedUnits",
      "status"
    ].some((field) => seenFields.has(field));
    const profileFields = ["programme", "major", "studyYear", "catalogueYear", "degreeLevel"];
    const isProfile = profileFields.filter((field) => seenFields.has(field)).length >= 2;

    return {
      kind:isCourse ? "course" : isRequirement ? "requirement" : isProfile ? "profile" : "unknown",
      mapping,
      score,
      hasSensitiveHeader,
      hasGradeHeader,
      fields:Array.from(seenFields)
    };
  }

  function parseTimeRange(value) {
    const cleaned = safeCellValue(value);
    const match = cleaned.match(
      /^(\d{1,2}:\d{2}(?:\s*[AP]\.?M\.?)?)\s*(?:-|–|—|to|至)\s*(\d{1,2}:\d{2}(?:\s*[AP]\.?M\.?)?)(?:\s+(.+))?$/iu
    );
    if (!match) return cleaned ? {timeText:cleaned} : {};
    const parsed = {startsAt:normalizeWhitespace(match[1]), endsAt:normalizeWhitespace(match[2])};
    const venue = safeCellValue(match[3]);
    if (venue) parsed.venue = venue;
    return parsed;
  }

  function parseDayTimeMeetings(value, venue) {
    const cleaned = safeCellValue(value);
    if (!cleaned) return [];
    const meetingVenue = safeCellValue(venue);
    return cleaned
      .split(/\s*(?:;|\|)\s*/u)
      .map((part) => {
        const match = part.match(
          /^(.+?)\s+(\d{1,2}:\d{2}(?:\s*[AP]\.?M\.?)?)\s*(?:-|–|—|to|至)\s*(\d{1,2}:\d{2}(?:\s*[AP]\.?M\.?)?)(?:\s+(.+))?$/iu
        );
        if (!match || !canonicalDays(match[1]).length) return null;
        const meeting = {
          day:normalizeWhitespace(match[1]),
          startsAt:normalizeWhitespace(match[2]),
          endsAt:normalizeWhitespace(match[3])
        };
        const appendedVenue = safeCellValue(match[4]);
        if (meetingVenue || appendedVenue) meeting.venue = meetingVenue || appendedVenue;
        return meeting;
      })
      .filter(Boolean);
  }

  function rowObject(row, mapping) {
    const output = {};
    mapping.forEach((field, index) => {
      if (!field) return;
      const value = safeCellValue(row[index]);
      if (value) output[field] = value;
    });
    if (output.combinedCourse) {
      Object.assign(output, splitCombinedCourse(output.combinedCourse));
      delete output.combinedCourse;
    }
    return output;
  }

  function courseFragment(row) {
    const courseCode = normalizeCourseCode(row.courseCode);
    if (!courseCode) return null;

    const fragment = {type:"course", courseCode};
    const strings = [
      ["courseTitle", "title"],
      ["section", "section"],
      ["term", "term"],
      ["status", "status"],
      ["prerequisite", "prerequisite"],
      ["corequisite", "corequisite"],
      ["targetStudents", "targetStudents"],
      ["teachingMedium", "teachingMedium"]
    ];
    strings.forEach(([source, destination]) => {
      const value = safeCellValue(row[source]);
      if (value) fragment[destination] = value;
    });

    const numericFields = [["units", "units"]];
    numericFields.forEach(([source, destination]) => {
      const value = parseNumber(row[source]);
      if (value !== undefined) fragment[destination] = value;
    });

    const day = safeCellValue(row.day);
    const venue = safeCellValue(row.venue);
    const startTime = safeCellValue(row.startTime);
    const endTime = safeCellValue(row.endTime);
    const combinedMeetings = parseDayTimeMeetings(row.dayTime, venue);
    if (combinedMeetings.length) {
      fragment.meetings = combinedMeetings;
      return fragment;
    }

    const meeting = {};
    if (day) meeting.day = day;
    if (startTime && endTime) {
      meeting.startsAt = startTime;
      meeting.endsAt = endTime;
    } else if (row.time) {
      Object.assign(meeting, parseTimeRange(row.time));
    }
    if (venue) meeting.venue = venue;
    if (Object.keys(meeting).length) fragment.meeting = meeting;

    return fragment;
  }

  function requirementFragment(row) {
    const description = safeCellValue(row.requirement);
    if (!description) return null;
    const fragment = {type:"requirement", description};
    const category = safeCellValue(row.requirementCategory);
    const status = safeCellValue(row.status);
    if (category) fragment.category = category;
    if (status) fragment.status = status;
    const requiredUnits = parseNumber(row.requiredUnits);
    const completedUnits = parseNumber(row.completedUnits);
    if (requiredUnits !== undefined) fragment.requiredUnits = requiredUnits;
    if (completedUnits !== undefined) fragment.completedUnits = completedUnits;
    return fragment;
  }

  function profileFragment(row) {
    const fragment = {type:"academic_profile"};
    [
      ["programme", "programme"],
      ["major", "major"],
      ["studyYear", "studyYear"],
      ["catalogueYear", "catalogueYear"],
      ["degreeLevel", "degreeLevel"]
    ].forEach(([source, destination]) => {
      const value = safeCellValue(row[source]);
      if (value) fragment[destination] = value;
    });
    return Object.keys(fragment).length > 2 ? fragment : null;
  }

  function supportedOrigin(origin) {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "https:" && SUPPORTED_HOSTS.has(parsed.hostname) && parsed.origin === origin;
    } catch {
      return false;
    }
  }

  function pageKindsFor(fragments, courseEntries) {
    const kinds = new Set();
    if (fragments.some((fragment) => fragment.type === "academic_profile")) {
      kinds.add("academic_profile");
    }
    if (fragments.some((fragment) => fragment.type === "requirement")) {
      kinds.add("degree_progress");
    }
    courseEntries.forEach(({bucket, fragment}) => {
      if (bucket === "catalogue") {
        kinds.add("course_information");
      } else if (bucket === "completed") {
        kinds.add("student_enrolment");
      } else if (fragment.meeting || (Array.isArray(fragment.meetings) && fragment.meetings.length)) {
        kinds.add("personal_timetable");
      } else {
        kinds.add("student_enrolment");
      }
    });
    return Array.from(PAGE_KINDS).filter((kind) => kinds.has(kind));
  }

  function courseBucket(classification) {
    if (classification.hasGradeHeader) return "completed";
    const fields = new Set(classification.fields);
    if (["quota", "seatsAvailable", "prerequisite", "corequisite", "targetStudents"].some((field) => fields.has(field))) {
      return "catalogue";
    }
    if (["section", "status", "day", "time", "dayTime", "startTime", "endTime", "venue"].some((field) => fields.has(field))) {
      return "assigned";
    }
    return "catalogue";
  }

  const DAY_NUMBER = new Map([
    ["mon", 1],
    ["monday", 1],
    ["星期一", 1],
    ["週一", 1],
    ["周一", 1],
    ["tue", 2],
    ["tues", 2],
    ["tuesday", 2],
    ["星期二", 2],
    ["週二", 2],
    ["周二", 2],
    ["wed", 3],
    ["wednesday", 3],
    ["星期三", 3],
    ["週三", 3],
    ["周三", 3],
    ["thu", 4],
    ["thur", 4],
    ["thurs", 4],
    ["thursday", 4],
    ["星期四", 4],
    ["週四", 4],
    ["周四", 4],
    ["fri", 5],
    ["friday", 5],
    ["星期五", 5],
    ["週五", 5],
    ["周五", 5],
    ["sat", 6],
    ["saturday", 6],
    ["星期六", 6],
    ["週六", 6],
    ["周六", 6]
  ]);

  function canonicalDays(value) {
    const normalized = safeCellValue(value)
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/星期/gu, " 星期")
      .replace(/[,&/+;|]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (!normalized) return [];
    const days = [];
    normalized.split(" ").forEach((token) => {
      const day = DAY_NUMBER.get(token.replace(/[.]/gu, ""));
      if (day && !days.includes(day)) days.push(day);
    });
    return days.sort((a, b) => a - b);
  }

  function canonicalClock(value) {
    const normalized = safeCellValue(value)
      .toLocaleUpperCase("en")
      .replace(/[.]/gu, "")
      .replace(/\s+/gu, "");
    const match = normalized.match(/^(\d{1,2}):(\d{2})(AM|PM)?$/u);
    if (!match) return "";
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || hour > (match[3] ? 12 : 23) || hour < (match[3] ? 1 : 0)) return "";
    if (match[3] === "AM" && hour === 12) hour = 0;
    if (match[3] === "PM" && hour !== 12) hour += 12;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function canonicalMeeting(value) {
    if (!value || typeof value !== "object") return null;
    const days = canonicalDays(value.day);
    const start = canonicalClock(value.startsAt);
    const end = canonicalClock(value.endsAt);
    if (!days.length || !start || !end || end <= start) return null;
    const meeting = {days, start, end, venue:null};
    const venue = safeCellValue(value.venue);
    if (venue) meeting.venue = venue;
    return meeting;
  }

  function canonicalMeetings(fragment) {
    const values = Array.isArray(fragment.meetings)
      ? fragment.meetings
      : fragment.meeting
        ? [fragment.meeting]
        : [];
    const meetings = [];
    values.forEach((value) => pushUniqueMeeting(meetings, canonicalMeeting(value)));
    return meetings;
  }

  function pushUniqueMeeting(meetings, meeting) {
    if (!meeting) return;
    const identity = JSON.stringify(meeting);
    if (!meetings.some((candidate) => JSON.stringify(candidate) === identity)) {
      meetings.push(meeting);
    }
  }

  function canonicalAssignedCourses(entries) {
    const grouped = new Map();
    entries.filter((entry) => entry.bucket === "assigned").forEach(({fragment}) => {
      const section = safeCellValue(fragment.section);
      const key = `${fragment.courseCode}\u0000${section}`;
      let course = grouped.get(key);
      if (!course) {
        course = {
          course_code:fragment.courseCode,
          title:fragment.title || fragment.courseCode,
          meetings:[]
        };
        if (fragment.units !== undefined) course.units = fragment.units;
        if (section) course.section = section;
        if (fragment.status) course.status = fragment.status;
        grouped.set(key, course);
      }
      canonicalMeetings(fragment).forEach((meeting) => pushUniqueMeeting(course.meetings, meeting));
    });
    return Array.from(grouped.values());
  }

  function canonicalCompletedCourses(entries) {
    const grouped = new Map();
    entries.filter((entry) => entry.bucket === "completed").forEach(({fragment}) => {
      const course = {
        course_code:fragment.courseCode,
        result_scope:"completion_only"
      };
      if (fragment.units !== undefined) course.units = fragment.units;
      grouped.set(fragment.courseCode, {...(grouped.get(fragment.courseCode) || {}), ...course});
    });
    return Array.from(grouped.values());
  }

  function canonicalCatalogueCourses(entries) {
    const grouped = new Map();
    entries.filter((entry) => entry.bucket === "catalogue").forEach(({fragment}) => {
      let holder = grouped.get(fragment.courseCode);
      if (!holder) {
        const course = {
          course_code:fragment.courseCode,
          title:fragment.title || fragment.courseCode
        };
        if (fragment.units !== undefined) course.units = fragment.units;
        if (fragment.teachingMedium) course.teaching_medium = fragment.teachingMedium;
        if (fragment.prerequisite) course.prerequisite_text = fragment.prerequisite;
        if (fragment.corequisite) course.corequisite_text = fragment.corequisite;
        if (fragment.targetStudents) course.target_students = fragment.targetStudents;
        holder = {course, sections:new Map()};
        grouped.set(fragment.courseCode, holder);
      }
      const sectionName = safeCellValue(fragment.section);
      if (!sectionName) return;
      let section = holder.sections.get(sectionName);
      if (!section) {
        section = {section:sectionName, meetings:[]};
        holder.sections.set(sectionName, section);
      }
      canonicalMeetings(fragment).forEach((meeting) => pushUniqueMeeting(section.meetings, meeting));
    });
    return Array.from(grouped.values()).map(({course, sections}) => {
      if (sections.size) course.sections = Array.from(sections.values());
      return course;
    });
  }

  function isCompletedRequirement(requirement) {
    return /^(?:complete|completed|fulfilled|satisfied|met|已完成|完成|已滿足|已满足)$/iu
      .test(normalizeWhitespace(requirement.status));
  }

  function canonicalRequirements(fragments) {
    return fragments
      .filter((fragment) => fragment.type === "requirement" && !isCompletedRequirement(fragment))
      .map((fragment) => {
        const group = safeCellValue(fragment.category);
        const portalText = safeCellValue(fragment.description);
        const requirement = {
          requirement_id:requirementId(`${group}\u0000${portalText}`),
          portal_text:portalText
        };
        requirement.group = group || "Unclassified requirement";
        if (fragment.requiredUnits !== undefined) requirement.units_required = fragment.requiredUnits;
        if (fragment.requiredUnits !== undefined && fragment.completedUnits !== undefined) {
          requirement.units_remaining = Math.max(0, fragment.requiredUnits - fragment.completedUnits);
        } else if (fragment.requiredUnits !== undefined) {
          requirement.units_remaining = fragment.requiredUnits;
        }
        const allowedCourseCodes = Array.from(new Set(
          Array.from(portalText.toLocaleUpperCase("en").matchAll(new RegExp(COURSE_IN_TEXT_PATTERN.source, "gu")))
            .map((match) => normalizeCourseCode(match[1]))
            .filter(Boolean)
        ));
        if (allowedCourseCodes.length) requirement.allowed_course_codes = allowedCourseCodes;
        return requirement;
      });
  }

  function requirementId(value) {
    let hash = 2166136261;
    for (const character of value) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return `portal_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function canonicalAcademicProfile(fragments) {
    const profile = {};
    fragments.filter((fragment) => fragment.type === "academic_profile").forEach((fragment) => {
      if (fragment.programme) profile.programme = fragment.programme;
      if (fragment.major) profile.major = fragment.major;
      if (fragment.studyYear) {
        const match = safeCellValue(fragment.studyYear).match(/\b([1-8])\b/u);
        if (match) profile.study_year = Number(match[1]);
      }
      if (fragment.catalogueYear) profile.catalogue_year = fragment.catalogueYear;
      if (fragment.degreeLevel) profile.degree_level = fragment.degreeLevel;
    });
    return profile;
  }

  function inferTerm(fragments, metadata) {
    const terms = Array.from(new Set([
      ...termTokens(metadata.term),
      ...fragments.flatMap((fragment) => termTokens(fragment.term))
    ]));
    return terms.length === 1 ? terms[0] : "unknown";
  }

  function validSnapshot(snapshot) {
    return Boolean(
      snapshot
      && typeof snapshot === "object"
      && snapshot.schema_version === SCHEMA_VERSION
      && snapshot.source?.institution === "hkbu"
      && snapshot.source?.mode === "user_portal_import"
    );
  }

  function canonicalMeetingCopy(value) {
    if (!value || typeof value !== "object") return null;
    const days = Array.from(new Set(
      (Array.isArray(value.days) ? value.days : [])
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 6)
    )).sort((a, b) => a - b);
    const start = canonicalClock(value.start);
    const end = canonicalClock(value.end);
    if (!days.length || !start || !end || end <= start) return null;
    const meeting = {days, start, end, venue:null};
    const venue = safeCellValue(value.venue);
    if (venue) meeting.venue = venue;
    return meeting;
  }

  function mergeMeetingLists(existing, incoming) {
    const meetings = [];
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach((value) => pushUniqueMeeting(meetings, canonicalMeetingCopy(value)));
    return meetings.slice(0, 30);
  }

  function mergeAssignedCourses(existing, incoming) {
    const grouped = new Map();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach((course) => {
        if (!course || typeof course !== "object") return;
        const courseCode = normalizeCourseCode(course.course_code);
        if (!courseCode) return;
        const section = safeCellValue(course.section);
        const key = `${courseCode}\u0000${section}`;
        const previous = grouped.get(key);
        const merged = {
          course_code:courseCode,
          title:safeCellValue(course.title) || previous?.title || courseCode,
          meetings:mergeMeetingLists(previous?.meetings, course.meetings)
        };
        const units = parseNumber(course.units);
        const status = safeCellValue(course.status);
        if (units !== undefined) merged.units = units;
        else if (previous?.units !== undefined) merged.units = previous.units;
        if (section) merged.section = section;
        if (status) merged.status = status;
        else if (previous?.status) merged.status = previous.status;
        grouped.set(key, merged);
      });
    return Array.from(grouped.values()).slice(0, 200);
  }

  function mergeCompletedCourses(existing, incoming) {
    const grouped = new Map();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach((course) => {
        if (!course || typeof course !== "object") return;
        const courseCode = normalizeCourseCode(course.course_code);
        if (!courseCode) return;
        const merged = {course_code:courseCode, result_scope:"completion_only"};
        const units = parseNumber(course.units);
        if (units !== undefined) merged.units = units;
        else if (grouped.get(courseCode)?.units !== undefined) merged.units = grouped.get(courseCode).units;
        grouped.set(courseCode, merged);
      });
    return Array.from(grouped.values()).slice(0, MAX_FRAGMENTS);
  }

  function mergeCatalogueCourses(existing, incoming) {
    const grouped = new Map();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach((course) => {
        if (!course || typeof course !== "object") return;
        const courseCode = normalizeCourseCode(course.course_code);
        if (!courseCode) return;
        let holder = grouped.get(courseCode);
        if (!holder) {
          holder = {course:{course_code:courseCode, title:courseCode}, sections:new Map()};
          grouped.set(courseCode, holder);
        }
        const title = safeCellValue(course.title);
        const units = parseNumber(course.units);
        if (title) holder.course.title = title;
        if (units !== undefined) holder.course.units = units;
        [
          ["teaching_medium", "teaching_medium"],
          ["prerequisite_text", "prerequisite_text"],
          ["corequisite_text", "corequisite_text"],
          ["target_students", "target_students"]
        ].forEach(([source, destination]) => {
          const value = safeCellValue(course[source]);
          if (value) holder.course[destination] = value;
        });
        (Array.isArray(course.sections) ? course.sections : []).forEach((candidate) => {
          const sectionName = safeCellValue(candidate?.section);
          if (!sectionName) return;
          const previous = holder.sections.get(sectionName);
          holder.sections.set(sectionName, {
            section:sectionName,
            meetings:mergeMeetingLists(previous?.meetings, candidate.meetings)
          });
        });
      });
    return Array.from(grouped.values()).slice(0, 2000).map(({course, sections}) => {
      if (sections.size) course.sections = Array.from(sections.values());
      return course;
    });
  }

  function mergeRequirements(existing, incoming) {
    const grouped = new Map();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach((requirement) => {
        if (!requirement || typeof requirement !== "object") return;
        const requirementIdValue = safeCellValue(requirement.requirement_id);
        const portalText = safeCellValue(requirement.portal_text);
        if (!requirementIdValue || !portalText) return;
        const merged = {requirement_id:requirementIdValue, portal_text:portalText};
        const group = safeCellValue(requirement.group);
        const unitsRequired = parseNumber(requirement.units_required);
        const unitsRemaining = parseNumber(requirement.units_remaining);
        const allowedCourseCodes = Array.from(new Set(
          (Array.isArray(requirement.allowed_course_codes) ? requirement.allowed_course_codes : [])
            .map(normalizeCourseCode)
            .filter(Boolean)
        ));
        if (group) merged.group = group;
        if (unitsRequired !== undefined) merged.units_required = unitsRequired;
        if (unitsRemaining !== undefined) merged.units_remaining = unitsRemaining;
        if (allowedCourseCodes.length) merged.allowed_course_codes = allowedCourseCodes;
        grouped.set(requirementIdValue, {...(grouped.get(requirementIdValue) || {}), ...merged});
      });
    return Array.from(grouped.values()).slice(0, 500);
  }

  function mergeUniqueStrings(existing, incoming, limit = MAX_MERGED_PAGES) {
    const output = [];
    const seen = new Set();
    [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
      .forEach((value) => {
        const safe = safeCellValue(value);
        if (!PAGE_KINDS.has(safe) || seen.has(safe) || output.length >= limit) return;
        seen.add(safe);
        output.push(safe);
      });
    return output;
  }

  function mergedTerm(existing, incoming) {
    const terms = new Set(
      [existing, incoming]
        .map((term) => safeCellValue(term))
        .filter((term) => term && term !== "unknown")
    );
    if (terms.size === 1) return Array.from(terms)[0];
    if (terms.size > 1) return "unknown";
    return "unknown";
  }

  function latestTimestamp(existing, incoming) {
    const values = [existing, incoming]
      .map((value) => ({value:safeCellValue(value), time:Date.parse(value)}))
      .filter((entry) => entry.value && Number.isFinite(entry.time))
      .sort((a, b) => b.time - a.time);
    return values[0]?.value || new Date().toISOString();
  }

  function mergeSnapshots(existing, incoming) {
    if (!validSnapshot(incoming)) return validSnapshot(existing) ? existing : null;
    if (!validSnapshot(existing)) return incoming;

    const assignedCourses = mergeAssignedCourses(existing.assigned_courses, incoming.assigned_courses);
    const completedCourses = mergeCompletedCourses(existing.completed_courses, incoming.completed_courses);
    const catalogueCourses = mergeCatalogueCourses(existing.catalogue_courses, incoming.catalogue_courses);
    const remainingRequirements = mergeRequirements(
      existing.remaining_requirements,
      incoming.remaining_requirements
    );
    const pages = mergeUniqueStrings(existing.source?.pages, incoming.source?.pages);
    const academicProfile = {};
    [existing.academic_profile, incoming.academic_profile].forEach((profile) => {
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) return;
      ["programme", "major", "catalogue_year", "degree_level"].forEach((key) => {
        const value = safeCellValue(profile[key]);
        if (value) academicProfile[key] = value;
      });
      const studyYear = Number(profile.study_year);
      if (Number.isInteger(studyYear) && studyYear >= 1 && studyYear <= 8) {
        academicProfile.study_year = studyYear;
      }
    });

    const merged = {
      schema_version:SCHEMA_VERSION,
      source:{
        institution:"hkbu",
        mode:"user_portal_import",
        captured_at:latestTimestamp(existing.source?.captured_at, incoming.source?.captured_at),
        term:mergedTerm(existing.source?.term, incoming.source?.term),
        parser_version:"hkbu-browser-helper/0.1.0",
        pages
      },
      academic_profile:academicProfile,
      assigned_courses:assignedCourses,
      completed_courses:completedCourses,
      remaining_requirements:remainingRequirements
    };
    if (catalogueCourses.length) merged.catalogue_courses = catalogueCourses;
    return merged;
  }

  function parseSerializedTables(tables, metadata = {}) {
    const origin = String(metadata.origin || "");
    if (!supportedOrigin(origin)) {
      return {ok:false, code:"unsupported_origin"};
    }
    if (!Array.isArray(tables) || !tables.length) {
      return {ok:false, code:"unsupported_structure"};
    }

    const fragments = [];
    const courseEntries = [];
    const dedupe = new Set();
    let recognisedTables = 0;

    for (const table of tables.slice(0, MAX_TABLES)) {
      const headers = Array.isArray(table?.headers) ? table.headers : [];
      const rows = Array.isArray(table?.rows) ? table.rows : [];
      const classification = classifyHeaders(headers);
      if (classification.kind === "unknown") continue;
      recognisedTables += 1;

      for (const values of rows.slice(0, MAX_ROWS)) {
        if (!Array.isArray(values) || values.length !== headers.length) continue;
        const row = rowObject(values, classification.mapping);
        const fragment = classification.kind === "course"
          ? courseFragment(row)
          : classification.kind === "requirement"
            ? requirementFragment(row)
            : profileFragment(row);
        if (!fragment) continue;
        const bucket = fragment.type === "course" ? courseBucket(classification) : fragment.type;
        const identity = `${bucket}:${JSON.stringify(fragment)}`;
        if (dedupe.has(identity)) continue;
        dedupe.add(identity);
        fragments.push(fragment);
        if (fragment.type === "course") courseEntries.push({bucket, fragment});
        if (fragments.length >= MAX_FRAGMENTS) break;
      }
      if (fragments.length >= MAX_FRAGMENTS) break;
    }

    if (!recognisedTables || !fragments.length) {
      return {ok:false, code:"unsupported_structure"};
    }

    const capturedAt = Number.isNaN(Date.parse(metadata.capturedAt))
      ? new Date().toISOString()
      : new Date(metadata.capturedAt).toISOString();
    const pageKinds = pageKindsFor(fragments, courseEntries);
    const assignedCourses = canonicalAssignedCourses(courseEntries);
    const completedCourses = canonicalCompletedCourses(courseEntries);
    const catalogueCourses = canonicalCatalogueCourses(courseEntries);

    const payload = {
      schema_version:SCHEMA_VERSION,
      source:{
        institution:"hkbu",
        mode:"user_portal_import",
        captured_at:capturedAt,
        term:inferTerm(fragments, metadata),
        parser_version:"hkbu-browser-helper/0.1.0",
        pages:pageKinds
      },
      academic_profile:canonicalAcademicProfile(fragments),
      assigned_courses:assignedCourses,
      completed_courses:completedCourses,
      remaining_requirements:canonicalRequirements(fragments)
    };
    if (catalogueCourses.length) payload.catalogue_courses = catalogueCourses;

    return {
      ok:true,
      payload
    };
  }

  function isElementVisible(element, view) {
    if (!element || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false;
    if (element.closest?.("[hidden], [aria-hidden='true']")) return false;
    const style = view?.getComputedStyle?.(element);
    if (style && (
      style.display === "none"
      || style.visibility === "hidden"
      || style.visibility === "collapse"
      || style.opacity === "0"
    )) return false;
    if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return false;
    return true;
  }

  function visibleCellIndexes(row, view) {
    return Array.from(row?.cells || [])
      .map((cell, index) => ({cell, index}))
      .filter(({cell}) => isElementVisible(cell, view))
      .map(({index}) => index);
  }

  function cellText(cell) {
    return normalizeWhitespace(cell?.innerText ?? cell?.textContent ?? "");
  }

  function academicYear(startValue, endValue) {
    const start = Number(startValue);
    let end = Number(endValue);
    if (!Number.isInteger(start) || start < 2000 || start > 2099) return "";
    if (String(endValue).length === 2) {
      end += Math.floor(start / 100) * 100;
      if (end < start) end += 100;
    }
    if (end !== start + 1) return "";
    return `${start}-${String(end).slice(-2)}`;
  }

  function termNumber(value) {
    const normalized = String(value || "").toLocaleLowerCase("en");
    return {
      "1":"1",
      "2":"2",
      "3":"3",
      one:"1",
      two:"2",
      three:"3",
      i:"1",
      ii:"2",
      iii:"3"
    }[normalized] || "";
  }

  function termLabel(value) {
    const normalized = String(value || "").toLocaleLowerCase("en");
    if (normalized === "trimester") return "Trimester";
    if (normalized === "term") return "Term";
    return "Semester";
  }

  function termTokens(value) {
    const text = safeCellValue(value);
    if (!text) return [];
    const tokens = [];
    const patterns = [
      /\b(semester|sem|trimester|term)\s*(1|2|3|one|two|three|i|ii|iii)\s*[,():-]?\s*(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})\b/giu,
      /\b(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})\s*[,():-]?\s*(semester|sem|trimester|term)\s*(1|2|3|one|two|three|i|ii|iii)\b/giu
    ];
    for (const [index, pattern] of patterns.entries()) {
      for (const match of text.matchAll(pattern)) {
        const label = termLabel(index === 0 ? match[1] : match[3]);
        const number = termNumber(index === 0 ? match[2] : match[4]);
        const year = academicYear(index === 0 ? match[3] : match[1], index === 0 ? match[4] : match[2]);
        if (!number || !year) continue;
        const token = `${label} ${number} ${year}`;
        if (!tokens.includes(token)) tokens.push(token);
      }
    }
    return tokens;
  }

  function inferVisibleTerm(documentObject) {
    const view = documentObject?.defaultView || globalThis.window;
    const candidates = [];
    Array.from(documentObject?.querySelectorAll?.("select") || []).slice(0, 20).forEach((select) => {
      if (!isElementVisible(select, view)) return;
      Array.from(select.selectedOptions || select.options || [])
        .filter((option) => option.selected !== false)
        .slice(0, 3)
        .forEach((option) => candidates.push(cellText(option)));
    });
    Array.from(
      documentObject?.querySelectorAll?.("caption,h1,h2,h3,h4,[role='heading']") || []
    )
      .filter((element) => isElementVisible(element, view))
      .slice(0, 80)
      .forEach((element) => candidates.push(cellText(element)));

    const tokens = Array.from(new Set(candidates.flatMap(termTokens)));
    return tokens.length === 1 ? tokens[0] : "";
  }

  function serializeVisibleTables(documentObject) {
    const view = documentObject?.defaultView || globalThis.window;
    const candidates = Array.from(documentObject?.querySelectorAll?.("table") || [])
      .filter((table) => !table.parentElement?.closest?.("table"))
      .filter((table) => isElementVisible(table, view))
      .slice(0, MAX_TABLES);
    const serialized = [];
    let totalRows = 0;

    for (const table of candidates) {
      const visibleRows = Array.from(table.rows || []).filter((row) => isElementVisible(row, view));
      if (visibleRows.length < 2) continue;

      const profilePairs = {};
      visibleRows.forEach((row) => {
        const indexes = visibleCellIndexes(row, view);
        if (indexes.length < 2) return;
        const field = FIELD_BY_ALIAS.get(normalizeHeader(cellText(row.cells[indexes[0]])));
        if (!["programme", "major", "studyYear", "catalogueYear", "degreeLevel"].includes(field)) return;
        const value = cellText(row.cells[indexes[1]]);
        if (value && !profilePairs[field]) profilePairs[field] = value;
      });
      if (Object.keys(profilePairs).length >= 2) {
        const headers = Object.keys(profilePairs);
        serialized.push({headers, rows:[headers.map((field) => profilePairs[field])]});
        totalRows += 1;
        if (totalRows >= MAX_ROWS) break;
        continue;
      }

      let headerIndex = -1;
      let headerCellIndexes = [];
      let headers = [];
      let bestScore = 0;
      visibleRows.slice(0, 5).forEach((row, index) => {
        const indexes = visibleCellIndexes(row, view);
        const candidateHeaders = indexes.map((cellIndex) => cellText(row.cells[cellIndex]));
        const classification = classifyHeaders(candidateHeaders);
        if (classification.kind !== "unknown" && classification.score > bestScore) {
          headerIndex = index;
          headerCellIndexes = indexes;
          headers = candidateHeaders;
          bestScore = classification.score;
        }
      });
      if (headerIndex < 0 || !headers.length) continue;

      const rows = [];
      for (const row of visibleRows.slice(headerIndex + 1)) {
        if (totalRows >= MAX_ROWS) break;
        const cells = Array.from(row.cells || []);
        if (!headerCellIndexes.every((index) => cells[index] && isElementVisible(cells[index], view))) continue;
        const values = headerCellIndexes.map((index) => cellText(cells[index]));
        if (values.some(Boolean)) {
          rows.push(values);
          totalRows += 1;
        }
      }
      if (rows.length) serialized.push({headers, rows});
      if (totalRows >= MAX_ROWS) break;
    }

    return serialized;
  }

  function scanDocument(documentObject, metadata = {}) {
    const origin = String(metadata.origin || documentObject?.location?.origin || "");
    const explicitTerms = Array.from(new Set(termTokens(metadata.term)));
    const term = explicitTerms.length === 1 ? explicitTerms[0] : inferVisibleTerm(documentObject);
    return parseSerializedTables(
      serializeVisibleTables(documentObject),
      {origin, capturedAt:metadata.capturedAt || new Date().toISOString(), term}
    );
  }

  globalThis.HKBUPortalParser = Object.freeze({
    SCHEMA,
    SCHEMA_VERSION,
    classifyHeaders,
    parseSerializedTables,
    mergeSnapshots,
    safeCellValue,
    inferVisibleTerm,
    scanDocument,
    serializeVisibleTables,
    supportedOrigin
  });
})();
