#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  closestSegmentPoints,
  discoverSegmentPairs,
  hairSolverPersistentPairs,
  hairSolverSegments,
  paddedSegmentAabbsOverlap,
  quantizeSquaredRisk,
  rankSpatialCandidates,
  segmentAabbGapSquared,
  segmentAabbCellKeys,
  segmentSegmentDistanceSquared,
} from "../physics/labs/hair_material/demo/contact_discovery.js";
import { barycentricEndpointWeights } from "../physics/labs/hair_material/demo/friction.js";
import { runHairRodReference } from "../physics/labs/hair_material/demo/rod_reference.js";
import { spatialFrictionPerformanceReceipt } from "../physics/labs/hair_material/demo/spatial_friction.js";
import {
  fatlineColorScale,
  fatlineHalfWidthAt,
  fiberEmergenceScaleAt,
  float32BufferDigest,
  fullGroomHydrationAtStep,
  FULL_GROOM_HYDRATION_ID,
  hairFiberColorAt,
  HAIR_FIBER_SHADING_ID,
  HAIR_PRESENTATION_LOOP_ID,
  presentationLoopOpacityAtStep,
  reelCameraPoseAtStep,
  REEL_CAMERA_FIELD_ID,
  sectionPosePresentationAtStep,
  summarizeGeometryTimings,
} from "../physics/labs/hair_material/demo/rendering.js";
import {
  buildGroomInterpolationBindings,
  groomBindingActiveSegments,
  groomInterpolationReceipt,
  groomSecondaryWeightAt,
  groomSectionId,
  interpolateGroomScalar,
} from "../physics/labs/hair_material/demo/groom_interpolation.js";
import {
  bakeRootDirectorTarget,
  projectRootDirectorPoint,
} from "../physics/labs/hair_material/demo/root_director.js";
import {
  bakeStyledRootDirection,
  ROOT_STYLE_FIELD_ID,
  ROOT_STYLE_MIN_OUTWARD_DOT,
  summarizeRootTargets,
} from "../physics/labs/hair_material/demo/root_style_field.js";
import {
  digestContactTrace,
  snapshotRankedContacts,
  summarizeContactTransition,
} from "../physics/labs/hair_material/demo/contact_churn.js";

import {
  blendPairAnisotropicFriction,
  blendPairFriction,
  HairSolver,
  MATERIAL_PRESETS,
  projectCohesionPair,
  projectCombSweep,
  projectPair,
  projectPressurePair,
  updateClumpBond,
} from "../physics/labs/hair_material/demo/solver.js";
import {
  advanceHairReplay,
  COMB_MATERIAL_CONDITIONS,
  createReplayState,
  digestHairState,
  runHairReplay,
  sectionLiftEnvelopeAtStep,
  sectionPoseEnvelopeAtStep,
  summarizeCombReceipt,
} from "../physics/labs/hair_material/demo/replay.js";

function nearlyEqual(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

{
  assert.equal(HAIR_FIBER_SHADING_ID, "tangent_dual_lobe_root_emergence_v2");
  assert.equal(HAIR_PRESENTATION_LOOP_ID, "fade_reset_450_step_v1");
  assert.equal(REEL_CAMERA_FIELD_ID, "three_shot_orbit_450_step_v1");
  assert.equal(FULL_GROOM_HYDRATION_ID, "section_guide_cage_hydration_450_v1");
  nearlyEqual(presentationLoopOpacityAtStep(0), 0);
  nearlyEqual(presentationLoopOpacityAtStep(15), 0.5);
  nearlyEqual(presentationLoopOpacityAtStep(30), 1);
  nearlyEqual(presentationLoopOpacityAtStep(420), 1);
  nearlyEqual(presentationLoopOpacityAtStep(435), 0.5);
  nearlyEqual(presentationLoopOpacityAtStep(450), 0);
  const root = hairFiberColorAt({ r: 0.4, g: 0.2, b: 0.1 }, 8, 3, 0);
  const tip = hairFiberColorAt({ r: 0.4, g: 0.2, b: 0.1 }, 8, 3, 1);
  assert.ok(root.r < tip.r);
  assert.ok(root.g < tip.g);
  assert.ok(root.b < tip.b);
  assert.deepEqual(tip, hairFiberColorAt({ r: 0.4, g: 0.2, b: 0.1 }, 8, 3, 1));
  assert.equal(fiberEmergenceScaleAt(8, 0, 0, 12), 0);
  assert.ok(fiberEmergenceScaleAt(8, 0, 1, 12) > 0.99);
  assert.equal(fiberEmergenceScaleAt(8, 3, 0, 12), 0);
  assert.equal(fiberEmergenceScaleAt(8, 3, 12, 12), 1);
  assert.ok(fiberEmergenceScaleAt(8, 3, 1, 12) <= fiberEmergenceScaleAt(8, 3, 2, 12));
  assert.deepEqual(reelCameraPoseAtStep(0, "beauty"), reelCameraPoseAtStep(450, "beauty"));
  assert.notDeepEqual(reelCameraPoseAtStep(0, "beauty"), reelCameraPoseAtStep(225, "beauty"));
  assert.notDeepEqual(reelCameraPoseAtStep(330, "control"), reelCameraPoseAtStep(330, "cut"));
  assert.equal(reelCameraPoseAtStep(0, "free"), null);
  assert.deepEqual(fullGroomHydrationAtStep(0), {
    phase: "physics_cage",
    hairHydration: 0,
    guideOpacity: 0.88,
    tubeOpacity: 0.22,
  });
  assert.equal(fullGroomHydrationAtStep(45).phase, "hydrating");
  assert.equal(fullGroomHydrationAtStep(45).hairHydration, 0);
  assert.ok(fullGroomHydrationAtStep(90).hairHydration > 0.5);
  assert.ok(fullGroomHydrationAtStep(90).guideOpacity > 0.14);
  assert.deepEqual(fullGroomHydrationAtStep(120), {
    phase: "guide_release",
    hairHydration: 1,
    guideOpacity: 0.14,
    tubeOpacity: 0.044,
  });
  assert.deepEqual(fullGroomHydrationAtStep(150), {
    phase: "hydrated",
    hairHydration: 1,
    guideOpacity: 0,
    tubeOpacity: 0,
  });
}

{
  const cycle = { startStep: 30, peakStep: 90, holdEndStep: 170, endStep: 255 };
  assert.deepEqual(sectionPosePresentationAtStep(0, cycle), {
    phase: "authoring",
    hydration: 0.08,
    tubeOpacity: 0,
  });
  assert.equal(sectionPosePresentationAtStep(20, cycle).phase, "authoring");
  assert.ok(sectionPosePresentationAtStep(20, cycle).tubeOpacity > 0.1);
  assert.equal(sectionPosePresentationAtStep(60, cycle).phase, "hydrating");
  nearlyEqual(sectionPosePresentationAtStep(60, cycle).hydration, 0.54);
  assert.deepEqual(sectionPosePresentationAtStep(90, cycle), {
    phase: "hydrated",
    hydration: 1,
    tubeOpacity: 0.055,
  });
  assert.equal(sectionPosePresentationAtStep(180, cycle).phase, "dissolving");
  assert.deepEqual(sectionPosePresentationAtStep(215, cycle), {
    phase: "simulation",
    hydration: 1,
    tubeOpacity: 0,
  });
  assert.deepEqual(sectionPosePresentationAtStep(0), {
    phase: "static_control",
    hydration: 1,
    tubeOpacity: 0.14,
  });
}

{
  assert.ok(fatlineHalfWidthAt(0, 12) > fatlineHalfWidthAt(6, 12));
  assert.ok(fatlineHalfWidthAt(6, 12) > fatlineHalfWidthAt(12, 12));
  nearlyEqual(fatlineHalfWidthAt(0, 12), 0.84);
  nearlyEqual(fatlineHalfWidthAt(12, 12), 0.07);
  nearlyEqual(fatlineHalfWidthAt(12, 12), fatlineHalfWidthAt(24, 12));
  assert.equal(fatlineColorScale(8, 3), fatlineColorScale(8, 3));
  assert.notEqual(fatlineColorScale(8, 3), fatlineColorScale(8, 4));
  assert.equal(float32BufferDigest(new Float32Array([1, 2, 3])), "e971f89a");
  assert.deepEqual(summarizeGeometryTimings([10, 20], 2), {
    measured_frames: 0,
    max_ms: null,
    p99_ms: null,
    mean_ms: null,
  });
  assert.deepEqual(summarizeGeometryTimings([100, 1, 4, 2, 3], 1), {
    measured_frames: 4,
    max_ms: 4,
    p99_ms: 4,
    mean_ms: 2.5,
  });
}

{
  const target = new Float64Array(3);
  bakeRootDirectorTarget(1, 0, 0, 0, -1, 0, 0.75, target);
  nearlyEqual(Math.hypot(...target), 1);
  assert.ok(target[0] > 0);
  const projection = new Float64Array(6);
  projectRootDirectorPoint(0, 0, 0, 0, -1, 0, ...target, 1, 0.25, projection);
  nearlyEqual(Math.hypot(projection[0], projection[1], projection[2]), 1);
  assert.ok(projection[3] > projection[5]);
  assert.ok(projection[4] > 0);
  const unchanged = new Float64Array(6);
  projectRootDirectorPoint(0, 0, 0, 0, -1, 0, ...target, 1, 0, unchanged);
  nearlyEqual(unchanged[0], 0);
  nearlyEqual(unchanged[1], -1);
  nearlyEqual(unchanged[2], 0);
}

{
  const field = new Float64Array(6);
  bakeStyledRootDirection(-0.18, 2.42, 0.12, 0, 1, 0, field);
  nearlyEqual(Math.hypot(field[0], field[1], field[2]), 1);
  const outwardDot = field[1];
  assert.ok(outwardDot >= ROOT_STYLE_MIN_OUTWARD_DOT - 1e-10);
  assert.ok(field[3] >= 0 && field[3] < 8);
  nearlyEqual(field[4], outwardDot);
  nearlyEqual(field[5], Math.sqrt(1 - outwardDot * outwardDot));
}

{
  const roots = new Float64Array([
    1, 1, 0, 0.8, 1.1, 0.2, 0.5, 1.2, 0.5, -0.5, 1.2, 0.5, -0.8, 1.1, 0.2, -1, 1, 0, -0.5, 0.9,
    -0.5, 0.5, 0.9, -0.5,
  ]);
  const bindings = buildGroomInterpolationBindings(roots, 8, 5);
  const repeated = buildGroomInterpolationBindings(roots, 8, 5);
  assert.equal(bindings.bindingCount, 40);
  assert.equal(bindings.bindingDigest, repeated.bindingDigest);
  assert.notEqual(
    bindings.bindingDigest,
    buildGroomInterpolationBindings(roots, 8, 4).bindingDigest
  );
  for (let guide = 0; guide < 8; guide += 1) {
    assert.ok(groomSectionId(roots[guide * 3], roots[guide * 3 + 2]) < 8);
    const pureOwner = guide * 5;
    assert.equal(bindings.owners[pureOwner], guide);
    assert.equal(bindings.neighbors[pureOwner], guide);
    assert.equal(bindings.neighborWeights[pureOwner], 0);
  }
  for (let binding = 0; binding < bindings.bindingCount; binding += 1) {
    assert.ok(bindings.neighborWeights[binding] >= 0);
    assert.ok(bindings.neighborWeights[binding] <= 1);
    const leftSection = bindings.sections[bindings.owners[binding]];
    const rightSection = bindings.sections[bindings.neighbors[binding]];
    const direct = Math.abs(leftSection - rightSection);
    assert.ok(Math.min(direct, 8 - direct) <= 1);
  }
  nearlyEqual(interpolateGroomScalar(2, 10, 0), 2);
  nearlyEqual(interpolateGroomScalar(2, 10, 0.25), 4);
  const activeSegments = new Uint16Array([12, 5]);
  assert.equal(groomBindingActiveSegments(activeSegments, 0, 1, 0), 12);
  assert.equal(groomBindingActiveSegments(activeSegments, 0, 1, 0.25), 5);
  assert.deepEqual(groomInterpolationReceipt(bindings, 1), {
    mode: "section_interp_2parent",
    section_count: 8,
    section_search_radius: 1,
    parent_count: 2,
    nearest_neighbors_per_guide: 3,
    binding_count: 40,
    binding_digest: bindings.bindingDigest,
    binding_build_count: 1,
    cut_length_rule: "pure_owner_else_min_parents",
    secondary_weight_envelope: "none",
    secondary_cut_fade_segments: 0,
  });

  const volumeBindings = buildGroomInterpolationBindings(roots, 8, 5, { parentCount: 3 });
  const repeatedVolumeBindings = buildGroomInterpolationBindings(roots, 8, 5, {
    parentCount: 3,
  });
  assert.equal(volumeBindings.bindingDigest, repeatedVolumeBindings.bindingDigest);
  assert.notEqual(volumeBindings.bindingDigest, bindings.bindingDigest);
  for (let binding = 0; binding < volumeBindings.bindingCount; binding += 1) {
    const primaryWeight = volumeBindings.neighborWeights[binding];
    const secondaryWeight = volumeBindings.secondaryNeighborWeights[binding];
    assert.ok(primaryWeight >= 0);
    assert.ok(secondaryWeight >= 0);
    assert.ok(primaryWeight + secondaryWeight <= 0.36 + 1e-6);
    if (secondaryWeight > 0) {
      assert.notEqual(
        volumeBindings.neighbors[binding],
        volumeBindings.secondaryNeighbors[binding]
      );
    }
    const ownerSection = volumeBindings.sections[volumeBindings.owners[binding]];
    const secondarySection = volumeBindings.sections[volumeBindings.secondaryNeighbors[binding]];
    const direct = Math.abs(ownerSection - secondarySection);
    assert.ok(Math.min(direct, 8 - direct) <= 1);
  }
  nearlyEqual(interpolateGroomScalar(2, 10, 0.25, 18, 0.25), 8);
  nearlyEqual(groomSecondaryWeightAt(0, 12, 0.2), 0);
  nearlyEqual(groomSecondaryWeightAt(5, 12, 0.2), 0);
  assert.ok(groomSecondaryWeightAt(8, 12, 0.2) > 0);
  nearlyEqual(groomSecondaryWeightAt(12, 12, 0.2), 0.2);
  const volumeActiveSegments = new Uint16Array([12, 5, 3]);
  assert.equal(groomBindingActiveSegments(volumeActiveSegments, 0, 1, 0.2), 5);
  nearlyEqual(groomSecondaryWeightAt(7, 12, 0.2, 9), groomSecondaryWeightAt(7, 12, 0.2));
  assert.ok(groomSecondaryWeightAt(8, 12, 0.2, 9) > 0);
  assert.ok(groomSecondaryWeightAt(8, 12, 0.2, 9) < groomSecondaryWeightAt(8, 12, 0.2));
  nearlyEqual(groomSecondaryWeightAt(9, 12, 0.2, 9), 0);
  nearlyEqual(groomSecondaryWeightAt(10, 12, 0.2, 9), 0);
  assert.deepEqual(groomInterpolationReceipt(volumeBindings, 1), {
    mode: "section_interp_3parent",
    section_count: 8,
    section_search_radius: 1,
    parent_count: 3,
    nearest_neighbors_per_guide: 3,
    binding_count: 40,
    binding_digest: volumeBindings.bindingDigest,
    binding_build_count: 1,
    cut_length_rule: "owner_primary_length_secondary_donor_fade",
    secondary_weight_envelope: "smoothstep_45pct_to_90pct",
    secondary_cut_fade_segments: 2,
  });

  const productionGroomSolver = new HairSolver({ guideCount: 256, segments: 12 });
  const productionTwoParent = buildGroomInterpolationBindings(
    productionGroomSolver.roots,
    productionGroomSolver.guideCount,
    15
  );
  const productionThreeParent = buildGroomInterpolationBindings(
    productionGroomSolver.roots,
    productionGroomSolver.guideCount,
    15,
    { parentCount: 3 }
  );
  assert.equal(productionTwoParent.bindingDigest, "74bfb34c");
  assert.equal(productionThreeParent.bindingDigest, "0be410f0");
}

{
  const crossing = [
    { id: 10, guide: 0, a: [-0.6, 0, 0], b: [0.6, 0, 0] },
    { id: 21, guide: 1, a: [0, -0.6, 0], b: [0, 0.6, 0] },
  ];
  assert.ok(segmentAabbCellKeys(crossing[0], 0.25).length > 2);
  assert.equal(paddedSegmentAabbsOverlap(crossing[0], crossing[1]), true);
  nearlyEqual(segmentAabbGapSquared(crossing[0], crossing[1]), 0);
  nearlyEqual(segmentSegmentDistanceSquared(crossing[0], crossing[1]), 0);
  nearlyEqual(segmentSegmentDistanceSquared(crossing[1], crossing[0]), 0);
  const closest = closestSegmentPoints(crossing[0], crossing[1]);
  nearlyEqual(closest.distance_squared, 0);
  nearlyEqual(closest.left_parameter, 0.5);
  nearlyEqual(closest.right_parameter, 0.5);
  assert.deepEqual(closest.left_point, closest.right_point);
  const forward = discoverSegmentPairs(crossing, { cellSize: 0.25, maxPairs: 10 });
  const reverse = discoverSegmentPairs([...crossing].reverse(), { cellSize: 0.25, maxPairs: 10 });
  assert.deepEqual(forward.pairs, [{ a: 10, b: 21 }]);
  assert.equal(forward.pair_digest, reverse.pair_digest);
  assert.equal(forward.global_saturated, false);
}

{
  const pointA = { a: [0, 0, 0], b: [0, 0, 0] };
  const pointB = { a: [1, 2, 2], b: [1, 2, 2] };
  nearlyEqual(segmentSegmentDistanceSquared(pointA, pointB), 9);
  const line = { a: [-1, 0, 0], b: [1, 0, 0] };
  nearlyEqual(segmentSegmentDistanceSquared(pointB, line), 8);
  const parallel = { a: [-1, 1, 0], b: [1, 1, 0] };
  nearlyEqual(segmentSegmentDistanceSquared(line, parallel), 1);
  nearlyEqual(segmentSegmentDistanceSquared(parallel, line), 1);
  const reversed = { a: [...parallel.b], b: [...parallel.a] };
  nearlyEqual(segmentSegmentDistanceSquared(line, reversed), 1);
  const pointLineClosest = closestSegmentPoints(pointB, line);
  nearlyEqual(pointLineClosest.left_parameter, 0);
  nearlyEqual(pointLineClosest.right_parameter, 1);
  const forwardClosest = closestSegmentPoints(line, parallel);
  const swappedClosest = closestSegmentPoints(parallel, line);
  nearlyEqual(forwardClosest.distance_squared, swappedClosest.distance_squared);
  nearlyEqual(forwardClosest.left_parameter, swappedClosest.right_parameter);
  nearlyEqual(forwardClosest.right_parameter, swappedClosest.left_parameter);
  assert.ok(quantizeSquaredRisk(0.1) <= quantizeSquaredRisk(0.2));
  assert.deepEqual(barycentricEndpointWeights(-1), [1, 0]);
  assert.deepEqual(barycentricEndpointWeights(0.25), [0.75, 0.25]);
  assert.deepEqual(barycentricEndpointWeights(2), [0, 1]);
}

{
  function snapshot(step, pairs, activeSegmentIds = [0, 1, 2, 3]) {
    return snapshotRankedContacts({
      step,
      stateDigest: `state-${step}`,
      cutCount: step > 0 ? 1 : 0,
      activeSegmentIds: new Set(activeSegmentIds),
      ranking: {
        admitted_pairs: pairs,
        admitted_pair_digest: `pairs-${step}`,
        all_persistent_retained: true,
        admitted_spatial_zero_risk_count: 0,
        dropped_global_count: 0,
        dropped_per_segment_count: 0,
        dropped_global_zero_risk_count: 0,
        dropped_per_segment_zero_risk_count: 0,
        worst_admitted_spatial_risk_q: 10,
        best_global_drop_risk_q: null,
        best_per_segment_drop_risk_q: null,
        spatial_force_integration: false,
      },
    });
  }
  const first = snapshot(0, [
    { a: 0, b: 1, source: "persistent" },
    { a: 1, b: 2, source: "spatial", risk_q: 10 },
  ]);
  const second = snapshot(
    1,
    [
      { a: 1, b: 2, source: "spatial", risk_q: 10 },
      { a: 2, b: 3, source: "spatial", risk_q: 10 },
    ],
    [1, 2, 3]
  );
  const transition = summarizeContactTransition(first, second);
  assert.equal(transition.step_delta, 1);
  assert.equal(transition.intersection_count, 1);
  assert.equal(transition.union_count, 3);
  assert.equal(transition.additions_count, 1);
  assert.equal(transition.removals_count, 1);
  assert.equal(transition.symmetric_difference_count, 2);
  nearlyEqual(transition.jaccard, 1 / 3);
  assert.equal(transition.removals_incident_to_inactive_segments, 1);
  assert.equal(transition.removals_with_both_segments_active, 0);
  assert.equal(transition.rank_frontier_crossing_count, 1);
  assert.equal(
    digestContactTrace([first.receipt, second.receipt], [transition]),
    digestContactTrace([first.receipt, second.receipt], [transition])
  );
}

{
  const center = { id: 0, guide: 0, a: [-1, 0, 0], b: [1, 0, 0] };
  const neighbors = Array.from({ length: 6 }, (_value, index) => ({
    id: index + 1,
    guide: index + 1,
    a: [-1, (index + 1) * 0.01, 0],
    b: [1, (index + 1) * 0.01, 0],
  }));
  const ranked = rankSpatialCandidates(
    [center, ...neighbors],
    neighbors.map((neighbor) => ({ a: 0, b: neighbor.id })),
    [],
    { maxPairs: 3, maxNewPairsPerSegment: 3, riskMetric: "segment_distance_squared" }
  );
  assert.deepEqual(
    ranked.admitted_pairs.map((pair) => pair.b),
    [1, 2, 3]
  );
  assert.equal(ranked.dropped_per_segment_zero_risk_count, 0);
}

{
  const crowded = Array.from({ length: 5 }, (_value, id) => ({
    id,
    guide: id,
    a: [0, 0, 0],
    b: [0.1, 0.1, 0.1],
  }));
  const bounded = discoverSegmentPairs(crowded, {
    cellSize: 0.5,
    maxPairsPerSegment: 1,
    maxPairs: 2,
  });
  assert.ok(bounded.unbounded_candidate_count > bounded.emitted_candidate_count);
  assert.ok(bounded.saturated_segment_ids.length > 0);

  const ranking = rankSpatialCandidates(
    crowded,
    discoverSegmentPairs(crowded, {
      cellSize: 0.5,
      maxPairsPerSegment: 100,
      maxPairs: 100,
    }).pairs,
    [{ a: 0, b: 4 }],
    { maxPairs: 4, maxNewPairsPerSegment: 1 }
  );
  assert.equal(ranking.admitted_pairs[0].source, "persistent");
  assert.deepEqual(
    { a: ranking.admitted_pairs[0].a, b: ranking.admitted_pairs[0].b },
    { a: 0, b: 4 }
  );
  assert.equal(ranking.all_persistent_retained, true);
  assert.ok(ranking.dropped_per_segment_count > 0);
  assert.equal(ranking.spatial_force_integration, false);
  const repeated = rankSpatialCandidates(
    crowded,
    [
      ...discoverSegmentPairs(crowded, {
        cellSize: 0.5,
        maxPairsPerSegment: 100,
        maxPairs: 100,
      }).pairs,
    ].reverse(),
    [{ a: 4, b: 0 }],
    { maxPairs: 4, maxNewPairsPerSegment: 1 }
  );
  assert.equal(ranking.admitted_pair_digest, repeated.admitted_pair_digest);
}

{
  const contact = projectCombSweep([0, 0, 0], -0.02, 0.02, 0.01);
  assert.equal(contact.active, true);
  assert.ok(contact.correction[0] > 0);
  assert.equal(projectCombSweep([-0.5, 0, 0], -0.02, 0.02, 0.01).active, false);
  assert.equal(projectCombSweep([0, 0, 0], 0.02, -0.02, 0.01).correction[0] < 0, true);
}

{
  const velocityA = [0, 0, 0];
  const velocityB = [2, 3, 0];
  const [nextA, nextB] = blendPairAnisotropicFriction(velocityA, velocityB, [1, 0, 0], 0.1, 0.8);
  for (let axis = 0; axis < 3; axis += 1) {
    nearlyEqual(nextA[axis] + nextB[axis], velocityA[axis] + velocityB[axis]);
  }
  const axialRelative = Math.abs(nextB[0] - nextA[0]);
  const transverseRelative = Math.abs(nextB[1] - nextA[1]);
  nearlyEqual(axialRelative, 1.8);
  nearlyEqual(transverseRelative, 0.6);
}

{
  const solver = new HairSolver({ guideCount: 8, segments: 4 });
  solver.setWindDirection(Math.PI * 0.5);
  nearlyEqual(solver.windDirection[0], 0);
  nearlyEqual(solver.windDirection[2], 1);
  assert.equal(solver.receipt().wind.mode, "directional");
  solver.disableDirectionalWind();
  assert.equal(solver.receipt().wind.mode, "legacy_scalar");
}

{
  assert.equal(updateClumpBond(false, 0.09, 0.1, 0.2), true);
  assert.equal(updateClumpBond(true, 0.15, 0.1, 0.2), true);
  assert.equal(updateClumpBond(true, 0.21, 0.1, 0.2), false);
  assert.equal(updateClumpBond(false, 0.15, 0.1, 0.2), false);
}

{
  const result = projectPressurePair([0, 0, 0], [0.02, 0, 0], 0.05, 0.5);
  assert.equal(result.active, true);
  nearlyEqual(result.correctionA[0] + result.correctionB[0], 0);
  assert.ok(result.correctionA[0] < 0);
  assert.ok(result.correctionB[0] > 0);
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
  const contactReceipt = solver.receipt();
  assert.equal(solver.clumpBondAges.size, solver.clumpBonds.size);
  assert.equal(contactReceipt.persistent_contact_memory.age_entries_match_active_bonds, true);
  if (solver.clumpBonds.size > 0) {
    assert.ok(contactReceipt.persistent_contact_memory.maximum_age_steps > 0);
  }
  assert.ok(
    contactReceipt.contact_service.services_last_step <=
      contactReceipt.contact_service.candidate_capacity
  );
  assert.equal(contactReceipt.contact_service.maximum_observed_gap_steps, 1);
  assert.equal(contactReceipt.contact_service.satisfied, true);
}

{
  const solver = new HairSolver({ guideCount: 12, segments: 7 });
  const before = solver.receipt().active_segments;
  for (let frame = 0; frame < 3; frame += 1) solver.step(1 / 60);
  const bondsBeforeCut = solver.clumpBonds.size;
  assert.equal(solver.cutStrand(3, 4), true);
  assert.equal(solver.activeSegments[3], 4);
  assert.equal(solver.receipt().active_segments, before - 3);
  assert.ok(solver.clumpBonds.size <= bondsBeforeCut);
  assert.equal(solver.cutStrand(3, 6), false);
  assert.equal(
    hairSolverSegments(solver).some(
      (segment) => segment.guide === 3 && segment.segment >= solver.activeSegments[3]
    ),
    false
  );
  assert.equal(
    hairSolverPersistentPairs(solver).every(
      (pair) =>
        pair.a % solver.segments < solver.activeSegments[Math.floor(pair.a / solver.segments)] &&
        pair.b % solver.segments < solver.activeSegments[Math.floor(pair.b / solver.segments)]
    ),
    true
  );
}

{
  const solver = new HairSolver({ guideCount: 16, segments: 6, renderFibersPerGuide: 17 });
  assert.equal(solver.receipt().render_fiber_count, 272);
}

{
  const cycle = { startStep: 30, peakStep: 90, holdEndStep: 155, endStep: 230, height: 0.24 };
  assert.deepEqual(sectionLiftEnvelopeAtStep(0, cycle), { phase: "idle", value: 0 });
  assert.equal(sectionLiftEnvelopeAtStep(60, cycle).phase, "rise");
  nearlyEqual(sectionLiftEnvelopeAtStep(60, cycle).value, 0.12);
  assert.deepEqual(sectionLiftEnvelopeAtStep(90, cycle), { phase: "hold", value: 0.24 });
  assert.equal(sectionLiftEnvelopeAtStep(190, cycle).phase, "release");
  assert.ok(sectionLiftEnvelopeAtStep(190, cycle).value < 0.24);
  assert.deepEqual(sectionLiftEnvelopeAtStep(230, cycle), { phase: "released", value: 0 });
  assert.throws(
    () =>
      sectionLiftEnvelopeAtStep(0, { startStep: 10, peakStep: 10, holdEndStep: 20, endStep: 30 }),
    /start < peak <= hold < end/
  );
}

{
  const cycle = { startStep: 30, peakStep: 90, holdEndStep: 170, endStep: 255 };
  assert.deepEqual(sectionPoseEnvelopeAtStep(0, cycle), { phase: "idle", weight: 0 });
  assert.equal(sectionPoseEnvelopeAtStep(60, cycle).phase, "pose");
  nearlyEqual(sectionPoseEnvelopeAtStep(60, cycle).weight, 0.5);
  assert.deepEqual(sectionPoseEnvelopeAtStep(90, cycle), { phase: "hold", weight: 1 });
  assert.equal(sectionPoseEnvelopeAtStep(200, cycle).phase, "release");
  assert.ok(sectionPoseEnvelopeAtStep(200, cycle).weight < 1);
  assert.deepEqual(sectionPoseEnvelopeAtStep(255, cycle), { phase: "released", weight: 0 });
  assert.throws(
    () =>
      sectionPoseEnvelopeAtStep(0, {
        startStep: 10,
        peakStep: 10,
        holdEndStep: 20,
        endStep: 30,
      }),
    /start < peak <= hold < end/
  );
}

{
  const config = {
    solver: {
      guideCount: 96,
      segments: 8,
      preset: "wavy",
      iterations: 5,
      collectiveRulesEnabled: true,
    },
    steps: 120,
    dt: 1 / 60,
    baseWind: 0.2,
    gust: 0.45,
    cut: "diagonal",
    cutAt: 0.8,
    cutDuration: 0.7,
  };
  const first = runHairReplay(config).result;
  const second = runHairReplay(config).result;
  assert.equal(first.state_digest, second.state_digest);
  assert.deepEqual(first.receipt, second.receipt);
  assert.equal(first.step, 120);
  assert.ok(first.receipt.cut_count > 0);

  const stagedSolver = new HairSolver(config.solver);
  const stagedState = createReplayState();
  advanceHairReplay(stagedSolver, config, stagedState, 60);
  const staged = advanceHairReplay(stagedSolver, config, stagedState, 120);
  assert.equal(staged.state_digest, first.state_digest);

  const withoutOperators = runHairReplay({
    ...config,
    solver: { ...config.solver, collectiveRulesEnabled: false },
  }).result;
  assert.notEqual(withoutOperators.state_digest, first.state_digest);
  assert.equal(withoutOperators.receipt.collective_rules_enabled, false);
  assert.equal(withoutOperators.receipt.active_neighbor_contacts, 0);
  assert.equal(withoutOperators.receipt.persistent_clump_bonds, 0);
}

{
  const combConfig = {
    solver: { guideCount: 48, segments: 8, preset: "wavy", iterations: 6 },
    steps: 120,
    dt: 1 / 60,
    baseWind: 0.08,
    comb: { startStep: 20, endStep: 100, startX: -1.25, endX: 1.25 },
  };
  const dry = runHairReplay({ ...combConfig, moisture: 0.05 }).result;
  const wet = runHairReplay({ ...combConfig, moisture: 0.85 }).result;
  for (const result of [dry, wet]) {
    assert.ok(result.receipt.comb.peak_reaction_proxy > 0);
    assert.ok(result.receipt.comb.accumulated_work_proxy > 0);
    assert.ok(result.receipt.comb.accumulated_travel > 2);
    assert.ok(result.receipt.comb.clump_captures_during_window >= 0);
    assert.ok(result.receipt.comb.clump_releases_during_window >= 0);
    assert.ok(result.receipt.comb.force_displacement_trace.length > 20);
    assert.ok(result.receipt.comb.force_displacement_trace.length <= 128);
    assert.equal(result.receipt.comb.force_displacement_trace[0].step, 1);
    assert.ok(
      result.receipt.comb.force_displacement_trace.every(
        (sample) => sample.max_relative_stretch_error <= 0.04
      )
    );
    assert.equal(result.receipt.assumption_receipt.comb_work_nonnegative, true);
    assert.equal(result.receipt.assumption_receipt.stretch.satisfied, true);
    assert.equal(result.receipt.assumption_receipt.persistent_contact_service.satisfied, true);
    assert.equal(result.receipt.contact_service.maximum_observed_gap_steps, 1);
    assert.ok(result.receipt.persistent_contact_memory.maximum_age_steps > 0);
    assert.ok(
      result.receipt.comb.force_displacement_trace.every(
        (sample) => sample.maximum_service_gap_steps <= 1
      )
    );
  }
  assert.notEqual(dry.state_digest, wet.state_digest);
  assert.notEqual(dry.receipt.comb.accumulated_work_proxy, wet.receipt.comb.accumulated_work_proxy);
  assert.notEqual(
    dry.receipt.comb.clump_releases_during_window,
    wet.receipt.comb.clump_releases_during_window
  );
  assert.deepEqual(
    dry.receipt.comb.force_displacement_trace.map((sample) => sample.displacement),
    wet.receipt.comb.force_displacement_trace.map((sample) => sample.displacement)
  );

  const summary = summarizeCombReceipt(dry.receipt);
  assert.equal(summary.assumption_status, "satisfied");
  assert.equal(summary.peak_reaction_proxy, dry.receipt.comb.peak_reaction_proxy);
  assert.equal(summary.trace_shape.sample_count, dry.receipt.comb.force_displacement_trace.length);
  assert.equal(
    summary.maximum_clump_age_steps,
    dry.receipt.persistent_contact_memory.maximum_age_steps
  );
  assert.equal(summary.maximum_service_gap_steps, 1);
  assert.ok(summary.trace_shape.reaction_centroid_fraction >= 0);
  assert.ok(summary.trace_shape.reaction_centroid_fraction <= 1);
  nearlyEqual(
    summary.trace_shape.reaction_fraction_by_travel_third.reduce(
      (sum, fraction) => sum + fraction,
      0
    ),
    1
  );
}

{
  const liftConfig = {
    solver: {
      guideCount: 64,
      segments: 8,
      preset: "wavy",
      iterations: 6,
      collectiveRulesEnabled: true,
      rootDirectorMode: "styled_side_part",
      rootDirectorStrength: 0.22,
    },
    steps: 240,
    dt: 1 / 60,
    moisture: 0.35,
    product: 0.45,
    baseWind: 0.28,
    gust: 0.38,
    windRotationRate: 0.58,
    sectionLiftCycle: {
      startStep: 30,
      peakStep: 90,
      holdEndStep: 155,
      endStep: 230,
      height: 0.24,
    },
  };
  const held = runHairReplay({ ...liftConfig, steps: 100 }).result;
  assert.equal(held.receipt.section_lift.phase, "hold");
  nearlyEqual(held.receipt.section_lift.target_meters, 0.24);
  assert.ok(held.receipt.section_lift.corrections_last_step > 0);
  assert.ok(held.receipt.section_lift.correction_distance_last_step > 0);
  const released = runHairReplay(liftConfig).result;
  const repeated = runHairReplay(liftConfig).result;
  assert.equal(released.state_digest, repeated.state_digest);
  assert.deepEqual(released.receipt, repeated.receipt);
  assert.equal(released.receipt.section_lift.phase, "released");
  assert.equal(released.receipt.section_lift.target_meters, 0);
  assert.equal(released.receipt.section_lift.corrections_last_step, 0);
  assert.ok(released.receipt.max_relative_stretch_error <= 0.035);
}

{
  const poseConfig = {
    solver: {
      guideCount: 64,
      segments: 8,
      preset: "wavy",
      iterations: 6,
      collectiveRulesEnabled: true,
      rootDirectorMode: "styled_side_part",
      rootDirectorStrength: 0.22,
    },
    steps: 270,
    dt: 1 / 60,
    moisture: 0.35,
    product: 0.45,
    baseWind: 0.28,
    gust: 0.38,
    windRotationRate: 0.58,
    sectionPoseCycle: {
      startStep: 30,
      peakStep: 90,
      holdEndStep: 170,
      endStep: 255,
      section: 7,
      lift: 0.32,
      sweep: 0.34,
    },
  };
  const baseline = runHairReplay({ ...poseConfig, sectionPoseCycle: undefined }).result;
  const held = runHairReplay({ ...poseConfig, steps: 100 }).result;
  assert.equal(held.receipt.section_pose.phase, "hold");
  assert.equal(held.receipt.section_pose.selected_section, 7);
  assert.equal(held.receipt.section_pose.affected_guides, 9);
  nearlyEqual(held.receipt.section_pose.lift_meters, 0.32);
  nearlyEqual(held.receipt.section_pose.tangential_sweep_meters, 0.34);
  assert.equal(held.receipt.section_pose.active_guides_last_step, 9);
  assert.ok(held.receipt.section_pose.corrections_last_step > 0);
  assert.ok(held.receipt.section_pose.correction_distance_last_step > 0);
  const released = runHairReplay(poseConfig).result;
  const repeated = runHairReplay(poseConfig).result;
  assert.equal(released.state_digest, repeated.state_digest);
  assert.deepEqual(released.receipt, repeated.receipt);
  assert.notEqual(released.state_digest, baseline.state_digest);
  assert.equal(released.receipt.section_pose.phase, "released");
  assert.equal(released.receipt.section_pose.lift_meters, 0);
  assert.equal(released.receipt.section_pose.tangential_sweep_meters, 0);
  assert.equal(released.receipt.section_pose.corrections_last_step, 0);
  assert.ok(released.receipt.max_relative_stretch_error <= 0.035);
}

{
  assert.deepEqual(Object.keys(COMB_MATERIAL_CONDITIONS), ["dry", "wet", "product"]);
  assert.equal(COMB_MATERIAL_CONDITIONS.dry.product, 0);
  assert.equal(COMB_MATERIAL_CONDITIONS.wet.product, 0);
  assert.ok(COMB_MATERIAL_CONDITIONS.product.product > COMB_MATERIAL_CONDITIONS.product.moisture);
}

{
  const cycle = runHairReplay({
    solver: { guideCount: 48, segments: 8, preset: "wavy", iterations: 6 },
    steps: 300,
    dt: 1 / 60,
    moisture: 0.85,
    product: 0.2,
    baseWind: 0.08,
    comb: {
      startStep: 20,
      endStep: 100,
      startX: -1.25,
      endX: 1.25,
      returnStartStep: 115,
      returnEndStep: 195,
      returnX: -1.25,
    },
  }).result;
  const phases = new Set(cycle.receipt.comb.force_displacement_trace.map((sample) => sample.phase));
  assert.deepEqual(phases, new Set(["forward", "return"]));
  assert.ok(cycle.receipt.comb.forward_work_proxy > 0);
  assert.ok(cycle.receipt.comb.return_work_proxy > 0);
  assert.equal(
    cycle.receipt.comb.cycle_dissipation_proxy,
    cycle.receipt.comb.forward_work_proxy + cycle.receipt.comb.return_work_proxy
  );
  assert.ok(cycle.receipt.comb.accumulated_travel > 4.9);
  assert.ok(cycle.receipt.comb.force_displacement_trace.length <= 128);
  assert.equal(cycle.receipt.assumption_receipt.measurement_window, "comb_cycle");
  assert.equal(cycle.receipt.assumption_receipt.status, "satisfied");
}

{
  const rotating = runHairReplay({
    solver: { guideCount: 24, segments: 6, preset: "wavy", iterations: 5 },
    steps: 120,
    dt: 1 / 60,
    baseWind: 0.3,
    gust: 0.4,
    windAngle: 0.2,
    windRotationRate: 0.7,
  }).result;
  const repeated = runHairReplay({
    solver: { guideCount: 24, segments: 6, preset: "wavy", iterations: 5 },
    steps: 120,
    dt: 1 / 60,
    baseWind: 0.3,
    gust: 0.4,
    windAngle: 0.2,
    windRotationRate: 0.7,
  }).result;
  assert.equal(rotating.state_digest, repeated.state_digest);
  assert.equal(rotating.receipt.wind.mode, "directional");
  nearlyEqual(rotating.receipt.wind.angle_radians, 0.2 + (119 / 60) * 0.7);
}

{
  const base = {
    solver: {
      guideCount: 24,
      segments: 8,
      preset: "wavy",
      iterations: 6,
      collectiveRulesEnabled: false,
    },
    steps: 90,
    dt: 1 / 60,
    baseWind: 0.24,
    gust: 0.35,
    windAngle: 0.2,
    windRotationRate: 0.65,
  };
  const control = runHairReplay(base).result;
  const treatment = runHairReplay({
    ...base,
    solver: { ...base.solver, rootDirectorEnabled: true, rootDirectorStrength: 0.22 },
  }).result;
  const repeated = runHairReplay({
    ...base,
    solver: { ...base.solver, rootDirectorEnabled: true, rootDirectorStrength: 0.22 },
  }).result;
  assert.equal(treatment.state_digest, repeated.state_digest);
  assert.deepEqual(treatment.receipt, repeated.receipt);
  assert.notEqual(treatment.state_digest, control.state_digest);
  assert.equal(control.receipt.root_director.enabled, false);
  assert.equal(treatment.receipt.root_director.enabled, true);
  assert.ok(treatment.receipt.root_director.corrections_last_step > 0);
  assert.ok(
    treatment.receipt.root_director.mean_first_segment_normal_dot >
      control.receipt.root_director.mean_first_segment_normal_dot
  );
  assert.ok(
    treatment.receipt.peak_relative_stretch_error <= control.receipt.peak_relative_stretch_error
  );
  assert.ok(treatment.receipt.max_relative_stretch_error <= 0.035);
}

{
  const base = {
    solver: {
      guideCount: 32,
      segments: 8,
      preset: "wavy",
      iterations: 6,
      collectiveRulesEnabled: false,
      rootDirectorStrength: 0.22,
    },
    steps: 90,
    dt: 1 / 60,
    baseWind: 0.24,
    gust: 0.35,
    windAngle: 0.2,
    windRotationRate: 0.65,
  };
  const normal = runHairReplay({
    ...base,
    solver: { ...base.solver, rootDirectorMode: "scalp_normal" },
  }).result;
  const styled = runHairReplay({
    ...base,
    solver: { ...base.solver, rootDirectorMode: "styled_side_part" },
  }).result;
  const repeated = runHairReplay({
    ...base,
    solver: { ...base.solver, rootDirectorMode: "styled_side_part" },
  }).result;
  assert.equal(styled.state_digest, repeated.state_digest);
  assert.deepEqual(styled.receipt, repeated.receipt);
  assert.notEqual(styled.state_digest, normal.state_digest);
  assert.equal(styled.receipt.root_director.mode, "styled_side_part");
  assert.equal(styled.receipt.root_director.field_identity, ROOT_STYLE_FIELD_ID);
  assert.equal(styled.receipt.root_director.section_count, 8);
  assert.ok(styled.receipt.root_director.minimum_target_outward_dot > 0);
  assert.ok(styled.receipt.root_director.mean_target_tangential_magnitude > 0.4);
  assert.ok(styled.receipt.root_director.mean_first_segment_target_dot > 0.5);
  assert.ok(styled.receipt.max_relative_stretch_error <= 0.035);
  assert.ok(
    styled.receipt.root_director.mean_target_tangential_magnitude >
      normal.receipt.root_director.mean_target_tangential_magnitude
  );
  const styledSolver = new HairSolver({
    guideCount: 32,
    segments: 8,
    rootDirectorMode: "styled_side_part",
  });
  const targetSummary = summarizeRootTargets(
    styledSolver.rootDirectorTargets,
    styledSolver.rootNormals,
    styledSolver.rootDirector.zoneSegments
  );
  assert.ok(targetSummary.minimumOutwardDot > 0);
}

{
  const base = {
    solver: {
      guideCount: 32,
      segments: 8,
      preset: "wavy",
      iterations: 5,
      spatialFrictionRefreshSteps: 4,
      spatialFrictionScale: 0.5,
    },
    steps: 80,
    dt: 1 / 60,
    moisture: 0.35,
    product: 0.5,
    baseWind: 0.18,
    gust: 0.3,
    comb: { startStep: 15, endStep: 65, startX: -1.2, endX: 1.2 },
  };
  const control = runHairReplay({
    ...base,
    solver: { ...base.solver, spatialFrictionEnabled: false },
  }).result;
  const treatmentRun = runHairReplay({
    ...base,
    solver: { ...base.solver, spatialFrictionEnabled: true },
  });
  const treatment = treatmentRun.result;
  const repeated = runHairReplay({
    ...base,
    solver: { ...base.solver, spatialFrictionEnabled: true },
  }).result;
  assert.equal(treatment.state_digest, repeated.state_digest);
  assert.deepEqual(treatment.receipt, repeated.receipt);
  assert.notEqual(treatment.state_digest, control.state_digest);
  assert.equal(control.receipt.spatial_friction.enabled, false);
  assert.equal(control.receipt.spatial_friction.friction_impulse_proxy_total, 0);
  assert.equal(treatment.receipt.spatial_friction.enabled, true);
  assert.equal(treatment.receipt.spatial_friction.maximum_pairs_per_segment, 1);
  assert.equal(treatment.receipt.spatial_friction.retention_policy, "narrowphase_contact_radius");
  assert.ok(treatment.receipt.spatial_friction.refresh_count > 0);
  assert.ok(treatment.receipt.spatial_friction.candidates_last_refresh > 0);
  assert.ok(treatment.receipt.spatial_friction.selected_last_refresh > 0);
  assert.ok(treatment.receipt.spatial_friction.graph_overlap_skips_last_refresh > 0);
  assert.ok(treatment.receipt.spatial_friction.retained_total > 0);
  assert.ok(treatment.receipt.spatial_friction.added_total > 0);
  assert.ok(treatment.receipt.spatial_friction.minimum_active_jaccard >= 0);
  assert.ok(treatment.receipt.spatial_friction.friction_impulse_proxy_total > 0);
  assert.equal(treatment.receipt.spatial_friction.spatial_cohesion, false);
  assert.equal(treatment.receipt.spatial_friction.spatial_pressure, false);
  const performanceReceipt = spatialFrictionPerformanceReceipt(treatmentRun.solver.spatialFriction);
  assert.ok(performanceReceipt.refresh_ms_total > 0);
  assert.ok(performanceReceipt.discovery_ms_total > 0);
  assert.ok(performanceReceipt.ranking_ms_total >= 0);
}

{
  const first = runHairRodReference({ settlingSteps: 60, steps: 60, sampleStride: 10 });
  const second = runHairRodReference({ settlingSteps: 60, steps: 60, sampleStride: 10 });
  assert.deepEqual(first.receipt, second.receipt);
  assert.equal(first.receipt.axial.guide_count, 8);
  assert.equal(first.receipt.axial.collective_rules_enabled, false);
  assert.notEqual(first.receipt.axial.state_digest, first.receipt.transverse.state_digest);
  assert.ok(first.receipt.axial.peak_relative_stretch_error < 0.035);
  assert.ok(first.receipt.transverse.peak_relative_stretch_error < 0.035);
  assert.ok(
    first.receipt.transverse.peak_tip_delta_from_control >
      first.receipt.axial.peak_tip_delta_from_control
  );
  assert.deepEqual(first.receipt.pair_operator.velocity_sum_residual, [0, 0, 0]);
  assert.deepEqual(first.receipt.pair_operator.swap_symmetry_residual, [0, 0, 0, 0, 0, 0]);
  assert.ok(first.receipt.pair_operator.contraction_ratio < 1);
}

{
  const state = (position) => ({
    positions: new Float64Array([position]),
    previous: new Float64Array([0]),
    activeSegments: new Uint16Array([1]),
    cutCount: 0,
    time: 0,
    clumpBonds: new Set(),
  });
  assert.equal(digestHairState(state(1.0000001)), digestHairState(state(1.0000004)));
  assert.notEqual(digestHairState(state(1.0000001)), digestHairState(state(1.0000021)));
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
