export const ROOT_DIRECTOR_ZONE_SEGMENTS = 2;
export const ROOT_DIRECTOR_DEFAULT_STRENGTH = 0.22;
export const ROOT_DIRECTOR_FALLOFF = 0.42;
export const ROOT_DIRECTOR_NORMAL_BIASES = Object.freeze([0.78, 0.35]);
export const ROOT_DIRECTOR_STYLED_BIASES = Object.freeze([0.92, 0.66]);

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

export function bakeRootDirectorTarget(
  normalX,
  normalY,
  normalZ,
  restX,
  restY,
  restZ,
  normalBias,
  output
) {
  const restLength = Math.hypot(restX, restY, restZ) || 1;
  const bias = clamp(normalBias, 0, 1);
  const x = bias * normalX + (1 - bias) * (restX / restLength);
  const y = bias * normalY + (1 - bias) * (restY / restLength);
  const z = bias * normalZ + (1 - bias) * (restZ / restLength);
  const length = Math.hypot(x, y, z) || 1;
  output[0] = x / length;
  output[1] = y / length;
  output[2] = z / length;
  return output;
}

export function projectRootDirectorPoint(
  anchorX,
  anchorY,
  anchorZ,
  pointX,
  pointY,
  pointZ,
  targetX,
  targetY,
  targetZ,
  restLength,
  strength,
  output
) {
  const dx = pointX - anchorX;
  const dy = pointY - anchorY;
  const dz = pointZ - anchorZ;
  const currentLength = Math.hypot(dx, dy, dz);
  const ux = currentLength > 1e-12 ? dx / currentLength : targetX;
  const uy = currentLength > 1e-12 ? dy / currentLength : targetY;
  const uz = currentLength > 1e-12 ? dz / currentLength : targetZ;
  const alignmentBefore = ux * targetX + uy * targetY + uz * targetZ;
  const amount = clamp(strength, 0, 1);
  const rotatedX = ux + amount * (targetX - alignmentBefore * ux);
  const rotatedY = uy + amount * (targetY - alignmentBefore * uy);
  const rotatedZ = uz + amount * (targetZ - alignmentBefore * uz);
  const rotatedLength = Math.hypot(rotatedX, rotatedY, rotatedZ) || 1;
  const nextX = anchorX + (restLength * rotatedX) / rotatedLength;
  const nextY = anchorY + (restLength * rotatedY) / rotatedLength;
  const nextZ = anchorZ + (restLength * rotatedZ) / rotatedLength;
  output[0] = nextX;
  output[1] = nextY;
  output[2] = nextZ;
  output[3] = (rotatedX * targetX + rotatedY * targetY + rotatedZ * targetZ) / rotatedLength;
  output[4] = Math.hypot(nextX - pointX, nextY - pointY, nextZ - pointZ);
  output[5] = alignmentBefore;
  return output;
}

export function summarizeRootAlignment(positions, roots, rootNormals, particlesPerGuide) {
  const guideCount = roots.length / 3;
  let minimum = 1;
  let sum = 0;
  for (let guide = 0; guide < guideCount; guide += 1) {
    const root = guide * 3;
    const particle = (guide * particlesPerGuide + 1) * 3;
    const dx = positions[particle] - roots[root];
    const dy = positions[particle + 1] - roots[root + 1];
    const dz = positions[particle + 2] - roots[root + 2];
    const length = Math.hypot(dx, dy, dz) || 1;
    const alignment =
      (dx * rootNormals[root] + dy * rootNormals[root + 1] + dz * rootNormals[root + 2]) / length;
    minimum = Math.min(minimum, alignment);
    sum += alignment;
  }
  return { minimum, mean: sum / Math.max(1, guideCount) };
}

export function summarizeRootTargetAlignment(
  positions,
  roots,
  rootDirectorTargets,
  particlesPerGuide,
  zoneSegments
) {
  const guideCount = roots.length / 3;
  let minimum = 1;
  let sum = 0;
  for (let guide = 0; guide < guideCount; guide += 1) {
    const root = guide * 3;
    const particle = (guide * particlesPerGuide + 1) * 3;
    const target = guide * zoneSegments * 3;
    const dx = positions[particle] - roots[root];
    const dy = positions[particle + 1] - roots[root + 1];
    const dz = positions[particle + 2] - roots[root + 2];
    const length = Math.hypot(dx, dy, dz) || 1;
    const alignment =
      (dx * rootDirectorTargets[target] +
        dy * rootDirectorTargets[target + 1] +
        dz * rootDirectorTargets[target + 2]) /
      length;
    minimum = Math.min(minimum, alignment);
    sum += alignment;
  }
  return { minimum, mean: sum / Math.max(1, guideCount) };
}
