const BASE_COPY = Object.freeze({
  en: Object.freeze({
    brandTag: "Conquer your course registrations",
    primaryDestinations: "Primary destinations",
    exploreCourses: "Explore Courses",
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
    exploreCourses: "探索课程",
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
    exploreCourses: "探索課程",
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

export function groupCourseRecords(records) {
  const groups = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const title = clean(record?.title || record?.displayName);
    if (!title) continue;
    const institutionId = clean(record.institutionId) || "unknown";
    const academicPeriod = clean(record.academicPeriod);
    const key = [
      institutionId,
      normalizeSearchText(title),
      normalizeSearchText(academicPeriod)
    ].join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        institutionId,
        institutionName: clean(record.institutionName),
        institutionShortName: clean(record.institutionShortName),
        title,
        code: extractCourseCode(title),
        faculty: clean(record.faculty),
        academicPeriod,
        sourceLabel: clean(record.sourceLabel),
        entries: []
      });
    }

    const group = groups.get(key);
    group.entries.push({
      id: courseRecordId(record),
      sourceCourseId: clean(record.sourceCourseId),
      sections: unique((Array.isArray(record.sections) ? record.sections : []).map(clean)),
      instructor: clean(record.instructor),
      officialUrl: clean(record.officialUrl),
      summaryUrl: clean(record.summaryUrl),
      courseType: clean(record.courseType),
      remedial: record.remedial === true
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      instructors: unique(group.entries.map((entry) => entry.instructor)),
      sections: unique(group.entries.flatMap((entry) => entry.sections)),
      sourceCourseIds: unique(group.entries.map((entry) => entry.sourceCourseId))
    }))
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
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const haystack = [title, code.toLowerCase(), sourceIds.join(" "), faculty, instructor, period, institution, sections].join(" ");
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
    )
    .slice(0, safeLimit);
}

export async function loadCourseCatalogue() {
  const response = await fetch(COURSE_CATALOGUE_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Course catalogue request failed (${response.status})`);
  const catalogue = await response.json();
  if (!catalogue || !Array.isArray(catalogue.courses)) {
    throw new Error("Course catalogue response is invalid");
  }
  return {
    ...catalogue,
    groups: groupCourseRecords(catalogue.courses)
  };
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
