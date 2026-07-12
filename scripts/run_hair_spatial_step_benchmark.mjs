#!/usr/bin/env node

import { performance } from "node:perf_hooks";

import {
  advanceHairReplay,
  createReplayState,
  digestHairState,
} from "../physics/labs/hair_material/demo/replay.js";
import { HairSolver } from "../physics/labs/hair_material/demo/solver.js";
import { spatialFrictionPerformanceReceipt } from "../physics/labs/hair_material/demo/spatial_friction.js";

const warmupSteps = 32;
const measurementSteps = 64;
const config = {
  dt: 1 / 60,
  baseWind: 0.08,
  gust: 0.08,
  windAngle: 0,
  windRotationRate: 0.7,
  comb: { startStep: 30, endStep: 150, startX: -1.35, endX: 1.35 },
};

function timingSummary(samples) {
  const ordered = [...samples].sort((left, right) => left - right);
  const percentile = (fraction) =>
    ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] ?? null;
  return {
    count: samples.length,
    mean_ms: samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length),
    p95_ms: percentile(0.95),
    maximum_ms: ordered.at(-1) ?? null,
  };
}

const solver = new HairSolver({
  guideCount: 256,
  segments: 12,
  preset: "wavy",
  iterations: 6,
  spatialFrictionEnabled: true,
  spatialFrictionRefreshSteps: 8,
  spatialFrictionScale: 0.5,
});
solver.setMoisture(0.85);
solver.setProduct(0.2);
const replayState = createReplayState();
advanceHairReplay(solver, config, replayState, warmupSteps);
solver.beginMeasurementWindow("spatial_step_benchmark");

const deterministicSteps = [];
const timingSteps = [];
for (let offset = 1; offset <= measurementSteps; offset += 1) {
  const priorRefreshCount = solver.spatialFriction.refresh_count;
  const started = performance.now();
  const result = advanceHairReplay(solver, config, replayState, warmupSteps + offset);
  const wallMs = performance.now() - started;
  const refreshed = solver.spatialFriction.refresh_count > priorRefreshCount;
  deterministicSteps.push({
    step: result.step,
    refreshed,
    state_digest: digestHairState(solver),
    selected_pair_digest: solver.spatialFriction.selected_pair_digest,
    serviced_pair_digest: solver.spatialFriction.serviced_pair_digest,
    selected_pairs: solver.spatialFriction.selected_pairs.length,
    active_contacts: solver.spatialFriction.active_contacts_last_step,
  });
  timingSteps.push({ step: result.step, refreshed, wall_ms: wallMs });
}

const refreshTimes = timingSteps.filter((step) => step.refreshed).map((step) => step.wall_ms);
const steadyTimes = timingSteps.filter((step) => !step.refreshed).map((step) => step.wall_ms);
console.log(
  JSON.stringify(
    {
      schema: "hair-spatial-step-benchmark/1",
      config: {
        guide_count: solver.guideCount,
        segments_per_guide: solver.segments,
        iterations: solver.iterations,
        warmup_steps: warmupSteps,
        measurement_steps: measurementSteps,
        refresh_period_steps: solver.spatialFriction.refresh_period_steps,
      },
      deterministic: {
        final_state_digest: digestHairState(solver),
        steps: deterministicSteps,
      },
      performance: {
        refresh: timingSummary(refreshTimes),
        steady: timingSummary(steadyTimes),
        all: timingSummary(timingSteps.map((step) => step.wall_ms)),
        steps: timingSteps,
        refresh_phases: spatialFrictionPerformanceReceipt(solver.spatialFriction),
      },
    },
    null,
    2
  )
);
