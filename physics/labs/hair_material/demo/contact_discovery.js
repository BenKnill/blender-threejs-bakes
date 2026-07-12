const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

function compareCellKeys(left, right) {
  const a = left.split(",").map(Number);
  const b = right.split(",").map(Number);
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function pairKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
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

  const unboundedPairs = new Set();
  for (const key of [...cells.keys()].sort(compareCellKeys)) {
    const ids = cells.get(key).sort((left, right) => left - right);
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const left = byId.get(ids[leftIndex]);
        const right = byId.get(ids[rightIndex]);
        if (left.guide === right.guide) continue;
        if (!paddedSegmentAabbsOverlap(left, right, padding)) continue;
        unboundedPairs.add(pairKey(left.id, right.id));
      }
    }
  }

  const counts = new Map();
  const saturatedSegments = new Set();
  const pairs = [];
  let globalSaturated = false;
  for (const key of [...unboundedPairs].sort(comparePairKeys)) {
    const [a, b] = key.split(":").map(Number);
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
    unbounded_candidate_count: unboundedPairs.size,
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
