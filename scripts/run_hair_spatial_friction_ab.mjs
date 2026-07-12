#!/usr/bin/env node

import { performance } from "node:perf_hooks";

import {
  COMB_MATERIAL_CONDITIONS,
  runHairReplay,
} from "../physics/labs/hair_material/demo/replay.js";
import { spatialFrictionPerformanceReceipt } from "../physics/labs/hair_material/demo/spatial_friction.js";

const solver = {
  guideCount: 256,
  segments: 12,
  preset: "wavy",
  iterations: 6,
  spatialFrictionRefreshSteps: 8,
  spatialFrictionScale: 0.5,
};
const comb = {
  solver,
  steps: 180,
  dt: 1 / 60,
  baseWind: 0.08,
  gust: 0.08,
  comb: { startStep: 30, endStep: 150, startX: -1.35, endX: 1.35 },
};
const cut = {
  solver,
  steps: 240,
  dt: 1 / 60,
  moisture: 0.35,
  product: 0.85,
  baseWind: 0.25,
  gust: 0.75,
  cut: "diagonal",
  cutAt: 2.5,
  cutDuration: 1.0,
};

function runLane(config, spatialFrictionEnabled) {
  const started = performance.now();
  const { solver: hair, result } = runHairReplay({
    ...config,
    solver: { ...config.solver, spatialFrictionEnabled },
  });
  return {
    state_digest: result.state_digest,
    wall_ms: performance.now() - started,
    peak_relative_stretch_error: result.receipt.peak_relative_stretch_error,
    stretch_gate_satisfied: result.receipt.assumption_receipt.stretch.satisfied,
    assumption_status: result.receipt.assumption_receipt.status,
    comb_peak_reaction_proxy: result.receipt.comb.peak_reaction_proxy,
    comb_work_proxy: result.receipt.comb.accumulated_work_proxy,
    clump_releases: result.receipt.comb.clump_releases_during_window,
    persistent_clump_bonds: result.receipt.persistent_clump_bonds,
    spatial_friction: result.receipt.spatial_friction,
    spatial_performance: spatialFrictionPerformanceReceipt(hair.spatialFriction),
    deterministic_receipt: result.receipt,
  };
}

function compact(lane) {
  const { deterministic_receipt: _deterministicReceipt, ...receipt } = lane;
  return receipt;
}

function experiment(config) {
  const baseline = runHairReplay(config).result;
  const control = runLane(config, false);
  const treatment = runLane(config, true);
  const repeatedTreatment = runLane(config, true);
  return {
    control: compact(control),
    treatment: compact(treatment),
    gates: {
      explicit_off_matches_ordinary_digest: control.state_digest === baseline.state_digest,
      explicit_off_matches_ordinary_receipt:
        JSON.stringify(control.deterministic_receipt) === JSON.stringify(baseline.receipt),
      treatment_rerun_digest_matches: treatment.state_digest === repeatedTreatment.state_digest,
      treatment_rerun_receipt_matches:
        JSON.stringify(treatment.deterministic_receipt) ===
        JSON.stringify(repeatedTreatment.deterministic_receipt),
      treatment_changes_mechanical_digest: treatment.state_digest !== control.state_digest,
      treatment_has_nonzero_impulse: treatment.spatial_friction.friction_impulse_proxy_total > 0,
      treatment_stretch_gate_satisfied: treatment.stretch_gate_satisfied,
      spatial_pressure_disabled: treatment.spatial_friction.spatial_pressure === false,
      spatial_cohesion_disabled: treatment.spatial_friction.spatial_cohesion === false,
    },
    deltas: {
      peak_relative_stretch_error:
        treatment.peak_relative_stretch_error - control.peak_relative_stretch_error,
      comb_peak_reaction_proxy:
        treatment.comb_peak_reaction_proxy - control.comb_peak_reaction_proxy,
      comb_work_proxy: treatment.comb_work_proxy - control.comb_work_proxy,
      clump_releases: treatment.clump_releases - control.clump_releases,
      persistent_clump_bonds: treatment.persistent_clump_bonds - control.persistent_clump_bonds,
    },
  };
}

const combExperiments = {};
for (const [name, material] of Object.entries(COMB_MATERIAL_CONDITIONS)) {
  combExperiments[name] = experiment({ ...comb, ...material });
}

console.log(
  JSON.stringify(
    {
      schema: "hair-spatial-friction-ab/1",
      boundary:
        "k=1 closest-ranked spatial anisotropic friction only; fixed graph remains active; spatial pressure and cohesion disabled",
      comb: combExperiments,
      diagonal_cut_product: experiment(cut),
    },
    null,
    2
  )
);
