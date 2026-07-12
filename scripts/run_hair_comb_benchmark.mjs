#!/usr/bin/env node

import { performance } from "node:perf_hooks";

import {
  COMB_MATERIAL_CONDITIONS,
  runHairReplay,
  summarizeCombReceipt,
} from "../physics/labs/hair_material/demo/replay.js";

const common = {
  solver: {
    guideCount: 256,
    segments: 12,
    preset: "wavy",
    iterations: 6,
    renderFibersPerGuide: 15,
  },
  steps: 180,
  dt: 1 / 60,
  baseWind: 0.08,
  gust: 0.08,
  comb: {
    startStep: 30,
    endStep: 150,
    startX: -1.35,
    endX: 1.35,
    envelope: { yMin: -0.7, yMax: 1.45, zMin: 0.12, zMax: 1.2 },
  },
};

function runLane(name, condition) {
  const started = performance.now();
  const { result } = runHairReplay({ ...common, ...condition });
  return {
    name,
    condition,
    runtime_ms: performance.now() - started,
    state_digest: result.state_digest,
    simulation_steps: result.step,
    simulation_seconds: result.simulation_seconds,
    summary: summarizeCombReceipt(result.receipt),
    receipt: result.receipt,
  };
}

const lanes = Object.fromEntries(
  Object.entries(COMB_MATERIAL_CONDITIONS).map(([name, condition]) => [
    name,
    runLane(name, condition),
  ])
);

const output = {
  schema: "hair-comb-through-benchmark/2",
  approximation:
    "kinematic swept comb against 256 mechanical guides; reaction and work are unit-mass projection proxies, not calibrated Newtons/Joules",
  fixed_step_seconds: common.dt,
  lanes,
};

console.log(JSON.stringify(output, null, 2));
