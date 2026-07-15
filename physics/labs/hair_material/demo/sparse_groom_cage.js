import { SCALP_CENTER, SCALP_RADII, SCALP_ROOT_OFFSET } from "./scalp_layout.js?v=116";

export const SPARSE_GROOM_CAGE_ID = "explicit_twenty_lock_side_part_cage_v1";
export const SPARSE_GROOM_CORRELATED_HIERARCHY_ID = "three_phase_correlated_rest_residual_v1";
export const SPARSE_GROOM_OCCUPANCY_REMAP_ID = "three_core_cross_section_occupancy_v1";
export const SPARSE_GROOM_CORE_SEPARATION_METERS = 0.022;
export const SPARSE_GROOM_CORE_WIDTH_FIELD_ID = "three_core_continuous_width_field_v1";

// Explicit hero data: scalp-space anchor followed by three world-space cubic
// control offsets. This is one authored haircut, not a procedural recipe.
const HERO_DATA = Object.freeze([
  [
    [-0.18, 0.97, 0.12],
    [-0.12, 0.2, -0.04],
    [-0.42, 0.12, -0.22],
    [-0.72, -1.28, -0.2],
  ],
  [
    [0.08, 0.98, 0.1],
    [0.15, 0.22, -0.05],
    [0.46, 0.1, -0.2],
    [0.76, -1.22, -0.18],
  ],
  [
    [-0.42, 0.86, 0.24],
    [-0.2, 0.16, -0.06],
    [-0.48, -0.1, -0.2],
    [-0.72, -1.42, -0.16],
  ],
  [
    [0.34, 0.9, 0.24],
    [0.2, 0.16, -0.06],
    [0.5, -0.08, -0.2],
    [0.76, -1.38, -0.14],
  ],
  [
    [-0.62, 0.7, 0.34],
    [-0.18, 0.08, -0.02],
    [-0.34, -0.38, 0.02],
    [-0.48, -1.5, 0.06],
  ],
  [
    [0.62, 0.7, 0.34],
    [0.18, 0.08, -0.02],
    [0.34, -0.34, 0.02],
    [0.48, -1.46, 0.06],
  ],
  [
    [-0.78, 0.56, 0.18],
    [-0.16, 0.02, -0.02],
    [-0.26, -0.52, -0.08],
    [-0.3, -1.62, -0.08],
  ],
  [
    [0.78, 0.56, 0.18],
    [0.16, 0.02, -0.02],
    [0.26, -0.5, -0.08],
    [0.3, -1.58, -0.08],
  ],
  [
    [-0.48, 0.74, -0.46],
    [-0.12, 0.12, -0.16],
    [-0.3, -0.24, -0.38],
    [-0.42, -1.46, -0.48],
  ],
  [
    [0.48, 0.74, -0.46],
    [0.12, 0.12, -0.16],
    [0.3, -0.22, -0.38],
    [0.42, -1.42, -0.48],
  ],
  [
    [-0.18, 0.82, -0.58],
    [-0.08, 0.16, -0.2],
    [-0.22, -0.18, -0.48],
    [-0.3, -1.38, -0.62],
  ],
  [
    [0.18, 0.82, -0.58],
    [0.08, 0.16, -0.2],
    [0.22, -0.18, -0.48],
    [0.3, -1.34, -0.62],
  ],
  [
    [-0.72, 0.52, -0.34],
    [-0.16, 0.04, -0.12],
    [-0.3, -0.42, -0.34],
    [-0.38, -1.5, -0.4],
  ],
  [
    [0.72, 0.52, -0.34],
    [0.16, 0.04, -0.12],
    [0.3, -0.4, -0.34],
    [0.38, -1.46, -0.4],
  ],
  [
    [-0.86, 0.38, 0.04],
    [-0.2, -0.02, 0.02],
    [-0.32, -0.56, 0.08],
    [-0.36, -1.34, 0.12],
  ],
  [
    [0.86, 0.38, 0.04],
    [0.2, -0.02, 0.02],
    [0.32, -0.54, 0.08],
    [0.36, -1.3, 0.12],
  ],
  [
    [-0.34, 0.7, 0.54],
    [-0.2, 0.08, -0.08],
    [-0.52, -0.26, -0.02],
    [-0.7, -1.26, 0.08],
  ],
  [
    [0.32, 0.7, 0.56],
    [0.22, 0.08, -0.08],
    [0.54, -0.24, -0.02],
    [0.72, -1.22, 0.08],
  ],
  [
    [-0.92, 0.28, -0.16],
    [-0.22, 0.0, -0.06],
    [-0.42, -0.42, -0.16],
    [-0.5, -1.12, -0.12],
  ],
  [
    [0.92, 0.28, -0.16],
    [0.22, 0.0, -0.06],
    [0.42, -0.4, -0.16],
    [0.5, -1.08, -0.12],
  ],
]);

function normalizedAnchor(anchor) {
  const length = Math.hypot(...anchor) || 1;
  return anchor.map((value) => value / length);
}

export const SPARSE_GROOM_HEROES = Object.freeze(
  HERO_DATA.map(([anchorValue, ...controlOffsets], id) => {
    const anchor = normalizedAnchor(anchorValue);
    const root = Object.freeze([
      SCALP_CENTER[0] + (SCALP_RADII[0] + SCALP_ROOT_OFFSET) * anchor[0],
      SCALP_CENTER[1] + (SCALP_RADII[1] + SCALP_ROOT_OFFSET) * anchor[1],
      SCALP_CENTER[2] + (SCALP_RADII[2] + SCALP_ROOT_OFFSET) * anchor[2],
    ]);
    return Object.freeze({ id, anchor: Object.freeze(anchor), root, controlOffsets });
  })
);

function scalpCoordinate(root) {
  const value = [
    (root[0] - SCALP_CENTER[0]) / (SCALP_RADII[0] + SCALP_ROOT_OFFSET),
    (root[1] - SCALP_CENTER[1]) / (SCALP_RADII[1] + SCALP_ROOT_OFFSET),
    (root[2] - SCALP_CENTER[2]) / (SCALP_RADII[2] + SCALP_ROOT_OFFSET),
  ];
  const length = Math.hypot(...value) || 1;
  return value.map((component) => component / length);
}

export function sparseGroomHeroForRoot(root) {
  const coordinate = scalpCoordinate(root);
  let best = 0;
  let bestDistance = Infinity;
  for (const hero of SPARSE_GROOM_HEROES) {
    const distance =
      (coordinate[0] - hero.anchor[0]) ** 2 +
      (coordinate[1] - hero.anchor[1]) ** 2 +
      (coordinate[2] - hero.anchor[2]) ** 2;
    if (distance < bestDistance) {
      best = hero.id;
      bestDistance = distance;
    }
  }
  return best;
}

export function sparseGroomOffsetRetentionAt(fraction) {
  const t = Math.max(0, Math.min(1, fraction));
  const smooth = (value) => value * value * (3 - 2 * value);
  if (t <= 0.25) return 1 - smooth(t / 0.25) * 0.48;
  if (t <= 0.6) return 0.52 - smooth((t - 0.25) / 0.35) * 0.08;
  return 0.44 + smooth((t - 0.6) / 0.4) * 0.2;
}

function legacySublockMode(root) {
  const value = Math.sin(root[0] * 17.17 + root[1] * 31.31 + root[2] * 53.53) * 43758.5453;
  return Math.floor((value - Math.floor(value)) * 3);
}

export function sparseGroomSublockPhase(root, heroId = sparseGroomHeroForRoot(root)) {
  const hero = SPARSE_GROOM_HEROES[heroId];
  let lateralX = hero.anchor[2];
  let lateralZ = -hero.anchor[0];
  const lateralLength = Math.hypot(lateralX, lateralZ) || 1;
  lateralX /= lateralLength;
  lateralZ /= lateralLength;
  const lateralCoordinate =
    (root[0] - hero.root[0]) * lateralX + (root[2] - hero.root[2]) * lateralZ;
  return Math.max(0, Math.min(2, Math.floor(((lateralCoordinate + 0.16) / 0.32) * 3)));
}

export function sparseGroomCoreBodyWidthMultiplier(root, heroId, phase) {
  const hero = SPARSE_GROOM_HEROES[heroId];
  let lateralX = hero.anchor[2];
  let lateralZ = -hero.anchor[0];
  const lateralLength = Math.hypot(lateralX, lateralZ) || 1;
  lateralX /= lateralLength;
  lateralZ /= lateralLength;
  const lateralCoordinate =
    (root[0] - hero.root[0]) * lateralX + (root[2] - hero.root[2]) * lateralZ;
  const phaseCenter = (phase - 1) * (0.32 / 3);
  const distance = Math.abs(lateralCoordinate - phaseCenter);
  const coreWeight = Math.exp(-((distance / 0.03) ** 2));
  const variationSeed = Math.sin(root[0] * 61.37 + root[1] * 29.71 + root[2] * 83.19) * 43758.5453;
  const variation = 0.9 + (variationSeed - Math.floor(variationSeed)) * 0.2;
  return Math.max(0.35, Math.min(3.5, (0.62 + coreWeight * 2.88) * variation));
}

export function sparseGroomWidthMultiplierAt(bodyMultiplier, fraction) {
  const ramp = smoothstep01(Math.max(0, Math.min(1, fraction)) / 0.18);
  return 0.8 + (bodyMultiplier - 0.8) * ramp;
}

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function sparseGroomCorrelatedResidual(root, heroId, fraction, output, outputOffset = 0) {
  const t = Math.max(0, Math.min(1, fraction));
  output[outputOffset] = 0;
  output[outputOffset + 1] = 0;
  output[outputOffset + 2] = 0;
  if (t <= 0.12) return output;
  const hero = SPARSE_GROOM_HEROES[heroId];
  const phase = sparseGroomSublockPhase(root, heroId);
  const envelope = smoothstep01((t - 0.12) / 0.18);
  const heroVariation = (Math.sin((heroId + 1) * 12.9898) * 43758.5453) % 1;
  const sharedAmplitude = 0.008 + Math.abs(heroVariation) * 0.01;
  const phaseOffset = phase * 0.16 + heroId * 0.037;
  const sharedWave = Math.sin(Math.PI * (t * 1.18 + phaseOffset)) * sharedAmplitude * envelope;
  const individualSeed = Math.sin(root[0] * 91.17 + root[1] * 47.73 + root[2] * 73.31) * 43758.5453;
  const individualUnit = individualSeed - Math.floor(individualSeed);
  const individualAmplitude = 0.002 + individualUnit * 0.004;
  const individualWave =
    Math.sin(Math.PI * (t * 1.72 + individualUnit)) * individualAmplitude * envelope;
  const tipSplay = (individualUnit * 2 - 1) * 0.014 * smoothstep01((t - 0.8) / 0.2) * envelope;
  let lateralX = hero.anchor[2];
  let lateralY = 0;
  let lateralZ = -hero.anchor[0];
  const lateralLength = Math.hypot(lateralX, lateralY, lateralZ) || 1;
  lateralX /= lateralLength;
  lateralY /= lateralLength;
  lateralZ /= lateralLength;
  let secondaryX = hero.anchor[1] * lateralZ - hero.anchor[2] * lateralY;
  let secondaryY = hero.anchor[2] * lateralX - hero.anchor[0] * lateralZ;
  let secondaryZ = hero.anchor[0] * lateralY - hero.anchor[1] * lateralX;
  const secondaryLength = Math.hypot(secondaryX, secondaryY, secondaryZ) || 1;
  secondaryX /= secondaryLength;
  secondaryY /= secondaryLength;
  secondaryZ /= secondaryLength;
  output[outputOffset] = lateralX * (sharedWave + tipSplay) + secondaryX * individualWave;
  output[outputOffset + 1] = lateralY * (sharedWave + tipSplay) + secondaryY * individualWave;
  output[outputOffset + 2] = lateralZ * (sharedWave + tipSplay) + secondaryZ * individualWave;
  return output;
}

export function sparseGroomOccupancyRemap(root, heroId, fraction, point, output, outputOffset = 0) {
  const t = Math.max(0, Math.min(1, fraction));
  output[outputOffset] = 0;
  output[outputOffset + 1] = 0;
  output[outputOffset + 2] = 0;
  if (t <= 0.15) return output;
  const hero = SPARSE_GROOM_HEROES[heroId];
  const center = sparseGroomRestPoint(hero.root, t, new Float64Array(3));
  const offset = [point[0] - center[0], point[1] - center[1], point[2] - center[2]];
  let lateralX = hero.anchor[2];
  let lateralZ = -hero.anchor[0];
  const lateralLength = Math.hypot(lateralX, lateralZ) || 1;
  lateralX /= lateralLength;
  lateralZ /= lateralLength;
  const phase = sparseGroomSublockPhase(root, heroId);
  const coreScalar = (phase - 1) * SPARSE_GROOM_CORE_SEPARATION_METERS;
  const ramp = smoothstep01((t - 0.15) / 0.2);
  const tipRelaxation = 1 - smoothstep01((t - 0.75) / 0.25) * 0.18;
  const heroPull = 0.35 + ((heroId * 0.61803398875) % 1) * 0.2;
  const pull = heroPull * ramp * tipRelaxation;
  const targetX = lateralX * coreScalar;
  const targetZ = lateralZ * coreScalar;
  output[outputOffset] = (targetX - offset[0]) * pull;
  output[outputOffset + 1] = -offset[1] * pull * 0.72;
  output[outputOffset + 2] = (targetZ - offset[2]) * pull;
  return output;
}

export function sparseGroomRestPoint(root, fraction, output, outputOffset = 0) {
  const t = Math.max(0, Math.min(1, fraction));
  const hero = SPARSE_GROOM_HEROES[sparseGroomHeroForRoot(root)];
  const p0 = hero.root;
  const p1 = hero.controlOffsets[0].map(
    (value, axis) => p0[axis] + value + hero.anchor[axis] * 0.06
  );
  const p2 = hero.controlOffsets[1].map((value, axis) => p0[axis] + value);
  const p3 = hero.controlOffsets[2].map((value, axis) => p0[axis] + value);
  const inverse = 1 - t;
  const w0 = inverse ** 3;
  const w1 = 3 * inverse * inverse * t;
  const w2 = 3 * inverse * t * t;
  const w3 = t ** 3;
  const retention = sparseGroomOffsetRetentionAt(t);
  const mode = legacySublockMode(root) - 1;
  const correlatedBend = Math.sin(Math.PI * t) * mode * 0.035;
  const lengthShift = t * t * mode * 0.045;
  const rootNormal = scalpCoordinate(root);
  const emergenceWeight = 3 * t * (1 - t) * (1 - t) * 0.08;
  output[outputOffset] =
    p0[0] * w0 +
    p1[0] * w1 +
    p2[0] * w2 +
    p3[0] * w3 +
    (root[0] - p0[0]) * retention +
    correlatedBend +
    rootNormal[0] * emergenceWeight;
  output[outputOffset + 1] =
    p0[1] * w0 +
    p1[1] * w1 +
    p2[1] * w2 +
    p3[1] * w3 +
    (root[1] - p0[1]) * retention -
    lengthShift +
    rootNormal[1] * emergenceWeight;
  output[outputOffset + 2] =
    p0[2] * w0 +
    p1[2] * w1 +
    p2[2] * w2 +
    p3[2] * w3 +
    (root[2] - p0[2]) * retention -
    correlatedBend * 0.45 +
    rootNormal[2] * emergenceWeight;
  return output;
}
