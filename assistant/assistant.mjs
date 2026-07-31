import {
  initializeCourseChrome,
  loadCourseCatalogue,
  localeForLanguage,
  searchCourseGroups
} from "../course-tools/course-tools.mjs";

const SHORTLIST_KEY = "concourse_course_selection_shortlist_v1";

const COPY = Object.freeze({
  en: Object.freeze({
    pageTitle: "Course Selection Assistant",
    searchLabel: "Tell the assistant what you want to study",
    searchPlaceholder: "What do you want to study this semester?",
    resultsTitle: "Possible Matches",
    shortlistTitle: "Your Shortlist",
    loading: "Finding possible matches…",
    resultsCount: "{count} possible matches",
    noResults: "No possible matches were found. Try a course title, academic area, instructor, semester, or section.",
    loadFailed: "The course catalogue could not be loaded. Please refresh and try again.",
    add: "Add",
    added: "Added",
    remove: "Remove",
    shortlistEmpty: "Courses you add will appear here after your first search.",
    chooseSection: "Preferred Section",
    section: "Section",
    sourceId: "Source ID",
    instructor: "Instructor",
    notListed: "Not listed",
    codeReason: "Course identifier match",
    titleReason: "Course title match",
    facultyReason: "Academic area match",
    instructorReason: "Instructor match",
    periodReason: "Semester match",
    metadataReason: "Catalogue metadata match",
    dataNote: "Possible matches use reference catalogue metadata. Confirm eligibility, credits, prerequisites, meeting times, and registration status with your institution before making a final choice."
  }),
  "zh-CN": Object.freeze({
    pageTitle: "选课助手",
    searchLabel: "告诉选课助手你想学习什么",
    searchPlaceholder: "这个学期你想学习什么？",
    resultsTitle: "可能适合的课程",
    shortlistTitle: "你的备选课程",
    loading: "正在查找可能适合的课程…",
    resultsCount: "找到 {count} 个可能匹配项",
    noResults: "没有找到可能匹配的课程。请尝试输入课程名称、学术领域、教师、学期或班别。",
    loadFailed: "课程目录暂时无法载入。请刷新页面后重试。",
    add: "加入",
    added: "已加入",
    remove: "移除",
    shortlistEmpty: "完成第一次搜索后，你加入的课程会显示在这里。",
    chooseSection: "首选班别",
    section: "班别",
    sourceId: "来源编号",
    instructor: "教师",
    notListed: "未列出",
    codeReason: "课程标识匹配",
    titleReason: "课程名称匹配",
    facultyReason: "学术领域匹配",
    instructorReason: "教师匹配",
    periodReason: "学期匹配",
    metadataReason: "课程目录资料匹配",
    dataNote: "可能匹配项来自课程目录参考资料。作出最终选择前，请向学校确认修读资格、学分、先修要求、上课时间及注册状态。"
  }),
  "zh-HK": Object.freeze({
    pageTitle: "選科助手",
    searchLabel: "話俾選科助手知你想讀咩",
    searchPlaceholder: "今個學期你想讀咩？",
    resultsTitle: "可能適合嘅課程",
    shortlistTitle: "你嘅備選課程",
    loading: "正在搵可能適合嘅課程…",
    resultsCount: "搵到 {count} 個可能匹配項",
    noResults: "搵唔到可能匹配嘅課程。請試下輸入課程名稱、學術範疇、教師、學期或班別。",
    loadFailed: "課程目錄暫時載入唔到。請重新整理頁面再試。",
    add: "加入",
    added: "已加入",
    remove: "移除",
    shortlistEmpty: "完成第一次搜尋之後，你加入嘅課程會顯示喺呢度。",
    chooseSection: "首選班別",
    section: "班別",
    sourceId: "來源編號",
    instructor: "教師",
    notListed: "未列出",
    codeReason: "課程識別碼匹配",
    titleReason: "課程名稱匹配",
    facultyReason: "學術範疇匹配",
    instructorReason: "教師匹配",
    periodReason: "學期匹配",
    metadataReason: "課程目錄資料匹配",
    dataNote: "可能匹配項來自課程目錄參考資料。作出最終選擇之前，請向院校確認修讀資格、學分、先修要求、上堂時間同註冊狀態。"
  })
});

const state = {
  catalogue: null,
  query: "",
  results: [],
  selections: new Map()
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
  return group.entries.flatMap((entry) => {
    const sections = entry.sections.length ? entry.sections : [""];
    return sections.map((section) => ({
      id: `${entry.id}::${section}`,
      section,
      instructor: entry.instructor,
      sourceCourseId: entry.sourceCourseId
    }));
  });
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
      saveSelections();
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

function renderShortlist() {
  const shortlist = byId("assistantShortlist");
  shortlist.replaceChildren();
  const groupsById = new Map(
    (state.catalogue?.groups || []).map((group) => [group.id, group])
  );
  let rendered = 0;
  for (const [groupId, choiceId] of state.selections) {
    const group = groupsById.get(groupId);
    if (!group) continue;
    shortlist.append(shortlistItem(group, choiceId));
    rendered += 1;
  }
  if (!rendered) {
    shortlist.append(
      element("p", "assistant-shortlist-empty", chrome.t("shortlistEmpty"))
    );
  }
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
  if (!state.catalogue) state.catalogue = await loadCourseCatalogue();
  return state.catalogue;
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
    console.error("ConCourse course selection assistant failed", error);
    state.results = [];
    document.body.classList.add("has-course-results");
    byId("assistantWorkspace").hidden = false;
    byId("assistantResults").replaceChildren(
      element("div", "course-empty-state", chrome.t("loadFailed"))
    );
    byId("assistantShortlist").replaceChildren();
    byId("assistantStatus").textContent = chrome.t("loadFailed");
  } finally {
    submit.disabled = false;
  }
});
