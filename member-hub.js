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
    activeView: "overview",
    membership: null,
    membershipError: "",
    profile: null,
    profileUserId: null,
    profileLoading: false,
    profileHydrated: false,
    profileDirty: false,
    profilePreview: null,
    profilePreviewReturnFocus: null,
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
    loadingConversations: false
  };

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

  const hubAccessAllowed = () => !!(currentUser && finalTimetable?.savedAt);
  const requestContext = () => ({generation:hubState.generation, userId:currentUser?.id || null});
  const contextIsCurrent = context => !!(
    context?.userId
    && context.generation === hubState.generation
    && currentUser?.id === context.userId
  );

  function resetSensitiveState(nextUserId){
    hubState.sessionUserId = nextUserId;
    hubState.generation += 1;
    hubState.conversationRequest += 1;
    hubState.conversationListRequest += 1;
    hubState.feedRequest += 1;
    hubState.profileRequest += 1;
    hubState.profilePreviewRequest += 1;
    hubState.membership = null;
    hubState.membershipError = "";
    hubState.profile = null;
    hubState.profileUserId = null;
    hubState.profileLoading = false;
    hubState.profileHydrated = false;
    hubState.profileDirty = false;
    hubState.profilePreview = null;
    hubState.profilePreviewReturnFocus = null;
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
    configureMessagePolling(false);
    closeHubAction(null, {restoreFocus:false});

    fillMemberProfile({});
    setProfileFormDisabled(true);
    ["communityPostBody", "communityPostTags", "chatUsername", "chatMessageInput"].forEach(id => { if($(id)) $(id).value = ""; });
    ["communityFeed", "conversationList", "chatMessages", "courseInsightChart"].forEach(id => $(id)?.replaceChildren());
    $("courseInsightScope").value = "same_major_year";
    $("courseInsightYear").value = "";
    syncInsightYearControl();
    $("schoolmateProfileModal").hidden = true;
    $("schoolmateProfileLinks").replaceChildren();
    $("schoolmateProfileInterests").replaceChildren();
    ["communityComposerStatus", "chatStatus", "memberProfileStatus", "courseInsightStatus"].forEach(id => setStatus(id, ""));
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

  function identityLabel(displayName, username){
    const handle = username ? `@${username}` : t("anonymousStudent");
    return displayName ? `${displayName} · ${handle}` : handle;
  }

  function renderIdentity(){
    if(!currentUser) return;
    const username = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Student";
    const name = hubState.profile?.display_name?.trim() || `@${username}`;
    $("hubUserName").textContent = name;
    $("hubUserAcademic").textContent = academicLabel();
    $("hubUserInitials").textContent = initialsFor(hubState.profile?.display_name || username);
    const membershipStatus = ["verified", "rejected", "revoked"].includes(hubState.membership?.status)
      ? hubState.membership.status
      : "pending";
    $("hubMembershipStatus").textContent = t(`membership${membershipStatus[0].toLocaleUpperCase()}${membershipStatus.slice(1)}`);
    $("hubMembershipStatus").className = `hub-membership-status ${membershipStatus}`;
    $("hubGreeting").textContent = t("hubGreetingName", {name});
    $("hubNetworkScope").textContent = getAcademicIdentity().school || "—";
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
      profile.website_url
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

  function showHub(view="overview"){
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
    if(!["overview", "community", "messages", "profile"].includes(view)) view = "overview";
    if(view !== "community") closeSchoolmateProfile({restoreFocus:false});
    hubState.activeView = view;
    document.querySelectorAll("[data-hub-view]").forEach(element => { element.hidden = element.dataset.hubView !== view; });
    document.querySelectorAll("[data-hub-target]").forEach(button => {
      const active = button.dataset.hubTarget === view;
      button.classList.toggle("active", active);
      if(active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
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
      await loadCommunityFeed();
    } else if(view === "messages"){
      await loadConversations();
    } else if(view === "profile"){
      await loadMemberProfile();
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

  function fillMemberProfile(profile={}){
    $("profileDisplayName").value = profile.display_name || "";
    $("profilePhone").value = profile.phone_number || "";
    $("profileBio").value = profile.bio || "";
    $("profileInterests").value = Array.isArray(profile.interests) ? profile.interests.join(", ") : "";
    $("profileInstagram").value = profile.instagram_url || "";
    $("profileWhatsapp").value = profile.whatsapp_url || "";
    $("profileLinkedin").value = profile.linkedin_url || "";
    $("profileWebsite").value = profile.website_url || "";
    $("profileVisibility").value = profile.profile_visibility === "private" ? "private" : "school";
    $("profileAllowMessages").checked = profile.allow_messages === true;
    $("profileAnalyticsConsent").checked = profile.analytics_consent === true;
  }

  function setProfileFormDisabled(disabled){
    document.querySelectorAll('[data-hub-view="profile"] input, [data-hub-view="profile"] textarea, [data-hub-view="profile"] select')
      .forEach(control => { control.disabled = disabled; });
    $("saveMemberProfile").disabled = disabled;
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
      .select("display_name, bio, phone_number, interests, instagram_url, whatsapp_url, linkedin_url, website_url, profile_visibility, allow_messages, analytics_consent")
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
    if(!authClient || !currentUser || hubState.profileLoading || !hubState.profileHydrated) return;
    const context = requestContext();
    const button = $("saveMemberProfile");
    button.disabled = true;
    setStatus("memberProfileStatus", t("saving"));
    let payload;
    try {
      payload = {
        user_id: context.userId,
        display_name: $("profileDisplayName").value.trim() || null,
        phone_number: $("profilePhone").value.trim() || null,
        bio: $("profileBio").value.trim() || null,
        interests: parseInterests($("profileInterests").value),
        instagram_url: validatedUrl($("profileInstagram").value, "instagram"),
        whatsapp_url: validatedUrl($("profileWhatsapp").value, "whatsapp"),
        linkedin_url: validatedUrl($("profileLinkedin").value, "linkedin"),
        website_url: validatedUrl($("profileWebsite").value, "website"),
        profile_visibility: $("profileVisibility").value,
        allow_messages: $("profileAllowMessages").checked,
        analytics_consent: $("profileAnalyticsConsent").checked
      };
    } catch(error){
      button.disabled = false;
      setStatus("memberProfileStatus", error.message, "error");
      return;
    }
    const { data, error } = await authClient.from("member_profiles").upsert(payload, {onConflict:"user_id"}).select().single();
    if(!contextIsCurrent(context)) return;
    button.disabled = false;
    if(error){
      setStatus("memberProfileStatus", featureError(error) || t("profileSaveFailed"), "error");
      return;
    }
    hubState.profile = data;
    hubState.profileUserId = context.userId;
    hubState.profileDirty = false;
    setStatus("memberProfileStatus", t("profileSaved"), "success");
    renderOverview();
    if(finalTimetable?.savedAt) await syncFinalSchedule(finalTimetable);
  }

  function postAuthorName(post){
    return identityLabel(post.display_name, post.author_username);
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
    $("schoolmateProfileInitials").textContent = initialsFor(profile.display_name || profile.username);
    $("schoolmateProfileName").textContent = label;
    $("schoolmateProfileMeta").textContent = [profile.major_of_study, profile.degree_level ? t(`${profile.degree_level}Degree`) : "", profile.study_year ? t(`studyYear${profile.study_year}`) : ""].filter(Boolean).join(" · ");
    $("schoolmateProfileBio").textContent = profile.bio || t("notProvided");
    const interests = $("schoolmateProfileInterests");
    interests.replaceChildren();
    (Array.isArray(profile.interests) ? profile.interests : []).forEach(item => interests.append(node("span", "", item)));
    const links = $("schoolmateProfileLinks");
    links.replaceChildren();
    [["Instagram", profile.instagram_url], ["LinkedIn", profile.linkedin_url], [t("personalWebsite"), profile.website_url]].forEach(([name, href]) => {
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
  }

  async function openSchoolmateProfile(userId, trigger=document.activeElement){
    if(!userId) return;
    const context = requestContext();
    const request = ++hubState.profilePreviewRequest;
    hubState.profilePreviewReturnFocus = trigger instanceof HTMLElement ? trigger : null;
    const { data, error } = await authClient.rpc("get_schoolmate_profile", {p_user_id:userId});
    if(!contextIsCurrent(context) || request !== hubState.profilePreviewRequest || hubState.activeView !== "community" || $("memberHub").hidden) return;
    const profile = Array.isArray(data) ? data[0] : data;
    if(error || !profile){
      setStatus("communityComposerStatus", error ? featureError(error) : t("profileUnavailable"), "error");
      return;
    }
    hubState.profilePreview = profile;
    renderSchoolmateProfile(profile);
    $("schoolmateProfileModal").hidden = false;
    $("closeSchoolmateProfile").focus();
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
    posts.forEach(post => {
      const card = node("article", "hub-post-card");
      const author = node("div", "hub-post-author");
      const authorName = postAuthorName(post);
      const avatar = node("div", "hub-avatar", initialsFor(post.display_name || post.author_username));
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
    const { data, error } = await authClient.rpc("get_school_feed", {p_limit:40, p_offset:0});
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
    if(!conversations.length){ list.append(node("div", "hub-feed-empty", t("noConversations"))); return; }
    conversations.forEach(conversation => {
      const button = node("button", "hub-conversation-button");
      button.type = "button";
      button.classList.toggle("active", conversation.conversation_id === hubState.activeConversationId);
      const avatar = node("div", "hub-avatar", initialsFor(conversation.other_display_name || conversation.other_username));
      const copy = node("div");
      copy.append(node("b", "", identityLabel(conversation.other_display_name, conversation.other_username)), node("span", "", conversation.last_message || t("messagesEmpty")));
      button.append(avatar, copy);
      button.onclick = () => openConversation(conversation);
      list.append(button);
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
    }
    if(!$("memberHub").hidden){
      if(hubState.activeView === "overview" && hubState.insightsLoaded) renderInsights(hubState.insightRows);
      if(hubState.activeView === "community") renderCommunityFeed(hubState.feed);
      if(hubState.activeView === "messages"){
        renderConversations(hubState.conversations);
        renderActiveConversationHeader();
        if(hubState.activeConversationId) renderMessages(hubState.messages);
        else $("chatMessages").replaceChildren(node("div", "hub-message-empty", t("selectConversation")));
      }
      if(!$('schoolmateProfileModal').hidden) renderSchoolmateProfile();
    }
  }

  $("hubOpenBtn")?.addEventListener("click", () => showHub("overview"));
  $("enterMemberHub")?.addEventListener("click", () => showHub("overview"));
  $("hubBackToTimetable")?.addEventListener("click", showTimetable);
  $("overviewOpenTimetable")?.addEventListener("click", showTimetable);
  document.querySelectorAll("[data-hub-target]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.hubTarget)));
  $("loadCourseInsights")?.addEventListener("click", loadCourseInsights);
  $("courseInsightScope")?.addEventListener("change", syncInsightYearControl);
  $("saveMemberProfile")?.addEventListener("click", saveMemberProfile);
  $("publishCommunityPost")?.addEventListener("click", publishCommunityPost);
  $("refreshCommunityFeed")?.addEventListener("click", () => loadCommunityFeed({force:true}));
  $("startConversation")?.addEventListener("click", startConversation);
  $("refreshMessages")?.addEventListener("click", () => loadConversations({force:true}));
  $("reportConversation")?.addEventListener("click", reportConversation);
  $("blockConversationUser")?.addEventListener("click", blockConversationUser);
  $("closeSchoolmateProfile")?.addEventListener("click", closeSchoolmateProfile);
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

  window.ConCourseHub = {
    show: showHub,
    hide: hideHub,
    syncAccess,
    syncFinalSchedule,
    reloadMembership: () => loadMembership(),
    refreshLanguage: syncAccess
  };

  syncInsightYearControl();
  syncAccess();
})();
