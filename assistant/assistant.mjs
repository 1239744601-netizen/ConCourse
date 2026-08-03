import {
  initializeCourseChrome,
  loadSelectionAssistantCatalogue,
  localeForLanguage,
  searchCourseGroups
} from "../course-tools/course-tools.mjs?v=20260803-masthead1";
import {
  ACTIVE_USER_SESSION_KEY,
  TIMETABLE_HANDOFF_SESSION_KEY,
  courseChoicesForGroup,
  createTimetableHandoff,
  readActiveUserId,
  resolveCourseKeySelection,
  resolveSelectedChoices
} from "./handoff.mjs?v=20260731-course-selection3";

const SHORTLIST_KEY = "concourse_course_selection_shortlist_v1";

const COPY = Object.freeze({
  en: Object.freeze({
    pageTitle: "Course Assistant",
    timetable: "Timetable",
    searchLabel: "Search courses or describe your interests",
    searchPlaceholder: "Search courses or topics",
    resultsTitle: "Matches",
    shortlistTitle: "Shortlist",
    loading: "Searching…",
    resultsCount: "{count} matches",
    noResults: "No matches. Try a course, subject, instructor, term, or section.",
    loadFailed: "Catalogue unavailable. Refresh and try again.",
    institutionSignInRequired: "Sign in before choosing courses.",
    institutionRequired: "Choose and verify your institution first.",
    institutionSessionMismatch: "Your institution belongs to another session. Sign in again.",
    institutionVerificationRequired: "Verify your academic email first.",
    institutionUnsupported: "This institution is not connected yet. Add courses manually in Timetable.",
    institutionConflict: "Your institution details conflict. Review your profile.",
    institutionCatalogueUnavailable: "{institution} offerings are unavailable here. Add courses manually in Timetable.",
    add: "Add",
    added: "Added",
    remove: "Remove",
    shortlistEmpty: "Added courses appear here.",
    chooseSection: "Section",
    section: "Section",
    sourceId: "Source ID",
    instructor: "Instructor",
    meetingTime: "Meeting Time",
    notListed: "Not listed",
    codeReason: "Course code",
    titleReason: "Title",
    facultyReason: "Subject",
    instructorReason: "Instructor",
    periodReason: "Term",
    metadataReason: "Catalogue",
    continueToTimetable: "Add to Timetable",
    activeSessionRequired: "Session unavailable. Sign in and try again.",
    handoffFailed: "Could not open Timetable. Try again.",
    handoffEmpty: "Choose at least one course.",
    courseKeyAdded: "{title} added.",
    courseKeyNotFound: "That selection is unavailable. Choose another section.",
    dataNote: "Reference data only. Confirm eligibility, credits, prerequisites, times, and availability with your institution."
  }),
  "zh-CN": Object.freeze({
    pageTitle: "选课助手",
    timetable: "课表",
    searchLabel: "搜索课程或输入你的兴趣",
    searchPlaceholder: "搜索课程或输入你的兴趣",
    resultsTitle: "匹配课程",
    shortlistTitle: "备选课程",
    loading: "正在搜索…",
    resultsCount: "{count} 个匹配项",
    noResults: "没有匹配课程。请尝试课程、学科、教师、学期或班别。",
    loadFailed: "课程目录不可用。请刷新后重试。",
    institutionSignInRequired: "请先登录再选择课程。",
    institutionRequired: "请先选择并验证院校。",
    institutionSessionMismatch: "院校资料属于另一个登录状态。请重新登录。",
    institutionVerificationRequired: "请先验证学术邮箱。",
    institutionUnsupported: "该院校尚未连接。请在课表中手动添加课程。",
    institutionConflict: "院校资料不一致。请检查个人资料。",
    institutionCatalogueUnavailable: "暂未提供 {institution} 课程。请在课表中手动添加。",
    add: "加入",
    added: "已加入",
    remove: "移除",
    shortlistEmpty: "已加入的课程会显示在这里。",
    chooseSection: "班别",
    section: "班别",
    sourceId: "来源编号",
    instructor: "教师",
    meetingTime: "上课时间",
    notListed: "未列出",
    codeReason: "课程编号",
    titleReason: "名称",
    facultyReason: "学科",
    instructorReason: "教师",
    periodReason: "学期",
    metadataReason: "课程目录",
    continueToTimetable: "加入课表",
    activeSessionRequired: "登录状态不可用。请重新登录。",
    handoffFailed: "无法打开课表。请重试。",
    handoffEmpty: "请至少选择一门课程。",
    courseKeyAdded: "已加入 {title}。",
    courseKeyNotFound: "该选项不可用。请选择其他班别。",
    dataNote: "仅供参考。请向院校确认资格、学分、先修要求、时间及名额。"
  }),
  "zh-HK": Object.freeze({
    pageTitle: "選科助手",
    timetable: "時間表",
    searchLabel: "搜尋課程或輸入你嘅興趣",
    searchPlaceholder: "搜尋課程或輸入你嘅興趣",
    resultsTitle: "匹配課程",
    shortlistTitle: "備選課程",
    loading: "搜尋緊…",
    resultsCount: "{count} 個匹配項",
    noResults: "搵唔到匹配課程。請試課程、學科、教師、學期或班別。",
    loadFailed: "課程目錄用唔到。請重新整理再試。",
    institutionSignInRequired: "請先登入再揀課程。",
    institutionRequired: "請先選擇並驗證院校。",
    institutionSessionMismatch: "院校資料屬於另一個登入狀態。請重新登入。",
    institutionVerificationRequired: "請先驗證學術電郵。",
    institutionUnsupported: "呢間院校未連接。請喺時間表手動加入課程。",
    institutionConflict: "院校資料唔一致。請檢查個人資料。",
    institutionCatalogueUnavailable: "暫未提供 {institution} 課程。請喺時間表手動加入。",
    add: "加入",
    added: "已加入",
    remove: "移除",
    shortlistEmpty: "已加入嘅課程會顯示喺呢度。",
    chooseSection: "班別",
    section: "班別",
    sourceId: "來源編號",
    instructor: "教師",
    meetingTime: "上堂時間",
    notListed: "未列出",
    codeReason: "課程編號",
    titleReason: "名稱",
    facultyReason: "學科",
    instructorReason: "教師",
    periodReason: "學期",
    metadataReason: "課程目錄",
    continueToTimetable: "加入時間表",
    activeSessionRequired: "登入狀態用唔到。請重新登入。",
    handoffFailed: "未能打開時間表。請再試。",
    handoffEmpty: "請至少揀一科。",
    courseKeyAdded: "已加入 {title}。",
    courseKeyNotFound: "呢個選項用唔到。請揀其他班別。",
    dataNote: "只供參考。請向院校確認資格、學分、先修要求、時間同名額。"
  })
});

const state = {
  catalogue: null,
  query: "",
  results: [],
  selections: new Map(),
  handoffNotice: null
};

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function reasonLabel(reason) {
  const keys = {
    code: "codeReason",
    title: "titleReason",
    faculty: "facultyReason",
    instructor: "instructorReason",
    period: "periodReason",
    metadata: "metadataReason",
    source: "codeReason"
  };
  return chrome.t(keys[reason] || "metadataReason");
}

function readSelections() {
  try {
    const saved = JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]");
    if (!Array.isArray(saved)) return;
    state.selections = new Map(
      saved
        .filter((item) => item && typeof item.groupId === "string")
        .slice(0, 20)
        .map((item) => [item.groupId, String(item.choiceId || "")])
    );
  } catch (_error) {
    state.selections = new Map();
  }
}

function saveSelections() {
  try {
    const saved = [...state.selections].map(([groupId, choiceId]) => ({
      groupId,
      choiceId
    }));
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(saved));
  } catch (_error) {}
}

function availableChoices(group) {
  return courseChoicesForGroup(group).map((choice) => ({
    id: choice.id,
    section: choice.section,
    instructor: choice.instructor,
    dayTime: choice.dayTime,
    sourceCourseId: choice.entry.sourceCourseId
  }));
}

function defaultChoice(group) {
  return availableChoices(group)[0]?.id || "";
}

function toggleSelection(group) {
  if (state.selections.has(group.id)) {
    state.selections.delete(group.id);
  } else if (state.selections.size < 20) {
    state.selections.set(group.id, defaultChoice(group));
  }
  state.handoffNotice = null;
  saveSelections();
  renderWorkspace();
}

function recommendationCard(group) {
  const card = element("article", "assistant-recommendation");
  const copy = element("div", "assistant-recommendation-copy");
  const identity = [
    group.institutionShortName || group.institutionName,
    group.code || `${chrome.t("sourceId")} ${group.sourceCourseIds[0]}`
  ].filter(Boolean).join(" · ");
  copy.append(
    element("span", "recommendation-reason", reasonLabel(group.matchReason)),
    element("h3", "", group.title),
    element(
      "p",
      "",
      [identity, group.academicPeriod, group.faculty].filter(Boolean).join(" · ")
    )
  );

  const selected = state.selections.has(group.id);
  const button = element(
    "button",
    "assistant-add-button",
    selected ? chrome.t("added") : chrome.t("add")
  );
  button.type = "button";
  button.dataset.selected = String(selected);
  button.setAttribute("aria-pressed", String(selected));
  button.addEventListener("click", () => toggleSelection(group));
  card.append(copy, button);
  return card;
}

function shortlistItem(group, selectedChoice) {
  const item = element("div", "assistant-shortlist-item");
  item.dataset.groupId = group.id;
  item.tabIndex = -1;
  item.append(
    element("strong", "", group.title),
    element(
      "span",
      "course-result-meta",
      [group.institutionShortName || group.institutionName, group.academicPeriod]
        .filter(Boolean)
        .join(" · ")
    )
  );

  const choices = availableChoices(group);
  if (choices.length) {
    const label = element("label", "", chrome.t("chooseSection"));
    const select = document.createElement("select");
    for (const choice of choices) {
      const option = document.createElement("option");
      option.value = choice.id;
      const section = choice.section
        ? `${chrome.t("section")} ${choice.section}`
        : `${chrome.t("sourceId")} ${choice.sourceCourseId || chrome.t("notListed")}`;
      option.textContent = [
        section,
        choice.dayTime ? `${chrome.t("meetingTime")}: ${choice.dayTime}` : "",
        choice.instructor ? `${chrome.t("instructor")}: ${choice.instructor}` : ""
      ].filter(Boolean).join(" · ");
      select.append(option);
    }
    select.value = choices.some((choice) => choice.id === selectedChoice)
      ? selectedChoice
      : choices[0].id;
    if (select.value !== selectedChoice) {
      state.selections.set(group.id, select.value);
      saveSelections();
    }
    select.addEventListener("change", () => {
      state.selections.set(group.id, select.value);
      state.handoffNotice = null;
      saveSelections();
      updateHandoffControls();
    });
    label.append(select);
    item.append(label);
  }

  const remove = element("button", "assistant-remove", chrome.t("remove"));
  remove.type = "button";
  remove.addEventListener("click", () => toggleSelection(group));
  item.append(remove);
  return item;
}

function updateHandoffControls(renderedCount) {
  const button = byId("continueToTimetable");
  const count = Number.isFinite(renderedCount)
    ? renderedCount
    : byId("assistantShortlist").querySelectorAll(".assistant-shortlist-item").length;
  button.disabled = count === 0;
  byId("assistantHandoffStatus").textContent = state.handoffNotice
    ? chrome.t(state.handoffNotice.key, state.handoffNotice.values)
    : "";
}

function setHandoffNotice(key, values = {}) {
  state.handoffNotice = { key, values };
  updateHandoffControls();
}

function renderShortlist() {
  const shortlist = byId("assistantShortlist");
  shortlist.replaceChildren();
  const groupsById = new Map(
    (state.catalogue?.groups || []).map((group) => [group.id, group])
  );
  let rendered = 0;
  let removedUnavailable = false;
  for (const [groupId, choiceId] of state.selections) {
    const group = groupsById.get(groupId);
    if (!group) {
      state.selections.delete(groupId);
      removedUnavailable = true;
      continue;
    }
    shortlist.append(shortlistItem(group, choiceId));
    rendered += 1;
  }
  if (removedUnavailable) saveSelections();
  if (!rendered) {
    shortlist.append(
      element("p", "assistant-shortlist-empty", chrome.t("shortlistEmpty"))
    );
  }
  updateHandoffControls(rendered);
}

function renderWorkspace() {
  const results = byId("assistantResults");
  results.replaceChildren();
  const locale = localeForLanguage(chrome.language);
  byId("assistantStatus").textContent = chrome.t("resultsCount", {
    count: state.results.length.toLocaleString(locale)
  });

  if (!state.results.length) {
    results.append(element("div", "course-empty-state", chrome.t("noResults")));
  } else {
    for (const group of state.results) results.append(recommendationCard(group));
  }
  renderShortlist();
}

let chrome = initializeCourseChrome(COPY, () => {
  if (!byId("assistantWorkspace").hidden) renderWorkspace();
});

readSelections();

async function ensureCatalogue() {
  if (!state.catalogue) {
    state.catalogue = await loadSelectionAssistantCatalogue();
  }
  return state.catalogue;
}

function catalogueErrorMessage(error) {
  const keys = {
    institution_sign_in_required: "institutionSignInRequired",
    institution_required: "institutionRequired",
    institution_session_mismatch: "institutionSessionMismatch",
    institution_verification_required: "institutionVerificationRequired",
    institution_unsupported: "institutionUnsupported",
    institution_conflict: "institutionConflict",
    institution_catalogue_unavailable: "institutionCatalogueUnavailable"
  };
  const key = keys[error?.code] || "loadFailed";
  const institution =
    error?.institution?.institutionShortName ||
    error?.institution?.institutionName ||
    chrome.t("notListed");
  return chrome.t(key, { institution });
}

function renderCatalogueError(error) {
  const message = catalogueErrorMessage(error);
  state.results = [];
  document.body.classList.add("has-course-results");
  byId("assistantWorkspace").hidden = false;
  byId("assistantResults").replaceChildren(
    element("div", "course-empty-state", message)
  );
  byId("assistantShortlist").replaceChildren();
  byId("assistantStatus").textContent = message;
  updateHandoffControls(0);
}

function logCatalogueError(context, error) {
  if (error?.name === "CourseInstitutionError") {
    console.info(context, error.code);
    return;
  }
  console.error(context, error);
}

byId("continueToTimetable").addEventListener("click", async () => {
  const button = byId("continueToTimetable");
  button.disabled = true;
  state.handoffNotice = null;

  try {
    const catalogue = await ensureCatalogue();
    const selections = resolveSelectedChoices(
      catalogue.groups,
      state.selections
    );
    if (!selections.length) {
      setHandoffNotice("handoffEmpty");
      return;
    }

    const userId = readActiveUserId(sessionStorage);
    if (!userId) {
      console.warn(
        `ConCourse assistant requires sessionStorage.${ACTIVE_USER_SESSION_KEY}`
      );
      setHandoffNotice("activeSessionRequired");
      return;
    }

    const payload = createTimetableHandoff({ userId, selections });
    // Timetable treats this key as a one-time mailbox and removes it after validation.
    sessionStorage.setItem(
      TIMETABLE_HANDOFF_SESSION_KEY,
      JSON.stringify(payload)
    );
    window.location.assign("../?destination=timetable&selection=1");
  } catch (error) {
    console.error("ConCourse course selection handoff failed", error);
    setHandoffNotice("handoffFailed");
  }
});

function requestedCourseKey() {
  try {
    return new URL(window.location.href).searchParams.get("courseKey") || "";
  } catch (_error) {
    return "";
  }
}

function focusShortlistGroup(groupId) {
  requestAnimationFrame(() => {
    const item = [...document.querySelectorAll(".assistant-shortlist-item")]
      .find((candidate) => candidate.dataset.groupId === groupId);
    const target = item?.querySelector("select") || item;
    target?.focus({ preventScroll: true });
  });
}

async function initializeCourseKeyHandoff() {
  const courseKey = requestedCourseKey();
  if (!courseKey) return;

  const submit = byId("assistantSubmit");
  submit.disabled = true;
  try {
    const catalogue = await ensureCatalogue();
    const match = resolveCourseKeySelection(catalogue.groups, courseKey);
    document.body.classList.add("has-course-results");
    byId("assistantWorkspace").hidden = false;

    if (!match) {
      state.results = [];
      renderWorkspace();
      byId("assistantStatus").textContent = chrome.t("courseKeyNotFound");
      byId("assistantQuery").focus({ preventScroll: true });
      return;
    }

    if (
      !state.selections.has(match.group.id) &&
      state.selections.size >= 20
    ) {
      state.selections.delete(state.selections.keys().next().value);
    }
    state.selections.set(match.group.id, match.choiceId);
    state.results = [{ ...match.group, matchReason: "source" }];
    state.query = match.group.code || match.group.title;
    byId("assistantQuery").value = state.query;
    saveSelections();
    renderWorkspace();
    byId("assistantStatus").textContent = chrome.t("courseKeyAdded", {
      title: match.group.title
    });
    focusShortlistGroup(match.group.id);
  } catch (error) {
    logCatalogueError("ConCourse Course Engine handoff unavailable", error);
    renderCatalogueError(error);
  } finally {
    submit.disabled = false;
  }
}

byId("assistantForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = byId("assistantQuery").value.trim();
  if (!query) {
    byId("assistantQuery").focus();
    return;
  }

  state.query = query;
  const submit = byId("assistantSubmit");
  submit.disabled = true;
  byId("assistantStatus").textContent = chrome.t("loading");

  try {
    const catalogue = await ensureCatalogue();
    state.results = searchCourseGroups(catalogue.groups, query, 30);
    document.body.classList.add("has-course-results");
    byId("assistantWorkspace").hidden = false;
    renderWorkspace();
    byId("assistantResultsTitle").focus({ preventScroll: true });
    byId("assistantWorkspace").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    logCatalogueError("ConCourse course selection assistant unavailable", error);
    renderCatalogueError(error);
  } finally {
    submit.disabled = false;
  }
});

initializeCourseKeyHandoff();
