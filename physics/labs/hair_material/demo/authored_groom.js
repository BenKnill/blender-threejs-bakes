import { projectPointToScalpShell } from "./scalp_layout.js?v=116";

export const AUTHORED_GROOM_FIELD_ID = "side_part_rest_displacement_transfer_v1";
export const AUTHORED_GROOM_PART_X = -0.18;
export const AUTHORED_GROOM_TRANSFER_START = 0.08;
export const AUTHORED_GROOM_TRANSFER_END = 0.55;
export const AUTHORED_GROOM_OUTWARD_RADIUS_METERS = 0.028;
export const AUTHORED_GROOM_LATERAL_RADIUS_METERS = 0.016;
export const AUTHORED_ROOT_LAYDOWN_FIELD_ID = "follicle_surface_laydown_handoff_v1";
export const AUTHORED_ROOT_HANDOFF_FRACTION = 0.18;
export const AUTHORED_ROOT_HANDOFF_STATION_FRACTION = 0.25;
export const AUTHORED_ROOT_EMERGENCE_RANGE_METERS = Object.freeze([0.01, 0.02]);
export const AUTHORED_ROOT_LAYDOWN_RANGE_METERS = Object.freeze([0.04, 0.08]);

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function authoredGroomDisplacementTransferAt(fraction) {
  return smoothStep01(
    (fraction - AUTHORED_GROOM_TRANSFER_START) /
      (AUTHORED_GROOM_TRANSFER_END - AUTHORED_GROOM_TRANSFER_START)
  );
}

export function authoredGroomLaydownDisplacementTransferAt(fraction) {
  return smoothStep01(
    (fraction - AUTHORED_ROOT_HANDOFF_FRACTION) /
      (AUTHORED_GROOM_TRANSFER_END - AUTHORED_ROOT_HANDOFF_FRACTION)
  );
}

export function authoredGroomLaydownSampleFractionAt(stationFraction) {
  const t = Math.max(0, Math.min(1, stationFraction));
  if (t <= AUTHORED_ROOT_HANDOFF_STATION_FRACTION) {
    return (t / AUTHORED_ROOT_HANDOFF_STATION_FRACTION) * AUTHORED_ROOT_HANDOFF_FRACTION;
  }
  return (
    AUTHORED_ROOT_HANDOFF_FRACTION +
    ((t - AUTHORED_ROOT_HANDOFF_STATION_FRACTION) / (1 - AUTHORED_ROOT_HANDOFF_STATION_FRACTION)) *
      (1 - AUTHORED_ROOT_HANDOFF_FRACTION)
  );
}

export function authoredGroomCrossSectionScaleAt(fraction) {
  return smoothStep01((fraction - 0.03) / 0.25);
}

export function authoredGroomRestPoint(
  root,
  normal,
  styledDirection,
  fraction,
  guideLength,
  output,
  outputOffset = 0
) {
  const t = Math.max(0, Math.min(1, fraction));
  const side = root[0] < AUTHORED_GROOM_PART_X ? -1 : 1;
  const crown = Math.max(0, Math.min(1, (normal[1] - 0.15) / 0.85));
  const seam = Math.exp(-Math.abs(root[0] - AUTHORED_GROOM_PART_X) / 0.28) * crown;
  let directionX = styledDirection[0] + normal[0] * 0.18;
  let directionY = styledDirection[1] + normal[1] * 0.18;
  let directionZ = styledDirection[2] + normal[2] * 0.18;
  const directionLength = Math.hypot(directionX, directionY, directionZ) || 1;
  directionX /= directionLength;
  directionY /= directionLength;
  directionZ /= directionLength;
  const p1 = [
    root[0] + directionX * guideLength * 0.16 + side * seam * 0.12,
    root[1] + directionY * guideLength * 0.16 + crown * 0.08,
    root[2] + directionZ * guideLength * 0.16,
  ];
  const p2 = [
    root[0] + directionX * guideLength * 0.2 + side * (0.28 + seam * 0.3),
    root[1] + crown * 0.22 - (1 - crown) * 0.16,
    root[2] + directionZ * guideLength * 0.13 - Math.max(0, normal[2]) * 0.18,
  ];
  const p3 = [
    root[0] + directionX * guideLength * 0.1 + side * (0.5 + seam * 0.24),
    root[1] - guideLength * (0.68 + (1 - crown) * 0.08),
    root[2] + directionZ * guideLength * 0.08 - Math.max(0, normal[2]) * 0.22,
  ];
  const inverse = 1 - t;
  const w0 = inverse * inverse * inverse;
  const w1 = 3 * inverse * inverse * t;
  const w2 = 3 * inverse * t * t;
  const w3 = t * t * t;
  output[outputOffset] = root[0] * w0 + p1[0] * w1 + p2[0] * w2 + p3[0] * w3;
  output[outputOffset + 1] = root[1] * w0 + p1[1] * w1 + p2[1] * w2 + p3[1] * w3;
  output[outputOffset + 2] = root[2] * w0 + p1[2] * w1 + p2[2] * w2 + p3[2] * w3;
  return output;
}

function rootVariation(root) {
  const value = Math.sin(root[0] * 12.9898 + root[2] * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function authoredRootLaydownParameters(root) {
  const variation = rootVariation(root);
  return {
    emergenceLength:
      AUTHORED_ROOT_EMERGENCE_RANGE_METERS[0] +
      (AUTHORED_ROOT_EMERGENCE_RANGE_METERS[1] - AUTHORED_ROOT_EMERGENCE_RANGE_METERS[0]) *
        variation,
    laydownLength:
      AUTHORED_ROOT_LAYDOWN_RANGE_METERS[0] +
      (AUTHORED_ROOT_LAYDOWN_RANGE_METERS[1] - AUTHORED_ROOT_LAYDOWN_RANGE_METERS[0]) *
        (1 - variation),
  };
}

export function authoredGroomLaydownRestPoint(
  root,
  normal,
  styledDirection,
  fraction,
  guideLength,
  output,
  outputOffset = 0
) {
  const t = Math.max(0, Math.min(1, fraction));
  let flowX =
    styledDirection[0] -
    normal[0] *
      (styledDirection[0] * normal[0] +
        styledDirection[1] * normal[1] +
        styledDirection[2] * normal[2]);
  let flowY =
    styledDirection[1] -
    normal[1] *
      (styledDirection[0] * normal[0] +
        styledDirection[1] * normal[1] +
        styledDirection[2] * normal[2]);
  let flowZ =
    styledDirection[2] -
    normal[2] *
      (styledDirection[0] * normal[0] +
        styledDirection[1] * normal[1] +
        styledDirection[2] * normal[2]);
  const flowLength = Math.hypot(flowX, flowY, flowZ) || 1;
  flowX /= flowLength;
  flowY /= flowLength;
  flowZ /= flowLength;
  const { emergenceLength, laydownLength } = authoredRootLaydownParameters(root);
  const shellPoint = new Float64Array(3);
  projectPointToScalpShell(
    root[0] + flowX * laydownLength,
    root[1] + flowY * laydownLength,
    root[2] + flowZ * laydownLength,
    shellPoint
  );
  const handoff = [
    shellPoint[0] + normal[0] * 0.012,
    shellPoint[1] + normal[1] * 0.012,
    shellPoint[2] + normal[2] * 0.012,
  ];
  const epsilon = 1e-4;
  const baseAhead = new Float64Array(3);
  authoredGroomRestPoint(handoff, normal, [flowX, flowY, flowZ], epsilon, guideLength, baseAhead);
  let shaftStartX = (baseAhead[0] - handoff[0]) / epsilon;
  let shaftStartY = (baseAhead[1] - handoff[1]) / epsilon;
  let shaftStartZ = (baseAhead[2] - handoff[2]) / epsilon;
  const shaftStartLength = Math.hypot(shaftStartX, shaftStartY, shaftStartZ) || 1;
  shaftStartX /= shaftStartLength;
  shaftStartY /= shaftStartLength;
  shaftStartZ /= shaftStartLength;
  if (t <= AUTHORED_ROOT_HANDOFF_FRACTION) {
    const local = t / AUTHORED_ROOT_HANDOFF_FRACTION;
    const inverse = 1 - local;
    const q1 = [
      root[0] + normal[0] * emergenceLength,
      root[1] + normal[1] * emergenceLength,
      root[2] + normal[2] * emergenceLength,
    ];
    const q2 = [
      handoff[0] - shaftStartX * laydownLength * 0.3,
      handoff[1] - shaftStartY * laydownLength * 0.3,
      handoff[2] - shaftStartZ * laydownLength * 0.3,
    ];
    const w0 = inverse * inverse * inverse;
    const w1 = 3 * inverse * inverse * local;
    const w2 = 3 * inverse * local * local;
    const w3 = local * local * local;
    output[outputOffset] = root[0] * w0 + q1[0] * w1 + q2[0] * w2 + handoff[0] * w3;
    output[outputOffset + 1] = root[1] * w0 + q1[1] * w1 + q2[1] * w2 + handoff[1] * w3;
    output[outputOffset + 2] = root[2] * w0 + q1[2] * w1 + q2[2] * w2 + handoff[2] * w3;
    return output;
  }
  const shaftFraction = (t - AUTHORED_ROOT_HANDOFF_FRACTION) / (1 - AUTHORED_ROOT_HANDOFF_FRACTION);
  const shaft = new Float64Array(3);
  authoredGroomRestPoint(handoff, normal, [flowX, flowY, flowZ], shaftFraction, guideLength, shaft);
  output[outputOffset] = shaft[0];
  output[outputOffset + 1] = shaft[1];
  output[outputOffset + 2] = shaft[2];
  return output;
}
