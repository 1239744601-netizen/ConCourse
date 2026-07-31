import {
  initializeCourseChrome,
  loadCourseCatalogue,
  localeForLanguage,
  searchCourseGroups
} from "../course-tools/course-tools.mjs";

const COPY = Object.freeze({
  en: Object.freeze({
    pageTitle: "Explore Courses",
    searchLabel: "Search the course catalogue",
    searchPlaceholder: "Search by course, faculty, instructor, semester, or section",
    resultsTitle: "Search Results",
    loading: "Searching the catalogue…",
    resultsCount: "{count} possible matches",
    noResults: "No courses matched this search. Try a title, course identifier, faculty, instructor, semester, or section.",
    loadFailed: "The course catalogue could not be loaded. Please refresh and try again.",
    sourceId: "Source ID",
    faculty: "Faculty",
    semester: "Semester",
    instructors: "Instructors",
    sections: "Sections",
    section: "Section",
    instructor: "Instructor",
    notListed: "Not listed",
    openOfficial: "Open Official Reference",
    openCourseKeys: "Open CourseKeys Workspace",
    source: "Source",
    dataNote: "These are reference catalogue records, not live registration data. A match does not confirm eligibility, seats, credits, prerequisites, or timetable availability."
  }),
  "zh-CN": Object.freeze({
    pageTitle: "探索课程",
    searchLabel: "搜索课程目录",
    searchPlaceholder: "按课程、学院、教师、学期或班别搜索",
    resultsTitle: "搜索结果",
    loading: "正在搜索课程目录…",
    resultsCount: "找到 {count} 个可能匹配项",
    noResults: "没有找到匹配课程。请尝试输入课程名称、课程标识、学院、教师、学期或班别。",
    loadFailed: "课程目录暂时无法载入。请刷新页面后重试。",
    sourceId: "来源编号",
    faculty: "学院",
    semester: "学期",
    instructors: "教师",
    sections: "班别",
    section: "班别",
    instructor: "教师",
    notListed: "未列出",
    openOfficial: "打开官方参考页面",
    openCourseKeys: "打开 CourseKeys 课程空间",
    source: "来源",
    dataNote: "这些是课程目录参考记录，并非实时注册数据。搜索匹配不代表已确认修读资格、名额、学分、先修要求或上课时间。"
  }),
  "zh-HK": Object.freeze({
    pageTitle: "探索課程",
    searchLabel: "搜尋課程目錄",
    searchPlaceholder: "按課程、學院、教師、學期或班別搜尋",
    resultsTitle: "搜尋結果",
    loading: "正在搜尋課程目錄…",
    resultsCount: "搵到 {count} 個可能匹配項",
    noResults: "搵唔到符合條件嘅課程。請試下輸入課程名稱、課程識別碼、學院、教師、學期或班別。",
    loadFailed: "課程目錄暫時載入唔到。請重新整理頁面再試。",
    sourceId: "來源編號",
    faculty: "學院",
    semester: "學期",
    instructors: "教師",
    sections: "班別",
    section: "班別",
    instructor: "教師",
    notListed: "未列出",
    openOfficial: "打開官方參考頁面",
    openCourseKeys: "打開 CourseKeys 課程空間",
    source: "來源",
    dataNote: "呢啲係課程目錄參考記錄，唔係實時註冊資料。搜尋結果唔代表已確認修讀資格、名額、學分、先修要求或上堂時間。"
  })
});

const state = {
  catalogue: null,
  query: "",
  results: []
};

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function display(value) {
  return value || chrome.t("notListed");
}

function metadataItem(label, value) {
  const item = element("div", "course-detail-item");
  item.append(
    element("span", "", label),
    element("strong", "", display(value))
  );
  return item;
}

function sectionRows(group) {
  const list = element("div", "course-section-list");
  const rows = group.entries.flatMap((entry) => {
    const sections = entry.sections.length ? entry.sections : [""];
    return sections.map((section) => ({ entry, section }));
  });
  for (const { entry, section } of rows) {
    const row = element("div", "course-section-row");
    row.append(
      element("strong", "", `${chrome.t("section")} ${display(section)}`),
      element("span", "", `${chrome.t("instructor")}: ${display(entry.instructor)}`),
      element("span", "", `${chrome.t("sourceId")}: ${display(entry.sourceCourseId)}`)
    );
    list.append(row);
  }
  return list;
}

function courseKeysHref(group) {
  const url = new URL("../coursekeys/", location.href);
  url.searchParams.set("institutionId", group.institutionId);
  url.searchParams.set("courseTitle", group.title);
  if (group.entries[0]) {
    url.searchParams.set("courseKey", group.entries[0].id);
  }
  return url.href;
}

function resultCard(group) {
  const card = element("details", "course-result-card");
  const summary = document.createElement("summary");
  const copy = element("div", "course-result-summary");
  const identity = [
    group.institutionShortName || group.institutionName,
    group.code || `${chrome.t("sourceId")} ${group.sourceCourseIds[0]}`
  ].filter(Boolean).join(" · ");
  copy.append(
    element("span", "course-result-kicker", identity),
    element("h3", "course-result-title", group.title),
    element(
      "p",
      "course-result-meta",
      [group.faculty, group.academicPeriod].filter(Boolean).join(" · ") || chrome.t("notListed")
    )
  );
  summary.append(copy, element("span", "course-result-chevron", "+"));

  const details = element("div", "course-result-details");
  const detailGrid = element("div", "course-detail-grid");
  detailGrid.append(
    metadataItem(chrome.t("faculty"), group.faculty),
    metadataItem(chrome.t("semester"), group.academicPeriod),
    metadataItem(chrome.t("instructors"), group.instructors.join(", "))
  );

  const actions = element("div", "course-result-actions");
  const officialEntry = group.entries.find((entry) => entry.officialUrl);
  if (officialEntry) {
    const official = element("a", "course-action course-action-primary", chrome.t("openOfficial"));
    official.href = officialEntry.officialUrl;
    official.target = "_blank";
    official.rel = "noopener noreferrer";
    actions.append(official);
  }
  const courseKeys = element("a", "course-action", chrome.t("openCourseKeys"));
  courseKeys.href = courseKeysHref(group);
  actions.append(courseKeys);

  details.append(detailGrid, sectionRows(group), actions);
  card.append(summary, details);
  return card;
}

function renderResults() {
  const list = byId("courseResultList");
  list.replaceChildren();
  const locale = localeForLanguage(chrome.language);
  byId("courseSearchStatus").textContent = chrome.t("resultsCount", {
    count: state.results.length.toLocaleString(locale)
  });

  if (!state.results.length) {
    list.append(element("div", "course-empty-state", chrome.t("noResults")));
    return;
  }

  for (const group of state.results) list.append(resultCard(group));
  list.append(element("p", "course-data-note", chrome.t("dataNote")));
}

let chrome = initializeCourseChrome(COPY, () => {
  if (!byId("courseSearchResults").hidden) renderResults();
});

async function ensureCatalogue() {
  if (!state.catalogue) state.catalogue = await loadCourseCatalogue();
  return state.catalogue;
}

byId("courseSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = byId("courseSearchInput").value.trim();
  if (!query) {
    byId("courseSearchInput").focus();
    return;
  }

  state.query = query;
  const submit = byId("courseSearchSubmit");
  submit.disabled = true;
  byId("courseSearchStatus").textContent = chrome.t("loading");

  try {
    const catalogue = await ensureCatalogue();
    state.results = searchCourseGroups(catalogue.groups, query, 36);
    document.body.classList.add("has-course-results");
    byId("courseSearchResults").hidden = false;
    renderResults();
    byId("courseResultsTitle").focus({ preventScroll: true });
    byId("courseSearchResults").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("ConCourse course search failed", error);
    state.results = [];
    document.body.classList.add("has-course-results");
    byId("courseSearchResults").hidden = false;
    byId("courseResultList").replaceChildren(
      element("div", "course-empty-state", chrome.t("loadFailed"))
    );
    byId("courseSearchStatus").textContent = chrome.t("loadFailed");
  } finally {
    submit.disabled = false;
  }
});
