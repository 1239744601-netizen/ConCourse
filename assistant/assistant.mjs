import {
  initializeCourseChrome,
  loadSelectionAssistantCatalogue,
  localeForLanguage,
  searchCourseGroups
} from "../course-tools/course-tools.mjs?v=20260731-course-selection4";
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
    pageTitle: "Course Selection Assistant",
    timetable: "Timetable",
    searchLabel: "Tell the assistant what you want to study",
    searchPlaceholder: "What do you want to study this semester?",
    resultsTitle: "Possible Matches",
    shortlistTitle: "Your Shortlist",
    loading: "Finding possible matches…",
    resultsCount: "{count} possible matches",
    noResults: "No possible matches were found. Try a course title, academic area, instructor, semester, or section.",
    loadFailed: "The course catalogue could not be loaded. Please refresh and try again.",
    institutionSignInRequired: "Sign in to ConCourse before choosing courses for your semester.",
    institutionRequired: "Choose and verify your institution in ConCourse before using the Course Selection Assistant.",
    institutionSessionMismatch: "Your institution belongs to a different ConCourse session. Return to ConCourse and sign in again.",
    institutionVerificationRequired: "Verify your academic email in ConCourse before choosing institution-specific semester courses.",
    institutionUnsupported: "This institution is not connected to the Course Selection Assistant yet. You can still enter courses and time slots manually in Timetable.",
    institutionConflict: "Your saved institution details do not agree. Review your ConCourse profile before selecting courses.",
    institutionCatalogueUnavailable: "Current-term {institution} offerings are not available in this public build. Enter the course and time slots manually in Timetable, or use an authorised institution feed.",
    add: "Add",
    added: "Added",
    remove: "Remove",
    shortlistEmpty: "Courses you add will appear here after your first search.",
    chooseSection: "Preferred Section",
    section: "Section",
    sourceId: "Source ID",
    instructor: "Instructor",
    meetingTime: "Meeting Time",
    notListed: "Not listed",
    codeReason: "Course identifier match",
    titleReason: "Course title match",
    facultyReason: "Academic area match",
    instructorReason: "Instructor match",
    periodReason: "Semester match",
    metadataReason: "Catalogue metadata match",
    continueToTimetable: "Continue to Timetable",
    activeSessionRequired: "Your active ConCourse session could not be confirmed. Return to ConCourse, sign in, and try again.",
    handoffFailed: "Your shortlist could not be sent to Timetable. Please try again.",
    handoffEmpty: "Choose at least one valid course before continuing.",
    courseKeyAdded: "{title} is selected and ready to review.",
    courseKeyNotFound: "That Course Engine selection is no longer available. Search for the course to choose another section.",
    dataNote: "Possible matches use reference catalogue metadata. Confirm eligibility, credits, prerequisites, meeting times, and registration status with your institution before making a final choice."
  }),
  "zh-CN": Object.freeze({
    pageTitle: "选课助手",
    timetable: "时间表",
    searchLabel: "告诉选课助手你想学习什么",
    searchPlaceholder: "这个学期你想学习什么？",
    resultsTitle: "可能适合的课程",
    shortlistTitle: "你的备选课程",
    loading: "正在查找可能适合的课程…",
    resultsCount: "找到 {count} 个可能匹配项",
    noResults: "没有找到可能匹配的课程。请尝试输入课程名称、学术领域、教师、学期或班别。",
    loadFailed: "课程目录暂时无法载入。请刷新页面后重试。",
    institutionSignInRequired: "请先登录 ConCourse，再选择本学期课程。",
    institutionRequired: "请先在 ConCourse 选择并验证院校，再使用选课助手。",
    institutionSessionMismatch: "院校资料属于另一个 ConCourse 登录状态。请返回 ConCourse 重新登录。",
    institutionVerificationRequired: "请先在 ConCourse 验证学术邮箱，再选择院校本学期课程。",
    institutionUnsupported: "选课助手暂未连接该院校。你仍可在时间表中手动输入课程和上课时段。",
    institutionConflict: "已保存的院校资料不一致。请先检查 ConCourse 个人资料。",
    institutionCatalogueUnavailable: "此公开版本暂未提供 {institution} 当前学期课程。请在时间表中手动输入课程和上课时段，或使用获授权的院校资料来源。",
    add: "加入",
    added: "已加入",
    remove: "移除",
    shortlistEmpty: "完成第一次搜索后，你加入的课程会显示在这里。",
    chooseSection: "首选班别",
    section: "班别",
    sourceId: "来源编号",
    instructor: "教师",
    meetingTime: "上课时间",
    notListed: "未列出",
    codeReason: "课程标识匹配",
    titleReason: "课程名称匹配",
    facultyReason: "学术领域匹配",
    instructorReason: "教师匹配",
    periodReason: "学期匹配",
    metadataReason: "课程目录资料匹配",
    continueToTimetable: "继续设置时间表",
    activeSessionRequired: "无法确认你当前的 ConCourse 登录状态。请返回 ConCourse 登录后再试。",
    handoffFailed: "暂时无法把备选课程发送到时间表。请重试。",
    handoffEmpty: "请先选择至少一门有效课程。",
    courseKeyAdded: "已选择 {title}，可继续检查。",
    courseKeyNotFound: "该课程引擎选项已不可用。请搜索课程并选择另一个班别。",
    dataNote: "可能匹配项来自课程目录参考资料。作出最终选择前，请向学校确认修读资格、学分、先修要求、上课时间及注册状态。"
  }),
  "zh-HK": Object.freeze({
    pageTitle: "選科助手",
    timetable: "時間表",
    searchLabel: "話俾選科助手知你想讀咩",
    searchPlaceholder: "今個學期你想讀咩？",
    resultsTitle: "可能適合嘅課程",
    shortlistTitle: "你嘅備選課程",
    loading: "正在搵可能適合嘅課程…",
    resultsCount: "搵到 {count} 個可能匹配項",
    noResults: "搵唔到可能匹配嘅課程。請試下輸入課程名稱、學術範疇、教師、學期或班別。",
    loadFailed: "課程目錄暫時載入唔到。請重新整理頁面再試。",
    institutionSignInRequired: "請先登入 ConCourse，再揀今個學期嘅課程。",
    institutionRequired: "請先喺 ConCourse 選擇並驗證院校，再使用選科助手。",
    institutionSessionMismatch: "院校資料屬於另一個 ConCourse 登入狀態。請返回 ConCourse 重新登入。",
    institutionVerificationRequired: "請先喺 ConCourse 驗證學術電郵，再揀院校今個學期嘅課程。",
    institutionUnsupported: "選科助手暫時未連接呢間院校。你仍然可以喺時間表手動輸入課程同上堂時段。",
    institutionConflict: "已儲存嘅院校資料唔一致。請先檢查 ConCourse 個人資料。",
    institutionCatalogueUnavailable: "呢個公開版本暫時未提供 {institution} 當前學期課程。請喺時間表手動輸入課程同上堂時段，或者使用獲授權嘅院校資料來源。",
    add: "加入",
    added: "已加入",
    remove: "移除",
    shortlistEmpty: "完成第一次搜尋之後，你加入嘅課程會顯示喺呢度。",
    chooseSection: "首選班別",
    section: "班別",
    sourceId: "來源編號",
    instructor: "教師",
    meetingTime: "上堂時間",
    notListed: "未列出",
    codeReason: "課程識別碼匹配",
    titleReason: "課程名稱匹配",
    facultyReason: "學術範疇匹配",
    instructorReason: "教師匹配",
    periodReason: "學期匹配",
    metadataReason: "課程目錄資料匹配",
    continueToTimetable: "繼續設定時間表",
    activeSessionRequired: "未能確認你目前嘅 ConCourse 登入狀態。請返去 ConCourse 登入後再試。",
    handoffFailed: "暫時未能將備選課程送到時間表。請再試一次。",
    handoffEmpty: "請先選擇至少一科有效課程。",
    courseKeyAdded: "已選擇 {title}，可以繼續檢查。",
    courseKeyNotFound: "嗰個課程引擎選項已經唔可用。請搜尋課程再揀另一個班別。",
    dataNote: "可能匹配項來自課程目錄參考資料。作出最終選擇之前，請向院校確認修讀資格、學分、先修要求、上堂時間同註冊狀態。"
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
