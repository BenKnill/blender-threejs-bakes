import {
  closestSegmentPoints,
  digestOrderedPairs,
  discoverSegmentPairs,
  hairSolverSegments,
  rankSpatialCandidates,
} from "./contact_discovery.js";
import { barycentricEndpointWeights, blendPairAnisotropicFriction } from "./friction.js";

function pairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function guidePairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function segmentGuide(segmentId, segmentsPerGuide) {
  return Math.floor(segmentId / segmentsPerGuide);
}

function segmentIndex(segmentId, segmentsPerGuide) {
  return segmentId % segmentsPerGuide;
}

function solverSegment(solver, segmentId) {
  const guide = segmentGuide(segmentId, solver.segments);
  const segment = segmentIndex(segmentId, solver.segments);
  if (guide < 0 || guide >= solver.guideCount || segment < 1) return null;
  if (segment >= solver.activeSegments[guide]) return null;
  const a = solver.index(guide, segment);
  const b = solver.index(guide, segment + 1);
  return {
    id: segmentId,
    guide,
    segment,
    a_index: a,
    b_index: b,
    a: [solver.positions[a], solver.positions[a + 1], solver.positions[a + 2]],
    b: [solver.positions[b], solver.positions[b + 1], solver.positions[b + 2]],
  };
}

function velocityAt(solver, index) {
  return [0, 1, 2].map((axis) => solver.positions[index + axis] - solver.previous[index + axis]);
}

function interpolate(left, right, parameter) {
  return left.map((value, axis) => value + (right[axis] - value) * parameter);
}

function tangentFrame(left, right) {
  const tangent = [0, 1, 2].map(
    (axis) => left.b[axis] - left.a[axis] + right.b[axis] - right.a[axis]
  );
  if (Math.hypot(...tangent) > 1e-12) return tangent;
  const leftTangent = [0, 1, 2].map((axis) => left.b[axis] - left.a[axis]);
  if (Math.hypot(...leftTangent) > 1e-12) return leftTangent;
  const rightTangent = [0, 1, 2].map((axis) => right.b[axis] - right.a[axis]);
  return Math.hypot(...rightTangent) > 1e-12 ? rightTangent : [0, 1, 0];
}

function setJaccard(left, right) {
  if (left.size === 0 && right.size === 0) return 1;
  let intersection = 0;
  for (const key of left) if (right.has(key)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function createSpatialFrictionState({
  enabled = false,
  refreshPeriodSteps = 8,
  scale = 0.5,
} = {}) {
  return {
    enabled: Boolean(enabled),
    refresh_period_steps: Math.max(1, Math.floor(refreshPeriodSteps)),
    scale: Math.max(0, Math.min(1, scale)),
    maximum_pairs_per_segment: 1,
    selected_pairs: [],
    selected_pair_digest: digestOrderedPairs([]),
    last_refresh_step: null,
    refresh_count: 0,
    candidates_last_refresh: 0,
    selected_last_refresh: 0,
    graph_overlap_skips_last_refresh: 0,
    graph_overlap_skips_total: 0,
    retained_last_refresh: 0,
    retained_total: 0,
    added_last_refresh: 0,
    added_total: 0,
    removed_last_refresh: 0,
    removed_total: 0,
    refresh_jaccard: null,
    minimum_refresh_jaccard: null,
    active_contacts_last_step: 0,
    serviced_pair_digest: digestOrderedPairs([]),
    previous_serviced_keys: null,
    active_jaccard: null,
    minimum_active_jaccard: null,
    maximum_active_churn: 0,
    stale_rejects_last_step: 0,
    stale_rejects_total: 0,
    inactive_rejects_last_step: 0,
    inactive_rejects_total: 0,
    distance_rejects_last_step: 0,
    distance_rejects_total: 0,
    friction_impulse_proxy_last_step: 0,
    friction_impulse_proxy_total: 0,
    refresh_ms_last: 0,
    refresh_ms_total: 0,
    apply_ms_last: 0,
    apply_ms_total: 0,
  };
}

export function resetSpatialFrictionState(state) {
  const reset = createSpatialFrictionState({
    enabled: state.enabled,
    refreshPeriodSteps: state.refresh_period_steps,
    scale: state.scale,
  });
  Object.assign(state, reset);
}

export function resetSpatialFrictionWindow(state) {
  state.refresh_count = 0;
  state.graph_overlap_skips_total = 0;
  state.retained_total = 0;
  state.added_total = 0;
  state.removed_total = 0;
  state.refresh_jaccard = null;
  state.minimum_refresh_jaccard = null;
  state.stale_rejects_total = 0;
  state.inactive_rejects_total = 0;
  state.distance_rejects_total = 0;
  state.friction_impulse_proxy_total = 0;
  state.previous_serviced_keys = null;
  state.serviced_pair_digest = digestOrderedPairs([]);
  state.active_jaccard = null;
  state.minimum_active_jaccard = null;
  state.maximum_active_churn = 0;
  state.refresh_ms_total = 0;
  state.apply_ms_total = 0;
}

function refreshPairs(solver, state) {
  const started = performance.now();
  const segments = hairSolverSegments(solver).filter((segment) => segment.segment >= 1);
  const fixedGuidePairs = new Set(
    solver.neighborPairs.map(([left, right]) => guidePairKey(left, right))
  );
  const spatial = discoverSegmentPairs(segments, {
    cellSize: 0.24,
    padding: 0.04,
    maxPairsPerSegment: 100000,
    maxPairs: 100000,
  });
  let graphOverlapSkips = 0;
  const candidates = spatial.pairs.filter((pair) => {
    const leftGuide = segmentGuide(pair.a, solver.segments);
    const rightGuide = segmentGuide(pair.b, solver.segments);
    if (!fixedGuidePairs.has(guidePairKey(leftGuide, rightGuide))) return true;
    graphOverlapSkips += 1;
    return false;
  });
  const contactRadius = 0.14 + solver.material.clump * 0.3;
  const contactRadiusSquared = contactRadius * contactRadius;
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const retained = [];
  const usedSegments = new Set();
  for (const pair of [...state.selected_pairs].sort(
    (left, right) => left.a - right.a || left.b - right.b
  )) {
    const left = byId.get(pair.a);
    const right = byId.get(pair.b);
    if (!left || !right) continue;
    if (usedSegments.has(pair.a) || usedSegments.has(pair.b)) continue;
    if (closestSegmentPoints(left, right).distance_squared > contactRadiusSquared) continue;
    retained.push({ a: Math.min(pair.a, pair.b), b: Math.max(pair.a, pair.b) });
    usedSegments.add(pair.a);
    usedSegments.add(pair.b);
  }
  const fillCandidates = candidates.filter(
    (pair) => !usedSegments.has(pair.a) && !usedSegments.has(pair.b)
  );
  const ranking = rankSpatialCandidates(segments, fillCandidates, [], {
    maxPairs: Math.max(1, Math.ceil(segments.length / 2)),
    maxNewPairsPerSegment: 1,
    riskMetric: "segment_distance_squared",
  });
  const added = ranking.admitted_pairs
    .filter(
      (pair) =>
        closestSegmentPoints(byId.get(pair.a), byId.get(pair.b)).distance_squared <=
        contactRadiusSquared
    )
    .map((pair) => ({ a: pair.a, b: pair.b }));
  const selected = [...retained, ...added].sort(
    (left, right) => left.a - right.a || left.b - right.b
  );
  const previousKeys = new Set(state.selected_pairs.map((pair) => pairKey(pair.a, pair.b)));
  const selectedKeys = new Set(selected.map((pair) => pairKey(pair.a, pair.b)));
  const removed = [...previousKeys].filter((key) => !selectedKeys.has(key)).length;
  state.refresh_jaccard =
    state.last_refresh_step === null ? null : setJaccard(previousKeys, selectedKeys);
  if (state.refresh_jaccard !== null) {
    state.minimum_refresh_jaccard = Math.min(
      state.minimum_refresh_jaccard ?? state.refresh_jaccard,
      state.refresh_jaccard
    );
  }
  state.selected_pairs = selected;
  state.selected_pair_digest = digestOrderedPairs(selected);
  state.last_refresh_step = solver.simulationStep;
  state.refresh_count += 1;
  state.candidates_last_refresh = candidates.length;
  state.selected_last_refresh = selected.length;
  state.graph_overlap_skips_last_refresh = graphOverlapSkips;
  state.graph_overlap_skips_total += graphOverlapSkips;
  state.retained_last_refresh = retained.length;
  state.retained_total += retained.length;
  state.added_last_refresh = added.length;
  state.added_total += added.length;
  state.removed_last_refresh = removed;
  state.removed_total += removed;
  state.refresh_ms_last = performance.now() - started;
  state.refresh_ms_total += state.refresh_ms_last;
}

function applyEndpointCorrection(solver, left, right, parameter, correction) {
  const weights = barycentricEndpointWeights(parameter);
  for (let axis = 0; axis < 3; axis += 1) {
    solver.previous[left + axis] -= weights[0] * correction[axis];
    solver.previous[right + axis] -= weights[1] * correction[axis];
  }
}

export function stepSpatialFriction(solver, state) {
  state.active_contacts_last_step = 0;
  state.stale_rejects_last_step = 0;
  state.inactive_rejects_last_step = 0;
  state.distance_rejects_last_step = 0;
  state.friction_impulse_proxy_last_step = 0;
  if (!state.enabled) return;
  if (
    state.last_refresh_step === null ||
    solver.simulationStep - state.last_refresh_step >= state.refresh_period_steps
  ) {
    refreshPairs(solver, state);
  }
  const applyStarted = performance.now();
  const contactRadius = 0.14 + solver.material.clump * 0.3;
  const axialFriction = solver.material.friction * 0.045 * state.scale;
  const transverseFriction = solver.material.friction * 0.24 * state.scale;
  const servicedPairs = [];
  for (const pair of state.selected_pairs) {
    const left = solverSegment(solver, pair.a);
    const right = solverSegment(solver, pair.b);
    if (!left || !right) {
      state.stale_rejects_last_step += 1;
      state.inactive_rejects_last_step += 1;
      continue;
    }
    const closest = closestSegmentPoints(left, right);
    if (
      !Number.isFinite(closest.distance_squared) ||
      closest.distance_squared > contactRadius * contactRadius
    ) {
      state.stale_rejects_last_step += 1;
      state.distance_rejects_last_step += 1;
      continue;
    }
    const leftVelocity = interpolate(
      velocityAt(solver, left.a_index),
      velocityAt(solver, left.b_index),
      closest.left_parameter
    );
    const rightVelocity = interpolate(
      velocityAt(solver, right.a_index),
      velocityAt(solver, right.b_index),
      closest.right_parameter
    );
    const [nextLeft, nextRight] = blendPairAnisotropicFriction(
      leftVelocity,
      rightVelocity,
      tangentFrame(left, right),
      axialFriction,
      transverseFriction
    );
    const leftCorrection = nextLeft.map((value, axis) => value - leftVelocity[axis]);
    const rightCorrection = nextRight.map((value, axis) => value - rightVelocity[axis]);
    applyEndpointCorrection(
      solver,
      left.a_index,
      left.b_index,
      closest.left_parameter,
      leftCorrection
    );
    applyEndpointCorrection(
      solver,
      right.a_index,
      right.b_index,
      closest.right_parameter,
      rightCorrection
    );
    state.friction_impulse_proxy_last_step +=
      Math.hypot(...leftCorrection) + Math.hypot(...rightCorrection);
    state.active_contacts_last_step += 1;
    servicedPairs.push(pair);
  }
  const servicedKeys = new Set(servicedPairs.map((pair) => pairKey(pair.a, pair.b)));
  state.serviced_pair_digest = digestOrderedPairs(servicedPairs);
  state.active_jaccard =
    state.previous_serviced_keys === null
      ? null
      : setJaccard(state.previous_serviced_keys, servicedKeys);
  if (state.active_jaccard !== null) {
    state.minimum_active_jaccard = Math.min(
      state.minimum_active_jaccard ?? state.active_jaccard,
      state.active_jaccard
    );
    state.maximum_active_churn = Math.max(state.maximum_active_churn, 1 - state.active_jaccard);
  }
  state.previous_serviced_keys = servicedKeys;
  state.stale_rejects_total += state.stale_rejects_last_step;
  state.inactive_rejects_total += state.inactive_rejects_last_step;
  state.distance_rejects_total += state.distance_rejects_last_step;
  state.friction_impulse_proxy_total += state.friction_impulse_proxy_last_step;
  state.apply_ms_last = performance.now() - applyStarted;
  state.apply_ms_total += state.apply_ms_last;
}

export function spatialFrictionReceipt(state, material) {
  return {
    enabled: state.enabled,
    maximum_pairs_per_segment: state.maximum_pairs_per_segment,
    retention_policy: "narrowphase_contact_radius",
    refresh_period_steps: state.refresh_period_steps,
    scale: state.scale,
    contact_radius: 0.14 + material.clump * 0.3,
    selected_pairs: state.selected_pairs.length,
    selected_pair_digest: state.selected_pair_digest,
    refresh_count: state.refresh_count,
    candidates_last_refresh: state.candidates_last_refresh,
    selected_last_refresh: state.selected_last_refresh,
    graph_overlap_skips_last_refresh: state.graph_overlap_skips_last_refresh,
    graph_overlap_skips_total: state.graph_overlap_skips_total,
    retained_last_refresh: state.retained_last_refresh,
    retained_total: state.retained_total,
    added_last_refresh: state.added_last_refresh,
    added_total: state.added_total,
    removed_last_refresh: state.removed_last_refresh,
    removed_total: state.removed_total,
    refresh_jaccard: state.refresh_jaccard,
    minimum_refresh_jaccard: state.minimum_refresh_jaccard,
    active_contacts_last_step: state.active_contacts_last_step,
    serviced_pair_digest: state.serviced_pair_digest,
    active_jaccard: state.active_jaccard,
    minimum_active_jaccard: state.minimum_active_jaccard,
    maximum_active_churn: state.maximum_active_churn,
    stale_rejects_last_step: state.stale_rejects_last_step,
    stale_rejects_total: state.stale_rejects_total,
    inactive_rejects_last_step: state.inactive_rejects_last_step,
    inactive_rejects_total: state.inactive_rejects_total,
    distance_rejects_last_step: state.distance_rejects_last_step,
    distance_rejects_total: state.distance_rejects_total,
    friction_impulse_proxy_last_step: state.friction_impulse_proxy_last_step,
    friction_impulse_proxy_total: state.friction_impulse_proxy_total,
    spatial_cohesion: false,
    spatial_pressure: false,
  };
}

export function spatialFrictionPerformanceReceipt(state) {
  return {
    refresh_ms_last: state.refresh_ms_last,
    refresh_ms_total: state.refresh_ms_total,
    apply_ms_last: state.apply_ms_last,
    apply_ms_total: state.apply_ms_total,
  };
}
