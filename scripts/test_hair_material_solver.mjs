#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  blendPairFriction,
  HairSolver,
  MATERIAL_PRESETS,
  projectCohesionPair,
  projectPair,
} from "../physics/labs/hair_material/demo/solver.js";

function nearlyEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

{
  const velocityA = [1.5, -0.25, 0.75];
  const velocityB = [-0.5, 0.75, -0.25];
  const beforeRelative = Math.hypot(...velocityA.map((value, axis) => value - velocityB[axis]));
  const [nextA, nextB] = blendPairFriction(velocityA, velocityB, 0.6);
  for (let axis = 0; axis < 3; axis += 1) {
    nearlyEqual(nextA[axis] + nextB[axis], velocityA[axis] + velocityB[axis]);
  }
  const afterRelative = Math.hypot(...nextA.map((value, axis) => value - nextB[axis]));
  assert.ok(afterRelative < beforeRelative);
}

{
  const beforeA = [0, 0, 0];
  const beforeB = [0.3, 0, 0];
  const result = projectCohesionPair(beforeA, beforeB, 0.06, 0.5, 0.2);
  assert.equal(result.active, true);
  for (let axis = 0; axis < 3; axis += 1) {
    nearlyEqual(result.correctionA[axis] + result.correctionB[axis], 0);
  }
  const afterA = beforeA.map((value, axis) => value + result.correctionA[axis]);
  const afterB = beforeB.map((value, axis) => value + result.correctionB[axis]);
  assert.ok(Math.hypot(...afterB.map((value, axis) => value - afterA[axis])) < 0.3);
}

{
  const massA = 2.5;
  const massB = 0.75;
  const result = projectPair([0, 0, 0], [2, 0, 0], 1 / massA, 1 / massB, 1, 0.8);
  for (let axis = 0; axis < 3; axis += 1) {
    nearlyEqual(massA * result.correctionA[axis] + massB * result.correctionB[axis], 0);
  }
  assert.ok(Math.abs(result.afterError) < Math.abs(result.beforeError));
}

{
  const solver = new HairSolver({ guideCount: 24, segments: 8, preset: "curly", iterations: 6 });
  assert.ok(solver.neighborPairs.length >= solver.guideCount);
  assert.ok(solver.neighborPairs.length <= solver.guideCount * 3);
  const roots = Array.from(solver.roots);
  for (let frame = 0; frame < 180; frame += 1) solver.step(1 / 60);
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    const index = solver.index(strand, 0);
    for (let axis = 0; axis < 3; axis += 1) {
      nearlyEqual(solver.positions[index + axis], roots[strand * 3 + axis]);
    }
  }
  assert.ok(solver.maxStretchError < 0.08, `stretch error ${solver.maxStretchError}`);
}

{
  const solver = new HairSolver({ guideCount: 12, segments: 7 });
  const before = solver.receipt().active_segments;
  assert.equal(solver.cutStrand(3, 4), true);
  assert.equal(solver.activeSegments[3], 4);
  assert.equal(solver.receipt().active_segments, before - 3);
  assert.equal(solver.cutStrand(3, 6), false);
}

{
  const spans = {};
  for (const preset of Object.keys(MATERIAL_PRESETS)) {
    const solver = new HairSolver({ guideCount: 8, segments: 12, preset });
    const root = solver.index(0, 0);
    const tip = solver.index(0, 12);
    spans[preset] = Math.hypot(
      solver.rest[tip] - solver.rest[root],
      solver.rest[tip + 1] - solver.rest[root + 1],
      solver.rest[tip + 2] - solver.rest[root + 2]
    );
  }
  assert.ok(spans.coily < spans.straight);
  assert.equal(new Set(Object.values(spans).map((value) => value.toFixed(5))).size, 4);
}

console.log("hair material solver: ok");
