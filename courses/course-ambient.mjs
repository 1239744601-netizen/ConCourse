import {
  advanceAquariumModel,
  aquariumRenderAlpha,
  aquariumRenderOrder,
  aquariumRenderScale,
  createAquariumModel,
  setAquariumAspectRatio,
  startleAquariumAt,
} from "./course-aquarium-model.mjs";

const body = document.body;
const aquarium = document.querySelector("[data-course-aquarium]");
const viewport = document.querySelector("[data-course-aquarium-viewport]");
const canvas = document.querySelector("[data-course-aquarium-canvas]");
const hint = document.querySelector("[data-course-community-action]");
const form = document.querySelector("#courseSearchForm");
const searchControl = document.querySelector(".course-search-control");
const context = canvas instanceof HTMLCanvasElement
  ? canvas.getContext("2d", { alpha: true })
  : null;

if (body && aquarium && viewport && canvas instanceof HTMLCanvasElement && hint && form && searchControl && context) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const forcedColors = matchMedia("(forced-colors: active)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const coarsePointer = matchMedia("(pointer: coarse)");
  const compactAquarium = matchMedia("(max-width: 760px)");
  const saveData = Boolean(navigator.connection?.saveData);
  const crabActorOffset = 100;
  const coralActorOffset = 200;
  const desktopCrabFormation = [[.22, .80], [.51, .83], [.79, .79]];
  const mobileCrabFormation = [[.27, .81], [.73, .80]];
  const desktopCoralFormation = [[.07, .82], [.31, .87], [.70, .86], [.93, .82]];
  const mobileCoralFormation = [[.09, .84], [.50, .88], [.91, .84]];
  const palettes = {
    day: {
      bubble: "rgba(247, 254, 255, .54)",
      bubbleEdge: "rgba(21, 91, 126, .3)",
      hover: "rgba(16, 83, 127, .62)",
      wave: "rgba(30, 117, 163, .42)",
      shadow: "rgba(0, 24, 43, .24)",
    },
    night: {
      bubble: "rgba(213, 244, 255, .58)",
      bubbleEdge: "rgba(139, 216, 255, .38)",
      hover: "rgba(244, 191, 71, .7)",
      wave: "rgba(139, 216, 255, .5)",
      shadow: "rgba(0, 3, 10, .42)",
    },
  };

  const corals = [];
  const crabs = [];
  const motes = [];
  let model = createAquariumModel({
    compact: compactAquarium.matches,
    seed: "concourse-community-aquarium-v2",
  });
  const state = {
    active: true,
    actionActor: 0,
    booted: false,
    frame: 0,
    generation: 0,
    height: 1,
    hoveredActor: -1,
    hoverClientX: 0,
    hoverClientY: 0,
    hoverFrame: 0,
    intersecting: true,
    lastFrame: 0,
    loadingSprite: false,
    nextPointerReaction: 0,
    pointerDownAt: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    resizeFrame: 0,
    selectedActor: -1,
    spriteReady: false,
    theme: document.documentElement.dataset.theme === "day" ? "day" : "night",
    wave: null,
    width: 1,
  };
  let pulseTimer = 0;
  let rippleTimer = 0;
  let fishSpriteImage = null;
  let reefSpriteImage = null;

  function eventListener(media, callback) {
    if (typeof media.addEventListener === "function") media.addEventListener("change", callback);
    else media.addListener?.(callback);
  }

  function currentCrabFormation() {
    return compactAquarium.matches ? mobileCrabFormation : desktopCrabFormation;
  }

  function currentCoralFormation() {
    return compactAquarium.matches ? mobileCoralFormation : desktopCoralFormation;
  }

  function desiredMoteCount() {
    return compactAquarium.matches ? 12 : 22;
  }

  function createCrab(index) {
    const formation = currentCrabFormation();
    return {
      direction: index % 2 ? -1 : 1,
      mode: "settled",
      modeUntil: 0,
      variant: index % 4,
      vx: 0,
      vy: 0,
      x: formation[index]?.[0] ?? .5,
      y: formation[index]?.[1] ?? .81,
    };
  }

  function createCoral(index) {
    const formation = currentCoralFormation();
    return {
      bloomStarted: -1,
      bloomUntil: 0,
      variant: index % 4,
      x: formation[index]?.[0] ?? .5,
      y: formation[index]?.[1] ?? .86,
    };
  }

  function createMote(index, count) {
    return {
      boostUntil: 0,
      phase: index * 1.17,
      radius: .7 + (index % 4) * .42,
      speed: .009 + (index % 5) * .0025,
      x: ((index * 71) % Math.max(1, count)) / Math.max(1, count),
      y: ((index * 43) % Math.max(1, count)) / Math.max(1, count),
    };
  }

  function syncReef(reset = false) {
    const crabFormation = currentCrabFormation();
    const coralFormation = currentCoralFormation();
    if (crabs.length > crabFormation.length) crabs.length = crabFormation.length;
    while (crabs.length < crabFormation.length) crabs.push(createCrab(crabs.length));
    if (corals.length > coralFormation.length) corals.length = coralFormation.length;
    while (corals.length < coralFormation.length) corals.push(createCoral(corals.length));

    for (let index = 0; index < crabs.length; index += 1) {
      if (!reset) continue;
      const crab = crabs[index];
      crab.x = crabFormation[index][0];
      crab.y = crabFormation[index][1];
      crab.vx = 0;
      crab.vy = 0;
      crab.mode = "settled";
    }
    for (let index = 0; index < corals.length; index += 1) {
      const coral = corals[index];
      coral.x = coralFormation[index][0];
      coral.y = coralFormation[index][1];
      if (reset) {
        coral.bloomStarted = -1;
        coral.bloomUntil = 0;
      }
    }
  }

  function syncMotes(reset = false) {
    const count = desiredMoteCount();
    if (motes.length > count) motes.length = count;
    while (motes.length < count) motes.push(createMote(motes.length, count));
    if (!reset) return;
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      mote.x = ((index * 71) % count) / count;
      mote.y = ((index * 43) % count) / count;
      mote.boostUntil = 0;
    }
  }

  function resizeCanvas() {
    const bounds = viewport.getBoundingClientRect();
    state.width = Math.max(1, Math.round(bounds.width));
    state.height = Math.max(1, Math.round(bounds.height));
    const dprLimit = state.width < 760 ? 1 : 1.35;
    const pixelBudgetDpr = Math.sqrt(2_100_000 / Math.max(1, state.width * state.height));
    const dpr = Math.max(1, Math.min(devicePixelRatio || 1, dprLimit, pixelBudgetDpr));
    canvas.width = Math.max(1, Math.round(state.width * dpr));
    canvas.height = Math.max(1, Math.round(state.height * dpr));
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    setAquariumAspectRatio(model, state.width / Math.max(1, state.height));
    syncReef();
    syncMotes();
    drawStatic();
  }

  function scheduleResize() {
    if (state.resizeFrame) return;
    state.resizeFrame = requestAnimationFrame(() => {
      state.resizeFrame = 0;
      resizeCanvas();
    });
  }

  function motionAllowed() {
    return Boolean(
      state.active &&
      state.booted &&
      state.spriteReady &&
      state.intersecting &&
      !document.hidden &&
      !body.classList.contains("has-course-results") &&
      !reducedMotion.matches &&
      !forcedColors.matches &&
      !saveData
    );
  }

  function fishDrawSize(fish) {
    const base = Math.max(60, Math.min(116, state.width * .061));
    const profileScale = fish.profileId === "smallShoaler"
      ? .72
      : fish.profileId === "reefPair"
        ? .9
        : 1.12;
    return base * profileScale * aquariumRenderScale(fish);
  }

  function fishScreenPosition(fish) {
    return {
      x: fish.position.x * state.width,
      y: fish.position.y * state.height,
    };
  }

  function updateCrabs(timestamp, elapsedSeconds) {
    const formation = currentCrabFormation();
    for (let index = 0; index < crabs.length; index += 1) {
      const crab = crabs[index];
      const target = formation[index];
      if (crab.mode === "scuttling" && timestamp >= crab.modeUntil) crab.mode = "returning";
      if (crab.mode === "scuttling") {
        crab.vx *= Math.pow(.16, elapsedSeconds);
        crab.vy *= Math.pow(.08, elapsedSeconds);
      } else {
        const response = crab.mode === "returning" ? 7.2 : 2.1;
        crab.vx += (target[0] - crab.x) * response * elapsedSeconds;
        crab.vy += (target[1] - crab.y) * response * elapsedSeconds;
        const damping = Math.pow(crab.mode === "returning" ? .035 : .1, elapsedSeconds);
        crab.vx *= damping;
        crab.vy *= damping;
        if (crab.mode === "returning" && Math.hypot(target[0] - crab.x, target[1] - crab.y) < .004) {
          crab.mode = "settled";
        }
      }
      crab.x = Math.max(.035, Math.min(.965, crab.x + crab.vx * elapsedSeconds));
      crab.y = Math.max(.74, Math.min(.89, crab.y + crab.vy * elapsedSeconds));
      if (Math.abs(crab.vx) > .001) crab.direction = crab.vx < 0 ? -1 : 1;
    }
  }

  function updateMotes(timestamp, elapsedSeconds) {
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      const boost = timestamp < mote.boostUntil ? 4.5 : 1;
      mote.y -= mote.speed * elapsedSeconds * boost;
      mote.x += Math.sin(timestamp * .00042 + mote.phase) * .00032 * elapsedSeconds;
      if (mote.y < -.015) {
        mote.y = 1.015;
        mote.x = ((index * 67) % Math.max(1, motes.length)) / Math.max(1, motes.length);
      }
    }
  }

  function drawMotes(timestamp, colors) {
    context.lineWidth = .65;
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      const x = mote.x * state.width;
      const y = mote.y * state.height;
      context.globalAlpha = .2 + (index % 3) * .07;
      context.fillStyle = colors.bubble;
      context.strokeStyle = colors.bubbleEdge;
      context.beginPath();
      context.arc(x, y, mote.radius, 0, Math.PI * 2);
      context.fill();
      if (mote.radius > 1.35) context.stroke();
      if (timestamp < mote.boostUntil) {
        context.globalAlpha = .14;
        context.beginPath();
        context.arc(x, y, mote.radius * 2.6, 0, Math.PI * 2);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  function wrappedAngle(angle) {
    let value = (angle + Math.PI) % (Math.PI * 2);
    if (value < 0) value += Math.PI * 2;
    return value - Math.PI;
  }

  function drawFish(fish, colors) {
    if (!fishSpriteImage) return;
    const cellWidth = fishSpriteImage.naturalWidth / 4;
    const cellHeight = fishSpriteImage.naturalHeight / 2;
    const variant = fish.spriteVariant % 8;
    const sourceX = (variant % 4) * cellWidth;
    const sourceY = Math.floor(variant / 4) * cellHeight;
    const position = fishScreenPosition(fish);
    const size = fishDrawSize(fish);
    const actor = model.fish.indexOf(fish);
    const highlighted = (state.hoveredActor === actor && finePointer.matches) || state.selectedActor === actor;
    const screenHeading = Math.atan2(
      Math.sin(fish.heading) * model.aspectRatio,
      Math.cos(fish.heading),
    );
    const direction = Math.cos(screenHeading) < 0 ? -1 : 1;
    const localPitch = direction < 0
      ? wrappedAngle(screenHeading - Math.PI)
      : screenHeading;
    const maximumPitch = fish.profileId === "solitaryCruiser" ? .22 : .32;
    const rotation = Math.max(-maximumPitch, Math.min(maximumPitch, localPitch));

    if (highlighted) {
      context.save();
      context.strokeStyle = colors.hover;
      context.globalAlpha = .9;
      context.lineWidth = state.selectedActor === actor ? 2.1 : 1.25;
      context.beginPath();
      context.ellipse(position.x, position.y, size * .43, size * .24, rotation, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    context.save();
    context.translate(position.x, position.y);
    context.rotate(rotation);
    context.scale(direction, 1);
    context.globalAlpha = aquariumRenderAlpha(fish);
    context.shadowColor = colors.shadow;
    context.shadowBlur = Math.max(2, size * .055);
    context.shadowOffsetY = Math.max(1, size * .025);
    context.drawImage(
      fishSpriteImage,
      sourceX,
      sourceY,
      cellWidth,
      cellHeight,
      -size / 2,
      -size / 2,
      size,
      size,
    );
    context.restore();
  }

  function crabDrawSize(index) {
    return Math.max(45, Math.min(72, state.width * .045)) * (.92 + index * .06);
  }

  function coralDrawSize(index) {
    return Math.max(54, Math.min(92, state.width * .058)) * (.88 + (index % 3) * .07);
  }

  function drawCrab(crab, index, colors) {
    if (!reefSpriteImage) return;
    const cellWidth = reefSpriteImage.naturalWidth / 4;
    const cellHeight = reefSpriteImage.naturalHeight / 2;
    const width = crabDrawSize(index);
    const height = width * cellHeight / cellWidth;
    const x = crab.x * state.width;
    const y = crab.y * state.height;
    const actor = crabActorOffset + index;
    const highlighted = (state.hoveredActor === actor && finePointer.matches) || state.selectedActor === actor;

    context.save();
    context.globalAlpha = .24;
    context.fillStyle = colors.shadow;
    context.beginPath();
    context.ellipse(x, y + height * .25, width * .34, height * .1, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (highlighted) {
      context.save();
      context.strokeStyle = colors.hover;
      context.lineWidth = state.selectedActor === actor ? 2.1 : 1.2;
      context.beginPath();
      context.ellipse(x, y, width * .46, height * .32, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.save();
    context.translate(x, y);
    context.scale(crab.direction, 1);
    context.drawImage(
      reefSpriteImage,
      crab.variant * cellWidth,
      0,
      cellWidth,
      cellHeight,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    context.restore();
  }

  function drawCoral(coral, index, timestamp, colors) {
    if (!reefSpriteImage) return;
    const cellWidth = reefSpriteImage.naturalWidth / 4;
    const cellHeight = reefSpriteImage.naturalHeight / 2;
    const age = timestamp - coral.bloomStarted;
    const blooming = coral.bloomStarted >= 0 && timestamp < coral.bloomUntil;
    const progress = blooming
      ? Math.max(0, Math.min(1, age / Math.max(1, coral.bloomUntil - coral.bloomStarted)))
      : 0;
    const bloom = blooming ? Math.sin(progress * Math.PI) : 0;
    const width = coralDrawSize(index) * (1 + bloom * .12);
    const height = width * cellHeight / cellWidth;
    const x = coral.x * state.width;
    const y = coral.y * state.height;
    const actor = coralActorOffset + index;
    const highlighted = (state.hoveredActor === actor && finePointer.matches) || state.selectedActor === actor;
    if (highlighted || blooming) {
      context.save();
      context.strokeStyle = colors.hover;
      context.globalAlpha = highlighted ? .86 : .28 + bloom * .42;
      context.lineWidth = (state.selectedActor === actor ? 2.1 : 1.15) + bloom;
      context.beginPath();
      context.ellipse(x, y, width * .43, height * .42, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.save();
    context.translate(x, y);
    context.globalAlpha = .86 + bloom * .12;
    context.shadowColor = colors.shadow;
    context.shadowBlur = 5;
    context.shadowOffsetY = 3;
    context.drawImage(
      reefSpriteImage,
      coral.variant * cellWidth,
      cellHeight,
      cellWidth,
      cellHeight,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    context.restore();
  }

  function drawWave(timestamp, colors) {
    if (!state.wave) return;
    const age = timestamp - state.wave.startedAt;
    if (age < 0 || age >= 900) {
      state.wave = null;
      return;
    }
    const progress = age / 900;
    context.save();
    context.strokeStyle = colors.wave;
    context.globalAlpha = 1 - progress;
    context.lineWidth = 1.15;
    context.beginPath();
    context.ellipse(
      state.wave.x * state.width,
      state.wave.y * state.height,
      18 + progress * state.width * .22,
      8 + progress * state.height * .18,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

  function drawScene(timestamp) {
    context.clearRect(0, 0, state.width, state.height);
    if (!state.spriteReady) return;
    const colors = palettes[state.theme];
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawMotes(timestamp, colors);
    for (const fish of aquariumRenderOrder(model)) drawFish(fish, colors);
    for (let index = 0; index < corals.length; index += 1) {
      drawCoral(corals[index], index, timestamp, colors);
    }
    for (let index = 0; index < crabs.length; index += 1) {
      drawCrab(crabs[index], index, colors);
    }
    drawWave(timestamp, colors);
  }

  function drawStatic() {
    if (!state.spriteReady || state.width < 2 || state.height < 2) return;
    drawScene(performance.now());
  }

  function drawFrame(timestamp) {
    state.frame = 0;
    if (!motionAllowed()) {
      aquarium.classList.remove("course-aquarium-active");
      state.lastFrame = 0;
      drawStatic();
      return;
    }
    if (!state.lastFrame) state.lastFrame = timestamp - 34;
    const elapsedMilliseconds = timestamp - state.lastFrame;
    if (elapsedMilliseconds < 32) {
      state.frame = requestAnimationFrame(drawFrame);
      return;
    }
    state.lastFrame = timestamp;
    const elapsedSeconds = Math.min(.1, Math.max(.001, elapsedMilliseconds / 1000));
    advanceAquariumModel(model, elapsedSeconds);
    updateCrabs(timestamp, elapsedSeconds);
    updateMotes(timestamp, elapsedSeconds);
    drawScene(timestamp);
    state.frame = requestAnimationFrame(drawFrame);
  }

  function ensureAnimation() {
    if (!state.frame && motionAllowed()) {
      aquarium.classList.add("course-aquarium-active");
      state.frame = requestAnimationFrame(drawFrame);
    }
  }

  function stopAnimation() {
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.lastFrame = 0;
    aquarium.classList.remove("course-aquarium-active");
  }

  function resetHover() {
    if (state.hoverFrame) cancelAnimationFrame(state.hoverFrame);
    state.hoverFrame = 0;
    state.hoveredActor = -1;
    canvas.classList.remove("is-community-hovered");
    if (!motionAllowed()) drawStatic();
  }

  function refreshEffects() {
    if (motionAllowed()) ensureAnimation();
    else stopAnimation();
    if (!finePointer.matches || document.hidden || body.classList.contains("has-course-results")) resetHover();
    drawStatic();
  }

  function insideEllipse(x, y, centerX, centerY, horizontalRadius, verticalRadius) {
    const normalizedX = (x - centerX) / horizontalRadius;
    const normalizedY = (y - centerY) / verticalRadius;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  function hitActorAt(x, y, expandedTarget = false) {
    const minimumRadius = expandedTarget ? 24 : 15;
    const orderedFish = aquariumRenderOrder(model);
    for (let renderIndex = orderedFish.length - 1; renderIndex >= 0; renderIndex -= 1) {
      const fish = orderedFish[renderIndex];
      const actor = model.fish.indexOf(fish);
      const position = fishScreenPosition(fish);
      const size = fishDrawSize(fish);
      if (insideEllipse(
        x,
        y,
        position.x,
        position.y,
        Math.max(minimumRadius, size * .43),
        Math.max(minimumRadius, size * .24),
      )) return actor;
    }
    for (let index = crabs.length - 1; index >= 0; index -= 1) {
      const crab = crabs[index];
      const size = crabDrawSize(index);
      if (insideEllipse(
        x,
        y,
        crab.x * state.width,
        crab.y * state.height,
        Math.max(minimumRadius, size * .46),
        Math.max(minimumRadius, size * .34),
      )) return crabActorOffset + index;
    }
    for (let index = corals.length - 1; index >= 0; index -= 1) {
      const coral = corals[index];
      const size = coralDrawSize(index);
      if (insideEllipse(
        x,
        y,
        coral.x * state.width,
        coral.y * state.height,
        Math.max(minimumRadius, size * .43),
        Math.max(minimumRadius, size * .46),
      )) return coralActorOffset + index;
    }
    return -1;
  }

  function applyHover() {
    state.hoverFrame = 0;
    if (!finePointer.matches || !state.spriteReady || body.classList.contains("has-course-results")) {
      resetHover();
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    const x = state.hoverClientX - bounds.left;
    const y = state.hoverClientY - bounds.top;
    const nextActor = hitActorAt(x, y);
    state.hoveredActor = nextActor;
    canvas.classList.toggle("is-community-hovered", nextActor >= 0);
    const now = performance.now();
    if (nextActor >= 0 && nextActor < model.fish.length && now >= state.nextPointerReaction && motionAllowed()) {
      startleAquariumAt(model, { x: x / state.width, y: y / state.height }, { radius: .09, strength: .28 });
      state.nextPointerReaction = now + 190;
    }
    if (!motionAllowed()) drawStatic();
  }

  function boostMotes(timestamp, x, y) {
    for (let index = 0; index < Math.min(8, motes.length); index += 1) {
      const mote = motes[index];
      mote.x = Math.max(0, Math.min(1, x + ((index % 4) - 1.5) * .006));
      mote.y = Math.max(0, Math.min(1, y + Math.floor(index / 4) * .009));
      mote.boostUntil = timestamp + 780;
    }
  }

  function triggerCommunityRipple(timestamp, x, y) {
    state.wave = { startedAt: timestamp, x, y };
    boostMotes(timestamp, x, y);
    aquarium.classList.remove("course-community-ripple");
    requestAnimationFrame(() => aquarium.classList.add("course-community-ripple"));
    clearTimeout(rippleTimer);
    rippleTimer = window.setTimeout(() => aquarium.classList.remove("course-community-ripple"), 920);
    ensureAnimation();
  }

  function scatterFish(index, x, y) {
    const fish = model.fish[index];
    if (!fish) return;
    const timestamp = performance.now();
    startleAquariumAt(model, { x, y }, { radius: .16, strength: 1.15 });
    state.selectedActor = index;
    triggerCommunityRipple(timestamp, fish.position.x, fish.position.y);
  }

  function scuttleCrab(index, x) {
    const crab = crabs[index];
    if (!crab) return;
    const timestamp = performance.now();
    const direction = x <= crab.x ? 1 : -1;
    crab.direction = direction;
    crab.vx = direction * .18;
    crab.vy = -.022;
    crab.mode = "scuttling";
    crab.modeUntil = timestamp + 720;
    state.selectedActor = crabActorOffset + index;
    triggerCommunityRipple(timestamp, crab.x, crab.y);
  }

  function bloomCoral(index) {
    const coral = corals[index];
    if (!coral) return;
    const timestamp = performance.now();
    coral.bloomStarted = timestamp;
    coral.bloomUntil = timestamp + 1_300;
    state.selectedActor = coralActorOffset + index;
    triggerCommunityRipple(timestamp, coral.x, coral.y);
  }

  function activateActor(actor, x, y) {
    if (actor < 0) return;
    if (reducedMotion.matches) {
      state.selectedActor = actor;
      drawStatic();
      return;
    }
    state.selectedActor = -1;
    if (actor >= coralActorOffset) bloomCoral(actor - coralActorOffset);
    else if (actor >= crabActorOffset) scuttleCrab(actor - crabActorOffset, x);
    else scatterFish(actor, x, y);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = url;
    });
  }

  async function loadSprites() {
    if (state.loadingSprite || state.spriteReady || saveData || forcedColors.matches || !state.active) return;
    state.loadingSprite = true;
    const generation = ++state.generation;
    try {
      const [fishImage, reefImage] = await Promise.all([
        loadImage(new URL("./assets/course-fish-sprites.webp?v=20260803-cinematic2", import.meta.url).href),
        loadImage(new URL("./assets/course-reef-sprites.webp?v=20260803-cinematic2", import.meta.url).href),
      ]);
      if (!state.active || generation !== state.generation) return;
      state.loadingSprite = false;
      const fishInvalid = !fishImage.naturalWidth || !fishImage.naturalHeight || fishImage.naturalWidth % 4 || fishImage.naturalHeight % 2;
      const reefInvalid = !reefImage.naturalWidth || !reefImage.naturalHeight || reefImage.naturalWidth % 4 || reefImage.naturalHeight % 2;
      if (fishInvalid || reefInvalid) return;
      fishSpriteImage = fishImage;
      reefSpriteImage = reefImage;
      state.spriteReady = true;
      aquarium.classList.add("course-aquarium-ready");
      hint.hidden = false;
      resizeCanvas();
      ensureAnimation();
    } catch (_error) {
      if (generation === state.generation) state.loadingSprite = false;
    }
  }

  form.addEventListener("focusin", () => body.classList.add("course-aquarium-focus"));
  form.addEventListener("focusout", (event) => {
    if (!form.contains(event.relatedTarget)) body.classList.remove("course-aquarium-focus");
  });
  form.addEventListener("submit", () => {
    if (saveData || reducedMotion.matches || forcedColors.matches) return;
    const timestamp = performance.now();
    triggerCommunityRipple(timestamp, .5, .49);
    startleAquariumAt(model, { x: .5, y: .49 }, { radius: .2, strength: .42 });
    body.classList.remove("course-aquarium-pulse");
    requestAnimationFrame(() => body.classList.add("course-aquarium-pulse"));
    clearTimeout(pulseTimer);
    pulseTimer = window.setTimeout(() => body.classList.remove("course-aquarium-pulse"), 900);
  });

  hint.addEventListener("click", () => {
    if (!state.spriteReady || forcedColors.matches || saveData) return;
    const actorCount = model.fish.length + crabs.length + corals.length;
    if (!actorCount) return;
    const ordinal = state.actionActor % actorCount;
    state.actionActor = (ordinal + 1) % actorCount;
    if (ordinal < model.fish.length) {
      const fish = model.fish[ordinal];
      activateActor(ordinal, fish.position.x - Math.cos(fish.heading) * .04, fish.position.y);
    } else if (ordinal < model.fish.length + crabs.length) {
      const crabIndex = ordinal - model.fish.length;
      const crab = crabs[crabIndex];
      activateActor(crabActorOffset + crabIndex, crab.x - crab.direction * .04, crab.y);
    } else {
      const coralIndex = ordinal - model.fish.length - crabs.length;
      const coral = corals[coralIndex];
      activateActor(coralActorOffset + coralIndex, coral.x, coral.y);
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || !state.spriteReady) return;
    state.hoverClientX = event.clientX;
    state.hoverClientY = event.clientY;
    if (!state.hoverFrame) state.hoverFrame = requestAnimationFrame(applyHover);
  }, { passive: true });

  canvas.addEventListener("pointerleave", resetHover);

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.spriteReady || forcedColors.matches || saveData) return;
    state.pointerDownAt = performance.now();
    state.pointerDownX = event.clientX;
    state.pointerDownY = event.clientY;
  }, { passive: true });

  canvas.addEventListener("pointerup", (event) => {
    if (!state.spriteReady || forcedColors.matches || saveData || body.classList.contains("has-course-results")) return;
    const elapsed = performance.now() - state.pointerDownAt;
    const travel = Math.hypot(event.clientX - state.pointerDownX, event.clientY - state.pointerDownY);
    if (!state.pointerDownAt || elapsed > 650 || travel > 12) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const expandedTarget = coarsePointer.matches || event.pointerType !== "mouse";
    const selectedActor = hitActorAt(x, y, expandedTarget);
    if (selectedActor >= 0) activateActor(selectedActor, x / state.width, y / state.height);
    else {
      startleAquariumAt(model, { x: x / state.width, y: y / state.height }, { radius: .18, strength: .72 });
      triggerCommunityRipple(performance.now(), x / state.width, y / state.height);
    }
    state.pointerDownAt = 0;
  }, { passive: true });

  const resizeObserver = new ResizeObserver(scheduleResize);
  resizeObserver.observe(viewport);

  const intersectionObserver = new IntersectionObserver((entries) => {
    state.intersecting = Boolean(entries[0]?.isIntersecting);
    refreshEffects();
  }, { rootMargin: "100px 0px", threshold: .01 });
  intersectionObserver.observe(aquarium);

  const themeObserver = new MutationObserver(() => {
    state.theme = document.documentElement.dataset.theme === "day" ? "day" : "night";
    drawStatic();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const resultObserver = new MutationObserver(refreshEffects);
  resultObserver.observe(body, { attributes: true, attributeFilter: ["class"] });

  function handleMotionPreference() {
    if (reducedMotion.matches) stopAnimation();
    else ensureAnimation();
    hint.hidden = !state.spriteReady;
    drawStatic();
  }

  function handleForcedColors() {
    if (forcedColors.matches) {
      stopAnimation();
      hint.hidden = true;
    } else {
      loadSprites();
      hint.hidden = !state.spriteReady;
    }
    drawStatic();
  }

  function handleLayoutChange() {
    model = createAquariumModel({
      compact: compactAquarium.matches,
      seed: "concourse-community-aquarium-v2",
      aspectRatio: state.width / Math.max(1, state.height),
    });
    syncReef(true);
    syncMotes(true);
    drawStatic();
    ensureAnimation();
  }

  document.addEventListener("visibilitychange", refreshEffects);
  eventListener(reducedMotion, handleMotionPreference);
  eventListener(forcedColors, handleForcedColors);
  eventListener(finePointer, resetHover);
  eventListener(compactAquarium, handleLayoutChange);

  state.booted = true;
  syncReef(true);
  syncMotes(true);
  resizeCanvas();
  loadSprites();

  window.addEventListener("pagehide", (event) => {
    state.active = false;
    stopAnimation();
    if (state.resizeFrame) cancelAnimationFrame(state.resizeFrame);
    if (state.hoverFrame) cancelAnimationFrame(state.hoverFrame);
    state.resizeFrame = 0;
    state.hoverFrame = 0;
    clearTimeout(pulseTimer);
    clearTimeout(rippleTimer);
    body.classList.remove("course-aquarium-pulse");
    aquarium.classList.remove("course-community-ripple");
    state.generation += 1;
    state.loadingSprite = false;
    if (!event.persisted) {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      resultObserver.disconnect();
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    state.active = true;
    state.theme = document.documentElement.dataset.theme === "day" ? "day" : "night";
    resizeCanvas();
    if (state.spriteReady) ensureAnimation();
    else loadSprites();
  });
}
