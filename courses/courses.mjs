import {
  initializeCourseChrome,
  loadCourseCatalogue,
  loadCourseKeysReadiness,
  localeForLanguage,
  safeOfficialUrl,
  searchCourseGroupsWithTotal
} from "../course-tools/course-tools.mjs?v=20260731-clean1";

const COPY = Object.freeze({
  en: Object.freeze({
    pageTitle: "Courses",
    searchLabel: "Search the course catalogue",
    searchPlaceholder: "Course, code, or instructor",
    resultsTitle: "Results",
    loading: "Searching…",
    resultsCount: "{count} matches",
    limitedResultsCount: "{count} matches · first {shown} shown",
    institutionResults: "{institution} · {count}",
    noResults: "No matches. Try a title, code, faculty, instructor, term, or section.",
    loadFailed: "Catalogue unavailable. Refresh and try again.",
    sourceSummary: "{loaded} sources",
    sourcePartial: "{loaded} sources · {unavailable} unavailable",
    sourceId: "Source ID",
    institution: "Institution",
    courseCode: "Course code",
    alternateTitle: "Alternate title",
    faculty: "Faculty",
    semester: "Semester",
    units: "Units",
    level: "Level",
    unitCode: "Unit code",
    teachingMedium: "Teaching medium",
    instructors: "Instructors",
    sections: "Sections",
    section: "Section",
    instructor: "Instructor",
    meetingTime: "Time",
    remarks: "Remarks",
    description: "Description",
    prerequisites: "Prerequisites",
    corequisites: "Corequisites",
    targetStudents: "Target students",
    notListed: "Not listed",
    openOfficial: "Official Source",
    openCourseKeys: "CourseKeys",
    addToTimetable: "Plan Course",
    openCommunity: "Community",
    openMarketplace: "Marketplace",
    source: "Source",
    sourceStatus: "Status",
    capturedAt: "Captured",
    sourceMode: "Mode",
    caveats: "Notes",
    courseKeysReadiness: "CourseKeys",
    locked: "Locked",
    readinessConnected: "Status online. Contributions remain locked.",
    readinessUnavailable: "Status unavailable. Contributions remain locked.",
    workspaceAvailable: "Workspace available.",
    workspaceUnavailable: "No workspace for this record.",
    contributionLocked: "Contributions locked",
    contributionNotice: "Uploads, publishing, downloads, transactions, and credits are disabled.",
    dataNote: "Reference data, not live registration. Confirm eligibility, seats, credits, requirements, times, and registration with your institution."
  }),
  "zh-CN": Object.freeze({
    pageTitle: "课程",
    searchLabel: "搜索课程目录",
    searchPlaceholder: "课程、学院、教师、学期或班别",
    resultsTitle: "结果",
    loading: "正在搜索…",
    resultsCount: "{count} 个匹配项",
    limitedResultsCount: "{count} 个匹配项 · 显示前 {shown} 个",
    institutionResults: "{institution} · {count}",
    noResults: "没有匹配课程。请尝试名称、编号、学院、教师、学期或班别。",
    loadFailed: "课程目录不可用。请刷新后重试。",
    sourceSummary: "{loaded} 个来源",
    sourcePartial: "{loaded} 个来源 · {unavailable} 个不可用",
    sourceId: "来源编号",
    institution: "院校",
    courseCode: "课程编号",
    alternateTitle: "其他名称",
    faculty: "学院",
    semester: "学期",
    units: "学分单位",
    level: "程度",
    unitCode: "单位编号",
    teachingMedium: "授课语言",
    instructors: "教师",
    sections: "班别",
    section: "班别",
    instructor: "教师",
    meetingTime: "时间",
    remarks: "备注",
    description: "课程简介",
    prerequisites: "先修要求",
    corequisites: "并修要求",
    targetStudents: "适用学生",
    notListed: "未列出",
    openOfficial: "官方来源",
    openCourseKeys: "CourseKeys",
    addToTimetable: "规划课程",
    openCommunity: "社区",
    openMarketplace: "市场",
    source: "来源",
    sourceStatus: "状态",
    capturedAt: "资料日期",
    sourceMode: "模式",
    caveats: "注意事项",
    courseKeysReadiness: "CourseKeys",
    locked: "已锁定",
    readinessConnected: "状态正常。贡献功能仍锁定。",
    readinessUnavailable: "状态不可用。贡献功能仍锁定。",
    workspaceAvailable: "课程空间可用。",
    workspaceUnavailable: "此记录没有课程空间。",
    contributionLocked: "贡献功能已锁定",
    contributionNotice: "上传、发布、下载、交易及积分均未开放。",
    dataNote: "仅供参考，并非实时注册资料。请向院校确认资格、名额、学分、要求、时间及注册状态。"
  }),
  "zh-HK": Object.freeze({
    pageTitle: "課程",
    searchLabel: "搜尋課程目錄",
    searchPlaceholder: "課程、學院、教師、學期或班別",
    resultsTitle: "結果",
    loading: "搜尋緊…",
    resultsCount: "{count} 個匹配項",
    limitedResultsCount: "{count} 個匹配項 · 顯示頭 {shown} 個",
    institutionResults: "{institution} · {count}",
    noResults: "搵唔到匹配課程。請試名稱、編號、學院、教師、學期或班別。",
    loadFailed: "課程目錄用唔到。請重新整理再試。",
    sourceSummary: "{loaded} 個來源",
    sourcePartial: "{loaded} 個來源 · {unavailable} 個用唔到",
    sourceId: "來源編號",
    institution: "院校",
    courseCode: "課程編號",
    alternateTitle: "其他名稱",
    faculty: "學院",
    semester: "學期",
    units: "學分單位",
    level: "程度",
    unitCode: "單位編號",
    teachingMedium: "授課語言",
    instructors: "教師",
    sections: "班別",
    section: "班別",
    instructor: "教師",
    meetingTime: "時間",
    remarks: "備註",
    description: "課程簡介",
    prerequisites: "先修要求",
    corequisites: "並修要求",
    targetStudents: "適用學生",
    notListed: "未列出",
    openOfficial: "官方來源",
    openCourseKeys: "CourseKeys",
    addToTimetable: "規劃課程",
    openCommunity: "社群",
    openMarketplace: "市場",
    source: "來源",
    sourceStatus: "狀態",
    capturedAt: "資料日期",
    sourceMode: "模式",
    caveats: "注意事項",
    courseKeysReadiness: "CourseKeys",
    locked: "已鎖定",
    readinessConnected: "狀態正常。貢獻功能仍然鎖定。",
    readinessUnavailable: "狀態用唔到。貢獻功能仍然鎖定。",
    workspaceAvailable: "課程空間可用。",
    workspaceUnavailable: "呢個記錄冇課程空間。",
    contributionLocked: "貢獻功能已鎖定",
    contributionNotice: "上載、發佈、下載、交易同積分都未開放。",
    dataNote: "只供參考，唔係實時註冊資料。請向院校確認資格、名額、學分、要求、時間同註冊狀態。"
  })
});

const state = {
  catalogue: null,
  readiness: null,
  query: "",
  results: [],
  totalResults: 0
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

function rulesText(primaryText, rules) {
  const lines = [];
  if (primaryText) lines.push(primaryText);
  for (const rule of Array.isArray(rules) ? rules : []) {
    const context = [
      rule.studyProgramme,
      rule.studyYear,
      rule.basisOfAdmission
    ].filter(Boolean).join(" · ");
    const line = [rule.condition, context].filter(Boolean).join(" — ");
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines.join("\n");
}

function textDetail(label, value) {
  const section = element("section", "course-text-detail");
  section.append(
    element("h4", "", label),
    element("p", "", display(value))
  );
  return section;
}

function sectionRows(group) {
  const section = element("section", "course-sections");
  section.append(element("h4", "", chrome.t("sections")));
  const list = element("div", "course-section-list");
  const rows = group.entries.flatMap((entry) => {
    if (entry.sectionDetails.length) {
      return entry.sectionDetails.map((details) => ({ entry, details }));
    }
    const sections = entry.sections.length ? entry.sections : [""];
    return sections.map((sectionName) => ({
      entry,
      details: {
        section: sectionName,
        instructor: entry.instructor,
        dayTime: "",
        teachingMedium: "",
        remarks: ""
      }
    }));
  });

  for (const { entry, details } of rows) {
    const row = element("div", "course-section-row");
    row.append(
      metadataItem(chrome.t("section"), details.section),
      metadataItem(chrome.t("instructor"), details.instructor || entry.instructor),
      metadataItem(chrome.t("meetingTime"), details.dayTime),
      metadataItem(chrome.t("teachingMedium"), details.teachingMedium || group.teachingMedium),
      metadataItem(chrome.t("remarks"), details.remarks),
      metadataItem(chrome.t("sourceId"), entry.sourceCourseId)
    );
    list.append(row);
  }
  section.append(list);
  return section;
}

function courseKeysHref(group) {
  if (!group.courseKeysKey) return "";
  const url = new URL("../coursekeys/", location.href);
  url.searchParams.set("institutionId", group.institutionId);
  url.searchParams.set("courseKey", group.courseKeysKey);
  return url.href;
}

function handoffHref(destination, group) {
  const url = new URL("../", location.href);
  url.searchParams.set("destination", destination);
  url.searchParams.set("intent", destination === "timetable" ? "add-course" : "search");
  url.searchParams.set("courseKey", group.courseKey);
  return url.href;
}

function actionLink(label, href, className, handoff) {
  const link = element("a", className, label);
  link.href = href;
  link.dataset.courseHandoff = handoff;
  return link;
}

function sourcePanel(group) {
  const panel = element("section", "course-source-panel");
  panel.append(element("h4", "", chrome.t("source")));

  const grid = element("div", "course-source-grid");
  grid.append(
    metadataItem(chrome.t("source"), group.sourceLabel),
    metadataItem(chrome.t("sourceStatus"), group.sourceStatus),
    metadataItem(chrome.t("capturedAt"), group.sourceCapturedAt),
    metadataItem(chrome.t("sourceMode"), group.sourceMode)
  );
  panel.append(grid);

  if (group.sourceCaveats.length) {
    const caveatBlock = element("div", "course-source-caveats");
    caveatBlock.append(element("strong", "", chrome.t("caveats")));
    const list = document.createElement("ul");
    for (const caveat of group.sourceCaveats) list.append(element("li", "", caveat));
    caveatBlock.append(list);
    panel.append(caveatBlock);
  }
  return panel;
}

function courseKeysPanel(group) {
  const panel = element("section", "coursekeys-readiness");
  const heading = element("div", "coursekeys-readiness-heading");
  heading.append(
    element("h4", "", chrome.t("courseKeysReadiness")),
    element("span", "course-status-badge course-status-locked", chrome.t("locked"))
  );
  panel.append(heading);

  panel.append(
    element(
      "p",
      "",
      state.readiness?.reachable
        ? chrome.t("readinessConnected")
        : chrome.t("readinessUnavailable")
    ),
    element(
      "p",
      "",
      group.courseKeysKey
        ? chrome.t("workspaceAvailable")
        : chrome.t("workspaceUnavailable")
    )
  );

  const controls = element("div", "coursekeys-readiness-controls");
  const lockedButton = element(
    "button",
    "course-action course-action-locked",
    chrome.t("contributionLocked")
  );
  lockedButton.type = "button";
  lockedButton.disabled = true;
  lockedButton.dataset.syllabusContribution = "locked";
  controls.append(lockedButton);

  const workspaceHref = courseKeysHref(group);
  if (workspaceHref) {
    controls.append(
      actionLink(
        chrome.t("openCourseKeys"),
        workspaceHref,
        "course-action",
        "coursekeys"
      )
    );
  }
  panel.append(
    controls,
    element("small", "coursekeys-lock-note", chrome.t("contributionNotice"))
  );
  return panel;
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
  const detailGrid = element("div", "course-detail-grid course-detail-grid-rich");
  detailGrid.append(
    metadataItem(chrome.t("courseCode"), group.code),
    metadataItem(chrome.t("institution"), group.institutionName || group.institutionShortName),
    metadataItem(chrome.t("sourceId"), group.sourceCourseIds.join(", ")),
    metadataItem(chrome.t("alternateTitle"), group.alternateTitles.join(", ")),
    metadataItem(chrome.t("faculty"), group.faculty),
    metadataItem(chrome.t("semester"), group.academicPeriod),
    metadataItem(chrome.t("units"), group.units),
    metadataItem(chrome.t("level"), group.level),
    metadataItem(chrome.t("unitCode"), group.unitCode),
    metadataItem(chrome.t("teachingMedium"), group.teachingMedium),
    metadataItem(chrome.t("instructors"), group.instructors.join(", "))
  );

  const textGrid = element("div", "course-text-grid");
  textGrid.append(
    textDetail(chrome.t("description"), group.description),
    textDetail(
      chrome.t("prerequisites"),
      rulesText(group.prerequisiteText, group.prerequisiteRules)
    ),
    textDetail(
      chrome.t("corequisites"),
      rulesText(group.corequisiteText, group.corequisiteRules)
    ),
    textDetail(chrome.t("targetStudents"), group.targetStudents)
  );

  const actions = element("div", "course-result-actions");
  const officialUrl = safeOfficialUrl(
    group.entries.find((entry) => entry.officialUrl)?.officialUrl,
    group.institutionId
  );
  if (officialUrl) {
    const official = actionLink(
      chrome.t("openOfficial"),
      officialUrl,
      "course-action course-action-primary",
      "official"
    );
    official.target = "_blank";
    official.rel = "noopener noreferrer";
    actions.append(official);
  }
  actions.append(
    actionLink(
      chrome.t("addToTimetable"),
      handoffHref("timetable", group),
      "course-action",
      "timetable"
    ),
    actionLink(
      chrome.t("openCommunity"),
      handoffHref("community", group),
      "course-action",
      "community"
    ),
    actionLink(
      chrome.t("openMarketplace"),
      handoffHref("marketplace", group),
      "course-action",
      "marketplace"
    )
  );

  details.append(
    detailGrid,
    textGrid,
    sectionRows(group),
    sourcePanel(group),
    courseKeysPanel(group),
    actions
  );
  card.append(summary, details);
  return card;
}

function renderSourceStatus() {
  const sources = state.catalogue?.sources || [];
  const loaded = sources.filter((source) => source.status === "loaded").length;
  const unavailable = sources.filter((source) => source.status === "unavailable").length;
  byId("courseSourceStatus").textContent = unavailable
    ? chrome.t("sourcePartial", { loaded, unavailable })
    : chrome.t("sourceSummary", { loaded });
}

function renderResults() {
  const list = byId("courseResultList");
  list.replaceChildren();
  const locale = localeForLanguage(chrome.language);
  const formattedTotal = state.totalResults.toLocaleString(locale);
  byId("courseSearchStatus").textContent =
    state.totalResults > state.results.length
      ? chrome.t("limitedResultsCount", {
        count: formattedTotal,
        shown: state.results.length.toLocaleString(locale)
      })
      : chrome.t("resultsCount", { count: formattedTotal });
  renderSourceStatus();

  if (!state.results.length) {
    list.append(element("div", "course-empty-state", chrome.t("noResults")));
    return;
  }

  const institutionGroups = new Map();
  for (const group of state.results) {
    const key = group.institutionId || "unknown";
    if (!institutionGroups.has(key)) institutionGroups.set(key, []);
    institutionGroups.get(key).push(group);
  }
  for (const groups of institutionGroups.values()) {
    const section = element("section", "course-institution-group");
    const institution =
      groups[0].institutionName ||
      groups[0].institutionShortName ||
      chrome.t("notListed");
    section.append(
      element(
        "h3",
        "course-institution-heading",
        chrome.t("institutionResults", {
          institution,
          count: groups.length.toLocaleString(locale)
        })
      )
    );
    const cards = element("div", "course-institution-cards");
    for (const group of groups) cards.append(resultCard(group));
    section.append(cards);
    list.append(section);
  }
  list.append(element("p", "course-data-note", chrome.t("dataNote")));
}

let chrome = initializeCourseChrome(COPY, () => {
  if (!byId("courseSearchResults").hidden) renderResults();
});

async function ensureCatalogue() {
  if (!state.catalogue) state.catalogue = await loadCourseCatalogue();
  return state.catalogue;
}

async function ensureReadiness() {
  if (!state.readiness) state.readiness = await loadCourseKeysReadiness();
  return state.readiness;
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
    const [catalogue] = await Promise.all([ensureCatalogue(), ensureReadiness()]);
    const matches = searchCourseGroupsWithTotal(catalogue.groups, query, 36);
    state.results = matches.items;
    state.totalResults = matches.total;
    document.body.classList.add("has-course-results");
    byId("courseSearchResults").hidden = false;
    renderResults();
    byId("courseResultsTitle").focus({ preventScroll: true });
    byId("courseSearchResults").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("ConCourse course search failed", error);
    state.results = [];
    state.totalResults = 0;
    document.body.classList.add("has-course-results");
    byId("courseSearchResults").hidden = false;
    byId("courseResultList").replaceChildren(
      element("div", "course-empty-state", chrome.t("loadFailed"))
    );
    byId("courseSourceStatus").textContent = "";
    byId("courseSearchStatus").textContent = chrome.t("loadFailed");
  } finally {
    submit.disabled = false;
  }
});
