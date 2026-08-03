import test from "node:test";
import assert from "node:assert/strict";

import {
  AQUARIUM_FIXED_STEP,
  AQUARIUM_MAX_CATCH_UP_STEPS,
  AQUARIUM_PROFILE_COUNTS,
  AQUARIUM_REEF_OBSTACLES,
  AQUARIUM_SPECIES_PROFILES,
  AQUARIUM_SWIM_BOUNDS,
  advanceAquariumModel,
  aquariumModelSnapshot,
  aquariumRenderAlpha,
  aquariumRenderScale,
  createAquariumModel,
  getFishRenderOrder,
  setAquariumAspectRatio,
  signedDistanceToAquariumReef,
  startleAquariumAt,
  startleFish,
  stepAquariumModel,
} from "../courses/course-aquarium-model.mjs";

const EPSILON = 1e-9;

function countProfiles(model) {
  return model.fish.reduce((counts, fish) => {
    counts[fish.profile] = (counts[fish.profile] || 0) + 1;
    return counts;
  }, {});
}

function runSteps(model, count, dt = AQUARIUM_FIXED_STEP) {
  for (let index = 0; index < count; index += 1) stepAquariumModel(model, dt);
  return model;
}

test("desktop and compact models expose the required species populations and renderer fields", () => {
  const desktop = createAquariumModel({ seed: "population-test" });
  const compact = createAquariumModel({ seed: "population-test", compact: true });

  assert.deepEqual(countProfiles(desktop), AQUARIUM_PROFILE_COUNTS.desktop);
  assert.deepEqual(countProfiles(compact), AQUARIUM_PROFILE_COUNTS.compact);
  assert.equal(desktop.fish.length, 12);
  assert.equal(compact.fish.length, 8);
  assert.equal(new Set(desktop.fish.map((fish) => fish.id)).size, desktop.fish.length);

  for (const fish of desktop.fish) {
    assert.equal(fish.profile, fish.profileId);
    assert.equal(fish.variant, fish.spriteVariant);
    assert.ok(Number.isFinite(fish.position.x) && Number.isFinite(fish.position.y));
    assert.ok(Number.isFinite(fish.velocity.x) && Number.isFinite(fish.velocity.y));
    assert.ok(Number.isFinite(fish.heading));
    assert.ok(fish.direction === -1 || fish.direction === 1);
    assert.equal(fish.route.length, 4);
  }
});

test("seeded trajectories are reproducible but independent per fish", () => {
  const first = createAquariumModel({ seed: "repeatable-water" });
  const second = createAquariumModel({ seed: "repeatable-water" });
  const different = createAquariumModel({ seed: "different-water" });
  const signatures = new Map(first.fish.map((fish) => [fish.id, []]));

  for (let step = 0; step < 480; step += 1) {
    stepAquariumModel(first);
    stepAquariumModel(second);
    stepAquariumModel(different);
    if (step % 80 === 0) {
      for (const fish of first.fish) {
        signatures.get(fish.id).push(`${fish.position.x.toFixed(5)},${fish.position.y.toFixed(5)}`);
      }
    }
  }

  assert.deepEqual(aquariumModelSnapshot(first), aquariumModelSnapshot(second));
  assert.notDeepEqual(aquariumModelSnapshot(first), aquariumModelSnapshot(different));
  assert.equal(new Set([...signatures.values()].map((points) => points.join("|"))).size, first.fish.length);
});

test("separation belongs only to the small shoal and the update remains pairwise-bounded", () => {
  const model = createAquariumModel({ seed: "shoaling-test" });
  const shoalers = model.fish.filter((fish) => fish.profile === "smallShoaler");
  shoalers[0].position = { x: 0.42, y: 0.32 };
  shoalers[1].position = { x: 0.425, y: 0.32 };

  stepAquariumModel(model);

  assert.ok(shoalers[0].lastForces.separation > 0);
  assert.ok(shoalers[1].lastForces.separation > 0);
  for (const fish of model.fish.filter((candidate) => candidate.profile !== "smallShoaler")) {
    assert.equal(fish.schoolId, null);
    assert.equal(AQUARIUM_SPECIES_PROFILES[fish.profile].separationWeight, 0);
    assert.equal(fish.lastForces.separation, 0);
    assert.equal(fish.lastForces.alignment, 0);
    assert.equal(fish.lastForces.cohesion, 0);
  }
  assert.ok(model.metrics.neighborChecks <= shoalers.length * (shoalers.length - 1));
});

test("motion obeys turn, acceleration, speed, depth, boundary, and reef limits", () => {
  const model = createAquariumModel({ seed: "limits-test" });

  for (let step = 0; step < 1800; step += 1) {
    const previousDepth = new Map(model.fish.map((fish) => [fish.id, fish.depth]));
    stepAquariumModel(model);

    for (const fish of model.fish) {
      const profile = AQUARIUM_SPECIES_PROFILES[fish.profile];
      assert.ok(Math.abs(fish.lastTurnDelta) <= fish.lastLimits.maxTurnRate * AQUARIUM_FIXED_STEP + EPSILON);
      assert.ok(Math.abs(fish.lastAcceleration) <= fish.lastLimits.maxAcceleration + EPSILON);
      assert.ok(fish.speed >= profile.minSpeed - EPSILON);
      assert.ok(fish.speed <= fish.lastLimits.maxSpeed + EPSILON);
      assert.ok(Math.abs(fish.depth - previousDepth.get(fish.id)) <= profile.depthRate * AQUARIUM_FIXED_STEP + EPSILON);
      assert.ok(fish.depth >= profile.depthRange[0] - EPSILON);
      assert.ok(fish.depth <= profile.depthRange[1] + EPSILON);
      assert.ok(fish.position.x >= AQUARIUM_SWIM_BOUNDS.minX + profile.bodyRadius - EPSILON);
      assert.ok(fish.position.x <= AQUARIUM_SWIM_BOUNDS.maxX - profile.bodyRadius + EPSILON);
      assert.ok(fish.position.y >= AQUARIUM_SWIM_BOUNDS.minY + profile.bodyRadius * model.aspectRatio - EPSILON);
      assert.ok(fish.position.y <= AQUARIUM_SWIM_BOUNDS.maxY - profile.bodyRadius * model.aspectRatio + EPSILON);
      for (const reef of AQUARIUM_REEF_OBSTACLES) {
        assert.ok(signedDistanceToAquariumReef(fish.position, reef, model.aspectRatio) > -profile.bodyRadius);
      }
    }
  }
});

test("pointer and indexed startles turn fish away, decay, and retain normal caps afterward", () => {
  const model = createAquariumModel({ seed: "startle-test" });
  const target = model.fish[0];
  const pointer = { x: target.position.x + 0.01, y: target.position.y, strength: 1.2 };
  const affected = startleAquariumAt(model, pointer, { radius: 0.08, strength: pointer.strength });

  assert.ok(affected.includes(target.id));
  stepAquariumModel(model);
  assert.ok(target.lastForces.startle > 0);
  assert.ok(Math.cos(target.heading) < Math.cos(target.prevHeading) || target.lastTurnDelta !== 0);

  const indexedId = startleFish(model, 1, { x: model.fish[1].position.x, y: model.fish[1].position.y, strength: 1 });
  assert.equal(indexedId, model.fish[1].id);
  stepAquariumModel(model, AQUARIUM_FIXED_STEP, {
    pointer: { ...model.fish[2].position, pressed: true, strength: 0.8, radius: 0.06 },
  });
  assert.ok(model.fish[2].startle.strength > 0);

  runSteps(model, 60);
  for (const fish of model.fish) {
    assert.equal(fish.startle.strength, 0);
    assert.ok(fish.speed <= AQUARIUM_SPECIES_PROFILES[fish.profile].maxSpeed + EPSILON);
  }
});

test("fixed-step advancement is refresh-rate independent and limits long-frame catch-up", () => {
  const sixtyHertz = createAquariumModel({ seed: "fixed-step" });
  const thirtyHertz = createAquariumModel({ seed: "fixed-step" });

  for (let frame = 0; frame < 60; frame += 1) advanceAquariumModel(sixtyHertz, 1 / 60);
  for (let frame = 0; frame < 30; frame += 1) advanceAquariumModel(thirtyHertz, 1 / 30);
  assert.deepEqual(aquariumModelSnapshot(sixtyHertz), aquariumModelSnapshot(thirtyHertz));

  const catchUp = advanceAquariumModel(sixtyHertz, 5);
  assert.equal(catchUp.steps, AQUARIUM_MAX_CATCH_UP_STEPS);
  assert.ok(catchUp.interpolation >= 0 && catchUp.interpolation <= 1);
});

test("aspect changes preserve trajectories and render helpers use stable depth ordering", () => {
  const model = runSteps(createAquariumModel({ seed: "render-test" }), 24);
  const before = model.fish.map((fish) => ({
    id: fish.id,
    position: { ...fish.position },
    velocity: { ...fish.velocity },
    route: fish.route.map((point) => ({ ...point })),
    rngState: fish.rngState,
  }));

  setAquariumAspectRatio(model, 1.8);
  const after = model.fish.map((fish) => ({
    id: fish.id,
    position: { ...fish.position },
    velocity: { ...fish.velocity },
    route: fish.route.map((point) => ({ ...point })),
    rngState: fish.rngState,
  }));
  assert.deepEqual(after, before);

  const ordered = getFishRenderOrder(model);
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(ordered[index - 1].depth <= ordered[index].depth);
  }
  assert.ok(aquariumRenderScale({ depth: 0.2 }) < aquariumRenderScale({ depth: 0.8 }));
  assert.ok(aquariumRenderAlpha({ depth: 0.2 }) < aquariumRenderAlpha({ depth: 0.8 }));
});
