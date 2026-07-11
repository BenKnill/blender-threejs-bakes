#!/usr/bin/env node

import { performance } from "node:perf_hooks";

import { runHairReplay } from "../physics/labs/hair_material/demo/replay.js";

const config = {
  solver: {
    guideCount: 256,
    segments: 12,
    preset: "wavy",
    iterations: 6,
    renderFibersPerGuide: 15,
  },
  steps: 300,
  dt: 1 / 60,
  moisture: 0.85,
  product: 0.2,
  baseWind: 0.08,
  gust: 0.08,
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

const started = performance.now();
const { result } = runHairReplay(config);
console.log(
  JSON.stringify(
    {
      schema: "hair-comb-cycle/1",
      approximation:
        "outward/return kinematic comb; cycle dissipation is an uncalibrated projection-work proxy",
      runtime_ms: performance.now() - started,
      state_digest: result.state_digest,
      simulation_steps: result.step,
      receipt: result.receipt,
    },
    null,
    2
  )
);
