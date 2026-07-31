"use strict";

const COURSEKEYS_CAPABILITIES = Object.freeze({
  uploads: false,
  publishing: false,
  downloads: false,
  transactions: false,
});

const COPY = Object.freeze({
  en: Object.freeze({
    brandTag: "Conquer your course registrations",
    primaryDestinations: "Primary destinations",
    timetable: "Timetable",
    studentHub: "Student Hub",
    exploreCourses: "Explore Courses",
    selectionAssistant: "Course Selection Assistant",
    appearance: "Page appearance",
    useDay: "Use day appearance",
    useNight: "Use night appearance",
    day: "Day",
    night: "Night",
    language: "Website language",
    globalNotice: "Safety-gated integration · uploads, public files, downloads, exchanges, and CourseKeys transactions are unavailable.",
    readiness: "View Readiness",
    heroEyebrow: "ConCourse Contribution Library",
    heroTitle: "Your course drive. Built on trust.",
    heroDescription: "Find course workspaces today. Resource access will open only after identity verification, safety scanning, moderation, quotas, deletion controls, and ledger enforcement are complete.",
    browseCourses: "Browse Course Workspaces",
    contributionLocked: "Contribution Workflow Locked",
    walletReadiness: "CourseKeys readiness",
    walletLabel: "CourseKeys Wallet",
    walletUnavailable: "Not Activated",
    available: "Available",
    pending: "Pending",
    walletExplanation: "No credits can be issued, purchased, transferred, or spent. This balance is intentionally fixed at zero.",
    transactionsDisabled: "Transactions Disabled",
    safetyBoundary: "Safety Boundary",
    readinessTitle: "The library is visible. File access is not.",
    d1Metadata: "Metadata Model Retained",
    r2Private: "Private Quarantine Retained",
    downloads: "Downloads",
    transactions: "Transactions",
    notEnabled: "Not Enabled",
    privateArchiveAudit: "Private Archive Audit",
    inventoryTitle: "A real library model, without unsafe publishing.",
    inventoryDescription: "ConCourse retained aggregate inventory totals and source-aware course metadata only. No original file, filename, local path, personal record, lecture deck, or textbook is deployed here.",
    inventoryCoverage: "Inventory coverage",
    courseFolders: "Course Folders",
    localReferences: "Local File References",
    outsideGit: "Kept Outside Git",
    publishedWithoutReview: "Published Without Review",
    courseLinkedStorage: "Course-Linked Storage",
    chooseCoursePrompt: "Search the source-aware catalogue and open a course workspace.",
    uploadsDisabled: "Uploads Disabled",
    libraryViews: "CourseKeys library views",
    courseInventory: "Course Inventory",
    sharedLibrary: "Shared Library",
    myDrive: "My Drive",
    saved: "Saved",
    searchDrive: "Search This Drive",
    searchPlaceholder: "Course, source ID, faculty, instructor…",
    institution: "Institution",
    allInstitutions: "All Supported Institutions",
    course: "Course",
    allCourses: "All Catalogue Courses",
    loadingCatalogue: "Loading Catalogue…",
    catalogueNotice: "Catalogue presence does not confirm registration eligibility.",
    safeguards: "CourseKeys safeguards",
    identityTitle: "Verified Identity",
    identityCopy: "A server-verified Supabase identity and current institution proof are required before any contribution path can open.",
    quarantineTitle: "Private Quarantine",
    quarantineCopy: "R2 remains private. No route reads object bytes, creates a public URL, or returns a storage key.",
    reviewTitle: "Scan and Moderation",
    reviewCopy: "Publication remains impossible until immutable checksums, safety scans, rights review, and moderator audit are enforced.",
    ledgerTitle: "Enforced Ledger",
    ledgerCopy: "No CourseKeys can move until balanced, atomic, idempotent ledger posting and reversal rules are complete.",
    footerBoundary: "D1 metadata · private R2 quarantine · public downloads and transactions disabled",
    launchControl: "Launch Control",
    readinessDialogTitle: "CourseKeys remains fail closed.",
    readinessDialogCopy: "The course catalogue is available for exploration. Contributions, publication, file access, and credit activity will remain locked until every required safeguard is implemented and tested.",
    secureAuth: "Server-Side Supabase Authentication",
    verificationEnforcement: "Current Verification Enforcement",
    quotasEnforcement: "Atomic Quotas and Rate Limits",
    scanEnforcement: "Scanning and Moderation Audit",
    deletionEnforcement: "Deletion, Retention, and Orphan Cleanup",
    ledgerEnforcement: "Balanced Ledger Enforcement",
    required: "Required",
    understood: "Understood",
    close: "Close",
    results: "{count} catalogue courses",
    workspaceKicker: "{institution} · Source {source}",
    workspaceTitle: "{title}",
    workspaceDescription: "This source-aware workspace is ready for future private contributions. No original resource file is deployed, and no download route exists.",
    academicPeriod: "Academic Period",
    faculty: "Faculty",
    instructor: "Instructor",
    notListed: "Not Listed",
    catalogueReference: "Catalogue Reference",
    quarantineRequired: "Quarantine Required",
    noPublicFile: "No Public File",
    accessLocked: "Access Locked",
    lockedButton: "Safeguards Incomplete",
    chooseCourseTitle: "Choose a course to open its workspace.",
    chooseCourseBody: "Use the filters above. The list comes from the complete source-aware catalogue, not from a student's private course history.",
    noResultsTitle: "No course matches these filters.",
    noResultsBody: "Try a broader course title, source ID, faculty, or instructor.",
    sharedTitle: "No shared resources are available.",
    sharedBody: "Publication and downloads remain disabled until verification, scanning, moderation, quotas, deletion, and ledger enforcement are complete.",
    driveTitle: "Private contributions are not active yet.",
    driveBody: "The D1 metadata model and private R2 quarantine binding are retained, but this site will not accept files until server authentication and storage controls are complete.",
    savedTitle: "No resources can be saved yet.",
    savedBody: "Saving and access controls will open only with the verified download and entitlement system.",
    loadFailedTitle: "The CourseKeys catalogue is unavailable.",
    loadFailedBody: "Refresh the page to try loading the local catalogue again."
  }),
  "zh-CN": Object.freeze({
    brandTag: "轻松规划课程注册",
    primaryDestinations: "主要功能",
    timetable: "课表",
    studentHub: "学生中心",
    exploreCourses: "探索课程",
    selectionAssistant: "选课助手",
    appearance: "页面外观",
    useDay: "使用日间外观",
    useNight: "使用夜间外观",
    day: "日间",
    night: "夜间",
    language: "网站语言",
    globalNotice: "安全限制已启用 · 上传、公开文件、下载、兑换及 CourseKeys 交易目前均未开放。",
    readiness: "查看开放条件",
    heroEyebrow: "ConCourse 课程资源库",
    heroTitle: "你的课程云盘，以信任为基础",
    heroDescription: "目前可浏览课程空间。只有在身份验证、安全扫描、内容审核、配额、删除机制和账本规则全部完成后，资源访问才会开放。",
    browseCourses: "浏览课程空间",
    contributionLocked: "贡献流程尚未开放",
    walletReadiness: "CourseKeys 开放状态",
    walletLabel: "CourseKeys 钱包",
    walletUnavailable: "尚未启用",
    available: "可用",
    pending: "待处理",
    walletExplanation: "目前不能发放、购买、转移或使用任何积分；余额会固定显示为零。",
    transactionsDisabled: "交易尚未开放",
    safetyBoundary: "安全边界",
    readinessTitle: "可以浏览资源库，但不能访问文件",
    d1Metadata: "保留元数据模型",
    r2Private: "保留私密隔离区",
    downloads: "下载",
    transactions: "交易",
    notEnabled: "尚未开放",
    privateArchiveAudit: "私密资料库审查",
    inventoryTitle: "真实的资源库模型，不进行不安全发布",
    inventoryDescription: "ConCourse 只保留汇总的资料规模与可追溯课程元数据。本网站没有部署原文件、文件名、本地路径、个人记录、讲义或教材。",
    inventoryCoverage: "资料库覆盖范围",
    courseFolders: "课程文件夹",
    localReferences: "本地文件记录",
    outsideGit: "未存入 Git",
    publishedWithoutReview: "未经审核发布",
    courseLinkedStorage: "按课程整理的储存空间",
    chooseCoursePrompt: "搜索可追溯的课程目录，并打开课程空间。",
    uploadsDisabled: "上传尚未开放",
    libraryViews: "CourseKeys 资源库视图",
    courseInventory: "课程目录",
    sharedLibrary: "共享资源库",
    myDrive: "我的云盘",
    saved: "已收藏",
    searchDrive: "搜索资源库",
    searchPlaceholder: "课程、来源编号、学院、教师…",
    institution: "学校",
    allInstitutions: "所有已支持学校",
    course: "课程",
    allCourses: "所有目录课程",
    loadingCatalogue: "正在载入课程目录…",
    catalogueNotice: "出现在目录中不代表学生有资格注册该课程。",
    safeguards: "CourseKeys 安全措施",
    identityTitle: "已验证身份",
    identityCopy: "任何贡献流程开放前，都必须由服务器验证 Supabase 身份及有效的学校证明。",
    quarantineTitle: "私密隔离区",
    quarantineCopy: "R2 保持私密。没有任何路由可以读取文件内容、生成公开网址或返回储存密钥。",
    reviewTitle: "扫描与审核",
    reviewCopy: "在不可变校验值、安全扫描、权利审核及管理员审计完整执行前，资源无法发布。",
    ledgerTitle: "受约束的账本",
    ledgerCopy: "只有在平衡、原子化及可防重复的记账与冲正规则完成后，CourseKeys 才能流转。",
    footerBoundary: "D1 元数据 · 私密 R2 隔离区 · 公开下载和交易均未开放",
    launchControl: "开放条件",
    readinessDialogTitle: "CourseKeys 维持默认关闭",
    readinessDialogCopy: "课程目录目前可供浏览。在每项安全措施完成并通过测试前，贡献、发布、文件访问及积分活动均保持锁定。",
    secureAuth: "服务器端 Supabase 身份验证",
    verificationEnforcement: "有效学校身份强制检查",
    quotasEnforcement: "原子化配额与频率限制",
    scanEnforcement: "扫描与审核记录",
    deletionEnforcement: "删除、保留期限与孤立文件清理",
    ledgerEnforcement: "平衡账本规则",
    required: "必须完成",
    understood: "明白",
    close: "关闭",
    results: "{count} 门目录课程",
    workspaceKicker: "{institution} · 来源 {source}",
    workspaceDescription: "此课程空间为未来的私密贡献做好准备。网站没有部署任何原始资源文件，也不存在下载路由。",
    academicPeriod: "学期",
    faculty: "学院",
    instructor: "教师",
    notListed: "未列出",
    catalogueReference: "目录记录",
    quarantineRequired: "必须经过隔离",
    noPublicFile: "没有公开文件",
    accessLocked: "访问已锁定",
    lockedButton: "安全措施尚未完成",
    chooseCourseTitle: "请选择一门课程以打开课程空间",
    chooseCourseBody: "使用上方筛选器。列表来自完整且可追溯的课程目录，不来自任何学生的私人选课记录。",
    noResultsTitle: "没有符合筛选条件的课程",
    noResultsBody: "请尝试更宽泛的课程名称、来源编号、学院或教师。",
    sharedTitle: "目前没有可用的共享资源",
    sharedBody: "在验证、扫描、审核、配额、删除和账本规则全部完成前，发布与下载均保持关闭。",
    driveTitle: "私密贡献功能尚未启用",
    driveBody: "D1 元数据模型与私密 R2 隔离绑定已保留，但在服务器身份验证及储存控制完成前，本网站不会接收文件。",
    savedTitle: "目前无法收藏资源",
    savedBody: "收藏与访问控制将与经验证的下载和使用权系统一同开放。",
    loadFailedTitle: "CourseKeys 课程目录暂时无法使用",
    loadFailedBody: "请刷新页面，再次尝试载入本地课程目录。"
  }),
  "zh-HK": Object.freeze({
    brandTag: "輕鬆規劃課程註冊",
    primaryDestinations: "主要功能",
    timetable: "時間表",
    studentHub: "學生中心",
    exploreCourses: "探索課程",
    selectionAssistant: "選科助手",
    appearance: "頁面外觀",
    useDay: "使用日間外觀",
    useNight: "使用夜間外觀",
    day: "日間",
    night: "夜間",
    language: "網站語言",
    globalNotice: "安全限制已啟用 · 上載、公開檔案、下載、兌換同 CourseKeys 交易而家都未開放。",
    readiness: "查看開放條件",
    heroEyebrow: "ConCourse 課程資源庫",
    heroTitle: "你嘅課程雲端硬碟，以信任為基礎",
    heroDescription: "而家可以瀏覽課程空間。只有身份驗證、安全掃描、內容審核、配額、刪除機制同帳本規則全部完成，先會開放資源存取。",
    browseCourses: "瀏覽課程空間",
    contributionLocked: "貢獻流程未開放",
    walletReadiness: "CourseKeys 開放狀態",
    walletLabel: "CourseKeys 銀包",
    walletUnavailable: "未啟用",
    available: "可用",
    pending: "待處理",
    walletExplanation: "而家唔可以發放、購買、轉移或使用任何積分；餘額會固定顯示為零。",
    transactionsDisabled: "交易未開放",
    safetyBoundary: "安全邊界",
    readinessTitle: "可以瀏覽資源庫，但唔可以存取檔案",
    d1Metadata: "保留元數據模型",
    r2Private: "保留私密隔離區",
    downloads: "下載",
    transactions: "交易",
    notEnabled: "未開放",
    privateArchiveAudit: "私密資料庫審查",
    inventoryTitle: "真實資源庫模型，唔進行不安全發佈",
    inventoryDescription: "ConCourse 只保留匯總嘅資料規模同可追溯課程元數據。網站冇部署原始檔案、檔案名、本機路徑、個人記錄、講義或教材。",
    inventoryCoverage: "資料庫覆蓋範圍",
    courseFolders: "課程資料夾",
    localReferences: "本機檔案記錄",
    outsideGit: "未存入 Git",
    publishedWithoutReview: "未經審核發佈",
    courseLinkedStorage: "按課程整理嘅儲存空間",
    chooseCoursePrompt: "搜尋可追溯嘅課程目錄，再打開課程空間。",
    uploadsDisabled: "上載未開放",
    libraryViews: "CourseKeys 資源庫檢視",
    courseInventory: "課程目錄",
    sharedLibrary: "共享資源庫",
    myDrive: "我嘅雲端硬碟",
    saved: "已收藏",
    searchDrive: "搜尋資源庫",
    searchPlaceholder: "課程、來源編號、學院、教師…",
    institution: "院校",
    allInstitutions: "所有已支援院校",
    course: "課程",
    allCourses: "所有目錄課程",
    loadingCatalogue: "載入緊課程目錄…",
    catalogueNotice: "出現喺目錄唔代表學生有資格註冊嗰門課。",
    safeguards: "CourseKeys 安全措施",
    identityTitle: "已驗證身份",
    identityCopy: "任何貢獻流程開放前，都必須由伺服器驗證 Supabase 身份同有效院校證明。",
    quarantineTitle: "私密隔離區",
    quarantineCopy: "R2 保持私密。冇任何路由可以讀取檔案內容、建立公開網址或傳回儲存密鑰。",
    reviewTitle: "掃描同審核",
    reviewCopy: "喺不可變校驗值、安全掃描、權利審核同管理員審計完整執行之前，資源唔可以發佈。",
    ledgerTitle: "受約束帳本",
    ledgerCopy: "只有平衡、原子化同防重複嘅記帳及沖正規則完成，CourseKeys 先可以流轉。",
    footerBoundary: "D1 元數據 · 私密 R2 隔離區 · 公開下載同交易都未開放",
    launchControl: "開放條件",
    readinessDialogTitle: "CourseKeys 維持預設關閉",
    readinessDialogCopy: "課程目錄而家可以瀏覽。每項安全措施完成兼通過測試之前，貢獻、發佈、檔案存取同積分活動都會保持鎖定。",
    secureAuth: "伺服器端 Supabase 身份驗證",
    verificationEnforcement: "有效院校身份強制檢查",
    quotasEnforcement: "原子化配額同頻率限制",
    scanEnforcement: "掃描同審核記錄",
    deletionEnforcement: "刪除、保留期限同孤立檔案清理",
    ledgerEnforcement: "平衡帳本規則",
    required: "必須完成",
    understood: "明白",
    close: "關閉",
    results: "{count} 門目錄課程",
    workspaceKicker: "{institution} · 來源 {source}",
    workspaceDescription: "呢個課程空間已為將來嘅私密貢獻做好準備。網站冇部署任何原始資源檔案，亦冇下載路由。",
    academicPeriod: "學期",
    faculty: "學院",
    instructor: "教師",
    notListed: "未列出",
    catalogueReference: "目錄記錄",
    quarantineRequired: "必須經過隔離",
    noPublicFile: "冇公開檔案",
    accessLocked: "存取已鎖定",
    lockedButton: "安全措施未完成",
    chooseCourseTitle: "請揀一門課程打開課程空間",
    chooseCourseBody: "使用上面嘅篩選器。列表來自完整而且可追溯嘅課程目錄，唔係任何學生嘅私人選科記錄。",
    noResultsTitle: "冇符合篩選條件嘅課程",
    noResultsBody: "請試下較寬泛嘅課程名稱、來源編號、學院或教師。",
    sharedTitle: "而家冇可用嘅共享資源",
    sharedBody: "驗證、掃描、審核、配額、刪除同帳本規則全部完成之前，發佈同下載都會保持關閉。",
    driveTitle: "私密貢獻功能未啟用",
    driveBody: "D1 元數據模型同私密 R2 隔離綁定已保留，但伺服器身份驗證同儲存控制完成之前，網站唔會接收檔案。",
    savedTitle: "而家未能收藏資源",
    savedBody: "收藏同存取控制會同經驗證嘅下載及使用權系統一齊開放。",
    loadFailedTitle: "CourseKeys 課程目錄暫時用唔到",
    loadFailedBody: "請重新整理頁面，再試載入本機課程目錄。"
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
