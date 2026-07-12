#!/usr/bin/env node

import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { runHairReplay } from "../physics/labs/hair_material/demo/replay.js";

const scenario = {
  solver: {
    guideCount: 256,
    segments: 12,
    preset: "wavy",
    iterations: 6,
    renderFibersPerGuide: 15,
    rootDirectorStrength: 0.22,
  },
  steps: 330,
  dt: 1 / 60,
  moisture: 0.35,
  product: 0.45,
  baseWind: 0.28,
  gust: 0.38,
  windAngle: 0.15,
  windRotationRate: 0.58,
  cut: "diagonal",
  cutAt: 2.8,
  cutDuration: 1.2,
  comb: {
    startStep: 30,
    endStep: 150,
    startX: -1.35,
    endX: 1.35,
    returnStartStep: 165,
    returnEndStep: 285,
    returnX: -1.35,
  },
};

function run(mode) {
  const start = performance.now();
  const result = runHairReplay({
    ...scenario,
    solver: { ...scenario.solver, rootDirectorMode: mode },
  }).result;
  const elapsedMs = performance.now() - start;
  const root = result.receipt.root_director;
  return {
    mode,
    state_digest: result.state_digest,
    elapsed_ms: elapsedMs,
    mean_solver_wall_ms_per_step: elapsedMs / scenario.steps,
    peak_relative_stretch_error: result.receipt.peak_relative_stretch_error,
    final_relative_stretch_error: result.receipt.max_relative_stretch_error,
    cut_count: result.receipt.cut_count,
    comb_work_proxy: result.receipt.comb.accumulated_work_proxy,
    root_field: {
      identity: root.field_identity,
      minimum_first_segment_normal_dot: root.minimum_first_segment_normal_dot,
      mean_first_segment_normal_dot: root.mean_first_segment_normal_dot,
      minimum_first_segment_target_dot: root.minimum_first_segment_target_dot,
      mean_first_segment_target_dot: root.mean_first_segment_target_dot,
      minimum_target_outward_dot: root.minimum_target_outward_dot,
      mean_target_tangential_magnitude: root.mean_target_tangential_magnitude,
    },
    receipt: result.receipt,
  };
}

const free = run("free");
const normal = run("scalp_normal");
const styled = run("styled_side_part");
const repeated = run("styled_side_part");
assert.equal(styled.state_digest, repeated.state_digest);
assert.deepEqual(styled.receipt, repeated.receipt);
assert.ok(styled.peak_relative_stretch_error <= 0.035);
assert.ok(styled.root_field.minimum_target_outward_dot > 0);
assert.ok(styled.root_field.mean_target_tangential_magnitude > normal.root_field.mean_target_tangential_magnitude);

console.log(
  JSON.stringify(
    {
      schema: "hair-root-field-ab/1",
      scenario: {
        guide_count: scenario.solver.guideCount,
        segments_per_guide: scenario.solver.segments,
        render_fibers_per_guide: scenario.solver.renderFibersPerGuide,
        steps: scenario.steps,
        includes_rotating_wind: true,
        includes_comb_cycle: true,
        includes_diagonal_cut: true,
      },
      deterministic_repeat: {
        pass: true,
        styled_digest: styled.state_digest,
        repeated_digest: repeated.state_digest,
      },
      lanes: [free, normal, styled].map(({ receipt: _receipt, ...summary }) => summary),
      claim_boundary:
        "Wall time is a single-process Node observation; render cost requires the browser receipt.",
    },
    null,
    2
  )
);
