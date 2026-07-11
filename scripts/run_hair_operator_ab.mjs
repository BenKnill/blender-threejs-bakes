#!/usr/bin/env node

import { runHairReplay } from "../physics/labs/hair_material/demo/replay.js";

const common = {
  solver: {
    guideCount: 256,
    segments: 12,
    preset: "wavy",
    iterations: 5,
    renderFibersPerGuide: 15,
  },
  steps: 240,
  dt: 1 / 60,
  moisture: 0.8,
  product: 0.65,
  baseWind: 0.25,
  gust: 0.75,
  cut: "diagonal",
  cutAt: 2.5,
  cutDuration: 1.0,
};

function lane(collectiveRulesEnabled) {
  const { result } = runHairReplay({
    ...common,
    solver: { ...common.solver, collectiveRulesEnabled },
  });
  return {
    state_digest: result.state_digest,
    simulation_steps: result.step,
    simulation_seconds: result.simulation_seconds,
    receipt: result.receipt,
  };
}

const output = {
  schema: "hair-operator-ab-replay/1",
  fixed_step_seconds: common.dt,
  operators_on: lane(true),
  operators_off: lane(false),
};

console.log(JSON.stringify(output, null, 2));
