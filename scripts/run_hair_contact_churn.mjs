#!/usr/bin/env node

import {
  digestContactTrace,
  snapshotRankedContacts,
  summarizeContactTransition,
} from "../physics/labs/hair_material/demo/contact_churn.js";
import {
  discoverSegmentPairs,
  hairSolverPersistentPairs,
  hairSolverSegments,
  rankSpatialCandidates,
} from "../physics/labs/hair_material/demo/contact_discovery.js";
import {
  advanceHairReplay,
  COMB_MATERIAL_CONDITIONS,
  runHairReplay,
} from "../physics/labs/hair_material/demo/replay.js";

const solver = { guideCount: 256, segments: 12, preset: "wavy", iterations: 6 };
const combConfig = {
  solver,
  dt: 1 / 60,
  baseWind: 0.08,
  gust: 0.08,
  comb: { startStep: 30, endStep: 150, startX: -1.35, endX: 1.35 },
};
const cutConfig = {
  solver,
  dt: 1 / 60,
  moisture: 0.35,
  product: 0.85,
  baseWind: 0.25,
  gust: 0.75,
  cut: "diagonal",
  cutAt: 2.5,
  cutDuration: 1.0,
};

function sampleContacts(hair, result) {
  const segments = hairSolverSegments(hair);
  const spatial = discoverSegmentPairs(segments, {
    cellSize: 0.24,
    padding: 0.04,
    maxPairsPerSegment: 100000,
    maxPairs: 100000,
  });
  const ranking = rankSpatialCandidates(segments, spatial.pairs, hairSolverPersistentPairs(hair), {
    maxPairs: 20000,
    maxNewPairsPerSegment: 16,
    riskMetric: "segment_distance_squared",
  });
  return snapshotRankedContacts({
    step: result.step,
    stateDigest: result.state_digest,
    cutCount: result.receipt.cut_count,
    activeSegmentIds: new Set(segments.map((segment) => segment.id)),
    ranking,
  });
}

function runTrace(config, sampleSteps) {
  const { solver: hair, state } = runHairReplay({ ...config, steps: 0 });
  const frames = [];
  const transitions = [];
  let previous = null;
  for (const step of sampleSteps) {
    const result = advanceHairReplay(hair, config, state, step);
    const current = sampleContacts(hair, result);
    frames.push(current.receipt);
    if (previous) transitions.push(summarizeContactTransition(previous, current));
    previous = current;
  }
  const baseline = runHairReplay({ ...config, steps: sampleSteps.at(-1) }).result;
  return {
    sample_steps: sampleSteps,
    frames,
    transitions,
    trace_digest: digestContactTrace(frames, transitions),
    final_mechanical_digest: frames.at(-1).mechanical_state_digest,
    baseline_mechanical_digest: baseline.state_digest,
    mechanical_digest_matches_baseline:
      frames.at(-1).mechanical_state_digest === baseline.state_digest,
    spatial_force_integration: false,
  };
}

function deterministicTrace(config, sampleSteps) {
  const first = runTrace(config, sampleSteps);
  const second = runTrace(config, sampleSteps);
  return {
    ...first,
    deterministic_rerun_digest: second.trace_digest,
    deterministic_rerun_matches: first.trace_digest === second.trace_digest,
  };
}

const comb = {};
for (const [name, material] of Object.entries(COMB_MATERIAL_CONDITIONS)) {
  comb[name] = deterministicTrace(
    { ...combConfig, ...material },
    [29, 30, 31, 89, 90, 91, 149, 150, 151, 179, 180]
  );
}
const cut = deterministicTrace(
  cutConfig,
  [149, 150, 151, 155, 156, 157, 179, 180, 181, 209, 210, 211, 239, 240]
);

console.log(
  JSON.stringify(
    {
      schema: "hair-contact-churn/1",
      boundary:
        "sparse discovery/ranking trace only; no spatial friction, pressure, cohesion, or rendering forces",
      receipt_policy: "counts and digests only; admitted pair payloads omitted",
      comb,
      diagonal_cut_product: cut,
    },
    null,
    2
  )
);
