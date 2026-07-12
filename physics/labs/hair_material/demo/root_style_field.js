import { groomSectionId } from "./groom_interpolation.js";

export const ROOT_STYLE_FIELD_ID = "side_part_sweep_crown_lift_v1";
export const ROOT_STYLE_SECTION_COUNT = 8;
export const ROOT_STYLE_PART_X = -0.2;
export const ROOT_STYLE_MIN_OUTWARD_DOT = 0.52;

const SECTION_SWEEP = Object.freeze([
  Object.freeze([0.9, -0.18, -0.34]),
  Object.freeze([1.0, -0.1, -0.3]),
  Object.freeze([1.0, 0.08, -0.2]),
  Object.freeze([0.86, 0.18, -0.3]),
  Object.freeze([0.62, 0.06, -0.62]),
  Object.freeze([0.48, -0.12, -0.78]),
  Object.freeze([0.7, -0.2, -0.66]),
  Object.freeze([0.84, -0.22, -0.48]),
]);

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function smoothstep(lower, upper, value) {
  const t = clamp((value - lower) / Math.max(Number.EPSILON, upper - lower), 0, 1);
  return t * t * (3 - 2 * t);
}

export function bakeStyledRootDirection(rootX, rootY, rootZ, normalX, normalY, normalZ, output) {
  const section = groomSectionId(rootX, rootZ, ROOT_STYLE_SECTION_COUNT);
  const sweep = SECTION_SWEEP[section];
  const crown = smoothstep(0.48, 0.94, normalY);
  const partSeparation = 1 - smoothstep(0.04, 0.38, Math.abs(rootX - ROOT_STYLE_PART_X));
  const partSide = rootX < ROOT_STYLE_PART_X ? -1 : 1;
  const authoredX = sweep[0] + partSide * partSeparation * 0.9;
  const authoredY = sweep[1] + crown * 0.5;
  const authoredZ = sweep[2] - Math.max(0, normalZ) * 0.24;
  const authoredNormalDot = authoredX * normalX + authoredY * normalY + authoredZ * normalZ;
  let tangentX = authoredX - authoredNormalDot * normalX;
  let tangentY = authoredY - authoredNormalDot * normalY;
  let tangentZ = authoredZ - authoredNormalDot * normalZ;
  let tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
  if (tangentLength < 1e-8) {
    tangentX = normalZ;
    tangentY = 0;
    tangentZ = -normalX;
    tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
  }
  tangentX /= tangentLength;
  tangentY /= tangentLength;
  tangentZ /= tangentLength;
  const outward = ROOT_STYLE_MIN_OUTWARD_DOT + crown * 0.16;
  const tangent = Math.sqrt(Math.max(0, 1 - outward * outward));
  output[0] = normalX * outward + tangentX * tangent;
  output[1] = normalY * outward + tangentY * tangent;
  output[2] = normalZ * outward + tangentZ * tangent;
  output[3] = section;
  output[4] = outward;
  output[5] = tangent;
  return output;
}

export function summarizeRootTargets(targets, rootNormals, zoneSegments) {
  let minimumOutwardDot = 1;
  let outwardDotSum = 0;
  let tangentialSum = 0;
  const guideCount = rootNormals.length / 3;
  for (let guide = 0; guide < guideCount; guide += 1) {
    const normal = guide * 3;
    const target = guide * zoneSegments * 3;
    const outwardDot =
      targets[target] * rootNormals[normal] +
      targets[target + 1] * rootNormals[normal + 1] +
      targets[target + 2] * rootNormals[normal + 2];
    minimumOutwardDot = Math.min(minimumOutwardDot, outwardDot);
    outwardDotSum += outwardDot;
    tangentialSum += Math.sqrt(Math.max(0, 1 - outwardDot * outwardDot));
  }
  return {
    minimumOutwardDot,
    meanOutwardDot: outwardDotSum / Math.max(1, guideCount),
    meanTangentialMagnitude: tangentialSum / Math.max(1, guideCount),
  };
}
