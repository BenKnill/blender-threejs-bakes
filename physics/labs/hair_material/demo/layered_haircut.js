import { SCALP_CENTER, SCALP_RADII, SCALP_ROOT_OFFSET } from "./scalp_layout.js?v=116";

export const LAYERED_HAIRCUT_FIELD_ID = "authored_long_layers_v1";
export const LAYERED_HAIRCUT_ZONE_NAMES = Object.freeze(["crown", "front", "side", "back"]);

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function scalpCoordinate(root) {
  const value = [
    (root[0] - SCALP_CENTER[0]) / (SCALP_RADII[0] + SCALP_ROOT_OFFSET),
    (root[1] - SCALP_CENTER[1]) / (SCALP_RADII[1] + SCALP_ROOT_OFFSET),
    (root[2] - SCALP_CENTER[2]) / (SCALP_RADII[2] + SCALP_ROOT_OFFSET),
  ];
  const length = Math.hypot(...value) || 1;
  return value.map((component) => component / length);
}

export function layeredHaircutSample(root, heroId, phase) {
  const [x, y, z] = scalpCoordinate(root);
  const absX = Math.abs(x);
  const front = 0.04 + smoothstep01((z + 0.18) / 0.72) * (0.7 + 0.3 * absX);
  const back = 0.04 + smoothstep01((-z + 0.12) / 0.78);
  const crown =
    0.04 + smoothstep01((y - 0.42) / 0.48) * (1 - 0.48 * smoothstep01((z + 0.05) / 0.6));
  const side =
    0.04 + smoothstep01((absX - 0.24) / 0.62) * (1 - 0.34 * smoothstep01((-z + 0.1) / 0.75));
  const weights = [crown, front, side, back];
  const targets = [0.84, 0.77, 0.915, 0.96];
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  let retainedRatio =
    weights.reduce((sum, weight, index) => sum + weight * targets[index], 0) / weightSum;
  retainedRatio += (phase - 1) * 0.035;
  const jitterSeed = Math.sin(root[0] * 47.17 + root[1] * 73.31 + root[2] * 29.83) * 43758.5453;
  retainedRatio += ((jitterSeed - Math.floor(jitterSeed)) * 2 - 1) * 0.015;
  retainedRatio = Math.max(0.7, Math.min(1, retainedRatio));
  let zone = 0;
  for (let index = 1; index < weights.length; index += 1) {
    if (weights[index] > weights[zone]) zone = index;
  }
  return { retainedRatio, zone, weights };
}

export function layeredHaircutTipWidthScaleAt(fraction) {
  return 1 - smoothstep01((fraction - 0.88) / 0.12) * 0.82;
}
