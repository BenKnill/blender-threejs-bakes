import {
  SCALP_CENTER,
  SCALP_RADII,
  SCALP_ROOT_OFFSET,
  scalpPolarLimit,
} from "./scalp_layout.js?v=116";
import { AUTHORED_GROOM_PART_X, authoredGroomRestPoint } from "./authored_groom.js?v=116";

export const HAIRLINE_FLOW_FIELD_ID = "continuous_hairline_temple_crown_flow_v1";
export const HAIRLINE_FLOW_SURFACE_FRACTION = 0.14;
export const HAIRLINE_FLOW_SURFACE_LENGTH_METERS = 0.09;
export const HAIRLINE_FLOW_INTEGRATION_STEPS = 8;
export const HAIRLINE_FLOW_BOUNDARY_MARGIN_RADIANS = 0.012;

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function smoothstep(lower, upper, value) {
  const t = clamp((value - lower) / Math.max(Number.EPSILON, upper - lower), 0, 1);
  return t * t * (3 - 2 * t);
}

function scalpCoordinates(point) {
  const nx = (point[0] - SCALP_CENTER[0]) / (SCALP_RADII[0] + SCALP_ROOT_OFFSET);
  const ny = (point[1] - SCALP_CENTER[1]) / (SCALP_RADII[1] + SCALP_ROOT_OFFSET);
  const nz = (point[2] - SCALP_CENTER[2]) / (SCALP_RADII[2] + SCALP_ROOT_OFFSET);
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function pointFromScalpCoordinates(normal, output) {
  output[0] = SCALP_CENTER[0] + (SCALP_RADII[0] + SCALP_ROOT_OFFSET) * normal[0];
  output[1] = SCALP_CENTER[1] + (SCALP_RADII[1] + SCALP_ROOT_OFFSET) * normal[1];
  output[2] = SCALP_CENTER[2] + (SCALP_RADII[2] + SCALP_ROOT_OFFSET) * normal[2];
  return output;
}

export function hairlineFlowBasin(rootX, normalY, normalZ) {
  if (normalY > 0.68 && normalZ < 0.48) return 2;
  return rootX < AUTHORED_GROOM_PART_X ? 0 : 1;
}

export function hairlineBoundaryFlowAt(point, output = new Float64Array(3)) {
  const normal = scalpCoordinates(point);
  const [nx, ny, nz] = normal;
  const basin = hairlineFlowBasin(point[0], ny, nz);
  const sideSign = basin === 0 ? -1 : 1;
  const front = smoothstep(0.12, 0.68, nz) * (1 - smoothstep(0.72, 0.94, ny));
  const crown = smoothstep(0.55, 0.9, ny) * (1 - front);
  const side = smoothstep(0.28, 0.82, Math.abs(nx)) * (1 - crown);
  const frontalCenter = front * (1 - smoothstep(0.08, 0.72, Math.abs(nx)));
  const part =
    (1 - smoothstep(0.025, 0.28, Math.abs(point[0] - AUTHORED_GROOM_PART_X))) * (1 - front * 0.45);

  let desiredX =
    sideSign * (front * 0.34 + frontalCenter * 0.74 + crown * 0.26 + side * 0.14 + part * 0.42);
  let desiredY = front * 0.18 - side * 0.62 - crown * 0.08;
  let desiredZ =
    -front * (0.62 + 0.74 * Math.abs(nx)) -
    crown * 1.0 -
    side * 0.72 -
    Math.max(0, 1 - front - crown) * 0.35;
  const normalDot = desiredX * nx + desiredY * ny + desiredZ * nz;
  desiredX -= normalDot * nx;
  desiredY -= normalDot * ny;
  desiredZ -= normalDot * nz;
  const length = Math.hypot(desiredX, desiredY, desiredZ) || 1;
  output[0] = desiredX / length;
  output[1] = desiredY / length;
  output[2] = desiredZ / length;
  output[3] = basin;
  return output;
}

function enforceHairlineBoundary(point) {
  const normal = scalpCoordinates(point);
  const phi = Math.atan2(normal[2], normal[0]);
  const theta = Math.acos(clamp(normal[1], -1, 1));
  const limit = scalpPolarLimit(phi) - HAIRLINE_FLOW_BOUNDARY_MARGIN_RADIANS;
  if (theta <= limit) return point;
  const boundedTheta = Math.max(0, limit);
  const sinTheta = Math.sin(boundedTheta);
  return pointFromScalpCoordinates(
    [sinTheta * Math.cos(phi), Math.cos(boundedTheta), sinTheta * Math.sin(phi)],
    point
  );
}

export function integrateHairlineBoundaryFlow(root, distance, output = new Float64Array(3)) {
  output[0] = root[0];
  output[1] = root[1];
  output[2] = root[2];
  const stepLength = Math.max(0, distance) / HAIRLINE_FLOW_INTEGRATION_STEPS;
  const flow = new Float64Array(4);
  for (let step = 0; step < HAIRLINE_FLOW_INTEGRATION_STEPS; step += 1) {
    hairlineBoundaryFlowAt(output, flow);
    output[0] += flow[0] * stepLength;
    output[1] += flow[1] * stepLength;
    output[2] += flow[2] * stepLength;
    const normal = scalpCoordinates(output);
    pointFromScalpCoordinates(normal, output);
    enforceHairlineBoundary(output);
  }
  return output;
}

export function authoredHairlineFlowRestPoint(
  root,
  normal,
  fraction,
  guideLength,
  output,
  outputOffset = 0
) {
  const t = clamp(fraction, 0, 1);
  const p1 = new Float64Array([
    root[0] + normal[0] * 0.015,
    root[1] + normal[1] * 0.015,
    root[2] + normal[2] * 0.015,
  ]);
  const p2 = integrateHairlineBoundaryFlow(
    root,
    HAIRLINE_FLOW_SURFACE_LENGTH_METERS * 0.58,
    new Float64Array(3)
  );
  const handoff = integrateHairlineBoundaryFlow(
    root,
    HAIRLINE_FLOW_SURFACE_LENGTH_METERS,
    new Float64Array(3)
  );
  const handoffFlow = hairlineBoundaryFlowAt(handoff, new Float64Array(4));
  for (const point of [p2, handoff]) {
    point[0] += normal[0] * 0.012;
    point[1] += normal[1] * 0.012;
    point[2] += normal[2] * 0.012;
  }
  if (t <= HAIRLINE_FLOW_SURFACE_FRACTION) {
    const local = t / HAIRLINE_FLOW_SURFACE_FRACTION;
    const inverse = 1 - local;
    const w0 = inverse * inverse * inverse;
    const w1 = 3 * inverse * inverse * local;
    const w2 = 3 * inverse * local * local;
    const w3 = local * local * local;
    output[outputOffset] = root[0] * w0 + p1[0] * w1 + p2[0] * w2 + handoff[0] * w3;
    output[outputOffset + 1] = root[1] * w0 + p1[1] * w1 + p2[1] * w2 + handoff[1] * w3;
    output[outputOffset + 2] = root[2] * w0 + p1[2] * w1 + p2[2] * w2 + handoff[2] * w3;
    return output;
  }
  const shaftFraction = (t - HAIRLINE_FLOW_SURFACE_FRACTION) / (1 - HAIRLINE_FLOW_SURFACE_FRACTION);
  return authoredGroomRestPoint(
    handoff,
    normal,
    handoffFlow,
    shaftFraction,
    guideLength,
    output,
    outputOffset
  );
}
