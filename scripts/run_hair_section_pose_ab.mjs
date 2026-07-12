#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  advanceHairReplay,
  createReplayState,
  runHairReplay,
} from "../physics/labs/hair_material/demo/replay.js";
import { HairSolver } from "../physics/labs/hair_material/demo/solver.js";

const poseCycle = Object.freeze({
  startStep: 30,
  peakStep: 90,
  holdEndStep: 170,
  endStep: 255,
  section: 6,
  lift: 0.32,
  sweep: -0.34,
});

const config = Object.freeze({
  solver: Object.freeze({
    guideCount: 256,
    segments: 12,
    preset: "wavy",
    iterations: 6,
    collectiveRulesEnabled: true,
    rootDirectorMode: "styled_side_part",
    rootDirectorStrength: 0.22,
  }),
  steps: 420,
  dt: 1 / 60,
  moisture: 0.35,
  product: 0.45,
  baseWind: 0.28,
  gust: 0.38,
  windRotationRate: 0.58,
  cut: "diagonal",
  cutAt: 5.5,
  cutDuration: 1.2,
  comb: Object.freeze({
    startStep: 30,
    endStep: 150,
    startX: -1.35,
    endX: 1.35,
    returnStartStep: 165,
    returnEndStep: 285,
    returnX: -1.35,
  }),
});

function phaseSnapshots() {
  const solver = new HairSolver(config.solver);
  solver.setMoisture(config.moisture);
  solver.setProduct(config.product);
  const state = createReplayState();
  const snapshots = {};
  for (const step of [30, 91, 171, 256, 420]) {
    const result = advanceHairReplay(
      solver,
      { ...config, sectionPoseCycle: poseCycle },
      state,
      step
    );
    snapshots[step] = {
      digest: result.state_digest,
      phase: result.receipt.section_pose.phase,
      selected_section: result.receipt.section_pose.selected_section,
      affected_guides: result.receipt.section_pose.affected_guides,
      active_guides: result.receipt.section_pose.active_guides_last_step,
      lift_meters: result.receipt.section_pose.lift_meters,
      tangential_sweep_meters: result.receipt.section_pose.tangential_sweep_meters,
      corrections: result.receipt.section_pose.corrections_last_step,
      correction_distance: result.receipt.section_pose.correction_distance_last_step,
      current_stretch: result.receipt.max_relative_stretch_error,
      peak_stretch: result.receipt.peak_relative_stretch_error,
      cuts: result.receipt.cut_count,
    };
  }
  return snapshots;
}

const baseline = runHairReplay(config).result;
const treatment = runHairReplay({ ...config, sectionPoseCycle: poseCycle }).result;
const repeated = runHairReplay({ ...config, sectionPoseCycle: poseCycle }).result;
const snapshots = phaseSnapshots();

assert.equal(treatment.state_digest, repeated.state_digest);
assert.deepEqual(treatment.receipt, repeated.receipt);
assert.equal(baseline.state_digest, "6a0294d4bf085310");
assert.equal(snapshots[30].phase, "idle");
assert.equal(snapshots[91].phase, "hold");
assert.equal(snapshots[91].selected_section, 6);
assert.equal(snapshots[91].affected_guides, 30);
assert.equal(snapshots[91].active_guides, 30);
assert.equal(snapshots[91].lift_meters, 0.32);
assert.equal(snapshots[91].tangential_sweep_meters, -0.34);
assert.ok(snapshots[91].corrections > 0);
assert.equal(snapshots[171].phase, "release");
assert.equal(snapshots[256].phase, "released");
assert.equal(snapshots[256].lift_meters, 0);
assert.equal(snapshots[420].cuts, 256);
assert.ok(treatment.receipt.peak_relative_stretch_error <= 0.035);

console.log(
  JSON.stringify(
    {
      schema: "hair-section-pose-ab/1",
      pose_cycle: poseCycle,
      baseline: {
        digest: baseline.state_digest,
        peak_stretch: baseline.receipt.peak_relative_stretch_error,
      },
      treatment: {
        digest: treatment.state_digest,
        repeated_digest: repeated.state_digest,
        peak_stretch: treatment.receipt.peak_relative_stretch_error,
        final_stretch: treatment.receipt.max_relative_stretch_error,
        cuts: treatment.receipt.cut_count,
      },
      snapshots,
      assumptions: {
        control_scope:
          "one deterministic eighth-scalp guide section; dense fibers inherit guide motion through existing rest-baked interpolation",
        correction_distance: "summed solver-position proxy; not calibrated work or force",
        measurement_boundary:
          "comb-cycle measurement begins at step 30; the section pose starts at the same step",
        capability_boundary:
          "artist-directed section control primitive; not a production grooming or Disney parity claim",
      },
    },
    null,
    2
  )
);
