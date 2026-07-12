const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

function canonicalPairKey(pair) {
  return pair.a < pair.b ? `${pair.a}:${pair.b}` : `${pair.b}:${pair.a}`;
}

function digestParts(parts) {
  let hash = FNV_OFFSET;
  for (const part of parts) {
    for (const byte of new TextEncoder().encode(`${part}\n`)) {
      hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
    }
  }
  return hash.toString(16).padStart(16, "0");
}

function setIntersectionSize(left, right) {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function difference(left, right) {
  const values = [];
  for (const value of left) if (!right.has(value)) values.push(value);
  return values;
}

function pairTouchesInactiveSegment(key, activeSegmentIds) {
  const [left, right] = key.split(":").map(Number);
  return !activeSegmentIds.has(left) || !activeSegmentIds.has(right);
}

export function snapshotRankedContacts({ step, stateDigest, cutCount, activeSegmentIds, ranking }) {
  const admittedKeys = new Set();
  const riskByKey = new Map();
  let persistentCount = 0;
  let spatialCount = 0;
  for (const pair of ranking.admitted_pairs) {
    const key = canonicalPairKey(pair);
    admittedKeys.add(key);
    if (pair.source === "persistent") persistentCount += 1;
    else {
      spatialCount += 1;
      riskByKey.set(key, pair.risk_q);
    }
  }
  if (admittedKeys.size !== ranking.admitted_pairs.length) {
    throw new Error("ranked contact ids must be unique");
  }
  const receiptFields = [
    step,
    stateDigest,
    cutCount,
    admittedKeys.size,
    persistentCount,
    spatialCount,
    ranking.admitted_pair_digest,
    ranking.dropped_global_count,
    ranking.dropped_per_segment_count,
    ranking.dropped_global_zero_risk_count,
    ranking.dropped_per_segment_zero_risk_count,
    ranking.worst_admitted_spatial_risk_q,
  ];
  return {
    admittedKeys,
    riskByKey,
    activeSegmentIds: new Set(activeSegmentIds),
    receipt: {
      step,
      mechanical_state_digest: stateDigest,
      cut_count: cutCount,
      active_segment_count: activeSegmentIds.size,
      admitted_pair_count: admittedKeys.size,
      admitted_persistent_count: persistentCount,
      admitted_spatial_count: spatialCount,
      admitted_pair_digest: ranking.admitted_pair_digest,
      contact_frame_digest: digestParts(receiptFields),
      all_persistent_retained: ranking.all_persistent_retained,
      admitted_spatial_zero_risk_count: ranking.admitted_spatial_zero_risk_count,
      dropped_global_zero_risk_count: ranking.dropped_global_zero_risk_count,
      dropped_per_segment_zero_risk_count: ranking.dropped_per_segment_zero_risk_count,
      worst_admitted_spatial_risk_q: ranking.worst_admitted_spatial_risk_q,
      best_global_drop_risk_q: ranking.best_global_drop_risk_q,
      best_per_segment_drop_risk_q: ranking.best_per_segment_drop_risk_q,
      spatial_force_integration: ranking.spatial_force_integration,
    },
  };
}

export function summarizeContactTransition(previous, current) {
  const intersectionCount = setIntersectionSize(previous.admittedKeys, current.admittedKeys);
  const additions = difference(current.admittedKeys, previous.admittedKeys);
  const removals = difference(previous.admittedKeys, current.admittedKeys);
  const unionCount = new Set([...previous.admittedKeys, ...current.admittedKeys]).size;
  const symmetricDifferenceCount = additions.length + removals.length;
  if (intersectionCount + additions.length !== current.admittedKeys.size) {
    throw new Error("current contact partition identity failed");
  }
  if (intersectionCount + removals.length !== previous.admittedKeys.size) {
    throw new Error("previous contact partition identity failed");
  }
  if (intersectionCount + additions.length + removals.length !== unionCount) {
    throw new Error("contact union partition identity failed");
  }
  const inactiveIncidentRemovals = removals.filter((key) =>
    pairTouchesInactiveSegment(key, current.activeSegmentIds)
  ).length;
  const frontierCrossings = [...additions, ...removals].filter((key) => {
    const risk = current.riskByKey.get(key) ?? previous.riskByKey.get(key);
    if (risk === undefined) return false;
    const nearCurrent =
      current.receipt.worst_admitted_spatial_risk_q !== null &&
      Math.abs(risk - current.receipt.worst_admitted_spatial_risk_q) <= 1;
    const nearPrevious =
      previous.receipt.worst_admitted_spatial_risk_q !== null &&
      Math.abs(risk - previous.receipt.worst_admitted_spatial_risk_q) <= 1;
    return nearCurrent || nearPrevious;
  }).length;
  const receipt = {
    from_step: previous.receipt.step,
    to_step: current.receipt.step,
    step_delta: current.receipt.step - previous.receipt.step,
    previous_count: previous.admittedKeys.size,
    current_count: current.admittedKeys.size,
    intersection_count: intersectionCount,
    union_count: unionCount,
    additions_count: additions.length,
    removals_count: removals.length,
    symmetric_difference_count: symmetricDifferenceCount,
    jaccard: unionCount > 0 ? intersectionCount / unionCount : 1,
    churn_fraction: unionCount > 0 ? symmetricDifferenceCount / unionCount : 0,
    removals_incident_to_inactive_segments: inactiveIncidentRemovals,
    removals_with_both_segments_active: removals.length - inactiveIncidentRemovals,
    rank_frontier_crossing_count: frontierCrossings,
  };
  return {
    ...receipt,
    transition_digest: digestParts(Object.values(receipt)),
  };
}

export function digestContactTrace(frames, transitions) {
  return digestParts([
    ...frames.flatMap((frame) => [frame.step, frame.contact_frame_digest]),
    ...transitions.flatMap((transition) => [
      transition.from_step,
      transition.to_step,
      transition.transition_digest,
    ]),
  ]);
}
