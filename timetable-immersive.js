(() => {
  "use strict";

  const DEMO_BLOCKS = Object.freeze([
    { day: 1, start: 540, end: 600, code: "BIO 120", detail: "LAB 3" },
    { day: 1, start: 630, end: 690, code: "HIST 204", detail: "A12" },
    { day: 1, start: 780, end: 870, code: "MATH 210", detail: "B201" },
    { day: 1, start: 900, end: 990, code: "CS 140", detail: "LAB 2" },
    { day: 2, start: 570, end: 690, code: "STUDIO", detail: "EAST" },
    { day: 2, start: 720, end: 780, code: "SEMINAR", detail: "S101" },
    { day: 2, start: 840, end: 900, code: "BIO 120", detail: "LEC 1" },
    { day: 2, start: 960, end: 1050, code: "HIST 204", detail: "A12" },
    { day: 3, start: 540, end: 630, code: "MATH 210", detail: "B201" },
    { day: 3, start: 660, end: 750, code: "CS 140", detail: "LAB 2" },
    { day: 3, start: 840, end: 960, code: "STUDIO", detail: "EAST" },
    { day: 4, start: 600, end: 660, code: "BIO 120", detail: "LEC 1" },
    { day: 4, start: 720, end: 780, code: "SEMINAR", detail: "S101" },
    { day: 4, start: 840, end: 930, code: "MATH 210", detail: "B201" },
    { day: 4, start: 960, end: 1050, code: "CS 140", detail: "LAB 2" },
    { day: 5, start: 540, end: 630, code: "HIST 204", detail: "A12" },
    { day: 5, start: 660, end: 780, code: "STUDIO", detail: "EAST" },
    { day: 5, start: 840, end: 900, code: "SEMINAR", detail: "S101" },
    { day: 5, start: 930, end: 990, code: "BIO 120", detail: "LAB 3" }
  ]);

  const DAY_NAMES = Object.freeze({
    en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    "zh-CN": ["", "周一", "周二", "周三", "周四", "周五", "周六"],
    "zh-HK": ["", "週一", "週二", "週三", "週四", "週五", "週六"]
  });

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const lerp = (start, end, progress) => start + (end - start) * progress;
  const smootherstep = (value) => {
    const progress = clamp(value, 0, 1);
    return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  };
  const pad = (value) => String(value).padStart(2, "0");
  const formatTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

  const initializeSemesterJourney = () => {
    const workspace = document.getElementById("appWrap");
    const configurator = workspace?.querySelector(".configurator-column");
    const stage = document.getElementById("plannerScrollJourney");
    const overlay = stage?.querySelector(".planner-journey-sticky");
    const monitor = overlay?.querySelector(".planner-monitor-device");
    const monitorCanvas = document.getElementById("plannerMonitorCanvas");
    const machineViewport = document.getElementById("plannerMachineViewport");
    const schedulePage = document.getElementById("schedulePage");
    const resultSurface = document.getElementById("scheduleTerminalSurface");
    const resultScroll = document.getElementById("scheduleTerminalScroll");
    const resultStatus = document.getElementById("scheduleTerminalStatus");
    if (!workspace || !configurator || !stage || !overlay || !monitor || !monitorCanvas || !machineViewport) return;

    const journeyWindows = Array.from(overlay.querySelectorAll("[data-journey-window]"));
    const occludedPlannerSurfaces = [
      document.getElementById("wishlistPanel"),
      ...Array.from(configurator.children).filter((child) => child !== stage)
    ].filter(Boolean);
    const status = document.getElementById("plannerJourneyStatus");
    const scrubber = document.getElementById("plannerJourneyScrubber");
    const skipJourneyLink = overlay.querySelector(".planner-journey-skip");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const auditParameters = new URLSearchParams(window.location.search);
    const auditFrameEnabled = auditParameters.get("timetableAuditFrame") === "1";
    const parsedAuditProgress = Number(auditParameters.get("timetableAuditProgress"));
    let auditTimelineProgress = auditFrameEnabled
      && auditParameters.has("timetableAuditProgress")
      && Number.isFinite(parsedAuditProgress)
      ? clamp(parsedAuditProgress, 0, 1)
      : 0;
    const cleanupCallbacks = [];
    let activeScrollTrigger = null;
    let staticFallbackActive = false;
    let machineFailureIsPermanent = false;
    let currentMachineProgress = 0;
    let refreshTraversalGeometry = () => {};
    let latestPlannerCourses = [];
    let latestFinalTimetable = null;
    let lastAddedCourseId = "";
    const RESULT_SURFACE_SIZE = Object.freeze({ width: 1366, height: 864 });

    const setOccludedPlannerAccess = (isOccluded) => {
      occludedPlannerSurfaces.forEach((surface) => {
        if ("inert" in surface) surface.inert = isOccluded;
        if (isOccluded) surface.setAttribute("aria-hidden", "true");
        else surface.removeAttribute("aria-hidden");
      });
    };

    const plannerIsVisible = () => (
      !workspace.hidden
      && document.body.classList.contains("app-active")
      && !document.body.classList.contains("schedule-active")
      && !document.body.classList.contains("hub-active")
    );

    const resultRouteIsActive = () => (
      Boolean(schedulePage && !schedulePage.hidden)
      && document.body.classList.contains("schedule-active")
    );

    const translatedMessage = (key) => {
      const messages = {
        en: {
          required: "Enter a course name before adding it.",
          day: "Choose at least one meeting day.",
          time: "Enter a valid meeting time.",
          added: "Course added. The monitor now reflects your planner.",
          notAdded: "The course was not added. Review the fields and try again.",
          empty: "Your saved timetable will appear here"
        },
        "zh-CN": {
          required: "请先输入课程名称。",
          day: "请至少选择一个上课日期。",
          time: "请输入有效的上课时间。",
          added: "课程已添加，显示器已同步你的规划。",
          notAdded: "课程未能添加，请检查输入后重试。",
          empty: "你保存的课表会显示在这里"
        },
        "zh-HK": {
          required: "請先輸入課程名稱。",
          day: "請至少選擇一個上課日子。",
          time: "請輸入有效的上課時間。",
          added: "課程已加入，顯示器已同步你的規劃。",
          notAdded: "課程未能加入，請檢查輸入後再試。",
          empty: "你儲存的課表會顯示在這裡"
        }
      };
      const language = document.documentElement.lang || "en";
      return (messages[language] || messages.en)[key];
    };

    const setStatus = (messageKey = "", state = "") => {
      if (!status) return;
      status.textContent = messageKey ? translatedMessage(messageKey) : "";
      if (state) status.dataset.state = state;
      else status.removeAttribute("data-state");
    };

    const createElement = (tagName, className = "", text = "") => {
      const element = document.createElement(tagName);
      if (className) element.className = className;
      if (text) element.textContent = text;
      return element;
    };

    const upcomingMonday = () => {
      const date = new Date();
      const weekday = date.getDay() || 7;
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + (8 - weekday) % 7);
      return date;
    };

    const getDayLabel = (day) => {
      const language = document.documentElement.lang || "en";
      return (DAY_NAMES[language] || DAY_NAMES.en)[day];
    };

    const blocksFromPlannerCourses = (courses) => courses.flatMap((course) => {
      const firstOption = Array.isArray(course.options) ? course.options[0] : null;
      return (firstOption?.sessions || []).flatMap((session) => (
        (session.days || []).map((day) => ({
          day: Number(day),
          start: Number(session.start),
          end: Number(session.end),
          code: course.code || course.name || "COURSE",
          name: course.name || "",
          detail: session.venue || course.prof || "",
          courseId: course.id || ""
        }))
      ));
    });

    const blocksFromFinalTimetable = (snapshot) => {
      if (!snapshot?.picks?.length) return [];
      const courseMap = new Map((snapshot.courses || []).map((course) => [course.id, course]));
      return snapshot.picks.flatMap((pick) => {
        const course = courseMap.get(pick.courseId) || {};
        return (pick.slots || []).flatMap((slot) => (
          (slot.days || []).map((day) => ({
            day: Number(day),
            start: Number(slot.start),
            end: Number(slot.end),
            code: course.code || course.name || "COURSE",
            name: course.name || "",
            detail: slot.venue || course.prof || "",
            courseId: course.id || ""
          }))
        ));
      });
    };

    const selectedJourneyDays = () => Array.from(overlay.querySelectorAll("[data-journey-day]"))
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => Number(button.dataset.journeyDay));

    const currentPreviewBlocks = () => {
      const name = document.getElementById("journeyCourseName")?.value.trim() || "";
      const code = document.getElementById("journeyCourseCode")?.value.trim() || name;
      const startValue = document.getElementById("journeyStart")?.value || "";
      const endValue = document.getElementById("journeyEnd")?.value || "";
      const toMinutes = (value) => {
        const [hours, minutes] = value.split(":").map(Number);
        return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
      };
      const start = toMinutes(startValue);
      const end = toMinutes(endValue);
      if (!name || !start || end <= start) return [];
      return selectedJourneyDays().map((day) => ({
        day,
        start,
        end,
        code: code || "NEW COURSE",
        name,
        detail: document.getElementById("journeyCourseProfessor")?.value.trim() || "Preview",
        preview: true
      }));
    };

    const activeMonitorBlocks = () => {
      const finalBlocks = blocksFromFinalTimetable(latestFinalTimetable);
      const plannerBlocks = blocksFromPlannerCourses(latestPlannerCourses);
      const realBlocks = finalBlocks.length ? finalBlocks : plannerBlocks;
      const baseBlocks = realBlocks.length ? realBlocks : [...DEMO_BLOCKS];
      return [...baseBlocks, ...currentPreviewBlocks()];
    };

    const renderMonitor = ({ animateCourseId = "" } = {}) => {
      const blocks = activeMonitorBlocks().filter((block) => (
        Number.isFinite(block.day)
        && Number.isFinite(block.start)
        && Number.isFinite(block.end)
        && block.end > block.start
      ));
      const hasSaturday = blocks.some((block) => block.day === 6);
      const days = hasSaturday ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
      const realBlocks = blocks.filter((block) => !block.preview);
      const minimum = realBlocks.length ? Math.min(...blocks.map((block) => block.start), 540) : 540;
      const maximum = realBlocks.length ? Math.max(...blocks.map((block) => block.end), 1080) : 1080;
      const minTime = clamp(Math.floor(minimum / 60) * 60, 420, 1080);
      const maxTime = clamp(Math.ceil(maximum / 60) * 60, minTime + 60, 1320);
      const span = maxTime - minTime;
      const monday = upcomingMonday();

      monitorCanvas.replaceChildren();
      monitorCanvas.style.setProperty("--monitor-day-count", String(days.length));

      monitorCanvas.append(createElement("div", "planner-monitor-corner"));
      days.forEach((day, index) => {
        const header = createElement("div", "planner-monitor-day");
        const dayName = createElement("span", "", getDayLabel(day));
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        const dayNumber = createElement("span", "", pad(date.getDate()));
        header.append(dayName, dayNumber);
        monitorCanvas.append(header);
      });

      const timeAxis = createElement("div", "planner-monitor-time-axis");
      for (let time = minTime; time <= maxTime; time += 60) {
        const label = createElement("span", "planner-monitor-time", formatTime(time));
        const labelPosition = ((time - minTime) / span) * 100;
        label.style.top = `${clamp(labelPosition, 1.4, 98.6)}%`;
        timeAxis.append(label);
      }
      monitorCanvas.append(timeAxis);

      const daysGrid = createElement("div", "planner-monitor-days-grid");
      days.forEach((day, index) => {
        const wash = createElement("span", "planner-monitor-day-wash");
        wash.style.left = `${(index / days.length) * 100}%`;
        wash.style.width = `${100 / days.length}%`;
        wash.classList.toggle("is-selected", selectedJourneyDays().includes(day));
        daysGrid.append(wash);
      });

      if (!blocks.length) {
        daysGrid.append(createElement("p", "planner-monitor-empty", translatedMessage("empty")));
      }

      blocks.forEach((block) => {
        const dayIndex = days.indexOf(block.day);
        if (dayIndex < 0) return;
        const item = createElement("article", "planner-monitor-course-block");
        if (block.preview) item.classList.add("is-preview");
        if (animateCourseId && block.courseId === animateCourseId) item.classList.add("is-entering");
        const start = clamp(block.start, minTime, maxTime);
        const end = clamp(block.end, minTime, maxTime);
        const columnWidth = 100 / days.length;
        item.style.left = `calc(${dayIndex * columnWidth}% + 1%)`;
        item.style.width = `calc(${columnWidth}% - 2%)`;
        item.style.top = `${((start - minTime) / span) * 100}%`;
        item.style.height = `${Math.max(((end - start) / span) * 100, 4.8)}%`;
        const code = createElement("strong", "planner-monitor-course-code", block.code);
        const time = createElement("span", "planner-monitor-course-detail", `${formatTime(block.start)}-${formatTime(block.end)}`);
        const detail = createElement("span", "planner-monitor-course-detail", block.detail || block.name || "");
        item.append(code, time, detail);
        daysGrid.append(item);
      });
      monitorCanvas.append(daysGrid);
    };

    const setControlValue = (target, value) => {
      if (!target) return;
      target.value = value;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const journeySyncCallbacks = [];
    const workflowSyncCallbacks = [];
    const syncJourneyField = (journeyId, plannerId) => {
      const journeyControl = document.getElementById(journeyId);
      const plannerControl = document.getElementById(plannerId);
      if (!journeyControl || !plannerControl) return;
      const syncToPlanner = () => setControlValue(plannerControl, journeyControl.value);
      const syncToJourney = (force = false) => {
        if (force || document.activeElement !== journeyControl) journeyControl.value = plannerControl.value;
      };
      journeyControl.addEventListener("input", syncToPlanner);
      journeyControl.addEventListener("change", syncToPlanner);
      plannerControl.addEventListener("input", syncToJourney);
      plannerControl.addEventListener("change", syncToJourney);
      journeyControl.addEventListener("focus", () => syncToJourney(true));
      journeySyncCallbacks.push(syncToJourney);
      cleanupCallbacks.push(() => {
        journeyControl.removeEventListener("input", syncToPlanner);
        journeyControl.removeEventListener("change", syncToPlanner);
        plannerControl.removeEventListener("input", syncToJourney);
        plannerControl.removeEventListener("change", syncToJourney);
      });
      syncToJourney();
    };

    [
      ["journeyCourseName", "cName"],
      ["journeyCourseCode", "cCode"],
      ["journeyCourseProfessor", "cProf"],
      ["journeyCourseCredits", "cCredits"],
      ["journeySessionsPerWeek", "sessionsPerWeek"],
      ["journeyStart", "sStart"],
      ["journeyEnd", "sEnd"],
      ["journeyDegreeLevel", "degreeLevel"],
      ["journeyStudyYear", "studyYear"],
      ["journeyMinCredits", "minCredits"],
      ["journeyMaxCredits", "maxCredits"],
      ["journeyExactN", "exactN"],
      ["journeyFreeCount", "freeCount"],
      ["journeyEarlyTime", "earlyTime"],
      ["journeyLateTime", "lateTime"],
      ["journeyBreakStart", "breakStart"],
      ["journeyBreakEnd", "breakEnd"]
    ].forEach(([journeyId, plannerId]) => syncJourneyField(journeyId, plannerId));

    const syncJourneyCheckbox = (journeyId, plannerId) => {
      const journeyControl = document.getElementById(journeyId);
      const plannerControl = document.getElementById(plannerId);
      if (!journeyControl || !plannerControl) return;
      const syncToPlanner = () => {
        plannerControl.checked = journeyControl.checked;
        plannerControl.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const syncToJourney = (force = false) => {
        if (force || document.activeElement !== journeyControl) journeyControl.checked = plannerControl.checked;
      };
      journeyControl.addEventListener("change", syncToPlanner);
      plannerControl.addEventListener("change", syncToJourney);
      journeySyncCallbacks.push(syncToJourney);
      cleanupCallbacks.push(() => {
        journeyControl.removeEventListener("change", syncToPlanner);
        plannerControl.removeEventListener("change", syncToJourney);
      });
      syncToJourney();
    };

    [
      ["journeyCourseRequired", "cReq"],
      ["journeyMultipleOptions", "cMulti"],
      ["journeyCompact", "pCompact"],
      ["journeyFewDays", "pFewDays"],
      ["journeyNoEarly", "pNoEarly"],
      ["journeyNoLate", "pNoLate"]
    ].forEach(([journeyId, plannerId]) => syncJourneyCheckbox(journeyId, plannerId));

    const journeyCountRadios = Array.from(overlay.querySelectorAll('input[name="journeyCountMode"]'));
    const plannerCountRadios = Array.from(document.querySelectorAll('input[name="countMode"]'));
    const journeyExactN = document.getElementById("journeyExactN");
    const syncCountModeFromPlanner = () => {
      const value = plannerCountRadios.find((radio) => radio.checked)?.value || "fewest";
      journeyCountRadios.forEach((radio) => { radio.checked = radio.value === value; });
      if (journeyExactN) journeyExactN.disabled = value !== "exact";
    };
    journeyCountRadios.forEach((radio) => {
      const applyCountMode = () => {
        if (!radio.checked) return;
        const plannerRadio = plannerCountRadios.find((candidate) => candidate.value === radio.value);
        if (!plannerRadio) return;
        plannerRadio.checked = true;
        plannerRadio.dispatchEvent(new Event("change", { bubbles: true }));
        syncCountModeFromPlanner();
        if (radio.value === "exact") journeyExactN?.focus({ preventScroll: true });
      };
      radio.addEventListener("change", applyCountMode);
      cleanupCallbacks.push(() => radio.removeEventListener("change", applyCountMode));
    });
    plannerCountRadios.forEach((radio) => {
      radio.addEventListener("change", syncCountModeFromPlanner);
      cleanupCallbacks.push(() => radio.removeEventListener("change", syncCountModeFromPlanner));
    });
    workflowSyncCallbacks.push(syncCountModeFromPlanner);

    const syncJourneyDayGroup = ({ journeySelector, plannerGroupId, dataKey }) => {
      const journeyButtons = Array.from(overlay.querySelectorAll(journeySelector));
      const plannerGroup = document.getElementById(plannerGroupId);
      if (!plannerGroup) return { buttons: journeyButtons, sync: () => {} };
      const sync = () => {
        journeyButtons.forEach((button) => {
          const day = button.dataset[dataKey];
          const plannerButton = plannerGroup.querySelector(`.day-chip[data-d="${day}"]`);
          button.setAttribute("aria-pressed", plannerButton?.getAttribute("aria-pressed") || "false");
        });
      };
      journeyButtons.forEach((button) => {
        const toggle = () => {
          const day = button.dataset[dataKey];
          plannerGroup.querySelector(`.day-chip[data-d="${day}"]`)?.click();
          sync();
          setStatus();
          renderMonitor();
        };
        button.addEventListener("click", toggle);
        cleanupCallbacks.push(() => button.removeEventListener("click", toggle));
      });
      plannerGroup.addEventListener("click", sync);
      cleanupCallbacks.push(() => plannerGroup.removeEventListener("click", sync));
      workflowSyncCallbacks.push(sync);
      sync();
      return { buttons: journeyButtons, sync };
    };

    const meetingDayGroup = syncJourneyDayGroup({
      journeySelector: "[data-journey-day]",
      plannerGroupId: "dayPicker",
      dataKey: "journeyDay"
    });
    syncJourneyDayGroup({
      journeySelector: "[data-journey-free-day]",
      plannerGroupId: "freeDayPicker",
      dataKey: "journeyFreeDay"
    });
    const journeyDayButtons = meetingDayGroup.buttons;

    const mirrorDynamicList = (sourceId, targetId) => {
      const source = document.getElementById(sourceId);
      const target = document.getElementById(targetId);
      if (!source || !target) return () => {};
      const render = () => {
        target.replaceChildren();
        Array.from(source.querySelectorAll(".slot-item")).forEach((sourceItem) => {
          const item = createElement("div", "planner-journey-slot-item");
          const copy = createElement("span", "", sourceItem.querySelector("span")?.textContent?.trim() || "");
          const sourceRemove = sourceItem.querySelector(".x");
          item.append(copy);
          if (sourceRemove) {
            const remove = createElement("button", "planner-journey-remove", sourceRemove.textContent?.trim() || "Remove");
            remove.type = "button";
            remove.setAttribute("aria-label", sourceRemove.getAttribute("aria-label") || "Remove");
            remove.addEventListener("click", () => sourceRemove.click());
            item.append(remove);
          }
          target.append(item);
        });
      };
      const observer = new MutationObserver(render);
      observer.observe(source, { childList: true, subtree: true, characterData: true });
      cleanupCallbacks.push(() => observer.disconnect());
      workflowSyncCallbacks.push(render);
      render();
      return render;
    };

    mirrorDynamicList("pendingSlots", "journeyPendingSessions");
    mirrorDynamicList("savedOptions", "journeySavedOptions");
    mirrorDynamicList("breakList", "journeyBreakList");

    const plannerCourseList = document.getElementById("courseList");
    const journeyCourseWishlist = document.getElementById("journeyCourseWishlist");
    const renderJourneyWishlist = () => {
      if (!journeyCourseWishlist) return;
      const snapshot = typeof window.getConcoursePlannerSnapshot === "function"
        ? window.getConcoursePlannerSnapshot()
        : { courses: [] };
      const courses = Array.isArray(snapshot?.courses) ? snapshot.courses : [];
      journeyCourseWishlist.replaceChildren();
      if (!courses.length) {
        const emptyMessage = plannerCourseList?.querySelector(".empty-note")?.textContent?.trim()
          || "No courses in the solver yet.";
        journeyCourseWishlist.append(createElement("p", "planner-window-note", emptyMessage));
        return;
      }
      courses.forEach((course) => {
        const originalRemove = Array.from(plannerCourseList?.querySelectorAll(".btn-danger") || [])
          .find((button) => button.dataset.id === course.id);
        const originalCard = originalRemove?.closest(".course-card");
        const originalMeta = originalCard?.querySelector(".course-meta")?.textContent?.trim();
        const originalBadges = Array.from(originalCard?.querySelectorAll(".badge") || [])
          .map((badge) => badge.textContent?.trim())
          .filter(Boolean)
          .join(" · ");
        const card = createElement("div", "planner-journey-course-item");
        const copy = createElement("div", "planner-journey-course-copy");
        copy.append(
          createElement("strong", "", course.name || course.code || "Course"),
          createElement("span", "", [originalMeta, originalBadges].filter(Boolean).join(" · "))
        );
        const remove = createElement("button", "planner-journey-remove", originalRemove?.textContent?.trim() || "Remove");
        remove.type = "button";
        remove.addEventListener("click", () => originalRemove?.click());
        card.append(copy, remove);
        journeyCourseWishlist.append(card);
      });
    };
    const plannerCourseObserver = new MutationObserver(renderJourneyWishlist);
    if (plannerCourseList) plannerCourseObserver.observe(plannerCourseList, { childList: true, subtree: true });
    cleanupCallbacks.push(() => plannerCourseObserver.disconnect());
    workflowSyncCallbacks.push(renderJourneyWishlist);
    renderJourneyWishlist();

    const plannerOptionArea = document.getElementById("optionArea");
    const journeyOptionArea = document.getElementById("journeyOptionArea");
    const plannerSessionHint = document.getElementById("sessionHint");
    const journeySessionHint = document.getElementById("journeySessionHint");
    const syncMeetingWorkflow = () => {
      if (journeyOptionArea) journeyOptionArea.hidden = !document.getElementById("cMulti")?.checked;
      if (journeySessionHint && plannerSessionHint) journeySessionHint.textContent = plannerSessionHint.textContent;
    };
    const meetingWorkflowObserver = new MutationObserver(syncMeetingWorkflow);
    [plannerOptionArea, plannerSessionHint].filter(Boolean).forEach((element) => {
      meetingWorkflowObserver.observe(element, { attributes: true, childList: true, subtree: true, characterData: true });
    });
    cleanupCallbacks.push(() => meetingWorkflowObserver.disconnect());
    workflowSyncCallbacks.push(syncMeetingWorkflow);

    const plannerAlert = document.getElementById("plannerAlert");
    const syncPlannerAlert = () => {
      if (!status || !plannerAlert?.textContent?.trim()) return;
      status.textContent = plannerAlert.textContent.trim();
      status.dataset.state = "error";
    };
    const plannerAlertObserver = new MutationObserver(syncPlannerAlert);
    if (plannerAlert) plannerAlertObserver.observe(plannerAlert, { childList: true, subtree: true, characterData: true });
    cleanupCallbacks.push(() => plannerAlertObserver.disconnect());

    const syncJourneyControlsFromPlanner = () => {
      journeySyncCallbacks.forEach((callback) => callback());
      workflowSyncCallbacks.forEach((callback) => callback());
      renderMonitor();
    };
    syncMeetingWorkflow();

    ["journeyCourseName", "journeyCourseCode", "journeyCourseProfessor", "journeyStart", "journeyEnd"]
      .forEach((id) => {
        const control = document.getElementById(id);
        if (!control) return;
        control.addEventListener("input", renderMonitor);
        cleanupCallbacks.push(() => control.removeEventListener("input", renderMonitor));
      });

    const addJourneyCourse = () => {
      const name = document.getElementById("journeyCourseName")?.value.trim() || "";
      if (!name) {
        setStatus("required", "error");
        document.getElementById("journeyCourseName")?.focus();
        return;
      }
      const courseWasAdded = typeof window.addCourseFromBuilder === "function"
        && window.addCourseFromBuilder() === true;
      if (!courseWasAdded) {
        setStatus("notAdded", "error");
        syncJourneyControlsFromPlanner();
        return;
      }
      syncJourneyControlsFromPlanner();
      setStatus("added");
    };

    const addCourseButton = document.getElementById("journeyAddCourse");
    addCourseButton?.addEventListener("click", addJourneyCourse);
    cleanupCallbacks.push(() => addCourseButton?.removeEventListener("click", addJourneyCourse));

    const revealCompletePlanner = () => {
      const target = document.getElementById("courseBuilderPanel");
      document.body.classList.add("planner-detailed-active");
      hideJourney();
      target?.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start"
      });
      window.requestAnimationFrame(() => document.getElementById("cName")?.focus({ preventScroll: true }));
    };
    const continueButton = document.getElementById("journeyContinue");
    continueButton?.addEventListener("click", revealCompletePlanner);
    cleanupCallbacks.push(() => continueButton?.removeEventListener("click", revealCompletePlanner));

    const skipImmersiveJourney = (event) => {
      event.preventDefault();
      const target = document.getElementById("courseBuilderPanel");
      document.body.classList.add("planner-detailed-active");
      hideJourney();
      target?.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start"
      });
      window.requestAnimationFrame(() => {
        target?.querySelector("a, button, input, select, [tabindex]")?.focus({ preventScroll: true });
      });
    };
    skipJourneyLink?.addEventListener("click", skipImmersiveJourney);
    cleanupCallbacks.push(() => skipJourneyLink?.removeEventListener("click", skipImmersiveJourney));

    const revealDetailedPlannerFromRoute = () => {
      document.body.classList.add("planner-detailed-active");
      hideJourney();
    };
    const revealImmersivePlannerFromRoute = () => {
      document.body.classList.remove("planner-detailed-active");
      showJourney();
    };
    document.addEventListener("concourse:timetable-show-detailed-planner", revealDetailedPlannerFromRoute);
    document.addEventListener("concourse:timetable-show-immersive-planner", revealImmersivePlannerFromRoute);
    cleanupCallbacks.push(() => document.removeEventListener("concourse:timetable-show-detailed-planner", revealDetailedPlannerFromRoute));
    cleanupCallbacks.push(() => document.removeEventListener("concourse:timetable-show-immersive-planner", revealImmersivePlannerFromRoute));

    const forwardPlannerAction = (journeyId, plannerId, afterAction = () => {}) => {
      const journeyButton = document.getElementById(journeyId);
      const plannerButton = document.getElementById(plannerId);
      const activate = () => {
        plannerButton?.click();
        afterAction();
      };
      journeyButton?.addEventListener("click", activate);
      cleanupCallbacks.push(() => journeyButton?.removeEventListener("click", activate));
    };
    forwardPlannerAction("journeyAddSession", "addSlot", () => {
      meetingDayGroup.sync();
      renderMonitor();
    });
    forwardPlannerAction("journeySaveOption", "saveOption", () => meetingDayGroup.sync());
    forwardPlannerAction("journeyAddBreak", "addBreak");
    const restoreJourneyValidationFocus = () => {
      syncPlannerAlert();
      const degreeLevel = document.getElementById("degreeLevel");
      const studyYear = document.getElementById("studyYear");
      const minCredits = document.getElementById("minCredits");
      const plannerSnapshot = typeof window.getConcoursePlannerSnapshot === "function"
        ? window.getConcoursePlannerSnapshot()
        : null;
      const plannerHasCourses = Array.isArray(plannerSnapshot?.courses) && plannerSnapshot.courses.length > 0;
      let journeyTarget = null;
      if(!degreeLevel?.value){
        journeyTarget = document.getElementById("journeyDegreeLevel");
      } else if(!studyYear?.value){
        journeyTarget = document.getElementById("journeyStudyYear");
      } else if(plannerHasCourses && !minCredits?.value.trim()){
        journeyTarget = document.getElementById("journeyMinCredits");
      }
      if(journeyTarget){
        window.requestAnimationFrame(() => journeyTarget.focus({ preventScroll: true }));
      }
    };
    forwardPlannerAction("journeyGenerate", "generate", restoreJourneyValidationFocus);
    forwardPlannerAction("journeyLoadSample", "loadSample", syncJourneyControlsFromPlanner);
    forwardPlannerAction("journeyClearAll", "clearAll", syncJourneyControlsFromPlanner);

    const profileButton = overlay.querySelector("[data-planner-profile]");
    const openProfile = () => {
      const signInButton = document.getElementById("authOpenBtn");
      if (signInButton && !signInButton.hidden) {
        signInButton.click();
        return;
      }
      document.getElementById("saveAccountBtn")?.click();
      if (status) {
        status.textContent = "Account connected. Your timetable state is being synchronized.";
        status.dataset.state = "ready";
      }
    };
    profileButton?.addEventListener("click", openProfile);
    cleanupCallbacks.push(() => profileButton?.removeEventListener("click", openProfile));

    const handlePlannerCourses = (event) => {
      const nextCourses = Array.isArray(event.detail?.courses) ? event.detail.courses : [];
      const previousIds = new Set(latestPlannerCourses.map((course) => course.id));
      const added = nextCourses.find((course) => course.id && !previousIds.has(course.id));
      latestPlannerCourses = nextCourses;
      latestFinalTimetable = null;
      lastAddedCourseId = added?.id || "";
      renderMonitor({ animateCourseId: lastAddedCourseId });
    };

    const handleFinalTimetable = (event) => {
      latestFinalTimetable = event.detail || null;
      renderMonitor();
    };

    const handlePlannerState = () => {
      const snapshot = typeof window.getConcoursePlannerSnapshot === "function"
        ? window.getConcoursePlannerSnapshot()
        : { courses: [] };
      latestPlannerCourses = Array.isArray(snapshot?.courses) ? snapshot.courses : [];
      syncJourneyControlsFromPlanner();
    };

    document.addEventListener("concourse:planner-courses-changed", handlePlannerCourses);
    document.addEventListener("concourse:timetable-rendered", handleFinalTimetable);
    document.addEventListener("concourse:planner-state-applied", handlePlannerState);
    cleanupCallbacks.push(() => {
      document.removeEventListener("concourse:planner-courses-changed", handlePlannerCourses);
      document.removeEventListener("concourse:timetable-rendered", handleFinalTimetable);
      document.removeEventListener("concourse:planner-state-applied", handlePlannerState);
    });

    const setWindowAccess = (progress) => {
      let availableCount = 0;
      if (progress >= .955) availableCount = 3;
      else if (progress >= .89) availableCount = 2;
      else if (progress >= .79) availableCount = 1;
      journeyWindows.forEach((panel, index) => {
        const containsFocus = panel.contains(document.activeElement);
        const isAvailable = index < availableCount;
        if (containsFocus && !isAvailable) {
          const priorPanel = journeyWindows[Math.max(0, availableCount - 1)];
          const focusTarget = availableCount > 0
            ? priorPanel?.querySelector("[data-journey-scroll]")
            : skipJourneyLink;
          focusTarget?.focus({ preventScroll: true });
        }
        panel.setAttribute("aria-hidden", String(!isAvailable));
        if ("inert" in panel) panel.inert = !isAvailable;
      });
    };

    const panelProjectionSizes = new WeakMap();
    const projectionViewport = {
      width: Math.max(1, overlay.clientWidth || window.innerWidth),
      height: Math.max(1, overlay.clientHeight || window.innerHeight)
    };
    let latestMachineAnchors = null;
    let projectionRefreshFrame = 0;

    const cachePanelProjectionSize = (panel, measuredWidth, measuredHeight) => {
      const width = Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : panel.offsetWidth;
      const height = Number.isFinite(measuredHeight) && measuredHeight > 0
        ? measuredHeight
        : panel.offsetHeight;
      if (width > 0 && height > 0) panelProjectionSizes.set(panel, { width, height });
    };

    journeyWindows.forEach((panel) => cachePanelProjectionSize(panel));
    if (resultSurface) panelProjectionSizes.set(resultSurface, RESULT_SURFACE_SIZE);

    const pointFromProjectionValue = (value) => {
      if (Array.isArray(value) && value.length >= 2) {
        const [x, y] = value.map(Number);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      }
      const x = Number(value?.x);
      const y = Number(value?.y);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    };

    // The machine emits TL, TR, BR, BL. Named DOMQuad-style forms are also
    // accepted so the DOM layer remains decoupled from the renderer's payload.
    const pointsFromProjectionQuad = (quad) => {
      const values = Array.isArray(quad)
        ? quad
        : quad?.points
          || [
            quad?.topLeft || quad?.tl || quad?.p1,
            quad?.topRight || quad?.tr || quad?.p2,
            quad?.bottomRight || quad?.br || quad?.p3,
            quad?.bottomLeft || quad?.bl || quad?.p4
          ];
      if (!Array.isArray(values) || values.length !== 4) return null;
      const points = values.map(pointFromProjectionValue);
      return points.every(Boolean) ? points : null;
    };

    const buildQuadMatrix3d = (quad, sourceWidth, sourceHeight) => {
      const points = pointsFromProjectionQuad(quad);
      if (!points || sourceWidth < 1 || sourceHeight < 1) return null;

      const cross = (origin, first, second) => (
        (first.x - origin.x) * (second.y - origin.y)
        - (first.y - origin.y) * (second.x - origin.x)
      );
      const turns = points.map((point, index) => cross(
        point,
        points[(index + 1) % points.length],
        points[(index + 2) % points.length]
      ));
      const turnTolerance = .01;
      const turnsPositive = turns.every((turn) => turn > turnTolerance);
      const turnsNegative = turns.every((turn) => turn < -turnTolerance);
      if (!turnsPositive && !turnsNegative) return null;

      const signedArea = points.reduce((area, point, index) => {
        const next = points[(index + 1) % points.length];
        return area + point.x * next.y - next.x * point.y;
      }, 0) * .5;
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const projectedWidth = Math.max(...xs) - Math.min(...xs);
      const projectedHeight = Math.max(...ys) - Math.min(...ys);
      const projectionLimit = Math.hypot(projectionViewport.width, projectionViewport.height) * 2.75;
      if (
        Math.abs(signedArea) < 16
        || projectedWidth < 1
        || projectedHeight < 1
        || projectedWidth > projectionLimit
        || projectedHeight > projectionLimit
      ) return null;

      const [topLeft, topRight, bottomRight, bottomLeft] = points;
      const deltaX1 = topRight.x - bottomRight.x;
      const deltaX2 = bottomLeft.x - bottomRight.x;
      const deltaX3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
      const deltaY1 = topRight.y - bottomRight.y;
      const deltaY2 = bottomLeft.y - bottomRight.y;
      const deltaY3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
      let perspectiveX = 0;
      let perspectiveY = 0;

      if (Math.abs(deltaX3) > 1e-7 || Math.abs(deltaY3) > 1e-7) {
        const divisor = deltaX1 * deltaY2 - deltaX2 * deltaY1;
        if (Math.abs(divisor) < 1e-8) return null;
        perspectiveX = (deltaX3 * deltaY2 - deltaX2 * deltaY3) / divisor;
        perspectiveY = (deltaX1 * deltaY3 - deltaX3 * deltaY1) / divisor;
      }

      const denominators = [
        1,
        1 + perspectiveX,
        1 + perspectiveX + perspectiveY,
        1 + perspectiveY
      ];
      if (denominators.some((value) => !Number.isFinite(value) || value < .01)) return null;

      const h11 = (topRight.x - topLeft.x + perspectiveX * topRight.x) / sourceWidth;
      const h12 = (bottomLeft.x - topLeft.x + perspectiveY * bottomLeft.x) / sourceHeight;
      const h13 = topLeft.x;
      const h21 = (topRight.y - topLeft.y + perspectiveX * topRight.y) / sourceWidth;
      const h22 = (bottomLeft.y - topLeft.y + perspectiveY * bottomLeft.y) / sourceHeight;
      const h23 = topLeft.y;
      const h31 = perspectiveX / sourceWidth;
      const h32 = perspectiveY / sourceHeight;
      const determinant = h11 * (h22 - h23 * h32)
        - h12 * (h21 - h23 * h31)
        + h13 * (h21 * h32 - h22 * h31);
      const values = [
        h11, h21, 0, h31,
        h12, h22, 0, h32,
        0, 0, 1, 0,
        h13, h23, 0, 1
      ];
      if (
        Math.abs(determinant) < 1e-10
        || values.some((value) => !Number.isFinite(value) || Math.abs(value) > 1e6)
      ) return null;

      const serialize = (value) => {
        if (Math.abs(value) < 1e-10) return "0";
        return String(Number(value.toFixed(10)));
      };
      return `matrix3d(${values.map(serialize).join(",")})`;
    };

    const electronicSurfaceProperties = [
      "--display-backlight-alpha",
      "--display-edge-depth",
      "--display-clip-inset",
      "--display-reflection-alpha",
      "--display-reflection-x",
      "--display-view-shade"
    ];

    const setInlineStyleValue = (panel, property, value) => {
      if (panel.style.getPropertyValue(property) === value) return false;
      panel.style.setProperty(property, value);
      return true;
    };

    const removeInlineStyleValue = (panel, property) => {
      if (!panel.style.getPropertyValue(property)) return false;
      panel.style.removeProperty(property);
      return true;
    };

    const clearElectronicSurfaceResponse = (panel) => {
      electronicSurfaceProperties.forEach((property) => removeInlineStyleValue(panel, property));
    };

    // The DOM remains the real control surface. These variables only describe
    // how its glass responds to the carrier's camera-facing angle, so the
    // material response follows the same quad without adding render-loop reads.
    const applyElectronicSurfaceResponse = (panel, anchor, quadPoints) => {
      if (!quadPoints) return;
      const rawFacing = Number(anchor?.facing);
      const facing = Number.isFinite(rawFacing) ? clamp(rawFacing, .08, 1) : 1;
      const seated = Math.pow(clamp((facing - .08) / .92, 0, 1), .72);
      const centerX = quadPoints.reduce((total, point) => total + point.x, 0) / quadPoints.length;
      const viewportRatio = clamp(centerX / Math.max(1, projectionViewport.width), 0, 1);
      const reflectionX = clamp(50 + (.5 - viewportRatio) * 44, 26, 74);

      setInlineStyleValue(panel, "--display-backlight-alpha", lerp(.038, .082, seated).toFixed(3));
      setInlineStyleValue(panel, "--display-edge-depth", `${lerp(23, 16, seated).toFixed(2)}px`);
      setInlineStyleValue(panel, "--display-clip-inset", `${lerp(8, 5, seated).toFixed(2)}px`);
      setInlineStyleValue(panel, "--display-reflection-alpha", lerp(.058, .026, seated).toFixed(3));
      setInlineStyleValue(panel, "--display-reflection-x", `${reflectionX.toFixed(2)}%`);
      setInlineStyleValue(panel, "--display-view-shade", lerp(.105, .012, seated).toFixed(3));
    };

    const clearMachineProjection = (panel, clearAnchor = false) => {
      panel.classList.remove("is-machine-projected");
      removeInlineStyleValue(panel, "--machine-quad-transform");
      clearElectronicSurfaceResponse(panel);
      if (!clearAnchor) return;
      removeInlineStyleValue(panel, "--machine-anchor-x");
      removeInlineStyleValue(panel, "--machine-anchor-y");
      removeInlineStyleValue(panel, "--machine-panel-scale");
    };

    const applyCenterAnchor = (panel, anchor, quadPoints = null) => {
      clearMachineProjection(panel);
      const cachedSize = panelProjectionSizes.get(panel);
      if (!cachedSize) return;
      const quadCenter = quadPoints?.reduce((center, point) => ({
        x: center.x + point.x / quadPoints.length,
        y: center.y + point.y / quadPoints.length
      }), { x: 0, y: 0 });
      const anchorX = Number.isFinite(Number(anchor?.x)) ? Number(anchor.x) : quadCenter?.x;
      const anchorY = Number.isFinite(Number(anchor?.y)) ? Number(anchor.y) : quadCenter?.y;
      if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return;

      const requestedScale = Number.isFinite(Number(anchor?.scale)) ? Number(anchor.scale) : 1;
      const panelScale = clamp(requestedScale, .68, 1);
      const halfWidth = cachedSize.width * panelScale * .5;
      const halfHeight = cachedSize.height * panelScale * .5;
      const inset = 16;
      const x = projectionViewport.width <= (halfWidth + inset) * 2
        ? projectionViewport.width * .5
        : clamp(anchorX, halfWidth + inset, projectionViewport.width - halfWidth - inset);
      const y = projectionViewport.height <= (halfHeight + inset) * 2
        ? projectionViewport.height * .5
        : clamp(anchorY, halfHeight + inset, projectionViewport.height - halfHeight - inset);
      setInlineStyleValue(panel, "--machine-anchor-x", `${x.toFixed(1)}px`);
      setInlineStyleValue(panel, "--machine-anchor-y", `${y.toFixed(1)}px`);
      setInlineStyleValue(panel, "--machine-panel-scale", panelScale.toFixed(3));
    };

    const projectDomSurface = (
      panel,
      anchor,
      { allowCenterFallback = true, preserveOnInvalid = false } = {}
    ) => {
      if (!panel || !anchor?.visible) {
        if (!preserveOnInvalid) {
          panel?.classList.add("is-projection-invalid");
          if (panel) clearMachineProjection(panel, true);
        }
        return false;
      }
      const quadPoints = pointsFromProjectionQuad(anchor.quad);
      const panelSize = panelProjectionSizes.get(panel);
      const quadMatrix = machineViewport.classList.contains("is-webgl") && panelSize
        ? buildQuadMatrix3d(quadPoints, panelSize.width, panelSize.height)
        : null;
      if (!quadMatrix) {
        if (!preserveOnInvalid) {
          panel.classList.add("is-projection-invalid");
          if (allowCenterFallback) applyCenterAnchor(panel, anchor, quadPoints);
          else clearMachineProjection(panel, true);
        }
        return false;
      }
      panel.classList.remove("is-projection-invalid");
      applyElectronicSurfaceResponse(panel, anchor, quadPoints);
      setInlineStyleValue(panel, "--machine-quad-transform", quadMatrix);
      panel.classList.add("is-machine-projected");
      return true;
    };

    let resultProjectionLossTimer = 0;
    let resultFocusFrame = 0;
    let resultFocusPending = false;
    let lastMachinePresentationMode = "";

    const setResultPresentationState = (state = "none") => {
      ["awaiting", "projected", "fallback"].forEach((name) => {
        document.body.classList.toggle(`schedule-terminal-${name}`, state === name);
      });
      if (state === "projected" || state === "fallback") {
        window.clearTimeout(window.__concourseTimetableResultWatchdog);
      }
      if (resultStatus && resultRouteIsActive()) {
        resultStatus.textContent = state === "projected"
          ? "Mechanical timetable terminal ready."
          : state === "fallback"
            ? "Generated timetable ready. Standard display enabled."
            : "Preparing the mechanical timetable terminal.";
      }
    };

    const transferResultFocus = ({ force = false } = {}) => {
      if ((!resultFocusPending && !force) || !resultScroll) return;
      resultFocusPending = false;
      window.cancelAnimationFrame(resultFocusFrame);
      resultFocusFrame = window.requestAnimationFrame(() => {
        resultFocusFrame = 0;
        if (!resultRouteIsActive()) return;
        if (!document.body.classList.contains("schedule-terminal-projected")
          && !document.body.classList.contains("schedule-terminal-fallback")) return;
        resultScroll.focus({ preventScroll: true });
      });
    };

    const clearResultProjection = ({ presentation = "none", preserveSurface = false } = {}) => {
      window.clearTimeout(resultProjectionLossTimer);
      resultProjectionLossTimer = 0;
      setResultPresentationState(presentation);
      if (presentation === "fallback") transferResultFocus({ force: true });
      if (!resultSurface || preserveSurface) return;
      resultSurface.classList.remove("is-projection-invalid");
      clearMachineProjection(resultSurface, true);
    };

    const resultProjectionIsEligible = () => (
      Boolean(schedulePage && resultSurface && resultScroll)
      && !schedulePage.hidden
      && document.body.classList.contains("schedule-active")
      && machineViewport.classList.contains("is-webgl")
      && !reducedMotion.matches
      && window.matchMedia("(min-width: 761px)").matches
      && !navigator.connection?.saveData
      && !document.documentElement.classList.contains("timetable-webgl-failed")
      && !document.documentElement.classList.contains("timetable-webgl-context-lost")
      && !staticFallbackActive
      && !machineFailureIsPermanent
    );

    const projectResultSurface = (anchors) => {
      // A fallback is latched for the current route epoch. A late WebGL frame
      // must never pull an already interactive full-page result back into 3D.
      if (document.body.classList.contains("schedule-terminal-fallback")) return false;
      if (!resultProjectionIsEligible()) {
        clearResultProjection({
          presentation: resultRouteIsActive() ? "fallback" : "none"
        });
        return false;
      }
      const projected = projectDomSurface(resultSurface, anchors?.result, {
        allowCenterFallback: false,
        preserveOnInvalid: true
      });
      if (projected) {
        window.clearTimeout(resultProjectionLossTimer);
        resultProjectionLossTimer = 0;
        setResultPresentationState("projected");
        transferResultFocus();
        return true;
      }
      if (document.body.classList.contains("schedule-terminal-projected")) {
        // A resize or a single clipped quad must not flash the full-page result
        // over the mechanism. Keep the last safe homography for 220 ms while
        // the renderer produces a replacement anchor.
        if (!resultProjectionLossTimer) {
          resultProjectionLossTimer = window.setTimeout(() => {
            resultProjectionLossTimer = 0;
            if (!resultRouteIsActive()) {
              clearResultProjection();
              return;
            }
            clearResultProjection({ presentation: "fallback" });
          }, 220);
        }
        return true;
      }
      setResultPresentationState("awaiting");
      return false;
    };

    let activeProjectionRoute = "";
    const projectMachineAnchors = (anchors) => {
      if (resultRouteIsActive()) {
        if (activeProjectionRoute !== "result") {
          journeyWindows.forEach((panel) => clearMachineProjection(panel, true));
          activeProjectionRoute = "result";
        }
        projectResultSurface(anchors);
        return;
      }
      if (activeProjectionRoute !== "planner") {
        clearResultProjection();
        activeProjectionRoute = "planner";
      }
      journeyWindows.forEach((panel) => {
        projectDomSurface(panel, anchors?.[panel.dataset.journeyWindow]);
      });
    };

    const handleMachineAnchors = (event) => {
      latestMachineAnchors = event.detail || {};
      projectMachineAnchors(latestMachineAnchors);
    };
    window.addEventListener("concourse:timetable-machine-anchors", handleMachineAnchors);
    cleanupCallbacks.push(() => {
      window.removeEventListener("concourse:timetable-machine-anchors", handleMachineAnchors);
      window.cancelAnimationFrame(projectionRefreshFrame);
      window.cancelAnimationFrame(resultFocusFrame);
      window.clearTimeout(resultProjectionLossTimer);
      window.clearTimeout(window.__concourseTimetableResultWatchdog);
      journeyWindows.forEach((panel) => clearMachineProjection(panel, true));
      clearResultProjection();
    });

    const projectionResizeObserver = typeof window.ResizeObserver === "function"
      ? new window.ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const borderBox = entry.borderBoxSize?.[0] || entry.borderBoxSize;
          const width = borderBox?.inlineSize || entry.contentRect?.width;
          const height = borderBox?.blockSize || entry.contentRect?.height;
          if (entry.target === overlay) {
            if (width > 0) projectionViewport.width = width;
            if (height > 0) projectionViewport.height = height;
            return;
          }
          cachePanelProjectionSize(entry.target, width, height);
        });
        window.cancelAnimationFrame(projectionRefreshFrame);
        projectionRefreshFrame = window.requestAnimationFrame(() => {
          if (latestMachineAnchors) projectMachineAnchors(latestMachineAnchors);
        });
      })
      : null;
    projectionResizeObserver?.observe(overlay);
    journeyWindows.forEach((panel) => projectionResizeObserver?.observe(panel));
    cleanupCallbacks.push(() => projectionResizeObserver?.disconnect());

    const handleEntranceProjection = (event) => {
      if (!machineViewport.classList.contains("is-webgl")) return;
      const projection = event.detail || {};
      const hasFiniteFrame = [projection.x, projection.y, projection.width, projection.height, projection.rotation]
        .every(Number.isFinite);
      const projectionLimit = Math.hypot(overlay.clientWidth || window.innerWidth, overlay.clientHeight || window.innerHeight) * 2.75;
      if (
        !projection.visible
        || !hasFiniteFrame
        || projection.width < 1
        || projection.height < 1
        || projection.width > projectionLimit
        || projection.height > projectionLimit
      ) {
        monitor.style.visibility = "hidden";
        return;
      }
      monitor.style.left = `${projection.x.toFixed(2)}px`;
      monitor.style.top = `${projection.y.toFixed(2)}px`;
      monitor.style.width = `${projection.width.toFixed(2)}px`;
      monitor.style.height = `${projection.height.toFixed(2)}px`;
      monitor.style.visibility = "visible";
      monitor.style.transform = `translate3d(-50%, -50%, 0) rotate(${projection.rotation.toFixed(6)}rad)`;
    };
    window.addEventListener("concourse:timetable-machine-entrance-projection", handleEntranceProjection);
    cleanupCallbacks.push(() => window.removeEventListener("concourse:timetable-machine-entrance-projection", handleEntranceProjection));

    const scheduleIsVisible = resultRouteIsActive;

    const syncMachinePresentation = () => {
      const showingResult = scheduleIsVisible();
      const mode = showingResult ? "result" : "planner";
      if (mode !== lastMachinePresentationMode) {
        resultFocusPending = showingResult;
        lastMachinePresentationMode = mode;
      }
      window.__concourseTimetableMachineMode = mode;
      window.ConcourseTimetableMachine?.setMode?.(mode);
      if (staticFallbackActive || machineFailureIsPermanent) {
        clearResultProjection({
          presentation: showingResult ? "fallback" : "none"
        });
        window.ConcourseTimetableMachine?.setActive(false);
        return;
      }
      if (showingResult) {
        window.ConcourseTimetableMachine?.setProgress(1);
        window.ConcourseTimetableMachine?.setActive(true);
        if (latestMachineAnchors) projectResultSurface(latestMachineAnchors);
        return;
      }
      clearResultProjection({
        presentation: resultRouteIsActive() ? "fallback" : "none"
      });
      window.ConcourseTimetableMachine?.setProgress(currentMachineProgress);
      window.ConcourseTimetableMachine?.setActive(plannerIsVisible());
    };

    const handleMachineReady = () => {
      window.ConcourseTimetableMachine?.resize();
      syncMachinePresentation();
    };
    window.addEventListener("concourse:timetable-machine-ready", handleMachineReady);
    cleanupCallbacks.push(() => window.removeEventListener("concourse:timetable-machine-ready", handleMachineReady));

    const showJourney = () => {
      if (!plannerIsVisible()) return;
      if (document.body.classList.contains("planner-detailed-active")) return;
      document.body.classList.add("planner-journey-active");
      setOccludedPlannerAccess(true);
      window.__concourseTimetableMachineMode = "planner";
      window.ConcourseTimetableMachine?.setMode?.("planner");
      window.ConcourseTimetableMachine?.setActive(true);
      syncJourneyControlsFromPlanner();
    };

    const hideJourney = () => {
      document.body.classList.remove("planner-journey-active");
      setOccludedPlannerAccess(false);
      // The generated timetable keeps the settled terminal rendering as its
      // inert physical surround. Other destinations still stop the renderer.
      syncMachinePresentation();
      setWindowAccess(0);
    };

    const initializeStaticFallback = ({ permanent = false } = {}) => {
      machineFailureIsPermanent = machineFailureIsPermanent || permanent;
      staticFallbackActive = true;
      activeScrollTrigger?.disable(false);
      latestMachineAnchors = null;
      window.cancelAnimationFrame(projectionRefreshFrame);
      projectionResizeObserver?.disconnect();
      journeyWindows.forEach((panel) => {
        clearMachineProjection(panel, true);
        panel.classList.remove("is-projection-invalid");
      });
      clearResultProjection({
        presentation: resultRouteIsActive() ? "fallback" : "none"
      });
      stage.classList.add("is-static");
      document.body.classList.remove("planner-journey-active");
      setOccludedPlannerAccess(false);
      window.ConcourseTimetableMachine?.setActive(false);
      ["left", "top", "width", "height", "visibility", "transform"].forEach((property) => {
        monitor.style.removeProperty(property);
      });
      machineViewport.style.removeProperty("clip-path");
      journeyWindows.forEach((panel) => {
        panel.setAttribute("aria-hidden", "false");
        if ("inert" in panel) panel.inert = false;
      });
      renderMonitor();
    };
    const handleMachineFailure = () => initializeStaticFallback({ permanent: true });
    window.addEventListener("concourse:timetable-machine-failed", handleMachineFailure);
    cleanupCallbacks.push(() => window.removeEventListener("concourse:timetable-machine-failed", handleMachineFailure));
    if (document.documentElement.classList.contains("timetable-webgl-failed")) {
      window.requestAnimationFrame(handleMachineFailure);
    }

    const journeyScrollerViewport = window.matchMedia("(min-width: 1051px)");
    const resolveJourneyScroller = () => (
      document.body.classList.contains("planner-journey-active")
        ? window
        : journeyScrollerViewport.matches
        ? configurator
        : window
    );
    let journeyScroller = resolveJourneyScroller();
    let currentJourneyProgress = 0;
    let journeyScrollerNeedsRebuild = false;
    let pendingJourneyProgress = null;
    let rebuildJourneyScroller = () => false;
    const setScrollerProgress = (progress, {
      scroller = journeyScroller,
      trigger = null
    } = {}) => {
      const normalizedProgress = clamp(Number(progress) || 0, 0, 1);
      const viewportHeight = scroller === window ? window.innerHeight : configurator.clientHeight;
      const scrollStart = Number.isFinite(trigger?.start)
        ? trigger.start
        : scroller === window
        ? stage.getBoundingClientRect().top + window.scrollY
        : stage.offsetTop;
      const scrollEnd = Number.isFinite(trigger?.end)
        ? trigger.end
        : scrollStart + Math.max(1, stage.offsetHeight - viewportHeight);
      const target = scrollStart + (scrollEnd - scrollStart) * normalizedProgress;
      if (scroller === window) window.scrollTo({ top: target, behavior: "instant" });
      else scroller.scrollTo({ top: target, behavior: "instant" });
    };

    const initialSnapshot = typeof window.getConcoursePlannerSnapshot === "function"
      ? window.getConcoursePlannerSnapshot()
      : { courses: [] };
    latestPlannerCourses = Array.isArray(initialSnapshot?.courses) ? initialSnapshot.courses : [];
    renderMonitor();
    setWindowAccess(0);

    const motionViewport = window.matchMedia("(min-width: 761px)");
    const saveData = Boolean(navigator.connection?.saveData);
    if (!window.gsap || !window.ScrollTrigger || reducedMotion.matches || !motionViewport.matches || saveData) {
      initializeStaticFallback();
      if (!motionViewport.matches && window.gsap && window.ScrollTrigger && !reducedMotion.matches && !saveData) {
        const reinitializeOnDesktop = (event) => {
          if (!event.matches) return;
          motionViewport.removeEventListener?.("change", reinitializeOnDesktop);
          window.location.reload();
        };
        motionViewport.addEventListener?.("change", reinitializeOnDesktop);
      }
      if (reducedMotion.matches && window.gsap && window.ScrollTrigger && motionViewport.matches && !saveData) {
        const reinitializeWhenMotionReturns = (event) => {
          if (event.matches) return;
          reducedMotion.removeEventListener?.("change", reinitializeWhenMotionReturns);
          window.location.reload();
        };
        reducedMotion.addEventListener?.("change", reinitializeWhenMotionReturns);
      }
      return;
    }

    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    const gsapContext = gsap.context(() => {
      stage.classList.remove("is-static");
      const footer = overlay.querySelector(".planner-monitor-footer");
      const nav = overlay.querySelector(".planner-monitor-nav");
      const modelLabel = overlay.querySelector(".planner-monitor-model");
      const [courseWindow, meetingWindow, priorityWindow] = journeyWindows;
      const traversalState = { progress: 0 };
      const traversalMotion = Object.freeze({
        scale: 13.5,
        approachEnd: .31,
        apertureStart: .015,
        apertureEnd: .5,
        sourceVentX: .5,
        sourceVentY: .7525
      });
      const ventGeometry = {
        x: overlay.clientWidth * traversalMotion.sourceVentX,
        y: overlay.clientHeight * traversalMotion.sourceVentY,
        coverRadius: Math.hypot(overlay.clientWidth, overlay.clientHeight),
        baseRadiusX: Math.max(1, overlay.clientWidth * .0016),
        baseRadiusY: Math.max(1, overlay.clientHeight * .0008)
      };
      let currentMonitorScale = 1;

      const renderTraversal = () => {
        const progress = clamp(traversalState.progress, 0, 1);
        const approachProgress = smootherstep(progress / traversalMotion.approachEnd);
        currentMonitorScale = Math.exp(Math.log(traversalMotion.scale) * approachProgress);
        if (!machineViewport.classList.contains("is-webgl")) {
          monitor.style.transform = `translate3d(-50%, -50%, 0) scale(${currentMonitorScale.toFixed(5)})`;
        }

        const apertureProgress = smootherstep(
          (progress - traversalMotion.apertureStart)
          / (traversalMotion.apertureEnd - traversalMotion.apertureStart)
        );
        const coverageProgress = Math.pow(apertureProgress, 1.9);
        const thresholdProgress = smootherstep(progress / traversalMotion.apertureStart);
        const opticalRadiusX = ventGeometry.baseRadiusX * currentMonitorScale * thresholdProgress;
        const opticalRadiusY = ventGeometry.baseRadiusY * currentMonitorScale * thresholdProgress;
        const radiusX = lerp(opticalRadiusX, ventGeometry.coverRadius, coverageProgress);
        const radiusY = lerp(opticalRadiusY, ventGeometry.coverRadius, coverageProgress);

        machineViewport.style.clipPath = `ellipse(${radiusX.toFixed(2)}px ${radiusY.toFixed(2)}px at ${ventGeometry.x.toFixed(2)}px ${ventGeometry.y.toFixed(2)}px)`;
        currentMachineProgress = clamp(
          (progress - traversalMotion.apertureStart) / (1 - traversalMotion.apertureStart),
          0,
          1
        );
        // Scroll-container reconstruction may update the dormant planner
        // timeline while the generated timetable owns the machine. Preserve
        // the result carrier's settled progress instead of letting that
        // behind-the-scenes resize pull it back into the planner journey.
        if (!resultRouteIsActive()) {
          window.ConcourseTimetableMachine?.setProgress(currentMachineProgress);
        }
      };

      const syncVentGeometry = () => {
        const overlayBounds = overlay.getBoundingClientRect();
        const monitorBounds = monitor.getBoundingClientRect();
        const width = Math.max(1, overlayBounds.width || overlay.clientWidth || window.innerWidth);
        const height = Math.max(1, overlayBounds.height || overlay.clientHeight || window.innerHeight);
        const localVentX = monitorBounds.left - overlayBounds.left
          + monitorBounds.width * traversalMotion.sourceVentX;
        const localVentY = monitorBounds.top - overlayBounds.top
          + monitorBounds.height * traversalMotion.sourceVentY;

        ventGeometry.x = clamp(localVentX, 0, width);
        ventGeometry.y = clamp(localVentY, 0, height);
        ventGeometry.baseRadiusX = Math.max(1, width * .0016);
        ventGeometry.baseRadiusY = Math.max(1, height * .0008);
        ventGeometry.coverRadius = Math.hypot(
          Math.max(ventGeometry.x, width - ventGeometry.x),
          Math.max(ventGeometry.y, height - ventGeometry.y)
        ) + 4;
        machineViewport.style.setProperty("--vent-x", `${ventGeometry.x.toFixed(2)}px`);
        machineViewport.style.setProperty("--vent-y", `${ventGeometry.y.toFixed(2)}px`);
        renderTraversal();
      };
      refreshTraversalGeometry = syncVentGeometry;

      gsap.set(monitor, {
        autoAlpha: 1,
        xPercent: -50,
        yPercent: -50,
        x: 0,
        y: 0,
        scale: 1,
        transformOrigin: "50% 75.25%"
      });
      gsap.set(footer, { autoAlpha: 1, y: 0 });
      gsap.set(nav, { autoAlpha: 1 });
      gsap.set(modelLabel, { autoAlpha: 1 });
      gsap.set(machineViewport, {
        autoAlpha: 1
      });
      gsap.set(journeyWindows, { autoAlpha: 0 });
      syncVentGeometry();

      const timeline = gsap.timeline({
        defaults: { overwrite: "auto" },
        paused: true
      });

      const createJourneyScrollTrigger = (scroller) => ScrollTrigger.create({
        animation: timeline,
        trigger: stage,
        scroller,
        start: "top top",
        end: "bottom bottom",
        scrub: .9,
        invalidateOnRefresh: true,
        onEnter: showJourney,
        onEnterBack: showJourney,
        // The terminal frame is the working planner, not a transition back
        // to the legacy page. Keep all three mechanical trays mounted until
        // the user explicitly chooses the detailed-planner handoff.
        onLeave: showJourney,
        // Progress zero is still the FAN-T111 entry frame. Leaving the
        // trigger backwards must not uncover the retired blue planner.
        onLeaveBack: showJourney,
        onUpdate(self) {
          const progress = self.progress;
          currentJourneyProgress = progress;
          overlay.style.setProperty("--monitor-progress", progress.toFixed(3));
          if (scrubber && document.activeElement !== scrubber) scrubber.value = String(Math.round(progress * 1000));
        },
        onRefresh() {
          renderMonitor();
          refreshTraversalGeometry();
          window.ConcourseTimetableMachine?.resize();
        }
      });

      timeline.eventCallback("onUpdate", () => setWindowAccess(timeline.time()));
      timeline
        .to(footer, {
          autoAlpha: 0,
          y: 18,
          duration: .11,
          ease: "power2.in"
        }, .12)
        .to(nav, {
          autoAlpha: 0,
          duration: .12,
          ease: "none"
        }, .13)
        .to(modelLabel, {
          autoAlpha: 0,
          duration: .08,
          ease: "none"
        }, .15)
        .to(traversalState, {
          progress: 1,
          duration: .81,
          ease: "none",
          onUpdate: renderTraversal
        }, .15)
        .to(courseWindow, { autoAlpha: 1, duration: .04, ease: "none" }, .75)
        .to(meetingWindow, { autoAlpha: 1, duration: .05, ease: "none" }, .84)
        .to(priorityWindow, { autoAlpha: 1, duration: .045, ease: "none" }, .91);

      activeScrollTrigger = createJourneyScrollTrigger(journeyScroller);
      currentJourneyProgress = clamp(activeScrollTrigger?.progress || 0, 0, 1);

      rebuildJourneyScroller = () => {
        const nextScroller = resolveJourneyScroller();
        if (nextScroller === journeyScroller) {
          journeyScrollerNeedsRebuild = false;
          pendingJourneyProgress = null;
          return false;
        }
        journeyScrollerNeedsRebuild = true;
        if (!Number.isFinite(pendingJourneyProgress)) {
          pendingJourneyProgress = clamp(
            Number.isFinite(activeScrollTrigger?.progress)
              ? activeScrollTrigger.progress
              : currentJourneyProgress,
            0,
            1
          );
        }
        if (
          staticFallbackActive
          || machineFailureIsPermanent
          || reducedMotion.matches
          || !motionViewport.matches
          || saveData
          || auditFrameEnabled
          || resultRouteIsActive()
        ) return false;

        // Capture the ScrollTrigger scalar before killing its old proxy. This
        // is the authored journey coordinate and is independent of either
        // container's pixel range or the scrub tween's momentary lag.
        const preservedProgress = pendingJourneyProgress;
        activeScrollTrigger?.kill(false, true);
        journeyScroller = nextScroller;

        // Pre-position the new container before ScrollTrigger reads it, then
        // refine against the trigger's exact refreshed start/end values. All
        // writes complete in one task, so no intermediate first-frame flash is
        // painted at progress zero.
        setScrollerProgress(preservedProgress, { scroller: journeyScroller });
        activeScrollTrigger = createJourneyScrollTrigger(journeyScroller);
        activeScrollTrigger.refresh();
        setScrollerProgress(preservedProgress, {
          scroller: journeyScroller,
          trigger: activeScrollTrigger
        });
        activeScrollTrigger.update();
        timeline.progress(preservedProgress, false);
        currentJourneyProgress = preservedProgress;
        journeyScrollerNeedsRebuild = false;
        pendingJourneyProgress = null;
        overlay.style.setProperty("--monitor-progress", preservedProgress.toFixed(3));
        if (scrubber && document.activeElement !== scrubber) {
          scrubber.value = String(Math.round(preservedProgress * 1000));
        }
        refreshTraversalGeometry();
        window.ConcourseTimetableMachine?.resize();
        return true;
      };

      const startPosition = journeyScroller === window ? window.scrollY : journeyScroller.scrollTop;
      if (startPosition <= 4 && plannerIsVisible()) showJourney();
      let auditFrameRequest = 0;
      const applyAuditTimelineFrame = () => {
        auditFrameRequest = 0;
        if (!auditFrameEnabled) return;
        const hashParameters = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        if (hashParameters.has("timetableAuditProgress")) {
          const nextProgress = Number(hashParameters.get("timetableAuditProgress"));
          if (Number.isFinite(nextProgress)) {
            auditTimelineProgress = clamp(nextProgress, 0, 1);
          }
        }
        // Drive the authored GSAP playhead rather than the Three scene alone.
        // This keeps the physical camera, aperture clip, DOM projection,
        // accessibility state and visible control carriers on one scalar.
        showJourney();
        timeline.progress(auditTimelineProgress, false);
        currentJourneyProgress = auditTimelineProgress;
        activeScrollTrigger?.disable(false);
        overlay.style.setProperty("--monitor-progress", auditTimelineProgress.toFixed(3));
        if (scrubber) scrubber.value = String(Math.round(auditTimelineProgress * 1000));
        overlay.dataset.auditTimelineProgress = auditTimelineProgress.toFixed(4);
        refreshTraversalGeometry();
        window.ConcourseTimetableMachine?.resize();
      };
      const handleAuditHashChange = () => {
        if (!auditFrameEnabled) return;
        window.cancelAnimationFrame(auditFrameRequest);
        auditFrameRequest = window.requestAnimationFrame(applyAuditTimelineFrame);
      };
      if (auditFrameEnabled) {
        window.addEventListener("hashchange", handleAuditHashChange);
        cleanupCallbacks.push(() => {
          window.cancelAnimationFrame(auditFrameRequest);
          window.removeEventListener("hashchange", handleAuditHashChange);
        });
      }
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        if (!auditFrameEnabled) return;
        // The captured frame uses the same authored GSAP timeline as normal
        // scroll. We only pin its scalar playhead and disable further scroll
        // reconciliation so the WebGL scene can become completely idle.
        applyAuditTimelineFrame();
      });
    }, overlay);

    const restoreMotionJourney = () => {
      if (!staticFallbackActive || machineFailureIsPermanent || !motionViewport.matches) return;
      staticFallbackActive = false;
      stage.classList.remove("is-static");
      projectionResizeObserver?.observe(overlay);
      journeyWindows.forEach((panel) => {
        projectionResizeObserver?.observe(panel);
        cachePanelProjectionSize(panel);
      });
      rebuildJourneyScroller();
      activeScrollTrigger?.enable();
      activeScrollTrigger?.refresh();
      if (scheduleIsVisible()) {
        syncMachinePresentation();
        return;
      }
      showJourney();
      setWindowAccess(activeScrollTrigger?.animation?.time() || 0);
      window.ConcourseTimetableMachine?.resize();
      window.ConcourseTimetableMachine?.setProgress(currentMachineProgress);
      window.ConcourseTimetableMachine?.setActive(plannerIsVisible());
    };

    const handleMotionViewportChange = (event) => {
      if (!event.matches) {
        initializeStaticFallback();
        return;
      }
      restoreMotionJourney();
    };
    motionViewport.addEventListener?.("change", handleMotionViewportChange);
    cleanupCallbacks.push(() => motionViewport.removeEventListener?.("change", handleMotionViewportChange));

    const handleJourneyScrollerViewportChange = () => {
      journeyScrollerNeedsRebuild = resolveJourneyScroller() !== journeyScroller;
      if (!journeyScrollerNeedsRebuild) {
        pendingJourneyProgress = null;
        return;
      }
      rebuildJourneyScroller();
    };
    journeyScrollerViewport.addEventListener?.("change", handleJourneyScrollerViewportChange);
    cleanupCallbacks.push(() => {
      journeyScrollerViewport.removeEventListener?.("change", handleJourneyScrollerViewportChange);
      activeScrollTrigger?.kill(false, true);
      rebuildJourneyScroller = () => false;
    });

    let reducedMotionFallbackActive = false;
    const handleReducedMotionChange = (event) => {
      if (event.matches) {
        reducedMotionFallbackActive = true;
        initializeStaticFallback();
        return;
      }
      reducedMotionFallbackActive = false;
      // Keep an already exposed result fallback stable. The full motion
      // journey is restored when the user returns to the planner route.
      if (!resultRouteIsActive()) restoreMotionJourney();
    };
    reducedMotion.addEventListener?.("change", handleReducedMotionChange);
    cleanupCallbacks.push(() => reducedMotion.removeEventListener?.("change", handleReducedMotionChange));

    let lastPlannerVisibility = plannerIsVisible();
    const refreshJourneyVisibility = () => {
      syncMachinePresentation();
      const isVisible = plannerIsVisible();
      if (isVisible === lastPlannerVisibility) return;
      lastPlannerVisibility = isVisible;
      if (!isVisible) {
        hideJourney();
        return;
      }
      if (!reducedMotionFallbackActive && staticFallbackActive && !machineFailureIsPermanent) {
        restoreMotionJourney();
      }
      if (journeyScrollerNeedsRebuild) rebuildJourneyScroller();
      activeScrollTrigger?.refresh();
      showJourney();
      setWindowAccess(activeScrollTrigger?.animation?.time() || 0);
    };

    const bodyObserver = new MutationObserver(refreshJourneyVisibility);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const workspaceObserver = new MutationObserver(refreshJourneyVisibility);
    workspaceObserver.observe(workspace, { attributes: true, attributeFilter: ["hidden"] });

    let resizeFrame = 0;
    const handleResize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        if (!projectionResizeObserver) {
          projectionViewport.width = Math.max(1, overlay.clientWidth || window.innerWidth);
          projectionViewport.height = Math.max(1, overlay.clientHeight || window.innerHeight);
          journeyWindows.forEach((panel) => cachePanelProjectionSize(panel));
          if (latestMachineAnchors) projectMachineAnchors(latestMachineAnchors);
        }
        renderMonitor();
        if (!journeyScrollerNeedsRebuild) activeScrollTrigger?.refresh();
      });
    };
    window.addEventListener("resize", handleResize, { passive: true });

    window.addEventListener("pagehide", () => {
      bodyObserver.disconnect();
      workspaceObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(resizeFrame);
      cleanupCallbacks.forEach((callback) => callback());
      gsapContext.revert();
      window.ConcourseTimetableMachine?.dispose();
    }, { once: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeSemesterJourney, { once: true });
  } else {
    initializeSemesterJourney();
  }
})();
