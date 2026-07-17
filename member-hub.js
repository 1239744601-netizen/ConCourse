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
    actionInputRequired: false,
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
    avatarPendingBlob: null,
    avatarPendingUrl: "",
    avatarDeleteRequested: false,
    avatarBusy: false,
    avatarUrlCache: new Map(),
    avatarLoadCache: new Map()
  };

  const SOCIAL_PROVIDERS = Object.freeze({
    google: Object.freeze({provider:"google", label:"Google", mark:"G"}),
    github: Object.freeze({provider:"github", label:"GitHub", mark:"GH"}),
    linkedin_oidc: Object.freeze({provider:"linkedin_oidc", label:"LinkedIn", mark:"in"})
  });
  const SOCIAL_RETURN_KEY = "concourse_social_connection_return";
  const SOCIAL_OAUTH_RETURN_URL = "https://1239744601-netizen.github.io/ConCourse/";

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

  const hubAccessAllowed = () => !!(currentUser && finalTimetable?.savedAt);
  const requestContext = () => ({generation:hubState.generation, userId:currentUser?.id || null});
  const contextIsCurrent = context => !!(
    context?.userId
    && context.generation === hubState.generation
    && currentUser?.id === context.userId
  );

  function resetSensitiveState(nextUserId){
    revokeAvatarUrls();
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
    hubState.avatarPendingBlob = null;
    hubState.avatarPendingUrl = "";
    hubState.avatarDeleteRequested = false;
    hubState.avatarBusy = false;
    configureMessagePolling(false);
    closeHubAction(null, {restoreFocus:false});

    fillMemberProfile({});
    setProfileFormDisabled(true);
    ["communityPostBody", "communityPostTags", "communitySearch", "chatUsername", "chatMessageInput"].forEach(id => { if($(id)) $(id).value = ""; });
    document.querySelectorAll("[data-community-topic]").forEach(button => {
      const active = button.dataset.communityTopic === "all";
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    ["communityFeed", "conversationList", "chatMessages", "courseInsightChart"].forEach(id => $(id)?.replaceChildren());
    $("courseInsightScope").value = "same_major_year";
    $("courseInsightYear").value = "";
    syncInsightYearControl();
    $("schoolmateProfileModal").hidden = true;
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
    hubState.avatarUrlCache.forEach(url => URL.revokeObjectURL(url));
    hubState.avatarPendingUrl = "";
    hubState.avatarUrlCache.clear();
    hubState.avatarLoadCache.clear();
  }

  function avatarCacheKey(path, revision=0){
    return `${path || ""}::${Number(revision || 0)}`;
  }

  async function getAvatarUrl(path, revision=0){
    if(!path || !authClient || !currentUser) return "";
    const key = avatarCacheKey(path, revision);
    if(hubState.avatarUrlCache.has(key)) return hubState.avatarUrlCache.get(key);
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
      hubState.avatarUrlCache.set(key, url);
      return url;
    })().finally(() => hubState.avatarLoadCache.delete(key));
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
    image.dataset.avatarRequest = requestKey;
    if(!directUrl && !path) return;
    const setImage = url => {
      if(!url || image.dataset.avatarRequest !== requestKey || !image.isConnected) return;
      image.onload = () => {
        if(image.dataset.avatarRequest !== requestKey) return;
        image.hidden = false;
        initials.hidden = true;
      };
      image.onerror = () => {
        image.hidden = true;
        initials.hidden = false;
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
      image.onload = () => { image.hidden = false; container.classList.add("has-photo"); };
      image.onerror = () => { image.remove(); container.classList.remove("has-photo"); };
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
    const view = ["community", "messages", "overview", "profile"].includes(hubState.activeView) ? hubState.activeView : "community";
    const prefix = view === "overview" ? "hubInsights" : view === "community" ? "hubCommunity" : view === "messages" ? "hubMessages" : "hubProfile";
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
    closeSchoolmateProfile({restoreFocus:false});
    closeHubAction(null, {restoreFocus:false});
    $("memberHub").hidden = true;
    document.body.classList.remove("hub-active");
  }

  function showTimetable(){
    hideHub();
    showSchedulePage();
  }

  function showHub(view="community"){
    if(!hubAccessAllowed()){
      if(currentUser) showSchedulePage();
      else openAuthModal();
      return;
    }
    appStarted = true;
    $("appWrap").hidden = true;
    $("schedulePage").hidden = true;
    $("memberHub").hidden = false;
    document.body.classList.add("app-active", "hub-active");
    document.body.classList.remove("schedule-active");
    switchView(view);
    window.scrollTo({top:0, behavior:"smooth"});
  }

  async function switchView(view){
    if(!["overview", "community", "messages", "profile"].includes(view)) view = "community";
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
    if(hubState.profileDirty && !(await saveMemberProfile())){
      setSocialConnectionStatus("providerConnectionFailed", {provider:config.label}, "error");
      return;
    }
    const context = requestContext();
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

  async function decodeAvatarFile(file){
    if(typeof createImageBitmap === "function") return createImageBitmap(file);
    const objectUrl = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(t("avatarInvalid")));
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function prepareProfileAvatar(file){
    if(!file) return;
    if(!["image/png", "image/jpeg", "image/webp"].includes(file.type)){
      setStatus("avatarUploadStatus", t("avatarInvalid"), "error");
      return;
    }
    if(file.size > 8 * 1024 * 1024){
      setStatus("avatarUploadStatus", t("avatarTooLarge"), "error");
      return;
    }
    hubState.avatarBusy = true;
    setProfileFormDisabled(false);
    setStatus("avatarUploadStatus", t("avatarPreparing"));
    let source;
    try {
      source = await decodeAvatarFile(file);
      const width = Number(source.width || source.naturalWidth || 0);
      const height = Number(source.height || source.naturalHeight || 0);
      if(width < 64 || height < 64 || width > 12000 || height > 12000) throw new Error(t("avatarInvalid"));
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d", {alpha:false});
      if(!context) throw new Error(t("avatarInvalid"));
      context.fillStyle = "#f5f5f7";
      context.fillRect(0, 0, 512, 512);
      const side = Math.min(width, height);
      context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 512, 512);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .88));
      if(!blob || blob.type !== "image/webp" || blob.size > 2 * 1024 * 1024) throw new Error(t("avatarInvalid"));
      if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
      hubState.avatarPendingBlob = blob;
      hubState.avatarPendingUrl = URL.createObjectURL(blob);
      hubState.avatarDeleteRequested = false;
      hubState.profileDirty = true;
      setStatus("avatarUploadStatus", t("avatarReady"), "success");
    } catch(error){
      setStatus("avatarUploadStatus", error?.message || t("avatarInvalid"), "error");
    } finally {
      if(typeof source?.close === "function") source.close();
      hubState.avatarBusy = false;
      setProfileFormDisabled(false);
      renderOwnAvatars();
      $("profileAvatarInput").value = "";
    }
  }

  function markAvatarForRemoval(){
    if(hubState.avatarPendingUrl) URL.revokeObjectURL(hubState.avatarPendingUrl);
    hubState.avatarPendingUrl = "";
    hubState.avatarPendingBlob = null;
    hubState.avatarDeleteRequested = true;
    hubState.profileDirty = true;
    setStatus("avatarUploadStatus", t("avatarRemoved"));
    renderOwnAvatars();
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
    if(!authClient || !currentUser || hubState.profileLoading || !hubState.profileHydrated) return false;
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
      uploadedAvatarPath = `${context.userId}/avatar-${crypto.randomUUID()}.webp`;
      const upload = await authClient.storage.from("member-avatars").upload(uploadedAvatarPath, hubState.avatarPendingBlob, {
        upsert:false,
        contentType:"image/webp",
        cacheControl:"31536000"
      });
      if(!contextIsCurrent(context)) return false;
      if(upload.error){
        hubState.avatarBusy = false;
        setProfileFormDisabled(false);
        setStatus("memberProfileStatus", t("avatarUploadFailed"), "error");
        setStatus("avatarUploadStatus", t("avatarUploadFailed"), "error");
        return false;
      }
      payload.avatar_path = uploadedAvatarPath;
      payload.avatar_revision = previousAvatarRevision + 1;
    } else if(hubState.avatarDeleteRequested){
      payload.avatar_path = null;
      payload.avatar_revision = previousAvatarRevision + 1;
    }

    const { data, error } = await authClient.from("member_profiles").upsert(payload, {onConflict:"user_id"}).select().single();
    if(!contextIsCurrent(context)) return false;
    if(error){
      if(uploadedAvatarPath){
        const rollback = await authClient.storage.from("member-avatars").remove([uploadedAvatarPath]);
        if(rollback.error) console.warn("A failed profile save left an owner-private avatar object for later cleanup.", rollback.error);
      }
      hubState.avatarBusy = false;
      setProfileFormDisabled(false);
      button.disabled = false;
      setStatus("memberProfileStatus", featureError(error) || t("profileSaveFailed"), "error");
      return false;
    }
    hubState.avatarBusy = false;
    setProfileFormDisabled(false);
    button.disabled = false;
    const obsoleteAvatarPath = previousAvatarPath && previousAvatarPath !== data.avatar_path ? previousAvatarPath : "";
    hubState.avatarPendingBlob = null;
    hubState.avatarDeleteRequested = false;
    revokeAvatarUrls();
    hubState.profile = data;
    hubState.profileUserId = context.userId;
    hubState.profileDirty = false;
    setStatus("avatarUploadStatus", "");
    setStatus("memberProfileStatus", t("profileSaved"), "success");
    renderOverview();
    if(obsoleteAvatarPath){
      const removal = await authClient.storage.from("member-avatars").remove([obsoleteAvatarPath]);
      if(removal.error) console.warn("The removed avatar is no longer referenced, but its private storage object could not be deleted.", removal.error);
    }
    if(finalTimetable?.savedAt) await syncFinalSchedule(finalTimetable);
    return true;
  }

  function postAuthorName(post){
    return identityLabel(post.display_name, post.author_username);
  }

  function communityTopicMatches(post, topic){
    if(!topic || topic === "all") return true;
    const topicTerms = {
      courses:["course", "courses", "class", "classes", "module", "modules", "timetable", "课程", "課程", "選科", "选课"],
      campus:["campus", "school", "student", "students", "life", "校园", "校園", "学生", "學生"],
      clubs:["club", "clubs", "society", "societies", "社团", "社團", "学会", "學會"],
      housing:["housing", "dorm", "dormitory", "rent", "roommate", "住宿", "宿舍", "租房"],
      careers:["career", "careers", "intern", "internship", "job", "jobs", "职业", "職涯", "实习", "實習"]
    };
    const haystack = [post.body, ...(Array.isArray(post.tags) ? post.tags : [])].join(" ").toLocaleLowerCase();
    return (topicTerms[topic] || [topic]).some(term => haystack.includes(term.toLocaleLowerCase()));
  }

  function filteredCommunityPosts(posts){
    const query = hubState.feedQuery.trim().toLocaleLowerCase();
    return posts.filter(post => {
      if(!communityTopicMatches(post, hubState.feedTopic)) return false;
      if(!query) return true;
      return [post.body, post.display_name, post.author_username, post.major_of_study, ...(Array.isArray(post.tags) ? post.tags : [])]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    });
  }

  function closeHubAction(value=null, {restoreFocus=true}={}){
    const resolver = hubState.actionResolver;
    const returnFocus = hubState.actionReturnFocus;
    hubState.actionResolver = null;
    hubState.actionReturnFocus = null;
    hubState.actionInputRequired = false;
    $("hubActionModal").hidden = true;
    $("hubActionInput").value = "";
    if(resolver) resolver(value);
    if(restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  }

  function requestHubAction({title, message, input=false, confirmLabel, danger=false}){
    closeHubAction(null, {restoreFocus:false});
    hubState.actionReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    hubState.actionInputRequired = input;
    $("hubActionTitle").textContent = title;
    $("hubActionMessage").textContent = message;
    $("hubActionInput").hidden = !input;
    $("hubActionInput").placeholder = t("reasonPlaceholder");
    $("hubActionConfirm").textContent = confirmLabel;
    $("hubActionConfirm").className = `btn-primary${danger ? " danger" : ""}`;
    $("hubActionModal").hidden = false;
    requestAnimationFrame(() => (input ? $("hubActionInput") : $("hubActionConfirm")).focus());
    return new Promise(resolve => { hubState.actionResolver = resolve; });
  }

  function closeSchoolmateProfile({restoreFocus=true}={}){
    hubState.profilePreviewRequest += 1;
    $("schoolmateProfileModal").hidden = true;
    hubState.profilePreview = null;
    const returnFocus = hubState.profilePreviewReturnFocus;
    hubState.profilePreviewReturnFocus = null;
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
    const legacyResponse = await authClient.rpc("get_schoolmate_connection_badges", {p_user_id:userId});
    if(legacyResponse.error) return {providers:[], error:response.error};
    const legacyRow = Array.isArray(legacyResponse.data) ? legacyResponse.data[0] : legacyResponse.data;
    return {providers:legacyRow?.linkedin_connected === true ? ["linkedin_oidc"] : [], error:null};
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
    if(!contextIsCurrent(context) || request !== hubState.profilePreviewRequest || hubState.activeView !== "community" || $("memberHub").hidden) return;
    const profile = Array.isArray(profileResponse.data) ? profileResponse.data[0] : profileResponse.data;
    if(profileResponse.error || !profile){
      setStatus("communityComposerStatus", profileResponse.error ? featureError(profileResponse.error) : t("profileUnavailable"), "error");
      return;
    }
    profile.user_id = userId;
    profile.connected_providers = connectionResponse.error ? [] : connectionResponse.providers;
    if(connectionResponse.error) console.warn("Verified social connection badges are unavailable. Run the latest Supabase setup SQL.", connectionResponse.error);
    hubState.profilePreview = profile;
    renderSchoolmateProfile(profile);
    $("schoolmateProfileModal").hidden = false;
    $("closeSchoolmateProfile").focus();
  }

  async function messageProfileStudent(){
    const username = hubState.profilePreview?.username;
    if(!username || hubState.profilePreview?.user_id === currentUser?.id) return;
    closeSchoolmateProfile({restoreFocus:false});
    await switchView("messages");
    $("chatUsername").value = username;
    await startConversation();
  }

  async function togglePostLike(postId){
    const context = requestContext();
    const { error } = await authClient.rpc("toggle_post_like", {p_post_id:postId});
    if(!contextIsCurrent(context)) return;
    if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
    await loadCommunityFeed({force:true});
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
    const { data, error } = await authClient.rpc("get_post_comments", {p_post_id:postId});
    if(!contextIsCurrent(context) || !container.isConnected) return;
    container.replaceChildren();
    if(error){ container.append(node("div", "hub-comment", featureError(error))); return; }
    (data || []).forEach(comment => {
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
    const form = node("div", "hub-comment-form");
    const input = node("input");
    input.maxLength = 1000;
    input.placeholder = t("writeComment");
    const button = node("button", "btn-primary", t("postComment"));
    button.type = "button";
    button.onclick = async () => {
      const commentContext = requestContext();
      const body = input.value.trim();
      if(!body){ input.setCustomValidity(t("commentRequired")); input.reportValidity(); input.setCustomValidity(""); return; }
      button.disabled = true;
      const response = await authClient.rpc("add_post_comment", {p_post_id:postId, p_body:body});
      if(!contextIsCurrent(commentContext) || !container.isConnected) return;
      button.disabled = false;
      if(response.error){ input.setCustomValidity(featureError(response.error)); input.reportValidity(); input.setCustomValidity(""); return; }
      await loadPostComments(postId, container);
    };
    form.append(input, button);
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
    const context = requestContext();
    const { error } = await authClient.rpc("delete_community_post", {p_post_id:postId});
    if(!contextIsCurrent(context)) return;
    if(error){ setStatus("communityComposerStatus", featureError(error), "error"); return; }
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

  function renderCommunityFeed(posts){
    const feed = $("communityFeed");
    feed.replaceChildren();
    if(!posts.length){ feed.append(node("div", "hub-feed-empty", t("communityEmpty"))); return; }
    const visiblePosts = filteredCommunityPosts(posts);
    if(!visiblePosts.length){ feed.append(node("div", "hub-feed-empty", t("communityNoMatches"))); return; }
    visiblePosts.forEach((post, index) => {
      const card = node("article", "hub-post-card");
      card.dataset.postTone = String(index % 5);
      const author = node("div", "hub-post-author");
      const authorName = postAuthorName(post);
      const avatar = createAvatar(post.display_name || post.author_username, post.avatar_path, post.avatar_revision);
      const authorCopy = node("div");
      authorCopy.append(node("b", "", authorName), node("span", "", [post.major_of_study, formatCompactDate(post.created_at)].filter(Boolean).join(" · ")));
      author.append(avatar, authorCopy);
      card.append(author, node("div", "hub-post-body", post.body || ""));

      const tags = node("div", "hub-post-tags");
      (Array.isArray(post.tags) ? post.tags : []).forEach(tag => tags.append(node("span", "hub-post-tag", `#${tag}`)));
      if(tags.childElementCount) card.append(tags);

      const actions = node("div", "hub-post-actions");
      const profileButton = node("button", "", t("viewProfile"));
      profileButton.type = "button";
      profileButton.onclick = event => openSchoolmateProfile(post.author_id, event.currentTarget);
      const likeButton = node("button", "", post.liked_by_me ? t("unlike") : t("like"));
      likeButton.type = "button";
      likeButton.append(document.createTextNode(` · ${Number(post.like_count || 0)}`));
      likeButton.onclick = () => togglePostLike(post.post_id);
      const commentButton = node("button", "", `${t("comment")} · ${Number(post.comment_count || 0)}`);
      commentButton.type = "button";
      const comments = node("div", "hub-comments");
      let commentsVisible = false;
      commentButton.onclick = async () => {
        commentsVisible = !commentsVisible;
        comments.hidden = !commentsVisible;
        if(commentsVisible) await loadPostComments(post.post_id, comments);
      };
      actions.append(profileButton, likeButton, commentButton);
      if(post.author_id === currentUser?.id){
        const deleteButton = node("button", "hub-post-report", t("deletePost"));
        deleteButton.type = "button";
        deleteButton.onclick = () => deletePost(post.post_id);
        actions.append(deleteButton);
      } else {
        const reportButton = node("button", "hub-post-report", t("report"));
        reportButton.type = "button";
        reportButton.onclick = () => reportPost(post.post_id);
        const blockButton = node("button", "", t("block"));
        blockButton.type = "button";
        blockButton.onclick = () => blockPostAuthor(post);
        actions.append(reportButton, blockButton);
      }
      comments.hidden = true;
      card.append(actions, comments);
      feed.append(card);
    });
  }

  async function loadCommunityFeed({force=false}={}){
    if(!authClient || !currentUser) return;
    const context = requestContext();
    const request = ++hubState.feedRequest;
    hubState.loadingFeed = true;
    if(!hubState.feed.length || !force) $("communityFeed").replaceChildren(node("div", "hub-feed-empty", t("communityLoading")));
    const { data, error } = await authClient.rpc("get_school_feed", {p_limit:50, p_offset:0});
    if(!contextIsCurrent(context) || request !== hubState.feedRequest) return;
    hubState.loadingFeed = false;
    if(error){
      $("communityFeed").replaceChildren(node("div", "hub-feed-empty", featureError(error)));
      return;
    }
    hubState.feed = data || [];
    renderCommunityFeed(hubState.feed);
  }

  async function publishCommunityPost(){
    const body = $("communityPostBody").value.trim();
    if(!body){ setStatus("communityComposerStatus", t("postBodyRequired"), "error"); return; }
    const tags = parseInterests($("communityPostTags").value).map(tag => tag.replace(/^#/, "").slice(0, 30)).filter(Boolean).slice(0, 6);
    const button = $("publishCommunityPost");
    const context = requestContext();
    button.disabled = true;
    setStatus("communityComposerStatus", t("publishing"));
    const { error } = await authClient.rpc("publish_community_post", {p_body:body, p_tags:tags});
    if(!contextIsCurrent(context)) return;
    button.disabled = false;
    if(error){ setStatus("communityComposerStatus", featureError(error) || t("postPublishFailed"), "error"); return; }
    $("communityPostBody").value = "";
    $("communityPostTags").value = "";
    setStatus("communityComposerStatus", t("postPublished"), "success");
    await loadCommunityFeed({force:true});
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
        await switchView("messages");
        const current = hubState.conversations.find(item => item.conversation_id === conversation.conversation_id) || conversation;
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
    if($("hubOpenBtn")) $("hubOpenBtn").hidden = !allowed;
    if($("enterMemberHub")) $("enterMemberHub").hidden = !allowed;
    if(!allowed && !$("memberHub").hidden) hideHub();
    if(allowed){
      renderOverview();
      if(!hubState.profileUserId) loadMemberProfile().catch(console.warn);
      if(!hubState.socialConnectionUserId && !hubState.socialConnectionLoading) loadSocialConnections().catch(console.warn);
    }
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
  $("hubBackToTimetable")?.addEventListener("click", showTimetable);
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
  $("refreshCommunityFeed")?.addEventListener("click", () => loadCommunityFeed({force:true}));
  $("communitySearch")?.addEventListener("input", event => {
    hubState.feedQuery = event.target.value;
    renderCommunityFeed(hubState.feed);
  });
  document.querySelectorAll("[data-community-topic]").forEach(button => button.addEventListener("click", () => {
    hubState.feedTopic = button.dataset.communityTopic || "all";
    document.querySelectorAll("[data-community-topic]").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", active ? "true" : "false");
    });
    renderCommunityFeed(hubState.feed);
  }));
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
    if(hubState.actionInputRequired){
      const value = input.value.trim();
      if(!value){ input.setCustomValidity(t("reasonRequired")); input.reportValidity(); input.setCustomValidity(""); return; }
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
      const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href]')];
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
  window.addEventListener("beforeunload", revokeAvatarUrls, {once:true});

  window.ConCourseHub = {
    show: showHub,
    hide: hideHub,
    syncAccess,
    syncFinalSchedule,
    reloadMembership: () => loadMembership(),
    refreshSocialConnections: () => loadSocialConnections({force:true}),
    refreshLanguage: syncAccess
  };

  syncInsightYearControl();
  switchConnectionTab("verified");
  syncAccess();
})();
