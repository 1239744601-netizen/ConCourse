const BASE_COPY = Object.freeze({
  en: Object.freeze({
    brandTag: "Conquer your course registrations",
    primaryDestinations: "Primary destinations",
    timetable: "Timetable",
    exploreCourses: "Course Engine",
    selectionAssistant: "Course Selection Assistant",
    courseKeys: "CourseKeys",
    appearance: "Page appearance",
    useDay: "Use day appearance",
    useNight: "Use night appearance",
    day: "Day",
    night: "Night",
    language: "Website language",
    search: "Search"
  }),
  "zh-CN": Object.freeze({
    brandTag: "轻松规划课程注册",
    primaryDestinations: "主要功能",
    timetable: "课表",
    exploreCourses: "课程引擎",
    selectionAssistant: "选课助手",
    courseKeys: "课程资源库",
    appearance: "页面外观",
    useDay: "使用日间外观",
    useNight: "使用夜间外观",
    day: "日间",
    night: "夜间",
    language: "网站语言",
    search: "搜索"
  }),
  "zh-HK": Object.freeze({
    brandTag: "輕鬆規劃課程註冊",
    primaryDestinations: "主要功能",
    timetable: "時間表",
    exploreCourses: "課程引擎",
    selectionAssistant: "選科助手",
    courseKeys: "課程資源庫",
    appearance: "頁面外觀",
    useDay: "使用日間外觀",
    useNight: "使用夜間外觀",
    day: "日間",
    night: "夜間",
    language: "網站語言",
    search: "搜尋"
  })
});

export const COURSE_CATALOGUE_URL = new URL(
  "../coursekeys/data/course-catalogue.json",
  import.meta.url
);

export const HKBU_CATALOGUE_MANIFEST_URL = new URL(
  "../data/hkbu-catalogue-current.json",
  import.meta.url
);

export const COURSEKEYS_READINESS_URL = new URL(
  "../api/coursekeys/resources",
  import.meta.url
);

const OFFICIAL_REFERENCE_HOSTS = Object.freeze({
  bnbu: Object.freeze(["ispace.uic.edu.cn"]),
  hkbu: Object.freeze(["arcourseoutline.hkbu.edu.hk"])
});

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function extractCourseCode(title) {
  const matches = String(title || "").match(/\b[A-Z]{2,8}\s?\d{3,5}[A-Z]?\b/gi);
  return matches?.[0]?.replace(/\s+/g, "").toUpperCase() || "";
}

export function courseRecordId(course) {
  return `${String(course?.institutionId || "unknown")}:${String(course?.sourceCourseId || "")}`;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeRules(rules) {
  return (Array.isArray(rules) ? rules : [])
    .map((rule) => ({
      condition: clean(rule?.condition),
      studyProgramme: clean(rule?.study_programme || rule?.studyProgramme),
      studyYear: clean(rule?.study_year || rule?.studyYear),
      basisOfAdmission: clean(rule?.basis_of_admission || rule?.basisOfAdmission)
    }))
    .filter((rule) => Object.values(rule).some(Boolean));
}

export function isLocalCourseReviewLocation(locationLike = globalThis.location) {
  const hostname = String(locationLike?.hostname || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/^\[|\]$/g, "");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export function safeOfficialUrl(value, institutionId) {
  try {
    const url = new URL(String(value || ""));
    const allowedHosts = OFFICIAL_REFERENCE_HOSTS[clean(institutionId).toLocaleLowerCase()] || [];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !allowedHosts.includes(url.hostname.toLocaleLowerCase())
    ) {
      return "";
    }
    return url.href;
  } catch (_error) {
    return "";
  }
}

export function adaptCourseKeysCatalogue(catalogue) {
  if (!catalogue || !Array.isArray(catalogue.courses)) {
    throw new Error("CourseKeys catalogue response is invalid");
  }

  const institutionStatus = new Map(
    (Array.isArray(catalogue.institutions) ? catalogue.institutions : [])
      .map((institution) => [clean(institution?.id), clean(institution?.status)])
  );
  const notice = clean(catalogue.dataAvailability?.notice);
  const capturedAt = clean(catalogue.generatedDate);

  return catalogue.courses.map((course) => {
    const institutionId = clean(course?.institutionId) || "bnbu";
    const sourceCourseId = clean(course?.sourceCourseId);
    const courseKeysKey = sourceCourseId ? `${institutionId}:${sourceCourseId}` : "";
    const sections = unique(
      (Array.isArray(course?.sections) ? course.sections : []).map(clean)
    );
    const instructor = clean(course?.instructor);

    return {
      institutionId,
      institutionName: clean(course?.institutionName),
      institutionShortName: clean(course?.institutionShortName),
      sourceCourseId,
      courseCode: clean(course?.courseCode) || extractCourseCode(course?.title),
      courseKey: courseKeysKey,
      courseKeysKey,
      title: clean(course?.title || course?.displayName),
      alternateTitles: unique([clean(course?.displayName)]),
      faculty: clean(course?.faculty),
      academicPeriod: clean(course?.academicPeriod),
      academicYear: clean(course?.academicYear),
      units: clean(course?.units),
      level: clean(course?.level),
      unitCode: clean(course?.unitCode),
      teachingMedium: clean(course?.teachingMedium),
      description: clean(course?.description),
      prerequisiteText: clean(course?.prerequisiteText),
      corequisiteText: clean(course?.corequisiteText),
      targetStudents: clean(course?.targetStudents),
      prerequisiteRules: normalizeRules(course?.prerequisiteRules),
      corequisiteRules: normalizeRules(course?.corequisiteRules),
      sections,
      sectionDetails: sections.map((section) => ({
        section,
        instructor,
        dayTime: "",
        teachingMedium: "",
        remarks: ""
      })),
      instructor,
      officialUrl: safeOfficialUrl(course?.officialUrl, institutionId),
      summaryUrl: safeOfficialUrl(course?.summaryUrl, institutionId),
      courseType: clean(course?.courseType),
      remedial: course?.remedial === true,
      sourceLabel: clean(course?.sourceLabel) || "CourseKeys catalogue",
      sourceStatus: institutionStatus.get(institutionId) || "reference",
      sourceMode: "public_reference_catalogue",
      sourceCapturedAt: capturedAt,
      sourceCaveats: notice ? [notice] : []
    };
  });
}

function validateHkbuSnapshot(catalogue, manifest) {
  if (
    !catalogue ||
    !manifest ||
    Number(catalogue.schema_version) !== Number(manifest.schema_version) ||
    clean(catalogue.institution) !== "hkbu" ||
    clean(manifest.institution) !== "hkbu" ||
    clean(catalogue.term) !== clean(manifest.term) ||
    clean(catalogue.captured_at) !== clean(manifest.captured_at) ||
    clean(catalogue.publication_status) !== "reference_only" ||
    clean(manifest.publication_status) !== "reference_only" ||
    clean(catalogue.source_mode) !== "authenticated_developer_snapshot" ||
    !Array.isArray(catalogue.courses) ||
    Number(catalogue.counts?.courses) !== Number(manifest.course_count) ||
    Number(catalogue.counts?.sections) !== Number(manifest.section_count) ||
    catalogue.courses.length !== Number(manifest.course_count)
  ) {
    throw new Error("HKBU local snapshot metadata does not match its manifest");
  }

  const sectionCount = catalogue.courses.reduce(
    (count, course) => count + (Array.isArray(course?.sections) ? course.sections.length : 0),
    0
  );
  if (sectionCount !== Number(manifest.section_count)) {
    throw new Error("HKBU local snapshot section count does not match its manifest");
  }
}

export function adaptHkbuCatalogue(catalogue, manifest) {
  validateHkbuSnapshot(catalogue, manifest);

  return catalogue.courses.map((course) => {
    const courseCode = clean(course?.course_code).toUpperCase();
    if (!courseCode || !clean(course?.title)) {
      throw new Error("HKBU local snapshot contains an invalid course record");
    }

    const sectionDetails = (Array.isArray(course?.sections) ? course.sections : [])
      .map((section) => ({
        section: clean(section?.section),
        instructor: clean(section?.instructor),
        dayTime: clean(section?.day_time),
        teachingMedium: clean(section?.teaching_medium),
        remarks: clean(section?.remarks)
      }));
    const instructors = unique(sectionDetails.map((section) => section.instructor));

    return {
      institutionId: "hkbu",
      institutionName: "Hong Kong Baptist University",
      institutionShortName: "HKBU",
      sourceCourseId: courseCode,
      courseCode,
      courseKey: `hkbu:${courseCode}`,
      courseKeysKey: "",
      title: clean(course?.title),
      alternateTitles: unique([clean(course?.chinese_title)]),
      faculty: clean(course?.academic_group),
      academicPeriod: clean(catalogue.term),
      academicYear: "",
      units: clean(course?.units),
      level: clean(course?.level),
      unitCode: clean(course?.unit_code),
      teachingMedium: clean(course?.teaching_medium),
      description: clean(course?.description),
      prerequisiteText: clean(course?.prerequisite_text),
      corequisiteText: clean(course?.corequisite_text),
      targetStudents: clean(course?.target_students),
      prerequisiteRules: normalizeRules(course?.prerequisite_rules),
      corequisiteRules: normalizeRules(course?.corequisite_rules),
      sections: unique(sectionDetails.map((section) => section.section)),
      sectionDetails,
      instructor: instructors.join(", "),
      officialUrl: safeOfficialUrl(course?.outline_url, "hkbu"),
      summaryUrl: "",
      courseType: "",
      remedial: false,
      sourceLabel: "HKBU authenticated local snapshot",
      sourceStatus: "reference_only · local review",
      sourceMode: clean(catalogue.source_mode),
      sourceCapturedAt: clean(catalogue.captured_at),
      sourceCaveats: unique((Array.isArray(catalogue.caveats) ? catalogue.caveats : []).map(clean))
    };
  });
}

export function groupCourseRecords(records) {
  const groups = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const title = clean(record?.title || record?.displayName);
    if (!title) continue;
    const institutionId = clean(record.institutionId) || "unknown";
    const academicPeriod = clean(record.academicPeriod);
    const courseCode = clean(record.courseCode) || extractCourseCode(title);
    const courseIdentity = courseCode
      ? `code:${normalizeSearchText(courseCode)}`
      : `title:${normalizeSearchText(title)}`;
    const key = [
      institutionId,
      courseIdentity,
      normalizeSearchText(academicPeriod)
    ].join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        courseKey: clean(record.courseKey) || courseRecordId(record),
        courseKeysKey: clean(record.courseKeysKey),
        institutionId,
        institutionName: clean(record.institutionName),
        institutionShortName: clean(record.institutionShortName),
        title,
        alternateTitles: unique((Array.isArray(record.alternateTitles) ? record.alternateTitles : []).map(clean)),
        code: courseCode,
        faculty: clean(record.faculty),
        academicPeriod,
        academicYear: clean(record.academicYear),
        units: clean(record.units),
        level: clean(record.level),
        unitCode: clean(record.unitCode),
        teachingMedium: clean(record.teachingMedium),
        description: clean(record.description),
        prerequisiteText: clean(record.prerequisiteText),
        corequisiteText: clean(record.corequisiteText),
        targetStudents: clean(record.targetStudents),
        prerequisiteRules: Array.isArray(record.prerequisiteRules) ? record.prerequisiteRules : [],
        corequisiteRules: Array.isArray(record.corequisiteRules) ? record.corequisiteRules : [],
        sourceLabel: clean(record.sourceLabel),
        sourceStatus: clean(record.sourceStatus),
        sourceMode: clean(record.sourceMode),
        sourceCapturedAt: clean(record.sourceCapturedAt),
        sourceCaveats: unique((Array.isArray(record.sourceCaveats) ? record.sourceCaveats : []).map(clean)),
        entries: []
      });
    }

    const group = groups.get(key);
    group.entries.push({
      id: courseRecordId(record),
      courseKey: clean(record.courseKey) || courseRecordId(record),
      courseKeysKey: clean(record.courseKeysKey),
      sourceCourseId: clean(record.sourceCourseId),
      sections: unique((Array.isArray(record.sections) ? record.sections : []).map(clean)),
      sectionDetails: (Array.isArray(record.sectionDetails) ? record.sectionDetails : [])
        .map((section) => ({
          section: clean(section?.section),
          instructor: clean(section?.instructor),
          dayTime: clean(section?.dayTime),
          teachingMedium: clean(section?.teachingMedium),
          remarks: clean(section?.remarks)
        })),
      instructor: clean(record.instructor),
      officialUrl: safeOfficialUrl(record.officialUrl, institutionId),
      summaryUrl: safeOfficialUrl(record.summaryUrl, institutionId),
      courseType: clean(record.courseType),
      remedial: record.remedial === true
    });
  }

  return [...groups.values()]
    .map((group) => {
      const sectionInstructors = unique(
        group.entries.flatMap((entry) =>
          entry.sectionDetails.map((section) => section.instructor)
        )
      );

      return {
        ...group,
        courseKeysKey:
          group.courseKeysKey ||
          group.entries.find((entry) => entry.courseKeysKey)?.courseKeysKey ||
          "",
        // Rich records can contain a convenient comma-joined instructor summary
        // as well as the individual section instructors. Prefer the section
        // values so the same names are not rendered twice in course details.
        instructors: sectionInstructors.length
          ? sectionInstructors
          : unique(group.entries.map((entry) => entry.instructor)),
        sections: unique(group.entries.flatMap((entry) => entry.sections)),
        sourceCourseIds: unique(group.entries.map((entry) => entry.sourceCourseId))
      };
    })
    .sort((left, right) =>
      left.title.localeCompare(right.title) ||
      left.academicPeriod.localeCompare(right.academicPeriod)
    );
}

function matchScore(group, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;
  const compactQuery = normalizedQuery.replace(/\s+/g, "").toUpperCase();
  const title = normalizeSearchText(group.title);
  const code = String(group.code || "").toUpperCase();
  const sourceIds = group.sourceCourseIds.map((value) => normalizeSearchText(value));
  const faculty = normalizeSearchText(group.faculty);
  const instructor = normalizeSearchText(group.instructors.join(" "));
  const period = normalizeSearchText(group.academicPeriod);
  const institution = normalizeSearchText(
    `${group.institutionName} ${group.institutionShortName}`
  );
  const sections = normalizeSearchText(group.sections.join(" "));
  const richMetadata = normalizeSearchText([
    group.alternateTitles?.join(" "),
    group.description,
    group.prerequisiteText,
    group.corequisiteText,
    group.targetStudents,
    group.units,
    group.level,
    group.unitCode,
    group.teachingMedium,
    group.sourceLabel
  ].join(" "));
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = [
    title,
    code.toLowerCase(),
    sourceIds.join(" "),
    faculty,
    instructor,
    period,
    institution,
    sections,
    richMetadata
  ].join(" ");
  const matchedTokens = tokens.filter((token) => haystack.includes(token));
  if (!matchedTokens.length) return null;
  if (tokens.length > 1 && matchedTokens.length !== tokens.length) return null;

  let score = matchedTokens.length * 55;
  let reason = "metadata";
  if (sourceIds.includes(normalizedQuery)) {
    score += 1200;
    reason = "source";
  }
  if (code && code === compactQuery) {
    score += 1150;
    reason = "code";
  } else if (code && code.startsWith(compactQuery)) {
    score += 850;
    reason = "code";
  }
  if (title === normalizedQuery) {
    score += 1100;
    reason = "title";
  } else if (title.startsWith(normalizedQuery)) {
    score += 820;
    reason = "title";
  } else if (title.includes(normalizedQuery)) {
    score += 620;
    reason = "title";
  } else if (faculty.includes(normalizedQuery)) {
    score += 430;
    reason = "faculty";
  } else if (instructor.includes(normalizedQuery)) {
    score += 410;
    reason = "instructor";
  } else if (period.includes(normalizedQuery)) {
    score += 380;
    reason = "period";
  }
  if (matchedTokens.length === tokens.length) score += 180;
  return { score, reason };
}

export function searchCourseGroups(groups, query, limit = 36) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 36));
  return rankCourseGroups(groups, query).slice(0, safeLimit);
}

function rankCourseGroups(groups, query) {
  return (Array.isArray(groups) ? groups : [])
    .map((group) => {
      const match = matchScore(group, query);
      return match ? { ...group, matchReason: match.reason, matchScore: match.score } : null;
    })
    .filter(Boolean)
    .sort((left, right) =>
      right.matchScore - left.matchScore ||
      right.academicPeriod.localeCompare(left.academicPeriod) ||
      left.title.localeCompare(right.title)
    );
}

export function searchCourseGroupsWithTotal(groups, query, limit = 36) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 36));
  const matches = rankCourseGroups(groups, query);
  return {
    items: matches.slice(0, safeLimit),
    total: matches.length
  };
}

async function requestJson(url, fetchImpl) {
  const response = await fetchImpl(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Course catalogue request failed (${response.status})`);
  }
  return response.json();
}

function validatedHkbuCatalogueUrl(manifest) {
  const manifestDirectory = new URL("./", HKBU_CATALOGUE_MANIFEST_URL);
  const catalogueUrl = new URL(clean(manifest?.catalogue_url), manifestDirectory);
  const filename = catalogueUrl.pathname.split("/").pop() || "";
  if (
    catalogueUrl.origin !== HKBU_CATALOGUE_MANIFEST_URL.origin ||
    !catalogueUrl.href.startsWith(manifestDirectory.href) ||
    catalogueUrl.search ||
    catalogueUrl.hash ||
    !/^[A-Za-z0-9._-]+\.json$/.test(filename)
  ) {
    throw new Error("HKBU local snapshot manifest points outside its review directory");
  }
  return catalogueUrl;
}

async function sha256Hex(text, cryptoLike) {
  if (!cryptoLike?.subtle || typeof TextEncoder === "undefined") {
    throw new Error("HKBU local snapshot cannot be authenticated in this browser");
  }
  const digest = await cryptoLike.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadHkbuLocalSource(fetchImpl, cryptoLike) {
  const manifest = await requestJson(HKBU_CATALOGUE_MANIFEST_URL, fetchImpl);
  const catalogueUrl = validatedHkbuCatalogueUrl(manifest);
  const response = await fetchImpl(catalogueUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HKBU local snapshot request failed (${response.status})`);
  }
  const sourceText = await response.text();
  const expectedHash = clean(manifest.content_sha256).toLocaleLowerCase();
  const actualHash = await sha256Hex(sourceText, cryptoLike);
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || actualHash !== expectedHash) {
    throw new Error("HKBU local snapshot checksum does not match its manifest");
  }

  const catalogue = JSON.parse(sourceText);
  return adaptHkbuCatalogue(catalogue, manifest);
}

export async function loadCourseCatalogue({
  locationLike = globalThis.location,
  fetchImpl = globalThis.fetch,
  cryptoLike = globalThis.crypto
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Course catalogue fetch is unavailable");
  }

  const courses = [];
  const sources = [];
  try {
    const catalogue = await requestJson(COURSE_CATALOGUE_URL, fetchImpl);
    const records = adaptCourseKeysCatalogue(catalogue);
    courses.push(...records);
    sources.push({
      id: "coursekeys-public",
      label: "CourseKeys public reference catalogue",
      status: "loaded",
      recordCount: records.length,
      localOnly: false
    });
  } catch (error) {
    sources.push({
      id: "coursekeys-public",
      label: "CourseKeys public reference catalogue",
      status: "unavailable",
      recordCount: 0,
      localOnly: false,
      error: clean(error?.message)
    });
  }

  if (isLocalCourseReviewLocation(locationLike)) {
    try {
      const records = await loadHkbuLocalSource(fetchImpl, cryptoLike);
      courses.push(...records);
      sources.push({
        id: "hkbu-local-review",
        label: "HKBU authenticated local snapshot",
        status: "loaded",
        recordCount: records.length,
        localOnly: true
      });
    } catch (error) {
      sources.push({
        id: "hkbu-local-review",
        label: "HKBU authenticated local snapshot",
        status: "unavailable",
        recordCount: 0,
        localOnly: true,
        error: clean(error?.message)
      });
    }
  }

  if (!courses.length) {
    throw new Error("No course catalogue source could be loaded");
  }

  return {
    version: 2,
    courses,
    sources,
    groups: groupCourseRecords(courses)
  };
}

export async function loadCourseKeysReadiness(fetchImpl = globalThis.fetch) {
  const locked = {
    reachable: false,
    resourceStatus: "unavailable",
    integrationLocked: true,
    uploads: false,
    publishing: false,
    downloads: false,
    transactions: false,
    credits: false
  };
  if (typeof fetchImpl !== "function") return locked;

  try {
    const response = await fetchImpl(COURSEKEYS_READINESS_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return locked;
    await response.json();
    return {
      ...locked,
      reachable: true,
      resourceStatus: "read-only reference"
    };
  } catch (_error) {
    return locked;
  }
}

function mergeCopy(pageCopy) {
  const merged = {};
  for (const language of ["en", "zh-CN", "zh-HK"]) {
    merged[language] = Object.freeze({
      ...BASE_COPY[language],
      ...(pageCopy?.[language] || {})
    });
  }
  return Object.freeze(merged);
}

export function initializeCourseChrome(pageCopy, onLanguageChange = () => {}) {
  const copy = mergeCopy(pageCopy);
  let language = "en";

  const t = (key, variables = {}) => {
    let value = copy[language]?.[key] ?? copy.en[key] ?? key;
    for (const [name, replacement] of Object.entries(variables)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  };

  const setTheme = (theme) => {
    const nextTheme = theme === "day" ? "day" : "night";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme === "day" ? "light" : "dark";
    document.querySelectorAll("[data-theme-value]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeValue === nextTheme));
    });
    try {
      localStorage.setItem("concourse_theme", nextTheme);
    } catch (_error) {}
  };

  const applyLanguage = (requestedLanguage, notify = true) => {
    language = ["en", "zh-CN", "zh-HK"].includes(requestedLanguage)
      ? requestedLanguage
      : "en";
    document.documentElement.lang = language;
    document.querySelectorAll("[data-copy]").forEach((element) => {
      element.textContent = t(element.dataset.copy);
    });
    document.querySelectorAll("[data-copy-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.copyPlaceholder));
    });
    document.querySelectorAll("[data-copy-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.copyAria));
    });
    const languageSelect = document.getElementById("languageSelect");
    if (languageSelect) languageSelect.value = language;
    try {
      localStorage.setItem("concourse_language", language);
    } catch (_error) {}
    if (notify) onLanguageChange({ language, t });
  };

  document.querySelectorAll("[data-theme-value]").forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.themeValue));
  });

  document.getElementById("languageSelect")?.addEventListener("change", (event) => {
    applyLanguage(event.currentTarget.value);
  });

  let savedLanguage = "en";
  try {
    savedLanguage = localStorage.getItem("concourse_language") || "en";
  } catch (_error) {}
  setTheme(document.documentElement.dataset.theme);
  applyLanguage(savedLanguage, false);

  return Object.freeze({
    get language() {
      return language;
    },
    t,
    applyLanguage
  });
}

export function localeForLanguage(language) {
  if (language === "zh-CN") return "zh-CN";
  if (language === "zh-HK") return "zh-HK";
  return "en-GB";
}
