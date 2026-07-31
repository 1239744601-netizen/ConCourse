(() => {
  "use strict";

  const PORTAL_URL = "https://buniport.hkbu.edu.hk/";
  const SNAPSHOT_EVENT = "concourse:hkbu-portal-snapshot";
  const INSTITUTION_CONTEXT_EVENT = "concourse:institution-context";
  const STATUS_KEY = "concourse_hkbu_portal_status_v1";
  const DEFAULT_CONFIG = {
    catalogueManifestUrl:"data/hkbu-catalogue-current.json",
    catalogueUrl:"data/hkbu-2026-27-s1-catalog.json",
    browserHelperUrl:"downloads/concourse-hkbu-portal-connector.zip",
    supportedSchoolKeys:["ror:0145fw131", "domain:hkbu.edu.hk", "domain:life.hkbu.edu.hk"],
    personalImportEnabled:true,
    officialSsoEnabled:false,
    officialSsoStartUrl:"",
    staleAfterDays:14
  };
  const config = Object.freeze({...DEFAULT_CONFIG, ...(window.CONCOURSE_HKBU_CONFIG || {})});
  const state = {
    snapshot:null,
    contribution:null,
    catalogue:null,
    catalogueManifest:null,
    cataloguePromise:null,
    catalogueAttempted:false,
    catalogueRequestId:0,
    catalogueDelivery:"",
    catalogueTermMatches:false,
    assigned:[],
    allCandidates:[],
    candidates:[],
    unresolved:[],
    selected:new Set(),
    processing:false,
    privateMutation:false,
    snapshotRequestId:0,
    plannerImportRequestId:0,
    remoteRequestId:0,
    remoteLoadedFor:null,
    statusLoadedFor:null,
    lastStatus:null,
    institutionSignature:""
  };

  const COPY = {
    en:{
      kicker:"Semester course information",
      title:"Verify your institution to see semester courses",
      verifiedTitle:"{school} semester course catalogue",
      unsupportedTitle:"Student status verified for {school}",
      description:"Verify your student status to view your institution’s semester courses.",
      supportedDescription:"Browse {school}’s reference catalogue. Personal academic import is optional.",
      unsupportedDescription:"No semester catalogue is available for {school} yet.",
      verificationRequired:"Student-status verification required",
      verificationRequiredDetail:"Verify your current institution membership to see the matching semester catalogue.",
      verifiedInstitution:"Student status verified",
      connectorUnavailable:"Semester catalogue not available yet",
      connectorRequired:"Verify a supported institution before using its course data.",
      verificationSectionUnavailable:"Student-verification controls are available in Privacy and Safety on this Profile page.",
      catalogueTrust:"Reference catalogue",
      catalogueLoading:"Loading semester catalogue",
      catalogueAvailable:"Semester reference catalogue available",
      disconnected:"No personal course snapshot imported",
      readyReview:"Personal course snapshot ready for review",
      synced:"Personal course snapshot imported",
      stale:"Personal course snapshot may be stale",
      localTrust:"User-imported · not independently verified",
      officialTrust:"Institution-provided academic data",
      verifyOfficial:"Use institution-provided academic source",
      verifyStudent:"Verify student status",
      browseCatalogue:"Browse semester courses",
      openPortal:"Open student portal (optional)",
      importFile:"Import my course snapshot",
      installHelper:"Get optional import helper",
      disconnect:"Remove imported academic data",
      neverCredentials:"ConCourse never asks for institution passwords, MFA codes, recovery codes, or portal cookies.",
      privacyTitle:"How is course information used?",
      privacyItems:[
        "The shared semester catalogue works without access to your personal student portal.",
        "Optional private import: programme, major, study year, assigned courses, completed-course codes, and remaining requirements.",
        "Excluded: passwords, multifactor-authentication material, cookies, raw portal HTML, grades, student number, legal name, and financial records."
      ],
      plannerKicker:"Semester course catalogue",
      plannerTitle:"Semester reference catalogue",
      plannerDescription:"Search the shared catalogue. Personal academic import is optional.",
      catalogueSearch:"Search the semester catalogue",
      catalogueSearchPlaceholder:"Course code, title, school, or department",
      catalogueLoadingList:"Loading the semester reference catalogue…",
      catalogueEmpty:"No course matches this catalogue search.",
      catalogueResults:"Showing {shown} of {total} matching courses",
      catalogueTerm:"Semester",
      catalogueCourses:"Courses",
      catalogueSections:"Sections",
      catalogueReference:"Reference captured",
      cataloguePublication:"Publication status",
      catalogueSource:"Source",
      catalogueDisclaimer:"Reference only. Confirm availability, eligibility, quota, and registration in the official system.",
      catalogueNoRestriction:"Eligibility and restrictions must be confirmed with the institution.",
      personalKicker:"Optional personal guidance",
      personalTitle:"Assigned courses and possible requirement matches",
      personalDescription:"Import a private snapshot to mark assigned courses and possible requirement matches.",
      noSnapshot:"No personal snapshot imported. You can still browse the catalogue.",
      assigned:"Assigned to you",
      possible:"Possible requirement matches",
      unresolved:"Needs confirmation",
      captured:"Captured",
      catalogueAsOf:"Catalogue as of",
      courseSearch:"Search my possible courses",
      courseSearchPlaceholder:"Course code or title",
      noSearchMatches:"No match. Check the official system for restrictions or unscheduled courses.",
      selectedCount:"{count} courses selected for the planner",
      privateConsent:"Use this snapshot privately to personalize my ConCourse planner.",
      catalogueConsent:"Optional: contribute de-identified course facts to improve future catalogue versions. This does not affect catalogue access.",
      catalogueTermRequired:"Catalogue sharing needs an unambiguous academic term.",
      importSelected:"Add selected courses to planner",
      processing:"Checking the snapshot and current catalogue…",
      privateOperationBusy:"Another private-data operation is still finishing. Try again in a moment.",
      invalidSnapshot:"This snapshot could not be validated. No planner or account data was changed.",
      catalogueUnavailable:"The semester reference catalogue is currently unavailable. An imported assigned-course snapshot can still be reviewed.",
      catalogueTermMismatch:"The bundled catalogue is for a different semester. Assigned courses can still be reviewed.",
      personalTermMismatch:"Planner import is disabled because the private snapshot does not match the displayed catalogue semester.",
      catalogueRetry:"Retry catalogue",
      importReady:"Review the imported information and choose which possible requirement matches to add.",
      imported:"Courses were added to your planner.",
      importPartial:"Some courses had no usable meeting time and were left for review.",
      consentRequired:"Confirm private planner use before importing.",
      signInRequired:"Sign in to ConCourse before saving a private academic import.",
      remoteUnavailable:"Private academic-snapshot storage is not installed yet; selected planner courses were still saved normally.",
      disconnectedDone:"Your private imported academic data was removed. The shared semester catalogue remains available.",
      disconnectConfirm:"Remove your private imported academic snapshot? The shared semester catalogue will remain available.",
      fileTooLarge:"Choose a JSON snapshot smaller than 8 MB.",
      fileInvalid:"That file is not a valid ConCourse academic snapshot.",
      snapshotReceived:"Private academic snapshot received from the optional import helper.",
      noScheduledCandidates:"No courses with usable meeting times were found in this snapshot.",
      assignedReason:"Assigned in imported student record",
      estimateReason:"Possible requirement match · confirm with institution",
      officialUnavailable:"No official live feed is configured; the reference snapshot is shown."
    },
    "zh-CN":{
      kicker:"学期课程资料", title:"验证院校后查看学期课程", verifiedTitle:"{school} 学期课程目录", unsupportedTitle:"已验证你在 {school} 的在读身份",
      description:"验证在读身份后，查看院校的学期课程。",
      supportedDescription:"浏览 {school} 的参考课程目录；个人学业导入为可选功能。",
      unsupportedDescription:"{school} 暂无学期课程目录。",
      verificationRequired:"需要验证在读身份", verificationRequiredDetail:"请先验证你目前的院校成员身份，以查看相应的学期课程目录。",
      verifiedInstitution:"在读身份已验证", connectorUnavailable:"暂未提供学期课程目录", connectorRequired:"使用院校课程资料前，请先验证受支持的院校。",
      verificationSectionUnavailable:"学生身份验证功能位于此个人资料页下方的“隐私与安全”部分。",
      catalogueTrust:"参考课程目录", catalogueLoading:"正在加载学期课程目录", catalogueAvailable:"学期参考课程目录可用",
      disconnected:"尚未导入个人课程快照", readyReview:"个人课程快照等待检查", synced:"已导入个人课程快照", stale:"个人课程快照可能已过期", localTrust:"用户导入 · 未经学校独立签署", officialTrust:"院校提供的学业资料",
      verifyOfficial:"使用院校提供的学业资料源", verifyStudent:"验证在读身份", browseCatalogue:"浏览学期课程", openPortal:"打开学生门户（可选）", importFile:"导入我的课程快照", installHelper:"获取可选导入助手", disconnect:"移除已导入的学业资料",
      neverCredentials:"ConCourse 不会索取院校密码、验证码、恢复码或门户 Cookie。", privacyTitle:"会传输哪些信息？",
      privacyItems:["浏览共享学期课程目录不需要访问你的个人学生门户。","可选私人导入：课程、主修、年级、已分配课程、已完成课程代码及剩余要求。","不会传输：密码、多重身份验证内容、Cookie、原始网页、成绩、学号、法定姓名及财务记录。"],
      plannerKicker:"学期课程目录", plannerTitle:"学期参考课程目录", plannerDescription:"搜索共享目录；个人学业导入为可选功能。",
      catalogueSearch:"搜索学期课程目录", catalogueSearchPlaceholder:"课程编号、名称、学院或部门", catalogueLoadingList:"正在加载学期参考课程目录…", catalogueEmpty:"没有课程符合此目录搜索。",
      catalogueResults:"显示 {total} 门匹配课程中的 {shown} 门", catalogueTerm:"学期", catalogueCourses:"课程", catalogueSections:"班别", catalogueReference:"参考资料获取日期", cataloguePublication:"发布状态", catalogueSource:"资料来源",
      catalogueDisclaimer:"仅供参考。请在官方系统确认开课、资格、名额及注册。", catalogueNoRestriction:"请向院校确认资格及限制。",
      personalKicker:"可选个人提示", personalTitle:"已分配课程及可能符合要求的课程", personalDescription:"导入私人快照，以标记已分配课程及可能符合要求的课程。",
      noSnapshot:"尚未导入个人快照；你仍可浏览课程目录。", assigned:"已分配给你", possible:"可能符合要求", unresolved:"需要确认", captured:"获取时间", catalogueAsOf:"课程目录截至",
      courseSearch:"搜索我的可能课程", courseSearchPlaceholder:"课程编号或名称", noSearchMatches:"没有匹配结果。请在官方系统检查限制或未排课课程。", selectedCount:"已选择 {count} 门课程加入课表",
      privateConsent:"使用此快照为我的 ConCourse 课表提供私人个性化服务。", catalogueConsent:"可选：提供去除身份信息的课程资料，以改善未来的共享课程目录。此选择不会影响课程目录访问。",
      catalogueTermRequired:"共享课程资料需要明确的学期。",
      importSelected:"将所选课程加入课表", processing:"正在检查快照和当前课程目录…", invalidSnapshot:"无法验证此快照。课表及账户资料均未更改。",
      privateOperationBusy:"另一项私人资料操作仍在进行，请稍后再试。",
      catalogueUnavailable:"学期参考课程目录暂时不可用，仍可检查已导入的已分配课程。", importReady:"请检查导入资料，并选择要加入的可能课程。",
      catalogueTermMismatch:"内置课程目录属于另一学期，仍可检查已分配课程。",
      personalTermMismatch:"私人快照与显示的课程目录学期不符，因此无法导入课表。",
      catalogueRetry:"重新加载课程目录",
      imported:"课程已加入你的课表。", importPartial:"部分课程没有可用上课时间，已保留待确认。", consentRequired:"导入前请确认私人课表用途。",
      signInRequired:"请先登录 ConCourse，再保存私人学业导入。", remoteUnavailable:"私人学业快照储存尚未安装；所选课程仍已正常保存。",
      disconnectedDone:"已移除你的私人导入学业资料。共享学期课程目录仍然可用。", disconnectConfirm:"移除你的私人导入学业快照？共享学期课程目录将继续保留。",
      fileTooLarge:"请选择小于 8 MB 的 JSON 快照。", fileInvalid:"该文件不是有效的 ConCourse 学业快照。", snapshotReceived:"已从可选导入助手收到私人学业快照。",
      noScheduledCandidates:"快照中没有包含可用上课时间的课程。", assignedReason:"来自导入学生记录的已分配课程", estimateReason:"可能符合要求 · 请向院校确认",
      officialUnavailable:"尚未配置官方实时资料源；目前显示参考快照。"
    },
    "zh-HK":{
      kicker:"學期課程資料", title:"驗證院校後查看學期課程", verifiedTitle:"{school} 學期課程目錄", unsupportedTitle:"已驗證你喺 {school} 嘅在讀身份",
      description:"驗證在讀身份後，查看院校嘅學期課程。",
      supportedDescription:"瀏覽 {school} 嘅參考課程目錄；個人學業匯入係可選功能。",
      unsupportedDescription:"{school} 暫時未有學期課程目錄。",
      verificationRequired:"需要驗證在讀身份", verificationRequiredDetail:"請先驗證你目前嘅院校成員身份，以查看相應嘅學期課程目錄。",
      verifiedInstitution:"在讀身份已驗證", connectorUnavailable:"暫未提供學期課程目錄", connectorRequired:"使用院校課程資料之前，請先驗證受支援嘅院校。",
      verificationSectionUnavailable:"學生身份驗證功能位於呢個個人檔案頁下方嘅「私隱與安全」部分。",
      catalogueTrust:"參考課程目錄", catalogueLoading:"正在載入學期課程目錄", catalogueAvailable:"學期參考課程目錄可用",
      disconnected:"尚未匯入個人課程快照", readyReview:"個人課程快照等待檢查", synced:"已匯入個人課程快照", stale:"個人課程快照可能已過期", localTrust:"用戶匯入 · 未經院校獨立簽署", officialTrust:"院校提供嘅學業資料",
      verifyOfficial:"使用院校提供嘅學業資料來源", verifyStudent:"驗證在讀身份", browseCatalogue:"瀏覽學期課程", openPortal:"開啟學生平台（可選）", importFile:"匯入我嘅課程快照", installHelper:"取得可選匯入助手", disconnect:"移除已匯入嘅學業資料",
      neverCredentials:"ConCourse 唔會索取院校密碼、驗證碼、復原碼或平台 Cookie。", privacyTitle:"會傳送咩資料？",
      privacyItems:["瀏覽共享學期課程目錄唔需要存取你嘅個人學生平台。","可選私人匯入：課程、主修、年級、已編配課程、已完成課程代碼同剩餘要求。","唔會傳送：密碼、多重身份驗證內容、Cookie、原始網頁、成績、學號、法定姓名同財務紀錄。"],
      plannerKicker:"學期課程目錄", plannerTitle:"學期參考課程目錄", plannerDescription:"搜尋共享目錄；個人學業匯入係可選功能。",
      catalogueSearch:"搜尋學期課程目錄", catalogueSearchPlaceholder:"課程編號、名稱、學院或部門", catalogueLoadingList:"正在載入學期參考課程目錄…", catalogueEmpty:"冇課程符合呢個目錄搜尋。",
      catalogueResults:"顯示 {total} 科配對課程當中嘅 {shown} 科", catalogueTerm:"學期", catalogueCourses:"課程", catalogueSections:"班別", catalogueReference:"參考資料擷取日期", cataloguePublication:"發佈狀態", catalogueSource:"資料來源",
      catalogueDisclaimer:"只供參考。請喺官方系統確認開課、資格、名額同註冊。", catalogueNoRestriction:"請向院校確認資格同限制。",
      personalKicker:"可選個人提示", personalTitle:"已編配課程同可能符合要求嘅課程", personalDescription:"匯入私人快照，以標示已編配課程同可能符合要求嘅課程。",
      noSnapshot:"尚未匯入個人快照；你仍然可以瀏覽課程目錄。", assigned:"已編配畀你", possible:"可能符合要求", unresolved:"需要確認", captured:"擷取時間", catalogueAsOf:"課程目錄截至",
      courseSearch:"搜尋我嘅可能課程", courseSearchPlaceholder:"課程編號或名稱", noSearchMatches:"冇配對結果。請喺官方系統檢查限制或未編排時間嘅課程。", selectedCount:"已選擇 {count} 科加入時間表",
      privateConsent:"使用呢個快照，為我嘅 ConCourse 時間表提供私人個人化服務。", catalogueConsent:"可選：提供移除身份資料嘅課程資料，以改善日後嘅共享課程目錄。呢個選擇唔會影響課程目錄存取。",
      catalogueTermRequired:"共享課程資料需要明確嘅學期。",
      importSelected:"將所選課程加入時間表", processing:"正在檢查快照同目前課程目錄…", invalidSnapshot:"無法驗證呢個快照。時間表同帳戶資料都冇更改。",
      privateOperationBusy:"另一項私人資料操作仲進行緊，請稍後再試。",
      catalogueUnavailable:"學期參考課程目錄暫時未能使用，仍然可以檢查已匯入嘅已編配課程。", importReady:"請檢查匯入資料，並選擇要加入嘅可能課程。",
      catalogueTermMismatch:"內置課程目錄屬於另一個學期，仍然可以檢查已編配課程。",
      personalTermMismatch:"私人快照同顯示嘅課程目錄學期唔一致，所以無法匯入時間表。",
      catalogueRetry:"重新載入課程目錄",
      imported:"課程已加入你嘅時間表。", importPartial:"部分課程冇可用上課時間，已保留等待確認。", consentRequired:"匯入之前請確認私人時間表用途。",
      signInRequired:"請先登入 ConCourse，再儲存私人學業匯入。", remoteUnavailable:"私人學業快照儲存尚未安裝；所選課程仍然已正常儲存。",
      disconnectedDone:"已移除你嘅私人匯入學業資料。共享學期課程目錄仍然可以使用。", disconnectConfirm:"移除你嘅私人匯入學業快照？共享學期課程目錄會繼續保留。",
      fileTooLarge:"請選擇細過 8 MB 嘅 JSON 快照。", fileInvalid:"呢個檔案唔係有效嘅 ConCourse 學業快照。", snapshotReceived:"已經由可選匯入助手收到私人學業快照。",
      noScheduledCandidates:"快照入面冇包含可用上課時間嘅課程。", assignedReason:"來自匯入學生紀錄嘅已編配課程", estimateReason:"可能符合要求 · 請向院校確認",
      officialUnavailable:"尚未配置官方即時資料來源；目前顯示參考快照。"
    }
  };

  const language = () => ["zh-CN", "zh-HK"].includes(document.documentElement.lang)
    ? document.documentElement.lang
    : "en";
  const text = key => COPY[language()]?.[key] ?? COPY.en[key] ?? key;
  const clean = (value, max=500) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const formattedText = (key, values={}) => {
    const value = text(key);
    if(typeof value !== "string") return value;
    return value.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) => clean(values[name], 500));
  };
  const byId = id => document.getElementById(id);
  const setStatus = (message, tone="") => {
    const target = byId("hkbuPortalInlineStatus");
    if(!target) return;
    target.textContent = message || "";
    target.className = `hkbu-portal-inline-status${tone ? ` ${tone}` : ""}`;
  };

  function institutionContext(){
    const raw = window.ConCourseHub?.getInstitutionContext?.() || {status:"unverified"};
    const resolver = window.ConCourseInstitutionPortalPolicy?.resolveInstitution;
    if(typeof resolver !== "function"){
      return Object.freeze({
        status:"unverified",
        verified:false,
        schoolName:"",
        schoolKey:"",
        connectorId:null,
        catalogueId:null,
        importAdapterId:null,
        catalogueAvailable:false,
        importAvailable:false,
        isSupported:false
      });
    }
    const keys = config.supportedSchoolKeys;
    if(!Array.isArray(keys)){
      console.warn("Institution portal connector configuration is invalid.");
      return resolver(raw, {connectors:[]});
    }
    try {
      return resolver(raw, {
        connectors:[{
          id:"hkbu",
          catalogueId:"hkbu",
          importAdapterId:config.personalImportEnabled === false ? null : "hkbu",
          schoolKeys:keys
        }]
      });
    } catch(error){
      console.warn("Institution portal connector configuration is invalid:", error);
      return resolver(raw, {connectors:[]});
    }
  }

  function institutionSignature(context=institutionContext()){
    return [
      context.status,
      context.schoolKey,
      context.catalogueId || "no-catalogue",
      context.importAdapterId || "no-import"
    ].join("|");
  }

  function statusStorageKey(){
    try {
      const userId = typeof currentUser !== "undefined" ? String(currentUser?.id || "").trim() : "";
      return userId ? `${STATUS_KEY}:${userId.slice(0, 100)}` : "";
    } catch(_error){
      return "";
    }
  }

  function readStatus(){
    try {
      const key = statusStorageKey();
      if(!key) return null;
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch(_error){
      return null;
    }
  }

  function writeStatus(status){
    state.lastStatus = status;
    try {
      const key = statusStorageKey();
      if(!key) return;
      if(status) localStorage.setItem(key, JSON.stringify(status));
      else localStorage.removeItem(key);
    } catch(_error){}
  }

  function clearSnapshotState({invalidate=true}={}){
    if(invalidate){
      state.snapshotRequestId += 1;
      state.plannerImportRequestId += 1;
      state.processing = false;
      state.privateMutation = false;
    }
    state.snapshot = null;
    state.contribution = null;
    state.assigned = [];
    state.allCandidates = [];
    state.candidates = [];
    state.unresolved = [];
    state.catalogueTermMatches = false;
    state.selected.clear();
    renderSnapshotReview();
  }

  function syncStatusForCurrentUser(){
    const userId = remoteUserId();
    if(state.statusLoadedFor === userId) return;
    state.remoteRequestId += 1;
    clearSnapshotState();
    state.remoteLoadedFor = null;
    state.statusLoadedFor = userId;
    state.lastStatus = userId ? readStatus() : null;
    renderConnectionStatus();
  }

  function formattedDate(value){
    const date = new Date(value || 0);
    if(Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language() === "en" ? "en-GB" : language(), {
      dateStyle:"medium",
      timeStyle:"short"
    }).format(date);
  }

  function formattedDay(value){
    const date = new Date(value || 0);
    if(Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(language() === "en" ? "en-GB" : language(), {
      dateStyle:"medium"
    }).format(date);
  }

  function isStale(status){
    const time = new Date(status?.captured_at || 0).getTime();
    const configuredDays = Number(config.staleAfterDays);
    const days = Number.isFinite(configuredDays)
      ? Math.max(1, Math.min(90, configuredDays))
      : 14;
    return !time || Date.now() - time > days * 24 * 60 * 60 * 1000;
  }

  function officialConnectionUrl(){
    if(!config.officialSsoEnabled || !config.officialSsoStartUrl) return "";
    try {
      const value = new URL(config.officialSsoStartUrl, location.origin);
      return value.origin === location.origin && value.protocol === "https:" ? value.href : "";
    } catch(_error){
      return "";
    }
  }

  function browserHelperUrl(){
    return sameOriginResourceUrl(config.browserHelperUrl);
  }

  function openSemesterCatalogue(){
    window.ConCoursePlanner?.open?.();
    window.requestAnimationFrame(() => {
      byId("hkbuPortalPlannerPanel")?.scrollIntoView({behavior:"smooth", block:"start"});
      byId("hkbuCatalogueSearch")?.focus({preventScroll:true});
    });
  }

  function sameOriginResourceUrl(value, base=location.href){
    try {
      const resolved = new URL(value, base);
      return resolved.origin === location.origin ? resolved.href : "";
    } catch(_error){
      return "";
    }
  }

  async function sha256Hex(value){
    if(!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") return "";
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value)
    );
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function resolveCatalogueUrl(){
    const fallback = sameOriginResourceUrl(config.catalogueUrl);
    const manifestUrl = sameOriginResourceUrl(config.catalogueManifestUrl);
    const bundledFallback = () => {
      if(!fallback) throw new Error("No safe catalogue URL is configured");
      return {
        catalogueUrl:fallback,
        manifest:null,
        delivery:"bundled_fallback"
      };
    };
    if(!manifestUrl) return bundledFallback();
    let response;
    try {
      response = await fetch(manifestUrl, {
        credentials:"same-origin",
        cache:"no-store",
        headers:{"Accept":"application/json"}
      });
    } catch(error){
      console.warn("HKBU catalogue manifest request failed; using the bundled reference:", error);
      return bundledFallback();
    }
    if(!response.ok){
      console.warn(`HKBU catalogue manifest request failed (${response.status}); using the bundled reference.`);
      return bundledFallback();
    }
    let manifest;
    try {
      manifest = await response.json();
    } catch(_error){
      throw new Error("Catalogue manifest is not valid JSON");
    }
    const catalogueUrl = sameOriginResourceUrl(manifest?.catalogue_url, manifestUrl);
    const valid = manifest?.schema_version === 1
      && manifest?.institution === "hkbu"
      && typeof manifest?.term === "string"
      && manifest.term.length > 0
      && manifest.term.length <= 120
      && catalogueUrl
      && Number.isInteger(manifest?.course_count)
      && manifest.course_count >= 0
      && manifest.course_count <= 10000
      && Number.isInteger(manifest?.section_count)
      && manifest.section_count >= 0
      && manifest.section_count <= 50000
      && ["reference_only", "published"].includes(manifest?.publication_status)
      && /^[0-9a-f]{64}$/u.test(String(manifest?.content_sha256 || ""));
    if(!valid) throw new Error("Catalogue manifest validation failed");
    return {
      catalogueUrl,
      manifest,
      delivery:"manifest"
    };
  }

  function sameAcademicTerm(left, right){
    const normalized = value => clean(value, 120)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "");
    const leftKey = normalized(left);
    const rightKey = normalized(right);
    return Boolean(leftKey && rightKey && leftKey === rightKey);
  }

  function ensureProfileCard(){
    const grid = document.querySelector('[data-hub-view="profile"] .hub-profile-grid');
    if(!grid || byId("hkbuPortalProfileCard")) return;
    const card = document.createElement("article");
    card.className = "hub-card hkbu-portal-card";
    card.id = "hkbuPortalProfileCard";
    card.innerHTML = `
      <div class="hkbu-portal-heading">
        <div>
          <p class="hkbu-portal-kicker" data-hkbu-copy="kicker"></p>
          <h2 data-hkbu-copy="title"></h2>
          <p class="hkbu-portal-description" data-hkbu-copy="description"></p>
        </div>
        <span class="hkbu-portal-trust-badge" id="hkbuPortalTrustBadge"></span>
      </div>
      <div class="hkbu-portal-status-row">
        <div>
          <b id="hkbuPortalConnectionStatus"></b>
          <p class="hkbu-portal-meta" id="hkbuPortalConnectionMeta"></p>
        </div>
      </div>
      <div class="hkbu-portal-actions">
        <button class="btn-primary" type="button" id="hkbuPortalVerifyStudent" data-hkbu-copy="verifyStudent"></button>
        <button class="btn-primary" type="button" id="hkbuPortalBrowseCatalogue" hidden data-hkbu-copy="browseCatalogue"></button>
        <a class="btn-primary" id="hkbuPortalOfficial" href="#" hidden data-hkbu-copy="verifyOfficial"></a>
        <a class="btn-ghost" id="hkbuPortalOpen" href="#" target="_blank" rel="noopener noreferrer" hidden data-hkbu-copy="openPortal"></a>
        <button class="btn-ghost" type="button" id="hkbuPortalImportFile" hidden data-hkbu-copy="importFile"></button>
        <a class="btn-ghost" id="hkbuPortalHelper" href="#" download hidden data-hkbu-copy="installHelper"></a>
        <button class="btn-ghost" type="button" id="hkbuPortalDisconnect" hidden data-hkbu-copy="disconnect"></button>
      </div>
      <input class="hkbu-portal-file-input" id="hkbuPortalFileInput" type="file" accept="application/json,.json" />
      <p class="hkbu-portal-note" data-hkbu-copy="neverCredentials"></p>
      <details class="hkbu-portal-disclosure">
        <summary data-hkbu-copy="privacyTitle"></summary>
        <ul id="hkbuPortalPrivacyItems"></ul>
      </details>
      <p class="hkbu-portal-inline-status" id="hkbuPortalInlineStatus" role="status" aria-live="polite"></p>
    `;
    grid.prepend(card);
    byId("hkbuPortalVerifyStudent").addEventListener("click", () => {
      const target = byId("hubSchoolVerification");
      if(target) target.scrollIntoView({behavior:"smooth", block:"start"});
      else setStatus(text("verificationSectionUnavailable"));
    });
    byId("hkbuPortalBrowseCatalogue").addEventListener("click", openSemesterCatalogue);
    byId("hkbuPortalImportFile").addEventListener("click", () => byId("hkbuPortalFileInput").click());
    byId("hkbuPortalFileInput").addEventListener("change", event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if(file) void importSnapshotFile(file);
    });
    byId("hkbuPortalDisconnect").addEventListener("click", () => void disconnectPortal());
    renderCopy();
    renderConnectionStatus();
  }

  function ensurePlannerPanel(){
    const panel = byId("courseBuilderPanel");
    if(!panel || byId("hkbuPortalPlannerPanel")) return;
    const shell = document.createElement("section");
    shell.className = "hkbu-portal-planner-panel";
    shell.id = "hkbuPortalPlannerPanel";
    shell.innerHTML = `
      <div class="hkbu-portal-candidate-heading">
        <div>
          <p class="hkbu-portal-kicker" data-hkbu-copy="plannerKicker"></p>
          <h3 data-hkbu-copy="plannerTitle"></h3>
          <p class="hkbu-portal-description" data-hkbu-copy="plannerDescription"></p>
        </div>
      </div>
      <div class="hkbu-catalogue-browser" id="hkbuCatalogueBrowser">
        <div class="hkbu-portal-summary" id="hkbuCatalogueSummary"></div>
        <label class="hkbu-portal-search">
          <span data-hkbu-copy="catalogueSearch"></span>
          <input type="search" id="hkbuCatalogueSearch" autocomplete="off" data-hkbu-placeholder="catalogueSearchPlaceholder" />
        </label>
        <p class="hkbu-portal-note" data-hkbu-copy="catalogueDisclaimer"></p>
        <ul class="hkbu-catalogue-caveats" id="hkbuCatalogueCaveats"></ul>
        <div class="hkbu-catalogue-courses" id="hkbuCatalogueCourses"></div>
        <p class="hkbu-portal-selection-meta" id="hkbuCatalogueResults"></p>
        <button class="btn-ghost hkbu-catalogue-retry" type="button" id="hkbuCatalogueRetry" hidden data-hkbu-copy="catalogueRetry"></button>
      </div>
      <div class="hkbu-portal-section-heading">
        <p class="hkbu-portal-kicker" data-hkbu-copy="personalKicker"></p>
        <h3 data-hkbu-copy="personalTitle"></h3>
        <p class="hkbu-portal-description" data-hkbu-copy="personalDescription"></p>
      </div>
      <div id="hkbuPortalSnapshotEmpty" class="hkbu-portal-empty" data-hkbu-copy="noSnapshot"></div>
      <div id="hkbuPortalSnapshotReview" hidden>
        <div class="hkbu-portal-summary" id="hkbuPortalSummary"></div>
        <label class="hkbu-portal-search">
          <span data-hkbu-copy="courseSearch"></span>
          <input type="search" id="hkbuPortalCourseSearch" autocomplete="off" data-hkbu-placeholder="courseSearchPlaceholder" />
        </label>
        <div class="hkbu-portal-candidates" id="hkbuPortalCandidates"></div>
        <p class="hkbu-portal-selection-meta" id="hkbuPortalSelectionMeta"></p>
        <div class="hkbu-portal-consent">
          <label><input type="checkbox" id="hkbuPortalPrivateConsent" /> <span data-hkbu-copy="privateConsent"></span></label>
          <label><input type="checkbox" id="hkbuPortalCatalogueConsent" /> <span data-hkbu-copy="catalogueConsent"></span></label>
        </div>
        <div class="hkbu-portal-actions">
          <button class="btn-primary" type="button" id="hkbuPortalAddSelected" data-hkbu-copy="importSelected"></button>
        </div>
      </div>
    `;
    const heading = panel.querySelector(".panel-heading");
    if(heading?.nextSibling) panel.insertBefore(shell, heading.nextSibling);
    else panel.append(shell);
    byId("hkbuPortalAddSelected").addEventListener("click", () => void addSelectedToPlanner());
    byId("hkbuCatalogueSearch").addEventListener("input", () => renderCatalogueBrowser());
    byId("hkbuCatalogueRetry").addEventListener("click", () => {
      state.catalogueAttempted = false;
      state.catalogueManifest = null;
      state.catalogueDelivery = "";
      void loadCatalogue();
      renderCatalogueBrowser();
      renderConnectionStatus();
    });
    byId("hkbuPortalCourseSearch").addEventListener("input", () => renderSnapshotReview());
    renderCopy();
    renderCatalogueBrowser();
    renderSnapshotReview();
  }

  function renderInstitutionAvailability(context=institutionContext()){
    const catalogueSupported = context.catalogueId === "hkbu";
    const importSupported = context.importAdapterId === "hkbu";
    const officialUrl = importSupported ? officialConnectionUrl() : "";
    const helperUrl = importSupported ? browserHelperUrl() : "";
    const verifyButton = byId("hkbuPortalVerifyStudent");
    const browseButton = byId("hkbuPortalBrowseCatalogue");
    const officialButton = byId("hkbuPortalOfficial");
    const portalButton = byId("hkbuPortalOpen");
    const importButton = byId("hkbuPortalImportFile");
    const helperButton = byId("hkbuPortalHelper");
    const fileInput = byId("hkbuPortalFileInput");
    const plannerPanel = byId("hkbuPortalPlannerPanel");

    if(verifyButton) verifyButton.hidden = context.verified;
    if(browseButton) browseButton.hidden = !catalogueSupported;
    if(officialButton){
      officialButton.hidden = !officialUrl;
      officialButton.href = officialUrl || "#";
    }
    if(portalButton){
      portalButton.hidden = !importSupported;
      portalButton.href = importSupported ? PORTAL_URL : "#";
    }
    if(importButton) importButton.hidden = !importSupported;
    if(helperButton){
      helperButton.hidden = !helperUrl;
      helperButton.href = helperUrl || "#";
    }
    if(fileInput) fileInput.disabled = !importSupported;
    if(plannerPanel) plannerPanel.hidden = !catalogueSupported;
    if(catalogueSupported && !state.catalogue && !state.catalogueAttempted){
      void loadCatalogue();
    }
  }

  function renderCopy(){
    document.querySelectorAll("[data-hkbu-copy]").forEach(element => {
      const key = element.dataset.hkbuCopy;
      if(typeof text(key) === "string") element.textContent = text(key);
    });
    document.querySelectorAll("[data-hkbu-placeholder]").forEach(element => {
      element.placeholder = text(element.dataset.hkbuPlaceholder);
    });
    const privacy = byId("hkbuPortalPrivacyItems");
    if(privacy){
      privacy.replaceChildren(...text("privacyItems").map(item => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      }));
    }
    const context = institutionContext();
    const title = document.querySelector("#hkbuPortalProfileCard [data-hkbu-copy='title']");
    const description = document.querySelector("#hkbuPortalProfileCard [data-hkbu-copy='description']");
    if(title){
      title.textContent = context.verified
        ? formattedText(
          context.catalogueId === "hkbu" ? "verifiedTitle" : "unsupportedTitle",
          {school:context.schoolName}
        )
        : text("title");
    }
    if(description){
      description.textContent = context.verified
        ? formattedText(
          context.catalogueId === "hkbu" ? "supportedDescription" : "unsupportedDescription",
          {school:context.schoolName}
        )
        : text("description");
    }
    renderInstitutionAvailability(context);
    renderConnectionStatus(context);
    renderCatalogueBrowser();
    renderSnapshotReview();
  }

  function renderConnectionStatus(context=institutionContext()){
    const status = state.lastStatus;
    const badge = byId("hkbuPortalTrustBadge");
    const heading = byId("hkbuPortalConnectionStatus");
    const meta = byId("hkbuPortalConnectionMeta");
    if(!badge || !heading || !meta) return;
    badge.className = "hkbu-portal-trust-badge";
    if(!context.verified){
      badge.textContent = text("verificationRequired");
      heading.textContent = text("verificationRequired");
      meta.textContent = text("verificationRequiredDetail");
      byId("hkbuPortalDisconnect").hidden = true;
      return;
    }
    if(context.catalogueId !== "hkbu"){
      badge.classList.add("synced");
      badge.textContent = text("verifiedInstitution");
      heading.textContent = text("connectorUnavailable");
      meta.textContent = formattedText("unsupportedDescription", {school:context.schoolName});
      byId("hkbuPortalDisconnect").hidden = true;
      return;
    }
    if(!status){
      if(state.catalogue) badge.classList.add("synced");
      badge.textContent = text("catalogueTrust");
      heading.textContent = state.catalogue
        ? text("catalogueAvailable")
        : state.catalogueAttempted && !state.cataloguePromise
          ? text("catalogueUnavailable")
          : text("catalogueLoading");
      meta.textContent = [
        context.schoolName,
        clean(state.catalogue?.term, 120),
        state.catalogue?.captured_at
          ? `${text("catalogueReference")}: ${formattedDate(state.catalogue.captured_at)}`
          : ""
      ].filter(Boolean).join(" · ");
      byId("hkbuPortalDisconnect").hidden = true;
      return;
    }
    const stale = isStale(status);
    const official = status.official === true;
    badge.classList.add(stale ? "stale" : "synced");
    badge.textContent = official ? text("officialTrust") : text("localTrust");
    heading.textContent = status.review_pending
      ? text("readyReview")
      : stale ? text("stale") : text("synced");
    meta.textContent = [
      context.schoolName,
      clean(status.term, 120),
      formattedDate(status.captured_at)
    ].filter(Boolean).join(" · ");
    byId("hkbuPortalDisconnect").hidden = false;
  }

  function api(){
    return window.ConCourseCourseCatalog || null;
  }

  function validationPayload(result, fallback){
    if(result === true) return fallback;
    if(!result || result === false) throw new Error("Snapshot validation failed");
    if(result.ok === false || result.valid === false){
      const detail = Array.isArray(result.errors) ? result.errors.join("; ") : "";
      throw new Error(detail || "Snapshot validation failed");
    }
    return result.value || result.snapshot || result.data || fallback;
  }

  async function loadCatalogue(){
    if(state.catalogue) return state.catalogue;
    if(state.cataloguePromise) return state.cataloguePromise;
    if(state.catalogueAttempted) return null;
    state.catalogueAttempted = true;
    const requestId = ++state.catalogueRequestId;
    state.cataloguePromise = resolveCatalogueUrl().then(async request => {
      const catalogueUrl = request?.catalogueUrl;
      const manifest = request?.manifest || null;
      if(!catalogueUrl) throw new Error("No safe catalogue URL is configured");
      const response = await fetch(catalogueUrl, {
        credentials:"same-origin",
        cache:"no-cache",
        headers:{"Accept":"application/json"}
      });
      if(!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
      const raw = await response.text();
      if(manifest){
        const digest = await sha256Hex(raw);
        if(digest && digest !== manifest.content_sha256){
          throw new Error("Catalogue checksum does not match the published manifest");
        }
      }
      const value = JSON.parse(raw);
      if(manifest){
        const sectionCount = Array.isArray(value?.courses)
          ? value.courses.reduce(
            (total, course) => total + (Array.isArray(course?.sections) ? course.sections.length : 0),
            0
          )
          : -1;
        if(value?.term !== manifest.term
          || value?.courses?.length !== manifest.course_count
          || sectionCount !== manifest.section_count){
          throw new Error("Catalogue contents do not match the published manifest");
        }
        if(value?.publication_status !== manifest.publication_status){
          throw new Error("Catalogue publication status does not match the published manifest");
        }
      }
      const validator = api()?.validateCatalogue;
      const validated = validator ? validationPayload(validator(value), value) : value;
      if(!["reference_only", "published"].includes(validated?.publication_status)){
        throw new Error("Catalogue publication status is not allowed");
      }
      if(requestId !== state.catalogueRequestId) return null;
      state.catalogueManifest = manifest;
      state.catalogueDelivery = clean(request?.delivery, 40);
      state.catalogue = validated;
      return state.catalogue;
    }).catch(error => {
      if(requestId !== state.catalogueRequestId) return null;
      console.warn("HKBU reference catalogue is unavailable:", error);
      setStatus(text("catalogueUnavailable"));
      return null;
    }).finally(() => {
      if(requestId === state.catalogueRequestId) state.cataloguePromise = null;
      const snapshotToReconcile = requestId === state.catalogueRequestId
        && state.catalogue
        && state.snapshot
        && !state.catalogueTermMatches
        && !state.processing
        && !state.privateMutation
        ? state.snapshot
        : null;
      const reconcileUserId = remoteUserId();
      const reconcileSignature = institutionSignature();
      const reconcileOfficial = state.lastStatus?.official === true;
      renderCatalogueBrowser();
      renderConnectionStatus();
      if(snapshotToReconcile){
        void processSnapshot(snapshotToReconcile, {
          message:false,
          expectedUserId:reconcileUserId,
          expectedInstitutionSignature:reconcileSignature,
          official:reconcileOfficial
        });
      }
    });
    return state.cataloguePromise;
  }

  async function processSnapshot(payload, {
    message=true,
    expectedUserId=null,
    expectedInstitutionSignature="",
    official=false
  }={}){
    if(state.privateMutation){
      setStatus(text("privateOperationBusy"));
      return false;
    }
    if(institutionContext().importAdapterId !== "hkbu"){
      setStatus(text("connectorRequired"), "error");
      return false;
    }
    syncStatusForCurrentUser();
    const expectedSignature = expectedInstitutionSignature || institutionSignature();
    if(expectedSignature !== institutionSignature()) return false;
    if(expectedUserId && expectedUserId !== remoteUserId()) return false;
    const requestId = ++state.snapshotRequestId;
    const isCurrentRequest = () => requestId === state.snapshotRequestId
      && expectedSignature === institutionSignature()
      && (!expectedUserId || expectedUserId === remoteUserId());
    state.processing = true;
    setStatus(text("processing"));
    try {
      if(!payload || typeof payload !== "object") throw new Error("Snapshot must be an object");
      const engine = api();
      if(!engine?.validateSnapshot || !engine?.buildPlannerCandidates){
        throw new Error("HKBU course engine is unavailable");
      }
      const snapshot = validationPayload(engine.validateSnapshot(payload), payload);
      const loadedCatalogue = await loadCatalogue();
      if(!isCurrentRequest()) return false;
      const catalogueMatches = loadedCatalogue && sameAcademicTerm(
        snapshot?.source?.term,
        loadedCatalogue.term
      );
      const catalogue = catalogueMatches ? loadedCatalogue : null;
      if(loadedCatalogue && !catalogueMatches){
        setStatus(text("catalogueTermMismatch"));
      }
      const plannerResult = engine.buildPlannerCandidates(
        snapshot,
        catalogue || {schema_version:1, institution:"hkbu", courses:[]}
      );
      const recommendationResult = engine.recommendCourses && catalogue
        ? engine.recommendCourses(snapshot, catalogue, {limit:100})
        : null;
      const requirementReasonCodes = new Set([
        "REMAINING_REQUIREMENT_COURSE_MATCH",
        "REMAINING_REQUIREMENT_TEXT_MATCH"
      ]);
      const recommendations = Array.isArray(recommendationResult?.recommendations)
        ? recommendationResult.recommendations
        : [];
      const requirementMatches = recommendations.filter(candidate => {
        const reasons = Array.isArray(candidate?.recommendation_reason_codes)
          ? candidate.recommendation_reason_codes
          : Array.isArray(candidate?.reason_codes) ? candidate.reason_codes : [];
        return reasons.some(reason => requirementReasonCodes.has(reason));
      });
      const assigned = Array.isArray(plannerResult?.assigned) ? plannerResult.assigned : [];
      const unresolved = Array.isArray(plannerResult?.unresolved) ? plannerResult.unresolved : [];
      const contributionTerm = clean(snapshot?.source?.term, 120);
      const shareableTerm = contributionTerm
        && !/^(?:unknown|multiple|unspecified|n\/a)$/iu.test(contributionTerm);
      let contribution = null;
      if(shareableTerm && engine.buildDeidentifiedContribution){
        try {
          contribution = engine.buildDeidentifiedContribution(snapshot);
        } catch(error){
          console.warn("HKBU catalogue contribution was omitted:", error);
        }
      }
      if(!isCurrentRequest()) return false;
      state.snapshot = snapshot;
      state.catalogueTermMatches = !!catalogueMatches;
      state.assigned = assigned;
      state.allCandidates = requirementMatches;
      state.candidates = requirementMatches.slice(0, 30);
      state.unresolved = unresolved;
      state.contribution = contribution;
      state.selected = new Set(assigned.map(candidateKey));
      if(byId("hkbuPortalCourseSearch")) byId("hkbuPortalCourseSearch").value = "";
      renderSnapshotReview();
      if(message){
        setStatus(
          catalogue
            ? text("snapshotReceived")
            : loadedCatalogue ? text("catalogueTermMismatch") : text("catalogueUnavailable"),
          catalogue ? "success" : ""
        );
      }
      state.lastStatus = {
        mode:"user_portal_import",
        term:clean(snapshot?.source?.term, 120),
        captured_at:clean(snapshot?.source?.captured_at, 80) || new Date().toISOString(),
        parser_version:clean(snapshot?.source?.parser_version, 40),
        official:official === true,
        review_pending:true
      };
      renderConnectionStatus();
      return true;
    } catch(error){
      if(!isCurrentRequest()) return false;
      console.warn("Rejected HKBU portal snapshot:", error);
      clearSnapshotState({invalidate:false});
      setStatus(text("invalidSnapshot"), "error");
      return false;
    } finally {
      if(requestId === state.snapshotRequestId) state.processing = false;
    }
  }

  async function importSnapshotFile(file){
    if(file.size > 8 * 1024 * 1024){
      setStatus(text("fileTooLarge"), "error");
      return;
    }
    try {
      const payload = JSON.parse(await file.text());
      await processSnapshot(payload);
    } catch(error){
      console.warn("Could not read HKBU snapshot file:", error);
      setStatus(text("fileInvalid"), "error");
    }
  }

  function candidateKey(candidate){
    return clean(
      candidate?.external_id
      || candidate?.externalId
      || candidate?.course_code
      || candidate?.code
      || candidate?.title
      || candidate?.name,
      180
    ).toUpperCase();
  }

  function candidateReasons(candidate, assigned){
    const values = Array.isArray(candidate?.reasons)
      ? candidate.reasons
      : Array.isArray(candidate?.reason_codes) ? candidate.reason_codes : [];
    if(values.length) return values.map(value => clean(value, 80).replaceAll("_", " ")).join(" · ");
    return assigned ? text("assignedReason") : text("estimateReason");
  }

  function candidateMeta(candidate){
    const code = clean(candidate?.course_code || candidate?.code, 40);
    const units = Number(candidate?.units ?? candidate?.credits);
    const sectionCount = Array.isArray(candidate?.options) ? candidate.options.length : 0;
    return [
      code,
      Number.isFinite(units) ? `${units} units` : "",
      sectionCount ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}` : ""
    ].filter(Boolean).join(" · ");
  }

  function replaceSummary(target, items){
    if(!target) return;
    target.replaceChildren(...items.map(([value, label]) => {
      const item = document.createElement("span");
      const strong = document.createElement("b");
      const small = document.createElement("small");
      strong.textContent = String(value ?? "—");
      small.textContent = label;
      item.append(strong, small);
      return item;
    }));
  }

  function renderCatalogueBrowser(){
    const list = byId("hkbuCatalogueCourses");
    const summary = byId("hkbuCatalogueSummary");
    const results = byId("hkbuCatalogueResults");
    const caveats = byId("hkbuCatalogueCaveats");
    const retry = byId("hkbuCatalogueRetry");
    if(!list || !summary || !results || !caveats || !retry) return;
    list.replaceChildren();
    caveats.replaceChildren();
    results.textContent = "";
    if(!state.catalogue){
      summary.replaceChildren();
      retry.hidden = !(state.catalogueAttempted && !state.cataloguePromise);
      const note = document.createElement("p");
      note.className = "hkbu-portal-empty";
      note.textContent = state.catalogueAttempted && !state.cataloguePromise
        ? text("catalogueUnavailable")
        : text("catalogueLoadingList");
      list.append(note);
      return;
    }
    retry.hidden = true;

    const courses = Array.isArray(state.catalogue.courses) ? state.catalogue.courses : [];
    const sectionCount = courses.reduce(
      (total, course) => total + (Array.isArray(course?.sections) ? course.sections.length : 0),
      0
    );
    replaceSummary(summary, [
      [clean(state.catalogue.term, 120) || "—", text("catalogueTerm")],
      [courses.length, text("catalogueCourses")],
      [sectionCount, text("catalogueSections")],
      [formattedDay(state.catalogue.captured_at) || "—", text("catalogueReference")],
      [
        clean(state.catalogue.publication_status, 80).replaceAll("_", " ") || "—",
        text("cataloguePublication")
      ],
      [
        [
          state.catalogueDelivery === "bundled_fallback" ? "bundled reference" : "",
          clean(state.catalogue.source_mode, 120).replaceAll("_", " ")
        ].filter(Boolean).join(" · ") || "—",
        text("catalogueSource")
      ]
    ]);
    const catalogueCaveats = Array.isArray(state.catalogue.caveats)
      ? state.catalogue.caveats.slice(0, 5)
      : [];
    caveats.replaceChildren(...catalogueCaveats.map(value => {
      const item = document.createElement("li");
      item.textContent = clean(value, 1000);
      return item;
    }));

    const query = clean(byId("hkbuCatalogueSearch")?.value, 120).toLowerCase();
    const matching = query
      ? courses.filter(course => [
        course?.course_code,
        course?.title,
        course?.chinese_title,
        course?.academic_group,
        course?.unit_code
      ].some(value => clean(value, 240).toLowerCase().includes(query)))
      : courses;
    const visible = matching.slice(0, query ? 50 : 30);
    if(!visible.length){
      const note = document.createElement("p");
      note.className = "hkbu-portal-empty";
      note.textContent = text("catalogueEmpty");
      list.append(note);
      return;
    }

    visible.forEach(course => {
      const article = document.createElement("article");
      article.className = "hkbu-catalogue-course";
      const title = document.createElement("b");
      const meta = document.createElement("span");
      const restriction = document.createElement("small");
      title.textContent = `${clean(course?.course_code, 40)} · ${clean(course?.title, 240)}`;
      const sections = Array.isArray(course?.sections) ? course.sections.length : 0;
      meta.textContent = [
        course?.units != null && Number.isFinite(Number(course.units))
          ? `${Number(course.units)} units`
          : "",
        clean(course?.academic_group, 160),
        sections ? `${sections} ${text("catalogueSections")}` : ""
      ].filter(Boolean).join(" · ");
      restriction.textContent = [
        clean(course?.prerequisite_text, 500),
        clean(course?.corequisite_text, 500),
        clean(course?.target_students, 500)
      ].filter(Boolean).join(" · ") || text("catalogueNoRestriction");
      article.append(title, meta, restriction);
      list.append(article);
    });
    results.textContent = formattedText("catalogueResults", {
      shown:visible.length,
      total:matching.length
    });
  }

  function renderSnapshotReview(){
    const empty = byId("hkbuPortalSnapshotEmpty");
    const review = byId("hkbuPortalSnapshotReview");
    if(!empty || !review) return;
    const hasSnapshot = !!state.snapshot;
    empty.hidden = hasSnapshot;
    review.hidden = !hasSnapshot;
    if(!hasSnapshot) return;
    const addButton = byId("hkbuPortalAddSelected");
    if(addButton){
      addButton.disabled = !state.catalogueTermMatches;
      addButton.title = state.catalogueTermMatches ? "" : text("personalTermMismatch");
    }

    const summary = byId("hkbuPortalSummary");
    const summaryItems = [
      [state.assigned.length, text("assigned")],
      [state.allCandidates.length, text("possible")],
      [state.unresolved.length, text("unresolved")],
      [formattedDate(state.snapshot?.source?.captured_at), text("captured")],
      ...(state.catalogueTermMatches
        ? [[formattedDate(state.catalogue?.captured_at), text("catalogueAsOf")]]
        : [])
    ];
    replaceSummary(summary, summaryItems);
    const catalogueConsent = byId("hkbuPortalCatalogueConsent");
    catalogueConsent.disabled = !state.contribution;
    if(!state.contribution) catalogueConsent.checked = false;
    catalogueConsent.title = state.contribution ? "" : text("catalogueTermRequired");

    const list = byId("hkbuPortalCandidates");
    list.replaceChildren();
    const query = clean(byId("hkbuPortalCourseSearch")?.value, 120).toLowerCase();
    const requirementPool = query
      ? state.allCandidates.filter(candidate => [
        candidate?.course_code,
        candidate?.code,
        candidate?.title,
        candidate?.name
      ].some(value => clean(value, 240).toLowerCase().includes(query)))
      : state.candidates;
    const combined = [
      ...state.assigned.map(candidate => ({candidate, assigned:true})),
      ...requirementPool.slice(0, query ? 50 : 30).map(candidate => ({candidate, assigned:false}))
    ];
    if(!combined.length){
      const note = document.createElement("p");
      note.className = "hkbu-portal-empty";
      note.textContent = query ? text("noSearchMatches") : text("noScheduledCandidates");
      list.append(note);
      updateSelectionMeta();
      return;
    }
    combined.forEach(({candidate, assigned}) => {
      const key = candidateKey(candidate);
      const label = document.createElement("label");
      label.className = `hkbu-portal-candidate${assigned ? " assigned" : ""}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = assigned || state.selected.has(key);
      checkbox.disabled = assigned;
      checkbox.addEventListener("change", () => {
        if(checkbox.checked) state.selected.add(key);
        else state.selected.delete(key);
        updateSelectionMeta();
      });
      const copy = document.createElement("span");
      const title = document.createElement("b");
      const meta = document.createElement("span");
      const reason = document.createElement("small");
      title.textContent = clean(candidate?.title || candidate?.name, 240) || key;
      meta.textContent = candidateMeta(candidate);
      reason.textContent = candidateReasons(candidate, assigned);
      copy.append(title, meta, reason);
      label.append(checkbox, copy);
      list.append(label);
    });
    updateSelectionMeta();
  }

  function updateSelectionMeta(){
    const target = byId("hkbuPortalSelectionMeta");
    if(!target) return;
    const count = selectedPlannerCandidates().length;
    target.textContent = text("selectedCount").replace("{count}", String(count));
  }

  function selectedPlannerCandidates(){
    return [
      ...state.assigned,
      ...state.allCandidates.filter(candidate => state.selected.has(candidateKey(candidate)))
    ].slice(0, 60);
  }

  function isMissingRpc(error){
    return /function|schema cache|does not exist|404|PGRST202/i.test(String(error?.message || error || ""));
  }

  async function persistSnapshot({shareCatalogue}){
    if(institutionContext().importAdapterId !== "hkbu"){
      throw new Error(text("connectorRequired"));
    }
    if(typeof authClient === "undefined" || !authClient?.rpc || typeof currentUser === "undefined" || !currentUser){
      return {saved:false, unavailable:true};
    }
    const response = await authClient.rpc("save_my_hkbu_portal_import", {
      p_snapshot:state.snapshot,
      p_catalogue_contribution:shareCatalogue ? state.contribution : null
    });
    if(response.error){
      if(isMissingRpc(response.error)) return {saved:false, unavailable:true};
      throw response.error;
    }
    return {saved:true, data:response.data};
  }

  async function addSelectedToPlanner(){
    if(!state.snapshot || state.processing || state.privateMutation) return;
    if(!state.catalogueTermMatches){
      setStatus(text("personalTermMismatch"), "error");
      return;
    }
    if(institutionContext().importAdapterId !== "hkbu"){
      setStatus(text("connectorRequired"), "error");
      return;
    }
    if(!byId("hkbuPortalPrivateConsent").checked){
      setStatus(text("consentRequired"), "error");
      return;
    }
    const context = window.ConCoursePlanner?.getSessionContext?.();
    if(!context?.signedIn || !context.loaded){
      setStatus(text("signInRequired"), "error");
      return;
    }
    const userId = remoteUserId();
    const signature = institutionSignature();
    const snapshotRequestId = state.snapshotRequestId;
    const importRequestId = ++state.plannerImportRequestId;
    const isCurrentRequest = () => importRequestId === state.plannerImportRequestId
      && snapshotRequestId === state.snapshotRequestId
      && userId === remoteUserId()
      && signature === institutionSignature();
    const button = byId("hkbuPortalAddSelected");
    button.disabled = true;
    state.processing = true;
    state.privateMutation = true;
    try {
      const selected = selectedPlannerCandidates();
      const stored = await persistSnapshot({
        shareCatalogue:byId("hkbuPortalCatalogueConsent").checked
      });
      if(!isCurrentRequest()) return;
      const result = window.ConCoursePlanner.importCourseSelection(selected, {
        replacePortal:true,
        academicProfile:state.snapshot.academic_profile || null,
        source:state.snapshot.source || null
      });
      writeStatus({
        mode:"user_portal_import",
        term:clean(state.snapshot?.source?.term, 120),
        captured_at:clean(state.snapshot?.source?.captured_at, 80) || new Date().toISOString(),
        parser_version:clean(state.snapshot?.source?.parser_version, 40),
        official:false
      });
      renderConnectionStatus();
      window.ConCoursePlanner.open?.();
      const message = result.skipped
        ? `${text("imported")} ${text("importPartial")}`
        : text("imported");
      setStatus(stored.unavailable ? `${message} ${text("remoteUnavailable")}` : message, stored.unavailable ? "" : "success");
    } catch(error){
      if(!isCurrentRequest()) return;
      console.error("Could not import HKBU courses:", error);
      setStatus(clean(error?.message, 500) || text("invalidSnapshot"), "error");
    } finally {
      if(importRequestId === state.plannerImportRequestId){
        state.privateMutation = false;
        state.processing = false;
        button.disabled = !state.catalogueTermMatches;
      }
    }
  }

  async function disconnectPortal(){
    if(state.processing || state.privateMutation){
      setStatus(text("privateOperationBusy"));
      return;
    }
    if(!confirm(text("disconnectConfirm"))) return;
    const userId = remoteUserId();
    const signature = institutionSignature();
    const snapshotRequestId = state.snapshotRequestId;
    const removalRequestId = ++state.plannerImportRequestId;
    const isCurrentRequest = () => removalRequestId === state.plannerImportRequestId
      && snapshotRequestId === state.snapshotRequestId
      && userId === remoteUserId()
      && signature === institutionSignature();
    state.processing = true;
    state.privateMutation = true;
    try {
      if(typeof authClient !== "undefined" && authClient?.rpc && typeof currentUser !== "undefined" && currentUser){
        const response = await authClient.rpc("disconnect_my_hkbu_portal");
        if(!isCurrentRequest()) return;
        if(response.error && !isMissingRpc(response.error)) throw response.error;
      }
      if(!isCurrentRequest()) return;
      const context = window.ConCoursePlanner?.getSessionContext?.();
      if(context?.signedIn && context.loaded){
        window.ConCoursePlanner.importCourseSelection([], {replacePortal:true});
      }
      clearSnapshotState();
      writeStatus(null);
      renderConnectionStatus();
      renderSnapshotReview();
      setStatus(text("disconnectedDone"), "success");
    } catch(error){
      if(!isCurrentRequest()) return;
      console.error("Could not disconnect HKBU portal:", error);
      setStatus(clean(error?.message, 500), "error");
    } finally {
      if(removalRequestId === state.plannerImportRequestId){
        state.privateMutation = false;
        state.processing = false;
      }
    }
  }

  function remoteUserId(){
    try {
      return typeof currentUser !== "undefined" ? currentUser?.id || null : null;
    } catch(_error){
      return null;
    }
  }

  async function loadRemoteState(){
    const userId = remoteUserId();
    if(institutionContext().importAdapterId !== "hkbu") return;
    if(!userId || state.remoteLoadedFor === userId || typeof authClient === "undefined" || !authClient?.rpc) return;
    const signature = institutionSignature();
    const requestId = ++state.remoteRequestId;
    const isCurrentRequest = () => requestId === state.remoteRequestId
      && userId === remoteUserId()
      && signature === institutionSignature();
    state.remoteLoadedFor = userId;
    try {
      const response = await authClient.rpc("get_my_hkbu_portal_state");
      if(!isCurrentRequest()) return;
      if(response.error){
        if(isMissingRpc(response.error)) return;
        throw response.error;
      }
      const payload = Array.isArray(response.data) ? response.data[0] : response.data;
      const snapshot = payload?.snapshot || payload?.latest_snapshot || null;
      if(snapshot){
        const official = payload?.official === true || payload?.connection?.official === true;
        const applied = await processSnapshot(snapshot, {
          message:false,
          expectedUserId:userId,
          expectedInstitutionSignature:signature,
          official
        });
        if(isCurrentRequest() && applied && state.snapshot){
          writeStatus({
            mode:"user_portal_import",
            term:clean(snapshot?.source?.term, 120),
            captured_at:clean(snapshot?.source?.captured_at, 80) || new Date().toISOString(),
            parser_version:clean(snapshot?.source?.parser_version, 40),
            official
          });
          renderConnectionStatus();
        }
      }
    } catch(error){
      if(isCurrentRequest()){
        state.remoteLoadedFor = null;
        console.warn("Could not load private HKBU portal state:", error);
      }
    }
  }

  function syncInstitutionContext(){
    const context = institutionContext();
    const signature = institutionSignature(context);
    const changed = state.institutionSignature !== signature;
    if(changed){
      state.institutionSignature = signature;
      state.remoteRequestId += 1;
      state.remoteLoadedFor = null;
      clearSnapshotState();
      if(context.catalogueId !== "hkbu"){
        state.catalogueRequestId += 1;
        state.catalogue = null;
        state.catalogueManifest = null;
        state.cataloguePromise = null;
        state.catalogueAttempted = false;
        state.catalogueDelivery = "";
      }
      if(context.importAdapterId !== "hkbu") state.lastStatus = null;
    }
    renderCopy();
    if(context.catalogueId === "hkbu" && !state.catalogue && !state.catalogueAttempted){
      void loadCatalogue();
    }
    if(context.importAdapterId === "hkbu") void loadRemoteState();
  }

  function initialize(){
    ensureProfileCard();
    ensurePlannerPanel();
    syncInstitutionContext();
    window.addEventListener(SNAPSHOT_EVENT, event => {
      void processSnapshot(event?.detail);
    });
    window.addEventListener(INSTITUTION_CONTEXT_EVENT, () => syncInstitutionContext());
    const languageObserver = new MutationObserver(() => renderCopy());
    languageObserver.observe(document.documentElement, {attributes:true, attributeFilter:["lang"]});
    const authLabel = byId("authUser");
    if(authLabel){
      const authObserver = new MutationObserver(() => {
        const userId = remoteUserId();
        if(!userId) state.remoteLoadedFor = null;
        syncStatusForCurrentUser();
        syncInstitutionContext();
      });
      authObserver.observe(authLabel, {childList:true, subtree:true, characterData:true});
    }
    window.setTimeout(() => {
      syncStatusForCurrentUser();
      syncInstitutionContext();
    }, 1000);
  }

  initialize();
})();
