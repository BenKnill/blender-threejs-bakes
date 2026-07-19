import { SPARSE_GROOM_HEROES, sparseGroomRestPoint } from "./sparse_groom_cage.js?v=1";

export const LOCK_LAMINAE_FIELD_ID = "spatially_contiguous_fiber_laminae_v2";
export const LOCK_LAMINA_COUNT = 3;
export const LOCK_LAMINA_CENTER_SEPARATION_METERS = 0.32 / 3;
export const LOCK_LAMINA_INTERIOR_WIDTH_MULTIPLIER = 1.25;
export const LOCK_LAMINA_EDGE_WIDTH_MULTIPLIER = 0.45;

const framePrior = new Float64Array(3);
const frameNext = new Float64Array(3);
const coordinatePoint = new Float64Array(3);
const coordinateCenter = new Float64Array(3);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep01(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function deterministicUnit(root) {
  const value = Math.sin(root[0] * 43.17 + root[1] * 79.31 + root[2] * 37.73) * 43758.5453;
  return value - Math.floor(value);
}

function lateralCoordinate(root, hero) {
  let lateralX = hero.anchor[2];
  let lateralZ = -hero.anchor[0];
  const length = Math.hypot(lateralX, lateralZ) || 1;
  lateralX /= length;
  lateralZ /= length;
  return (root[0] - hero.root[0]) * lateralX + (root[2] - hero.root[2]) * lateralZ;
}

function transportedFrameAt(hero, fraction) {
  const epsilon = 1e-3;
  sparseGroomRestPoint(hero.root, Math.max(0, fraction - epsilon), framePrior);
  sparseGroomRestPoint(hero.root, Math.min(1, fraction + epsilon), frameNext);
  let tangentX = frameNext[0] - framePrior[0];
  let tangentY = frameNext[1] - framePrior[1];
  let tangentZ = frameNext[2] - framePrior[2];
  const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
  tangentX /= tangentLength;
  tangentY /= tangentLength;
  tangentZ /= tangentLength;
  let lateralX = hero.anchor[2];
  let lateralY = 0;
  let lateralZ = -hero.anchor[0];
  const along = lateralX * tangentX + lateralY * tangentY + lateralZ * tangentZ;
  lateralX -= tangentX * along;
  lateralY -= tangentY * along;
  lateralZ -= tangentZ * along;
  const lateralLength = Math.hypot(lateralX, lateralY, lateralZ) || 1;
  lateralX /= lateralLength;
  lateralY /= lateralLength;
  lateralZ /= lateralLength;
  let outwardX = lateralY * tangentZ - lateralZ * tangentY;
  let outwardY = lateralZ * tangentX - lateralX * tangentZ;
  let outwardZ = lateralX * tangentY - lateralY * tangentX;
  const outwardLength = Math.hypot(outwardX, outwardY, outwardZ) || 1;
  outwardX /= outwardLength;
  outwardY /= outwardLength;
  outwardZ /= outwardLength;
  if (outwardX * hero.anchor[0] + outwardY * hero.anchor[1] + outwardZ * hero.anchor[2] < 0) {
    outwardX *= -1;
    outwardY *= -1;
    outwardZ *= -1;
  }
  return {
    tangent: [tangentX, tangentY, tangentZ],
    lateral: [lateralX, lateralY, lateralZ],
    outward: [outwardX, outwardY, outwardZ],
  };
}

export function lockLaminaCrossCoordinateAt(root, heroId, fraction = 0.4) {
  const hero = SPARSE_GROOM_HEROES[heroId];
  sparseGroomRestPoint(root, fraction, coordinatePoint);
  sparseGroomRestPoint(hero.root, fraction, coordinateCenter);
  const frame = transportedFrameAt(hero, fraction);
  return (
    (coordinatePoint[0] - coordinateCenter[0]) * frame.lateral[0] +
    (coordinatePoint[1] - coordinateCenter[1]) * frame.lateral[1] +
    (coordinatePoint[2] - coordinateCenter[2]) * frame.lateral[2]
  );
}

export function lockLaminaHalfWidthAt(fraction) {
  return 0.075 + 0.015 * smoothstep01((fraction - 0.4) / 0.3);
}

export function lockLaminaOverlapRatioAt(fraction) {
  const width = lockLaminaHalfWidthAt(fraction) * 2;
  return Math.max(0, (width - LOCK_LAMINA_CENTER_SEPARATION_METERS) / width);
}

export function lockLaminaSample(root, heroId, laminaId, coordinateOverride = null) {
  const hero = SPARSE_GROOM_HEROES[heroId];
  const center = (laminaId - 1) * LOCK_LAMINA_CENTER_SEPARATION_METERS;
  const coordinate =
    coordinateOverride ??
    clamp(
      (lateralCoordinate(root, hero) - center) / (LOCK_LAMINA_CENTER_SEPARATION_METERS * 0.5),
      -1,
      1
    );
  const absolute = Math.abs(coordinate);
  const role = absolute <= 0.72 ? 0 : coordinate < 0 ? 1 : 2;
  const retainedLength = role === 0 ? 1 : 0.96 + deterministicUnit(root) * 0.025;
  return {
    laminaId,
    coordinate,
    role,
    bodyWidthMultiplier:
      role === 0 ? LOCK_LAMINA_INTERIOR_WIDTH_MULTIPLIER : LOCK_LAMINA_EDGE_WIDTH_MULTIPLIER,
    retainedLength,
  };
}

export function buildLockLaminaAssignments(roots, heroIds) {
  const samples = new Array(heroIds.length);
  const groups = Array.from({ length: SPARSE_GROOM_HEROES.length }, () => []);
  for (let binding = 0; binding < heroIds.length; binding += 1) {
    const root = roots.subarray(binding * 3, binding * 3 + 3);
    groups[heroIds[binding]].push({
      binding,
      crossCoordinate: lockLaminaCrossCoordinateAt(root, heroIds[binding], 0.4),
    });
  }
  for (const group of groups) {
    group.sort(
      (left, right) => left.crossCoordinate - right.crossCoordinate || left.binding - right.binding
    );
    for (let laminaId = 0; laminaId < LOCK_LAMINA_COUNT; laminaId += 1) {
      const start = Math.floor((laminaId * group.length) / LOCK_LAMINA_COUNT);
      const end = Math.floor(((laminaId + 1) * group.length) / LOCK_LAMINA_COUNT);
      const span = Math.max(1, end - start - 1);
      for (let rank = start; rank < end; rank += 1) {
        const entry = group[rank];
        const coordinate = -1 + (2 * (rank - start)) / span;
        const root = roots.subarray(entry.binding * 3, entry.binding * 3 + 3);
        samples[entry.binding] = lockLaminaSample(
          root,
          heroIds[entry.binding],
          laminaId,
          coordinate
        );
      }
    }
  }
  return samples;
}

export function summarizeLockLaminaAssignments(roots, heroIds, samples) {
  const groups = Array.from({ length: SPARSE_GROOM_HEROES.length }, () => []);
  for (let binding = 0; binding < heroIds.length; binding += 1) {
    groups[heroIds[binding]].push({
      binding,
      crossCoordinate: lockLaminaCrossCoordinateAt(
        roots.subarray(binding * 3, binding * 3 + 3),
        heroIds[binding],
        0.4
      ),
      laminaId: samples[binding].laminaId,
      root: Array.from(roots.subarray(binding * 3, binding * 3 + 3)),
    });
  }
  const intervalCounts = [];
  const agreements = [];
  for (const group of groups) {
    group.sort(
      (left, right) => left.crossCoordinate - right.crossCoordinate || left.binding - right.binding
    );
    const counts = new Uint8Array(LOCK_LAMINA_COUNT);
    let prior = -1;
    for (let index = 0; index < group.length; index += 1) {
      const entry = group[index];
      if (entry.laminaId !== prior) counts[entry.laminaId] += 1;
      prior = entry.laminaId;
      const nearest = group
        .filter((candidate) => candidate.binding !== entry.binding)
        .map((candidate) => ({
          laminaId: candidate.laminaId,
          distanceSquared:
            (candidate.root[0] - entry.root[0]) ** 2 +
            (candidate.root[1] - entry.root[1]) ** 2 +
            (candidate.root[2] - entry.root[2]) ** 2,
          binding: candidate.binding,
        }))
        .sort(
          (left, right) =>
            left.distanceSquared - right.distanceSquared || left.binding - right.binding
        )
        .slice(0, 16);
      const same = nearest.filter((candidate) => candidate.laminaId === entry.laminaId).length;
      const neighbors = nearest.length;
      agreements.push(neighbors > 0 ? same / neighbors : 1);
    }
    intervalCounts.push(Array.from(counts));
  }
  agreements.sort((left, right) => left - right);
  const quantile = (fraction) =>
    agreements[Math.min(agreements.length - 1, Math.floor(agreements.length * fraction))];
  let evaluatedBoundaryGap = 0;
  const interiorBoundary = new Float64Array(3);
  const edgeBoundary = new Float64Array(3);
  for (const hero of SPARSE_GROOM_HEROES) {
    for (let laminaId = 0; laminaId < LOCK_LAMINA_COUNT; laminaId += 1) {
      for (const coordinate of [-0.72, 0.72]) {
        for (const fraction of [0.4, 0.7]) {
          lockLaminaOffset(
            hero.root,
            hero.id,
            { laminaId, coordinate, role: 0 },
            fraction,
            interiorBoundary
          );
          lockLaminaOffset(
            hero.root,
            hero.id,
            { laminaId, coordinate, role: coordinate < 0 ? 1 : 2 },
            fraction,
            edgeBoundary
          );
          evaluatedBoundaryGap = Math.max(
            evaluatedBoundaryGap,
            Math.hypot(
              interiorBoundary[0] - edgeBoundary[0],
              interiorBoundary[1] - edgeBoundary[1],
              interiorBoundary[2] - edgeBoundary[2]
            )
          );
        }
      }
    }
  }
  return {
    connected_interval_counts_by_hero: intervalCounts,
    maximum_connected_intervals_per_hero_lamina: Math.max(...intervalCounts.flat()),
    all_hero_lamina_supports_single_interval: intervalCounts.every((counts) =>
      counts.every((count) => count === 1)
    ),
    nearest_16_same_lamina_agreement: {
      p10: quantile(0.1),
      p50: quantile(0.5),
      p90: quantile(0.9),
    },
    evaluated_role_boundary_position_gap_m: evaluatedBoundaryGap,
  };
}

export function lockLaminaOffset(root, heroId, sample, fraction, output, outputOffset = 0) {
  const t = clamp(fraction, 0, 1);
  output[outputOffset] = 0;
  output[outputOffset + 1] = 0;
  output[outputOffset + 2] = 0;
  if (t <= 0.08) return output;
  const hero = SPARSE_GROOM_HEROES[heroId];
  const frame = transportedFrameAt(hero, t);
  const ramp = smoothstep01((t - 0.08) / 0.1);
  const halfWidth = lockLaminaHalfWidthAt(t);
  const lateral =
    ((sample.laminaId - 1) * LOCK_LAMINA_CENTER_SEPARATION_METERS + sample.coordinate * halfWidth) *
    ramp;
  const edgeRamp = smoothstep01((Math.abs(sample.coordinate) - 0.72) / 0.28);
  const feather = edgeRamp * halfWidth * 0.12;
  const layerDepth = [0, 0.014, 0.007][sample.laminaId];
  const dome = (1 - sample.coordinate ** 2) * 0.024;
  const outward = (layerDepth + dome + feather) * ramp;
  output[outputOffset] = frame.lateral[0] * lateral + frame.outward[0] * outward;
  output[outputOffset + 1] = frame.lateral[1] * lateral + frame.outward[1] * outward;
  output[outputOffset + 2] = frame.lateral[2] * lateral + frame.outward[2] * outward;
  return output;
}
