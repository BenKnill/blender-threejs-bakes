#!/usr/bin/env node

import { performance } from "node:perf_hooks";

import {
  discoverSegmentPairs,
  hairSolverSegments,
} from "../physics/labs/hair_material/demo/contact_discovery.js";
import {
  COMB_MATERIAL_CONDITIONS,
  runHairReplay,
} from "../physics/labs/hair_material/demo/replay.js";

const solver = { guideCount: 256, segments: 12, preset: "wavy", iterations: 6 };
const replay = {
  solver,
  steps: 180,
  dt: 1 / 60,
  baseWind: 0.08,
  gust: 0.08,
  comb: { startStep: 30, endStep: 150, startX: -1.35, endX: 1.35 },
};

const lanes = {};
for (const [name, condition] of Object.entries(COMB_MATERIAL_CONDITIONS)) {
  const { solver: hair, result } = runHairReplay({ ...replay, ...condition });
  const segments = hairSolverSegments(hair);
  const started = performance.now();
  const spatial = discoverSegmentPairs(segments, {
    cellSize: 0.24,
    padding: 0.04,
    maxPairsPerSegment: 16,
    maxPairs: 20000,
  });
  lanes[name] = {
    mechanical_state_digest: result.state_digest,
    fixed_graph_candidates_per_step: result.receipt.contact_service.candidate_capacity,
    spatial_discovery_ms: performance.now() - started,
    spatial,
  };
}

console.log(
  JSON.stringify(
    {
      schema: "hair-contact-discovery-ab/1",
      boundary:
        "discovery-only A/B; spatial candidates do not yet drive friction, pressure, cohesion, or rendering",
      lanes,
    },
    null,
    2
  )
);
