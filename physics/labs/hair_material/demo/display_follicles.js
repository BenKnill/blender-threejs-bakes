import { projectPointToScalpShell, scalpPolarLimit, scalpRootFrame } from "./scalp_layout.js?v=116";

export const DISPLAY_FOLLICLE_LAYOUT_ID = "independent_golden_scalp_follicles_v1";
export const DISPLAY_FOLLICLE_PART_X = -0.18;
export const DISPLAY_FOLLICLE_PART_HALF_WIDTH_METERS = 0.035;

function quantiles(values) {
  values.sort((left, right) => left - right);
  const at = (fraction) =>
    values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9) };
}

function float64Digest(values) {
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function warpRootAwayFromPart(root, normal, index) {
  if (normal[1] < 0.62) return;
  const distance = root[0] - DISPLAY_FOLLICLE_PART_X;
  const absolute = Math.abs(distance);
  if (absolute >= DISPLAY_FOLLICLE_PART_HALF_WIDTH_METERS) return;
  const side = absolute > 1e-9 ? Math.sign(distance) : index % 2 === 0 ? -1 : 1;
  root[0] += side * (DISPLAY_FOLLICLE_PART_HALF_WIDTH_METERS - absolute);
  projectPointToScalpShell(root[0], root[1], root[2], root);
}

export function buildIndependentDisplayFollicles(mechanicalRoots, displayCount) {
  const guideCount = mechanicalRoots.length / 3;
  const roots = new Float64Array(displayCount * 3);
  const normals = new Float64Array(displayCount * 3);
  const owners = new Uint16Array(displayCount);
  const neighbors = new Uint16Array(displayCount);
  const secondaryNeighbors = new Uint16Array(displayCount);
  const neighborWeights = new Float32Array(displayCount);
  const secondaryNeighborWeights = new Float32Array(displayCount);
  for (let display = 0; display < displayCount; display += 1) {
    const frame = scalpRootFrame(display, displayCount);
    warpRootAwayFromPart(frame.root, frame.normal, display);
    const rootOffset = display * 3;
    roots.set(frame.root, rootOffset);
    const centerX = frame.root[0];
    const centerY = frame.root[1] - 1.35;
    const centerZ = frame.root[2];
    const normalLength = Math.hypot(centerX / 0.945, centerY / 1.165, centerZ / 0.865) || 1;
    normals[rootOffset] = centerX / 0.945 / normalLength;
    normals[rootOffset + 1] = centerY / 1.165 / normalLength;
    normals[rootOffset + 2] = centerZ / 0.865 / normalLength;
    const nearest = [
      { guide: 0, distance: Infinity },
      { guide: 0, distance: Infinity },
      { guide: 0, distance: Infinity },
    ];
    for (let guide = 0; guide < guideCount; guide += 1) {
      const guideOffset = guide * 3;
      const dx = roots[rootOffset] - mechanicalRoots[guideOffset];
      const dy = roots[rootOffset + 1] - mechanicalRoots[guideOffset + 1];
      const dz = roots[rootOffset + 2] - mechanicalRoots[guideOffset + 2];
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance >= nearest[2].distance) continue;
      nearest[2] = { guide, distance };
      nearest.sort((left, right) => left.distance - right.distance || left.guide - right.guide);
    }
    const inverse = nearest.map((entry) => 1 / Math.max(1e-9, Math.sqrt(entry.distance)));
    const inverseSum = inverse[0] + inverse[1] + inverse[2];
    owners[display] = nearest[0].guide;
    neighbors[display] = nearest[1].guide;
    secondaryNeighbors[display] = nearest[2].guide;
    neighborWeights[display] = inverse[1] / inverseSum;
    secondaryNeighborWeights[display] = inverse[2] / inverseSum;
  }
  const nearestDistances = new Float64Array(displayCount);
  nearestDistances.fill(Infinity);
  for (let left = 0; left < displayCount; left += 1) {
    const leftOffset = left * 3;
    for (let right = left + 1; right < displayCount; right += 1) {
      const rightOffset = right * 3;
      const distance = Math.hypot(
        roots[leftOffset] - roots[rightOffset],
        roots[leftOffset + 1] - roots[rightOffset + 1],
        roots[leftOffset + 2] - roots[rightOffset + 2]
      );
      if (distance < nearestDistances[left]) nearestDistances[left] = distance;
      if (distance < nearestDistances[right]) nearestDistances[right] = distance;
    }
  }
  const ownerCounts = new Uint16Array(guideCount);
  for (const owner of owners) ownerCounts[owner] += 1;
  const sortedOwnerCounts = Array.from(ownerCounts).sort((left, right) => left - right);
  const gridCounts = new Uint16Array(32);
  let maximumShellError = 0;
  let analyticScalpCapBoundaryViolations = 0;
  const unique = new Set();
  for (let display = 0; display < displayCount; display += 1) {
    const offset = display * 3;
    unique.add(
      `${roots[offset].toFixed(12)},${roots[offset + 1].toFixed(12)},${roots[offset + 2].toFixed(12)}`
    );
    const normal = [normals[offset], normals[offset + 1], normals[offset + 2]];
    const azimuth = (Math.atan2(normal[2], normal[0]) + Math.PI) / (Math.PI * 2);
    const ring = Math.min(3, Math.floor((1 - normal[1]) * 6));
    const sector = Math.min(7, Math.floor(azimuth * 8));
    gridCounts[ring * 8 + sector] += 1;
    const phi = Math.atan2(normal[2], normal[0]);
    const theta = Math.acos(Math.max(-1, Math.min(1, normal[1])));
    if (theta > scalpPolarLimit(phi) + 1e-9) analyticScalpCapBoundaryViolations += 1;
    const shellRadius = Math.hypot(
      roots[offset] / 0.945,
      (roots[offset + 1] - 1.35) / 1.165,
      roots[offset + 2] / 0.865
    );
    maximumShellError = Math.max(maximumShellError, Math.abs(shellRadius - 1));
  }
  const gridMean = displayCount / gridCounts.length;
  const gridVariance =
    Array.from(gridCounts).reduce((sum, count) => sum + (count - gridMean) ** 2, 0) /
    gridCounts.length;
  return {
    roots,
    normals,
    owners,
    neighbors,
    secondaryNeighbors,
    neighborWeights,
    secondaryNeighborWeights,
    telemetry: {
      field_identity: DISPLAY_FOLLICLE_LAYOUT_ID,
      layout_digest: float64Digest(roots),
      total_root_count: displayCount,
      unique_root_count: unique.size,
      duplicate_root_count: displayCount - unique.size,
      nearest_neighbor_distance_m: quantiles(Array.from(nearestDistances)),
      fixed_grid_count_coefficient_of_variation: Math.sqrt(gridVariance) / gridMean,
      follicles_per_nearest_guide: {
        minimum: sortedOwnerCounts[0],
        p50: sortedOwnerCounts[Math.floor(sortedOwnerCounts.length * 0.5)],
        p90: sortedOwnerCounts[Math.floor(sortedOwnerCounts.length * 0.9)],
        maximum: sortedOwnerCounts.at(-1),
      },
      maximum_root_shell_error: maximumShellError,
      analytic_scalp_cap_boundary_violations: analyticScalpCapBoundaryViolations,
    },
  };
}
