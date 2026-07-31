(function attachConCourseNavigationState(root, factory){
  const navigationState = factory();
  if(typeof module === "object" && module.exports) module.exports = navigationState;
  if(root) root.ConCourseNavigationState = navigationState;
})(typeof globalThis === "object" ? globalThis : this, function createConCourseNavigationState(){
  "use strict";

  const STORAGE_KEY = "concourse_app_route_v1";
  const VERSION = 1;
  const SCREENS = new Set(["main", "planner", "timetable", "hub"]);
  const HUB_VIEWS = new Set([
    "overview",
    "community",
    "marketplace",
    "messages",
    "academic-tools",
    "profile",
    "owner-console"
  ]);
  const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  const CONTENT_DEEP_LINK_RE = new RegExp(
    `^#(?:listing-|(?:cross-)?post-)${UUID_PATTERN}$`,
    "i"
  );
  const AUTH_CALLBACK_HASH_RE = /(?:^#|&)(?:access_token|refresh_token|error|error_code|type)=/i;

  function normalizedUserId(value){
    const userId = String(value || "").trim();
    return userId && userId.length <= 128 ? userId : "";
  }

  function createRoute(userId, screen, hubView=""){
    const normalizedId = normalizedUserId(userId);
    const normalizedScreen = String(screen || "").trim();
    if(!normalizedId || !SCREENS.has(normalizedScreen)) return null;

    const route = {
      version:VERSION,
      userId:normalizedId,
      screen:normalizedScreen
    };
    if(normalizedScreen === "hub"){
      const normalizedHubView = String(hubView || "").trim();
      if(!HUB_VIEWS.has(normalizedHubView)) return null;
      route.hubView = normalizedHubView;
    }
    return route;
  }

  function normalizeRoute(value, expectedUserId){
    if(!value || typeof value !== "object" || Array.isArray(value)) return null;
    if(value.version !== VERSION) return null;
    const expectedId = normalizedUserId(expectedUserId);
    if(!expectedId || normalizedUserId(value.userId) !== expectedId) return null;
    return createRoute(expectedId, value.screen, value.hubView);
  }

  function readRoute(storage, userId){
    try {
      const raw = storage?.getItem?.(STORAGE_KEY);
      if(!raw) return null;
      return normalizeRoute(JSON.parse(raw), userId);
    } catch(_error){
      return null;
    }
  }

  function readRouteHint(storage){
    try {
      const raw = storage?.getItem?.(STORAGE_KEY);
      if(!raw) return null;
      const value = JSON.parse(raw);
      const userId = normalizedUserId(value?.userId);
      return userId ? normalizeRoute(value, userId) : null;
    } catch(_error){
      return null;
    }
  }

  function writeRoute(storage, userId, screen, hubView=""){
    const route = createRoute(userId, screen, hubView);
    if(!route || typeof storage?.setItem !== "function") return null;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(route));
      return route;
    } catch(_error){
      return null;
    }
  }

  function clearRoute(storage){
    if(typeof storage?.removeItem !== "function") return false;
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch(_error){
      return false;
    }
  }

  function hasAuthoritativeHash(hash){
    const value = String(hash || "");
    return CONTENT_DEEP_LINK_RE.test(value) || AUTH_CALLBACK_HASH_RE.test(value);
  }

  function hasContentDeepLink(hash){
    return CONTENT_DEEP_LINK_RE.test(String(hash || ""));
  }

  function hasAuthCallbackLocation({hash="", search=""}={}){
    if(AUTH_CALLBACK_HASH_RE.test(String(hash || ""))) return true;
    const params = String(search || "").replace(/^\?/, "");
    return /(?:^|&)(?:auth_action|code|error|error_code|error_description|error_message)=/i.test(params);
  }

  function shouldHoldInitialPaint(storage, location={}){
    if(hasAuthCallbackLocation(location)) return false;
    if(hasContentDeepLink(location.hash)) return true;
    const route = readRouteHint(storage);
    return !!route && route.screen !== "main";
  }

  function timetableRestoreAction({
    hasFinalTimetable=false,
    hasGeneratedSolutions=false,
    hasPlannerCourses=false
  }={}){
    if(hasFinalTimetable || hasGeneratedSolutions) return "open";
    if(hasPlannerCourses) return "regenerate";
    return "planner";
  }

  return Object.freeze({
    STORAGE_KEY,
    VERSION,
    SCREENS:Object.freeze([...SCREENS]),
    HUB_VIEWS:Object.freeze([...HUB_VIEWS]),
    createRoute,
    normalizeRoute,
    readRoute,
    readRouteHint,
    writeRoute,
    clearRoute,
    hasAuthoritativeHash,
    hasContentDeepLink,
    hasAuthCallbackLocation,
    shouldHoldInitialPaint,
    timetableRestoreAction
  });
});
