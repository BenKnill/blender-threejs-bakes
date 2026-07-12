const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

function pairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function parsePairKey(key) {
  return key.split(":").map(Number);
}

function comparePairKeys(left, right) {
  const [leftA, leftB] = left.split(":").map(Number);
  const [rightA, rightB] = right.split(":").map(Number);
  return leftA - rightA || leftB - rightB;
}

export function paddedSegmentAabbsOverlap(left, right, padding = 0) {
  for (let axis = 0; axis < 3; axis += 1) {
    const leftLow = Math.min(left.a[axis], left.b[axis]) - padding;
    const leftHigh = Math.max(left.a[axis], left.b[axis]) + padding;
    const rightLow = Math.min(right.a[axis], right.b[axis]) - padding;
    const rightHigh = Math.max(right.a[axis], right.b[axis]) + padding;
    if (leftHigh < rightLow || rightHigh < leftLow) return false;
  }
  return true;
}

export function segmentAabbGapSquared(left, right) {
  let gapSquared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const leftLow = Math.min(left.a[axis], left.b[axis]);
    const leftHigh = Math.max(left.a[axis], left.b[axis]);
    const rightLow = Math.min(right.a[axis], right.b[axis]);
    const rightHigh = Math.max(right.a[axis], right.b[axis]);
    const gap = Math.max(0, leftLow - rightHigh, rightLow - leftHigh);
    gapSquared += gap * gap;
  }
  return gapSquared;
}

function dot3(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function subtract3(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function closestSegmentPoints(left, right) {
  const directionLeft = subtract3(left.b, left.a);
  const directionRight = subtract3(right.b, right.a);
  const offset = subtract3(left.a, right.a);
  const lengthLeftSquared = dot3(directionLeft, directionLeft);
  const lengthRightSquared = dot3(directionRight, directionRight);
  const rightProjection = dot3(directionRight, offset);
  const degenerateEpsilon = 1e-24;
  let leftParameter;
  let rightParameter;

  if (lengthLeftSquared <= degenerateEpsilon && lengthRightSquared <= degenerateEpsilon) {
    leftParameter = 0;
    rightParameter = 0;
  } else if (lengthLeftSquared <= degenerateEpsilon) {
    leftParameter = 0;
    rightParameter = clamp01(rightProjection / lengthRightSquared);
  } else {
    const leftProjection = dot3(directionLeft, offset);
    if (lengthRightSquared <= degenerateEpsilon) {
      rightParameter = 0;
      leftParameter = clamp01(-leftProjection / lengthLeftSquared);
    } else {
      const directionDot = dot3(directionLeft, directionRight);
      const denominator = lengthLeftSquared * lengthRightSquared - directionDot * directionDot;
      const parallelThreshold = Number.EPSILON * 16 * lengthLeftSquared * lengthRightSquared;
      leftParameter =
        denominator > parallelThreshold
          ? clamp01(
              (directionDot * rightProjection - leftProjection * lengthRightSquared) / denominator
            )
          : 0;
      rightParameter = (directionDot * leftParameter + rightProjection) / lengthRightSquared;
      if (rightParameter < 0) {
        rightParameter = 0;
        leftParameter = clamp01(-leftProjection / lengthLeftSquared);
      } else if (rightParameter > 1) {
        rightParameter = 1;
        leftParameter = clamp01((directionDot - leftProjection) / lengthLeftSquared);
      }
    }
  }

  const leftPoint = [0, 1, 2].map((axis) => left.a[axis] + directionLeft[axis] * leftParameter);
  const rightPoint = [0, 1, 2].map((axis) => right.a[axis] + directionRight[axis] * rightParameter);
  const separation = subtract3(leftPoint, rightPoint);
  return {
    left_parameter: leftParameter,
    right_parameter: rightParameter,
    left_point: leftPoint,
    right_point: rightPoint,
    separation,
    distance_squared: Math.max(0, dot3(separation, separation)),
  };
}

export function segmentSegmentDistanceSquared(left, right) {
  return closestSegmentPoints(left, right).distance_squared;
}

export function quantizeSquaredRisk(value, scale = 1e8) {
  if (!(value >= 0) || !Number.isFinite(value) || !(scale > 0)) {
    throw new Error("risk must be finite and nonnegative");
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value * scale));
}

export function segmentAabbCellKeys(segment, cellSize, padding = 0) {
  if (!(cellSize > 0) || !(padding >= 0)) throw new Error("invalid spatial hash scale");
  const bounds = [0, 1, 2].map((axis) => [
    Math.floor((Math.min(segment.a[axis], segment.b[axis]) - padding) / cellSize),
    Math.floor((Math.max(segment.a[axis], segment.b[axis]) + padding) / cellSize),
  ]);
  const keys = [];
  for (let x = bounds[0][0]; x <= bounds[0][1]; x += 1) {
    for (let y = bounds[1][0]; y <= bounds[1][1]; y += 1) {
      for (let z = bounds[2][0]; z <= bounds[2][1]; z += 1) keys.push(`${x},${y},${z}`);
    }
  }
  return keys;
}

export function digestOrderedPairs(pairs) {
  let hash = FNV_OFFSET;
  for (const pair of pairs) {
    for (const value of [pair.a, pair.b]) {
      for (const byte of new TextEncoder().encode(`${value}:`)) {
        hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
      }
    }
  }
  return hash.toString(16).padStart(16, "0");
}

export function discoverSegmentPairs(
  segments,
  { cellSize, padding = 0, maxPairsPerSegment = 16, maxPairs = 20000 } = {}
) {
  const orderedSegments = [...segments].sort((left, right) => left.id - right.id);
  if (new Set(orderedSegments.map((segment) => segment.id)).size !== orderedSegments.length) {
    throw new Error("segment ids must be unique");
  }
  const byId = new Map(orderedSegments.map((segment) => [segment.id, segment]));
  const cells = new Map();
  let cellInsertions = 0;
  for (const segment of orderedSegments) {
    for (const key of segmentAabbCellKeys(segment, cellSize, padding)) {
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(segment.id);
      cellInsertions += 1;
    }
  }

  const unboundedPairsByLeft = new Map();
  for (const ids of cells.values()) {
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const left = byId.get(ids[leftIndex]);
        const right = byId.get(ids[rightIndex]);
        if (left.guide === right.guide) continue;
        if (!paddedSegmentAabbsOverlap(left, right, padding)) continue;
        if (!unboundedPairsByLeft.has(left.id)) unboundedPairsByLeft.set(left.id, new Set());
        unboundedPairsByLeft.get(left.id).add(right.id);
      }
    }
  }
  const unboundedPairs = [];
  for (const [a, rightIds] of unboundedPairsByLeft) {
    for (const b of rightIds) unboundedPairs.push({ a, b });
  }
  unboundedPairs.sort((left, right) => left.a - right.a || left.b - right.b);

  const counts = new Map();
  const saturatedSegments = new Set();
  const pairs = [];
  let globalSaturated = false;
  for (const { a, b } of unboundedPairs) {
    if ((counts.get(a) ?? 0) >= maxPairsPerSegment || (counts.get(b) ?? 0) >= maxPairsPerSegment) {
      saturatedSegments.add((counts.get(a) ?? 0) >= maxPairsPerSegment ? a : b);
      continue;
    }
    if (pairs.length >= maxPairs) {
      globalSaturated = true;
      break;
    }
    pairs.push({ a, b });
    counts.set(a, (counts.get(a) ?? 0) + 1);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }

  return {
    pairs,
    pair_digest: digestOrderedPairs(pairs),
    segment_count: orderedSegments.length,
    occupied_cell_count: cells.size,
    cell_insertions: cellInsertions,
    unbounded_candidate_count: unboundedPairs.length,
    emitted_candidate_count: pairs.length,
    max_pairs_per_segment: maxPairsPerSegment,
    max_pairs: maxPairs,
    saturated_segment_ids: [...saturatedSegments].sort((left, right) => left - right),
    global_saturated: globalSaturated,
  };
}

export function hairSolverSegments(solver) {
  const segments = [];
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    for (let segment = 0; segment < solver.activeSegments[guide]; segment += 1) {
      const a = solver.index(guide, segment);
      const b = solver.index(guide, segment + 1);
      segments.push({
        id: guide * solver.segments + segment,
        guide,
        segment,
        a: [solver.positions[a], solver.positions[a + 1], solver.positions[a + 2]],
        b: [solver.positions[b], solver.positions[b + 1], solver.positions[b + 2]],
      });
    }
  }
  return segments;
}

export function hairSolverPersistentPairs(solver) {
  const keys = new Set();
  for (const bond of solver.clumpBonds) {
    const [pairIndex, particle] = bond.split(":").map(Number);
    const [guideA, guideB] = solver.neighborPairs[pairIndex];
    const segment = particle - 1;
    if (segment < 0 || segment >= solver.activeSegments[guideA]) continue;
    if (segment >= solver.activeSegments[guideB]) continue;
    keys.add(pairKey(guideA * solver.segments + segment, guideB * solver.segments + segment));
  }
  return [...keys].sort(comparePairKeys).map((key) => {
    const [a, b] = parsePairKey(key);
    return { a, b };
  });
}

export function rankSpatialCandidates(
  segments,
  discoveredPairs,
  persistentPairs,
  {
    maxPairs = 20000,
    maxNewPairsPerSegment = 16,
    riskScale = 1e8,
    riskMetric = "segment_distance_squared",
  } = {}
) {
  if (!["aabb_gap_squared", "segment_distance_squared"].includes(riskMetric)) {
    throw new Error(`unknown spatial risk metric: ${riskMetric}`);
  }
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const persistentKeys = [...new Set(persistentPairs.map((pair) => pairKey(pair.a, pair.b)))].sort(
    comparePairKeys
  );
  for (const key of persistentKeys) {
    const [a, b] = parsePairKey(key);
    if (!byId.has(a) || !byId.has(b)) throw new Error(`persistent pair is inactive: ${key}`);
  }
  const persistentOverflow = persistentKeys.length > maxPairs;
  const admitted = persistentKeys.slice(0, maxPairs).map((key) => {
    const [a, b] = parsePairKey(key);
    return { a, b, source: "persistent", risk_q: null };
  });
  const admittedKeys = new Set(admitted.map((pair) => pairKey(pair.a, pair.b)));
  const rankedSpatial = [];
  for (const pair of discoveredPairs) {
    const key = pairKey(pair.a, pair.b);
    if (admittedKeys.has(key)) continue;
    const left = byId.get(pair.a);
    const right = byId.get(pair.b);
    if (!left || !right) throw new Error(`candidate references inactive segment: ${key}`);
    rankedSpatial.push({
      a: Math.min(pair.a, pair.b),
      b: Math.max(pair.a, pair.b),
      source: "spatial",
      risk_q: quantizeSquaredRisk(
        riskMetric === "aabb_gap_squared"
          ? segmentAabbGapSquared(left, right)
          : segmentSegmentDistanceSquared(left, right),
        riskScale
      ),
    });
  }
  rankedSpatial.sort(
    (left, right) => left.risk_q - right.risk_q || left.a - right.a || left.b - right.b
  );

  const newCounts = new Map();
  let droppedGlobal = 0;
  let droppedPerSegment = 0;
  let bestGlobalDropRisk = null;
  let bestPerSegmentDropRisk = null;
  let worstAdmittedSpatialRisk = null;
  let admittedSpatialZeroRisk = 0;
  let droppedGlobalZeroRisk = 0;
  let droppedPerSegmentZeroRisk = 0;
  for (const pair of rankedSpatial) {
    if (
      (newCounts.get(pair.a) ?? 0) >= maxNewPairsPerSegment ||
      (newCounts.get(pair.b) ?? 0) >= maxNewPairsPerSegment
    ) {
      droppedPerSegment += 1;
      if (pair.risk_q === 0) droppedPerSegmentZeroRisk += 1;
      bestPerSegmentDropRisk = Math.min(bestPerSegmentDropRisk ?? pair.risk_q, pair.risk_q);
      continue;
    }
    if (admitted.length >= maxPairs) {
      droppedGlobal += 1;
      if (pair.risk_q === 0) droppedGlobalZeroRisk += 1;
      bestGlobalDropRisk = Math.min(bestGlobalDropRisk ?? pair.risk_q, pair.risk_q);
      continue;
    }
    admitted.push(pair);
    if (pair.risk_q === 0) admittedSpatialZeroRisk += 1;
    newCounts.set(pair.a, (newCounts.get(pair.a) ?? 0) + 1);
    newCounts.set(pair.b, (newCounts.get(pair.b) ?? 0) + 1);
    worstAdmittedSpatialRisk = Math.max(worstAdmittedSpatialRisk ?? pair.risk_q, pair.risk_q);
  }

  const admittedPersistent = admitted.filter((pair) => pair.source === "persistent").length;
  const admittedSpatial = admitted.length - admittedPersistent;
  return {
    admitted_pairs: admitted,
    admitted_pair_digest: digestOrderedPairs(admitted),
    risk_metric: riskMetric,
    risk_scale: riskScale,
    discovered_pair_count: discoveredPairs.length,
    persistent_pair_count: persistentKeys.length,
    admitted_persistent_count: admittedPersistent,
    admitted_spatial_count: admittedSpatial,
    dropped_global_count: droppedGlobal,
    dropped_per_segment_count: droppedPerSegment,
    admitted_spatial_zero_risk_count: admittedSpatialZeroRisk,
    dropped_global_zero_risk_count: droppedGlobalZeroRisk,
    dropped_per_segment_zero_risk_count: droppedPerSegmentZeroRisk,
    maximum_pairs: maxPairs,
    maximum_new_pairs_per_segment: maxNewPairsPerSegment,
    persistent_capacity_saturated: persistentOverflow,
    capacity_saturated: admitted.length >= maxPairs,
    all_persistent_retained: !persistentOverflow && admittedPersistent === persistentKeys.length,
    worst_admitted_spatial_risk_q: worstAdmittedSpatialRisk,
    best_global_drop_risk_q: bestGlobalDropRisk,
    best_per_segment_drop_risk_q: bestPerSegmentDropRisk,
    spatial_force_integration: false,
  };
}
