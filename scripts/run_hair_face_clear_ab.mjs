#!/usr/bin/env node

import assert from "node:assert/strict";

import { runHairReplay } from "../physics/labs/hair_material/demo/replay.js";

const base = Object.freeze({
  solver: Object.freeze({
    guideCount: 256,
    segments: 12,
    preset: "wavy",
    iterations: 6,
    collectiveRulesEnabled: true,
    rootDirectorMode: "styled_side_part",
    rootDirectorStrength: 0.22,
  }),
  steps: 180,
  dt: 1 / 60,
  moisture: 0.35,
  product: 0.45,
  baseWind: 0.18,
  gust: 0.24,
  windRotationRate: 0.58,
  comb: Object.freeze({
    startStep: 30,
    endStep: 150,
    startX: -1.35,
    endX: 1.35,
  }),
});

function run(enabled) {
  return runHairReplay({
    ...base,
    solver: { ...base.solver, faceClearGroomEnabled: enabled },
  }).result;
}

const control = run(false);
const treatment = run(true);
const repeated = run(true);

assert.equal(treatment.state_digest, repeated.state_digest);
assert.deepEqual(treatment.receipt, repeated.receipt);
assert.notEqual(treatment.state_digest, control.state_digest);
assert.equal(control.receipt.face_clear_groom.enabled, false);
assert.equal(treatment.receipt.face_clear_groom.enabled, true);
assert.ok(treatment.receipt.face_clear_groom.affected_guides > 0);
assert.ok(treatment.receipt.face_clear_groom.corrections_last_step > 0);
assert.ok(treatment.receipt.peak_relative_stretch_error <= 0.035);

console.log(
  JSON.stringify(
    {
      schema: "hair-face-clear-ab/1",
      field_identity: treatment.receipt.face_clear_groom.field_identity,
      control: {
        digest: control.state_digest,
        peak_stretch: control.receipt.peak_relative_stretch_error,
      },
      treatment: {
        digest: treatment.state_digest,
        repeated_digest: repeated.state_digest,
        peak_stretch: treatment.receipt.peak_relative_stretch_error,
        affected_guides: treatment.receipt.face_clear_groom.affected_guides,
        corrections_last_step: treatment.receipt.face_clear_groom.corrections_last_step,
        correction_distance_last_step:
          treatment.receipt.face_clear_groom.correction_distance_last_step,
      },
      scalp_layout: treatment.receipt.scalp_layout,
      root_director: treatment.receipt.root_director,
      boundary:
        "deterministic authored guide projection around an analytic face volume; not strand-face collision",
    },
    null,
    2
  )
);
