"use strict";

(() => {
  const hubState = {
    sessionUserId: null,
    generation: 0,
    conversationRequest: 0,
    conversationListRequest: 0,
    feedRequest: 0,
    profileRequest: 0,
    profilePreviewRequest: 0,
    socialConnectionRequest: 0,
    activeView: "community",
    membership: null,
    membershipError: "",
    profile: null,
    profileUserId: null,
    profileLoading: false,
    profileHydrated: false,
    profileDirty: false,
    profilePreview: null,
    profilePreviewReturnFocus: null,
    socialConnectionUserId: null,
    socialIdentities: new Map(),
    socialConnectionLoading: false,
    socialConnectionProvider: null,
    socialReturnHandled: false,
    socialStatus: null,
    actionResolver: null,
    actionReturnFocus: null,
    actionHasInput: false,
    actionInputRequired: false,
    actionRequiredMessage: "",
    actionBackgroundModals: [],
    profilePreviewBackgroundModals: [],
    insightRows: [],
    insightsLoaded: false,
    feed: [],
    conversations: [],
    activeConversationId: null,
    activeConversationUserId: null,
    activeConversationName: "",
    activeConversationUsername: "",
    messages: [],
    sendingMessage: false,
    messagePoll: null,
    loadingFeed: false,
    loadingConversations: false,
    feedTopic: "all",
    feedQuery: "",
    feedMode: "all",
    feedOffset: 0,
    feedHasMore: false,
    avatarPendingBlob: null,
    avatarPendingUrl: "",
    avatarPendingMimeType: "",
    avatarPendingExtension: "",
    avatarDeleteRequested: false,
    avatarBusy: false,
    avatarOperation: 0,
    avatarUrlCache: new Map(),
    avatarLoadCache: new Map(),
    composerMedia: [],
    composerMediaBusy: false,
    mediaPrepareOperation: 0,
    publishOperation: 0,
    communityMediaUrlCache: new Map(),
    communityMediaLoadCache: new Map(),
    communityVideoUrlCache: new Map(),
    highlightedPostId: "",
    likeBusy: new Set(),
    bookmarkBusy: new Set(),
    pollBusy: new Set()
  };

  const communityMediaObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const action = entry.isIntersecting
            ? entry.target._loadCommunityMedia
            : entry.target._unloadCommunityMedia;
          if(typeof action === "function") action();
        });
      }, {rootMargin:"1200px 0px"})
    : null;
  let heicDecoderPromise = null;

  const SOCIAL_PROVIDERS = Object.freeze({
    google: Object.freeze({provider:"google", label:"Google", mark:"G"}),
    github: Object.freeze({provider:"github", label:"GitHub", mark:"GH"})
  });
  const SOCIAL_RETURN_KEY = "concourse_social_connection_return";
  const SOCIAL_OAUTH_RETURN_URL = "https://1239744601-netizen.github.io/ConCourse/";
  const AVATAR_URL_CACHE_LIMIT = 48;
  const COMMUNITY_FEED_PAGE_SIZE = 30;
  const COMMUNITY_FEED_WINDOW = 90;

  const node = (tag, className="", content="") => {
    const element = document.createElement(tag);
    if(className) element.className = className;
    if(content !== "") element.textContent = String(content);
    return element;
  };

  const setStatus = (id, message="", kind="") => {
    const element = $(id);
    if(!element) return;
    element.textContent = message;
    element.className = `hub-inline-status${kind ? ` ${kind}` : ""}`;
  };

  const locale = () => currentLanguage === "zh-CN" ? "zh-CN" : currentLanguage === "zh-HK" ? "zh-HK" : "en-GB";
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || "") : date.toLocaleString(locale(), {dateStyle:"medium", timeStyle:"short"});
  };
  const formatCompactDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(locale(), {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});
  };
  const featureError = error => {
    const message = String(error?.message || "");
    if(/verified school membership|membership must be verified|school verification/i.test(message)) return t("schoolVerificationRequired");
    if(/Could not find the function|schema cache|does not exist|relation .* does not exist|PGRST202/i.test(message)) return t("memberSetupRequired");
    if(/already reported/i.test(message)) return t("alreadyReported");
    if(/Please wait/i.test(message)) return t("rateLimited");
    if(/not accepting messages|Messaging is unavailable|blocked the other/i.test(message)) return t("messagingUnavailable");
    if(/No messageable schoolmate/i.test(message)) return t("conversationStartFailed");
    if(/Post is unavailable|Comment is unavailable|Conversation is unavailable|Campus profile is unavailable/i.test(message)) return t("contentUnavailable");
    return t("featureUnavailable");
  };

  const missingRpcError = error => /Could not find the function|schema cache|PGRST202/i.test(String(error?.message || ""));

  const wrapMediaUploadError = (error, bucket) => {
    const wrapped = new Error(String(error?.message || "Media upload failed"));
    wrapped.name = "ConCourseMediaUploadError";
    wrapped.mediaUpload = true;
    wrapped.bucket = bucket;
    wrapped.code = error?.code;
    wrapped.status = error?.status || error?.statusCode;
    wrapped.cause = error;
    return wrapped;
  };

  const mediaUploadError = (error, {membershipRequired=false}={}) => {
    const message = String(error?.message || error?.cause?.message || "");
    const status = Number(error?.status || error?.statusCode || error?.cause?.status || error?.cause?.statusCode || 0);
    console.warn("ConCourse media operation failed.", error?.cause || error);
    if(/verified school membership|membership must be verified|school verification/i.test(message)) return t("schoolVerificationRequired");
    if(/payload too large|maximum.*size|file.*size|entity too large/i.test(message) || status === 413) return t("mediaUploadRejected");
    if(error?.mediaUpload && membershipRequired && (status === 401 || status === 403 || /row.level|policy|unauthori[sz]ed|permission/i.test(message))){
      return hubState.membership?.status === "verified" ? t("mediaSetupRequired") : t("schoolVerificationRequired");
    }
    if(/bucket.*not found|not found.*bucket|row.level|policy|permission|mime|content.?type|schema cache|does not exist/i.test(message) || [400, 404, 409].includes(status)) return t("mediaSetupRequired");
    if(/fetch|network|offline|timeout|connection/i.test(message)) return t("mediaUploadNetwork");
    return t("mediaUploadFailed");
  };

  const socialConnectionError = (error, provider) => {
    const message = String(error?.message || "");
    const label = SOCIAL_PROVIDERS[provider]?.label || t("socialAccount");
    if(/manual.*link|identity.*link.*disabled|provider.*(disabled|not enabled)|unsupported provider|provider.*not found/i.test(message)){
      return {key:"providerSetupRequired", variables:{provider:label}};
    }
    return {key:"providerConnectionFailed", variables:{provider:label}};
  };

  const renderSocialConnectionStatus = () => {
    const status = hubState.socialStatus;
    setStatus("socialConnectionStatus", status ? t(status.key, status.variables) : "", status?.kind || "");
  };

  const setSocialConnectionStatus = (key="", variables={}, kind="") => {
    hubState.socialStatus = key ? {key, variables, kind} : null;
    renderSocialConnectionStatus();
  };

  const hubAccessAllowed = () => !!(
    currentUser
    && loadedUserId === currentUser.id
    && finalTimetable?.savedAt
  );
  const requestContext = () => ({generation:hubState.generation, userId:currentUser?.id || null});
  const contextIsCurrent = context => !!(
    context?.userId
    && context.generation === hubState.generation
    && currentUser?.id === context.userId
  );

  function resetSensitiveState(nextUserId){
    revokeAvatarUrls();
    revokeCommunityMediaUrls();
    window.ConCourseMarketplace?.reset(nextUserId);
    hubState.sessionUserId = nextUserId;
    hubState.generation += 1;
    hubState.conversationRequest += 1;
    hubState.conversationListRequest += 1;
    hubState.feedRequest += 1;
    hubState.profileRequest += 1;
    hubState.profilePreviewRequest += 1;
    hubState.socialConnectionRequest += 1;
    hubState.membership = null;
    hubState.membershipError = "";
    hubState.profile = null;
    hubState.profileUserId = null;
    hubState.profileLoading = false;
    hubState.profileHydrated = false;
    hubState.profileDirty = false;
    hubState.profilePreview = null;
    hubState.profilePreviewReturnFocus = null;
    hubState.socialConnectionUserId = null;
    hubState.socialIdentities = new Map();
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    hubState.socialReturnHandled = false;
    hubState.socialStatus = null;
    hubState.insightRows = [];
    hubState.insightsLoaded = false;
    hubState.feed = [];
    hubState.conversations = [];
    hubState.activeConversationId = null;
    hubState.activeConversationUserId = null;
    hubState.activeConversationName = "";
    hubState.activeConversationUsername = "";
    hubState.messages = [];
    hubState.sendingMessage = false;
    hubState.loadingFeed = false;
    hubState.loadingConversations = false;
    hubState.feedTopic = "all";
    hubState.feedQuery = "";
    hubState.feedMode = "all";
    hubState.feedOffset = 0;
    hubState.feedHasMore = false;
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingUrl = "";
    hubState.avatarPendingMimeType = "";
    hubState.avatarPendingExtension = "";
    hubState.avatarDeleteRequested = false;
    hubState.avatarBusy = false;
    hubState.avatarOperation += 1;
    hubState.composerMedia = [];
    hubState.composerMediaBusy = false;
    hubState.mediaPrepareOperation += 1;
    hubState.publishOperation += 1;
    hubState.highlightedPostId = "";
    hubState.likeBusy.clear();
    hubState.bookmarkBusy.clear();
    hubState.pollBusy.clear();
    configureMessagePolling(false);
    closeHubAction(null, {restoreFocus:false});

    fillMemberProfile({});
    setProfileFormDisabled(true);
    ["communityPostBody", "communityPostTags", "communitySearch", "communityMediaInput", "chatUsername", "chatMessageInput"].forEach(id => { if($(id)) $(id).value = ""; });
    resetCommunityPoll();
    renderComposerMedia();
    setCommunityComposerBusy(false);
    syncCommunityTopicControls();
    updateCommunityLoadMore();
    updateCommunityPostCounter();
    document.querySelectorAll("[data-community-topic]").forEach(button => {
      const active = button.dataset.communityTopic === "all";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    ["communityFeed", "conversationList", "chatMessages", "courseInsightChart"].forEach(id => $(id)?.replaceChildren());
    $("courseInsightScope").value = "same_major_year";
    $("courseInsightYear").value = "";
    syncInsightYearControl();
    closeSchoolmateProfile({restoreFocus:false});
    $("schoolmateProfileLinks").replaceChildren();
    $("schoolmateProfileInterests").replaceChildren();
    $("schoolmateProfileConnections").replaceChildren();
    $("schoolmateProfileLinksSection").hidden = true;
    $("schoolmateProfileConnectionsSection").hidden = true;
    ["communityComposerStatus", "chatStatus", "memberProfileStatus", "avatarUploadStatus", "courseInsightStatus"].forEach(id => setStatus(id, ""));
    setSocialConnectionStatus();
    renderSocialConnections();
    $("chatHeading").textContent = t("selectConversation");
    $("chatSubheading").textContent = "";
    $("chatMessageInput").disabled = true;
    $("sendChatMessage").disabled = true;
    $("reportConversation").disabled = true;
    $("blockConversationUser").disabled = true;
    ["loadCourseInsights", "publishCommunityPost", "startConversation"].forEach(id => { if($(id)) $(id).disabled = false; });
  }

  function academicLabel(){
    const identity = getAcademicIdentity();
    const degree = finalTimetable?.degreeLevel || loadedAcademicProfile.degree_level || $("degreeLevel")?.value;
    const year = Number(finalTimetable?.studyYear || loadedAcademicProfile.study_year || $("studyYear")?.value || 0);
    const stage = [degree ? t(`${degree}Degree`) : "", year ? t(`studyYear${year}`) : ""].filter(Boolean).join(" · ");
    return [identity.major, stage].filter(Boolean).join(" · ") || identity.school || t("notProvided");
  }

  function initialsFor(value){
    const parts = String(value || "ConCourse").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => part[0]?.toLocaleUpperCase()).join("") || "CC";
  }

  function revokeAvatarUrls(){
    if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
    hubState.avatarUrlCache.forEach(entry => URL.revokeObjectURL(entry.url));
    hubState.avatarPendingUrl = "";
    hubState.avatarUrlCache.clear();
    hubState.avatarLoadCache.clear();
  }

  function revokeCommunityMediaUrls(){
    unloadRenderedCommunityMedia();
    communityMediaObserver?.disconnect();
    hubState.composerMedia.forEach(item => { if(item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    hubState.communityMediaUrlCache.forEach(entry => URL.revokeObjectURL(entry.url));
    hubState.composerMedia = [];
    hubState.communityMediaUrlCache.clear();
    hubState.communityMediaLoadCache.clear();
    hubState.communityVideoUrlCache.clear();
  }

  function avatarCacheKey(path, revision=0){
    return `${path || ""}::${Number(revision || 0)}`;
  }

  function avatarUrlIsLoading(url){
    for(const image of document.images){
      if(image.src === url && !image.complete) return true;
    }
    return false;
  }

  function touchAvatarUrl(key){
    const entry = hubState.avatarUrlCache.get(key);
    if(!entry) return null;
    hubState.avatarUrlCache.delete(key);
    hubState.avatarUrlCache.set(key, entry);
    return entry;
  }

  function pruneAvatarUrlCache(protectedKey=""){
    while(hubState.avatarUrlCache.size > AVATAR_URL_CACHE_LIMIT){
      let candidate = null;
      for(const [key, entry] of hubState.avatarUrlCache){
        if(key === protectedKey || avatarUrlIsLoading(entry.url)) continue;
        candidate = [key, entry];
        break;
      }
      if(!candidate) break;
      hubState.avatarUrlCache.delete(candidate[0]);
      URL.revokeObjectURL(candidate[1].url);
    }
  }

  function settleAvatarUrl(key, url, loaded){
    if(!key) return;
    const entry = hubState.avatarUrlCache.get(key);
    if(!entry || entry.url !== url){
      pruneAvatarUrlCache();
      return;
    }
    if(!loaded){
      hubState.avatarUrlCache.delete(key);
      URL.revokeObjectURL(entry.url);
    } else touchAvatarUrl(key);
    pruneAvatarUrlCache();
  }

  async function getAvatarUrl(path, revision=0){
    if(!path || !authClient || !currentUser) return "";
    const key = avatarCacheKey(path, revision);
    const cached = touchAvatarUrl(key);
    if(cached){
      pruneAvatarUrlCache(key);
      return cached.url;
    }
    if(hubState.avatarLoadCache.has(key)) return hubState.avatarLoadCache.get(key);
    const context = requestContext();
    const request = (async () => {
      const { data, error } = await authClient.storage.from("member-avatars").download(path);
      if(error || !data || !contextIsCurrent(context)) return "";
      const url = URL.createObjectURL(data);
      if(!contextIsCurrent(context)){
        URL.revokeObjectURL(url);
        return "";
      }
      hubState.avatarUrlCache.set(key, {url});
      pruneAvatarUrlCache(key);
      return url;
    })().finally(() => {
      if(hubState.avatarLoadCache.get(key) === request) hubState.avatarLoadCache.delete(key);
    });
    hubState.avatarLoadCache.set(key, request);
    return request;
  }

  function applyAvatarImage(image, initials, name, path, revision=0, directUrl=""){
    if(!image || !initials) return;
    const fallback = initialsFor(name);
    initials.textContent = fallback;
    initials.hidden = false;
    image.hidden = true;
    image.removeAttribute("src");
    const requestKey = directUrl || avatarCacheKey(path, revision);
    const cacheKey = directUrl ? "" : requestKey;
    image.dataset.avatarRequest = requestKey;
    if(!directUrl && !path) return;
    const setImage = url => {
      if(!url || image.dataset.avatarRequest !== requestKey || !image.isConnected) return;
      image.onload = () => {
        if(image.dataset.avatarRequest !== requestKey) return;
        image.hidden = false;
        initials.hidden = true;
        settleAvatarUrl(cacheKey, url, true);
      };
      image.onerror = () => {
        image.hidden = true;
        initials.hidden = false;
        settleAvatarUrl(cacheKey, url, false);
      };
      image.src = url;
    };
    if(directUrl) setImage(directUrl);
    else void getAvatarUrl(path, revision).then(setImage);
  }

  function renderAvatarContainer(container, name, path, revision=0){
    if(!container) return;
    container.classList.remove("has-photo");
    container.replaceChildren(document.createTextNode(initialsFor(name)));
    const image = node("img", "hub-avatar-inline-image");
    image.alt = "";
    image.hidden = true;
    container.append(image);
    const requestKey = avatarCacheKey(path, revision);
    image.dataset.avatarRequest = requestKey;
    if(!path) return;
    void getAvatarUrl(path, revision).then(url => {
      if(!url || image.dataset.avatarRequest !== requestKey || !image.isConnected) return;
      image.onload = () => {
        image.hidden = false;
        container.classList.add("has-photo");
        settleAvatarUrl(requestKey, url, true);
      };
      image.onerror = () => {
        settleAvatarUrl(requestKey, url, false);
        image.remove();
        container.classList.remove("has-photo");
      };
      image.src = url;
    });
  }

  function createAvatar(name, path, revision=0, extraClass=""){
    const avatar = node("div", `hub-avatar${extraClass ? ` ${extraClass}` : ""}`, initialsFor(name));
    avatar.setAttribute("aria-hidden", "true");
    renderAvatarContainer(avatar, name, path, revision);
    return avatar;
  }

  function renderOwnAvatars(){
    if(!currentUser) return;
    const username = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Student";
    const name = hubState.profile?.display_name || username;
    const path = hubState.avatarDeleteRequested ? null : hubState.profile?.avatar_path;
    const revision = hubState.profile?.avatar_revision || 0;
    applyAvatarImage($("hubUserAvatar"), $("hubUserInitials"), name, path, revision);
    renderAvatarContainer($("hubComposerInitials"), name, path, revision);
    renderAvatarContainer($("hubRailInitials"), name, path, revision);
    applyAvatarImage(
      $("profileAvatarPreview"),
      $("profileAvatarInitials"),
      name,
      path,
      revision,
      hubState.avatarPendingUrl
    );
    $("removeProfileAvatar").disabled = hubState.avatarBusy || (!path && !hubState.avatarPendingBlob);
  }

  function identityLabel(displayName, username){
    const handle = username ? `@${username}` : t("anonymousStudent");
    return displayName ? `${displayName} · ${handle}` : handle;
  }

  function renderHubHeader(){
    const view = ["community", "marketplace", "messages", "overview", "profile"].includes(hubState.activeView) ? hubState.activeView : "community";
    const prefix = view === "overview"
      ? "hubInsights"
      : view === "community"
        ? "hubCommunity"
        : view === "marketplace"
          ? "hubMarketplace"
          : view === "messages"
            ? "hubMessages"
            : "hubProfile";
    $("hubPageKicker").textContent = t(`${prefix}Kicker`);
    $("hubGreeting").textContent = t(`${prefix}Title`);
    $("hubPageIntroduction").textContent = t(`${prefix}Intro`);
  }

  function renderIdentity(){
    if(!currentUser) return;
    const username = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Student";
    const name = hubState.profile?.display_name?.trim() || `@${username}`;
    $("hubUserName").textContent = name;
    $("hubUserAcademic").textContent = academicLabel();
    $("hubRailName").textContent = name;
    $("hubRailAcademic").textContent = academicLabel();
    renderOwnAvatars();
    const membershipStatus = ["verified", "rejected", "revoked"].includes(hubState.membership?.status)
      ? hubState.membership.status
      : "pending";
    $("hubMembershipStatus").textContent = t(`membership${membershipStatus[0].toLocaleUpperCase()}${membershipStatus.slice(1)}`);
    $("hubMembershipStatus").className = `hub-membership-status ${membershipStatus}`;
    renderHubHeader();
    $("hubNetworkScope").textContent = getAcademicIdentity().school || "—";
    const strength = profileStrength();
    $("hubRailProfileStrength").textContent = `${strength}%`;
    $("hubRailProfileStrengthBar").style.width = `${strength}%`;
  }

  function profileStrength(){
    const profile = hubState.profile || {};
    const checks = [
      profile.display_name,
      profile.bio,
      Array.isArray(profile.interests) && profile.interests.length,
      profile.instagram_url,
      profile.whatsapp_url,
      profile.linkedin_url,
      profile.website_url,
      profile.avatar_path,
      profile.wechat_id,
      hubState.socialIdentities.size > 0
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function renderFinalSchedule(){
    const snapshot = finalTimetable;
    const summary = snapshot?.summary || {};
    const courseList = Array.isArray(snapshot?.courses) ? snapshot.courses : [];
    $("hubCourseCount").textContent = summary.courseCount ?? courseList.length ?? 0;
    $("hubCreditCount").textContent = summary.credits ?? courseList.reduce((total, course) => total + Number(course.credits || 0), 0);
    $("hubProfileStrength").textContent = `${profileStrength()}%`;

    const summaryContainer = $("hubFinalSummary");
    summaryContainer.replaceChildren();
    const stats = [
      [summary.courseCount ?? courseList.length, t("coursesTakenStat")],
      [summary.credits ?? 0, t("creditsStat")],
      [summary.daysOnCampus ?? 0, t("daysOnCampusStat")],
      [`${Math.round(Number(summary.gapMinutes || 0) / 6) / 10}h`, t("totalGapsStat")]
    ];
    stats.forEach(([value, label]) => {
      const card = node("div", "hub-final-stat");
      card.append(node("b", "", value), node("span", "", label));
      summaryContainer.append(card);
    });

    const coursesContainer = $("hubFinalCourses");
    coursesContainer.replaceChildren();
    courseList.forEach(course => {
      const row = node("div", "hub-final-course");
      const copy = node("div");
      copy.append(node("b", "", course.name || course.code || t("notProvided")), node("small", "", [course.code, course.professor].filter(Boolean).join(" · ") || "—"));
      row.append(copy, node("span", "", `${Number(course.credits || 0)} ${t("creditsShort")}`));
      coursesContainer.append(row);
    });
    if(!courseList.length) coursesContainer.append(node("div", "hub-chart-empty", t("hubNoFinalSchedule")));
  }

  function renderOverview(){
    renderIdentity();
    renderFinalSchedule();
    const year = finalTimetable?.studyYear;
    if(year && !$("courseInsightYear").value) $("courseInsightYear").value = String(year);
  }

  function syncInsightYearControl(){
    const scope = $("courseInsightScope").value;
    $("courseInsightYear").disabled = !["same_major_year", "university_year"].includes(scope);
  }

  function hideHub(){
    configureMessagePolling(false);
    window.ConCourseMarketplace?.closeTransientUi?.();
    closeSchoolmateProfile({restoreFocus:false});
    closeHubAction(null, {restoreFocus:false});
    $("memberHub").hidden = true;
    document.body.classList.remove("hub-active");
    window.syncPrimaryNavigation?.();
  }

  function showTimetable(){
    hideHub();
    window.openTimetableDestination?.();
  }

  function showHub(view="community"){
    if(!hubAccessAllowed()){
      if(currentUser) window.openTimetableDestination?.();
      else openAuthModal();
      return;
    }
    appStarted = true;
    $("appWrap").hidden = true;
    $("schedulePage").hidden = true;
    $("memberHub").hidden = false;
    document.body.classList.add("app-active", "hub-active");
    document.body.classList.remove("schedule-active");
    window.syncPrimaryNavigation?.();
    switchView(view);
    window.scrollTo({top:0, behavior:"smooth"});
  }

  async function switchView(view){
    if(!["overview", "community", "marketplace", "messages", "profile"].includes(view)) view = "community";
    if(view !== "community") closeSchoolmateProfile({restoreFocus:false});
    hubState.activeView = view;
    $("memberHub").dataset.activeView = view;
    renderHubHeader();
    document.querySelectorAll("[data-hub-view]").forEach(element => { element.hidden = element.dataset.hubView !== view; });
    document.querySelectorAll("[data-hub-target]").forEach(button => {
      const active = button.dataset.hubTarget === view;
      button.classList.toggle("active", active);
      if(button.classList.contains("hub-nav-button")){
        if(active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    configureMessagePolling(view === "messages");
    if(view === "overview"){
      renderOverview();
      await loadMembership();
      if(hubState.membership?.status === "verified" && !hubState.insightsLoaded) await loadCourseInsights();
      else if(hubState.membership?.status !== "verified" && !hubState.insightsLoaded){
        insightEmpty(t("courseInsightUnavailable"), hubState.membershipError || t("schoolVerificationRequired"));
      }
    } else if(view === "community"){
      await Promise.all([loadCommunityFeed(), loadConversations()]);
    } else if(view === "marketplace"){
      await window.ConCourseMarketplace?.activate();
    } else if(view === "messages"){
      await loadConversations();
    } else if(view === "profile"){
      await Promise.all([loadMemberProfile(), loadSocialConnections({force:true})]);
    }
  }

  function configureMessagePolling(active){
    if(hubState.messagePoll){ clearInterval(hubState.messagePoll); hubState.messagePoll = null; }
    if(!active) return;
    hubState.messagePoll = window.setInterval(() => {
      if(document.visibilityState === "visible" && hubState.activeView === "messages" && !$("memberHub").hidden){
        loadConversations({force:true}).catch(console.warn);
      }
    }, 12000);
  }

  async function loadMembership(){
    if(!authClient || !currentUser) return null;
    const context = requestContext();
    const { data, error } = await authClient
      .from("school_memberships")
      .select("school_name, school_key, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if(!contextIsCurrent(context)) return null;
    if(error){
      hubState.membershipError = featureError(error);
    } else {
      hubState.membershipError = "";
      hubState.membership = data || null;
      if(hubState.membership?.status !== "verified"){
        hubState.insightRows = [];
        hubState.insightsLoaded = false;
      }
    }
    renderIdentity();
    return hubState.membership;
  }

  async function syncFinalSchedule(snapshot=finalTimetable){
    if(!authClient || !currentUser || !snapshot?.savedAt) return false;
    const context = requestContext();
    const { error } = await authClient.rpc("sync_final_schedule", {p_snapshot:snapshot});
    if(!contextIsCurrent(context)) return false;
    if(error){
      console.warn("The final timetable is safe in private planner state, but the anonymous insights index could not be updated:", error);
      return false;
    }
    return true;
  }

  function insightEmpty(title, description){
    const container = $("courseInsightChart");
    container.replaceChildren();
    const empty = node("div", "hub-chart-empty");
    empty.append(node("b", "", title), node("span", "", description));
    container.append(empty);
  }

  function renderInsights(rows){
    const container = $("courseInsightChart");
    container.replaceChildren();
    if(!Array.isArray(rows) || !rows.length){
      insightEmpty(t("courseInsightNoData"), t("courseInsightPrivacy", {minimum:"5"}));
      return;
    }
    rows.forEach(row => {
      const share = Math.max(0, Math.min(100, Number(row.share_percent || 0)));
      const chartRow = node("div", "hub-chart-row");
      const label = node("div", "hub-chart-label");
      label.append(node("b", "", row.course_name || row.course_code || row.course_key), node("span", "", row.course_code || t("courseChosenBy", {count:row.selection_count})));
      const track = node("div", "hub-chart-track");
      const fill = node("div", "hub-chart-fill");
      fill.style.width = `${share}%`;
      fill.title = t("courseChosenBy", {count:row.selection_count});
      track.append(fill);
      chartRow.append(label, track, node("div", "hub-chart-value", `${share}%`));
      container.append(chartRow);
    });
    setStatus("courseInsightStatus", t("courseChoiceParticipants", {count:rows[0].cohort_size || 0}));
  }

  async function loadCourseInsights(){
    if(!authClient || !currentUser) return;
    const context = requestContext();
    setStatus("courseInsightStatus", t("courseInsightLoading"));
    $("loadCourseInsights").disabled = true;
    insightEmpty(t("loading"), t("courseInsightLoading"));
    const yearValue = $("courseInsightYear").value;
    const scope = $("courseInsightScope").value;
    const { data, error } = await authClient.rpc("get_course_choice_stats", {
      p_scope: scope,
      p_study_year: ["same_major_year", "university_year"].includes(scope) && yearValue ? Number(yearValue) : null
    });
    if(!contextIsCurrent(context)) return;
    $("loadCourseInsights").disabled = false;
    if(error){
      insightEmpty(t("courseInsightUnavailable"), featureError(error));
      setStatus("courseInsightStatus", featureError(error), "error");
      return;
    }
    setStatus("courseInsightStatus", "");
    hubState.insightRows = data || [];
    hubState.insightsLoaded = true;
    renderInsights(hubState.insightRows);
  }

  const parseInterests = value => [...new Set(String(value || "").split(",").map(item => item.trim().slice(0, 45)).filter(Boolean))].slice(0, 20);
  function validatedUrl(value, provider){
    const input = String(value || "").trim();
    if(!input) return null;
    let url;
    try { url = new URL(input); } catch(_error){ throw new Error(t("invalidUrl")); }
    if(url.protocol !== "https:") throw new Error(t("invalidUrl"));
    const host = url.hostname.toLocaleLowerCase();
    const allowed = {
      instagram: host === "instagram.com" || host.endsWith(".instagram.com"),
      whatsapp: host === "wa.me" || host === "api.whatsapp.com",
      linkedin: host === "linkedin.com" || host.endsWith(".linkedin.com"),
      website: true
    };
    if(!allowed[provider]) throw new Error(t(`invalid${provider[0].toLocaleUpperCase()}${provider.slice(1)}Url`));
    return url.toString();
  }

  function validatedWechatId(value){
    const input = String(value || "").trim();
    if(!input) return null;
    if(input.length > 64 || /[\u0000-\u001f\u007f]/.test(input)) throw new Error(t("invalidWechatId"));
    return input;
  }

  function renderSocialConnections(){
    Object.values(SOCIAL_PROVIDERS).forEach(config => {
      const card = document.querySelector(`[data-social-provider="${config.provider}"]`);
      if(!card) return;
      const identity = hubState.socialIdentities.get(config.provider) || null;
      const connected = !!identity;
      const loading = hubState.socialConnectionLoading
        && (!hubState.socialConnectionProvider || hubState.socialConnectionProvider === config.provider);
      const state = card.querySelector("[data-provider-state]");
      const detail = card.querySelector("[data-provider-detail]");
      const connectButton = card.querySelector('[data-social-action="connect"]');
      const disconnectButton = card.querySelector('[data-social-action="disconnect"]');
      card.classList.toggle("connected", connected);
      card.setAttribute("aria-busy", loading ? "true" : "false");
      if(state){
        state.textContent = loading
          ? t("providerConnectionLoading", {provider:config.label})
          : t(connected ? "providerConnected" : "providerNotConnected", {provider:config.label});
      }
      const connectedAt = identity?.created_at || identity?.updated_at;
      if(detail){
        detail.textContent = connected
          ? (connectedAt
              ? t("providerConnectedDetail", {provider:config.label, date:formatDate(connectedAt)})
              : t("providerConnectedHelp", {provider:config.label}))
          : t("providerConnectionHelp", {provider:config.label});
      }
      if(connectButton){
        connectButton.textContent = t("connectProvider", {provider:config.label});
        connectButton.hidden = connected;
        connectButton.disabled = hubState.socialConnectionLoading || !currentUser;
      }
      if(disconnectButton){
        disconnectButton.textContent = t("disconnect");
        disconnectButton.hidden = !connected;
        disconnectButton.disabled = hubState.socialConnectionLoading || !currentUser;
      }
    });
    renderSocialConnectionStatus();
  }

  function clearSocialReturnIntent(expected=null){
    try {
      if(expected){
        const current = JSON.parse(sessionStorage.getItem(SOCIAL_RETURN_KEY) || "null");
        if(
          current?.userId !== expected.userId
          || current?.request !== expected.request
          || (expected.provider && current?.provider !== expected.provider)
        ) return false;
      }
      sessionStorage.removeItem(SOCIAL_RETURN_KEY);
      return true;
    } catch(_error){
      if(!expected){
        try { sessionStorage.removeItem(SOCIAL_RETURN_KEY); } catch(_nestedError){}
      }
      return false;
    }
  }

  function readSocialReturnIntent(){
    try {
      const raw = sessionStorage.getItem(SOCIAL_RETURN_KEY);
      if(!raw) return null;
      const intent = JSON.parse(raw);
      const age = Date.now() - Number(intent?.createdAt || 0);
      if(!SOCIAL_PROVIDERS[intent?.provider] || age < 0 || age > 20 * 60 * 1000){
        clearSocialReturnIntent();
        return null;
      }
      return intent;
    } catch(_error){
      clearSocialReturnIntent();
      return null;
    }
  }

  function finishSocialConnectionReturn(){
    if(hubState.socialReturnHandled || !currentUser) return;
    const intent = readSocialReturnIntent();
    if(!intent) return;
    if(intent.userId !== currentUser.id){
      clearSocialReturnIntent();
      return;
    }
    hubState.socialReturnHandled = true;
    clearSocialReturnIntent();
    const config = SOCIAL_PROVIDERS[intent.provider];
    const connected = hubState.socialIdentities.has(intent.provider);
    setSocialConnectionStatus(
      connected ? "providerConnectedSuccess" : "providerConnectionFailed",
      {provider:config.label},
      connected ? "success" : "error"
    );
    if(hubAccessAllowed() && ($("memberHub").hidden || hubState.activeView !== "profile")){
      window.setTimeout(() => showHub("profile"), 0);
    }
  }

  async function loadSocialConnections({force=false}={}){
    if(!authClient || !currentUser){
      renderSocialConnections();
      return hubState.socialIdentities;
    }
    const context = requestContext();
    if(hubState.socialConnectionLoading) return hubState.socialIdentities;
    if(!force && hubState.socialConnectionUserId === context.userId){
      renderSocialConnections();
      finishSocialConnectionReturn();
      return hubState.socialIdentities;
    }
    const request = ++hubState.socialConnectionRequest;
    hubState.socialConnectionLoading = true;
    hubState.socialConnectionProvider = null;
    renderSocialConnections();
    setSocialConnectionStatus("socialConnectionsLoading");
    let response;
    try {
      response = await authClient.auth.getUserIdentities();
    } catch(error){
      response = {data:null, error};
    }
    if(!contextIsCurrent(context) || request !== hubState.socialConnectionRequest) return null;
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    if(response.error){
      hubState.socialConnectionUserId = null;
      renderSocialConnections();
      const intent = readSocialReturnIntent();
      if(intent){
        hubState.socialReturnHandled = true;
        clearSocialReturnIntent();
      }
      const errorStatus = intent
        ? socialConnectionError(response.error, intent.provider)
        : {key:"socialConnectionsUnavailable", variables:{}};
      setSocialConnectionStatus(errorStatus.key, errorStatus.variables, "error");
      return hubState.socialIdentities;
    }
    const identities = Array.isArray(response.data?.identities) ? response.data.identities : [];
    const allowedIdentities = identities
      .filter(identity => !!SOCIAL_PROVIDERS[identity?.provider])
      .sort((left, right) => {
        const rightTime = new Date(right?.updated_at || right?.created_at || 0).getTime() || 0;
        const leftTime = new Date(left?.updated_at || left?.created_at || 0).getTime() || 0;
        return rightTime - leftTime;
      });
    hubState.socialIdentities = new Map();
    allowedIdentities.forEach(identity => {
      if(!hubState.socialIdentities.has(identity.provider)) hubState.socialIdentities.set(identity.provider, identity);
    });
    hubState.socialConnectionUserId = context.userId;
    renderSocialConnections();
    setSocialConnectionStatus();
    renderOverview();
    finishSocialConnectionReturn();
    return hubState.socialIdentities;
  }

  async function connectSocialProvider(provider){
    const config = SOCIAL_PROVIDERS[provider];
    if(!config) return;
    if(!authClient || !currentUser){
      setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
      return;
    }
    if(hubState.socialConnectionLoading || hubState.socialIdentities.has(provider)) return;
    if(typeof authClient.auth?.linkIdentity !== "function"){
      setSocialConnectionStatus("providerSetupRequired", {provider:config.label}, "error");
      return;
    }
    const context = requestContext();
    if(hubState.profileDirty && !(await saveMemberProfile())){
      if(!contextIsCurrent(context)) return;
      setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
      return;
    }
    if(!contextIsCurrent(context)) return;
    const request = ++hubState.socialConnectionRequest;
    hubState.socialConnectionLoading = true;
    hubState.socialConnectionProvider = provider;
    renderSocialConnections();
    setSocialConnectionStatus("providerConnecting", {provider:config.label});
    try {
      sessionStorage.setItem(SOCIAL_RETURN_KEY, JSON.stringify({
        provider,
        userId: context.userId,
        request,
        createdAt: Date.now()
      }));
    } catch(_error){}
    let response;
    try {
      response = await authClient.auth.linkIdentity({
        provider,
        options: {redirectTo:SOCIAL_OAUTH_RETURN_URL}
      });
    } catch(error){
      response = {error};
    }
    if(!contextIsCurrent(context) || request !== hubState.socialConnectionRequest) return;
    if(response?.error){
      clearSocialReturnIntent({provider, userId:context.userId, request});
      hubState.socialConnectionLoading = false;
      hubState.socialConnectionProvider = null;
      renderSocialConnections();
      const errorStatus = socialConnectionError(response.error, provider);
      setSocialConnectionStatus(errorStatus.key, errorStatus.variables, "error");
      return;
    }
    const oauthUrl = response?.data?.url;
    if(oauthUrl){
      window.location.assign(oauthUrl);
      return;
    }
    clearSocialReturnIntent({provider, userId:context.userId, request});
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    renderSocialConnections();
    setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
  }

  function handleUnexpectedSocialActionError(provider, action, error){
    const config = SOCIAL_PROVIDERS[provider];
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    if(action === "connect") clearSocialReturnIntent();
    renderSocialConnections();
    if(action === "disconnect"){
      setSocialConnectionStatus("providerDisconnectFailed", {provider:config?.label || t("socialAccount")}, "error");
    } else {
      const status = socialConnectionError(error, provider);
      setSocialConnectionStatus(status.key, status.variables, "error");
    }
    console.error(`Unexpected ${action} account error:`, error);
  }

  async function disconnectSocialProvider(provider){
    const config = SOCIAL_PROVIDERS[provider];
    const identity = hubState.socialIdentities.get(provider);
    if(!config || !authClient || !currentUser || !identity || hubState.socialConnectionLoading) return;
    const confirmed = await requestHubAction({
      title:t("disconnectProviderTitle", {provider:config.label}),
      message:t("confirmDisconnectProvider", {provider:config.label}),
      confirmLabel:t("disconnect"),
      danger:true
    });
    if(!confirmed) return;
    const context = requestContext();
    hubState.socialConnectionLoading = true;
    hubState.socialConnectionProvider = provider;
    renderSocialConnections();
    let response;
    try {
      response = await authClient.auth.unlinkIdentity(identity);
    } catch(error){
      response = {error};
    }
    if(!contextIsCurrent(context)) return;
    hubState.socialConnectionLoading = false;
    hubState.socialConnectionProvider = null;
    if(response.error){
      renderSocialConnections();
      setSocialConnectionStatus("providerDisconnectFailed", {provider:config.label}, "error");
      return;
    }
    hubState.socialIdentities.delete(provider);
    hubState.socialConnectionUserId = null;
    await loadSocialConnections({force:true});
    if(!contextIsCurrent(context)) return;
    setSocialConnectionStatus("providerDisconnected", {provider:config.label}, "success");
  }

  function fillMemberProfile(profile={}){
    $("profileDisplayName").value = profile.display_name || "";
    $("profilePhone").value = profile.phone_number || "";
    $("profileBio").value = profile.bio || "";
    $("profileInterests").value = Array.isArray(profile.interests) ? profile.interests.join(", ") : "";
    $("profileInstagram").value = profile.instagram_url || "";
    $("profileWhatsapp").value = profile.whatsapp_url || "";
    $("profileLinkedin").value = profile.linkedin_url || "";
    $("profileWechat").value = profile.wechat_id || "";
    $("profileShareWechat").checked = profile.share_wechat === true;
    $("profileWebsite").value = profile.website_url || "";
    $("profileVisibility").value = profile.profile_visibility === "private" ? "private" : "school";
    $("profileAllowMessages").checked = profile.allow_messages === true;
    $("profileAnalyticsConsent").checked = profile.analytics_consent === true;
    renderOwnAvatars();
  }

  function switchConnectionTab(tab){
    const activeTab = tab === "links" ? "links" : "verified";
    document.querySelectorAll("[data-connection-tab]").forEach(button => {
      const active = button.dataset.connectionTab === activeTab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    $("verifiedConnectionsPanel").hidden = activeTab !== "verified";
    $("profileLinksPanel").hidden = activeTab !== "links";
  }

  function handleConnectionTabKeydown(event){
    if(!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...document.querySelectorAll("[data-connection-tab]")];
    if(!tabs.length) return;
    event.preventDefault();
    const currentIndex = Math.max(0, tabs.indexOf(event.currentTarget));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    switchConnectionTab(tabs[nextIndex].dataset.connectionTab);
    tabs[nextIndex].focus();
  }

  function setProfileFormDisabled(disabled){
    document.querySelectorAll('[data-hub-view="profile"] input, [data-hub-view="profile"] textarea, [data-hub-view="profile"] select')
      .forEach(control => { control.disabled = disabled; });
    $("saveMemberProfile").disabled = disabled || hubState.profileLoading || hubState.avatarBusy;
    $("chooseProfileAvatar").disabled = disabled || hubState.avatarBusy;
    if(disabled || hubState.avatarBusy) $("removeProfileAvatar").disabled = true;
    else renderOwnAvatars();
  }

  async function isSvgUpload(file){
    const mime = String(file?.type || "").toLocaleLowerCase();
    const name = String(file?.name || "").toLocaleLowerCase();
    if(["image/svg+xml", "image/svg", "application/svg+xml"].includes(mime) || /\.svgz?$/.test(name)) return true;
    const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    if(header[0] === 0x1f && header[1] === 0x8b) return true;
    const utf8 = new TextDecoder("utf-8", {fatal:false}).decode(header).replace(/^\uFEFF/, "");
    if(/<\s*(?:[\w-]+:)?svg(?:\s|>)/i.test(utf8)) return true;
    if(header[0] === 0xff && header[1] === 0xfe){
      const utf16 = new TextDecoder("utf-16le", {fatal:false}).decode(header);
      if(/<\s*(?:[\w-]+:)?svg(?:\s|>)/i.test(utf16)) return true;
    }
    return false;
  }

  async function isHeicUpload(file){
    const mime = String(file?.type || "").toLocaleLowerCase();
    const extension = String(file?.name || "").split(".").pop()?.toLocaleLowerCase() || "";
    if(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"].includes(mime) || ["heic", "heif", "heics", "heifs"].includes(extension)) return true;
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if(header.length < 12 || String.fromCharCode(...header.slice(4, 8)) !== "ftyp") return false;
    return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(String.fromCharCode(...header.slice(8, 12)));
  }

  function loadHeicDecoder(invalidMessage){
    if(typeof window.heic2any === "function") return Promise.resolve(window.heic2any);
    if(heicDecoderPromise) return heicDecoderPromise;
    heicDecoderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      let timeout = 0;
      const finish = (error, converter) => {
        if(settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if(error){
          heicDecoderPromise = null;
          script.remove();
          reject(error);
        } else resolve(converter);
      };
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
      script.integrity = "sha512-VjmsArkf8Vv2yyvbXCyVxp+R3n4N2WyS1GEQ+YQxa7Hu0tx836WpY4nW9/T1W5JBmvuIsxkVH/DlHgp7NEMjDw==";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.dataset.heicDecoder = "";
      timeout = window.setTimeout(() => finish(new Error(t("heicDecoderUnavailable"))), 15000);
      script.onload = () => {
        if(typeof window.heic2any === "function") finish(null, window.heic2any);
        else finish(new Error(invalidMessage));
      };
      script.onerror = () => finish(new Error(t("heicDecoderUnavailable")));
      document.head.append(script);
    });
    return heicDecoderPromise;
  }

  async function convertHeicForBrowser(file, invalidMessage){
    const converter = await loadHeicDecoder(invalidMessage);
    const converted = await converter({blob:file, toType:"image/jpeg", quality:.94});
    const result = Array.isArray(converted) ? converted[0] : converted;
    if(!(result instanceof Blob) || !result.size) throw new Error(invalidMessage);
    return result.type === "image/jpeg" ? result : new Blob([result], {type:"image/jpeg"});
  }

  async function decodeRasterFile(file, invalidMessage, allowHeicFallback=true){
    if(typeof createImageBitmap === "function"){
      try {
        const bitmap = await createImageBitmap(file, {imageOrientation:"from-image"});
        return {source:bitmap, width:bitmap.width, height:bitmap.height, cleanup:() => bitmap.close()};
      } catch(_bitmapOptionsError){
        try {
          const bitmap = await createImageBitmap(file);
          return {source:bitmap, width:bitmap.width, height:bitmap.height, cleanup:() => bitmap.close()};
        } catch(_bitmapError){}
      }
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const candidate = new Image();
        candidate.onload = () => resolve(candidate);
        candidate.onerror = () => reject(new Error(invalidMessage));
        candidate.src = objectUrl;
      });
      return {
        source:image,
        width:Number(image.naturalWidth || image.width || 0),
        height:Number(image.naturalHeight || image.height || 0),
        cleanup:() => URL.revokeObjectURL(objectUrl)
      };
    } catch(error){
      URL.revokeObjectURL(objectUrl);
      if(allowHeicFallback && await isHeicUpload(file)){
        const converted = await convertHeicForBrowser(file, invalidMessage);
        return decodeRasterFile(converted, invalidMessage, false);
      }
      throw error;
    }
  }

  function canvasBlob(canvas, mimeType, quality){
    return new Promise(resolve => {
      if(typeof canvas.toBlob === "function"){
        try { canvas.toBlob(resolve, mimeType, quality); }
        catch(_error){ resolve(null); }
        return;
      }
      try {
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
        if(!match){ resolve(null); return; }
        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for(let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        resolve(new Blob([bytes], {type:match[1]}));
      } catch(_error){ resolve(null); }
    });
  }

  async function encodeNormalizedCanvas(canvas, options={}){
    const maxBytes = Number(options.maxOutputBytes || 8 * 1024 * 1024);
    const quality = Math.max(.55, Math.min(.95, Number(options.quality || .86)));
    const attempts = [
      {canvas, mimeType:"image/webp", extension:"webp", quality},
      {canvas, mimeType:"image/webp", extension:"webp", quality:Math.max(.62, quality - .12)},
      {canvas, mimeType:"image/png", extension:"png"}
    ];
    for(const attempt of attempts){
      const blob = await canvasBlob(attempt.canvas, attempt.mimeType, attempt.quality);
      if(blob?.size && String(blob.type).toLocaleLowerCase() === attempt.mimeType && blob.size <= maxBytes){
        return {blob, mimeType:attempt.mimeType, extension:attempt.extension};
      }
    }

    const flattened = document.createElement("canvas");
    flattened.width = canvas.width;
    flattened.height = canvas.height;
    const context = flattened.getContext("2d", {alpha:false});
    if(context){
      context.fillStyle = options.background || "#f7f7f5";
      context.fillRect(0, 0, flattened.width, flattened.height);
      context.drawImage(canvas, 0, 0);
      for(const jpegQuality of [Math.min(.92, quality), Math.max(.68, quality - .12), .58]){
        const blob = await canvasBlob(flattened, "image/jpeg", jpegQuality);
        if(blob?.size && String(blob.type).toLocaleLowerCase() === "image/jpeg" && blob.size <= maxBytes){
          return {blob, mimeType:"image/jpeg", extension:"jpg"};
        }
      }
    }
    throw new Error(options.outputTooLargeMessage || options.tooLargeMessage || options.invalidMessage || t("mediaInvalid"));
  }

  async function normalizeRasterUpload(file, options={}){
    const invalidMessage = options.invalidMessage || t("mediaInvalid");
    const tooLargeMessage = options.tooLargeMessage || t("imageTooLarge");
    if(!(file instanceof Blob) || !file.size) throw new Error(invalidMessage);
    if(file.size > Number(options.maxInputBytes || 25 * 1024 * 1024)) throw new Error(tooLargeMessage);
    if(await isSvgUpload(file)) throw new Error(options.svgMessage || t("svgUnsupported"));
    const decoded = await decodeRasterFile(file, invalidMessage);
    try {
      const width = Number(decoded.width || 0);
      const height = Number(decoded.height || 0);
      const minDimension = Number(options.minDimension || 1);
      if(width < minDimension || height < minDimension || width > 20000 || height > 20000 || width * height > 100000000) throw new Error(invalidMessage);
      const square = options.square === true;
      const maxEdge = Number(options.maxEdge || 2048);
      const scale = square ? 1 : Math.min(1, maxEdge / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = square ? Number(options.size || 512) : Math.max(1, Math.round(width * scale));
      canvas.height = square ? Number(options.size || 512) : Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d", {alpha:!square});
      if(!context) throw new Error(invalidMessage);
      if(square){
        context.fillStyle = options.background || "#f5f5f7";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const side = Math.min(width, height);
        context.drawImage(decoded.source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
      } else {
        context.drawImage(decoded.source, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
      }
      const encoded = await encodeNormalizedCanvas(canvas, {...options, invalidMessage});
      return {...encoded, width:canvas.width, height:canvas.height};
    } finally {
      decoded.cleanup();
    }
  }

  const normalizeRasterToWebP = normalizeRasterUpload;

  async function prepareProfileAvatar(file){
    if(!file || !currentUser) return;
    const context = requestContext();
    const operation = ++hubState.avatarOperation;
    hubState.avatarBusy = true;
    setProfileFormDisabled(false);
    setStatus("avatarUploadStatus", t("avatarPreparing"));
    try {
      const normalized = await normalizeRasterUpload(file, {
        square:true,
        size:512,
        minDimension:16,
        maxInputBytes:20 * 1024 * 1024,
        maxOutputBytes:2 * 1024 * 1024,
        quality:.88,
        invalidMessage:t("avatarInvalid"),
        tooLargeMessage:t("avatarTooLarge"),
        svgMessage:t("avatarSvgUnsupported")
      });
      if(!contextIsCurrent(context) || operation !== hubState.avatarOperation) return;
      if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
      hubState.avatarPendingBlob = normalized.blob;
      hubState.avatarPendingUrl = URL.createObjectURL(normalized.blob);
      hubState.avatarPendingMimeType = normalized.mimeType;
      hubState.avatarPendingExtension = normalized.extension;
      hubState.avatarDeleteRequested = false;
      hubState.profileDirty = true;
      setStatus("avatarUploadStatus", t("avatarReady"), "success");
    } catch(error){
      if(contextIsCurrent(context) && operation === hubState.avatarOperation) setStatus("avatarUploadStatus", error?.message || t("avatarInvalid"), "error");
    } finally {
      if(contextIsCurrent(context) && operation === hubState.avatarOperation){
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        renderOwnAvatars();
        $("profileAvatarInput").value = "";
      }
    }
  }

  function markAvatarForRemoval(){
    if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
    hubState.avatarPendingUrl = "";
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingMimeType = "";
    hubState.avatarPendingExtension = "";
    hubState.avatarDeleteRequested = true;
    hubState.profileDirty = true;
    setStatus("avatarUploadStatus", t("avatarRemoved"));
    renderOwnAvatars();
  }

  async function removeAvatarObject(path, warning){
    if(!path || !authClient) return;
    try {
      const removal = await authClient.storage.from("member-avatars").remove([path]);
      if(removal.error) console.warn(warning, removal.error);
    } catch(error){
      console.warn(warning, error);
    }
  }

  async function loadMemberProfile({force=false}={}){
    if(!authClient || !currentUser) return;
    const context = requestContext();
    if(hubState.profileLoading) return;
    if(!force && hubState.profileUserId === context.userId){
      hubState.profileHydrated = true;
      if(!hubState.profileDirty) fillMemberProfile(hubState.profile || {});
      setProfileFormDisabled(false);
      return;
    }
    const request = ++hubState.profileRequest;
    hubState.profileLoading = true;
    $("saveMemberProfile").disabled = true;
    if(!hubState.profileHydrated) setProfileFormDisabled(true);
    setStatus("memberProfileStatus", t("profileLoading"));
    const { data, error } = await authClient
      .from("member_profiles")
      .select("display_name, bio, phone_number, interests, avatar_path, avatar_revision, instagram_url, whatsapp_url, linkedin_url, wechat_id, share_wechat, website_url, profile_visibility, allow_messages, analytics_consent")
      .eq("user_id", context.userId)
      .maybeSingle();
    if(!contextIsCurrent(context) || request !== hubState.profileRequest) return;
    if(error){
      hubState.profileLoading = false;
      hubState.profileHydrated = true;
      setProfileFormDisabled(false);
      setStatus("memberProfileStatus", featureError(error), "error");
      return;
    }
    hubState.profile = data || {};
    hubState.profileUserId = context.userId;
    hubState.profileLoading = false;
    hubState.profileHydrated = true;
    if(!hubState.profileDirty) fillMemberProfile(hubState.profile);
    setProfileFormDisabled(false);
    setStatus("memberProfileStatus", "");
    renderOverview();
  }

  async function saveMemberProfile(){
    if(!authClient || !currentUser || hubState.profileLoading || hubState.avatarBusy || !hubState.profileHydrated) return false;
    const context = requestContext();
    const button = $("saveMemberProfile");
    let payload;
    const previousAvatarPath = hubState.profile?.avatar_path || null;
    const previousAvatarRevision = Number(hubState.profile?.avatar_revision || 0);
    try {
      payload = {
        user_id: context.userId,
        display_name: $("profileDisplayName").value.trim() || null,
        phone_number: $("profilePhone").value.trim() || null,
        bio: $("profileBio").value.trim() || null,
        interests: parseInterests($("profileInterests").value),
        avatar_path: previousAvatarPath,
        avatar_revision: previousAvatarRevision,
        instagram_url: validatedUrl($("profileInstagram").value, "instagram"),
        whatsapp_url: validatedUrl($("profileWhatsapp").value, "whatsapp"),
        linkedin_url: validatedUrl($("profileLinkedin").value, "linkedin"),
        wechat_id: validatedWechatId($("profileWechat").value),
        share_wechat: $("profileShareWechat").checked,
        website_url: validatedUrl($("profileWebsite").value, "website"),
        profile_visibility: $("profileVisibility").value,
        allow_messages: $("profileAllowMessages").checked,
        analytics_consent: $("profileAnalyticsConsent").checked
      };
    } catch(error){
      button.disabled = false;
      setStatus("memberProfileStatus", error.message, "error");
      return false;
    }

    button.disabled = true;
    hubState.avatarBusy = true;
    setProfileFormDisabled(true);
    setStatus("memberProfileStatus", t("saving"));
    let uploadedAvatarPath = "";
    if(hubState.avatarPendingBlob){
      const avatarMimeType = hubState.avatarPendingMimeType || hubState.avatarPendingBlob.type || "image/webp";
      const avatarExtension = hubState.avatarPendingExtension || ({"image/jpeg":"jpg", "image/png":"png", "image/webp":"webp"}[avatarMimeType] || "webp");
      uploadedAvatarPath = `${context.userId}/avatar-${crypto.randomUUID()}.${avatarExtension}`;
      let upload;
      try {
        upload = await authClient.storage.from("member-avatars").upload(uploadedAvatarPath, hubState.avatarPendingBlob, {
          upsert:false,
          contentType:avatarMimeType,
          cacheControl:"31536000"
        });
      } catch(error){
        await removeAvatarObject(uploadedAvatarPath, "An interrupted avatar upload left an owner-private object for later cleanup.");
        if(!contextIsCurrent(context)) return false;
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        button.disabled = false;
        const message = mediaUploadError(wrapMediaUploadError(error, "member-avatars"));
        setStatus("memberProfileStatus", message, "error");
        setStatus("avatarUploadStatus", message, "error");
        return false;
      }
      if(upload.error){
        await removeAvatarObject(uploadedAvatarPath, "An ambiguous avatar upload left an owner-private object for later cleanup.");
        if(!contextIsCurrent(context)) return false;
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        button.disabled = false;
        const message = mediaUploadError(wrapMediaUploadError(upload.error, "member-avatars"));
        setStatus("memberProfileStatus", message, "error");
        setStatus("avatarUploadStatus", message, "error");
        return false;
      }
      if(!contextIsCurrent(context)) return false;
      payload.avatar_path = uploadedAvatarPath;
      payload.avatar_revision = previousAvatarRevision + 1;
    } else if(hubState.avatarDeleteRequested){
      payload.avatar_path = null;
      payload.avatar_revision = previousAvatarRevision + 1;
    }

    let data;
    let error;
    try {
      ({data, error} = await authClient.from("member_profiles").upsert(payload, {onConflict:"user_id"}).select().single());
    } catch(requestError){
      await removeAvatarObject(uploadedAvatarPath, "A failed profile save left an owner-private avatar object for later cleanup.");
      if(!contextIsCurrent(context)) return false;
      hubState.avatarBusy = false;
      setProfileFormDisabled(false);
      button.disabled = false;
      setStatus("memberProfileStatus", featureError(requestError) || t("profileSaveFailed"), "error");
      return false;
    }
    if(error){
      await removeAvatarObject(uploadedAvatarPath, "A failed profile save left an owner-private avatar object for later cleanup.");
      if(!contextIsCurrent(context)) return false;
      hubState.avatarBusy = false;
      setProfileFormDisabled(false);
      button.disabled = false;
      setStatus("memberProfileStatus", featureError(error) || t("profileSaveFailed"), "error");
      return false;
    }
    if(!contextIsCurrent(context)) return false;
    hubState.avatarBusy = false;
    setProfileFormDisabled(false);
    button.disabled = false;
    const obsoleteAvatarPath = previousAvatarPath && previousAvatarPath !== data.avatar_path ? previousAvatarPath : "";
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingMimeType = "";
    hubState.avatarPendingExtension = "";
    hubState.avatarDeleteRequested = false;
    revokeAvatarUrls();
    hubState.profile = data;
    hubState.profileUserId = context.userId;
    hubState.profileDirty = false;
    setStatus("avatarUploadStatus", "");
    setStatus("memberProfileStatus", t("profileSaved"), "success");
    renderOverview();
    if(obsoleteAvatarPath){
      await removeAvatarObject(obsoleteAvatarPath, "The removed avatar is no longer referenced, but its private storage object could not be deleted.");
    }
    if(!contextIsCurrent(context)) return false;
    if(finalTimetable?.savedAt) await syncFinalSchedule(finalTimetable);
    if(!contextIsCurrent(context)) return false;
    return true;
  }

  function parseJsonValue(value, fallback){
    if(value == null) return fallback;
    if(typeof value !== "string") return value;
    try { return JSON.parse(value); }
    catch(_error){ return fallback; }
  }

  function updateCommunityPostCounter(){
    if(!$("communityPostBody") || !$("communityPostCounter")) return;
    $("communityPostCounter").textContent = `${$("communityPostBody").value.length} / 1200`;
  }

  function createPollOptionInput(value="", number=1){
    const input = node("input", "hub-poll-option-input");
    input.maxLength = 100;
    input.dataset.pollOption = "";
    input.dataset.pollNumber = String(number);
    input.placeholder = t("pollOptionPlaceholder");
    input.setAttribute("aria-label", t("pollOptionNumber", {number}));
    input.value = value;
    return input;
  }

  function resetCommunityPoll({restoreFocus=false}={}){
    const builder = $("communityPollBuilder");
    const question = $("communityPollQuestion");
    const list = $("communityPollOptions");
    if(builder) builder.hidden = true;
    if(question) question.value = "";
    if(list) list.replaceChildren(createPollOptionInput("", 1), createPollOptionInput("", 2));
    if(restoreFocus) requestAnimationFrame(() => $("addCommunityPoll")?.focus());
  }

  function addCommunityPollOption(){
    const list = $("communityPollOptions");
    if(!list) return;
    if(list.querySelectorAll("[data-poll-option]").length >= 6){
      setStatus("communityComposerStatus", t("pollOptionLimit"), "error");
      return;
    }
    const input = createPollOptionInput("", list.querySelectorAll("[data-poll-option]").length + 1);
    list.append(input);
    input.focus();
  }

  function communityPollPayload(){
    if($("communityPollBuilder")?.hidden) return null;
    const question = $("communityPollQuestion").value.trim();
    const options = [...document.querySelectorAll("#communityPollOptions [data-poll-option]")]
      .map(input => input.value.trim())
      .filter(Boolean);
    if(!question || options.length < 2) throw new Error(t("pollIncomplete"));
    if(new Set(options.map(option => option.toLocaleLowerCase())).size !== options.length) throw new Error(t("pollDuplicateOptions"));
    return {question, options:options.slice(0, 6)};
  }

  function setCommunityComposerBusy(busy){
    hubState.composerMediaBusy = busy;
    document.querySelectorAll(".hub-compose-card button, .hub-compose-card input, .hub-compose-card textarea")
      .forEach(control => { control.disabled = busy; });
  }

  function renderComposerMedia(){
    const preview = $("communityMediaPreview");
    if(!preview) return;
    preview.replaceChildren();
    hubState.composerMedia.forEach((item, index) => {
      const card = node("article", "hub-media-preview-item");
      if(item.kind === "video"){
        const video = node("video");
        video.src = item.previewUrl;
        video.controls = true;
        video.muted = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", item.altText || t("postVideo"));
        card.append(video);
      } else {
        const image = node("img");
        image.src = item.previewUrl;
        image.alt = item.altText || "";
        card.append(image);
      }
      const remove = node("button", "hub-media-preview-remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", t("removeMedia"));
      remove.onclick = () => {
        URL.revokeObjectURL(item.previewUrl);
        hubState.composerMedia = hubState.composerMedia.filter(candidate => candidate.id !== item.id);
        renderComposerMedia();
        requestAnimationFrame(() => {
          const remaining = [...preview.querySelectorAll(".hub-media-preview-remove")];
          (remaining[Math.min(index, Math.max(0, remaining.length - 1))] || $("addCommunityMedia"))?.focus();
        });
      };
      card.append(remove);
      const alt = node("input", "hub-media-alt");
      alt.maxLength = 180;
      alt.placeholder = item.kind === "video" ? t("videoDescriptionPlaceholder") : t("altTextPlaceholder");
      alt.setAttribute("aria-label", t("mediaDescriptionNumber", {number:index + 1}));
      alt.value = item.altText || "";
      alt.addEventListener("input", () => { item.altText = alt.value; });
      card.append(alt);
      preview.append(card);
    });
  }

  function videoUploadType(file){
    const mime = String(file.type || "").toLocaleLowerCase();
    const extension = String(file.name || "").split(".").pop()?.toLocaleLowerCase() || "";
    if(mime === "video/mp4" || extension === "mp4") return {mimeType:"video/mp4", extension:"mp4"};
    if(mime === "video/webm" || extension === "webm") return {mimeType:"video/webm", extension:"webm"};
    if(mime === "video/quicktime" || ["mov", "qt"].includes(extension)) return {mimeType:"video/quicktime", extension:"mov"};
    return null;
  }

  async function validateVideoSignature(file, type){
    if(!(file instanceof Blob) || !file.size) throw new Error(t("mediaInvalid"));
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const isWebM = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const isIsoMedia = bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
    if(type.mimeType === "video/webm" ? !isWebM : !isIsoMedia) throw new Error(t("videoInvalid"));
  }

  async function prepareCommunityMedia(files){
    const candidates = [...(files || [])];
    if(!candidates.length || hubState.composerMediaBusy || !currentUser) return;
    const context = requestContext();
    const operation = ++hubState.mediaPrepareOperation;
    const available = 4 - hubState.composerMedia.length;
    if(available <= 0){ setStatus("communityComposerStatus", t("mediaLimit"), "error"); return; }
    setCommunityComposerBusy(true);
    setStatus("communityComposerStatus", t("mediaPreparing"));
    let lastError = "";
    const prepared = [];
    let committed = false;
    try {
      for(const file of candidates.slice(0, available)){
        if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
        try {
          const videoType = videoUploadType(file);
          if(videoType){
            if(file.size > 40 * 1024 * 1024) throw new Error(t("videoTooLarge"));
            await validateVideoSignature(file, videoType);
            if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
            prepared.push({
              id:crypto.randomUUID(), kind:"video", blob:file, mimeType:videoType.mimeType,
              extension:videoType.extension, previewUrl:URL.createObjectURL(file), altText:""
            });
          } else {
            const normalized = await normalizeRasterUpload(file, {
              maxEdge:2048,
              maxInputBytes:25 * 1024 * 1024,
              maxOutputBytes:8 * 1024 * 1024,
              quality:.86,
              invalidMessage:t("mediaInvalid"),
              tooLargeMessage:t("imageTooLarge"),
              svgMessage:t("svgUnsupported")
            });
            if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
            prepared.push({
              id:crypto.randomUUID(), kind:"image", blob:normalized.blob, mimeType:normalized.mimeType,
              extension:normalized.extension, previewUrl:URL.createObjectURL(normalized.blob), altText:"",
              width:normalized.width, height:normalized.height
            });
          }
        } catch(error){
          lastError = error?.message || t("mediaInvalid");
        }
      }
      if(!contextIsCurrent(context) || operation !== hubState.mediaPrepareOperation) return;
      if(candidates.length > available) lastError = t("mediaLimit");
      hubState.composerMedia.push(...prepared);
      committed = true;
      renderComposerMedia();
      setStatus("communityComposerStatus", lastError || t("mediaReady"), lastError ? "error" : "success");
    } finally {
      if(!committed) prepared.forEach(item => URL.revokeObjectURL(item.previewUrl));
      if(contextIsCurrent(context) && operation === hubState.mediaPrepareOperation){
        setCommunityComposerBusy(false);
        if($("communityMediaInput")) $("communityMediaInput").value = "";
      }
    }
  }

  async function removeCommunityUploads(paths){
    if(!paths.length) return;
    try {
      const removal = await authClient.storage.from("community-media").remove(paths);
      if(removal.error) console.warn("Owner-private post media cleanup was deferred.", removal.error);
    } catch(error){
      console.warn("Owner-private post media cleanup was deferred.", error);
    }
  }

  async function uploadCommunityMedia(draftId, items, context, operation){
    const paths = [];
    const descriptors = [];
    for(const [position, item] of items.entries()){
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation) throw new Error("Stale publish operation");
      const path = `${context.userId}/posts/${draftId}/${crypto.randomUUID()}.${item.extension}`;
      let upload;
      try {
        upload = await authClient.storage.from("community-media").upload(path, item.blob, {
          upsert:false,
          contentType:item.mimeType,
          cacheControl:"31536000"
        });
      } catch(error){
        await removeCommunityUploads([...paths, path]);
        throw wrapMediaUploadError(error, "community-media");
      }
      if(upload.error){
        await removeCommunityUploads([...paths, path]);
        throw wrapMediaUploadError(upload.error, "community-media");
      }
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation){
        await removeCommunityUploads([...paths, path]);
        throw new Error("Stale publish operation");
      }
      paths.push(path);
      descriptors.push({
        storage_path:path,
        media_type:item.kind,
        mime_type:item.mimeType,
        alt_text:item.altText.trim() || null,
        position
      });
    }
    return {paths, descriptors};
  }

  async function getCommunityMediaUrl(path){
    if(!path || !authClient || !currentUser) return "";
    const cached = hubState.communityMediaUrlCache.get(path);
    if(cached?.url) return cached.url;
    const cacheKey = `image:${path}`;
    if(hubState.communityMediaLoadCache.has(cacheKey)) return hubState.communityMediaLoadCache.get(cacheKey);
    const generation = hubState.generation;
    const userId = currentUser.id;
    const pending = authClient.storage.from("community-media").download(path).then(({data, error}) => {
      if(error || !data) throw error || new Error(t("mediaUnavailable"));
      const url = URL.createObjectURL(data);
      if(generation !== hubState.generation || currentUser?.id !== userId){ URL.revokeObjectURL(url); return ""; }
      const entry = {url, consumers:new Set(), createdAt:Date.now()};
      hubState.communityMediaUrlCache.set(path, entry);
      window.setTimeout(() => {
        if(hubState.communityMediaUrlCache.get(path) === entry && entry.consumers.size === 0){
          URL.revokeObjectURL(entry.url);
          hubState.communityMediaUrlCache.delete(path);
        }
      }, 0);
      return url;
    }).finally(() => hubState.communityMediaLoadCache.delete(cacheKey));
    hubState.communityMediaLoadCache.set(cacheKey, pending);
    return pending;
  }

  function retainCommunityMediaUrl(path, url, holder){
    const entry = hubState.communityMediaUrlCache.get(path);
    if(!entry || entry.url !== url) return false;
    entry.consumers.add(holder);
    return true;
  }

  function releaseCommunityMediaUrl(path, holder){
    const entry = hubState.communityMediaUrlCache.get(path);
    if(!entry) return;
    entry.consumers.delete(holder);
    if(entry.consumers.size === 0){
      URL.revokeObjectURL(entry.url);
      hubState.communityMediaUrlCache.delete(path);
    }
  }

  async function getCommunityVideoUrl(path, {force=false}={}){
    if(!path || !authClient || !currentUser) return "";
    const context = requestContext();
    const cacheKey = `video:${path}`;
    if(force && hubState.communityMediaLoadCache.has(cacheKey)){
      try { await hubState.communityMediaLoadCache.get(cacheKey); }
      catch(_error){}
    }
    if(!contextIsCurrent(context)) return "";
    if(force) hubState.communityVideoUrlCache.delete(path);
    const cached = hubState.communityVideoUrlCache.get(path);
    if(cached?.url && cached.expiresAt > Date.now() + 30_000) return cached.url;
    if(hubState.communityMediaLoadCache.has(cacheKey)) return hubState.communityMediaLoadCache.get(cacheKey);
    const pending = authClient.storage.from("community-media").createSignedUrl(path, 3600).then(({data, error}) => {
      if(error || !data?.signedUrl) throw error || new Error(t("mediaUnavailable"));
      if(!contextIsCurrent(context)) return "";
      hubState.communityVideoUrlCache.set(path, {url:data.signedUrl, expiresAt:Date.now() + 3_540_000});
      return data.signedUrl;
    }).finally(() => hubState.communityMediaLoadCache.delete(cacheKey));
    hubState.communityMediaLoadCache.set(cacheKey, pending);
    return pending;
  }

  function renderPostMedia(post){
    const items = parseJsonValue(post.media, []);
    if(!Array.isArray(items) || !items.length) return null;
    const media = node("div", "hub-post-media");
    const visible = items.slice(0, 4).sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    media.dataset.count = String(visible.length);
    const context = requestContext();
    visible.forEach(item => {
      const holder = node("div", "hub-post-media-item");
      holder.dataset.communityMediaPending = "";
      holder.append(node("span", "hub-media-loading", t("mediaLoading")));
      media.append(holder);
      let wanted = false;
      let loading = false;
      let loadedUrl = "";
      let loadedKind = "";

      const unload = () => {
        wanted = false;
        if(loadedKind === "image") releaseCommunityMediaUrl(item.storage_path, holder);
        const video = holder.querySelector("video");
        if(video){
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
        loadedUrl = "";
        loadedKind = "";
        if(holder.isConnected) holder.replaceChildren(node("span", "hub-media-loading", t("mediaLoading")));
      };

      const load = () => {
        wanted = true;
        if(loading || loadedUrl || !holder.isConnected || !contextIsCurrent(context)) return;
        loading = true;
        delete holder.dataset.communityMediaPending;
        const mediaRequest = item.media_type === "video"
          ? getCommunityVideoUrl(item.storage_path)
          : getCommunityMediaUrl(item.storage_path);
        mediaRequest.then(url => {
          loading = false;
          if(!url || !wanted || !holder.isConnected || !contextIsCurrent(context)) return;
          holder.replaceChildren();
          if(item.media_type === "video"){
            const video = node("video");
            video.src = url;
            video.controls = true;
            video.preload = "metadata";
            video.playsInline = true;
            video.setAttribute("aria-label", item.alt_text || t("postVideo"));
            const refreshVideoUrl = async (force=false) => {
              const cachedVideo = hubState.communityVideoUrlCache.get(item.storage_path);
              if(!force && cachedVideo?.expiresAt > Date.now() + 120_000) return;
              if(video.dataset.refreshing === "true") return;
              video.dataset.refreshing = "true";
              const resume = !video.paused;
              const resumeAt = Number(video.currentTime || 0);
              try {
                const freshUrl = await getCommunityVideoUrl(item.storage_path, {force:true});
                if(!freshUrl || !wanted || !video.isConnected || !contextIsCurrent(context)) return;
                loadedUrl = freshUrl;
                video.src = freshUrl;
                video.preload = "metadata";
                if(resumeAt > 0 || resume){
                  video.addEventListener("loadedmetadata", () => {
                    try { if(resumeAt > 0) video.currentTime = resumeAt; }
                    catch(_error){}
                    if(resume) void video.play().catch(() => {});
                  }, {once:true});
                }
              } catch(_error){}
              finally { delete video.dataset.refreshing; }
            };
            video.addEventListener("play", () => { void refreshVideoUrl(false); });
            video.addEventListener("error", () => {
              const cachedVideo = hubState.communityVideoUrlCache.get(item.storage_path);
              if(cachedVideo?.expiresAt <= Date.now() + 30_000 && video.dataset.refreshAttempted !== "true"){
                video.dataset.refreshAttempted = "true";
                void refreshVideoUrl(true);
              }
            });
            holder.append(video);
            loadedKind = "video";
          } else {
            if(!retainCommunityMediaUrl(item.storage_path, url, holder)){
              window.setTimeout(load, 0);
              return;
            }
            const image = node("img");
            image.src = url;
            image.alt = item.alt_text || "";
            image.loading = "lazy";
            image.decoding = "async";
            holder.append(image);
            loadedKind = "image";
          }
          loadedUrl = url;
        }).catch(() => {
          loading = false;
          if(holder.isConnected && wanted && contextIsCurrent(context)) holder.replaceChildren(node("span", "hub-media-loading", t("mediaUnavailable")));
        });
      };
      holder._unloadCommunityMedia = unload;
      if(communityMediaObserver){
        holder._loadCommunityMedia = load;
        communityMediaObserver.observe(holder);
      } else load();
    });
    return media;
  }

  async function voteCommunityPoll(pollId, optionId){
    if(hubState.pollBusy.has(pollId)) return;
    hubState.pollBusy.add(pollId);
    document.querySelectorAll(`[data-poll-id="${pollId}"]`).forEach(button => { button.disabled = true; });
    const context = requestContext();
    try {
      const { error } = await authClient.rpc("vote_community_poll", {p_poll_id:pollId, p_option_id:optionId});
      if(!contextIsCurrent(context)) return;
      if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
      await loadCommunityFeed({force:true});
    } finally {
      if(contextIsCurrent(context)){
        hubState.pollBusy.delete(pollId);
        document.querySelectorAll(`[data-poll-id="${pollId}"]`).forEach(button => { button.disabled = false; });
      }
    }
  }

  function renderPostPoll(post){
    const poll = parseJsonValue(post.poll, null);
    if(!poll || !poll.poll_id || !Array.isArray(poll.options) || poll.options.length < 2) return null;
    const wrapper = node("section", "hub-post-poll");
    wrapper.append(node("b", "", poll.question || ""));
    const total = Number(poll.total_votes ?? poll.options.reduce((sum, option) => sum + Number(option.vote_count || 0), 0));
    const selected = poll.selected_option_id || "";
    poll.options.forEach(option => {
      const optionId = option.option_id;
      const count = Number(option.vote_count || 0);
      const percent = total ? Math.round(count / total * 100) : 0;
      const button = node("button", `hub-poll-choice${selected === optionId ? " selected" : ""}`);
      button.type = "button";
      button.dataset.pollId = poll.poll_id;
      button.disabled = hubState.pollBusy.has(poll.poll_id);
      button.setAttribute("aria-pressed", selected === optionId ? "true" : "false");
      if(selected){
        const fill = node("span", "hub-poll-choice-fill");
        fill.style.width = `${percent}%`;
        button.append(fill);
      }
      const copy = node("span", "hub-poll-choice-copy");
      copy.append(node("span", "", option.label || option.option_text || ""), node("b", "", selected ? `${percent}%` : ""));
      button.append(copy);
      button.onclick = () => voteCommunityPoll(poll.poll_id, optionId);
      wrapper.append(button);
    });
    wrapper.append(node("span", "hub-poll-summary", t(total === 1 ? "oneVote" : "votesCount", {count:total})));
    return wrapper;
  }

  async function togglePostBookmark(postId){
    const post = hubState.feed.find(item => item.post_id === postId);
    if(!post || hubState.bookmarkBusy.has(postId)) return;
    hubState.bookmarkBusy.add(postId);
    const previous = post.bookmarked_by_me === true;
    post.bookmarked_by_me = !previous;
    const optimisticButton = document.querySelector(`[data-bookmark-post="${postId}"]`);
    if(optimisticButton){
      optimisticButton.disabled = true;
      optimisticButton.textContent = post.bookmarked_by_me ? t("saved") : t("savePost");
      optimisticButton.classList.toggle("bookmarked", post.bookmarked_by_me);
      optimisticButton.setAttribute("aria-pressed", post.bookmarked_by_me ? "true" : "false");
    }
    if(hubState.feedTopic === "saved" && !post.bookmarked_by_me) renderCommunityFeed(hubState.feed);
    const context = requestContext();
    try {
      const { data, error } = await authClient.rpc("toggle_post_bookmark", {p_post_id:postId});
      if(!contextIsCurrent(context)) return;
      if(error){
        post.bookmarked_by_me = previous;
        renderCommunityFeed(hubState.feed);
        setStatus("communityComposerStatus", featureError(error), "error");
        return;
      }
      post.bookmarked_by_me = data === true;
      if(hubState.feedMode === "saved" && !post.bookmarked_by_me) hubState.feedOffset = Math.max(0, hubState.feedOffset - 1);
      renderCommunityFeed(hubState.feed);
    } finally {
      if(contextIsCurrent(context)){
        hubState.bookmarkBusy.delete(postId);
        const button = document.querySelector(`[data-bookmark-post="${postId}"]`);
        if(button) button.disabled = false;
      }
    }
  }

  async function shareCommunityPost(postId){
    const url = new URL(window.location.href);
    url.hash = `post-${postId}`;
    if(navigator.share){
      try {
        await navigator.share({title:"ConCourse", text:t("sharedPostMessage"), url:url.toString()});
        return;
      } catch(error){
        if(error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("communityComposerStatus", t("postLinkCopied"), "success");
    } catch(_error){
      setStatus("communityComposerStatus", t("shareFailed"), "error");
    }
  }

  function clearCommunityComposer(){
    hubState.composerMedia.forEach(item => URL.revokeObjectURL(item.previewUrl));
    hubState.composerMedia = [];
    $("communityPostBody").value = "";
    $("communityPostTags").value = "";
    renderComposerMedia();
    resetCommunityPoll();
    window.ConCourseMarketplace?.clearCommunityListing();
    updateCommunityPostCounter();
  }

  function postAuthorName(post){
    return identityLabel(post.display_name, post.author_username);
  }

  function communityTopicMatches(post, topic){
    if(!topic || topic === "all") return true;
    if(topic === "saved") return post.bookmarked_by_me === true;
    const topicTerms = {
      courses:["course", "courses", "class", "classes", "module", "modules", "timetable", "课程", "課程", "選科", "选课"],
      campus:["campus", "school", "student", "students", "life", "校园", "校園", "学生", "學生"],
      clubs:["club", "clubs", "society", "societies", "社团", "社團", "学会", "學會"],
      housing:["housing", "dorm", "dormitory", "rent", "roommate", "住宿", "宿舍", "租房"],
      careers:["career", "careers", "intern", "internship", "job", "jobs", "职业", "職涯", "实习", "實習"]
    };
    const poll = parseJsonValue(post.poll, null);
    const pollCopy = poll ? [poll.question, ...(Array.isArray(poll.options) ? poll.options.map(option => option.label || option.option_text) : [])] : [];
    const haystack = [post.body, ...pollCopy, ...(Array.isArray(post.tags) ? post.tags : [])].join(" ").toLocaleLowerCase();
    return (topicTerms[topic] || [topic]).some(term => haystack.includes(term.toLocaleLowerCase()));
  }

  function filteredCommunityPosts(posts){
    const query = hubState.feedQuery.trim().toLocaleLowerCase();
    return posts.filter(post => {
      if(!communityTopicMatches(post, hubState.feedTopic)) return false;
      if(!query) return true;
      const poll = parseJsonValue(post.poll, null);
      const pollCopy = poll ? [poll.question, ...(Array.isArray(poll.options) ? poll.options.map(option => option.label || option.option_text) : [])] : [];
      return [post.body, ...pollCopy, post.display_name, post.author_username, post.major_of_study, ...(Array.isArray(post.tags) ? post.tags : [])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }

  function syncCommunityTopicControls(){
    document.querySelectorAll("[data-community-topic]").forEach(item => {
      const active = item.dataset.communityTopic === hubState.feedTopic;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const savedShortcut = $("communityShowSaved");
    if(savedShortcut){
      savedShortcut.classList.toggle("active", hubState.feedTopic === "saved");
      savedShortcut.setAttribute("aria-pressed", hubState.feedTopic === "saved" ? "true" : "false");
    }
  }

  function selectCommunityTopic(topic="all"){
    hubState.feedTopic = topic;
    syncCommunityTopicControls();
    const nextMode = topic === "saved" ? "saved" : "all";
    if(nextMode !== hubState.feedMode){
      hubState.feed = [];
      hubState.feedOffset = 0;
      hubState.feedHasMore = false;
      void loadCommunityFeed({force:true});
    } else renderCommunityFeed(hubState.feed);
  }

  function closeHubAction(value=null, {restoreFocus=true}={}){
    const resolver = hubState.actionResolver;
    const returnFocus = hubState.actionReturnFocus;
    hubState.actionResolver = null;
    hubState.actionReturnFocus = null;
    hubState.actionHasInput = false;
    hubState.actionInputRequired = false;
    hubState.actionRequiredMessage = "";
    $("hubActionModal").hidden = true;
    $("hubActionInput").value = "";
    restoreBackgroundModals(hubState.actionBackgroundModals);
    hubState.actionBackgroundModals = [];
    if(resolver) resolver(value);
    if(restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function suspendBackgroundModals(exceptModal){
    return [...document.querySelectorAll(".marketplace-modal:not([hidden]), .hub-profile-modal:not([hidden])")]
      .filter(modal => modal !== exceptModal)
      .map(modal => {
        const previousAriaHidden = modal.getAttribute("aria-hidden");
        modal.inert = true;
        modal.setAttribute("aria-hidden", "true");
        return {modal, previousAriaHidden};
      });
  }

  function restoreBackgroundModals(records=[]){
    records.forEach(({modal, previousAriaHidden}) => {
      if(!modal?.isConnected) return;
      modal.inert = false;
      if(previousAriaHidden === null) modal.removeAttribute("aria-hidden");
      else modal.setAttribute("aria-hidden", previousAriaHidden);
    });
  }

  function requestHubAction({title, message, input=false, inputRequired=input, inputMode="text", maxLength=500, placeholder=null, requiredMessage=null, confirmLabel, danger=false}){
    closeHubAction(null, {restoreFocus:false});
    hubState.actionReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hubState.actionHasInput = input;
    hubState.actionInputRequired = input && inputRequired;
    hubState.actionRequiredMessage = requiredMessage || t("reasonRequired");
    $("hubActionTitle").textContent = title;
    $("hubActionMessage").textContent = message;
    const actionInput = $("hubActionInput");
    actionInput.hidden = !input;
    actionInput.placeholder = input ? (placeholder ?? t("reasonPlaceholder")) : "";
    actionInput.inputMode = input ? inputMode : "text";
    actionInput.maxLength = Math.min(2000, Math.max(1, Number(maxLength) || 500));
    $("hubActionConfirm").textContent = confirmLabel;
    $("hubActionConfirm").className = `btn-primary${danger ? " danger" : ""}`;
    $("hubActionModal").hidden = false;
    hubState.actionBackgroundModals = suspendBackgroundModals($("hubActionModal"));
    requestAnimationFrame(() => (input ? actionInput : $("hubActionConfirm")).focus());
    return new Promise(resolve => { hubState.actionResolver = resolve; });
  }

  function closeSchoolmateProfile({restoreFocus=true}={}){
    hubState.profilePreviewRequest += 1;
    $("schoolmateProfileModal").hidden = true;
    hubState.profilePreview = null;
    const returnFocus = hubState.profilePreviewReturnFocus;
    hubState.profilePreviewReturnFocus = null;
    restoreBackgroundModals(hubState.profilePreviewBackgroundModals);
    hubState.profilePreviewBackgroundModals = [];
    if(restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function renderSchoolmateProfile(profile=hubState.profilePreview){
    if(!profile) return;
    const label = identityLabel(profile.display_name, profile.username);
    applyAvatarImage(
      $("schoolmateProfileAvatar"),
      $("schoolmateProfileInitials"),
      profile.display_name || profile.username,
      profile.avatar_path,
      profile.avatar_revision
    );
    $("schoolmateProfileName").textContent = label;
    $("schoolmateProfileMeta").textContent = [profile.major_of_study, profile.degree_level ? t(`${profile.degree_level}Degree`) : "", profile.study_year ? t(`studyYear${profile.study_year}`) : ""].filter(Boolean).join(" · ");
    $("schoolmateProfileBio").textContent = profile.bio || t("notProvided");
    const interests = $("schoolmateProfileInterests");
    interests.replaceChildren();
    (Array.isArray(profile.interests) ? profile.interests : []).forEach(item => interests.append(node("span", "", item)));
    const connections = $("schoolmateProfileConnections");
    connections.replaceChildren();
    const connectedProviders = [...new Set(Array.isArray(profile.connected_providers) ? profile.connected_providers : [])]
      .filter(provider => !!SOCIAL_PROVIDERS[provider]);
    connectedProviders.forEach(provider => {
      const config = SOCIAL_PROVIDERS[provider];
      const badge = node("span", "hub-profile-connection-badge", t("providerConnected", {provider:config.label}));
      badge.dataset.provider = provider;
      badge.dataset.mark = config.mark;
      connections.append(badge);
    });
    $("schoolmateProfileConnectionsSection").hidden = connectedProviders.length === 0;
    const links = $("schoolmateProfileLinks");
    links.replaceChildren();
    [["Instagram", profile.instagram_url], [t("linkedinProfileSelfReported"), profile.linkedin_url], [t("personalWebsite"), profile.website_url]].forEach(([name, href]) => {
      if(!href) return;
      try {
        const url = new URL(href);
        if(url.protocol !== "https:") return;
        const anchor = node("a", "", name);
        anchor.href = url.toString();
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        links.append(anchor);
      } catch(_error){}
    });
    if(profile.wechat_id){
      const wechatButton = node("button", "hub-profile-wechat-copy", `${t("wechatId")}: ${profile.wechat_id}`);
      wechatButton.type = "button";
      wechatButton.title = t("copyWechat");
      wechatButton.onclick = async () => {
        try {
          await navigator.clipboard.writeText(profile.wechat_id);
          wechatButton.textContent = t("wechatCopied");
          window.setTimeout(() => { if(wechatButton.isConnected) wechatButton.textContent = `${t("wechatId")}: ${profile.wechat_id}`; }, 1600);
        } catch(_error){
          wechatButton.textContent = profile.wechat_id;
        }
      };
      links.append(wechatButton);
    }
    $("schoolmateProfileLinksSection").hidden = !links.childElementCount;
    $("schoolmateProfileMessage").hidden = profile.user_id === currentUser?.id || !profile.username;
  }

  const socialProviderListFrom = value => [...new Set(Array.isArray(value) ? value : [])]
    .filter(provider => !!SOCIAL_PROVIDERS[provider]);

  async function loadSchoolmateConnectedProviders(userId){
    const response = await authClient.rpc("get_schoolmate_connected_providers", {p_user_id:userId});
    if(!response.error){
      const row = Array.isArray(response.data) ? response.data[0] : response.data;
      return {providers:socialProviderListFrom(row?.connected_providers), error:null};
    }
    const missingFunction = /Could not find the function|schema cache|does not exist|PGRST202/i.test(String(response.error?.message || ""));
    if(!missingFunction) return {providers:[], error:response.error};
    return {providers:[], error:null};
  }

  async function openSchoolmateProfile(userId, trigger=document.activeElement){
    if(!userId) return;
    const context = requestContext();
    const request = ++hubState.profilePreviewRequest;
    hubState.profilePreviewReturnFocus = trigger instanceof HTMLElement ? trigger : null;
    const [profileResponse, connectionResponse] = await Promise.all([
      authClient.rpc("get_schoolmate_profile", {p_user_id:userId}),
      loadSchoolmateConnectedProviders(userId)
    ]);
    if(!contextIsCurrent(context) || request !== hubState.profilePreviewRequest || !["community", "marketplace"].includes(hubState.activeView) || $("memberHub").hidden) return;
    const profile = Array.isArray(profileResponse.data) ? profileResponse.data[0] : profileResponse.data;
    if(profileResponse.error || !profile){
      const statusTarget = hubState.activeView === "marketplace" ? "marketplaceStatus" : "communityComposerStatus";
      setStatus(statusTarget, profileResponse.error ? featureError(profileResponse.error) : t("profileUnavailable"), "error");
      return;
    }
    profile.user_id = userId;
    profile.connected_providers = connectionResponse.error ? [] : connectionResponse.providers;
    if(connectionResponse.error) console.warn("Verified social connection badges are unavailable. Run the latest Supabase setup SQL.", connectionResponse.error);
    hubState.profilePreview = profile;
    renderSchoolmateProfile(profile);
    $("schoolmateProfileModal").hidden = false;
    hubState.profilePreviewBackgroundModals = suspendBackgroundModals($("schoolmateProfileModal"));
    $("closeSchoolmateProfile").focus();
  }

  async function messageProfileStudent(){
    const context = requestContext();
    const username = hubState.profilePreview?.username;
    if(!username || hubState.profilePreview?.user_id === currentUser?.id) return;
    closeSchoolmateProfile({restoreFocus:false});
    await switchView("messages");
    if(!contextIsCurrent(context)) return;
    $("chatUsername").value = username;
    await startConversation();
  }

  async function togglePostLike(postId){
    const post = hubState.feed.find(item => item.post_id === postId);
    if(!post || hubState.likeBusy.has(postId)) return;
    hubState.likeBusy.add(postId);
    const wasLiked = post.liked_by_me === true;
    const previousCount = Number(post.like_count || 0);
    post.liked_by_me = !wasLiked;
    post.like_count = Math.max(0, previousCount + (wasLiked ? -1 : 1));
    const optimisticButton = document.querySelector(`[data-like-post="${postId}"]`);
    if(optimisticButton){
      optimisticButton.disabled = true;
      optimisticButton.textContent = `${post.liked_by_me ? t("unlike") : t("like")} · ${post.like_count}`;
      optimisticButton.classList.toggle("liked", post.liked_by_me);
      optimisticButton.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
    }
    const context = requestContext();
    try {
      const { data, error } = await authClient.rpc("toggle_post_like", {p_post_id:postId});
      if(!contextIsCurrent(context)) return;
      if(error){
        post.liked_by_me = wasLiked;
        post.like_count = previousCount;
        setStatus("communityComposerStatus", featureError(error), "error");
      } else {
        post.liked_by_me = data === true;
        post.like_count = Math.max(0, previousCount + (post.liked_by_me ? 1 : 0) - (wasLiked ? 1 : 0));
      }
      const button = document.querySelector(`[data-like-post="${postId}"]`);
      if(button){
        button.textContent = `${post.liked_by_me ? t("unlike") : t("like")} · ${post.like_count}`;
        button.classList.toggle("liked", post.liked_by_me);
        button.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
      }
    } finally {
      if(contextIsCurrent(context)){
        hubState.likeBusy.delete(postId);
        const button = document.querySelector(`[data-like-post="${postId}"]`);
        if(button) button.disabled = false;
      }
    }
  }

  async function reportComment(commentId){
    const reason = await requestHubAction({title:t("report"), message:t("reportReasonPrompt"), input:true, confirmLabel:t("report"), danger:true});
    if(!reason) return;
    const context = requestContext();
    const { error } = await authClient.rpc("report_community_comment", {
      p_comment_id:commentId,
      p_reason:reason.trim()
    });
    if(!contextIsCurrent(context)) return;
    setStatus("communityComposerStatus", error ? featureError(error) : t("reported"), error ? "error" : "success");
  }

  async function deleteComment(commentId, container){
    const confirmed = await requestHubAction({title:t("deleteComment"), message:t("confirmDeleteComment"), confirmLabel:t("deleteComment"), danger:true});
    if(!confirmed) return;
    const context = requestContext();
    const { error } = await authClient.rpc("delete_community_comment", {p_comment_id:commentId});
    if(!contextIsCurrent(context) || !container.isConnected) return;
    if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
    setStatus("communityComposerStatus", t("commentDeleted"), "success");
    await loadCommunityFeed({force:true});
  }

  async function loadPostComments(postId, container){
    const context = requestContext();
    container.replaceChildren(node("div", "hub-comment", t("loading")));
    let data = [];
    let error = null;
    try {
      const response = await authClient.rpc("get_post_comments", {p_post_id:postId});
      data = response.data || [];
      error = response.error || null;
    } catch(requestError){
      error = requestError;
    }
    if(!contextIsCurrent(context) || !container.isConnected) return;
    container.replaceChildren();
    if(error){
      const loadStatus = node("p", "hub-comment-status error", missingRpcError(error) ? t("memberSetupRequired") : t("commentsUnavailable"));
      loadStatus.setAttribute("role", "status");
      container.append(loadStatus);
    }
    data.forEach(comment => {
      const item = node("div", "hub-comment");
      const copy = node("div", "hub-comment-copy");
      copy.append(
        node("b", "", identityLabel(comment.display_name, comment.author_username)),
        node("span", "", comment.body || ""),
        node("time", "", formatCompactDate(comment.created_at))
      );
      const actions = node("div", "hub-comment-actions");
      const profileButton = node("button", "", t("viewProfile"));
      profileButton.type = "button";
      profileButton.onclick = event => openSchoolmateProfile(comment.author_id, event.currentTarget);
      actions.append(profileButton);
      if(comment.author_id === currentUser?.id){
        const deleteButton = node("button", "", t("deleteComment"));
        deleteButton.type = "button";
        deleteButton.onclick = () => deleteComment(comment.comment_id, container);
        actions.append(deleteButton);
      } else {
        const reportButton = node("button", "", t("report"));
        reportButton.type = "button";
        reportButton.onclick = () => reportComment(comment.comment_id);
        const blockButton = node("button", "", t("block"));
        blockButton.type = "button";
        blockButton.onclick = () => blockPostAuthor(comment);
        actions.append(reportButton, blockButton);
      }
      item.append(copy, actions);
      container.append(item);
    });
    const form = node("form", "hub-comment-form");
    form.noValidate = true;
    const input = node("input");
    input.type = "text";
    input.name = "comment";
    input.maxLength = 1000;
    input.autocomplete = "off";
    input.placeholder = t("writeComment");
    input.setAttribute("aria-label", t("writeComment"));
    const button = node("button", "btn-primary", t("postComment"));
    button.type = "submit";
    const submitStatus = node("p", "hub-comment-status");
    submitStatus.setAttribute("role", "status");
    submitStatus.setAttribute("aria-live", "polite");
    form.onsubmit = async event => {
      event.preventDefault();
      const commentContext = requestContext();
      const body = input.value.trim();
      if(!body){ input.setCustomValidity(t("commentRequired")); input.reportValidity(); input.setCustomValidity(""); return; }
      button.disabled = true;
      input.disabled = true;
      submitStatus.className = "hub-comment-status";
      submitStatus.textContent = t("commentPosting");
      try {
        const response = await authClient.rpc("add_post_comment", {p_post_id:postId, p_body:body});
        if(!contextIsCurrent(commentContext) || !container.isConnected) return;
        if(response.error){
          submitStatus.className = "hub-comment-status error";
          submitStatus.textContent = missingRpcError(response.error) ? t("memberSetupRequired") : featureError(response.error);
          return;
        }
        input.value = "";
        submitStatus.className = "hub-comment-status success";
        submitStatus.textContent = t("commentPosted");
        const feedPost = hubState.feed.find(post => post.post_id === postId);
        if(feedPost){
          feedPost.comment_count = Number(feedPost.comment_count || 0) + 1;
          const toggle = document.querySelector(`[data-post-id="${postId}"] .hub-post-actions > button[aria-expanded]`);
          if(toggle) toggle.textContent = `${t("comment")} · ${feedPost.comment_count}`;
        }
        await loadPostComments(postId, container);
      } catch(requestError){
        if(contextIsCurrent(commentContext) && container.isConnected){
          submitStatus.className = "hub-comment-status error";
          submitStatus.textContent = featureError(requestError);
        }
      } finally {
        if(contextIsCurrent(commentContext) && container.isConnected){
          button.disabled = false;
          input.disabled = false;
        }
      }
    };
    input.addEventListener("keydown", event => {
      if(event.key === "Enter" && !event.shiftKey && !event.isComposing){
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.append(input, button, submitStatus);
    container.append(form);
  }

  async function reportPost(postId){
    const reason = await requestHubAction({title:t("report"), message:t("reportReasonPrompt"), input:true, confirmLabel:t("report"), danger:true});
    if(!reason) return;
    const cleanReason = reason.trim();
    const context = requestContext();
    const { error } = await authClient.rpc("report_community_post", {p_post_id:postId, p_reason:cleanReason});
    if(!contextIsCurrent(context)) return;
    setStatus("communityComposerStatus", error ? featureError(error) : t("reported"), error ? "error" : "success");
  }

  async function deletePost(postId){
    const confirmed = await requestHubAction({title:t("deletePost"), message:t("confirmDeletePost"), confirmLabel:t("deletePost"), danger:true});
    if(!confirmed) return;
    const post = hubState.feed.find(item => item.post_id === postId);
    const mediaPaths = (parseJsonValue(post?.media, []) || []).map(item => item?.storage_path).filter(Boolean);
    const context = requestContext();
    const { error } = await authClient.rpc("delete_community_post", {p_post_id:postId});
    if(error){
      // If the response was lost after the server committed, these objects are now
      // orphaned and removable. If the post is still live, Storage policy denies it.
      await removeCommunityUploads(mediaPaths);
      if(contextIsCurrent(context)) setStatus("communityComposerStatus", featureError(error), "error");
      return;
    }
    await removeCommunityUploads(mediaPaths);
    if(!contextIsCurrent(context)) return;
    setStatus("communityComposerStatus", t("postDeleted"), "success");
    await loadCommunityFeed({force:true});
  }

  async function blockPostAuthor(post){
    if(!post.author_id) return;
    const confirmed = await requestHubAction({title:t("block"), message:t("confirmBlock", {username:post.author_username || t("anonymousStudent")}), confirmLabel:t("block"), danger:true});
    if(!confirmed) return;
    const context = requestContext();
    const { error } = await authClient.rpc("block_community_user", {p_user_id:post.author_id});
    if(!contextIsCurrent(context)) return;
    if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
    setStatus("communityComposerStatus", t("blocked"), "success");
    await loadCommunityFeed({force:true});
  }

  function unloadRenderedCommunityMedia(){
    const feed = $("communityFeed");
    if(!feed) return null;
    feed.querySelectorAll(".hub-post-media-item").forEach(holder => {
      if(typeof holder._unloadCommunityMedia === "function") holder._unloadCommunityMedia();
    });
    communityMediaObserver?.disconnect();
    return feed;
  }

  function replaceCommunityFeed(...content){
    const feed = unloadRenderedCommunityMedia();
    if(feed) feed.replaceChildren(...content);
    return feed;
  }

  function communityMediaItems(post){
    const media = parseJsonValue(post?.media, []);
    return Array.isArray(media) ? media.filter(item => item?.storage_path) : [];
  }

  function communityPopularityScore(post){
    const engagement = Number(post?.like_count || 0) * 2 + Number(post?.comment_count || 0) * 3;
    const ageHours = Math.max(0, (Date.now() - new Date(post?.created_at || 0).getTime()) / 3_600_000);
    return (engagement + 1) / (1 + ageHours / 48);
  }

  function renderCommunityFeed(posts){
    const feed = replaceCommunityFeed();
    if(!feed) return;
    updateCommunityLoadMore();
    if(!posts.length){ feed.append(node("div", "hub-feed-empty", t("communityEmpty"))); return; }
    const visiblePosts = filteredCommunityPosts(posts);
    if(!visiblePosts.length){ feed.append(node("div", "hub-feed-empty", t("communityNoMatches"))); return; }
    const featuredPost = visiblePosts
      .filter(post => communityMediaItems(post).some(item => item.media_type !== "video"))
      .sort((left, right) => communityPopularityScore(right) - communityPopularityScore(left))[0] || null;
    const orderedPosts = featuredPost
      ? [featuredPost, ...visiblePosts.filter(post => post.post_id !== featuredPost.post_id)]
      : visiblePosts;
    orderedPosts.forEach(post => {
      const mediaItems = communityMediaItems(post);
      const featured = post.post_id === featuredPost?.post_id;
      const card = node("article", `hub-post-card${mediaItems.length ? " hub-post-card--media" : " hub-post-card--text"}${featured ? " hub-post-card--featured" : ""}`);
      card.id = `post-${post.post_id}`;
      card.dataset.postId = post.post_id;
      if(featured) card.append(node("span", "hub-post-popular-label", t("popularOnCampus")));
      const author = node("div", "hub-post-author");
      const authorName = postAuthorName(post);
      const avatar = createAvatar(post.display_name || post.author_username, post.avatar_path, post.avatar_revision);
      const authorCopy = node("div");
      authorCopy.append(node("b", "", authorName), node("span", "", [post.major_of_study, formatCompactDate(post.created_at)].filter(Boolean).join(" · ")));
      const authorButton = node("button", "hub-post-author-button");
      authorButton.type = "button";
      authorButton.append(avatar, authorCopy);
      authorButton.onclick = event => openSchoolmateProfile(post.author_id, event.currentTarget);
      author.append(authorButton);
      card.append(author);

      const media = renderPostMedia(post);
      if(media) card.append(media);
      if(post.body) card.append(node("div", "hub-post-body", post.body));

      const tags = node("div", "hub-post-tags");
      (Array.isArray(post.tags) ? post.tags : []).forEach(tag => tags.append(node("span", "hub-post-tag", `#${tag}`)));
      if(tags.childElementCount) card.append(tags);

      const poll = renderPostPoll(post);
      if(poll) card.append(poll);
      const linkedListing = window.ConCourseMarketplace?.renderLinkedListing(post.linked_listing);
      if(linkedListing) card.append(linkedListing);

      const actions = node("div", "hub-post-actions");
      const commentButton = node("button", "", `${t("comment")} · ${Number(post.comment_count || 0)}`);
      commentButton.type = "button";
      commentButton.setAttribute("aria-expanded", "false");
      const comments = node("div", "hub-comments");
      let commentsVisible = false;
      commentButton.onclick = async () => {
        commentsVisible = !commentsVisible;
        comments.hidden = !commentsVisible;
        commentButton.setAttribute("aria-expanded", commentsVisible ? "true" : "false");
        if(commentsVisible) await loadPostComments(post.post_id, comments);
      };
      const likeButton = node("button", post.liked_by_me ? "liked" : "", `${post.liked_by_me ? t("unlike") : t("like")} · ${Number(post.like_count || 0)}`);
      likeButton.type = "button";
      likeButton.dataset.likePost = post.post_id;
      likeButton.disabled = hubState.likeBusy.has(post.post_id);
      likeButton.setAttribute("aria-pressed", post.liked_by_me ? "true" : "false");
      likeButton.onclick = () => togglePostLike(post.post_id);
      const bookmarkButton = node("button", post.bookmarked_by_me ? "bookmarked" : "", post.bookmarked_by_me ? t("saved") : t("savePost"));
      bookmarkButton.type = "button";
      bookmarkButton.dataset.bookmarkPost = post.post_id;
      bookmarkButton.disabled = hubState.bookmarkBusy.has(post.post_id);
      bookmarkButton.setAttribute("aria-pressed", post.bookmarked_by_me ? "true" : "false");
      bookmarkButton.onclick = () => togglePostBookmark(post.post_id);
      const shareButton = node("button", "", t("share"));
      shareButton.type = "button";
      shareButton.onclick = () => shareCommunityPost(post.post_id);
      actions.append(commentButton, likeButton, bookmarkButton, shareButton);

      const menu = node("details", "hub-post-menu");
      const summary = node("summary", "", "•••");
      summary.setAttribute("aria-label", t("moreActions"));
      const menuList = node("div", "hub-post-menu-list");
      if(post.author_id === currentUser?.id){
        const deleteButton = node("button", "danger", t("deletePost"));
        deleteButton.type = "button";
        deleteButton.onclick = () => { menu.open = false; deletePost(post.post_id); };
        menuList.append(deleteButton);
      } else {
        const reportButton = node("button", "", t("report"));
        reportButton.type = "button";
        reportButton.onclick = () => { menu.open = false; reportPost(post.post_id); };
        const blockButton = node("button", "", t("block"));
        blockButton.type = "button";
        blockButton.onclick = () => { menu.open = false; blockPostAuthor(post); };
        menuList.append(reportButton, blockButton);
      }
      menu.append(summary, menuList);
      actions.append(menu);
      comments.hidden = true;
      card.append(actions, comments);
      feed.append(card);
    });
    const hashPostId = String(window.location.hash || "").replace(/^#post-/, "");
    if(hashPostId && hashPostId !== hubState.highlightedPostId){
      const target = document.getElementById(`post-${hashPostId}`);
      if(target){
        hubState.highlightedPostId = hashPostId;
        requestAnimationFrame(() => {
          target.classList.add("hub-post-highlight");
          target.scrollIntoView({behavior:"smooth", block:"center"});
          window.setTimeout(() => target.classList.remove("hub-post-highlight"), 2400);
        });
      }
    }
  }

  function updateCommunityLoadMore(){
    const button = $("communityLoadMore");
    if(!button) return;
    button.hidden = !hubState.feedHasMore || !hubState.feed.length;
    button.disabled = hubState.loadingFeed;
    button.textContent = t(hubState.loadingFeed ? "loadingMore" : "loadMore");
  }

  async function requestCommunityFeed(parameters){
    let response = await authClient.rpc("get_school_feed_v2", parameters);
    if(response.error && missingRpcError(response.error)){
      response = await authClient.rpc("get_school_feed", parameters);
    }
    return response;
  }

  async function loadCommunityFeed({force=false, append=false}={}){
    if(!authClient || !currentUser) return;
    if(append && hubState.loadingFeed) return;
    const mode = hubState.feedTopic === "saved" ? "saved" : "all";
    if(!force && !append && hubState.feed.length && hubState.feedMode === mode){
      renderCommunityFeed(hubState.feed);
      return;
    }
    const context = requestContext();
    const request = ++hubState.feedRequest;
    const limit = COMMUNITY_FEED_PAGE_SIZE;
    const offset = append && hubState.feedMode === mode ? hubState.feedOffset : 0;
    hubState.loadingFeed = true;
    updateCommunityLoadMore();
    if(!append && (!hubState.feed.length || hubState.feedMode !== mode)) replaceCommunityFeed(node("div", "hub-feed-empty", t("communityLoading")));
    const { data, error } = await requestCommunityFeed({
      p_limit:limit,
      p_offset:offset,
      p_bookmarked_only:mode === "saved",
      p_post_id:null
    });
    if(!contextIsCurrent(context) || request !== hubState.feedRequest) return;
    hubState.loadingFeed = false;
    if(error){
      if(!append) replaceCommunityFeed(node("div", "hub-feed-empty", featureError(error)));
      else setStatus("communityComposerStatus", featureError(error), "error");
      updateCommunityLoadMore();
      return;
    }
    let rows = Array.isArray(data) ? data : [];
    const hashMatch = mode === "all" && offset === 0
      ? String(window.location.hash || "").match(/^#post-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)
      : null;
    const hashPostId = hashMatch?.[1] || "";
    if(hashPostId && !rows.some(post => post.post_id === hashPostId)){
      const targeted = await requestCommunityFeed({
        p_limit:1,
        p_offset:0,
        p_bookmarked_only:false,
        p_post_id:hashPostId
      });
      if(!contextIsCurrent(context) || request !== hubState.feedRequest) return;
      if(!targeted.error && Array.isArray(targeted.data)) rows = [...rows, ...targeted.data];
    }
    const base = append && hubState.feedMode === mode ? hubState.feed : [];
    const seen = new Set(base.map(post => post.post_id));
    const merged = [...base];
    rows.forEach(post => {
      if(!seen.has(post.post_id)){
        seen.add(post.post_id);
        merged.push(post);
      }
    });
    let windowed = merged;
    let scrollAnchor = null;
    if(append && merged.length > COMMUNITY_FEED_WINDOW){
      const trimCount = merged.length - COMMUNITY_FEED_WINDOW;
      const anchorId = merged[trimCount]?.post_id;
      const anchor = anchorId ? document.getElementById(`post-${anchorId}`) : null;
      if(anchor) scrollAnchor = {id:anchorId, top:anchor.getBoundingClientRect().top};
      windowed = merged.slice(trimCount);
    }
    hubState.feed = windowed;
    hubState.feedMode = mode;
    hubState.feedOffset = offset + (Array.isArray(data) ? data.length : 0);
    hubState.feedHasMore = (Array.isArray(data) ? data.length : 0) === limit;
    renderCommunityFeed(hubState.feed);
    if(scrollAnchor){
      requestAnimationFrame(() => {
        const anchor = document.getElementById(`post-${scrollAnchor.id}`);
        if(anchor) window.scrollBy({top:anchor.getBoundingClientRect().top - scrollAnchor.top, left:0, behavior:"auto"});
      });
    }
  }

  async function publishCommunityPost(){
    if(hubState.composerMediaBusy || !currentUser) return;
    const linkedListingId = window.ConCourseMarketplace?.selectedCommunityListingId() || null;
    const typedBody = $("communityPostBody").value.trim();
    const body = typedBody || (linkedListingId ? t("marketplaceSharedPostDefault") : "");
    let poll;
    try { poll = communityPollPayload(); }
    catch(error){ setStatus("communityComposerStatus", error.message, "error"); return; }
    if(!body && !hubState.composerMedia.length && !poll){ setStatus("communityComposerStatus", t("postContentRequired"), "error"); return; }
    const tags = parseInterests($("communityPostTags").value).map(tag => tag.replace(/^#/, "").slice(0, 30)).filter(Boolean).slice(0, 6);
    const context = requestContext();
    const operation = ++hubState.publishOperation;
    const draftId = crypto.randomUUID();
    const mediaSnapshot = hubState.composerMedia.map(item => ({...item, altText:String(item.altText || "").trim()}));
    const pollSnapshot = poll ? {question:poll.question, options:[...poll.options]} : null;
    let uploaded = {paths:[], descriptors:[]};
    setCommunityComposerBusy(true);
    setStatus("communityComposerStatus", t("publishing"));
    try {
      uploaded = await uploadCommunityMedia(draftId, mediaSnapshot, context, operation);
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation){ await removeCommunityUploads(uploaded.paths); return; }
      let response = await authClient.rpc("publish_community_post_v3", {
        p_body:body || null,
        p_tags:tags,
        p_media:uploaded.descriptors,
        p_poll_question:pollSnapshot?.question || null,
        p_poll_options:pollSnapshot?.options || [],
        p_listing_id:linkedListingId
      });
      if(response.error && !linkedListingId && missingRpcError(response.error)){
        response = await authClient.rpc("publish_community_post_v2", {
          p_body:body || null,
          p_tags:tags,
          p_media:uploaded.descriptors,
          p_poll_question:pollSnapshot?.question || null,
          p_poll_options:pollSnapshot?.options || []
        });
      }
      const {error} = response;
      if(error){
        await removeCommunityUploads(uploaded.paths);
        if(!contextIsCurrent(context) || operation !== hubState.publishOperation) return;
        setStatus("communityComposerStatus", featureError(error) || t("postPublishFailed"), "error");
        return;
      }
      if(!contextIsCurrent(context) || operation !== hubState.publishOperation) return;
      clearCommunityComposer();
      hubState.feedTopic = "all";
      syncCommunityTopicControls();
      setStatus("communityComposerStatus", t("postPublished"), "success");
      await loadCommunityFeed({force:true});
    } catch(error){
      await removeCommunityUploads(uploaded.paths);
      if(contextIsCurrent(context) && operation === hubState.publishOperation){
        const message = error?.mediaUpload ? mediaUploadError(error, {membershipRequired:true}) : featureError(error) || t("postPublishFailed");
        setStatus("communityComposerStatus", message, "error");
      }
    } finally {
      if(contextIsCurrent(context) && operation === hubState.publishOperation) setCommunityComposerBusy(false);
    }
  }

  function renderConversations(conversations){
    const list = $("conversationList");
    list.replaceChildren();
    if(!conversations.length){
      list.append(node("div", "hub-feed-empty", t("noConversations")));
      renderConversationPreview();
      return;
    }
    conversations.forEach(conversation => {
      const button = node("button", "hub-conversation-button");
      button.type = "button";
      button.classList.toggle("active", conversation.conversation_id === hubState.activeConversationId);
      const avatar = createAvatar(conversation.other_display_name || conversation.other_username, conversation.other_avatar_path, conversation.other_avatar_revision);
      const copy = node("div");
      copy.append(node("b", "", identityLabel(conversation.other_display_name, conversation.other_username)), node("span", "", conversation.last_message || t("messagesEmpty")));
      button.append(avatar, copy);
      button.onclick = () => openConversation(conversation);
      list.append(button);
    });
    renderConversationPreview();
  }

  function renderConversationPreview(){
    const preview = $("communityConversationPreview");
    if(!preview) return;
    preview.replaceChildren();
    const conversations = hubState.conversations.slice(0, 3);
    if(!conversations.length){
      preview.append(node("p", "hub-conversation-preview-empty", t("noRecentMessages")));
      return;
    }
    conversations.forEach(conversation => {
      const button = node("button", "hub-conversation-preview-button");
      button.type = "button";
      const avatar = createAvatar(conversation.other_display_name || conversation.other_username, conversation.other_avatar_path, conversation.other_avatar_revision, "hub-avatar-small");
      const copy = node("span");
      copy.append(node("b", "", identityLabel(conversation.other_display_name, conversation.other_username)), node("small", "", conversation.last_message || t("messagesEmpty")));
      button.append(avatar, copy, node("i", "", "→"));
      button.onclick = async () => {
        const context = requestContext();
        const conversationId = conversation.conversation_id;
        await switchView("messages");
        if(!contextIsCurrent(context)) return;
        const current = hubState.conversations.find(item => item.conversation_id === conversationId);
        if(!current) return;
        await openConversation(current);
      };
      preview.append(button);
    });
  }

  function clearActiveConversation(message=t("selectConversation")){
    hubState.conversationRequest += 1;
    hubState.activeConversationId = null;
    hubState.activeConversationUserId = null;
    hubState.activeConversationName = "";
    hubState.activeConversationUsername = "";
    hubState.messages = [];
    hubState.sendingMessage = false;
    $("chatHeading").textContent = message;
    $("chatSubheading").textContent = "";
    $("chatMessages").replaceChildren(node("div", "hub-message-empty", message));
    $("chatMessageInput").disabled = true;
    $("sendChatMessage").disabled = true;
    $("reportConversation").disabled = true;
    $("blockConversationUser").disabled = true;
  }

  async function loadConversations({force=false}={}){
    if(!authClient || !currentUser) return;
    const context = requestContext();
    const request = ++hubState.conversationListRequest;
    hubState.loadingConversations = true;
    if(!hubState.conversations.length || !force) $("conversationList").replaceChildren(node("div", "hub-feed-empty", t("messagesLoading")));
    const { data, error } = await authClient.rpc("get_my_conversations");
    if(!contextIsCurrent(context) || request !== hubState.conversationListRequest) return;
    hubState.loadingConversations = false;
    if(error){
      $("conversationList").replaceChildren(node("div", "hub-feed-empty", featureError(error)));
      setStatus("chatStatus", featureError(error), "error");
      return;
    }
    hubState.conversations = data || [];
    renderConversations(hubState.conversations);
    if(hubState.activeConversationId){
      const active = hubState.conversations.find(item => item.conversation_id === hubState.activeConversationId);
      if(active) await openConversation(active, {skipConversationRender:true});
      else clearActiveConversation();
    }
    return hubState.conversations;
  }

  function renderMessages(messages){
    const list = $("chatMessages");
    list.replaceChildren();
    if(!messages.length){ list.append(node("div", "hub-message-empty", t("messagesEmpty"))); return; }
    messages.forEach(message => {
      const bubble = node("div", `hub-message${message.sender_id === currentUser?.id ? " mine" : ""}`, message.body || "");
      bubble.append(node("time", "", formatCompactDate(message.created_at)));
      list.append(bubble);
    });
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }

  function renderActiveConversationHeader(){
    if(hubState.activeConversationId){
      $("chatHeading").textContent = hubState.activeConversationName;
      $("chatSubheading").textContent = t("directMessagePrivacy");
    } else {
      $("chatHeading").textContent = t("selectConversation");
      $("chatSubheading").textContent = "";
    }
  }

  async function openConversation(conversation, {skipConversationRender=false}={}){
    const context = requestContext();
    const request = ++hubState.conversationRequest;
    hubState.activeConversationId = conversation.conversation_id;
    hubState.activeConversationUserId = conversation.other_user_id;
    hubState.activeConversationName = identityLabel(conversation.other_display_name, conversation.other_username);
    hubState.activeConversationUsername = conversation.other_username || "";
    renderActiveConversationHeader();
    $("chatMessageInput").disabled = hubState.sendingMessage;
    $("sendChatMessage").disabled = hubState.sendingMessage;
    $("reportConversation").disabled = false;
    $("blockConversationUser").disabled = false;
    if(!skipConversationRender) renderConversations(hubState.conversations);
    $("chatMessages").replaceChildren(node("div", "hub-message-empty", t("messagesLoading")));
    const { data, error } = await authClient.rpc("get_conversation_messages", {p_conversation_id:conversation.conversation_id, p_limit:100});
    if(!contextIsCurrent(context) || request !== hubState.conversationRequest || hubState.activeConversationId !== conversation.conversation_id) return;
    if(error){
      $("chatMessages").replaceChildren(node("div", "hub-message-empty", featureError(error)));
      return;
    }
    hubState.messages = data || [];
    renderMessages(hubState.messages);
  }

  async function startConversation(){
    const username = $("chatUsername").value.trim();
    if(!username) return;
    if(username === currentUser?.user_metadata?.username){ setStatus("chatStatus", t("cannotMessageSelf"), "error"); return; }
    const button = $("startConversation");
    const context = requestContext();
    button.disabled = true;
    setStatus("chatStatus", t("startingConversation"));
    const { data, error } = await authClient.rpc("start_direct_conversation", {p_username:username});
    if(!contextIsCurrent(context)) return;
    button.disabled = false;
    if(error){ setStatus("chatStatus", featureError(error) || t("conversationStartFailed"), "error"); return; }
    $("chatUsername").value = "";
    setStatus("chatStatus", t("conversationStarted"), "success");
    await loadConversations({force:true});
    const conversationId = Array.isArray(data) ? data[0]?.conversation_id : data;
    const conversation = hubState.conversations.find(item => item.conversation_id === conversationId);
    if(conversation) await openConversation(conversation);
  }

  async function sendMessage(){
    const button = $("sendChatMessage");
    if(button.disabled || hubState.sendingMessage) return;
    const body = $("chatMessageInput").value.trim();
    if(!body){ setStatus("chatStatus", t("messageRequired"), "error"); return; }
    if(!hubState.activeConversationId) return;
    const context = requestContext();
    const conversationId = hubState.activeConversationId;
    hubState.sendingMessage = true;
    button.disabled = true;
    $("chatMessageInput").disabled = true;
    setStatus("chatStatus", t("sendingMessage"));
    const { error } = await authClient.rpc("send_direct_message", {
      p_conversation_id:conversationId,
      p_body:body,
      p_client_nonce:crypto.randomUUID()
    });
    if(!contextIsCurrent(context)) return;
    if(error){
      hubState.sendingMessage = false;
      const conversationStillActive = hubState.activeConversationId === conversationId;
      $("chatMessageInput").disabled = !conversationStillActive;
      button.disabled = !conversationStillActive;
      setStatus("chatStatus", featureError(error) || t("messageSendFailed"), "error");
      return;
    }
    const conversationStillActive = hubState.activeConversationId === conversationId;
    if(conversationStillActive) $("chatMessageInput").value = "";
    setStatus("chatStatus", "");
    const active = hubState.conversations.find(item => item.conversation_id === conversationId);
    if(active && conversationStillActive) await openConversation(active);
    await loadConversations({force:true});
    if(!contextIsCurrent(context)) return;
    hubState.sendingMessage = false;
    const hasActiveConversation = !!hubState.activeConversationId;
    $("chatMessageInput").disabled = !hasActiveConversation;
    button.disabled = !hasActiveConversation;
  }

  async function reportConversation(){
    if(!hubState.activeConversationId) return;
    const context = requestContext();
    const conversationId = hubState.activeConversationId;
    const reason = await requestHubAction({title:t("report"), message:t("reportReasonPrompt"), input:true, confirmLabel:t("report"), danger:true});
    if(!reason) return;
    const { error } = await authClient.rpc("report_conversation_user", {
      p_conversation_id:conversationId,
      p_reason:reason.trim()
    });
    if(!contextIsCurrent(context)) return;
    setStatus("chatStatus", error ? featureError(error) : t("reported"), error ? "error" : "success");
  }

  async function blockConversationUser(){
    if(!hubState.activeConversationUserId) return;
    const context = requestContext();
    const userId = hubState.activeConversationUserId;
    const username = hubState.activeConversationUsername || hubState.activeConversationName;
    const confirmed = await requestHubAction({title:t("block"), message:t("confirmBlock", {username}), confirmLabel:t("block"), danger:true});
    if(!confirmed) return;
    if(!contextIsCurrent(context)) return;
    const { error } = await authClient.rpc("block_community_user", {p_user_id:userId});
    if(!contextIsCurrent(context)) return;
    if(error){ setStatus("chatStatus", featureError(error), "error"); return; }
    setStatus("chatStatus", t("blocked"), "success");
    clearActiveConversation();
    await loadConversations({force:true});
  }

  function syncAccess(){
    const nextUserId = currentUser?.id || null;
    if(hubState.sessionUserId !== nextUserId) resetSensitiveState(nextUserId);
    const allowed = hubAccessAllowed();
    const fullHubAvailable = allowed && !!finalTimetable?.savedAt;
    if($("enterMemberHub")) $("enterMemberHub").hidden = !fullHubAvailable;
    if(!allowed && !$("memberHub").hidden) hideHub();
    if(allowed){
      renderOverview();
      if(!hubState.profileUserId) loadMemberProfile().catch(console.warn);
      if(!hubState.socialConnectionUserId && !hubState.socialConnectionLoading) loadSocialConnections().catch(console.warn);
    }
    window.ConCourseMarketplace?.syncAccess();
    window.syncPrimaryNavigation?.();
    renderSocialConnections();
    if(!$("memberHub").hidden){
      if(hubState.activeView === "overview" && hubState.insightsLoaded) renderInsights(hubState.insightRows);
      if(hubState.activeView === "community") renderCommunityFeed(hubState.feed);
      if(hubState.activeView === "community") renderConversationPreview();
      if(hubState.activeView === "messages"){
        renderConversations(hubState.conversations);
        renderActiveConversationHeader();
        if(hubState.activeConversationId) renderMessages(hubState.messages);
        else $("chatMessages").replaceChildren(node("div", "hub-message-empty", t("selectConversation")));
      }
      if(!$('schoolmateProfileModal').hidden) renderSchoolmateProfile();
    }
  }

  $("hubOpenBtn")?.addEventListener("click", () => showHub("community"));
  $("enterMemberHub")?.addEventListener("click", () => showHub("community"));
  $("overviewOpenTimetable")?.addEventListener("click", showTimetable);
  document.querySelectorAll("[data-hub-target]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.hubTarget)));
  $("loadCourseInsights")?.addEventListener("click", loadCourseInsights);
  $("courseInsightScope")?.addEventListener("change", syncInsightYearControl);
  $("saveMemberProfile")?.addEventListener("click", saveMemberProfile);
  $("chooseProfileAvatar")?.addEventListener("click", () => $("profileAvatarInput").click());
  $("profileAvatarInput")?.addEventListener("change", event => void prepareProfileAvatar(event.target.files?.[0]));
  $("removeProfileAvatar")?.addEventListener("click", markAvatarForRemoval);
  document.querySelectorAll("[data-connection-tab]").forEach(button => {
    button.addEventListener("click", () => switchConnectionTab(button.dataset.connectionTab));
    button.addEventListener("keydown", handleConnectionTabKeydown);
  });
  $("providerConnections")?.addEventListener("click", event => {
    const button = event.target.closest("[data-social-action][data-provider]");
    if(!button || !$("providerConnections").contains(button)) return;
    const provider = button.dataset.provider;
    if(!SOCIAL_PROVIDERS[provider]) return;
    if(button.dataset.socialAction === "connect"){
      void connectSocialProvider(provider).catch(error => handleUnexpectedSocialActionError(provider, "connect", error));
    } else if(button.dataset.socialAction === "disconnect"){
      void disconnectSocialProvider(provider).catch(error => handleUnexpectedSocialActionError(provider, "disconnect", error));
    }
  });
  $("publishCommunityPost")?.addEventListener("click", publishCommunityPost);
  $("communityPostBody")?.addEventListener("input", updateCommunityPostCounter);
  $("addCommunityMedia")?.addEventListener("click", () => $("communityMediaInput").click());
  $("communityMediaInput")?.addEventListener("change", event => void prepareCommunityMedia(event.target.files));
  $("addCommunityPoll")?.addEventListener("click", () => {
    $("communityPollBuilder").hidden = false;
    $("communityPollQuestion").focus();
  });
  $("removeCommunityPoll")?.addEventListener("click", () => resetCommunityPoll({restoreFocus:true}));
  $("addCommunityPollOption")?.addEventListener("click", addCommunityPollOption);
  $("refreshCommunityFeed")?.addEventListener("click", () => loadCommunityFeed({force:true}));
  $("communityLoadMore")?.addEventListener("click", () => loadCommunityFeed({append:true}));
  $("communitySearch")?.addEventListener("input", event => {
    hubState.feedQuery = event.target.value;
    renderCommunityFeed(hubState.feed);
  });
  document.querySelectorAll("[data-community-topic]").forEach(button => button.addEventListener("click", () => selectCommunityTopic(button.dataset.communityTopic || "all")));
  $("communityShowSaved")?.addEventListener("click", () => selectCommunityTopic("saved"));
  $("communityOpenMessages")?.addEventListener("click", () => switchView("messages"));
  $("communityStartMessage")?.addEventListener("click", async () => {
    await switchView("messages");
    $("chatUsername").focus();
  });
  $("startConversation")?.addEventListener("click", startConversation);
  $("refreshMessages")?.addEventListener("click", () => loadConversations({force:true}));
  $("reportConversation")?.addEventListener("click", reportConversation);
  $("blockConversationUser")?.addEventListener("click", blockConversationUser);
  $("closeSchoolmateProfile")?.addEventListener("click", closeSchoolmateProfile);
  $("schoolmateProfileMessage")?.addEventListener("click", messageProfileStudent);
  $("schoolmateProfileModal")?.addEventListener("click", event => { if(event.target === $("schoolmateProfileModal")) closeSchoolmateProfile(); });
  $("hubActionCancel")?.addEventListener("click", () => closeHubAction());
  $("hubActionConfirm")?.addEventListener("click", () => {
    const input = $("hubActionInput");
    if(hubState.actionHasInput){
      const value = input.value.trim();
      if(hubState.actionInputRequired && !value){ input.setCustomValidity(hubState.actionRequiredMessage || t("reasonRequired")); input.reportValidity(); input.setCustomValidity(""); return; }
      closeHubAction(value);
    } else closeHubAction(true);
  });
  $("hubActionModal")?.addEventListener("click", event => { if(event.target === $("hubActionModal")) closeHubAction(); });
  document.addEventListener("keydown", event => {
    const actionModal = $("hubActionModal");
    const profileModal = $("schoolmateProfileModal");
    const modal = !actionModal.hidden ? actionModal : (!profileModal.hidden ? profileModal : null);
    if(!modal) return;
    if(event.key === "Escape"){
      event.preventDefault();
      if(modal === actionModal) closeHubAction();
      else closeSchoolmateProfile();
      return;
    }
    if(event.key === "Tab"){
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]):not([hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if(!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
      else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
    }
  });
  document.querySelector('[data-hub-view="profile"]')?.addEventListener("input", () => {
    if(hubState.profileHydrated && !hubState.profileLoading) hubState.profileDirty = true;
  });
  $("sendChatMessage")?.addEventListener("click", sendMessage);
  $("chatMessageInput")?.addEventListener("keydown", event => {
    if(event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229){ event.preventDefault(); sendMessage(); }
  });
  window.addEventListener("hashchange", () => {
    hubState.highlightedPostId = "";
    const listingMatch = String(window.location.hash || "").match(/^#listing-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
    if(listingMatch){
      return;
    } else if(/^#post-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(window.location.hash)){
      hubState.feedTopic = "all";
      syncCommunityTopicControls();
      void loadCommunityFeed({force:true});
    } else renderCommunityFeed(hubState.feed);
  });
  window.addEventListener("beforeunload", () => { revokeAvatarUrls(); revokeCommunityMediaUrls(); }, {once:true});

  window.ConCourseHub = {
    show: showHub,
    hide: hideHub,
    switchView,
    syncAccess,
    syncFinalSchedule,
    requestAction: requestHubAction,
    openProfile: openSchoolmateProfile,
    mediaTools: Object.freeze({normalizeRasterUpload, normalizeRasterToWebP, videoUploadType, validateVideoSignature, wrapMediaUploadError, mediaUploadError}),
    reloadMembership: () => loadMembership(),
    refreshSocialConnections: () => loadSocialConnections({force:true}),
    refreshLanguage: () => {
      document.querySelectorAll("#communityPollOptions [data-poll-option]").forEach((input, index) => {
        input.dataset.pollNumber = String(index + 1);
        input.placeholder = t("pollOptionPlaceholder");
        input.setAttribute("aria-label", t("pollOptionNumber", {number:index + 1}));
      });
      renderComposerMedia();
      updateCommunityPostCounter();
      syncAccess();
      window.ConCourseMarketplace?.refreshLanguage();
    }
  };

  syncInsightYearControl();
  switchConnectionTab("verified");
  syncAccess();
})();
