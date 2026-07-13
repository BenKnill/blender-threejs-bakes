export const SCALP_LAYOUT_ID = "face_hairline_ellipsoid_v1";
export const SCALP_ROOT_PROJECTION_ID = "ellipsoid_shell_radial_v1";
export const SCALP_CENTER = Object.freeze([0, 1.35, 0]);
export const SCALP_RADII = Object.freeze([0.9, 1.12, 0.82]);
export const SCALP_ROOT_OFFSET = 0.045;

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const CROWN_THETA = 0.08;
const BACK_AND_SIDE_THETA = 1.24;
const FOREHEAD_RECESSION = 0.22;

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

export function scalpPolarLimit(phi) {
  const front = Math.max(0, Math.sin(phi));
  const temple = Math.abs(Math.cos(phi));
  const centralForehead = front * (1 - 0.58 * temple);
  return BACK_AND_SIDE_THETA - FOREHEAD_RECESSION * centralForehead;
}

export function scalpRootFrame(index, count) {
  if (
    !(
      Number.isInteger(index) &&
      Number.isInteger(count) &&
      count > 0 &&
      index >= 0 &&
      index < count
    )
  ) {
    throw new Error("scalp root index/count are invalid");
  }
  const fraction = (index + 0.5) / count;
  const phi = index * GOLDEN_ANGLE;
  const thetaLimit = scalpPolarLimit(phi);
  const theta = CROWN_THETA + (thetaLimit - CROWN_THETA) * Math.sqrt(fraction);
  const sinTheta = Math.sin(theta);
  const normal = [sinTheta * Math.cos(phi), Math.cos(theta), sinTheta * Math.sin(phi)];
  const root = [
    SCALP_CENTER[0] + (SCALP_RADII[0] + SCALP_ROOT_OFFSET) * normal[0],
    SCALP_CENTER[1] + (SCALP_RADII[1] + SCALP_ROOT_OFFSET) * normal[1],
    SCALP_CENTER[2] + (SCALP_RADII[2] + SCALP_ROOT_OFFSET) * normal[2],
  ];
  const tangentLength = Math.hypot(normal[2], normal[0]) || 1;
  const tangent = [normal[2] / tangentLength, 0, -normal[0] / tangentLength];
  const bitangent = [
    normal[1] * tangent[2],
    normal[2] * tangent[0] - normal[0] * tangent[2],
    -normal[1] * tangent[0],
  ];
  return { root, normal, tangent, bitangent, phi, theta, thetaLimit };
}

export function projectPointToScalpShell(
  pointX,
  pointY,
  pointZ,
  output = [],
  outputOffset = 0,
  shellOffset = SCALP_ROOT_OFFSET
) {
  const dx = pointX - SCALP_CENTER[0];
  const dy = pointY - SCALP_CENTER[1];
  const dz = pointZ - SCALP_CENTER[2];
  const radiusX = SCALP_RADII[0] + shellOffset;
  const radiusY = SCALP_RADII[1] + shellOffset;
  const radiusZ = SCALP_RADII[2] + shellOffset;
  const ellipsoidRadius = Math.hypot(dx / radiusX, dy / radiusY, dz / radiusZ);
  const scale = ellipsoidRadius > 1e-9 ? 1 / ellipsoidRadius : 1;
  output[outputOffset] = SCALP_CENTER[0] + dx * scale;
  output[outputOffset + 1] = SCALP_CENTER[1] + dy * scale;
  output[outputOffset + 2] = SCALP_CENTER[2] + dz * scale;
  return output;
}

export function summarizeScalpLayout(rootNormals) {
  let crownGuideCount = 0;
  let frontCenterGuideCount = 0;
  let minimumFrontCenterNormalY = 1;
  let maximumFrontCenterTheta = 0;
  for (let guide = 0; guide < rootNormals.length / 3; guide += 1) {
    const normalX = rootNormals[guide * 3];
    const normalY = clamp(rootNormals[guide * 3 + 1], -1, 1);
    const normalZ = rootNormals[guide * 3 + 2];
    if (normalY >= 0.8) crownGuideCount += 1;
    if (normalZ <= 0.35 || Math.abs(normalX) >= 0.45) continue;
    frontCenterGuideCount += 1;
    minimumFrontCenterNormalY = Math.min(minimumFrontCenterNormalY, normalY);
    maximumFrontCenterTheta = Math.max(maximumFrontCenterTheta, Math.acos(normalY));
  }
  return {
    crownGuideCount,
    frontCenterGuideCount,
    minimumFrontCenterNormalY: frontCenterGuideCount > 0 ? minimumFrontCenterNormalY : null,
    maximumFrontCenterTheta: frontCenterGuideCount > 0 ? maximumFrontCenterTheta : null,
  };
}
