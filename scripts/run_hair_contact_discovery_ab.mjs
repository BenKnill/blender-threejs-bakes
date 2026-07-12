#!/usr/bin/env node

import { performance } from "node:perf_hooks";

import {
  discoverSegmentPairs,
  hairSolverPersistentPairs,
  hairSolverSegments,
  rankSpatialCandidates,
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
    maxPairsPerSegment: 100000,
    maxPairs: 100000,
  });
  const discoveryMilliseconds = performance.now() - started;
  const persistent = hairSolverPersistentPairs(hair);
  const aabbStarted = performance.now();
  const rankedAabb = rankSpatialCandidates(segments, spatial.pairs, persistent, {
    maxPairs: 20000,
    maxNewPairsPerSegment: 16,
    riskMetric: "aabb_gap_squared",
  });
  const aabbRankingMilliseconds = performance.now() - aabbStarted;
  const closestStarted = performance.now();
  const rankedClosest = rankSpatialCandidates(segments, spatial.pairs, persistent, {
    maxPairs: 20000,
    maxNewPairsPerSegment: 16,
    riskMetric: "segment_distance_squared",
  });
  const closestRankingMilliseconds = performance.now() - closestStarted;
  lanes[name] = {
    mechanical_state_digest: result.state_digest,
    fixed_graph_candidates_per_step: result.receipt.contact_service.candidate_capacity,
    spatial_discovery_ms: discoveryMilliseconds,
    aabb_ranking_ms: aabbRankingMilliseconds,
    closest_ranking_ms: closestRankingMilliseconds,
    spatial,
    ranked_aabb: rankedAabb,
    ranked_closest: rankedClosest,
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
