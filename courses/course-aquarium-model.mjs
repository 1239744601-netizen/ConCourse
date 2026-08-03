export const AQUARIUM_FIXED_STEP = 1 / 30;
export const AQUARIUM_MAX_CATCH_UP_STEPS = 3;

const TAU = Math.PI * 2;
const DEFAULT_ASPECT_RATIO = 3.15;
const SWIM_BOUNDS = Object.freeze({
  minX: 0.07,
  maxX: 0.93,
  minY: 0.12,
  maxY: 0.69,
});

export const AQUARIUM_REEF_OBSTACLES = Object.freeze([
  Object.freeze({ id: "left-reef", cx: 0.015, cy: 0.76, rx: 0.215, ry: 0.285 }),
  Object.freeze({ id: "right-reef", cx: 0.985, cy: 0.76, rx: 0.225, ry: 0.29 }),
  Object.freeze({ id: "reef-floor", cx: 0.5, cy: 0.9, rx: 0.46, ry: 0.205 }),
]);

export const AQUARIUM_SPECIES_PROFILES = Object.freeze({
  smallShoaler: Object.freeze({
    id: "smallShoaler",
    label: "Small shoaler",
    schoolId: "shoal-a",
    minSpeed: 0.052,
    cruiseSpeed: 0.066,
    maxSpeed: 0.08,
    startleSpeed: 0.108,
    maxAcceleration: 0.052,
    startleAcceleration: 0.105,
    maxTurnRate: 2.4,
    startleTurnRate: 3.2,
    neighborRadius: 0.17,
    separationRadius: 0.047,
    separationWeight: 1.72,
    alignmentWeight: 0.68,
    cohesionWeight: 0.42,
    routeWeight: 1,
    wanderWeight: 0.13,
    wanderFrequency: 0.7,
    bodyRadius: 0.023,
    arrivalRadius: 0.048,
    waypointSeconds: Object.freeze([5.2, 8.4]),
    depthRange: Object.freeze([0.34, 0.66]),
    depthRate: 0.018,
    zone: Object.freeze({ minX: 0.1, maxX: 0.9, minY: 0.17, maxY: 0.57 }),
  }),
  reefPair: Object.freeze({
    id: "reefPair",
    label: "Reef pair",
    schoolId: null,
    minSpeed: 0.038,
    cruiseSpeed: 0.049,
    maxSpeed: 0.061,
    startleSpeed: 0.088,
    maxAcceleration: 0.042,
    startleAcceleration: 0.086,
    maxTurnRate: 1.55,
    startleTurnRate: 2.35,
    neighborRadius: 0,
    separationRadius: 0,
    separationWeight: 0,
    alignmentWeight: 0,
    cohesionWeight: 0,
    routeWeight: 1,
    wanderWeight: 0.1,
    wanderFrequency: 0.52,
    bodyRadius: 0.028,
    arrivalRadius: 0.052,
    waypointSeconds: Object.freeze([6.2, 9.2]),
    depthRange: Object.freeze([0.45, 0.76]),
    depthRate: 0.014,
    zone: Object.freeze({ minX: 0.11, maxX: 0.89, minY: 0.25, maxY: 0.64 }),
  }),
  solitaryCruiser: Object.freeze({
    id: "solitaryCruiser",
    label: "Solitary cruiser",
    schoolId: null,
    minSpeed: 0.026,
    cruiseSpeed: 0.037,
    maxSpeed: 0.049,
    startleSpeed: 0.073,
    maxAcceleration: 0.03,
    startleAcceleration: 0.063,
    maxTurnRate: 0.95,
    startleTurnRate: 1.75,
    neighborRadius: 0,
    separationRadius: 0,
    separationWeight: 0,
    alignmentWeight: 0,
    cohesionWeight: 0,
    routeWeight: 1,
    wanderWeight: 0.075,
    wanderFrequency: 0.36,
    bodyRadius: 0.033,
    arrivalRadius: 0.057,
    waypointSeconds: Object.freeze([7.4, 11.2]),
    depthRange: Object.freeze([0.58, 0.9]),
    depthRate: 0.011,
    zone: Object.freeze({ minX: 0.1, maxX: 0.9, minY: 0.15, maxY: 0.65 }),
  }),
});

export const AQUARIUM_PROFILE_COUNTS = Object.freeze({
  desktop: Object.freeze({ smallShoaler: 7, reefPair: 2, solitaryCruiser: 3 }),
  compact: Object.freeze({ smallShoaler: 5, reefPair: 2, solitaryCruiser: 1 }),
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function wrapAngle(angle) {
  let wrapped = (angle + Math.PI) % TAU;
  if (wrapped < 0) wrapped += TAU;
  return wrapped - Math.PI;
}

function approach(current, target, maximumDelta) {
  return current + clamp(target - current, -maximumDelta, maximumDelta);
}

function approachAngle(current, target, maximumDelta) {
  return wrapAngle(current + clamp(wrapAngle(target - current), -maximumDelta, maximumDelta));
}

function magnitude(x, y) {
  return Math.hypot(x, y);
}

function normalized(x, y, fallbackX = 1, fallbackY = 0) {
  const length = magnitude(x, y);
  if (length < 1e-9) return { x: fallbackX, y: fallbackY };
  return { x: x / length, y: y / length };
}

function screenDeltaToWorld(dx, dy, aspectRatio) {
  return { x: dx, y: dy / aspectRatio };
}

function worldDistance(first, second, aspectRatio) {
  const delta = screenDeltaToWorld(second.x - first.x, second.y - first.y, aspectRatio);
  return magnitude(delta.x, delta.y);
}

function hashSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x6d2b79f5;
}

function nextRandom(actor) {
  let state = actor.rngState >>> 0 || 0x6d2b79f5;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  actor.rngState = state >>> 0;
  return actor.rngState / 4294967296;
}

function randomBetween(actor, range) {
  return lerp(range[0], range[1], nextRandom(actor));
}

export function signedDistanceToAquariumReef(point, obstacle, aspectRatio = DEFAULT_ASPECT_RATIO) {
  const normalizedX = (point.x - obstacle.cx) / obstacle.rx;
  const normalizedY = (point.y - obstacle.cy) / obstacle.ry;
  const radialDistance = Math.hypot(normalizedX, normalizedY);
  const worldScale = Math.min(obstacle.rx, obstacle.ry / aspectRatio);
  return (radialDistance - 1) * worldScale;
}

function minimumReefDistance(point, aspectRatio) {
  let minimum = Number.POSITIVE_INFINITY;
  for (const obstacle of AQUARIUM_REEF_OBSTACLES) {
    minimum = Math.min(minimum, signedDistanceToAquariumReef(point, obstacle, aspectRatio));
  }
  return minimum;
}

function pointInsideSwimArea(point, bodyRadius, aspectRatio) {
  if (
    point.x < SWIM_BOUNDS.minX + bodyRadius ||
    point.x > SWIM_BOUNDS.maxX - bodyRadius ||
    point.y < SWIM_BOUNDS.minY + bodyRadius * aspectRatio ||
    point.y > SWIM_BOUNDS.maxY - bodyRadius * aspectRatio
  ) return false;
  return minimumReefDistance(point, aspectRatio) > bodyRadius * 0.65;
}

function initialPosition(profileId, ordinal, count, compact) {
  if (profileId === "smallShoaler") {
    const span = compact ? 0.46 : 0.5;
    const x = 0.16 + span * ordinal / Math.max(1, count - 1);
    const row = ordinal % 3;
    return { x, y: 0.27 + row * 0.045 + Math.sin(ordinal * 1.7) * 0.012 };
  }
  if (profileId === "reefPair") {
    return ordinal === 0 ? { x: 0.64, y: 0.41 } : { x: 0.76, y: 0.49 };
  }
  const anchors = compact
    ? [{ x: 0.79, y: 0.24 }]
    : [{ x: 0.82, y: 0.23 }, { x: 0.7, y: 0.58 }, { x: 0.31, y: 0.59 }];
  return { ...anchors[ordinal % anchors.length] };
}

function createWaypoint(actor, profile, model, previousPoint) {
  let best = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const candidate = {
      x: lerp(profile.zone.minX, profile.zone.maxX, nextRandom(actor)),
      y: lerp(profile.zone.minY, profile.zone.maxY, nextRandom(actor)),
    };
    const reefDistance = minimumReefDistance(candidate, model.aspectRatio);
    const travelDistance = worldDistance(previousPoint, candidate, model.aspectRatio);
    const score = Math.min(reefDistance, travelDistance * 0.55);
    if (pointInsideSwimArea(candidate, profile.bodyRadius, model.aspectRatio) && travelDistance > 0.16) {
      return candidate;
    }
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return {
    x: clamp(best?.x ?? 0.5, SWIM_BOUNDS.minX + profile.bodyRadius, SWIM_BOUNDS.maxX - profile.bodyRadius),
    y: clamp(
      best?.y ?? 0.35,
      SWIM_BOUNDS.minY + profile.bodyRadius * model.aspectRatio,
      SWIM_BOUNDS.maxY - profile.bodyRadius * model.aspectRatio,
    ),
  };
}

function createFish(model, profileId, ordinal, count, globalIndex) {
  const profile = AQUARIUM_SPECIES_PROFILES[profileId];
  const id = `${profileId}-${ordinal + 1}`;
  const fish = {
    id,
    profile: profileId,
    profileId,
    schoolId: profile.schoolId,
    variant: (globalIndex * 5) % 8,
    spriteVariant: (globalIndex * 5) % 8,
    rngState: hashSeed(`${model.seed}:${id}`),
    position: initialPosition(profileId, ordinal, count, model.compact),
    previousPosition: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    direction: 1,
    heading: 0,
    speed: profile.cruiseSpeed,
    depth: 0,
    targetDepth: 0,
    depthDecisionAt: 0,
    route: [],
    routeIndex: 1,
    waypointDeadline: 0,
    wanderPhase: 0,
    wanderBias: 0,
    startle: { x: 0, y: 0, strength: 0, startedAt: -1, until: -1 },
    lastTurnDelta: 0,
    lastAcceleration: 0,
    lastLimits: { maxTurnRate: profile.maxTurnRate, maxAcceleration: profile.maxAcceleration, maxSpeed: profile.maxSpeed },
    lastForces: { route: 0, separation: 0, alignment: 0, cohesion: 0, boundary: 0, reef: 0, startle: 0 },
    prevX: 0,
    prevY: 0,
    prevHeading: 0,
    prevSpeed: 0,
  };

  fish.wanderPhase = nextRandom(fish) * TAU;
  fish.wanderBias = lerp(-0.4, 0.4, nextRandom(fish));
  fish.depth = randomBetween(fish, profile.depthRange);
  fish.targetDepth = randomBetween(fish, profile.depthRange);
  fish.depthDecisionAt = randomBetween(fish, [5.5, 9.5]);
  fish.speed = randomBetween(fish, [profile.minSpeed, profile.maxSpeed]);
  fish.route = [{ ...fish.position }];
  while (fish.route.length < 4) {
    fish.route.push(createWaypoint(fish, profile, model, fish.route.at(-1)));
  }
  const initialVector = screenDeltaToWorld(
    fish.route[1].x - fish.position.x,
    fish.route[1].y - fish.position.y,
    model.aspectRatio,
  );
  fish.heading = Math.atan2(initialVector.y, initialVector.x);
  fish.velocity.x = Math.cos(fish.heading) * fish.speed;
  fish.velocity.y = Math.sin(fish.heading) * fish.speed;
  fish.direction = Math.cos(fish.heading) < 0 ? -1 : 1;
  fish.previousPosition = { ...fish.position };
  fish.waypointDeadline = randomBetween(fish, profile.waypointSeconds);
  return fish;
}

function resetStepMetrics(model) {
  model.metrics.neighborChecks = 0;
  model.metrics.separationApplications = 0;
  model.metrics.boundaryApplications = 0;
  model.metrics.reefApplications = 0;
  model.metrics.startleApplications = 0;
}

function clearForces(fish) {
  fish.lastForces.route = 0;
  fish.lastForces.separation = 0;
  fish.lastForces.alignment = 0;
  fish.lastForces.cohesion = 0;
  fish.lastForces.boundary = 0;
  fish.lastForces.reef = 0;
  fish.lastForces.startle = 0;
}

function advanceWaypoint(fish, profile, model) {
  const target = fish.route[fish.routeIndex];
  const reached = worldDistance(fish.position, target, model.aspectRatio) <= profile.arrivalRadius;
  if (!reached && model.time < fish.waypointDeadline) return;
  fish.routeIndex += 1;
  if (fish.routeIndex >= fish.route.length) {
    const previous = fish.route.at(-1);
    fish.route.shift();
    fish.route.push(createWaypoint(fish, profile, model, previous));
    fish.routeIndex = fish.route.length - 1;
  }
  fish.waypointDeadline = model.time + randomBetween(fish, profile.waypointSeconds);
}

function addBoundaryAvoidance(fish, profile, model, force) {
  const xMargin = 0.115;
  const yMargin = 0.105;
  let x = 0;
  let y = 0;
  const left = SWIM_BOUNDS.minX + profile.bodyRadius;
  const right = SWIM_BOUNDS.maxX - profile.bodyRadius;
  const top = SWIM_BOUNDS.minY + profile.bodyRadius * model.aspectRatio;
  const bottom = SWIM_BOUNDS.maxY - profile.bodyRadius * model.aspectRatio;

  if (fish.prevX < left + xMargin) x += (left + xMargin - fish.prevX) / xMargin;
  if (fish.prevX > right - xMargin) x -= (fish.prevX - (right - xMargin)) / xMargin;
  if (fish.prevY < top + yMargin) y += (top + yMargin - fish.prevY) / yMargin;
  if (fish.prevY > bottom - yMargin) y -= (fish.prevY - (bottom - yMargin)) / yMargin;

  const strength = magnitude(x, y);
  if (strength > 0) {
    force.x += x * 2.35;
    force.y += y * 2.35;
    fish.lastForces.boundary = strength;
    model.metrics.boundaryApplications += 1;
  }
}

function addReefAvoidance(fish, profile, model, force) {
  const lookAhead = 0.048 + fish.speed * 0.7;
  const probe = {
    x: fish.prevX + Math.cos(fish.prevHeading) * lookAhead,
    y: fish.prevY + Math.sin(fish.prevHeading) * lookAhead * model.aspectRatio,
  };
  const avoidDistance = profile.bodyRadius + 0.047;
  let totalStrength = 0;

  for (const obstacle of AQUARIUM_REEF_OBSTACLES) {
    const distance = signedDistanceToAquariumReef(probe, obstacle, model.aspectRatio);
    if (distance >= avoidDistance) continue;
    const away = screenDeltaToWorld(
      probe.x - obstacle.cx,
      probe.y - obstacle.cy,
      model.aspectRatio,
    );
    const direction = normalized(away.x, away.y, -Math.cos(fish.prevHeading), -Math.sin(fish.prevHeading));
    const strength = clamp((avoidDistance - distance) / avoidDistance, 0, 2.2);
    force.x += direction.x * strength * 3.1;
    force.y += direction.y * strength * 3.1;
    totalStrength += strength;
  }

  if (totalStrength > 0) {
    fish.lastForces.reef = totalStrength;
    model.metrics.reefApplications += 1;
  }
}

function addShoalingForces(fish, profile, model, force) {
  if (profile.id !== "smallShoaler" || !fish.schoolId) return;

  let separationX = 0;
  let separationY = 0;
  let alignmentX = 0;
  let alignmentY = 0;
  let cohesionX = 0;
  let cohesionY = 0;
  let neighbors = 0;
  let separationMagnitude = 0;

  for (const other of model.fish) {
    if (other.id === fish.id || other.schoolId !== fish.schoolId) continue;
    model.metrics.neighborChecks += 1;
    const delta = screenDeltaToWorld(other.prevX - fish.prevX, other.prevY - fish.prevY, model.aspectRatio);
    const distance = magnitude(delta.x, delta.y);
    if (distance > profile.neighborRadius || distance < 1e-7) continue;
    neighbors += 1;
    alignmentX += Math.cos(other.prevHeading);
    alignmentY += Math.sin(other.prevHeading);
    cohesionX += delta.x;
    cohesionY += delta.y;
    if (distance < profile.separationRadius) {
      const pressure = 1 - distance / profile.separationRadius;
      separationX -= delta.x / distance * pressure;
      separationY -= delta.y / distance * pressure;
      separationMagnitude += pressure;
    }
  }

  if (!neighbors) return;
  const separation = normalized(separationX, separationY, 0, 0);
  const alignment = normalized(alignmentX, alignmentY, Math.cos(fish.prevHeading), Math.sin(fish.prevHeading));
  const cohesion = normalized(cohesionX / neighbors, cohesionY / neighbors, 0, 0);

  if (separationMagnitude > 0) {
    force.x += separation.x * profile.separationWeight * separationMagnitude;
    force.y += separation.y * profile.separationWeight * separationMagnitude;
    fish.lastForces.separation = separationMagnitude;
    model.metrics.separationApplications += 1;
  }
  force.x += alignment.x * profile.alignmentWeight;
  force.y += alignment.y * profile.alignmentWeight;
  force.x += cohesion.x * profile.cohesionWeight;
  force.y += cohesion.y * profile.cohesionWeight;
  fish.lastForces.alignment = profile.alignmentWeight;
  fish.lastForces.cohesion = profile.cohesionWeight;
}

function addStartleForce(fish, model, force) {
  if (fish.startle.until <= model.time || fish.startle.strength <= 0) {
    fish.startle.strength = 0;
    return false;
  }
  const duration = Math.max(1e-6, fish.startle.until - fish.startle.startedAt);
  const remaining = clamp((fish.startle.until - model.time) / duration, 0, 1);
  const strength = fish.startle.strength * remaining * remaining;
  force.x += fish.startle.x * strength * 4.4;
  force.y += fish.startle.y * strength * 4.4;
  fish.lastForces.startle = strength;
  model.metrics.startleApplications += 1;
  return true;
}

function updateDepth(fish, profile, model, dt) {
  if (model.time >= fish.depthDecisionAt) {
    fish.targetDepth = randomBetween(fish, profile.depthRange);
    fish.depthDecisionAt = model.time + randomBetween(fish, [5.8, 10.8]);
  }
  fish.depth = approach(fish.depth, fish.targetDepth, profile.depthRate * dt);
  fish.depth = clamp(fish.depth, profile.depthRange[0], profile.depthRange[1]);
}

function updateFish(fish, model, dt) {
  const profile = AQUARIUM_SPECIES_PROFILES[fish.profileId];
  clearForces(fish);
  advanceWaypoint(fish, profile, model);

  const target = fish.route[fish.routeIndex];
  const routeDelta = screenDeltaToWorld(target.x - fish.prevX, target.y - fish.prevY, model.aspectRatio);
  const routeDirection = normalized(routeDelta.x, routeDelta.y, Math.cos(fish.prevHeading), Math.sin(fish.prevHeading));
  const force = {
    x: routeDirection.x * profile.routeWeight,
    y: routeDirection.y * profile.routeWeight,
  };
  fish.lastForces.route = profile.routeWeight;

  const wander = Math.sin(model.time * profile.wanderFrequency + fish.wanderPhase) + fish.wanderBias * 0.35;
  force.x += -Math.sin(fish.prevHeading) * wander * profile.wanderWeight;
  force.y += Math.cos(fish.prevHeading) * wander * profile.wanderWeight;

  addShoalingForces(fish, profile, model, force);
  addBoundaryAvoidance(fish, profile, model, force);
  addReefAvoidance(fish, profile, model, force);
  const startled = addStartleForce(fish, model, force);

  const desiredDirection = normalized(force.x, force.y, Math.cos(fish.prevHeading), Math.sin(fish.prevHeading));
  const desiredHeading = Math.atan2(desiredDirection.y, desiredDirection.x);
  const headingError = Math.abs(wrapAngle(desiredHeading - fish.prevHeading));
  const maxTurnRate = startled ? profile.startleTurnRate : profile.maxTurnRate;
  fish.heading = approachAngle(fish.prevHeading, desiredHeading, maxTurnRate * dt);
  fish.lastTurnDelta = wrapAngle(fish.heading - fish.prevHeading);

  const turnSlowdown = lerp(1, 0.64, clamp(headingError / (Math.PI * 0.72), 0, 1));
  const depthFactor = lerp(0.94, 1.06, fish.depth);
  const normalTargetSpeed = clamp(profile.cruiseSpeed * turnSlowdown * depthFactor, profile.minSpeed, profile.maxSpeed);
  const startleTargetSpeed = clamp(
    normalTargetSpeed + fish.lastForces.startle * 0.03,
    profile.minSpeed,
    profile.startleSpeed,
  );
  const targetSpeed = startled ? startleTargetSpeed : normalTargetSpeed;
  const maxAcceleration = startled ? profile.startleAcceleration : profile.maxAcceleration;
  fish.speed = approach(fish.prevSpeed, targetSpeed, maxAcceleration * dt);
  fish.speed = clamp(fish.speed, profile.minSpeed, startled ? profile.startleSpeed : profile.maxSpeed);
  fish.lastAcceleration = (fish.speed - fish.prevSpeed) / dt;
  fish.lastLimits.maxTurnRate = maxTurnRate;
  fish.lastLimits.maxAcceleration = maxAcceleration;
  fish.lastLimits.maxSpeed = startled ? profile.startleSpeed : profile.maxSpeed;

  fish.position.x = fish.prevX + Math.cos(fish.heading) * fish.speed * dt;
  fish.position.y = fish.prevY + Math.sin(fish.heading) * fish.speed * dt * model.aspectRatio;

  const left = SWIM_BOUNDS.minX + profile.bodyRadius;
  const right = SWIM_BOUNDS.maxX - profile.bodyRadius;
  const top = SWIM_BOUNDS.minY + profile.bodyRadius * model.aspectRatio;
  const bottom = SWIM_BOUNDS.maxY - profile.bodyRadius * model.aspectRatio;
  fish.position.x = clamp(fish.position.x, left, right);
  fish.position.y = clamp(fish.position.y, top, bottom);
  fish.velocity.x = Math.cos(fish.heading) * fish.speed;
  fish.velocity.y = Math.sin(fish.heading) * fish.speed;
  if (Math.abs(Math.cos(fish.heading)) > 0.08) fish.direction = Math.cos(fish.heading) < 0 ? -1 : 1;
  updateDepth(fish, profile, model, dt);
}

export function createAquariumModel(options = {}) {
  const compact = Boolean(options.compact);
  const aspectRatio = Number.isFinite(options.aspectRatio) && options.aspectRatio > 0
    ? options.aspectRatio
    : DEFAULT_ASPECT_RATIO;
  const model = {
    version: 1,
    seed: String(options.seed ?? "concourse-course-aquarium-v2"),
    compact,
    aspectRatio,
    time: 0,
    accumulator: 0,
    fish: [],
    metrics: {
      stepCount: 0,
      neighborChecks: 0,
      separationApplications: 0,
      boundaryApplications: 0,
      reefApplications: 0,
      startleApplications: 0,
    },
  };

  const counts = compact ? AQUARIUM_PROFILE_COUNTS.compact : AQUARIUM_PROFILE_COUNTS.desktop;
  let globalIndex = 0;
  for (const profileId of ["smallShoaler", "reefPair", "solitaryCruiser"]) {
    for (let ordinal = 0; ordinal < counts[profileId]; ordinal += 1) {
      model.fish.push(createFish(model, profileId, ordinal, counts[profileId], globalIndex));
      globalIndex += 1;
    }
  }
  return model;
}

export function stepAquariumModel(model, dt = AQUARIUM_FIXED_STEP, options = {}) {
  if (!model || !Array.isArray(model.fish)) throw new TypeError("A valid aquarium model is required.");
  if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) throw new RangeError("Aquarium step must be between 0 and 0.25 seconds.");

  const pointer = options?.pointer;
  if (pointer && (pointer.startle === true || pointer.pressed === true)) {
    startleAquariumAt(model, pointer, pointer);
  }

  resetStepMetrics(model);
  for (const fish of model.fish) {
    fish.previousPosition.x = fish.position.x;
    fish.previousPosition.y = fish.position.y;
    fish.prevX = fish.position.x;
    fish.prevY = fish.position.y;
    fish.prevHeading = fish.heading;
    fish.prevSpeed = fish.speed;
  }

  model.time += dt;
  for (const fish of model.fish) updateFish(fish, model, dt);
  model.metrics.stepCount += 1;
  return model;
}

export function advanceAquariumModel(model, elapsedSeconds) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError("Elapsed aquarium time must be a non-negative finite number.");
  }
  const maximumAccumulator = AQUARIUM_FIXED_STEP * AQUARIUM_MAX_CATCH_UP_STEPS;
  model.accumulator = Math.min(maximumAccumulator, model.accumulator + elapsedSeconds);
  let steps = 0;
  while (model.accumulator + 1e-12 >= AQUARIUM_FIXED_STEP && steps < AQUARIUM_MAX_CATCH_UP_STEPS) {
    stepAquariumModel(model, AQUARIUM_FIXED_STEP);
    model.accumulator = Math.max(0, model.accumulator - AQUARIUM_FIXED_STEP);
    steps += 1;
  }
  return { steps, interpolation: clamp(model.accumulator / AQUARIUM_FIXED_STEP, 0, 1) };
}

export function startleAquariumAt(model, point, options = {}) {
  if (!model || !Array.isArray(model.fish)) throw new TypeError("A valid aquarium model is required.");
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError("A finite normalized pointer position is required.");
  }
  const radius = Number.isFinite(options.radius) ? clamp(options.radius, 0.04, 0.35) : 0.18;
  const strength = Number.isFinite(options.strength) ? clamp(options.strength, 0.25, 1.5) : 1;
  const distances = model.fish.map((fish) => ({
    fish,
    distance: worldDistance(point, fish.position, model.aspectRatio),
  })).sort((first, second) => first.distance - second.distance || first.fish.id.localeCompare(second.fish.id));
  const affected = [];

  for (const entry of distances) {
    if (entry.distance > radius) continue;
    const fish = entry.fish;
    const delta = screenDeltaToWorld(fish.position.x - point.x, fish.position.y - point.y, model.aspectRatio);
    const away = normalized(delta.x, delta.y, -Math.cos(fish.heading), -Math.sin(fish.heading));
    const falloff = Math.pow(1 - entry.distance / radius, 2);
    const response = strength * Math.max(0.12, falloff);
    fish.startle.x = away.x;
    fish.startle.y = away.y;
    fish.startle.strength = Math.max(fish.startle.strength, response);
    fish.startle.startedAt = model.time;
    fish.startle.until = model.time + lerp(0.55, 1.15, falloff);
    affected.push(fish.id);
  }

  if (!affected.length && distances.length) {
    const fish = distances[0].fish;
    const delta = screenDeltaToWorld(fish.position.x - point.x, fish.position.y - point.y, model.aspectRatio);
    const away = normalized(delta.x, delta.y, -Math.cos(fish.heading), -Math.sin(fish.heading));
    fish.startle.x = away.x;
    fish.startle.y = away.y;
    fish.startle.strength = strength * 0.35;
    fish.startle.startedAt = model.time;
    fish.startle.until = model.time + 0.62;
    affected.push(fish.id);
  }
  return affected;
}

export function startleFish(model, index, options = {}) {
  if (!model || !Array.isArray(model.fish)) throw new TypeError("A valid aquarium model is required.");
  if (!Number.isInteger(index) || index < 0 || index >= model.fish.length) {
    throw new RangeError("Fish index is outside the aquarium.");
  }
  const fish = model.fish[index];
  const point = Number.isFinite(options.x) && Number.isFinite(options.y)
    ? { x: options.x, y: options.y }
    : {
        x: fish.position.x + Math.cos(fish.heading) * 0.03,
        y: fish.position.y + Math.sin(fish.heading) * 0.03 * model.aspectRatio,
      };
  const delta = screenDeltaToWorld(fish.position.x - point.x, fish.position.y - point.y, model.aspectRatio);
  const away = normalized(delta.x, delta.y, -Math.cos(fish.heading), -Math.sin(fish.heading));
  const strength = Number.isFinite(options.strength) ? clamp(options.strength, 0.25, 1.5) : 1;
  const duration = Number.isFinite(options.duration) ? clamp(options.duration, 0.3, 1.4) : 0.82;
  fish.startle.x = away.x;
  fish.startle.y = away.y;
  fish.startle.strength = Math.max(fish.startle.strength, strength);
  fish.startle.startedAt = model.time;
  fish.startle.until = model.time + duration;
  return fish.id;
}

export function setAquariumAspectRatio(model, aspectRatio) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    throw new RangeError("Aquarium aspect ratio must be a positive finite number.");
  }
  model.aspectRatio = aspectRatio;
  return model;
}

export function aquariumRenderScale(fish) {
  return lerp(0.72, 1.08, clamp(fish.depth, 0, 1));
}

export function aquariumRenderAlpha(fish) {
  return lerp(0.8, 1, clamp(fish.depth, 0, 1));
}

export function aquariumRenderOrder(model) {
  return [...model.fish].sort((first, second) => first.depth - second.depth || first.id.localeCompare(second.id));
}

export function getFishRenderOrder(model) {
  return aquariumRenderOrder(model);
}

function rounded(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function aquariumModelSnapshot(model, digits = 6) {
  return {
    time: rounded(model.time, digits),
    accumulator: rounded(model.accumulator, digits),
    compact: model.compact,
    aspectRatio: rounded(model.aspectRatio, digits),
    fish: model.fish.map((fish) => ({
      id: fish.id,
      profile: fish.profile,
      profileId: fish.profileId,
      variant: fish.variant,
      schoolId: fish.schoolId,
      rngState: fish.rngState,
      x: rounded(fish.position.x, digits),
      y: rounded(fish.position.y, digits),
      heading: rounded(fish.heading, digits),
      direction: fish.direction,
      speed: rounded(fish.speed, digits),
      depth: rounded(fish.depth, digits),
      targetDepth: rounded(fish.targetDepth, digits),
      routeIndex: fish.routeIndex,
      route: fish.route.map((point) => [rounded(point.x, digits), rounded(point.y, digits)]),
    })),
  };
}

export const AQUARIUM_SWIM_BOUNDS = SWIM_BOUNDS;
