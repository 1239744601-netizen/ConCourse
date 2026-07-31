"use strict";

const COURSEKEYS_CAPABILITIES = Object.freeze({
  uploads: false,
  publishing: false,
  downloads: false,
  transactions: false,
});

const COPY = Object.freeze({
  en: Object.freeze({
    brandTag: "Conquer your courses",
    primaryDestinations: "Primary destinations",
    timetable: "Timetable",
    studentHub: "Student Hub",
    exploreCourses: "Courses",
    selectionAssistant: "Assistant",
    appearance: "Page appearance",
    useDay: "Use day appearance",
    useNight: "Use night appearance",
    day: "Day",
    night: "Night",
    language: "Website language",
    globalNotice: "Locked: uploads, public files, downloads, and transactions are unavailable.",
    readiness: "Safety Status",
    heroEyebrow: "Course Library",
    heroTitle: "Course resources. Built on trust.",
    heroDescription: "Browse course workspaces. Files stay locked until verification, scanning, moderation, quotas, deletion, and ledger controls are ready.",
    browseCourses: "Browse Courses",
    contributionLocked: "Contributions Locked",
    walletReadiness: "CourseKeys readiness",
    walletLabel: "CourseKeys Wallet",
    walletUnavailable: "Not Activated",
    available: "Available",
    pending: "Pending",
    walletExplanation: "Credits are disabled. The balance stays at zero.",
    transactionsDisabled: "Transactions Disabled",
    safetyBoundary: "Safety Boundary",
    readinessTitle: "Browse courses. Files stay locked.",
    d1Metadata: "Metadata Ready",
    r2Private: "Private Storage",
    downloads: "Downloads",
    transactions: "Transactions",
    notEnabled: "Not Enabled",
    privateArchiveAudit: "Private Archive",
    inventoryTitle: "Metadata only. No public files.",
    inventoryDescription: "Only totals and course metadata are shown. No files, filenames, paths, personal records, slides, or textbooks are published.",
    inventoryCoverage: "Inventory coverage",
    courseFolders: "Courses",
    localReferences: "Private References",
    outsideGit: "Outside Git",
    publishedWithoutReview: "Unreviewed Files",
    courseLinkedStorage: "Course Storage",
    chooseCoursePrompt: "Find a course workspace.",
    uploadsDisabled: "Uploads Disabled",
    libraryViews: "CourseKeys library views",
    courseInventory: "Courses",
    sharedLibrary: "Shared",
    myDrive: "My Drive",
    saved: "Saved",
    searchDrive: "Search",
    searchPlaceholder: "Course, source ID, faculty, instructor…",
    institution: "Institution",
    allInstitutions: "All Institutions",
    course: "Course",
    allCourses: "All Courses",
    loadingCatalogue: "Loading…",
    catalogueNotice: "A listing does not confirm eligibility.",
    safeguards: "CourseKeys safeguards",
    identityTitle: "Verified Identity",
    identityCopy: "Server-verified identity and current institution proof are required.",
    quarantineTitle: "Private Quarantine",
    quarantineCopy: "R2 stays private. No file bytes, public URLs, or storage keys are exposed.",
    reviewTitle: "Scan and Moderation",
    reviewCopy: "Publishing requires checksums, scans, rights review, and moderation.",
    ledgerTitle: "Enforced Ledger",
    ledgerCopy: "Credits stay locked until atomic, balanced, idempotent ledger rules are ready.",
    footerBoundary: "Metadata only · private storage · downloads and transactions off",
    launchControl: "Safety Status",
    readinessDialogTitle: "CourseKeys stays fail closed.",
    readinessDialogCopy: "Browsing is available. Contributions, publishing, files, and credits stay locked until all safeguards pass.",
    secureAuth: "Server Authentication",
    verificationEnforcement: "Institution Verification",
    quotasEnforcement: "Quotas and Rate Limits",
    scanEnforcement: "Scanning and Moderation",
    deletionEnforcement: "Deletion and Retention",
    ledgerEnforcement: "Balanced Ledger",
    required: "Required",
    understood: "Understood",
    close: "Close",
    results: "{count} courses",
    workspaceKicker: "{institution} · Source {source}",
    workspaceTitle: "{title}",
    workspaceDescription: "Private workspace. No files or downloads.",
    academicPeriod: "Term",
    faculty: "Faculty",
    instructor: "Instructor",
    notListed: "Not Listed",
    catalogueReference: "Catalogue",
    quarantineRequired: "Quarantine",
    noPublicFile: "No Public File",
    accessLocked: "Access Locked",
    lockedButton: "Safeguards Pending",
    chooseCourseTitle: "Choose a course",
    chooseCourseBody: "Use the filters above.",
    noResultsTitle: "No matches",
    noResultsBody: "Try a broader title, source ID, faculty, or instructor.",
    sharedTitle: "No shared resources",
    sharedBody: "Publishing and downloads are disabled.",
    driveTitle: "Contributions are locked",
    driveBody: "Files stay disabled until server authentication and storage controls are ready.",
    savedTitle: "Nothing saved",
    savedBody: "Saving is not available.",
    loadFailedTitle: "Catalogue unavailable",
    loadFailedBody: "Refresh and try again."
  }),
  "zh-CN": Object.freeze({
    brandTag: "轻松规划课程",
    primaryDestinations: "主要功能",
    timetable: "课表",
    studentHub: "学生中心",
    exploreCourses: "课程",
    selectionAssistant: "选课助手",
    appearance: "页面外观",
    useDay: "使用日间外观",
    useNight: "使用夜间外观",
    day: "日间",
    night: "夜间",
    language: "网站语言",
    globalNotice: "已锁定：上传、公开文件、下载及交易均未开放。",
    readiness: "安全状态",
    heroEyebrow: "课程资源库",
    heroTitle: "课程资源，安全为先",
    heroDescription: "可浏览课程空间。验证、扫描、审核、配额、删除及账本控制就绪前，文件保持锁定。",
    browseCourses: "浏览课程",
    contributionLocked: "贡献功能已锁定",
    walletReadiness: "CourseKeys 开放状态",
    walletLabel: "CourseKeys 钱包",
    walletUnavailable: "尚未启用",
    available: "可用",
    pending: "待处理",
    walletExplanation: "积分功能未开放，余额固定为零。",
    transactionsDisabled: "交易尚未开放",
    safetyBoundary: "安全边界",
    readinessTitle: "可浏览课程，文件保持锁定",
    d1Metadata: "元数据已就绪",
    r2Private: "私密储存",
    downloads: "下载",
    transactions: "交易",
    notEnabled: "尚未开放",
    privateArchiveAudit: "私密资料库",
    inventoryTitle: "仅限元数据，无公开文件",
    inventoryDescription: "只显示总数与课程元数据，不发布文件、文件名、路径、个人记录、讲义或教材。",
    inventoryCoverage: "资料库覆盖范围",
    courseFolders: "课程",
    localReferences: "私密记录",
    outsideGit: "Git 之外",
    publishedWithoutReview: "未审文件",
    courseLinkedStorage: "课程储存",
    chooseCoursePrompt: "查找课程空间。",
    uploadsDisabled: "上传尚未开放",
    libraryViews: "CourseKeys 资源库视图",
    courseInventory: "课程",
    sharedLibrary: "共享",
    myDrive: "我的云盘",
    saved: "已收藏",
    searchDrive: "搜索",
    searchPlaceholder: "课程、来源编号、学院、教师…",
    institution: "学校",
    allInstitutions: "所有学校",
    course: "课程",
    allCourses: "所有课程",
    loadingCatalogue: "正在载入…",
    catalogueNotice: "课程列表不代表具备修读资格。",
    safeguards: "CourseKeys 安全措施",
    identityTitle: "已验证身份",
    identityCopy: "必须通过服务器身份验证及有效学校证明。",
    quarantineTitle: "私密隔离区",
    quarantineCopy: "R2 保持私密，不公开文件内容、网址或储存密钥。",
    reviewTitle: "扫描与审核",
    reviewCopy: "发布前必须完成校验、扫描、权利审核及内容审核。",
    ledgerTitle: "受约束的账本",
    ledgerCopy: "原子化、平衡及防重复账本规则就绪前，积分保持锁定。",
    footerBoundary: "仅限元数据 · 私密储存 · 下载及交易关闭",
    launchControl: "安全状态",
    readinessDialogTitle: "CourseKeys 保持默认关闭",
    readinessDialogCopy: "可浏览课程。所有安全措施通过前，贡献、发布、文件及积分保持锁定。",
    secureAuth: "服务器身份验证",
    verificationEnforcement: "学校身份验证",
    quotasEnforcement: "配额与频率限制",
    scanEnforcement: "扫描与审核",
    deletionEnforcement: "删除与保留",
    ledgerEnforcement: "平衡账本",
    required: "必须完成",
    understood: "明白",
    close: "关闭",
    results: "{count} 门课程",
    workspaceKicker: "{institution} · 来源 {source}",
    workspaceDescription: "私密课程空间。没有文件或下载。",
    academicPeriod: "学期",
    faculty: "学院",
    instructor: "教师",
    notListed: "未列出",
    catalogueReference: "课程目录",
    quarantineRequired: "私密隔离",
    noPublicFile: "没有公开文件",
    accessLocked: "访问已锁定",
    lockedButton: "安全措施待完成",
    chooseCourseTitle: "选择一门课程",
    chooseCourseBody: "使用上方筛选器。",
    noResultsTitle: "没有匹配课程",
    noResultsBody: "请尝试更宽泛的名称、来源编号、学院或教师。",
    sharedTitle: "没有共享资源",
    sharedBody: "发布及下载均未开放。",
    driveTitle: "贡献功能已锁定",
    driveBody: "服务器身份验证及储存控制就绪前，不接收文件。",
    savedTitle: "没有收藏",
    savedBody: "收藏功能尚未开放。",
    loadFailedTitle: "课程目录不可用",
    loadFailedBody: "请刷新后重试。"
  }),
  "zh-HK": Object.freeze({
    brandTag: "輕鬆規劃課程",
    primaryDestinations: "主要功能",
    timetable: "時間表",
    studentHub: "學生中心",
    exploreCourses: "課程",
    selectionAssistant: "選科助手",
    appearance: "頁面外觀",
    useDay: "使用日間外觀",
    useNight: "使用夜間外觀",
    day: "日間",
    night: "夜間",
    language: "網站語言",
    globalNotice: "已鎖定：上載、公開檔案、下載同交易都未開放。",
    readiness: "安全狀態",
    heroEyebrow: "課程資源庫",
    heroTitle: "課程資源，安全為先",
    heroDescription: "可以瀏覽課程空間。驗證、掃描、審核、配額、刪除同帳本控制就緒之前，檔案保持鎖定。",
    browseCourses: "瀏覽課程",
    contributionLocked: "貢獻功能已鎖定",
    walletReadiness: "CourseKeys 開放狀態",
    walletLabel: "CourseKeys 銀包",
    walletUnavailable: "未啟用",
    available: "可用",
    pending: "待處理",
    walletExplanation: "積分功能未開放，餘額固定為零。",
    transactionsDisabled: "交易未開放",
    safetyBoundary: "安全邊界",
    readinessTitle: "可以瀏覽課程，檔案保持鎖定",
    d1Metadata: "元數據已就緒",
    r2Private: "私密儲存",
    downloads: "下載",
    transactions: "交易",
    notEnabled: "未開放",
    privateArchiveAudit: "私密資料庫",
    inventoryTitle: "只限元數據，冇公開檔案",
    inventoryDescription: "只顯示總數同課程元數據，唔會發佈檔案、檔案名、路徑、個人記錄、講義或教材。",
    inventoryCoverage: "資料庫覆蓋範圍",
    courseFolders: "課程",
    localReferences: "私密記錄",
    outsideGit: "Git 之外",
    publishedWithoutReview: "未審檔案",
    courseLinkedStorage: "課程儲存",
    chooseCoursePrompt: "搵課程空間。",
    uploadsDisabled: "上載未開放",
    libraryViews: "CourseKeys 資源庫檢視",
    courseInventory: "課程",
    sharedLibrary: "共享",
    myDrive: "我嘅雲端硬碟",
    saved: "已收藏",
    searchDrive: "搜尋",
    searchPlaceholder: "課程、來源編號、學院、教師…",
    institution: "院校",
    allInstitutions: "所有院校",
    course: "課程",
    allCourses: "所有課程",
    loadingCatalogue: "載入緊…",
    catalogueNotice: "課程列表唔代表具備修讀資格。",
    safeguards: "CourseKeys 安全措施",
    identityTitle: "已驗證身份",
    identityCopy: "必須通過伺服器身份驗證同有效院校證明。",
    quarantineTitle: "私密隔離區",
    quarantineCopy: "R2 保持私密，唔公開檔案內容、網址或儲存密鑰。",
    reviewTitle: "掃描同審核",
    reviewCopy: "發佈前必須完成校驗、掃描、權利審核同內容審核。",
    ledgerTitle: "受約束帳本",
    ledgerCopy: "原子化、平衡同防重複帳本規則就緒之前，積分保持鎖定。",
    footerBoundary: "只限元數據 · 私密儲存 · 下載同交易關閉",
    launchControl: "安全狀態",
    readinessDialogTitle: "CourseKeys 保持預設關閉",
    readinessDialogCopy: "可以瀏覽課程。所有安全措施通過之前，貢獻、發佈、檔案同積分保持鎖定。",
    secureAuth: "伺服器身份驗證",
    verificationEnforcement: "院校身份驗證",
    quotasEnforcement: "配額同頻率限制",
    scanEnforcement: "掃描同審核",
    deletionEnforcement: "刪除同保留",
    ledgerEnforcement: "平衡帳本",
    required: "必須完成",
    understood: "明白",
    close: "關閉",
    results: "{count} 門課程",
    workspaceKicker: "{institution} · 來源 {source}",
    workspaceDescription: "私人課程空間。冇檔案或下載。",
    academicPeriod: "學期",
    faculty: "學院",
    instructor: "教師",
    notListed: "未列出",
    catalogueReference: "課程目錄",
    quarantineRequired: "私密隔離",
    noPublicFile: "冇公開檔案",
    accessLocked: "存取已鎖定",
    lockedButton: "安全措施待完成",
    chooseCourseTitle: "揀一門課程",
    chooseCourseBody: "使用上面嘅篩選器。",
    noResultsTitle: "冇匹配課程",
    noResultsBody: "請試較寬泛嘅名稱、來源編號、學院或教師。",
    sharedTitle: "冇共享資源",
    sharedBody: "發佈同下載都未開放。",
    driveTitle: "貢獻功能已鎖定",
    driveBody: "伺服器身份驗證同儲存控制就緒之前，唔會接收檔案。",
    savedTitle: "冇收藏",
    savedBody: "收藏功能未開放。",
    loadFailedTitle: "課程目錄用唔到",
    loadFailedBody: "請重新整理再試。"
  })
});

const state = {
  language: "en",
  activeTab: "inventory",
  catalogue: null,
  audit: null,
  query: "",
  institutionId: "all",
  courseId: "all"
};

const byId = (id) => document.getElementById(id);

function t(key, variables = {}) {
  const dictionary = COPY[state.language] || COPY.en;
  let value = dictionary[key] ?? COPY.en[key] ?? key;
  for (const [name, replacement] of Object.entries(variables)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function escapeText(value) {
  return String(value ?? "");
}

function courseId(course) {
  return `${course.institutionId}:${course.sourceCourseId}`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GiB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function setTheme(theme) {
  const nextTheme = theme === "day" ? "day" : "night";
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme === "day" ? "light" : "dark";
  document.querySelectorAll("[data-theme-value]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.themeValue === nextTheme));
  });
  try {
    localStorage.setItem("concourse_theme", nextTheme);
  } catch (_error) {}
}

function applyLanguage(language) {
  state.language = ["en", "zh-CN", "zh-HK"].includes(language) ? language : "en";
  document.documentElement.lang = state.language;
  document.querySelectorAll("[data-copy]").forEach((element) => {
    element.textContent = t(element.dataset.copy);
  });
  document.querySelectorAll("[data-copy-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.copyAria));
  });
  document.querySelectorAll("[data-copy-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.copyPlaceholder));
  });
  byId("languageSelect").value = state.language;
  try {
    localStorage.setItem("concourse_language", state.language);
  } catch (_error) {}
  renderLibrary();
}

function filteredCourses() {
  const courses = state.catalogue?.courses || [];
  const query = normalize(state.query);
  return courses.filter((course) => {
    if (state.institutionId !== "all" && course.institutionId !== state.institutionId) {
      return false;
    }
    if (!query) return true;
    return normalize([
      course.title,
      course.sourceCourseId,
      course.faculty,
      course.instructor,
      course.academicPeriod,
      course.institutionName,
      ...(course.sections || [])
    ].join(" ")).includes(query);
  });
}

function buildOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function refreshInstitutionOptions() {
  const select = byId("institutionFilter");
  select.replaceChildren(buildOption("all", t("allInstitutions")));
  for (const institution of state.catalogue?.institutions || []) {
    select.append(buildOption(institution.id, institution.name));
  }
  select.value = state.institutionId;
}

function refreshCourseOptions() {
  const select = byId("courseFilter");
  const visible = filteredCourses();
  select.replaceChildren(buildOption("all", t("allCourses")));
  for (const course of visible) {
    select.append(
      buildOption(
        courseId(course),
        `${course.institutionShortName} ${course.sourceCourseId} · ${course.title}`
      )
    );
  }
  if (!visible.some((course) => courseId(course) === state.courseId)) {
    state.courseId = "all";
  }
  select.value = state.courseId;
  byId("resultCount").textContent = t("results", {
    count: visible.length.toLocaleString(state.language === "en" ? "en-GB" : state.language)
  });
}

function emptyState(title, body, symbol = "K", error = false) {
  const wrapper = document.createElement("div");
  wrapper.className = error ? "error-state" : "empty-state";
  const mark = document.createElement("span");
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = symbol;
  const heading = document.createElement("strong");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = body;
  wrapper.append(mark, heading, copy);
  return wrapper;
}

function metadataPill(label, value) {
  const pill = document.createElement("span");
  pill.textContent = `${label}: ${value || t("notListed")}`;
  return pill;
}

function trustPill(label, warning = false) {
  const pill = document.createElement("span");
  pill.className = `trust-badge${warning ? " warning" : ""}`;
  pill.textContent = label;
  return pill;
}

function workspaceCard(course) {
  const article = document.createElement("article");
  article.className = "course-workspace-card";

  const mark = document.createElement("div");
  mark.className = "resource-file-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "K";

  const copy = document.createElement("div");
  copy.className = "resource-card-copy";

  const kicker = document.createElement("div");
  kicker.className = "resource-card-kicker";
  const institution = document.createElement("span");
  institution.textContent = t("workspaceKicker", {
    institution: course.institutionShortName,
    source: course.sourceCourseId
  });
  const workspace = document.createElement("span");
  workspace.textContent = "CourseKeys";
  kicker.append(institution, workspace);

  const heading = document.createElement("h3");
  heading.textContent = escapeText(course.title);
  const description = document.createElement("p");
  description.textContent = t("workspaceDescription");

  const metadata = document.createElement("div");
  metadata.className = "resource-card-metadata";
  metadata.append(
    metadataPill(t("academicPeriod"), course.academicPeriod),
    metadataPill(t("faculty"), course.faculty),
    metadataPill(t("instructor"), course.instructor)
  );

  const trust = document.createElement("div");
  trust.className = "resource-trust-row";
  trust.append(
    trustPill(t("catalogueReference")),
    trustPill(t("quarantineRequired"), true),
    trustPill(t("noPublicFile"))
  );
  copy.append(kicker, heading, description, metadata, trust);

  const action = document.createElement("div");
  action.className = "resource-card-action";
  const status = document.createElement("strong");
  status.textContent = t("accessLocked");
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = true;
  button.textContent = t("lockedButton");
  action.append(status, button);

  article.append(mark, copy, action);
  return article;
}

function renderLibrary() {
  if (!state.catalogue) return;
  refreshInstitutionOptions();
  refreshCourseOptions();

  const list = byId("resourceList");
  list.setAttribute("aria-busy", "false");
  list.replaceChildren();

  if (state.activeTab === "shared") {
    list.append(emptyState(t("sharedTitle"), t("sharedBody")));
    return;
  }
  if (state.activeTab === "mine") {
    list.append(emptyState(t("driveTitle"), t("driveBody")));
    return;
  }
  if (state.activeTab === "saved") {
    list.append(emptyState(t("savedTitle"), t("savedBody")));
    return;
  }

  const visible = filteredCourses();
  const selected = state.catalogue.courses.find((course) => courseId(course) === state.courseId);
  if (selected) {
    byId("libraryTitle").textContent = `${selected.institutionShortName} ${selected.sourceCourseId} · ${selected.title}`;
    byId("librarySubtitle").textContent =
      `${selected.institutionName} · ${selected.academicPeriod || t("notListed")}`;
    list.append(workspaceCard(selected));
    return;
  }

  byId("libraryTitle").textContent = "CourseKeys";
  byId("librarySubtitle").textContent = t("chooseCoursePrompt");
  if (state.query && visible.length === 0) {
    list.append(emptyState(t("noResultsTitle"), t("noResultsBody")));
  } else {
    list.append(emptyState(t("chooseCourseTitle"), t("chooseCourseBody")));
  }
}

async function loadCatalogue() {
  try {
    const [catalogueResponse, auditResponse] = await Promise.all([
      fetch("data/course-catalogue.json", { cache: "no-store" }),
      fetch("data/course-material-seed.json", { cache: "no-store" })
    ]);
    if (!catalogueResponse.ok || !auditResponse.ok) {
      throw new Error("CourseKeys data unavailable");
    }
    state.catalogue = await catalogueResponse.json();
    state.audit = await auditResponse.json();

    byId("folderCount").textContent = Number(
      state.audit.scope.courseFolderCount
    ).toLocaleString("en-US");
    byId("inventoryCount").textContent = Number(
      state.audit.scope.inventoryCount
    ).toLocaleString("en-US");
    byId("inventoryBytes").textContent = formatBytes(state.audit.scope.inventoryBytes);
    byId("publishedCount").textContent = Number(
      state.audit.scope.publishedFileCount
    ).toLocaleString("en-US");

    const params = new URLSearchParams(location.search);
    const requestedCourse = params.get("courseKey");
    const requestedInstitution = params.get("institutionId");
    const requestedTitle = normalize(params.get("courseTitle"));
    if (requestedInstitution) state.institutionId = requestedInstitution;
    const match = state.catalogue.courses.find((course) => {
      if (requestedCourse && courseId(course) === requestedCourse) return true;
      if (!requestedTitle) return false;
      const title = normalize(course.title);
      return title === requestedTitle || title.includes(requestedTitle) || requestedTitle.includes(title);
    });
    if (match) {
      state.institutionId = match.institutionId;
      state.courseId = courseId(match);
    }
    renderLibrary();
  } catch (error) {
    console.error("CourseKeys catalogue failed to load", error);
    const list = byId("resourceList");
    list.setAttribute("aria-busy", "false");
    list.replaceChildren(
      emptyState(t("loadFailedTitle"), t("loadFailedBody"), "!", true)
    );
    byId("resultCount").textContent = t("loadFailedTitle");
  }
}

function initialize() {
  if (
    COURSEKEYS_CAPABILITIES.uploads ||
    COURSEKEYS_CAPABILITIES.publishing ||
    COURSEKEYS_CAPABILITIES.downloads ||
    COURSEKEYS_CAPABILITIES.transactions
  ) {
    throw new Error("CourseKeys integration must remain fail closed.");
  }

  document.querySelectorAll("[data-theme-value]").forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.themeValue));
  });
  setTheme(document.documentElement.dataset.theme);

  let savedLanguage = "en";
  try {
    savedLanguage = localStorage.getItem("concourse_language") || "en";
  } catch (_error) {}
  byId("languageSelect").addEventListener("change", (event) => {
    applyLanguage(event.currentTarget.value);
  });

  byId("courseSearch").addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    renderLibrary();
  });
  byId("institutionFilter").addEventListener("change", (event) => {
    state.institutionId = event.currentTarget.value;
    state.courseId = "all";
    renderLibrary();
  });
  byId("courseFilter").addEventListener("change", (event) => {
    state.courseId = event.currentTarget.value;
    renderLibrary();
  });

  document.querySelectorAll("[data-library-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeTab = tab.dataset.libraryTab;
      document.querySelectorAll("[data-library-tab]").forEach((candidate) => {
        candidate.setAttribute("aria-selected", String(candidate === tab));
      });
      renderLibrary();
    });
  });

  const dialog = byId("readinessDialog");
  const openDialog = () => {
    if (typeof dialog.showModal === "function") dialog.showModal();
  };
  byId("openReadiness").addEventListener("click", openDialog);
  byId("explainContribution").addEventListener("click", openDialog);

  applyLanguage(savedLanguage);
  void loadCatalogue();
}

initialize();
