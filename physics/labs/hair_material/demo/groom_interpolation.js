export const DEFAULT_GROOM_SECTION_COUNT = 8;
export const DEFAULT_GROOM_NEIGHBOR_COUNT = 3;

const MIN_NEIGHBOR_WEIGHT = 0.12;
const MAX_NEIGHBOR_WEIGHT = 0.45;

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

export function buildGroomInterpolationBindings(
  roots,
  guideCount,
  fiberCopies,
  { sectionCount = DEFAULT_GROOM_SECTION_COUNT, neighborCount = DEFAULT_GROOM_NEIGHBOR_COUNT } = {}
) {
  if (roots.length !== guideCount * 3) throw new Error("groom roots do not match guide count");
  if (!Number.isInteger(fiberCopies) || fiberCopies < 1) {
    throw new Error("groom fiber copy count must be a positive integer");
  }
  const bindingCount = guideCount * fiberCopies;
  const owners = new Uint16Array(bindingCount);
  const neighbors = new Uint16Array(bindingCount);
  const neighborWeights = new Float32Array(bindingCount);
  const sections = new Uint8Array(guideCount);
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
        neighborWeights[binding] = 0;
        continue;
      }
      neighbors[binding] = nearest[(copy - 1) % nearest.length];
      const blendFraction = (copy - 1) / Math.max(1, fiberCopies - 2);
      neighborWeights[binding] =
        MIN_NEIGHBOR_WEIGHT + (MAX_NEIGHBOR_WEIGHT - MIN_NEIGHBOR_WEIGHT) * blendFraction;
    }
  }
  const bindings = {
    bindingCount,
    guideCount,
    fiberCopies,
    sectionCount,
    neighborCount,
    owners,
    neighbors,
    neighborWeights,
    sections,
  };
  return { ...bindings, bindingDigest: groomBindingDigest(bindings) };
}

export function groomBindingActiveSegments(activeSegments, owner, neighbor, neighborWeight) {
  return neighborWeight === 0 || owner === neighbor
    ? activeSegments[owner]
    : Math.min(activeSegments[owner], activeSegments[neighbor]);
}

export function interpolateGroomScalar(ownerValue, neighborValue, neighborWeight) {
  return (1 - neighborWeight) * ownerValue + neighborWeight * neighborValue;
}

function hashByte(hash, byte) {
  return Math.imul(hash ^ byte, 0x01000193);
}

export function groomBindingDigest(bindings) {
  let hash = 0x811c9dc5;
  const header = new Uint16Array([
    bindings.guideCount,
    bindings.fiberCopies,
    bindings.sectionCount,
    bindings.neighborCount,
  ]);
  const arrays = [header, bindings.owners, bindings.neighbors, bindings.neighborWeights];
  for (const values of arrays) {
    const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
    for (const byte of bytes) hash = hashByte(hash, byte);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function groomInterpolationReceipt(bindings, buildCount) {
  if (!bindings) return null;
  return {
    mode: "section_interp_2parent",
    section_count: bindings.sectionCount,
    section_search_radius: 1,
    parent_count: 2,
    nearest_neighbors_per_guide: bindings.neighborCount,
    binding_count: bindings.bindingCount,
    binding_digest: bindings.bindingDigest,
    binding_build_count: buildCount,
    cut_length_rule: "pure_owner_else_min_parents",
  };
}
