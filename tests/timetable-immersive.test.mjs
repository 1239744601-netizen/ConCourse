import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../timetable-immersive.css", import.meta.url), "utf8");
const client = readFileSync(new URL("../timetable-immersive.js", import.meta.url), "utf8");
const machine = readFileSync(new URL("../timetable-machine-3d.mjs", import.meta.url), "utf8");

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `Expected source marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(endIndex > startIndex, `Expected source marker after ${start}: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("the industrial monitor journey layers over the preserved planner", () => {
  const stabilizationStyle = html.indexOf("concourse-stabilization.css");
  const immersiveStyle = html.indexOf("timetable-immersive.css");
  const gsapScript = html.indexOf("vendor/gsap/gsap.min.js");
  const scrollTriggerScript = html.indexOf("vendor/gsap/ScrollTrigger.min.js");
  const machineScript = html.indexOf("timetable-machine-3d.mjs");
  const journeyScript = html.indexOf("timetable-immersive.js");

  assert.ok(stabilizationStyle > -1);
  assert.ok(immersiveStyle > stabilizationStyle);
  assert.ok(gsapScript > -1);
  assert.ok(scrollTriggerScript > gsapScript);
  assert.ok(machineScript > scrollTriggerScript);
  assert.ok(journeyScript > scrollTriggerScript);
  assert.match(html, /id="plannerScrollJourney"[^>]*data-visual-authority="industrial-monitor"/);
  assert.match(html, /class="planner-monitor-device"/);
  assert.match(html, /id="plannerMonitorScreen"/);
  assert.match(html, /id="plannerMonitorCanvas"/);
  assert.match(html, /id="plannerMachineCanvas"/);
  assert.match(html, /id="plannerMachineUiLayer"/);
  assert.match(html, /id="plannerJourneyScrubber"/);
  assert.match(html, /id="courseSelectionHandoffPanel"/);
  assert.match(html, /id="courseBuilderPanel"/);
  assert.match(html, /id="semesterPanel"/);
  assert.match(html, /id="wishlistPanel"/);
  assert.ok(existsSync(new URL("../concourse-timetable-monitor-blank-v1.png", import.meta.url)));
  assert.ok(existsSync(new URL("../concourse-timetable-machine-interior-v2.png", import.meta.url)));
  assert.ok(existsSync(new URL("../vendor/three/three.module.min.js", import.meta.url)));
  assert.ok(existsSync(new URL("../vendor/three/three.core.min.js", import.meta.url)));
});

test("the unrendered and Beta profiles default to a local-only Timetable preview", () => {
  assert.match(html, /const CONCOURSE_BUILD_PROFILE = "__CONCOURSE_BUILD_PROFILE__";/u);
  assert.match(html, /const CONCOURSE_SAFE_PREVIEW = CONCOURSE_BUILD_PROFILE !== "production";/u);
  assert.match(html, /<!-- __CONCOURSE_SUPABASE_SDK__ -->/u);
  assert.match(html, /!CONCOURSE_SAFE_PREVIEW &&\s*\/\^https:/u);
  assert.match(html, /document\.documentElement\.dataset\.concoursePreview = "timetable";/u);
  assert.match(html, /\$\("authModal"\)\.inert = true;/u);
  assert.match(html, /\$\("courseSearchNav"\)\.hidden = true;/u);
  assert.match(html, /\$\("saveFinalTimetable"\)\.hidden = true;/u);
  assert.match(html, /profileButton\.hidden = true;/u);
  assert.ok(
    html.indexOf("if(CONCOURSE_SAFE_PREVIEW){", html.indexOf("function initializeAccount"))
      < html.indexOf("rememberVerificationEmail(restoreVerificationEmail());", html.indexOf("function initializeAccount")),
    "preview initialization exits before account restoration"
  );
});

test("the three physical control trays retain all 36 planner conditions and workflows", () => {
  const conditionControlIds = [
    "journeyCourseName",
    "journeyCourseCode",
    "journeyCourseProfessor",
    "journeyCourseCredits",
    "journeyCourseRequired",
    "journeySessionsPerWeek",
    "journeyMultipleOptions",
    "journeyStart",
    "journeyEnd",
    "journeyDegreeLevel",
    "journeyStudyYear",
    "journeyMinCredits",
    "journeyMaxCredits",
    "journeyCountFewest",
    "journeyCountExact",
    "journeyExactN",
    "journeyFreeCount",
    "journeyCompact",
    "journeyFewDays",
    "journeyNoEarly",
    "journeyEarlyTime",
    "journeyNoLate",
    "journeyLateTime",
    "journeyBreakStart",
    "journeyBreakEnd"
  ];
  const meetingDays = html.match(/data-journey-day="[1-6]"/gu) || [];
  const freeDays = html.match(/data-journey-free-day="[1-5]"/gu) || [];

  assert.equal(conditionControlIds.length + meetingDays.length + freeDays.length, 36);
  for (const id of conditionControlIds) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "gu")) || []).length, 1, id);
  }
  assert.equal(meetingDays.length, 6);
  assert.equal(freeDays.length, 5);

  for (const id of [
    "journeyAddCourse",
    "journeyCourseWishlist",
    "journeyAddSession",
    "journeyPendingSessions",
    "journeyOptionArea",
    "journeySaveOption",
    "journeySavedOptions",
    "journeySessionHint",
    "journeyAddBreak",
    "journeyBreakList",
    "journeyGenerate",
    "journeyContinue",
    "plannerJourneyStatus"
  ]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "gu")) || []).length, 1, id);
  }
  assert.equal((html.match(/data-journey-window=/gu) || []).length, 3);
  assert.equal((html.match(/data-journey-scroll/gu) || []).length, 3);
  for (const [journeyId, plannerId] of [
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
  ]) {
    assert.match(client, new RegExp(`\\["${journeyId}", "${plannerId}"\\]`, "u"));
  }
  for (const [journeyId, plannerId] of [
    ["journeyCourseRequired", "cReq"],
    ["journeyMultipleOptions", "cMulti"],
    ["journeyCompact", "pCompact"],
    ["journeyFewDays", "pFewDays"],
    ["journeyNoEarly", "pNoEarly"],
    ["journeyNoLate", "pNoLate"]
  ]) {
    assert.match(client, new RegExp(`\\["${journeyId}", "${plannerId}"\\]`, "u"));
  }
  assert.match(client, /input\[name="journeyCountMode"\]/);
  assert.match(client, /input\[name="countMode"\]/);
  assert.match(client, /plannerGroupId: "dayPicker"/);
  assert.match(client, /plannerGroupId: "freeDayPicker"/);
  assert.match(client, /mirrorDynamicList\("pendingSlots", "journeyPendingSessions"\)/);
  assert.match(client, /mirrorDynamicList\("savedOptions", "journeySavedOptions"\)/);
  assert.match(client, /mirrorDynamicList\("breakList", "journeyBreakList"\)/);
  assert.match(client, /forwardPlannerAction\("journeyAddSession", "addSlot"/);
  assert.match(client, /forwardPlannerAction\("journeySaveOption", "saveOption"/);
  assert.match(client, /forwardPlannerAction\("journeyAddBreak", "addBreak"\)/);
  assert.match(client, /forwardPlannerAction\("journeyGenerate", "generate"/);
  assert.match(client, /window\.addCourseFromBuilder\(\) === true/);
  assert.match(client, /if \(!courseWasAdded\)/);
  assert.match(client, /renderJourneyWishlist/);
  assert.match(client, /courseBuilderPanel/);
});

test("terminal carriers remain attached and reach a fully open working state", () => {
  const terminalAssembly = sourceBetween(
    machine,
    "createTerminalCarrierBay(\"course\"",
    "\n  // Exposed reduction gears"
  );
  const mechanisms = sourceBetween(
    machine,
    "function updateMechanisms(progress) {",
    "\nfunction updateSparks(progress) {"
  );

  for (const { prefix, carrierName, axis } of [
    { prefix: "course", carrierName: "course", axis: "y" },
    { prefix: "meeting", carrierName: "meeting", axis: "y" },
    { prefix: "priority", carrierName: "priorities", axis: "x" }
  ]) {
    assert.match(terminalAssembly, new RegExp(`createTerminalCarrierBay\\("${carrierName}"`, "u"));
    assert.match(terminalAssembly, new RegExp(`${prefix}Hinge\\.name = "${carrierName}-terminal-hinge"`, "u"));
    assert.match(terminalAssembly, new RegExp(`${prefix}Extract\\.name = "${carrierName}-telescoping-carriage"`, "u"));
    assert.match(terminalAssembly, new RegExp(`${prefix}Carrier = createCarrier\\("${carrierName}"`, "u"));
    assert.match(terminalAssembly, new RegExp(`scene\\.remove\\(${prefix}Carrier\\)[\\s\\S]*?${prefix}Extract\\.add\\(${prefix}Carrier\\)[\\s\\S]*?${prefix}Hinge\\.add\\(${prefix}Extract\\)[\\s\\S]*?scene\\.add\\(${prefix}Hinge\\)`, "u"));

    const openPhase = mechanisms.match(new RegExp(`const ${prefix}Open = smoothstep\\(([-.\\d]+), ([-.\\d]+), progress\\)(?: \\* plannerHingePermission)?;`, "u"));
    const reachPhase = mechanisms.match(new RegExp(`const ${prefix}Reach = smoothstep\\(([-.\\d]+), ([-.\\d]+), progress\\)(?: \\* plannerReachPermission)?;`, "u"));
    const openRotation = mechanisms.match(new RegExp(`${prefix}Hinge\\.rotation\\.${axis} = THREE\\.MathUtils\\.lerp\\(([-.\\d]+), ([-.\\d]+), ${prefix}Open\\);`, "u"));
    assert.ok(openPhase, `${prefix} has an open phase`);
    assert.ok(reachPhase, `${prefix} has an extraction phase`);
    assert.ok(openRotation, `${prefix} has an open rotation target`);
    assert.ok(Number(openPhase[2]) < 1, `${prefix} finishes opening before progress 1`);
    assert.ok(Number(reachPhase[2]) < 1, `${prefix} finishes extracting before progress 1`);
    assert.ok(
      Math.abs(Number(openRotation[2])) < Math.abs(Number(openRotation[1])) * .15,
      `${prefix} finishes substantially more open than its folded state`
    );
    assert.match(mechanisms, new RegExp(`${prefix}Extract\\.position\\.z = THREE\\.MathUtils\\.lerp\\([\\s\\S]*?${prefix}Reach\\);`, "u"));
  }

  // The wider pressure wells stay physically bounded by the terminal frame.
  // Aperture width is carrier width less the retained .84-unit bezel.
  assert.match(terminalAssembly, /createTerminalCarrierBay\("course", -1\.91, 1\.93, 3\.49, 3\.64\)/);
  assert.match(terminalAssembly, /createTerminalCarrierBay\("meeting", 1\.98, 2\.08, 3\.83, 3\.9\)/);
  assert.match(terminalAssembly, /createTerminalCarrierBay\("priorities", 0, -1\.98, 5\.05, 3\.92\)/);
  assert.match(terminalAssembly, /createCarrier\("course", 3\.22, 3\.39, "left"\)/);
  assert.match(terminalAssembly, /createCarrier\("meeting", 3\.56, 3\.65, "right"\)/);
  assert.match(terminalAssembly, /createCarrier\("priorities", 4\.79, 3\.64, "bottom"\)/);

  const courseAperture = 3.22 - .84;
  const meetingAperture = 3.56 - .84;
  const prioritiesAperture = 4.79 - .84;
  assert.ok(courseAperture / (2.85 - .84) >= 1.15 && courseAperture / (2.85 - .84) <= 1.25);
  assert.ok(meetingAperture / (3.05 - .84) >= 1.2 && meetingAperture / (3.05 - .84) <= 1.25);
  assert.ok(prioritiesAperture / (4.5 - .84) >= 1.05 && prioritiesAperture / (4.5 - .84) <= 1.1);

  const courseCarrierRight = -1.91 + (3.22 + .22) * .5;
  const meetingCarrierLeft = 1.98 - (3.56 + .22) * .5;
  const prioritiesCarrierHalfWidth = (4.79 + .22) * .5;
  assert.ok(courseCarrierRight < -.13, "course flange clears the left edge of the central spine");
  assert.ok(meetingCarrierLeft > .05, "meeting flange clears the right edge of the central spine");
  assert.ok(prioritiesCarrierHalfWidth < 2.56,
    "priorities flange clears the inner edges of both lower frame posts");

  assert.match(machine, /const normalized = clamp\(\(value - edge0\) \/ Math\.max\([\s\S]*?return normalized \* normalized/);
  assert.match(machine, /function setProgress\(progress\) \{\s*currentProgress = clamp\(Number\(progress\) \|\| 0\)/);
  assert.match(client, /\.to\(traversalState, \{\s*progress: 1,[\s\S]*?ease: "none"/);
  const terminalAccess = client.match(/if \(progress >= ([-.\d]+)\) availableCount = 3/);
  assert.ok(terminalAccess);
  assert.ok(Number(terminalAccess[1]) < 1, "all three panels unlock before terminal progress 1");
});

test("the generated timetable rises on a fourth physical carrier after the planner trays retract", () => {
  const resultLiftAssembly = sourceBetween(
    machine,
    "function createResultTerminalLift() {",
    "\nfunction createTerminalCarrierBay"
  );
  const mechanisms = sourceBetween(
    machine,
    "function updateMechanisms(progress) {",
    "\nfunction updateSparks(progress) {"
  );
  const modeController = sourceBetween(
    machine,
    "function setMode(mode) {",
    "\nfunction setActive"
  );
  const anchorProjection = sourceBetween(
    machine,
    "function dispatchProjectedAnchors() {",
    "\nfunction shouldRunContinuousMotion"
  );

  assert.match(machine, /const RESULT_TERMINAL = Object\.freeze\(\{[\s\S]*?width: 10\.9,[\s\S]*?height: 7\.2,[\s\S]*?stowedY: -9\.3,[\s\S]*?dockedY: -\.08/);
  assert.match(resultLiftAssembly, /resultLift\.name = "result-terminal-lift-carriage"/);
  assert.match(resultLiftAssembly, /resultCarrier = createCarrier\(\s*"result"/);
  assert.match(resultLiftAssembly, /`result-terminal-guide-\$\{side < 0 \? "left" : "right"\}`/);
  assert.match(resultLiftAssembly, /result-terminal-lead-screw/);
  assert.match(resultLiftAssembly, /helicalThreadGeometry\([\s\S]*?RESULT_TERMINAL\.screwLead/);
  assert.match(resultLiftAssembly, /resultLeadScrews\.push\(\{ node: screwAssembly, handedness: side \}\)/);
  assert.match(resultLiftAssembly, /bearingHousing\.rotation\.x = Math\.PI \/ 2/);
  assert.match(resultLiftAssembly, /innerWidth: \.28,[\s\S]*?innerHeight: \.28,[\s\S]*?result-terminal-screw-bearing-housing/);
  assert.match(resultLiftAssembly, /torusGeometry\(\.11, \.024, 10, 34\)/);
  assert.match(resultLiftAssembly, /result-terminal-ball-nut-body/);
  assert.match(resultLiftAssembly, /result-terminal-nut-dogleg-bridge/);
  assert.match(resultLiftAssembly, /slideShoe\.name = "result-terminal-recirculating-slide"/);
  assert.match(resultLiftAssembly, /slideShoe\.rotation\.x = Math\.PI \/ 2/);
  assert.match(resultLiftAssembly, /for \(const y of \[-2\.64, 2\.64\]\)/);
  assert.match(resultLiftAssembly, /innerWidth: \.22,[\s\S]*?innerHeight: \.3,[\s\S]*?depth: \.66/);
  assert.match(resultLiftAssembly, /result-terminal-lower-saddle/);

  assert.match(mechanisms, /plannerHingePermission = 1 - smoothstep\(\.02, \.18, resultModeBlend\)/);
  assert.match(mechanisms, /plannerReachPermission = 1 - smoothstep\(\.22, \.34, resultModeBlend\)/);
  assert.match(mechanisms, /plannerReleasePermission = 1 - smoothstep\(\.3, \.4, resultModeBlend\)/);
  assert.match(mechanisms, /resultLiftProgress = smoothstep\(\.46, \.96, resultModeBlend\)/);
  assert.match(mechanisms, /const liftY = THREE\.MathUtils\.lerp\([\s\S]*?RESULT_TERMINAL\.stowedY,[\s\S]*?RESULT_TERMINAL\.dockedY,[\s\S]*?resultLiftProgress[\s\S]*?resultLift\.position\.y = liftY/);
  assert.match(mechanisms, /const screwAngle = liftTravel \/ RESULT_TERMINAL\.screwLead \* Math\.PI \* 2[\s\S]*?node\.rotation\.y = screwAngle \* handedness/);
  assert.match(resultLiftAssembly, /result-terminal-lubrication-pump-bed/);
  assert.match(resultLiftAssembly, /result-terminal-pump-driver-14t/);
  assert.match(resultLiftAssembly, /result-terminal-pump-driven-10t/);
  assert.match(mechanisms, /resultSparkDriverGear\.rotation\.z = pumpAngle[\s\S]*?resultSparkDrivenGear\.rotation\.z = Math\.PI \/ 10 - pumpAngle \* 14 \/ 10/);
  assert.match(modeController, /resultModeTarget = normalizedMode === "result" \? 1 : 0/);
  assert.match(modeController, /modeChanged = resultModeTarget !== previousModeTarget/);
  assert.match(modeController, /if \(!modeChanged && !needsTerminalCamera\) return/);
  assert.match(machine, /resultModeBlend \+ direction \* frameDelta \/ 1\.35/);
  assert.match(machine, /window\.ConcourseTimetableMachine = Object\.freeze\(\{\s*setProgress,\s*setMode,/);

  assert.match(anchorProjection, /name === "result"[\s\S]*?resultModeTarget === 1 && resultModeBlend >= \.965/);
  assert.match(anchorProjection, /resultModeTarget === 0 && resultModeBlend <= \.42/);
});

test("the threaded result lift preserves physical clearances through 10,001 forward and reverse samples", () => {
  const smoothstepSample = (edge0, edge1, value) => {
    const normalized = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return normalized * normalized * (3 - 2 * normalized);
  };
  const stowedY = -9.3;
  const dockedY = -.08;
  const screwLead = .22;
  const guideMinimumY = -3.9 - (18.3 - .34) * .5;
  const guideMaximumY = -3.9 + (18.3 - .34) * .5;
  const nutLocalY = -1.95;
  let previousLiftY = stowedY;
  let finalScrewAngle = 0;

  for (let sample = 0; sample <= 10_000; sample += 1) {
    const blend = sample / 10_000;
    const liftProgress = smoothstepSample(.46, .96, blend);
    const liftY = stowedY + (dockedY - stowedY) * liftProgress;
    const nutWorldY = liftY + nutLocalY;
    const screwAngle = (liftY - stowedY) / screwLead * Math.PI * 2;
    assert.ok(liftY >= previousLiftY - 1e-12, `lift never reverses at forward sample ${sample}`);
    assert.ok(nutWorldY > guideMinimumY + .2, `nut clears lower bearing at sample ${sample}`);
    assert.ok(nutWorldY < guideMaximumY - .2, `nut clears upper bearing at sample ${sample}`);
    previousLiftY = liftY;
    finalScrewAngle = screwAngle;
  }

  for (let sample = 10_000; sample >= 0; sample -= 1) {
    const blend = sample / 10_000;
    const liftProgress = smoothstepSample(.46, .96, blend);
    const liftY = stowedY + (dockedY - stowedY) * liftProgress;
    const screwAngle = (liftY - stowedY) / screwLead * Math.PI * 2;
    assert.ok(screwAngle <= finalScrewAngle + 1e-12, `reverse screw angle stays bounded at ${sample}`);
    finalScrewAngle = screwAngle;
  }
  assert.ok(Math.abs(finalScrewAngle) < 1e-12, "reverse motion returns both screws to their exact zero phase");

  assert.ok(.17 * .5 > .074, "ball-nut x opening clears the thread outside radius");
  assert.ok(.19 * .5 > .074, "ball-nut z opening clears the thread outside radius");
  assert.ok(.28 * .5 > .11 + .024, "bearing housing bore clears its seated race");
  assert.ok(.11 - .024 > .074, "bearing race clears the lead-screw thread");
  assert.ok(.22 > .16, "slide-shoe x opening clears the guide width");
  assert.ok(.3 > .24, "slide-shoe z opening clears the guide depth");
  assert.ok(5.94 > 5.82 + .16 * .5, "outboard dog-leg misses the guide in x");
  assert.ok(5.64 < 5.82 - .16 * .5, "inboard dog-leg misses the guide in x");
  assert.ok(.08 - .16 * .5 > -.36 + .24 * .5, "bridge crosses only in front of the guide z envelope");
  assert.ok(-3.78 - .3 * .5 > -4.2 + .21 * 1.04, "pump driver stays below the lower saddle");
  assert.ok(4.84 - .54 * .5 > 4.32 + .15 * 1.04, "pump pinion clears the docking foot");
  assert.equal(Number((4.32 - 3.96).toFixed(2)), Number((.21 + .15).toFixed(2)), "pump pitch circles meet at one causal contact point");
});

test("the hyperreal terminal keeps mechanical motion without redundant GPU or DOM work", () => {
  const renderLoop = sourceBetween(
    machine,
    "function shouldRunContinuousMotion() {",
    "\nfunction requestRender()"
  );
  const setters = sourceBetween(
    machine,
    "function setProgress(progress) {",
    "\nfunction dispose()"
  );
  const cameraLighting = sourceBetween(
    machine,
    "function updateCamera(progress) {",
    "\nfunction dispatchProjectedAnchors()"
  );
  const programWarmup = sourceBetween(
    machine,
    "function cancelProgramWarmup(reset = false) {",
    "\nfunction renderNow()"
  );

  assert.match(renderLoop, /stableResultMode = resultModeTarget === 1[\s\S]*?currentProgress >= \.64/);
  assert.match(renderLoop, /stablePlannerTerminal = resultModeTarget === 0[\s\S]*?currentProgress >= \.64/);
  assert.match(renderLoop, /settledFrameRate = stableResultMode \? 24 : \(stablePlannerTerminal \? 30 : 0\)/);
  assert.match(renderLoop, /frameTimestamp \+ \.5 < settledRenderDeadline/);
  assert.match(renderLoop, /const settledInterval = 1000 \/ settledFrameRate[\s\S]*?settledRenderDeadline \+= settledInterval/);
  assert.match(renderLoop, /function scheduleContinuousFrame[\s\S]*?window\.setTimeout[\s\S]*?\}, 6\)/);
  assert.match(renderLoop, /frameDelta = continuousMotion[\s\S]*?frameElapsed \/ 1000/);
  assert.match(renderLoop, /if \(continuousMotion\) scheduleContinuousFrame\(settledFrameRate\)/);
  assert.match(renderLoop, /if \(projectionDirty\) \{\s*dispatchProjectedAnchors\(\);\s*projectionDirty = false/);
  assert.match(machine, /projectionDirty = true;[\s\S]*?function updateResultMode/);
  assert.match(setters, /Math\.abs\(currentProgress - lastRequestedProgress\) <= 1e-7/);
  assert.match(setters, /if \(!modeChanged && !needsTerminalCamera\) return/);
  assert.match(setters, /if \(nextActive === isActive\) return/);

  assert.doesNotMatch(cameraLighting, /\.visible\s*=/);
  assert.match(cameraLighting, /frontKey\.castShadow = frontKey\.intensity > \.001/);
  assert.match(cameraLighting, /thresholdLight\.castShadow = false/);
  assert.match(cameraLighting, /terminalKeyLight\.castShadow = terminalKeyLight\.intensity > \.001/);
  assert.match(cameraLighting, /routePhaseLights\.forEach\([\s\S]*?light\.intensity = peak \* windowedPhase\(progress, \.\.\.window\)/);
  assert.match(cameraLighting, /terminalLeftSoftbox\.intensity = 38 \* terminalReveal/);
  assert.match(cameraLighting, /terminalLeftPortalLight\.intensity = 0/);
  const terminalExposure = Number(cameraLighting.match(
    /toneMappingExposure = THREE\.MathUtils\.lerp\(\.97, (\d+(?:\.\d+)?)/u
  )?.[1]);
  const terminalFog = Number(cameraLighting.match(
    /scene\.fog\.density = THREE\.MathUtils\.lerp\(\.0036, (\.\d+)/u
  )?.[1]);
  assert.ok(terminalExposure >= 1.18 && terminalExposure <= 1.35,
    "terminal exposure reveals reference-grade steel midtones without bleaching the exterior");
  assert.ok(terminalFog >= .0045 && terminalFog <= .006,
    "terminal haze retains depth without swallowing the precision hardware");
  assert.match(cameraLighting, /const terminalFov = THREE\.MathUtils\.lerp\(65, 82, portraitFraming\)/);
  assert.match(programWarmup, /requestIdleCallback\(compilePrograms, \{ timeout: 1200 \}\)/);
  assert.match(programWarmup, /typeof renderer\.compileAsync === "function"[\s\S]*?renderer\.compileAsync\(scene, camera\)/);
  assert.match(programWarmup, /else \{\s*renderer\.compile\(scene, camera\);\s*markReady\(\)/);
  assert.match(programWarmup, /cancelIdleCallback\(programWarmupRequest\)/);
  assert.match(machine, /function dispose\(\) \{[\s\S]*?cancelProgramWarmup\(\)/);
  assert.match(machine, /function handleContextLost\(event\) \{[\s\S]*?cancelProgramWarmup\(true\)/);
  assert.match(machine, /function handleContextRestored\(\) \{[\s\S]*?scheduleProgramWarmup\(\)/);
  assert.match(machine, /rendererStableFps = "30"[\s\S]*?rendererResultStableFps = "24"/);
  assert.match(machine, /mesh\.castShadow = volume > \.05 && Math\.max\(\.\.\.size\) > \.5/);
  assert.match(machine, /mesh\.castShadow = ringVolume > \.035 && Math\.max\(outerWidth, outerHeight\) > \.5/);
  assert.match(machine, /const pixelBudget = 3200000[\s\S]*?Math\.min\(devicePixelRatio, 1\.55, budgetPixelRatio\)/);
  assert.doesNotMatch(machine, /(?:courseSpill|meetingSpill|prioritiesSpill|resultSpill|sparkLight)\.visible\s*=/);
  assert.match(machine, /courseSpill\.intensity = 5\.4 \* courseReach/);
  assert.match(machine, /gl_PointSize = \(3\.1 \+ 6\.4 \* aLife\)/);
  assert.match(machine, /const opacity = burst \* \.88/);
  assert.match(machine, /sparkTrailMaterial\.opacity = Math\.min\(\.88, burst \* \.9\)/);
  assert.match(machine, /sparkLight\.intensity = burst \* 6\.4/);

  assert.doesNotMatch(styles, /schedule-active[^{]*#appWrap\s*\{[^}]*\bfilter\s*:/u);
  assert.match(client, /if \(resultRouteIsActive\(\)\) \{[\s\S]*?projectResultSurface\(anchors\);[\s\S]*?return;/);
  assert.match(client, /setInlineStyleValue\(panel, "--machine-quad-transform", quadMatrix\)/);
});

test("the monitor is driven by planner and finalized timetable state", () => {
  assert.match(html, /window\.getConcoursePlannerSnapshot = \(\) =>/);
  assert.match(html, /concourse:planner-courses-changed/);
  assert.match(html, /concourse:timetable-rendered/);
  assert.match(client, /blocksFromPlannerCourses/);
  assert.match(client, /blocksFromFinalTimetable/);
  assert.match(client, /latestPlannerCourses/);
  assert.match(client, /latestFinalTimetable/);
  assert.match(client, /const realBlocks = finalBlocks\.length \? finalBlocks : plannerBlocks/);
  assert.match(client, /const baseBlocks = realBlocks\.length \? realBlocks : \[\.\.\.DEMO_BLOCKS\]/);
  assert.match(client, /currentPreviewBlocks/);
  assert.match(client, /monitorCanvas\.replaceChildren\(\)/);
  assert.match(client, /planner-monitor-course-block/);
  assert.match(client, /concourse:planner-state-applied/);
});

test("the scroll journey drives one continuous real-time 3D camera", () => {
  assert.match(client, /gsap\.registerPlugin\(ScrollTrigger\)/);
  assert.match(client, /trigger: stage/);
  assert.match(client, /scroller: journeyScroller/);
  assert.match(client, /scrub: \.9/);
  assert.match(client, /ConcourseTimetableMachine\?\.setProgress/);
  assert.match(client, /const traversalState = \{ progress: 0 \}/);
  assert.match(client, /const syncVentGeometry = \(\) =>/);
  assert.match(client, /machineViewport\.style\.clipPath = `ellipse\(/);
  assert.match(client, /currentMachineProgress = clamp\(/);
  assert.match(client, /scale: 13\.5/);
  assert.match(client, /gsap\.context\(/);
  assert.match(client, /setScrollerProgress/);
  assert.doesNotMatch(client, /addEventListener\("wheel"/);
  assert.match(client, /const skipImmersiveJourney = \(event\) => \{\s*event\.preventDefault\(\)/);
  assert.doesNotMatch(client, /back\.out/);
  assert.match(machine, /PerspectiveCamera/);
  assert.match(machine, /CatmullRomCurve3/);
  assert.match(machine, /const CAMERA_PROGRESS_STATIONS = Object\.freeze\(\[/);
  assert.match(machine, /function createMonotoneTangents\(stations\)/);
  assert.match(machine, /function mapCameraProgress\(progress\) \{[\s\S]*?CAMERA_PROGRESS_TANGENTS/);
  assert.match(machine, /viewport\.dataset\.cameraPathProgress = pathProgress\.toFixed\(4\)/);
  assert.doesNotMatch(machine, /CAMERA_BEATS/);
  assert.match(machine, /setProgress/);
  assert.match(machine, /concourse:timetable-machine-anchors/);
  assert.match(client, /prefers-reduced-motion: reduce/);
  assert.match(client, /initializeStaticFallback/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.planner-machine-viewport\.is-webgl \{\s*clip-path: none !important;/);
});

test("native scrolling is the only journey controller and the footer rail is read-only progress", () => {
  assert.match(html, /<progress id="plannerJourneyScrubber" max="1000" value="0"/);
  assert.doesNotMatch(html, /id="plannerJourneyScrubber" type="range"/);
  assert.doesNotMatch(client, /handleScrubberInput|scrubber\?\.addEventListener\("input"/);
  assert.match(styles, /\.planner-monitor-scrubber \{[\s\S]*?pointer-events: none/);
  assert.match(styles, /#plannerJourneyScrubber::-(?:webkit-progress-value|moz-progress-bar)/);
  assert.match(client, /scrubber\.value = String\(Math\.round\(progress \* 1000\)\)/);
  assert.doesNotMatch(client, /addEventListener\("wheel"/);
});

test("one deterministic audit document can advance every GSAP and mechanical frame through URL fragments", () => {
  const auditTimeline = sourceBetween(
    client,
    "let auditFrameRequest = 0;",
    "\n      requestAnimationFrame(() => {"
  );
  const auditMachine = sourceBetween(
    machine,
    "function readAuditHashState() {",
    "\nfunction renderNow()"
  );
  const renderLoop = sourceBetween(
    machine,
    "function renderNow() {",
    "\nfunction requestRender()"
  );

  assert.match(client, /auditParameters\.has\("timetableAuditProgress"\)/);
  assert.match(auditTimeline, /new URLSearchParams\(window\.location\.hash\.replace/);
  assert.match(auditTimeline, /timeline\.progress\(auditTimelineProgress, false\)/);
  assert.match(auditTimeline, /overlay\.dataset\.auditTimelineProgress = auditTimelineProgress\.toFixed\(4\)/);
  assert.match(auditTimeline, /window\.addEventListener\("hashchange", handleAuditHashChange\)/);
  assert.match(auditTimeline, /removeEventListener\("hashchange", handleAuditHashChange\)/);

  assert.match(machine, /auditParameters\.has\("timetableAuditTime"\)/);
  assert.match(machine, /auditParameters\.has\("timetableAuditResultBlend"\)/);
  assert.match(auditMachine, /hashParameters\.has\("timetableAuditTime"\)/);
  assert.match(auditMachine, /hashParameters\.has\("timetableAuditResultBlend"\)/);
  assert.match(auditMachine, /machineRunTime = auditFrameTime[\s\S]*?sparkRunTime = auditFrameTime/);
  assert.match(auditMachine, /viewport\.dataset\.auditFrameReady = "0"/);
  assert.match(renderLoop, /if \(auditFrameEnabled\) \{[\s\S]*?sparkRunTime = auditFrameTime;[\s\S]*?machineRunTime = auditFrameTime/);
  assert.match(machine, /window\.addEventListener\("hashchange", handleAuditHashChange\)/);
  assert.match(machine, /window\.removeEventListener\("hashchange", handleAuditHashChange\)/);
});

test("the Timetable-only journey uses the document wheel while compatibility routes can rebuild their scroller", () => {
  const scrollerSelection = sourceBetween(
    client,
    'const journeyScrollerViewport = window.matchMedia("(min-width: 1051px)");',
    "\n    const initialSnapshot"
  );
  const triggerLifecycle = sourceBetween(
    client,
    "const createJourneyScrollTrigger = (scroller) => ScrollTrigger.create({",
    "\n\n      const startPosition"
  );
  const responsiveLifecycle = sourceBetween(
    client,
    "const restoreMotionJourney = () => {",
    "\n    let reducedMotionFallbackActive = false;"
  );

  assert.match(scrollerSelection, /const resolveJourneyScroller = \(\) => \([\s\S]*?planner-journey-active[\s\S]*?\? window[\s\S]*?journeyScrollerViewport\.matches[\s\S]*?\? configurator[\s\S]*?: window[\s\S]*?\)/);
  assert.match(scrollerSelection, /let journeyScroller = resolveJourneyScroller\(\)/);
  assert.match(scrollerSelection, /let currentJourneyProgress = 0/);
  assert.match(scrollerSelection, /const normalizedProgress = clamp\(Number\(progress\) \|\| 0, 0, 1\)/);
  assert.match(scrollerSelection, /Number\.isFinite\(trigger\?\.start\)[\s\S]*?Number\.isFinite\(trigger\?\.end\)/);

  assert.match(triggerLifecycle, /animation: timeline,[\s\S]*?scroller,[\s\S]*?scrub: \.9/);
  assert.match(triggerLifecycle, /currentJourneyProgress = progress/);
  assert.match(triggerLifecycle, /if \(!Number\.isFinite\(pendingJourneyProgress\)\) \{[\s\S]*?activeScrollTrigger\?\.progress[\s\S]*?currentJourneyProgress/);
  assert.match(triggerLifecycle, /const preservedProgress = pendingJourneyProgress/);
  assert.match(triggerLifecycle, /activeScrollTrigger\?\.kill\(false, true\);\s*journeyScroller = nextScroller/);
  assert.match(triggerLifecycle, /setScrollerProgress\(preservedProgress, \{ scroller: journeyScroller \}\);\s*activeScrollTrigger = createJourneyScrollTrigger\(journeyScroller\);\s*activeScrollTrigger\.refresh\(\);\s*setScrollerProgress\(preservedProgress, \{\s*scroller: journeyScroller,\s*trigger: activeScrollTrigger/);
  assert.match(triggerLifecycle, /activeScrollTrigger\.update\(\);\s*timeline\.progress\(preservedProgress, false\);\s*currentJourneyProgress = preservedProgress/);

  assert.match(responsiveLifecycle, /rebuildJourneyScroller\(\);\s*activeScrollTrigger\?\.enable\(\)/);
  assert.match(responsiveLifecycle, /const handleJourneyScrollerViewportChange = \(\) => \{\s*journeyScrollerNeedsRebuild = resolveJourneyScroller\(\) !== journeyScroller;[\s\S]*?if \(!journeyScrollerNeedsRebuild\) \{[\s\S]*?pendingJourneyProgress = null;[\s\S]*?return;[\s\S]*?\}[\s\S]*?rebuildJourneyScroller\(\)/);
  assert.match(responsiveLifecycle, /journeyScrollerViewport\.addEventListener\?\.\("change", handleJourneyScrollerViewportChange\)/);
  assert.match(responsiveLifecycle, /journeyScrollerViewport\.removeEventListener\?\.\("change", handleJourneyScrollerViewportChange\)/);
  assert.doesNotMatch(responsiveLifecycle, /window\.location\.reload/);
});

test("responsive scroller reconstruction defers fallbacks and cannot mutate result presentation or focus", () => {
  const triggerLifecycle = sourceBetween(
    client,
    "rebuildJourneyScroller = () => {",
    "\n\n      const startPosition"
  );
  const traversalRenderer = sourceBetween(
    client,
    "const renderTraversal = () => {",
    "\n\n      const syncVentGeometry"
  );

  assert.match(triggerLifecycle, /staticFallbackActive[\s\S]*?machineFailureIsPermanent[\s\S]*?reducedMotion\.matches[\s\S]*?!motionViewport\.matches[\s\S]*?saveData[\s\S]*?auditFrameEnabled[\s\S]*?resultRouteIsActive\(\)[\s\S]*?return false/);
  assert.doesNotMatch(triggerLifecycle, /setResultPresentationState|clearResultProjection|projectResultSurface|transferResultFocus|syncMachinePresentation|\.focus\(/);
  assert.match(traversalRenderer, /if \(!resultRouteIsActive\(\)\) \{\s*window\.ConcourseTimetableMachine\?\.setProgress\(currentMachineProgress\)/);
});

test("route handoffs switch symmetrically between the immersive machine and detailed planner", () => {
  const editor = sourceBetween(
    html,
    "function showPlannerEditor(){",
    "\nfunction openTimetableDestination(){"
  );
  const bridge = sourceBetween(
    client,
    "const revealDetailedPlannerFromRoute = () => {",
    "\n    const forwardPlannerAction"
  );
  const validation = sourceBetween(
    client,
    "const restoreJourneyValidationFocus = () => {",
    "\n    forwardPlannerAction(\"journeyGenerate\""
  );

  assert.match(editor, /if\(detailed\)\{[\s\S]*?classList\.add\("planner-detailed-active"\)[\s\S]*?classList\.remove\("planner-journey-active"\)/u);
  assert.match(editor, /else \{\s*document\.body\.classList\.remove\("planner-detailed-active"\)/u);
  assert.match(editor, /concourse:timetable-show-detailed-planner/);
  assert.match(editor, /concourse:timetable-show-immersive-planner/);
  assert.match(bridge, /revealDetailedPlannerFromRoute[\s\S]*?hideJourney\(\)/u);
  assert.match(bridge, /revealImmersivePlannerFromRoute[\s\S]*?showJourney\(\)/u);
  assert.match(bridge, /addEventListener\("concourse:timetable-show-immersive-planner"/u);
  assert.match(bridge, /removeEventListener\("concourse:timetable-show-immersive-planner"/u);

  assert.match(validation, /!degreeLevel\?\.value[\s\S]*?journeyDegreeLevel/u);
  assert.match(validation, /!studyYear\?\.value[\s\S]*?journeyStudyYear/u);
  assert.match(validation, /plannerHasCourses && !minCredits\?\.value\.trim\(\)[\s\S]*?journeyMinCredits/u);
  assert.match(validation, /requestAnimationFrame\(\(\) => journeyTarget\.focus\(\{ preventScroll: true \}\)\)/u);
  assert.doesNotMatch(validation, /document\.activeElement/u);
});

test("reverse scrolling to the first frame keeps the immersive machine mounted", () => {
  const journeyLifecycle = sourceBetween(
    client,
    "const showJourney = () => {",
    "\n    const initializeStaticFallback = ({ permanent = false } = {}) => {"
  );
  const scrollLifecycle = sourceBetween(
    client,
    "const timeline = gsap.timeline({",
    "\n      timeline.eventCallback(\"onUpdate\""
  );

  assert.match(journeyLifecycle, /if \(!plannerIsVisible\(\)\) return/);
  assert.match(journeyLifecycle, /if \(document\.body\.classList\.contains\("planner-detailed-active"\)\) return/);
  assert.match(journeyLifecycle, /document\.body\.classList\.add\("planner-journey-active"\)/);
  assert.match(journeyLifecycle, /ConcourseTimetableMachine\?\.setActive\(true\)/);
  assert.match(scrollLifecycle, /onEnter:\s*showJourney/);
  assert.match(scrollLifecycle, /onEnterBack:\s*showJourney/);
  assert.match(scrollLifecycle, /onLeave:\s*showJourney/);
  assert.match(scrollLifecycle, /onLeaveBack:\s*showJourney/);
  assert.doesNotMatch(scrollLifecycle, /onLeaveBack:\s*hideJourney/);
  assert.match(
    styles,
    /body\.planner-journey-active,[\s\S]*?html\[data-theme="day"\] body\.planner-journey-active \{[\s\S]*?background: var\(--monitor-black\) !important;/
  );
});

test("each carrier emits a guarded four-corner projection", () => {
  const carrierProjection = sourceBetween(
    machine,
    "function createCarrier(name, width, height, supportSide) {",
    "\nfunction createTerminalCarrierBay(name, x, y, width, height) {"
  );
  const cornerCoordinates = sourceBetween(
    carrierProjection,
    "  const corners = [",
    "  ].map((position, index) => {"
  );
  const projectedAnchors = sourceBetween(
    machine,
    "function dispatchProjectedAnchors() {",
    "\nfunction renderNow() {"
  );

  assert.equal((cornerCoordinates.match(/panelZ\]/gu) || []).length, 4);
  assert.match(carrierProjection, /corners,/);
  assert.match(carrierProjection, /worldCorners: corners\.map/);
  assert.match(carrierProjection, /projectedCorners: corners\.map/);
  assert.match(carrierProjection, /screenQuad: corners\.map/);
  assert.match(carrierProjection, /quad: null/);

  assert.match(projectedAnchors, /frame\.corners\.forEach\(\(corner, index\) =>/);
  assert.match(projectedAnchors, /corner\.getWorldPosition\(worldCorner\)/);
  assert.match(projectedAnchors, /projectedCorner\.copy\(worldCorner\)\.project\(camera\)/);
  assert.match(projectedAnchors, /allCornersInFront = allCornersInFront && forwardDepth/);
  assert.match(projectedAnchors, /allCornersFinite = allCornersFinite[\s\S]*?Number\.isFinite\(screenCorner\.x\)[\s\S]*?Number\.isFinite\(screenCorner\.y\)/);
  assert.match(projectedAnchors, /surfaceNormal\.copy\([\s\S]*?surfaceNormal\.dot\(surfaceToCamera\)/);
  assert.match(projectedAnchors, /signedArea \+= corner\.x \* next\.y - next\.x \* corner\.y/);
  assert.match(projectedAnchors, /const bounded = projectedWidth > [\s\S]*?projectedWidth < projectionLimit[\s\S]*?projectedHeight < projectionLimit/);
  assert.match(projectedAnchors, /const intersectsViewport = [\s\S]*?viewportWidth[\s\S]*?viewportHeight/);
  assert.match(projectedAnchors, /output\.visible = inFront[\s\S]*?allCornersInFront[\s\S]*?allCornersFinite[\s\S]*?bounded[\s\S]*?intersectsViewport[\s\S]*?Math\.abs\(signedArea\)[\s\S]*?output\.facing >/);
  assert.match(projectedAnchors, /output\.quad = output\.visible \? frame\.screenQuad : null/);
});

test("the live DOM panels use a validated homography and clean it up", () => {
  const homography = sourceBetween(
    client,
    "const buildQuadMatrix3d = (quad, sourceWidth, sourceHeight) => {",
    "\n    const clearMachineProjection = (panel, clearAnchor = false) => {"
  );
  const projectionLifecycle = sourceBetween(
    client,
    "const clearMachineProjection = (panel, clearAnchor = false) => {",
    "\n    const handleEntranceProjection = (event) => {"
  );

  assert.match(homography, /const points = pointsFromProjectionQuad\(quad\)/);
  assert.match(client, /if \(!Array\.isArray\(values\) \|\| values\.length !== 4\) return null/);
  assert.match(homography, /turnsPositive[\s\S]*?turnsNegative/);
  assert.match(homography, /Math\.abs\(signedArea\) < [\s\S]*?projectedWidth > projectionLimit[\s\S]*?projectedHeight > projectionLimit/);
  assert.match(homography, /const divisor = [\s\S]*?perspectiveX = [\s\S]*?perspectiveY =/);
  assert.match(homography, /const denominators = [\s\S]*?denominators\.some/);
  assert.match(homography, /const determinant = [\s\S]*?Math\.abs\(determinant\)/);
  assert.match(homography, /return `matrix3d\(\$\{values\.map\(serialize\)\.join\(","\)\}\)`/);

  assert.match(projectionLifecycle, /panel\.classList\.remove\("is-machine-projected"\)/);
  assert.match(projectionLifecycle, /removeInlineStyleValue\(panel, "--machine-quad-transform"\)/);
  assert.match(projectionLifecycle, /const quadMatrix = [\s\S]*?buildQuadMatrix3d\(quadPoints, panelSize\.width, panelSize\.height\)/);
  assert.match(projectionLifecycle, /if \(!quadMatrix\) \{[\s\S]*?if \(allowCenterFallback\) applyCenterAnchor\(panel, anchor, quadPoints\)/);
  assert.match(projectionLifecycle, /setInlineStyleValue\(panel, "--machine-quad-transform", quadMatrix\)/);
  assert.match(projectionLifecycle, /panel\.classList\.add\("is-machine-projected"\)/);
  assert.match(projectionLifecycle, /removeEventListener\("concourse:timetable-machine-anchors", handleMachineAnchors\)[\s\S]*?cancelAnimationFrame\(projectionRefreshFrame\)[\s\S]*?clearMachineProjection\(panel, true\)/);
  assert.match(projectionLifecycle, /projectionResizeObserver\?\.disconnect\(\)/);

  assert.match(styles, /\.planner-journey-window\.is-machine-projected \{[\s\S]*?transform: var\(--machine-quad-transform\);[\s\S]*?transform-origin: 0 0;/);
});

test("the generated timetable is a live projected terminal with strict fallbacks", () => {
  const scheduleMarkup = sourceBetween(
    html,
    '<section id="schedulePage" class="schedule-page" hidden aria-label="Generated timetable">',
    "\n\n<!-- Post-timetable member experience -->"
  );
  const resultProjection = sourceBetween(
    client,
    "const setResultPresentationState = (state = \"none\") => {",
    "\n    const handleMachineAnchors = (event) => {"
  );
  const modeSync = sourceBetween(
    client,
    "const scheduleIsVisible = resultRouteIsActive;",
    "\n    const handleMachineReady = () => {"
  );
  const scheduleRoute = sourceBetween(
    html,
    "function showSchedulePage(){",
    "\nfunction showPlannerEditor"
  );

  assert.match(scheduleMarkup, /id="scheduleTerminalSurface"[\s\S]*?id="scheduleTerminalScroll"[^>]*tabindex="0"[^>]*role="region"[\s\S]*?class="schedule-page-header"[\s\S]*?id="timetablePanel"/);
  assert.equal((scheduleMarkup.match(/id="scheduleTerminalSurface"/gu) || []).length, 1);
  assert.equal((scheduleMarkup.match(/id="scheduleTerminalScroll"/gu) || []).length, 1);
  for (const preservedId of ["editSelections", "altArea", "saveFinalTimetable", "colorModeBar", "calArea"]) {
    assert.match(scheduleMarkup, new RegExp(`id="${preservedId}"`, "u"));
  }

  assert.match(client, /RESULT_SURFACE_SIZE = Object\.freeze\(\{ width: 1366, height: 864 \}\)/);
  assert.match(resultProjection, /\["awaiting", "projected", "fallback"\]\.forEach/);
  assert.match(resultProjection, /document\.body\.classList\.toggle\(`schedule-terminal-\$\{name\}`, state === name\)/);
  assert.match(resultProjection, /document\.body\.classList\.contains\("schedule-active"\)/);
  assert.match(resultProjection, /machineViewport\.classList\.contains\("is-webgl"\)/);
  assert.match(resultProjection, /!reducedMotion\.matches/);
  assert.match(resultProjection, /window\.matchMedia\("\(min-width: 761px\)"\)\.matches/);
  assert.match(resultProjection, /!navigator\.connection\?\.saveData/);
  assert.match(resultProjection, /projectDomSurface\(resultSurface, anchors\?\.result, \{\s*allowCenterFallback: false/);
  assert.match(resultProjection, /setResultPresentationState\("projected"\)/);
  assert.match(resultProjection, /if \(resultRouteIsActive\(\)\) \{[\s\S]*?activeProjectionRoute !== "result"[\s\S]*?journeyWindows\.forEach\(\(panel\) => clearMachineProjection\(panel, true\)\)[\s\S]*?projectResultSurface\(anchors\);[\s\S]*?return;/);
  assert.match(resultProjection, /activeProjectionRoute !== "planner"[\s\S]*?clearResultProjection\(\)[\s\S]*?journeyWindows\.forEach[\s\S]*?projectDomSurface\(panel, anchors\?\.\[panel\.dataset\.journeyWindow\]\)/);
  assert.doesNotMatch(client, /projectionResizeObserver\?\.observe\(resultSurface\)/);

  assert.match(modeSync, /window\.ConcourseTimetableMachine\?\.setMode\?\.\(mode\)/);
  assert.match(modeSync, /showingResult[\s\S]*?setProgress\(1\)[\s\S]*?setActive\(true\)/);
  assert.match(scheduleRoute, /setTimetableMachineMode\("result"\)/);
  assert.match(html, /function setTimetableMachineMode\(mode\)[\s\S]*?window\.__concourseTimetableMachineMode = nextMode[\s\S]*?setMode\?\.\(nextMode\)/);

  assert.match(styles, /#scheduleTerminalSurface\.is-machine-projected \{[\s\S]*?width: 1366px;[\s\S]*?height: 864px;[\s\S]*?transform: var\(--machine-quad-transform\);[\s\S]*?pointer-events: auto/);
  assert.match(styles, /#scheduleTerminalSurface\.is-machine-projected #scheduleTerminalScroll \{[\s\S]*?height: 100%;[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain/);
  assert.match(styles, /#scheduleTerminalSurface\.is-machine-projected \.calendar-scroll \{[\s\S]*?overscroll-behavior-inline: contain/);
  assert.match(styles, /schedule-active\.schedule-terminal-projected #schedulePage \{[\s\S]*?pointer-events: none/);
  assert.match(styles, /schedule-active\.schedule-terminal-fallback #appWrap \{[\s\S]*?opacity: \.2/);
  assert.match(styles, /schedule-active\.schedule-terminal-projected #appWrap \{\s*opacity: 1;/);
  assert.match(scheduleRoute, /\$\("appWrap"\)\.inert = true[\s\S]*?setAttribute\("aria-hidden", "true"\)/);
});

test("result presentation moves exclusively through awaiting, projected, and fallback states", () => {
  const presentationController = sourceBetween(
    client,
    "const setResultPresentationState = (state = \"none\") => {",
    "\n    let activeProjectionRoute = \"\";"
  );
  const scheduleRoute = sourceBetween(
    html,
    "function showSchedulePage(){",
    "\nfunction showPlannerEditor"
  );
  const plannerRoute = sourceBetween(
    html,
    "function showPlannerEditor(){",
    "\nfunction openTimetableDestination"
  );

  assert.match(presentationController, /\["awaiting", "projected", "fallback"\]\.forEach\(\(name\) => \{/);
  assert.match(presentationController, /classList\.toggle\(`schedule-terminal-\$\{name\}`, state === name\)/);
  assert.match(presentationController, /if \(state === "projected" \|\| state === "fallback"\) \{\s*window\.clearTimeout\(window\.__concourseTimetableResultWatchdog\)/);
  assert.match(presentationController, /resultStatus\.textContent = state === "projected"[\s\S]*?state === "fallback"[\s\S]*?Preparing the mechanical timetable terminal/);
  assert.match(presentationController, /if \(document\.body\.classList\.contains\("schedule-terminal-fallback"\)\) return false/);
  assert.match(presentationController, /if \(!resultProjectionIsEligible\(\)\) \{[\s\S]*?presentation: resultRouteIsActive\(\) \? "fallback" : "none"/);
  assert.match(presentationController, /if \(projected\) \{[\s\S]*?setResultPresentationState\("projected"\)[\s\S]*?return true/);
  assert.match(presentationController, /setResultPresentationState\("awaiting"\);\s*return false/);

  assert.match(scheduleRoute, /const terminalProjectionIsKnownUnavailable = \([\s\S]*?prefers-reduced-motion[\s\S]*?min-width: 761px[\s\S]*?navigator\.connection\?\.saveData[\s\S]*?!window\.gsap[\s\S]*?!window\.ScrollTrigger[\s\S]*?timetable-webgl-failed[\s\S]*?timetable-webgl-context-lost/);
  assert.match(scheduleRoute, /const initialTerminalState = terminalProjectionIsKnownUnavailable \? "fallback" : "awaiting"/);
  assert.match(scheduleRoute, /classList\.remove\([\s\S]*?"schedule-terminal-awaiting",[\s\S]*?"schedule-terminal-projected",[\s\S]*?"schedule-terminal-fallback"[\s\S]*?classList\.add\(`schedule-terminal-\$\{initialTerminalState\}`\)[\s\S]*?classList\.add\("schedule-active"\)[\s\S]*?setTimetableMachineMode\("result"\)/);
  for (const state of ["awaiting", "projected", "fallback"]) {
    assert.match(plannerRoute, new RegExp(`"schedule-terminal-${state}"`, "u"));
  }
  assert.match(plannerRoute, /window\.clearTimeout\(window\.__concourseTimetableResultWatchdog\)/);
});

test("the result watchdog and module error path cannot strand the semantic timetable", () => {
  const scheduleRoute = sourceBetween(
    html,
    "function showSchedulePage(){",
    "\nfunction showPlannerEditor"
  );
  const staticFallback = sourceBetween(
    client,
    "const initializeStaticFallback = ({ permanent = false } = {}) => {",
    "\n    const journeyScroller"
  );

  assert.match(scheduleRoute, /window\.clearTimeout\(window\.__concourseTimetableResultWatchdog\)/);
  assert.match(scheduleRoute, /const terminalAuditFrame = new URLSearchParams\(window\.location\.search\)[\s\S]*?timetableAuditFrame/);
  assert.match(scheduleRoute, /if\(initialTerminalState === "awaiting" && !terminalAuditFrame\)\{[\s\S]*?window\.__concourseTimetableResultWatchdog = window\.setTimeout/);
  assert.match(scheduleRoute, /window\.__concourseTimetableResultWatchdog = window\.setTimeout\(\(\) => \{/);
  assert.match(scheduleRoute, /if\(!document\.body\.classList\.contains\("schedule-active"\)\) return/);
  assert.match(scheduleRoute, /if\(document\.body\.classList\.contains\("schedule-terminal-projected"\)\) return/);
  assert.match(scheduleRoute, /if\(document\.body\.classList\.contains\("schedule-terminal-fallback"\)\) return/);
  assert.match(scheduleRoute, /classList\.remove\("schedule-terminal-awaiting"\)[\s\S]*?classList\.add\("schedule-terminal-fallback"\)[\s\S]*?scheduleTerminalScroll"\)\?\.focus\(\{preventScroll:true\}\)[\s\S]*?\}, 2800\)/);
  assert.match(scheduleRoute, /else if\(initialTerminalState !== "awaiting"\) \{\s*window\.requestAnimationFrame\(\(\) => \$\("scheduleTerminalScroll"\)\?\.focus\(\{preventScroll:true\}\)\)/);

  assert.match(html, /<script type="module" src="timetable-machine-3d\.mjs\?v=[^"]+" onerror="[^"]*timetable-webgl-failed[^"]*concourse:timetable-machine-failed[^"]*module-load-failed[^"]*"><\/script>/);
  assert.match(html, /id="scheduleTerminalStatus"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(staticFallback, /machineFailureIsPermanent = machineFailureIsPermanent \|\| permanent/);
  assert.match(staticFallback, /clearResultProjection\(\{\s*presentation: resultRouteIsActive\(\) \? "fallback" : "none"\s*\}\)/);
  assert.match(staticFallback, /window\.ConcourseTimetableMachine\?\.setActive\(false\)/);
  assert.match(client, /const handleMachineFailure = \(\) => initializeStaticFallback\(\{ permanent: true \}\)/);
  assert.match(client, /addEventListener\("concourse:timetable-machine-failed", handleMachineFailure\)/);
});

test("a transient result-anchor loss preserves the last safe projection before fallback", () => {
  const resultProjection = sourceBetween(
    client,
    "const projectResultSurface = (anchors) => {",
    "\n    let activeProjectionRoute = \"\";"
  );
  const graceBranch = sourceBetween(
    resultProjection,
    'if (document.body.classList.contains("schedule-terminal-projected")) {',
    '\n      setResultPresentationState("awaiting")'
  );
  const projectionCleanup = sourceBetween(
    client,
    "const handleMachineAnchors = (event) => {",
    "\n\n    const projectionResizeObserver"
  );

  assert.match(resultProjection, /projectDomSurface\(resultSurface, anchors\?\.result, \{\s*allowCenterFallback: false,\s*preserveOnInvalid: true/);
  assert.match(resultProjection, /if \(projected\) \{\s*window\.clearTimeout\(resultProjectionLossTimer\);\s*resultProjectionLossTimer = 0;\s*setResultPresentationState\("projected"\)/);
  assert.match(graceBranch, /if \(!resultProjectionLossTimer\) \{/);
  assert.match(graceBranch, /resultProjectionLossTimer = window\.setTimeout\(\(\) => \{/);
  assert.match(graceBranch, /if \(!resultRouteIsActive\(\)\) \{\s*clearResultProjection\(\);\s*return/);
  assert.match(graceBranch, /clearResultProjection\(\{ presentation: "fallback" \}\)/);
  assert.match(graceBranch, /\}, 220\)/);
  assert.match(graceBranch, /return true/);
  assert.match(resultProjection, /setResultPresentationState\("awaiting"\);\s*return false/);
  assert.match(projectionCleanup, /window\.clearTimeout\(resultProjectionLossTimer\)/);
});

test("focus follows the projected or fallback result and returns to its launch control", () => {
  const resultFocus = sourceBetween(
    client,
    "let resultProjectionLossTimer = 0;",
    "\n    let activeProjectionRoute = \"\";"
  );
  const modeSync = sourceBetween(
    client,
    "const scheduleIsVisible = resultRouteIsActive;",
    "\n    const handleMachineReady = () => {"
  );
  const scheduleRoute = sourceBetween(
    html,
    "function showSchedulePage(){",
    "\nfunction showPlannerEditor"
  );
  const plannerRoute = sourceBetween(
    html,
    "function showPlannerEditor(){",
    "\nfunction openTimetableDestination"
  );

  assert.match(scheduleRoute, /window\.__concourseTimetableReturnFocusId = document\.activeElement\?\.id \|\| "generate"/);
  assert.match(modeSync, /if \(mode !== lastMachinePresentationMode\) \{\s*resultFocusPending = showingResult;\s*lastMachinePresentationMode = mode/);
  assert.match(resultFocus, /const transferResultFocus = \(\{ force = false \} = \{\}\) => \{/);
  assert.match(resultFocus, /if \(\(!resultFocusPending && !force\) \|\| !resultScroll\) return/);
  assert.match(resultFocus, /resultFocusPending = false;\s*window\.cancelAnimationFrame\(resultFocusFrame\);\s*resultFocusFrame = window\.requestAnimationFrame\(\(\) => \{[\s\S]*?if \(!resultRouteIsActive\(\)\) return;[\s\S]*?schedule-terminal-projected[\s\S]*?schedule-terminal-fallback[\s\S]*?resultScroll\.focus\(\{ preventScroll: true \}\)/);
  assert.match(resultFocus, /if \(presentation === "fallback"\) transferResultFocus\(\{ force: true \}\)/);
  assert.match(resultFocus, /setResultPresentationState\("projected"\);\s*transferResultFocus\(\)/);
  assert.match(scheduleRoute, /classList\.add\("schedule-terminal-fallback"\)[\s\S]*?scheduleTerminalScroll"\)\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(plannerRoute, /const returnFocusId = window\.__concourseTimetableReturnFocusId;\s*window\.requestAnimationFrame\(\(\) => \{\s*if\(returnFocusId\) document\.getElementById\(returnFocusId\)\?\.focus\(\{preventScroll:true\}\)/);
});

test("projected electronic surfaces derive optical response from the carrier and fully clean up", () => {
  const opticalResponse = sourceBetween(
    client,
    "const electronicSurfaceProperties = [",
    "\n    const applyCenterAnchor = (panel, anchor, quadPoints = null) => {"
  );
  const staticFallback = sourceBetween(
    client,
    "const initializeStaticFallback = ({ permanent = false } = {}) => {",
    "\n    const handleMachineFailure"
  );
  const projectedSurface = sourceBetween(
    styles,
    "/* A projected window is the live control surface seated in a Three.js carrier.",
    "\n.planner-window-heading {"
  );

  for (const property of [
    "--display-backlight-alpha",
    "--display-edge-depth",
    "--display-clip-inset",
    "--display-reflection-alpha",
    "--display-reflection-x",
    "--display-view-shade"
  ]) {
    assert.match(styles, new RegExp(`${property}:`, "u"), `${property} has a CSS fallback`);
    assert.match(opticalResponse, new RegExp(`setInlineStyleValue\\(panel, \"${property}\"`, "u"), `${property} responds to projection`);
  }

  assert.match(opticalResponse, /const rawFacing = Number\(anchor\?\.facing\)/);
  assert.match(opticalResponse, /const seated = Math\.pow/);
  assert.match(opticalResponse, /const reflectionX = clamp/);
  assert.match(opticalResponse, /panel\.style\.getPropertyValue\(property\) === value[\s\S]*?panel\.style\.setProperty\(property, value\)/);
  assert.match(opticalResponse, /electronicSurfaceProperties\.forEach\(\(property\) => removeInlineStyleValue\(panel, property\)\)/);
  assert.match(opticalResponse, /clearElectronicSurfaceResponse\(panel\)/);
  assert.match(staticFallback, /journeyWindows\.forEach\(\(panel\) => \{[\s\S]*?clearMachineProjection\(panel, true\)/);
  assert.match(projectedSurface, /var\(--display-backlight-alpha\)/);
  assert.match(projectedSurface, /var\(--display-edge-depth\)/);
  assert.match(projectedSurface, /var\(--display-reflection-x\)/);
  assert.match(projectedSurface, /var\(--display-reflection-alpha\)/);
  assert.match(projectedSurface, /var\(--display-view-shade\)/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.planner-journey-window\.is-machine-projected::after[\s\S]*?display: none/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?#scheduleTerminalSurface\.is-machine-projected::after[\s\S]*?display: none/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.planner-journey-window::before,[\s\S]*?\.planner-journey-window::after[\s\S]*?display: none/);
});

test("the result terminal uses one outer glass pass and resilient static surface fallbacks", () => {
  const webglReady = sourceBetween(
    styles,
    ".planner-machine-viewport.is-webgl {",
    "\n}"
  );
  const resultPresentation = sourceBetween(
    styles,
    "/* Generated timetable —",
    "\n@media (prefers-reduced-motion: reduce)"
  );
  const ignition = sourceBetween(
    resultPresentation,
    "@keyframes terminal-display-ignition {",
    "\n  html body.schedule-active #scheduleTerminalSurface.is-machine-projected::before,"
  );
  const outerScanline = sourceBetween(
    resultPresentation,
    "html body.schedule-active #scheduleTerminalSurface.is-machine-projected::before {",
    "\n\n  @keyframes terminal-display-veil"
  );
  const innerTexture = sourceBetween(
    resultPresentation,
    "html body.schedule-active #schedulePage #timetablePanel::after {",
    "\n\n  html body.schedule-active #schedulePage #timetablePanel > *"
  );
  const reducedMotionStyles = sourceBetween(
    styles,
    "@media (prefers-reduced-motion: reduce) {",
    "\n@media (prefers-reduced-transparency: reduce)"
  );

  assert.match(webglReady, /clip-path: none !important;[\s\S]*?will-change: auto/);
  assert.doesNotMatch(resultPresentation, /schedule-active[^{]*#appWrap\s*\{[^}]*\bfilter\s*:/u);
  assert.match(ignition, /0% \{ opacity: \.08; \}[\s\S]*?100% \{ opacity: 1; \}/);
  assert.doesNotMatch(ignition, /filter:/);
  assert.match(outerScanline, /repeating-linear-gradient\(180deg/);
  assert.match(outerScanline, /animation: terminal-display-veil 420ms/);
  assert.match(resultPresentation, /@keyframes terminal-display-veil \{[\s\S]*?background-color: rgba\(3, 3, 2, \.94\)[\s\S]*?background-color: transparent/);
  assert.match(resultPresentation, /#scheduleTerminalSurface\.is-machine-projected::after \{[\s\S]*?var\(--display-reflection-x\)[\s\S]*?var\(--display-reflection-alpha\)/);
  assert.match(innerTexture, /content: none;\s*display: none/);
  assert.doesNotMatch(innerTexture, /repeating-linear-gradient|radial-gradient|mix-blend-mode/);
  assert.doesNotMatch(resultPresentation, /0 52px 120px|0 14px 34px|0 12px 30px|0 10px 34px/);
  assert.match(resultPresentation, /0 3px 8px rgba\(0, 0, 0, \.38\)[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, \.11\)/);
  assert.match(reducedMotionStyles, /\.planner-machine-viewport \{\s*display: none/);
  assert.match(reducedMotionStyles, /\.planner-monitor-device > img,[\s\S]*?visibility: visible !important;\s*opacity: 1 !important/);
  assert.match(reducedMotionStyles, /#scheduleTerminalSurface\.is-machine-projected::before \{\s*background-color: transparent !important/);
});

test("each projected panel keeps an independent native scroll region", () => {
  const scrollRegion = sourceBetween(
    styles,
    ".planner-window-scroll {",
    "\n.planner-window-scroll::before {"
  );

  assert.equal((html.match(/class="planner-window-scroll" data-journey-scroll tabindex="0"/gu) || []).length, 3);
  assert.match(scrollRegion, /min-height: 0/);
  assert.match(scrollRegion, /flex: 1 1 auto/);
  assert.match(scrollRegion, /overflow-x: hidden/);
  assert.match(scrollRegion, /overflow-y: auto/);
  assert.match(scrollRegion, /scrollbar-gutter: stable/);
  assert.match(scrollRegion, /overscroll-behavior-y: auto/);
  assert.match(scrollRegion, /touch-action: pan-y/);
  assert.match(styles, /\.planner-journey-window\.is-machine-projected \.planner-window-scroll \{/);
  assert.doesNotMatch(client, /addEventListener\("wheel"/);
});

test("projected planner surfaces keep their modeled aperture ratios on short desktops", () => {
  const projectedSurface = sourceBetween(
    styles,
    "/* A projected window is the live control surface seated in a Three.js carrier.",
    "\n.planner-window-heading {"
  );

  for (const [selector, sourceWidth, apertureRatio] of [
    ["planner-journey-course", "366px", "2.38 / 2.55"],
    ["planner-journey-meeting", "380px", "2.72 / 2.81"],
    ["planner-journey-priorities", "560px", "3.95 / 2.8"]
  ]) {
    assert.match(
      styles,
      new RegExp(`\\.${selector} \\{[\\s\\S]*?--machine-projection-source-width: ${sourceWidth.replace(".", "\\.")};[\\s\\S]*?--machine-aperture-ratio: ${apertureRatio.replaceAll(".", "\\.").replace("/", "\\/")};`, "u")
    );
  }

  assert.match(projectedSurface, /width: var\(--machine-projection-source-width\);/);
  assert.match(projectedSurface, /height: auto;\s*min-height: 0;/);
  assert.match(projectedSurface, /aspect-ratio: var\(--machine-aperture-ratio\);/);
  assert.doesNotMatch(projectedSurface, /height: min\([^}]*svh/);

  assert.match(
    styles,
    /@media \(min-width: 761px\)[\s\S]*?\.planner-machine-viewport\.is-webgl ~ \.planner-monitor-device \.planner-monitor-canvas \{\s*min-width: 0;\s*min-height: 0;\s*\}/
  );
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.planner-monitor-canvas \{\s*width: 920px;\s*\}/);
});

test("the motion-capable FAN-T111 is geometry rather than a textured photo relief", () => {
  assert.match(machine, /function createEntranceEnclosure\(/);
  assert.match(machine, /function createVentThreshold\(/);
  assert.match(machine, /function createMechanicalInterior\(/);
  assert.match(machine, /const exteriorShell = material\(/);
  assert.match(machine, /const exteriorTrim = material\(/);
  assert.match(machine, /upper-machined-chamfer/);
  assert.match(machine, /left-machined-chamfer/);
  assert.match(machine, /right-machined-chamfer/);
  assert.match(machine, /exteriorLeftRim = new THREE\.SpotLight/);
  assert.match(machine, /exteriorRightRim = new THREE\.SpotLight/);
  assert.match(machine, /exteriorLeftRim\.intensity = THREE\.MathUtils\.lerp\(55, 0, entranceLightFade\)/);
  assert.match(machine, /exteriorRightRim\.intensity = THREE\.MathUtils\.lerp\(38, 0, entranceLightFade\)/);
  assert.doesNotMatch(machine, /TextureLoader|CanvasTexture|DataTexture/);
  assert.doesNotMatch(machine, /loadEntranceReferenceSurface|referenceSurface/);
  assert.doesNotMatch(machine, /\b(?:map|normalMap|bumpMap|displacementMap|roughnessMap|metalnessMap|alphaMap|aoMap|lightMap|envMap)\s*:/);
  assert.doesNotMatch(machine, /concourse-timetable-(?:monitor|machine)[^"']*\.png/);

  for (const factory of [
    "createFastenerAndWearLayer",
    "createCircuitBackplane",
    "createConnectorBank",
    "createServoAssembly",
    "createBearingAssembly",
    "createLongitudinalInfrastructure",
    "createSuspendedParticulate"
  ]) {
    assert.match(machine, new RegExp(`function ${factory}\\(`, "u"), factory);
  }
  assert.match(machine, /new THREE\.InstancedMesh/);
  assert.match(machine, /physical-perforated-vent/);
  assert.match(machine, /new THREE\.FogExp2\(0x030302/);
  assert.match(machine, /new THREE\.HemisphereLight\(0xd6d3cd/);
  const colorLiterals = [...machine.matchAll(/0x([0-9a-f]{6})\b/giu)].map((match) => match[1]);
  for (const literal of colorLiterals) {
    const value = Number.parseInt(literal, 16);
    const red = value >> 16;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    assert.equal(
      blue > red * 1.25 && blue > green * 1.15,
      false,
      `unexpected blue-dominant machine color #${literal}`
    );
  }
});

test("gears keep running at fixed scroll progress and sparks are procedural shader particles", () => {
  const mechanisms = sourceBetween(
    machine,
    "function updateMechanisms(progress) {",
    "\nfunction updateSparks(progress) {"
  );
  const sparks = sourceBetween(
    machine,
    "function createSparks() {",
    "\nfunction createLights() {"
  );
  const renderLoop = sourceBetween(
    machine,
    "function shouldRunContinuousMotion() {",
    "\nfunction requestRender() {"
  );

  assert.match(mechanisms, /continuousGearTrains\.forEach\([\s\S]*?machineRunTime \* runningSpeed/);
  assert.match(mechanisms, /node\.rotation\.z = phase \+ driverTravel \* angularRatio/);
  assert.doesNotMatch(machine, /supportGears/);
  assert.match(renderLoop, /return currentProgress >= \.64/);
  assert.match(renderLoop, /const frameDelta = continuousMotion && lastAnimationTimestamp > 0/);
  assert.match(renderLoop, /machineRunTime \+= frameDelta/);
  assert.match(renderLoop, /if \(currentProgress >= \.76\) sparkRunTime \+= frameDelta/);
  assert.match(renderLoop, /if \(continuousMotion\) scheduleContinuousFrame\(settledFrameRate\)/);

  assert.match(sparks, /new THREE\.ShaderMaterial\(/);
  assert.match(sparks, /new THREE\.BufferAttribute\(lives, 1\)/);
  assert.match(sparks, /new THREE\.BufferAttribute\(angles, 1\)/);
  assert.match(sparks, /new THREE\.BufferAttribute\(scales, 1\)/);
  assert.match(sparks, /gl_PointCoord/);
  assert.match(sparks, /float crossSection/);
  assert.match(sparks, /float lengthMask/);
  assert.match(sparks, /THREE\.AdditiveBlending/);
  assert.match(sparks, /depthWrite: false/);
  assert.match(sparks, /toneMapped: false/);
  assert.doesNotMatch(sparks, /TextureLoader|CanvasTexture|DataTexture|PointsMaterial/);
  assert.match(machine, /sparkMaterial\.uniforms\.uOpacity\.value = opacity/);
  assert.match(machine, /viewport\.dataset\.sparkOpacity = opacity\.toFixed\(3\)/);
  assert.match(machine, /const resultSourceIsReady = resultModeBlend >= \.965/);
  assert.match(machine, /const sourceIsChanging = resultModeBlend > \.82 && resultModeBlend < \.965/);
  assert.match(machine, /driverRadius \/ \(driverRadius \+ drivenRadius\)/);
  assert.match(machine, /sparkPoints\.position\.copy\(sparkContactPoint\)/);
  assert.match(machine, /viewport\.dataset\.sparkSource = resultSourceIsReady \? "result-pump" : "planner-gearbox"/);
});

test("visible gear trains retain every gear and derive external-mesh motion from tooth counts", () => {
  const coupling = sourceBetween(
    machine,
    "function registerMeshedGearTrain({",
    "\nfunction createGearboxModule"
  );
  const gearbox = sourceBetween(
    machine,
    "function createGearboxModule(",
    "\nfunction createPistonBank"
  );
  const mechanisms = sourceBetween(
    machine,
    "function updateMechanisms(progress) {",
    "\nfunction updateSparks(progress) {"
  );

  assert.match(coupling, /phase: driver\.rotation\.z/);
  assert.match(coupling, /phase: node\.rotation\.z/);
  assert.match(coupling, /angularRatio: -parentMember\.angularRatio \* parentMember\.teeth \/ teeth/);
  assert.match(coupling, /continuousGearTrains\.push\(train\)/);

  for (const [name, teeth] of [
    ["gearboxDriver", 20],
    ["gearboxUpperDriven", 15],
    ["gearboxLowerDriven", 13]
  ]) {
    assert.match(
      gearbox,
      new RegExp(`const ${name} = createPrecisionGear\\([\\s\\S]*?teeth: ${teeth},`, "u"),
      `${name} is retained with its physical tooth count`
    );
  }
  assert.match(
    gearbox,
    /registerMeshedGearTrain\(\{[\s\S]*?driver: gearboxDriver,[\s\S]*?driverTeeth: 20,[\s\S]*?node: gearboxUpperDriven, teeth: 15[\s\S]*?node: gearboxLowerDriven, teeth: 13/
  );

  assert.match(mechanisms, /continuousGearTrains\.forEach\(/);
  assert.match(mechanisms, /const engagement = smoothstep\(engagementRange\[0\], engagementRange\[1\], progress\)/);
  assert.match(mechanisms, /const driverTravel = \([\s\S]*?machineRunTime \* runningSpeed[\s\S]*?\) \* direction/);
  assert.match(mechanisms, /node\.rotation\.z = phase \+ driverTravel \* angularRatio/);
  assert.doesNotMatch(machine, /supportGears|runningSpeed = \.42 \+ ratio/);

  assert.match(
    machine,
    /driver: gearDrive,[\s\S]*?driverTeeth: 18,[\s\S]*?node: secondaryGear, teeth: 14[\s\S]*?engagementRange: \[\.64, \.94\][\s\S]*?runningSpeed: 1\.34/
  );
  assert.match(
    machine,
    /driver: sparkDriverGear,[\s\S]*?driverTeeth: 15,[\s\S]*?node: sparkDrivenGear, teeth: 11/
  );
  assert.match(
    mechanisms,
    /resultSparkDriverGear\.rotation\.z = pumpAngle[\s\S]*?resultSparkDrivenGear\.rotation\.z = Math\.PI \/ 10 - pumpAngle \* 14 \/ 10/
  );
});

test("one extruded vent plate gives every perforation equal physical geometry", () => {
  const ventPlate = sourceBetween(
    machine,
    "function createPerforatedVentPlate(group) {",
    "\nfunction createEntranceEnclosure(group) {"
  );
  const threshold = sourceBetween(
    machine,
    "function createVentThreshold() {",
    "\nfunction createTransitionPlenum() {"
  );

  assert.equal((machine.match(/createPerforatedVentPlate\(group\);/gu) || []).length, 1);
  assert.match(ventPlate, /hole\.absarc\(x, y, DEVICE\.ventHoleRadius/);
  assert.match(ventPlate, /shape\.holes\.push\(hole\)/);
  const ventBevel = Number(ventPlate.match(/const ventBevel = (0?\.\d+)/u)?.[1]);
  const ventCurveSegments = Number(ventPlate.match(/const ventCurveSegments = (\d+)/u)?.[1]);
  assert.ok(ventBevel >= .004 && ventBevel <= .008, "the perforation lips use a restrained physical chamfer");
  assert.ok(ventCurveSegments >= 32, "the selected aperture stays round during the full-screen crossing");
  assert.match(ventPlate, /const ventCoreDepth = DEVICE\.ventDepth - ventBevel \* 2/);
  assert.match(ventPlate, /extrudedGeometry\(key, shape, ventCoreDepth, ventBevel, ventCurveSegments\)/);
  assert.match(ventPlate, /\[graphite, ventWallMetal\]/);
  assert.doesNotMatch(ventPlate, /frontRims|rimGeometry/);
  assert.match(ventPlate, /plate\.name = "physical-perforated-vent"/);
  assert.match(threshold, /addLoftedDuct\(group,[\s\S]*?VENT_DUCT_STATIONS/);
  assert.match(threshold, /begins at the selected hole's real \.048 rear/);
  assert.match(threshold, /There are no plane slices or hidden throat blocks/);
});

test("thin frames, bearings, guide carriages, and gear bores retain physical clearance", () => {
  const clampSource = sourceBetween(
    machine,
    "function clampBevelToRingWall(",
    "\nfunction addBeveledRing"
  );
  const ringSource = sourceBetween(
    machine,
    "function addBeveledRing(parent, options) {",
    "\nfunction addBoredBearingHousing"
  );
  const bearingFactory = sourceBetween(
    machine,
    "function addBoredBearingHousing(parent, options) {",
    "\nfunction addBox"
  );
  const serviceLayer = sourceBetween(
    machine,
    "function createTerminalServiceInfrastructure() {",
    "\nfunction createTerminalMicrodetailBatches"
  );
  const densityLayer = sourceBetween(
    machine,
    "function createTerminalPrecisionDensityLayer() {",
    "\nfunction createMechanicalInterior"
  );
  const gearGeometry = sourceBetween(
    machine,
    "function spurGearGeometry(radius, teeth, depth) {",
    "\nfunction roundedRectShape"
  );
  const standardGear = sourceBetween(
    machine,
    "function createGear(radius, teeth, depth, surface = machinedMetal) {",
    "\nfunction createFastenerAndWearLayer"
  );
  const precisionGear = sourceBetween(
    machine,
    "function createPrecisionGear(parent, options) {",
    "\nfunction createGearboxModule"
  );

  const wallFactor = Number(clampSource.match(/Math\.min\(horizontalWall, verticalWall\) \* (0?\.\d+)/u)?.[1]);
  const depthFactor = Number(clampSource.match(/Math\.max\(0, depth\) \* (0?\.\d+)/u)?.[1]);
  assert.ok(wallFactor > 0 && wallFactor < .5, "opposing ring chamfers retain a flat land");
  assert.ok(depthFactor > 0 && depthFactor <= .5, "front and rear chamfers retain an extrusion core");
  assert.match(ringSource, /const safeBevel = clampBevelToRingWall\(/);
  assert.match(ringSource, /beveled-ring:[^`]*\$\{safeBevel\}/);
  assert.match(ringSource, /extrudedGeometry\(key, shape, depth, safeBevel\)/);
  assert.doesNotMatch(ringSource, /extrudedGeometry\(key, shape, depth, bevel\)/);

  assert.match(bearingFactory, /rotation = \[0, Math\.PI \/ 2, 0\]/);
  assert.match(bearingFactory, /bore\.absarc\(0, 0, boreDiameter \* \.5/);
  assert.match(bearingFactory, /shape\.holes\.push\(bore\)/);
  assert.match(bearingFactory, /for \(const axialOffset of \[-raceOffset, raceOffset\]\)/);
  const bearingCalls = [...serviceLayer.matchAll(/addBoredBearingHousing\(group, \{([\s\S]*?)\n\s*\}\);/gu)];
  assert.equal(bearingCalls.length, 3);
  const shaftRadiusByName = new Map([
    ["terminal-upper-cross-shaft-bearing", .11],
    ["terminal-priority-cross-shaft-bearing", .1],
    ["terminal-lower-lead-shaft-bearing", .12]
  ]);
  for (const [, call] of bearingCalls) {
    const name = call.match(/name: "([^"]+)"/u)?.[1];
    const shaftRadius = shaftRadiusByName.get(name);
    const boreDiameter = Number(call.match(/boreDiameter: (0?\.\d+)/u)?.[1]);
    const raceRadius = Number(call.match(/raceRadius: (0?\.\d+)/u)?.[1]);
    const raceTube = Number(call.match(/raceTube: (0?\.\d+)/u)?.[1]);
    assert.ok(shaftRadius, `known shaft for ${name}`);
    assert.ok(boreDiameter * .5 > shaftRadius, `${name} bore clears its shaft`);
    assert.ok(raceRadius - raceTube > shaftRadius, `${name} race clears its shaft`);
    assert.match(call, /rotation: \[0, Math\.PI \/ 2, 0\]/);
  }

  const shaftZ = Number(densityLayer.match(/const linearGuideShaftZ = (0?\.\d+)/u)?.[1]);
  const carriageOuterWidth = Number(densityLayer.match(/const carriageOuterWidth = (0?\.\d+)/u)?.[1]);
  const carriageBoreDiameter = Number(densityLayer.match(/const carriageBoreDiameter = (0?\.\d+)/u)?.[1]);
  assert.ok(carriageBoreDiameter > .09, "linear carriage bore clears the guide diameter");
  assert.ok(shaftZ - carriageOuterWidth * .5 > -.12 + .48 * .5, "linear carriage retains air behind the guide bed");
  assert.match(densityLayer, /carriageShape\.holes\.push\(carriageBore\)/);
  assert.match(densityLayer, /axisQuaternion = new THREE\.Quaternion\(\)\.setFromEuler\(new THREE\.Euler\(0, Math\.PI \/ 2, 0\)\)/);
  assert.match(densityLayer, /matrix\.compose\(new THREE\.Vector3\(station\.x \+ xOffset, station\.y, shaftZ\), axisQuaternion, unitScale\);\s*carriageRaces\.setMatrixAt/);
  assert.doesNotMatch(densityLayer, /carriageBodies = new THREE\.InstancedMesh\(boxGeometry\(\.42, \.25, \.24\)/);

  const boreRatio = Number(gearGeometry.match(/centerBoreRadius = radius \* (0?\.\d+)/u)?.[1]);
  const standardAxle = Number(standardGear.match(/addCylinder\(group, radius \* (0?\.\d+), depth \* 1\.5/u)?.[1]);
  const precisionAxle = Number(precisionGear.match(/addCylinder\(group, radius \* (0?\.\d+), depth \* 1\.52/u)?.[1]);
  assert.ok(boreRatio >= Math.max(standardAxle, precisionAxle) + .02, "every gear bore leaves visible assembly clearance");
});

test("the exterior hero frame holds near 85vw and releases before the vent approach", () => {
  const presentation = sourceBetween(
    machine,
    "const EXTERIOR_PRESENTATION = Object.freeze({",
    "\n});\n\n// The generated timetable"
  );
  const cameraUpdate = sourceBetween(
    machine,
    "function updateCamera(progress) {",
    "\nfunction dispatchProjectedAnchors()"
  );
  const baseFov = Number(presentation.match(/baseFov: (\d+(?:\.\d+)?)/u)?.[1]);
  const verticalOffset = Number(presentation.match(/verticalCameraOffset: (-?\d+(?:\.\d+)?|-?\.\d+)/u)?.[1]);
  const releaseEnd = Number(presentation.match(/releaseEnd: (0?\.\d+)/u)?.[1]);
  const landscapeAspect = 1.5;
  const compensatedVerticalFov = 2 * Math.atan(
    Math.tan(baseFov * Math.PI / 360) * (1.4 / landscapeAspect)
  );
  const horizontalFov = 2 * Math.atan(Math.tan(compensatedVerticalFov * .5) * landscapeAspect);
  const projectedWidth = 13.46 / (
    2 * (25.25 - (8.7 + 3)) * Math.tan(horizontalFov * .5)
  );

  assert.ok(projectedWidth >= .82 && projectedWidth <= .86, `initial exterior occupies ${(projectedWidth * 100).toFixed(1)}vw`);
  assert.ok(verticalOffset >= .1 && verticalOffset <= .18,
    "the optical axis centers the complete chassis silhouette between the interface rails");
  assert.ok(releaseEnd <= .2, "presentation-only framing ends before the vent descent");
  assert.match(cameraUpdate, /camera\.position\.y \+= EXTERIOR_PRESENTATION\.verticalCameraOffset \* exteriorFrameHold/);
  assert.match(cameraUpdate, /THREE\.MathUtils\.lerp\(\s*43,\s*EXTERIOR_PRESENTATION\.baseFov,\s*exteriorFrameHold/);
});

test("the physical vent loft expands monotonically and joins the plenum without a visual cut", () => {
  const ventStations = sourceBetween(
    machine,
    "const VENT_DUCT_STATIONS = Object.freeze([",
    "\n]);\n\nconst PLENUM_DUCT_STATIONS"
  );
  const plenumStations = sourceBetween(
    machine,
    "const PLENUM_DUCT_STATIONS = Object.freeze([",
    "\n]);\n\n// Scroll distance is authored independently"
  );
  const loftGeometry = sourceBetween(
    machine,
    "function createLoftedDuctGeometry(key, stations, radialSegments = 64) {",
    "\nfunction addLoftedDuct"
  );
  const threshold = sourceBetween(
    machine,
    "function createVentThreshold() {",
    "\nfunction createTransitionPlenum() {"
  );
  const plenum = sourceBetween(
    machine,
    "function createTransitionPlenum() {",
    "\nfunction createTunnelRib"
  );
  const parseNumericStations = (source) => (
    [...source.matchAll(/\{\s*z:\s*(-?(?:\d+(?:\.\d+)?|\.\d+)),\s*halfWidth:\s*(\d+(?:\.\d+)?|\.\d+),\s*halfHeight:\s*(\d+(?:\.\d+)?|\.\d+),\s*exponent:\s*(\d+(?:\.\d+)?|\.\d+)\s*\}/gu)]
      .map((match) => ({
        z: Number(match[1]),
        halfWidth: Number(match[2]),
        halfHeight: Number(match[3]),
        exponent: Number(match[4])
      }))
  );
  const assertMonotonicExpansion = (stations, label) => {
    assert.ok(stations.length >= 5, `${label} has enough stations to hide polygonal stepping`);
    stations.slice(1).forEach((station, index) => {
      const previous = stations[index];
      assert.ok(station.z < previous.z, `${label} station z decreases continuously`);
      assert.ok(station.halfWidth >= previous.halfWidth, `${label} width never contracts`);
      assert.ok(station.halfHeight >= previous.halfHeight, `${label} height never contracts`);
      assert.ok(station.exponent >= previous.exponent, `${label} round-to-rect transition never reverses`);
    });
  };

  assert.match(ventStations, /z: DEVICE\.faceZ - DEVICE\.ventDepth, halfWidth: DEVICE\.ventHoleRadius, halfHeight: DEVICE\.ventHoleRadius, exponent: 2/);
  assert.match(ventStations, /z: -\.36, halfWidth: \.72, halfHeight: \.43, exponent: 4\.5/);
  assert.match(plenumStations, /z: DEVICE\.groupZ - \.36, halfWidth: \.72, halfHeight: \.43, exponent: 4\.5/);
  assertMonotonicExpansion(parseNumericStations(ventStations), "vent loft");
  assertMonotonicExpansion(parseNumericStations(plenumStations), "plenum loft");

  assert.match(loftGeometry, /stations\.forEach\(\(station, stationIndex\) =>/);
  assert.match(loftGeometry, /segment \/ radialSegments \* Math\.PI \* 2/);
  assert.match(loftGeometry, /const radialBefore = sampleDuctStation/);
  assert.match(loftGeometry, /const axialAfter = sampleDuctStation/);
  assert.match(loftGeometry, /crossVectors\(radialTangent, axialTangent\)\.normalize\(\)/);
  assert.match(loftGeometry, /for \(let stationIndex = 0; stationIndex < stations\.length - 1/);
  assert.match(loftGeometry, /indices\.push\(a, b, c, b, d, c\)/);
  assert.match(loftGeometry, /geometry\.setAttribute\("normal", new THREE\.Float32BufferAttribute\(normals, 3\)\)/);
  assert.match(loftGeometry, /geometry\.setAttribute\("color", new THREE\.Float32BufferAttribute\(colors, 3\)\)/);
  assert.match(threshold, /addLoftedDuct\(group,[\s\S]*?VENT_DUCT_STATIONS/);
  assert.match(plenum, /addLoftedDuct\(scene,[\s\S]*?PLENUM_DUCT_STATIONS/);
  assert.doesNotMatch(threshold, /addApertureRing\(/);
  assert.doesNotMatch(plenum, /addApertureRing\(/);
});

test("projection bounds and static fallback protect the usable planner", () => {
  const machineProjection = sourceBetween(
    machine,
    "function dispatchProjectedAnchors() {",
    "\nfunction renderNow() {"
  );
  const clientProjection = sourceBetween(
    client,
    "const handleEntranceProjection = (event) => {",
    "\n    window.addEventListener(\"concourse:timetable-machine-entrance-projection\""
  );
  const staticFallback = sourceBetween(
    client,
    "const initializeStaticFallback = ({ permanent = false } = {}) => {",
    "\n    const journeyScroller"
  );

  assert.match(machineProjection, /const projectionLimit = Math\.hypot\([\s\S]*?\* 2\.75/);
  assert.match(machineProjection, /const projectionIsBounded = [\s\S]*?\.every\(Number\.isFinite\)/);
  assert.match(machineProjection, /projectedWidth < projectionLimit/);
  assert.match(machineProjection, /projectedHeight < projectionLimit/);
  assert.match(clientProjection, /const hasFiniteFrame = [\s\S]*?\.every\(Number\.isFinite\)/);
  assert.match(clientProjection, /projection\.width > projectionLimit/);
  assert.match(clientProjection, /projection\.height > projectionLimit/);
  assert.match(clientProjection, /monitor\.style\.visibility = "hidden"/);

  assert.match(staticFallback, /stage\.classList\.add\("is-static"\)/);
  assert.match(staticFallback, /document\.body\.classList\.remove\("planner-journey-active"\)/);
  assert.match(staticFallback, /setOccludedPlannerAccess\(false\)/);
  assert.match(staticFallback, /panel\.setAttribute\("aria-hidden", "false"\)/);
  assert.match(staticFallback, /panel\.inert = false/);
});

test("hero metals and cable terminations gain procedural microdetail without texture tiling", () => {
  const microSurface = sourceBetween(
    machine,
    "function applyProceduralMicroSurface(surface, {",
    "\nfunction material(options) {"
  );
  const studio = sourceBetween(
    machine,
    "function createProceduralStudioEnvironment() {",
    "\nfunction boxGeometry"
  );
  const loom = sourceBetween(
    machine,
    "function createBraidedLoom(",
    "\nfunction createGrimeAndClampLayer"
  );

  assert.match(microSurface, /surface\.onBeforeCompile = \(shader\) =>/);
  assert.match(microSurface, /void concourseMachiningSamples\(/);
  assert.match(microSurface, /roughnessFactor = clamp/);
  assert.match(microSurface, /float concourseFilterAttenuation[\s\S]*?fwidth\(phase\)/);
  assert.match(microSurface, /float rawDirectional = sin\(directionalPhase\)/);
  assert.match(microSurface, /filteredSamples = rawSamples \* attenuation/);
  assert.match(microSurface, /concoursePerturbNormalArb/);
  assert.match(microSurface, /dFdx\(concourseMicroRawSamples\)[\s\S]*?dFdy\(concourseMicroRawSamples\)/);
  assert.doesNotMatch(microSurface, /dFd[xy]\(concourseMicro(?:Field|FilteredSamples|Attenuation)\)/);
  assert.doesNotMatch(microSurface, /normalize\(\s*dFd[xy]\(surfacePosition\)\s*\)/);
  assert.match(microSurface, /concourse-procedural-micro-surface-v3/);
  assert.match(machine, /anisotropy: \.68/);
  assert.match(studio, /face\.width = face\.height = 256/);
  assert.match(loom, /const terminalHero = points\.every/);
  assert.match(loom, /hero-loom-crimp-ferrule/);
  assert.match(loom, /hero-loom-strain-relief-gland/);
  assert.doesNotMatch(machine, /TextureLoader|CanvasTexture|DataTexture/);
});

test("terminal reference microdensity stays instanced and outside the carrier apertures", () => {
  const microdetail = sourceBetween(
    machine,
    "function createTerminalMicrodetailBatches() {",
    "\nfunction createTerminalTransmissionLayer() {"
  );
  const transmission = sourceBetween(
    machine,
    "function createTerminalTransmissionLayer() {",
    "\nfunction createTerminalOuterPortal() {"
  );
  const outerPortal = sourceBetween(
    machine,
    "function createTerminalOuterPortal() {",
    "\nfunction createTerminalPrecisionDensityLayer() {"
  );
  const precision = sourceBetween(
    machine,
    "function createTerminalPrecisionDensityLayer() {",
    "\nfunction createMechanicalInterior() {"
  );

  assert.match(machine, /const nickelSteel = material\(\{ color: 0x595956, roughness: \.31, metalness: \.96 \}\)/);
  assert.match(machine, /\[nickelSteel, \{ scale: 190, normalStrength: 0, roughnessVariation: \.02/);
  assert.match(microdetail, /A second, deliberately irregular witness row/);
  assert.match(transmission, /terminal-loom-crimp-sleeves/);
  assert.match(transmission, /terminal-loom-strain-relief-glands/);
  assert.match(transmission, /new THREE\.InstancedMesh\([\s\S]*?cylinderGeometry\(\.06, \.14, 14\)/);
  assert.match(outerPortal, /serviceCassetteStations\.length \* 4/);
  assert.match(outerPortal, /cassetteEdgeCatches/);
  assert.match(outerPortal, /portalBoltSlots/);
  assert.match(precision, /stations\.length \* 3/);
  assert.match(precision, /terminal-linear-guide-stop-dogs/);
  assert.doesNotMatch(machine, /TextureLoader|CanvasTexture|DataTexture/);
});

test("live displays are physically captured between rear and foreground WebGL passes", () => {
  const foregroundCanvasIndex = html.indexOf('id="plannerMachineForegroundCanvas"');
  const appIndex = html.indexOf('id="appWrap"');
  const resultIndex = html.indexOf('id="schedulePage"');
  const foregroundSetup = sourceBetween(
    machine,
    "function initializeForegroundRenderer() {",
    "\nfunction boxGeometry"
  );
  const foregroundHardware = sourceBetween(
    machine,
    "function addForegroundInstanceBatch(parent, {",
    "\nfunction createCarrier(name"
  );
  const renderLoop = sourceBetween(
    machine,
    "function renderNow() {",
    "\nfunction scheduleContinuousFrame"
  );
  const resizeSource = sourceBetween(
    machine,
    "function resize() {",
    "\nfunction setProgress"
  );
  const lifecycle = sourceBetween(
    machine,
    "function setMode(mode) {",
    "\nfunction initialize()"
  );

  assert.ok(foregroundCanvasIndex > appIndex, "foreground canvas follows the planner root");
  assert.ok(foregroundCanvasIndex < resultIndex, "foreground canvas precedes the independent result surface");
  assert.match(styles, /\.planner-machine-foreground-canvas\s*\{[\s\S]*?position: fixed;[\s\S]*?z-index: 8;[\s\S]*?pointer-events: none;/);
  assert.match(styles, /\.planner-machine-foreground-canvas\.is-active/);
  assert.match(styles, /body:has\(#plannerScrollJourney\.is-static\)[\s\S]*?\.planner-machine-foreground-canvas/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.planner-machine-foreground-canvas\s*\{\s*display: none;/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*?\.planner-machine-foreground-canvas\s*\{\s*display: none;/);

  assert.match(foregroundSetup, /alpha: true/);
  assert.match(foregroundSetup, /foregroundRenderer\.setClearColor\(0x000000, 0\)/);
  assert.match(foregroundSetup, /foregroundScene\.background = null/);
  assert.match(foregroundSetup, /foregroundScene\.fog = null/);
  assert.match(foregroundSetup, /foregroundScene\.environment = studioEnvironment/);
  assert.match(foregroundSetup, /mode === "result" \? document\.body : plannerHost/);
  assert.match(foregroundSetup, /schedule-terminal-projected/);
  assert.match(foregroundSetup, /entry\.overlay\.matrix\.copy\(entry\.source\.matrixWorld\)/);
  assert.match(foregroundSetup, /foregroundRenderer\.render\(foregroundScene, camera\)/);

  assert.match(foregroundHardware, /new THREE\.InstancedMesh\(geometry, surface, transforms\.length\)/);
  assert.match(foregroundHardware, /foreground-horizontal-jaws/);
  assert.match(foregroundHardware, /foreground-vertical-jaws/);
  assert.match(foregroundHardware, /foreground-lock-washers/);
  assert.match(foregroundHardware, /foreground-support-latches/);
  assert.match(machine, /registerCarrierForegroundOverlay\(group, name, width, height, supportSide\)/);

  assert.match(renderLoop, /renderer\.render\(scene, camera\);[\s\S]*?dispatchProjectedAnchors\(\);[\s\S]*?syncForegroundCarrierOverlays\(\)/);
  assert.match(resizeSource, /foregroundRenderer\.setPixelRatio\(pixelRatio\)[\s\S]*?foregroundRenderer\.setSize\(viewportWidth, viewportHeight, false\)/);
  assert.match(lifecycle, /mountForegroundCanvas\(normalizedMode\)/);
  assert.match(lifecycle, /foregroundCanvas\?\.classList\.toggle\([\s\S]*?"is-active"/);
  assert.match(lifecycle, /foregroundRenderer\?\.dispose\(\)/);
  assert.match(lifecycle, /handleForegroundContextLost/);
  assert.match(lifecycle, /handleForegroundContextRestored/);
  assert.doesNotMatch(machine, /TextureLoader|CanvasTexture|DataTexture/);
});

test("the visual language supports the vent threshold and integrated mechanical trays", () => {
  assert.match(styles, /--monitor-black: #050504/);
  assert.match(styles, /height: 700vh/);
  assert.match(styles, /\.planner-monitor-screen/);
  assert.match(styles, /\.planner-monitor-days-grid/);
  assert.match(styles, /\.planner-monitor-course-block/);
  assert.match(styles, /\.planner-journey-window/);
  assert.match(styles, /\.planner-window-scroll/);
  assert.match(styles, /overflow-y: auto/);
  assert.match(styles, /scrollbar-gutter: stable/);
  assert.match(styles, /\.planner-machine-viewport/);
  assert.match(styles, /clip-path: ellipse\(\.16% \.08% at var\(--vent-x\) var\(--vent-y\)\)/);
  assert.match(styles, /@media \(max-width: 760px\)/);
  assert.match(styles, /@media \(min-width: 761px\)[\s\S]*?\.planner-monitor-device > img,[\s\S]*?\.planner-machine-fallback[\s\S]*?opacity: 0/);
  assert.doesNotMatch(styles, /\.planner-scroll-journey\.is-static \.planner-monitor-device > img/);
  assert.doesNotMatch(styles, /html\.timetable-webgl-failed \.planner-monitor-device > img/);
  assert.doesNotMatch(styles, /html\.timetable-webgl-context-lost \.planner-monitor-device > img/);
  assert.match(styles, /\.planner-machine-viewport\.is-webgl \.planner-machine-fallback/);
  assert.match(client, /concourse:timetable-machine-failed/);
  assert.match(client, /initializeStaticFallback/);
  assert.match(styles, /color-scheme: dark/);
  assert.doesNotMatch(styles, /url\("concourse-timetable-journey-v1\.png"\)/);
  assert.doesNotMatch(styles, /backdrop-filter/);
  assert.doesNotMatch(styles, /planner-particle-field/);
  assert.doesNotMatch(html, /planner-window-number/);
  assert.match(html, /FAN-T111/);
  assert.match(html, /<body>/);
  assert.match(html, /document\.body\.classList\.add\("app-active", "planner-journey-active"\)/);
  assert.match(html, /id="landingScreen" hidden aria-hidden="true"/);
  assert.match(html, /id="appWrap" hidden>/);
  assert.match(html, /Scroll to move through the machine/);
  assert.doesNotMatch(client, /machineMedia/);
  assert.doesNotMatch(client, /yPercent: 30\.7/);
  assert.doesNotMatch(html, /Shape your week\.<br>/);
});
