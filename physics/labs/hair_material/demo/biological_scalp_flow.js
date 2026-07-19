import { SCALP_CENTER, SCALP_RADII, SCALP_ROOT_OFFSET } from "./scalp_layout.js?v=116";

export const BIOLOGICAL_SCALP_FLOW_ID = "crown_whorl_side_part_flow_v1";
export const BIOLOGICAL_WHORL_CENTER = Object.freeze([-0.16, 0.97, -0.18]);
export const BIOLOGICAL_WHORL_HANDEDNESS = "clockwise_viewed_from_outside";
export const BIOLOGICAL_OUTWARD_WEIGHT = 0.24;
export const BIOLOGICAL_ROOT_EMERGENCE_DOT = 0.62;
export const BIOLOGICAL_ROOT_EMERGENCE_HOLD_FRACTION = 0.14;
export const BIOLOGICAL_ROOT_EMERGENCE_RELEASE_FRACTION = 0.25;
export const BIOLOGICAL_PRIMARY_FIBERS_PER_LOCK = 5;
export const BIOLOGICAL_PRIMARY_WIDTH_MULTIPLIER = 2.5;
export const BIOLOGICAL_UNDERCOAT_COVERAGE = 0.035;
export const BIOLOGICAL_ANATOMICAL_UNDERCOAT_COVERAGE = 0.26;

function normalize(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function typedArrayDigest(values) {
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function biologicalScalpFlowDirection(root, output = new Float64Array(3)) {
  const normal = normalize(
    (root[0] - SCALP_CENTER[0]) / (SCALP_RADII[0] + SCALP_ROOT_OFFSET),
    (root[1] - SCALP_CENTER[1]) / (SCALP_RADII[1] + SCALP_ROOT_OFFSET),
    (root[2] - SCALP_CENTER[2]) / (SCALP_RADII[2] + SCALP_ROOT_OFFSET)
  );
  const whorl = normalize(...BIOLOGICAL_WHORL_CENTER);
  const swirl = normalize(
    whorl[1] * normal[2] - whorl[2] * normal[1],
    whorl[2] * normal[0] - whorl[0] * normal[2],
    whorl[0] * normal[1] - whorl[1] * normal[0]
  );
  const centerDot = normal[0] * whorl[0] + normal[1] * whorl[1] + normal[2] * whorl[2];
  const radialToward = normalize(
    whorl[0] - normal[0] * centerDot,
    whorl[1] - normal[1] * centerDot,
    whorl[2] - normal[2] * centerDot
  );
  const crown = Math.max(0, Math.min(1, (normal[1] - 0.42) / 0.48));
  const front = Math.max(0, normal[2]);
  const partSide = root[0] < -0.18 ? -1 : 1;
  const partTangent = normalize(normal[2], 0, -normal[0]);
  const fall = normalize(normal[0] * 0.25, -0.92, normal[2] * 0.18 - 0.3);
  const tangent = normalize(
    swirl[0] * (0.72 * crown) -
      radialToward[0] * (0.28 * crown) +
      partTangent[0] * partSide * front * 0.62 +
      fall[0] * (1 - crown),
    swirl[1] * (0.72 * crown) -
      radialToward[1] * (0.28 * crown) +
      partTangent[1] * partSide * front * 0.62 +
      fall[1] * (1 - crown),
    swirl[2] * (0.72 * crown) -
      radialToward[2] * (0.28 * crown) +
      partTangent[2] * partSide * front * 0.62 +
      fall[2] * (1 - crown)
  );
  const direction = normalize(
    tangent[0] + normal[0] * BIOLOGICAL_OUTWARD_WEIGHT,
    tangent[1] + normal[1] * BIOLOGICAL_OUTWARD_WEIGHT,
    tangent[2] + normal[2] * BIOLOGICAL_OUTWARD_WEIGHT
  );
  output[0] = direction[0];
  output[1] = direction[1];
  output[2] = direction[2];
  return output;
}

export function buildBiologicalHeroLockMap(roots, heroIds) {
  const primary = new Uint8Array(heroIds.length);
  const coverage = new Float32Array(heroIds.length);
  coverage.fill(BIOLOGICAL_UNDERCOAT_COVERAGE);
  const groups = Array.from({ length: 20 }, () => []);
  for (let binding = 0; binding < heroIds.length; binding += 1) {
    const root = binding * 3;
    groups[heroIds[binding]].push({
      binding,
      coordinate: roots[root] * 0.73 + roots[root + 2] * 0.27,
    });
  }
  for (const group of groups) {
    group.sort((a, b) => a.coordinate - b.coordinate || a.binding - b.binding);
    const denominator = Math.max(1, group.length - 1);
    for (let rank = 0; rank < group.length; rank += 1) {
      const entry = group[rank];
      const root = entry.binding * 3;
      const normal = normalize(
        roots[root] / (SCALP_RADII[0] + SCALP_ROOT_OFFSET),
        (roots[root + 1] - SCALP_CENTER[1]) / (SCALP_RADII[1] + SCALP_ROOT_OFFSET),
        roots[root + 2] / (SCALP_RADII[2] + SCALP_ROOT_OFFSET)
      );
      const coordinate = -1 + (2 * rank) / denominator;
      const crown = smoothstep01((normal[1] - 0.48) / 0.28);
      const rear = smoothstep01((-normal[2] - 0.02) / 0.42);
      const outerSide = smoothstep01((Math.abs(normal[0]) - 0.42) / 0.36);
      const frontalAperture = smoothstep01((normal[2] - 0.02) / 0.3);
      const channelProtection = smoothstep01((Math.abs(coordinate) - 0.58) / 0.42);
      const anatomical = Math.max(crown, rear, outerSide) * (1 - frontalAperture);
      const protectedAnatomical = anatomical * (1 - channelProtection * 0.88);
      coverage[entry.binding] =
        BIOLOGICAL_UNDERCOAT_COVERAGE +
        (BIOLOGICAL_ANATOMICAL_UNDERCOAT_COVERAGE - BIOLOGICAL_UNDERCOAT_COVERAGE) *
          protectedAnatomical;
    }
    for (let sample = 0; sample < BIOLOGICAL_PRIMARY_FIBERS_PER_LOCK; sample += 1) {
      const rank = Math.round(
        ((sample + 0.5) / BIOLOGICAL_PRIMARY_FIBERS_PER_LOCK) * (group.length - 1)
      );
      const binding = group[rank].binding;
      primary[binding] = 1;
      coverage[binding] = 1;
    }
  }
  return {
    biologicalPrimaryFibers: primary,
    biologicalFiberCoverage: coverage,
  };
}

export function biologicalHeroLockTelemetry(bindings) {
  const primaryCount = bindings.biologicalPrimaryFibers.reduce((sum, value) => sum + value, 0);
  return {
    field_identity: BIOLOGICAL_SCALP_FLOW_ID,
    whorl_center: BIOLOGICAL_WHORL_CENTER,
    whorl_handedness: BIOLOGICAL_WHORL_HANDEDNESS,
    outward_weight: BIOLOGICAL_OUTWARD_WEIGHT,
    root_emergence_dot: BIOLOGICAL_ROOT_EMERGENCE_DOT,
    root_emergence_hold_fraction: BIOLOGICAL_ROOT_EMERGENCE_HOLD_FRACTION,
    root_emergence_release_fraction: BIOLOGICAL_ROOT_EMERGENCE_RELEASE_FRACTION,
    hero_lock_count: 20,
    primary_fibers_per_lock: BIOLOGICAL_PRIMARY_FIBERS_PER_LOCK,
    primary_fiber_count: primaryCount,
    primary_width_multiplier: BIOLOGICAL_PRIMARY_WIDTH_MULTIPLIER,
    lock_fiber_map_digest: typedArrayDigest(bindings.biologicalPrimaryFibers),
    undercoat_coverage: BIOLOGICAL_UNDERCOAT_COVERAGE,
    anatomical_undercoat_coverage: BIOLOGICAL_ANATOMICAL_UNDERCOAT_COVERAGE,
    undercoat_mask_digest: typedArrayDigest(bindings.biologicalFiberCoverage),
    physics_authority: "none_rest_baked_display_topology",
  };
}
