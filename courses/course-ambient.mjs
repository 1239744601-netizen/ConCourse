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
  const desktopFormation = [
    [.13, .28], [.27, .22], [.40, .34], [.53, .25], [.66, .38], [.80, .29],
    [.19, .53], [.33, .47], [.47, .58], [.60, .49], [.73, .58], [.86, .47]
  ];
  const mobileFormation = [
    [.16, .25], [.36, .20], [.57, .31], [.78, .24],
    [.23, .54], [.44, .47], [.64, .59], [.82, .48]
  ];
  const desktopCrabFormation = [[.23, .70], [.51, .73], [.77, .69]];
  const mobileCrabFormation = [[.28, .69], [.70, .68]];
  const desktopCoralFormation = [[.11, .78], [.36, .84], [.65, .83], [.90, .78]];
  const mobileCoralFormation = [[.14, .80], [.49, .84], [.86, .80]];
  const palettes = {
    day: {
      bubble: "rgba(255, 255, 255, .66)",
      bubbleEdge: "rgba(20, 88, 119, .38)",
      hover: "rgba(15, 87, 132, .42)",
      wave: "rgba(15, 95, 151, .4)"
    },
    night: {
      bubble: "rgba(213, 244, 255, .68)",
      bubbleEdge: "rgba(139, 216, 255, .45)",
      hover: "rgba(244, 191, 71, .54)",
      wave: "rgba(139, 216, 255, .52)"
    }
  };
  const corals = [];
  const crabs = [];
  const fish = [];
  const motes = [];
  const state = {
    active: true,
    activeUntil: 0,
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
    pointerDownAt: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    resizeFrame: 0,
    selectedActor: -1,
    spriteReady: false,
    theme: document.documentElement.dataset.theme === "day" ? "day" : "night",
    waveStarted: -1,
    width: 1
  };
  let pulseTimer = 0;
  let rippleTimer = 0;
  let fishSpriteImage = null;
  let reefSpriteImage = null;

  function eventListener(media, callback) {
    if (typeof media.addEventListener === "function") media.addEventListener("change", callback);
    else media.addListener?.(callback);
  }

  function currentFormation() {
    return compactAquarium.matches ? mobileFormation : desktopFormation;
  }

  function desiredFishCount() {
    return compactAquarium.matches ? mobileFormation.length : desktopFormation.length;
  }

  function desiredMoteCount() {
    return compactAquarium.matches ? 10 : 18;
  }

  function currentCrabFormation() {
    return compactAquarium.matches ? mobileCrabFormation : desktopCrabFormation;
  }

  function currentCoralFormation() {
    return compactAquarium.matches ? mobileCoralFormation : desktopCoralFormation;
  }

  function createFish(index) {
    return {
      depth: .73 + (index % 5) * .072,
      direction: index % 6 === 0 ? -1 : 1,
      drawSize: 58,
      mode: "school",
      modeUntil: 0,
      phase: index * .83,
      slot: index,
      variant: (index * 5) % 8,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0
    };
  }

  function createCrab(index) {
    return {
      direction: index % 2 ? -1 : 1,
      drawSize: 46,
      mode: "settled",
      modeUntil: 0,
      phase: index * 1.31,
      variant: index % 4,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0
    };
  }

  function createCoral(index) {
    return {
      bloomStarted: -1,
      bloomUntil: 0,
      drawSize: 66,
      variant: index % 4,
      x: 0,
      y: 0
    };
  }

  function createMote(index, count) {
    return {
      boostUntil: 0,
      phase: index * 1.17,
      radius: .65 + (index % 4) * .38,
      speed: .16 + (index % 5) * .045,
      x: ((index * 71) % Math.max(1, count)) / Math.max(1, count) * state.width,
      y: ((index * 43) % Math.max(1, count)) / Math.max(1, count) * state.height
    };
  }

  function syncSchool(reset = false) {
    const count = desiredFishCount();
    if (fish.length > count) fish.length = count;
    while (fish.length < count) fish.push(createFish(fish.length));

    const formation = currentFormation();
    const baseSize = Math.max(52, Math.min(82, state.width * .105));
    for (let index = 0; index < fish.length; index += 1) {
      const member = fish[index];
      const slot = formation[index];
      member.slot = index;
      member.drawSize = baseSize * member.depth;
      if (reset || !member.x || !member.y) {
        member.x = slot[0] * state.width;
        member.y = slot[1] * state.height;
        member.vx = 0;
        member.vy = 0;
        member.mode = "school";
      }
    }
  }

  function syncReef(reset = false) {
    const crabFormation = currentCrabFormation();
    const coralFormation = currentCoralFormation();
    if (crabs.length > crabFormation.length) crabs.length = crabFormation.length;
    while (crabs.length < crabFormation.length) crabs.push(createCrab(crabs.length));
    if (corals.length > coralFormation.length) corals.length = coralFormation.length;
    while (corals.length < coralFormation.length) corals.push(createCoral(corals.length));

    const crabSize = Math.max(44, Math.min(54, state.width * .075));
    const coralSize = Math.max(52, Math.min(72, state.width * .1));
    for (let index = 0; index < crabs.length; index += 1) {
      const crab = crabs[index];
      crab.drawSize = crabSize * (.9 + index * .06);
      if (reset || !crab.x || !crab.y) {
        crab.x = crabFormation[index][0] * state.width;
        crab.y = crabFormation[index][1] * state.height;
        crab.vx = 0;
        crab.vy = 0;
        crab.mode = "settled";
      }
    }
    for (let index = 0; index < corals.length; index += 1) {
      const coral = corals[index];
      coral.drawSize = coralSize * (.86 + (index % 3) * .08);
      coral.x = coralFormation[index][0] * state.width;
      coral.y = coralFormation[index][1] * state.height;
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
      mote.x = ((index * 71) % count) / count * state.width;
      mote.y = ((index * 43) % count) / count * state.height;
      mote.boostUntil = 0;
    }
  }

  function resizeCanvas() {
    const previousWidth = state.width;
    const previousHeight = state.height;
    const bounds = viewport.getBoundingClientRect();
    state.width = Math.max(1, Math.round(bounds.width));
    state.height = Math.max(1, Math.round(bounds.height));
    const dprLimit = state.width < 600 ? 1 : 1.5;
    const pixelBudgetDpr = Math.sqrt(900_000 / Math.max(1, state.width * state.height));
    const dpr = Math.max(1, Math.min(devicePixelRatio || 1, dprLimit, pixelBudgetDpr));
    canvas.width = Math.max(1, Math.round(state.width * dpr));
    canvas.height = Math.max(1, Math.round(state.height * dpr));
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const dimensionsChanged = previousWidth !== state.width || previousHeight !== state.height;
    syncSchool(dimensionsChanged);
    syncReef(dimensionsChanged);
    syncMotes(dimensionsChanged);
    drawStatic();
  }

  function scheduleResize() {
    if (state.resizeFrame) return;
    state.resizeFrame = requestAnimationFrame(() => {
      state.resizeFrame = 0;
      resizeCanvas();
    });
  }

  function motionAllowed(timestamp = performance.now()) {
    return Boolean(
      state.active &&
      state.booted &&
      state.spriteReady &&
      state.intersecting &&
      !document.hidden &&
      !body.classList.contains("has-course-results") &&
      !reducedMotion.matches &&
      !forcedColors.matches &&
      !saveData &&
      timestamp < state.activeUntil
    );
  }

  function updateFish(member, index, timestamp, step) {
    const formation = currentFormation();
    const slot = formation[index];
    const schoolX = Math.sin(timestamp * .00042) * state.width * .018;
    const schoolY = Math.sin(timestamp * .00031 + member.phase) * state.height * .025;
    const targetX = slot[0] * state.width + schoolX;
    const targetY = slot[1] * state.height + schoolY;

    if (member.mode === "flee" && timestamp >= member.modeUntil) member.mode = "returning";
    if (member.mode !== "flee") {
      const returning = member.mode === "returning";
      const spring = returning ? .034 : .008;
      const damping = returning ? .8 : .87;
      member.vx = (member.vx + (targetX - member.x) * spring * step) * Math.pow(damping, step);
      member.vy = (member.vy + (targetY - member.y) * spring * step) * Math.pow(damping, step);
      if (returning && Math.abs(targetX - member.x) < 1.8 && Math.abs(targetY - member.y) < 1.8 && Math.abs(member.vx) < .22) {
        member.mode = "school";
      }
    } else {
      member.vx *= Math.pow(.95, step);
      member.vy *= Math.pow(.95, step);
    }

    member.x += member.vx * step;
    member.y += member.vy * step;
    if (Math.abs(member.vx) > .22) member.direction = member.vx < 0 ? -1 : 1;

    const horizontalPadding = member.drawSize * .34;
    const verticalPadding = member.drawSize * .23;
    if (member.x < horizontalPadding) {
      member.x = horizontalPadding;
      member.vx = Math.abs(member.vx) * .62;
    } else if (member.x > state.width - horizontalPadding) {
      member.x = state.width - horizontalPadding;
      member.vx = -Math.abs(member.vx) * .62;
    }
    if (member.y < verticalPadding) {
      member.y = verticalPadding;
      member.vy = Math.abs(member.vy) * .58;
    } else if (member.y > state.height - verticalPadding) {
      member.y = state.height - verticalPadding;
      member.vy = -Math.abs(member.vy) * .58;
    }
  }

  function updateCrab(crab, index, timestamp, step) {
    const formation = currentCrabFormation();
    const targetX = formation[index][0] * state.width;
    const targetY = formation[index][1] * state.height;
    if (crab.mode === "scuttling" && timestamp >= crab.modeUntil) crab.mode = "returning";
    if (crab.mode === "scuttling") {
      crab.vx *= Math.pow(.94, step);
      crab.vy *= Math.pow(.86, step);
    } else {
      const returning = crab.mode === "returning";
      const spring = returning ? .042 : .01;
      const damping = returning ? .76 : .84;
      crab.vx = (crab.vx + (targetX - crab.x) * spring * step) * Math.pow(damping, step);
      crab.vy = (crab.vy + (targetY - crab.y) * spring * step) * Math.pow(damping, step);
      if (returning && Math.abs(targetX - crab.x) < 1.4 && Math.abs(targetY - crab.y) < 1.4 && Math.abs(crab.vx) < .2) {
        crab.mode = "settled";
      }
    }
    crab.x += crab.vx * step;
    crab.y += crab.vy * step;
    if (Math.abs(crab.vx) > .18) crab.direction = crab.vx < 0 ? -1 : 1;
    const padding = crab.drawSize * .4;
    if (crab.x < padding) {
      crab.x = padding;
      crab.vx = Math.abs(crab.vx) * .5;
    } else if (crab.x > state.width - padding) {
      crab.x = state.width - padding;
      crab.vx = -Math.abs(crab.vx) * .5;
    }
  }

  function drawMotes(timestamp, step, moving, colors) {
    context.lineWidth = .65;
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      if (moving) {
        const boost = timestamp < mote.boostUntil ? 3.6 : 1;
        mote.y -= mote.speed * step * boost;
        mote.x += Math.sin(timestamp * .0012 + mote.phase) * .045 * step;
        if (mote.y < -5) {
          mote.y = state.height + 4;
          mote.x = ((index * 67) % Math.max(1, motes.length)) / Math.max(1, motes.length) * state.width;
        }
      }
      context.globalAlpha = .28 + (index % 3) * .1;
      context.fillStyle = colors.bubble;
      context.strokeStyle = colors.bubbleEdge;
      context.beginPath();
      context.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
      context.fill();
      if (mote.radius > 1.3) context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawFish(member, index, colors) {
    if (!fishSpriteImage) return;
    const cellWidth = fishSpriteImage.naturalWidth / 4;
    const cellHeight = fishSpriteImage.naturalHeight / 2;
    const sourceX = (member.variant % 4) * cellWidth;
    const sourceY = Math.floor(member.variant / 4) * cellHeight;
    const size = member.drawSize;

    const highlighted = (state.hoveredActor === index && finePointer.matches) || state.selectedActor === index;
    if (highlighted) {
      context.save();
      context.strokeStyle = colors.hover;
      context.lineWidth = state.selectedActor === index ? 2.2 : 1.2;
      context.beginPath();
      context.ellipse(member.x, member.y, size * .42, size * .23, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    context.save();
    context.translate(member.x, member.y);
    context.scale(member.direction, 1);
    context.globalAlpha = .82 + member.depth * .16;
    context.drawImage(
      fishSpriteImage,
      sourceX,
      sourceY,
      cellWidth,
      cellHeight,
      -size / 2,
      -size / 2,
      size,
      size
    );
    context.restore();
  }

  function drawCrab(crab, index, colors) {
    if (!reefSpriteImage) return;
    const cellWidth = reefSpriteImage.naturalWidth / 4;
    const cellHeight = reefSpriteImage.naturalHeight / 2;
    const width = crab.drawSize;
    const height = width * cellHeight / cellWidth;
    const actor = crabActorOffset + index;
    const highlighted = (state.hoveredActor === actor && finePointer.matches) || state.selectedActor === actor;
    if (highlighted) {
      context.save();
      context.strokeStyle = colors.hover;
      context.lineWidth = state.selectedActor === actor ? 2.2 : 1.2;
      context.beginPath();
      context.ellipse(crab.x, crab.y, width * .46, height * .32, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.save();
    context.translate(crab.x, crab.y);
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
      height
    );
    context.restore();
  }

  function drawCoral(coral, index, timestamp, colors) {
    if (!reefSpriteImage) return;
    const cellWidth = reefSpriteImage.naturalWidth / 4;
    const cellHeight = reefSpriteImage.naturalHeight / 2;
    const age = timestamp - coral.bloomStarted;
    const blooming = coral.bloomStarted >= 0 && timestamp < coral.bloomUntil;
    const progress = blooming ? Math.max(0, Math.min(1, age / Math.max(1, coral.bloomUntil - coral.bloomStarted))) : 0;
    const bloom = blooming ? Math.sin(progress * Math.PI) : 0;
    const width = coral.drawSize * (1 + bloom * .16);
    const height = width * cellHeight / cellWidth;
    const actor = coralActorOffset + index;
    const highlighted = (state.hoveredActor === actor && finePointer.matches) || state.selectedActor === actor;
    if (highlighted || blooming) {
      context.save();
      context.strokeStyle = colors.hover;
      context.globalAlpha = highlighted ? .9 : .35 + bloom * .55;
      context.lineWidth = (state.selectedActor === actor ? 2.2 : 1.2) + bloom;
      context.beginPath();
      context.ellipse(coral.x, coral.y, width * .44, height * .43, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    context.save();
    context.translate(coral.x, coral.y);
    context.globalAlpha = .9 + bloom * .1;
    context.drawImage(
      reefSpriteImage,
      coral.variant * cellWidth,
      cellHeight,
      cellWidth,
      cellHeight,
      -width / 2,
      -height / 2,
      width,
      height
    );
    context.restore();
  }

  function drawWave(timestamp, colors) {
    const age = timestamp - state.waveStarted;
    if (age < 0 || age >= 900) return;
    const progress = age / 900;
    context.save();
    context.strokeStyle = colors.wave;
    context.globalAlpha = 1 - progress;
    context.lineWidth = 1.2;
    context.beginPath();
    context.ellipse(
      state.width / 2,
      state.height * .48,
      20 + progress * state.width * .46,
      7 + progress * state.height * .37,
      0,
      0,
      Math.PI * 2
    );
    context.stroke();
    context.restore();
  }

  function drawScene(timestamp, step = 0, moving = false) {
    context.clearRect(0, 0, state.width, state.height);
    if (!state.spriteReady) return;
    const colors = palettes[state.theme];
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawMotes(timestamp, step, moving, colors);
    for (let index = 0; index < corals.length; index += 1) {
      drawCoral(corals[index], index, timestamp, colors);
    }
    for (let index = 0; index < crabs.length; index += 1) {
      const crab = crabs[index];
      if (moving) updateCrab(crab, index, timestamp, step);
      drawCrab(crab, index, colors);
    }
    for (let index = 0; index < fish.length; index += 1) {
      const member = fish[index];
      if (moving) updateFish(member, index, timestamp, step);
      drawFish(member, index, colors);
    }
    drawWave(timestamp, colors);
  }

  function drawStatic() {
    if (!state.spriteReady || state.width < 2 || state.height < 2) return;
    drawScene(performance.now());
  }

  function settleCommunity() {
    const formation = currentFormation();
    for (let index = 0; index < fish.length; index += 1) {
      const member = fish[index];
      if (member.mode === "school") continue;
      const slot = formation[index];
      member.x = slot[0] * state.width;
      member.y = slot[1] * state.height;
      member.vx = 0;
      member.vy = 0;
      member.mode = "school";
    }
    const crabFormation = currentCrabFormation();
    for (let index = 0; index < crabs.length; index += 1) {
      const crab = crabs[index];
      crab.x = crabFormation[index][0] * state.width;
      crab.y = crabFormation[index][1] * state.height;
      crab.vx = 0;
      crab.vy = 0;
      crab.mode = "settled";
    }
    for (const coral of corals) {
      coral.bloomStarted = -1;
      coral.bloomUntil = 0;
    }
  }

  function drawFrame(timestamp) {
    state.frame = 0;
    if (!motionAllowed(timestamp)) {
      aquarium.classList.remove("course-aquarium-active");
      settleCommunity();
      drawStatic();
      return;
    }
    if (timestamp - state.lastFrame < 33) {
      state.frame = requestAnimationFrame(drawFrame);
      return;
    }
    const delta = Math.min(48, Math.max(16, timestamp - (state.lastFrame || timestamp - 33)));
    state.lastFrame = timestamp;
    drawScene(timestamp, delta / 33, true);
    state.frame = requestAnimationFrame(drawFrame);
  }

  function ensureAnimation() {
    if (!state.frame && motionAllowed()) state.frame = requestAnimationFrame(drawFrame);
  }

  function startMotion(duration) {
    if (!state.spriteReady || reducedMotion.matches || forcedColors.matches || saveData) {
      drawStatic();
      return;
    }
    state.activeUntil = Math.max(state.activeUntil, performance.now() + duration);
    aquarium.classList.add("course-aquarium-active");
    ensureAnimation();
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
    drawStatic();
  }

  function refreshEffects() {
    if (motionAllowed()) ensureAnimation();
    else {
      stopAnimation();
      settleCommunity();
      drawStatic();
    }
    if (!finePointer.matches || document.hidden || body.classList.contains("has-course-results")) resetHover();
  }

  function insideEllipse(x, y, centerX, centerY, horizontalRadius, verticalRadius) {
    const normalizedX = (x - centerX) / horizontalRadius;
    const normalizedY = (y - centerY) / verticalRadius;
    return normalizedX * normalizedX + normalizedY * normalizedY <= 1;
  }

  function hitActorAt(x, y, expandedTarget = false) {
    const minimumRadius = expandedTarget ? 22 : 14;
    for (let index = fish.length - 1; index >= 0; index -= 1) {
      const member = fish[index];
      const horizontalRadius = Math.max(minimumRadius, member.drawSize * .44);
      const verticalRadius = Math.max(minimumRadius, member.drawSize * .25);
      if (insideEllipse(x, y, member.x, member.y, horizontalRadius, verticalRadius)) return index;
    }
    for (let index = crabs.length - 1; index >= 0; index -= 1) {
      const crab = crabs[index];
      const horizontalRadius = Math.max(minimumRadius, crab.drawSize * .46);
      const verticalRadius = Math.max(minimumRadius, crab.drawSize * .34);
      if (insideEllipse(x, y, crab.x, crab.y, horizontalRadius, verticalRadius)) return crabActorOffset + index;
    }
    for (let index = corals.length - 1; index >= 0; index -= 1) {
      const coral = corals[index];
      const horizontalRadius = Math.max(minimumRadius, coral.drawSize * .43);
      const verticalRadius = Math.max(minimumRadius, coral.drawSize * .46);
      if (insideEllipse(x, y, coral.x, coral.y, horizontalRadius, verticalRadius)) return coralActorOffset + index;
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
    const nextActor = hitActorAt(state.hoverClientX - bounds.left, state.hoverClientY - bounds.top);
    if (nextActor === state.hoveredActor) return;
    state.hoveredActor = nextActor;
    canvas.classList.toggle("is-community-hovered", nextActor >= 0);
    drawStatic();
  }

  function boostMotes(timestamp, x, y) {
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      if (index < 8) {
        mote.x = x + ((index % 4) - 1.5) * 5;
        mote.y = y + Math.floor(index / 4) * 5;
        mote.boostUntil = timestamp + 760;
      }
    }
  }

  function scatterFish(index, x, y) {
    const member = fish[index];
    if (!member) return;
    const timestamp = performance.now();
    let dx = member.x - x;
    let dy = member.y - y;
    let length = Math.hypot(dx, dy);
    if (length < 3) {
      dx = member.x - state.width / 2 || member.direction;
      dy = member.y - state.height / 2 || -.4;
      length = Math.hypot(dx, dy);
    }
    member.vx = dx / length * 11 + member.direction * 1.4;
    member.vy = dy / length * 8.2;
    member.direction = member.vx < 0 ? -1 : 1;
    member.mode = "flee";
    member.modeUntil = timestamp + 720;
    triggerCommunityRipple(timestamp, member.x, member.y);
    startMotion(3_800);
  }

  function triggerCommunityRipple(timestamp, x, y) {
    state.waveStarted = timestamp;
    boostMotes(timestamp, x, y);
    aquarium.classList.remove("course-community-ripple");
    requestAnimationFrame(() => aquarium.classList.add("course-community-ripple"));
    clearTimeout(rippleTimer);
    rippleTimer = window.setTimeout(() => aquarium.classList.remove("course-community-ripple"), 920);
  }

  function scuttleCrab(index, x) {
    const crab = crabs[index];
    if (!crab) return;
    const timestamp = performance.now();
    const direction = x <= crab.x ? 1 : -1;
    crab.direction = direction;
    crab.vx = direction * 9;
    crab.vy = -1.15;
    crab.mode = "scuttling";
    crab.modeUntil = timestamp + 680;
    triggerCommunityRipple(timestamp, crab.x, crab.y);
    startMotion(3_400);
  }

  function bloomCoral(index) {
    const coral = corals[index];
    if (!coral) return;
    const timestamp = performance.now();
    coral.bloomStarted = timestamp;
    coral.bloomUntil = timestamp + 1_300;
    triggerCommunityRipple(timestamp, coral.x, coral.y);
    startMotion(1_500);
  }

  function activateActor(actor, x, y) {
    if (actor < 0) return;
    if (reducedMotion.matches) {
      state.selectedActor = actor;
      settleCommunity();
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
        loadImage(new URL("./assets/course-fish-sprites.webp?v=20260803-reef1", import.meta.url).href),
        loadImage(new URL("./assets/course-reef-sprites.webp?v=20260803-reef1", import.meta.url).href)
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
      startMotion(4_800);
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
    state.waveStarted = timestamp;
    boostMotes(timestamp, state.width / 2, state.height * .48);
    body.classList.remove("course-aquarium-pulse");
    requestAnimationFrame(() => body.classList.add("course-aquarium-pulse"));
    clearTimeout(pulseTimer);
    pulseTimer = window.setTimeout(() => body.classList.remove("course-aquarium-pulse"), 900);
    startMotion(1_100);
  });

  hint.addEventListener("click", () => {
    if (!state.spriteReady || forcedColors.matches || saveData) return;
    const actorCount = fish.length + crabs.length + corals.length;
    if (!actorCount) return;
    const ordinal = state.actionActor % actorCount;
    state.actionActor = (ordinal + 1) % actorCount;
    if (ordinal < fish.length) {
      const member = fish[ordinal];
      activateActor(ordinal, member.x - member.direction * member.drawSize * .28, member.y);
    } else if (ordinal < fish.length + crabs.length) {
      const crabIndex = ordinal - fish.length;
      const crab = crabs[crabIndex];
      activateActor(crabActorOffset + crabIndex, crab.x - crab.direction * crab.drawSize * .32, crab.y);
    } else {
      const coralIndex = ordinal - fish.length - crabs.length;
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
    if (selectedActor >= 0) activateActor(selectedActor, x, y);
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
    if (reducedMotion.matches) {
      stopAnimation();
      settleCommunity();
      hint.hidden = !state.spriteReady;
      drawStatic();
    } else {
      hint.hidden = !state.spriteReady;
      startMotion(1_600);
    }
  }

  function handleForcedColors() {
    if (forcedColors.matches) {
      stopAnimation();
      settleCommunity();
      hint.hidden = true;
      drawStatic();
    } else {
      loadSprites();
      hint.hidden = !state.spriteReady;
      drawStatic();
    }
  }

  function handleLayoutChange() {
    syncSchool(true);
    syncReef(true);
    syncMotes(true);
    drawStatic();
    startMotion(1_200);
  }

  document.addEventListener("visibilitychange", refreshEffects);
  eventListener(reducedMotion, handleMotionPreference);
  eventListener(forcedColors, handleForcedColors);
  eventListener(finePointer, resetHover);
  eventListener(compactAquarium, handleLayoutChange);

  state.booted = true;
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
    settleCommunity();
    resizeCanvas();
    if (state.spriteReady) startMotion(1_200);
    else loadSprites();
  });
}
