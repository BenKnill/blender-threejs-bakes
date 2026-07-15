export const DEFAULT_GROOM_SECTION_COUNT = 8;
export const DEFAULT_GROOM_NEIGHBOR_COUNT = 3;

const MIN_NEIGHBOR_WEIGHT = 0.12;
const MAX_NEIGHBOR_WEIGHT = 0.45;
const VOLUME_ENVELOPE_START_FRACTION = 0.45;
const VOLUME_ENVELOPE_END_FRACTION = 0.9;
const SECONDARY_CUT_FADE_SEGMENTS = 2;
export const GROOM_DONOR_SHAPE_TRANSFER = 0.18;
export const GROOM_DONOR_SHAPE_LIMIT_METERS = 0.055;
export const PATCH_LOCK_SECTION_COUNT = 8;
export const PATCH_LOCK_RING_COUNT = 4;
export const PATCH_LOCK_COUNT = PATCH_LOCK_SECTION_COUNT * PATCH_LOCK_RING_COUNT;
export const PATCH_LOCK_CONVERGENCE_START = 0.15;
export const PATCH_LOCK_CONVERGENCE_END = 0.4;
export const PATCH_LOCK_OUTWARD_RADIUS_METERS = 0.032;
export const PATCH_LOCK_LATERAL_RADIUS_METERS = 0.018;
export const PATCH_LOCK_FIELD_ID = "scalp_patch_to_transport_lock_v1";

export function groomSectionId(x, z, sectionCount = DEFAULT_GROOM_SECTION_COUNT) {
  if (!Number.isInteger(sectionCount) || sectionCount < 1) {
    throw new Error("groom section count must be a positive integer");
  }
  const turn = (Math.atan2(z, x) + Math.PI) / (Math.PI * 2);
  return Math.min(sectionCount - 1, Math.floor(turn * sectionCount));
}

function sectionDistance(left, right, sectionCount) {
  const direct = Math.abs(left - right);
  return Math.min(direct, sectionCount - direct);
}

function nearestSectionNeighbors(roots, owner, sections, sectionCount, neighborCount) {
  const rootOffset = owner * 3;
  const candidates = [];
  for (let guide = 0; guide < sections.length; guide += 1) {
    if (guide === owner || sectionDistance(sections[owner], sections[guide], sectionCount) > 1) {
      continue;
    }
    const candidateOffset = guide * 3;
    const dx = roots[rootOffset] - roots[candidateOffset];
    const dy = roots[rootOffset + 1] - roots[candidateOffset + 1];
    const dz = roots[rootOffset + 2] - roots[candidateOffset + 2];
    candidates.push({ guide, distanceSquared: dx * dx + dy * dy + dz * dz });
  }
  candidates.sort(
    (left, right) => left.distanceSquared - right.distanceSquared || left.guide - right.guide
  );
  return candidates.slice(0, neighborCount).map((candidate) => candidate.guide);
}

function buildPatchAssignments(roots, guideCount) {
  const heightOrder = Array.from({ length: guideCount }, (_, guide) => guide).sort(
    (left, right) => roots[right * 3 + 1] - roots[left * 3 + 1] || left - right
  );
  const rings = new Uint8Array(guideCount);
  for (let rank = 0; rank < heightOrder.length; rank += 1) {
    rings[heightOrder[rank]] = Math.min(
      PATCH_LOCK_RING_COUNT - 1,
      Math.floor((rank * PATCH_LOCK_RING_COUNT) / guideCount)
    );
  }
  const guidePatchIds = new Uint8Array(guideCount);
  for (let guide = 0; guide < guideCount; guide += 1) {
    const root = guide * 3;
    guidePatchIds[guide] =
      rings[guide] * PATCH_LOCK_SECTION_COUNT +
      groomSectionId(roots[root], roots[root + 2], PATCH_LOCK_SECTION_COUNT);
  }
  return guidePatchIds;
}

export function buildGroomInterpolationBindings(
  roots,
  guideCount,
  fiberCopies,
  {
    sectionCount = DEFAULT_GROOM_SECTION_COUNT,
    neighborCount = DEFAULT_GROOM_NEIGHBOR_COUNT,
    parentCount = 2,
    patchLockEnabled = false,
  } = {}
) {
  if (roots.length !== guideCount * 3) throw new Error("groom roots do not match guide count");
  if (!Number.isInteger(fiberCopies) || fiberCopies < 1) {
    throw new Error("groom fiber copy count must be a positive integer");
  }
  if (![2, 3].includes(parentCount)) throw new Error("groom parent count must be 2 or 3");
  const bindingCount = guideCount * fiberCopies;
  const owners = new Uint16Array(bindingCount);
  const neighbors = new Uint16Array(bindingCount);
  const secondaryNeighbors = new Uint16Array(bindingCount);
  const neighborWeights = new Float32Array(bindingCount);
  const secondaryNeighborWeights = new Float32Array(bindingCount);
  const sections = new Uint8Array(guideCount);
  const guidePatchIds = patchLockEnabled
    ? buildPatchAssignments(roots, guideCount)
    : new Uint8Array();
  for (let guide = 0; guide < guideCount; guide += 1) {
    sections[guide] = groomSectionId(roots[guide * 3], roots[guide * 3 + 2], sectionCount);
  }
  for (let owner = 0; owner < guideCount; owner += 1) {
    const nearest = nearestSectionNeighbors(roots, owner, sections, sectionCount, neighborCount);
    for (let copy = 0; copy < fiberCopies; copy += 1) {
      const binding = owner * fiberCopies + copy;
      owners[binding] = owner;
      if (copy === 0 || nearest.length === 0) {
        neighbors[binding] = owner;
        secondaryNeighbors[binding] = owner;
        neighborWeights[binding] = 0;
        secondaryNeighborWeights[binding] = 0;
        continue;
      }
      const primaryIndex = (copy - 1) % nearest.length;
      neighbors[binding] = nearest[primaryIndex];
      const blendFraction = (copy - 1) / Math.max(1, fiberCopies - 2);
      const minimumNeighborWeight = parentCount === 3 ? 0.1 : MIN_NEIGHBOR_WEIGHT;
      const maximumNeighborWeight = parentCount === 3 ? 0.36 : MAX_NEIGHBOR_WEIGHT;
      const totalNeighborWeight =
        minimumNeighborWeight + (maximumNeighborWeight - minimumNeighborWeight) * blendFraction;
      if (parentCount === 2 || nearest.length < 2) {
        secondaryNeighbors[binding] = owner;
        neighborWeights[binding] = totalNeighborWeight;
        secondaryNeighborWeights[binding] = 0;
        continue;
      }
      const sameSectionSecondary = nearest.find(
        (guide) => guide !== neighbors[binding] && sections[guide] === sections[owner]
      );
      const secondaryOffset = 1 + (Math.floor((copy - 1) / nearest.length) % (nearest.length - 1));
      const secondaryIndex = (primaryIndex + secondaryOffset) % nearest.length;
      const splitPhase = (copy * 0.6180339887498949) % 1;
      const primaryFraction = 0.35 + 0.3 * splitPhase;
      secondaryNeighbors[binding] = sameSectionSecondary ?? nearest[secondaryIndex];
      neighborWeights[binding] = totalNeighborWeight * primaryFraction;
      secondaryNeighborWeights[binding] = totalNeighborWeight * (1 - primaryFraction);
    }
  }
  const bindings = {
    bindingCount,
    guideCount,
    fiberCopies,
    sectionCount,
    neighborCount,
    parentCount,
    owners,
    neighbors,
    secondaryNeighbors,
    neighborWeights,
    secondaryNeighborWeights,
    sections,
    patchLockEnabled,
    patchCount: patchLockEnabled ? PATCH_LOCK_COUNT : 0,
    guidePatchIds,
  };
  return { ...bindings, bindingDigest: groomBindingDigest(bindings) };
}

export function groomBindingActiveSegments(activeSegments, owner, neighbor, neighborWeight) {
  let active = activeSegments[owner];
  if (neighborWeight > 0 && owner !== neighbor) active = Math.min(active, activeSegments[neighbor]);
  return active;
}

export function interpolateGroomScalar(
  ownerValue,
  neighborValue,
  neighborWeight,
  secondaryNeighborValue = ownerValue,
  secondaryNeighborWeight = 0
) {
  return (
    (1 - neighborWeight - secondaryNeighborWeight) * ownerValue +
    neighborWeight * neighborValue +
    secondaryNeighborWeight * secondaryNeighborValue
  );
}

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function groomSecondaryWeightAt(
  segment,
  activeSegments,
  secondaryNeighborWeight,
  secondaryActiveSegments = activeSegments
) {
  const fraction = segment / Math.max(1, activeSegments);
  const envelope = smoothStep01(
    (fraction - VOLUME_ENVELOPE_START_FRACTION) /
      (VOLUME_ENVELOPE_END_FRACTION - VOLUME_ENVELOPE_START_FRACTION)
  );
  const cutFade =
    secondaryActiveSegments < activeSegments
      ? smoothStep01((secondaryActiveSegments - segment) / SECONDARY_CUT_FADE_SEGMENTS)
      : 1;
  return secondaryNeighborWeight * envelope * cutFade;
}

export function groomDonorShapeTransferAt(fraction) {
  return GROOM_DONOR_SHAPE_TRANSFER * smoothStep01((fraction - 0.18) / (0.72 - 0.18));
}

export function transportGroomPoint(
  output,
  outputOffset,
  positions,
  ownerRoot,
  ownerPoint,
  neighborRoot,
  neighborPoint,
  neighborWeight,
  secondaryRoot = ownerRoot,
  secondaryPoint = ownerPoint,
  secondaryWeight = 0,
  shapeTransfer = GROOM_DONOR_SHAPE_TRANSFER,
  maximumCorrection = GROOM_DONOR_SHAPE_LIMIT_METERS
) {
  let correctionSquared = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const ownerDisplacement = positions[ownerPoint + axis] - positions[ownerRoot + axis];
    const neighborDisplacement = positions[neighborPoint + axis] - positions[neighborRoot + axis];
    const secondaryDisplacement =
      positions[secondaryPoint + axis] - positions[secondaryRoot + axis];
    const donorDifference =
      neighborWeight * (neighborDisplacement - ownerDisplacement) +
      secondaryWeight * (secondaryDisplacement - ownerDisplacement);
    const correction = donorDifference * Math.max(0, shapeTransfer);
    output[outputOffset + axis] =
      interpolateGroomScalar(
        positions[ownerRoot + axis],
        positions[neighborRoot + axis],
        neighborWeight,
        positions[secondaryRoot + axis],
        secondaryWeight
      ) +
      ownerDisplacement +
      correction;
    correctionSquared += correction * correction;
  }
  const correctionLength = Math.sqrt(correctionSquared);
  const boundedMaximum = Math.max(0, maximumCorrection);
  if (correctionLength > boundedMaximum && correctionLength > 0) {
    const correctionScale = boundedMaximum / correctionLength;
    for (let axis = 0; axis < 3; axis += 1) {
      const ownerDisplacement = positions[ownerPoint + axis] - positions[ownerRoot + axis];
      const neighborDisplacement = positions[neighborPoint + axis] - positions[neighborRoot + axis];
      const secondaryDisplacement =
        positions[secondaryPoint + axis] - positions[secondaryRoot + axis];
      const donorDifference =
        neighborWeight * (neighborDisplacement - ownerDisplacement) +
        secondaryWeight * (secondaryDisplacement - ownerDisplacement);
      const uncorrected =
        output[outputOffset + axis] - donorDifference * Math.max(0, shapeTransfer);
      output[outputOffset + axis] =
        uncorrected + donorDifference * Math.max(0, shapeTransfer) * correctionScale;
    }
  }
  return output;
}

function hashByte(hash, byte) {
  return Math.imul(hash ^ byte, 0x01000193);
}

export function groomBindingDigest(bindings) {
  let hash = 0x811c9dc5;
  const header =
    bindings.parentCount === 2
      ? new Uint16Array([
          bindings.guideCount,
          bindings.fiberCopies,
          bindings.sectionCount,
          bindings.neighborCount,
        ])
      : new Uint16Array([
          bindings.guideCount,
          bindings.fiberCopies,
          bindings.sectionCount,
          bindings.neighborCount,
          bindings.parentCount,
        ]);
  const arrays = [header, bindings.owners, bindings.neighbors, bindings.neighborWeights];
  if (bindings.parentCount === 3) {
    arrays.push(bindings.secondaryNeighbors, bindings.secondaryNeighborWeights);
  }
  if (bindings.patchLockEnabled) {
    arrays.push(new Uint16Array([bindings.patchCount]), bindings.guidePatchIds);
  }
  if (bindings.independentDisplayFollicles) {
    arrays.push(new Uint8Array([1]), bindings.displayRoots, bindings.displayNormals);
  }
  for (const values of arrays) {
    const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
    for (const byte of bytes) hash = hashByte(hash, byte);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function groomInterpolationReceipt(bindings, buildCount) {
  if (!bindings) return null;
  return {
    mode: `section_interp_${bindings.parentCount}parent`,
    section_count: bindings.sectionCount,
    section_search_radius: 1,
    parent_count: bindings.parentCount,
    nearest_neighbors_per_guide: bindings.neighborCount,
    binding_count: bindings.bindingCount,
    binding_digest: bindings.bindingDigest,
    binding_build_count: buildCount,
    cut_length_rule:
      bindings.parentCount === 3
        ? "owner_primary_length_secondary_donor_fade"
        : "pure_owner_else_min_parents",
    secondary_weight_envelope: bindings.parentCount === 3 ? "smoothstep_45pct_to_90pct" : "none",
    secondary_cut_fade_segments: bindings.parentCount === 3 ? SECONDARY_CUT_FADE_SEGMENTS : 0,
    curve_transport: "owner_displacement_plus_bounded_donor_shape",
    donor_shape_transfer: GROOM_DONOR_SHAPE_TRANSFER,
    donor_shape_limit_m: GROOM_DONOR_SHAPE_LIMIT_METERS,
    ...(bindings.independentDisplayFollicles
      ? {
          independent_display_follicles: {
            enabled: true,
            layout_identity: bindings.displayFollicleLayoutId,
            unique_root_count: bindings.bindingCount,
          },
        }
      : {}),
    patch_lock: bindings.patchLockEnabled
      ? {
          field_identity: PATCH_LOCK_FIELD_ID,
          patch_count: bindings.patchCount,
          ring_count: PATCH_LOCK_RING_COUNT,
          section_count: PATCH_LOCK_SECTION_COUNT,
          convergence_fraction: [PATCH_LOCK_CONVERGENCE_START, PATCH_LOCK_CONVERGENCE_END],
          cross_section_radii_m: [
            PATCH_LOCK_OUTWARD_RADIUS_METERS,
            PATCH_LOCK_LATERAL_RADIUS_METERS,
          ],
          motion_source: "live_mean_mechanical_guide_trajectory_per_patch",
          physics_authority: "none_renderer_only",
        }
      : null,
  };
}
