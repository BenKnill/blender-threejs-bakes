export const FATLINE_ROOT_HALF_WIDTH_PX = 0.84;
export const FATLINE_TIP_HALF_WIDTH_PX = 0.07;
export const HAIR_FIBER_SHADING_ID = "artist_dual_plus_near_field_proxy_lobes_v4";
export const HAIR_PRESENTATION_LOOP_ID = "visible_two_wind_orbits_1020_step_v3";
export const REEL_CAMERA_FIELD_ID = "fixed_control_two_orbit_1020_step_v3";
export const FULL_GROOM_HYDRATION_ID = "hierarchy_plus_section_envelope_hydration_v7";
export const HAIR_HYDRATION_RECIPE_ID = "independent_geometry_optics_color_detail_space_v2";
export const HAIR_HYDRATION_BREADTH_ID = "disney_reference_5x6x6x6_composition_space_v1";
export const PHYSICS_SKELETON_STYLE_ID = "uniform_world_space_rods_joints_v2";
export const LOCK_AWARE_COVERAGE_ID = "live_root_cover_locks_catmull_rom_v3";
export const LOCK_AWARE_RENDER_SUBDIVISIONS = 2;
export const LOCK_AWARE_ROOT_COVER_SEGMENTS = 3;
export const LOCK_AWARE_ROOT_COVER_LENGTH_METERS = 0.24;
export const LOCK_AWARE_ROOT_COVER_PROBE_PARTICLE = 7;
export const LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT = 0.86;
export const LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT = 0.34;
export const PHYSICS_SKELETON_STYLE = Object.freeze({
  guideLimit: 64,
  rodRadiusMeters: 0.011,
  jointRadiusMeters: 0.02,
  rootJointScale: 1,
  depthWriteMinimumOpacity: 0.5,
});

export const HAIR_HYDRATION_RECIPES = Object.freeze({
  fine_silk: Object.freeze({
    id: "fine_silk",
    label: "Fine silk / transmitted",
    rootWidthScale: 0.58,
    tipWidthScale: 0.46,
    populationFraction: 1,
    opacity: 0.68,
    longitudinalRoughness: 0.22,
    diffuseWeight: 0.48,
    primaryWeight: 0.34,
    transmissionWeight: 0.2,
    rimWeight: 0.2,
    multipleScatteringFill: 0.16,
    undercoatScale: 0.64,
    geometryId: "fine_layers",
    opticalId: "backlit_silk",
    colorId: "honey_blonde",
    detailId: "groom_clean",
  }),
  natural_balanced: Object.freeze({
    id: "natural_balanced",
    label: "Natural balanced / full",
    rootWidthScale: 0.78,
    tipWidthScale: 0.68,
    populationFraction: 1,
    opacity: 0.78,
    longitudinalRoughness: 0.34,
    diffuseWeight: 0.62,
    primaryWeight: 0.23,
    transmissionWeight: 0.1,
    rimWeight: 0.16,
    multipleScatteringFill: 0.11,
    undercoatScale: 0.82,
    geometryId: "balanced_full",
    opticalId: "artist_dual",
    colorId: "chestnut",
    detailId: "natural_variation",
  }),
  coarse_matte: Object.freeze({
    id: "coarse_matte",
    label: "Coarse / matte body",
    rootWidthScale: 1.24,
    tipWidthScale: 1.04,
    populationFraction: 0.82,
    opacity: 0.86,
    longitudinalRoughness: 0.49,
    diffuseWeight: 0.76,
    primaryWeight: 0.12,
    transmissionWeight: 0.06,
    rimWeight: 0.12,
    multipleScatteringFill: 0.19,
    undercoatScale: 0.94,
    geometryId: "coarse_clusters",
    opticalId: "diffuse_coil",
    colorId: "deep_ebony",
    detailId: "soft_wave",
  }),
  glossy_cinematic: Object.freeze({
    id: "glossy_cinematic",
    label: "Glossy cinematic / twin highlight",
    rootWidthScale: 0.82,
    tipWidthScale: 0.6,
    populationFraction: 0.94,
    opacity: 0.74,
    longitudinalRoughness: 0.17,
    diffuseWeight: 0.46,
    primaryWeight: 0.42,
    transmissionWeight: 0.24,
    rimWeight: 0.3,
    multipleScatteringFill: 0.09,
    undercoatScale: 0.74,
    geometryId: "fine_layers",
    opticalId: "near_field_proxy",
    colorId: "chestnut",
    detailId: "natural_variation",
  }),
  wet_clumped: Object.freeze({
    id: "wet_clumped",
    label: "Wet product / heavy locks",
    rootWidthScale: 1.62,
    tipWidthScale: 1.28,
    populationFraction: 0.38,
    opacity: 0.94,
    longitudinalRoughness: 0.2,
    diffuseWeight: 0.38,
    primaryWeight: 0.3,
    transmissionWeight: 0.05,
    rimWeight: 0.18,
    multipleScatteringFill: 0.07,
    undercoatScale: 1.08,
    geometryId: "wet_locks",
    opticalId: "near_field_proxy",
    colorId: "deep_ebony",
    detailId: "wet_grouped",
  }),
});

export const HAIR_HYDRATION_RECIPE_ORDER = Object.freeze(Object.keys(HAIR_HYDRATION_RECIPES));

export const HAIR_GEOMETRY_PROFILES = Object.freeze({
  diagnostic_ribbons: Object.freeze({
    id: "diagnostic_ribbons",
    label: "Diagnostic ribbons / sparse",
    rootWidthScale: 1.34,
    tipWidthScale: 1.12,
    ownerDensity: 1,
    clumpDensity: 0.34,
    microfiberDensity: 0.1,
    flyawayDensity: 0,
    undercoatScale: 0,
    spreadScale: 0.82,
    envelopeScale: 0.58,
  }),
  fine_layers: Object.freeze({
    id: "fine_layers",
    label: "Fine layered fibers",
    rootWidthScale: 0.54,
    tipWidthScale: 0.38,
    ownerDensity: 1,
    clumpDensity: 0.88,
    microfiberDensity: 1,
    flyawayDensity: 0.42,
    undercoatScale: 0.62,
    spreadScale: 1.08,
    envelopeScale: 0.82,
  }),
  balanced_full: Object.freeze({
    id: "balanced_full",
    label: "Balanced full hierarchy",
    rootWidthScale: 0.76,
    tipWidthScale: 0.6,
    ownerDensity: 1,
    clumpDensity: 1,
    microfiberDensity: 0.94,
    flyawayDensity: 0.52,
    undercoatScale: 0.82,
    spreadScale: 1,
    envelopeScale: 1,
  }),
  coarse_clusters: Object.freeze({
    id: "coarse_clusters",
    label: "Coarse clustered shafts",
    rootWidthScale: 1.18,
    tipWidthScale: 0.92,
    ownerDensity: 1,
    clumpDensity: 1,
    microfiberDensity: 0.58,
    flyawayDensity: 0.24,
    undercoatScale: 0.9,
    spreadScale: 0.8,
    envelopeScale: 1.18,
  }),
  wet_locks: Object.freeze({
    id: "wet_locks",
    label: "Wet grouped locks",
    rootWidthScale: 1.54,
    tipWidthScale: 1.14,
    ownerDensity: 1,
    clumpDensity: 0.9,
    microfiberDensity: 0.24,
    flyawayDensity: 0.04,
    undercoatScale: 1.04,
    spreadScale: 0.42,
    envelopeScale: 0.72,
  }),
});

export const HAIR_OPTICAL_MODELS = Object.freeze({
  diagnostic_flat: Object.freeze({
    id: "diagnostic_flat",
    label: "Flat diagnostic",
    shadingMix: 0,
    opacity: 0.9,
    longitudinalRoughness: 0.45,
    azimuthalRoughness: 0.5,
    cuticleTilt: 0,
    diffuseWeight: 0.9,
    reflectionWeight: 0,
    transmissionWeight: 0,
    internalReflectionWeight: 0,
    rimWeight: 0,
    multipleScatteringFill: 0,
    glintStrength: 0,
  }),
  artist_dual: Object.freeze({
    id: "artist_dual",
    label: "Artist dual highlight",
    shadingMix: 1,
    opacity: 0.78,
    longitudinalRoughness: 0.31,
    azimuthalRoughness: 0.38,
    cuticleTilt: 0.085,
    diffuseWeight: 0.56,
    reflectionWeight: 0.24,
    transmissionWeight: 0.13,
    internalReflectionWeight: 0.09,
    rimWeight: 0.16,
    multipleScatteringFill: 0.11,
    glintStrength: 0.04,
  }),
  near_field_proxy: Object.freeze({
    id: "near_field_proxy",
    label: "Near-field R / TT / TRT proxy",
    shadingMix: 1,
    opacity: 0.76,
    longitudinalRoughness: 0.2,
    azimuthalRoughness: 0.26,
    cuticleTilt: 0.11,
    diffuseWeight: 0.34,
    reflectionWeight: 0.34,
    transmissionWeight: 0.2,
    internalReflectionWeight: 0.18,
    rimWeight: 0.22,
    multipleScatteringFill: 0.09,
    glintStrength: 0.12,
  }),
  backlit_silk: Object.freeze({
    id: "backlit_silk",
    label: "Backlit transmission",
    shadingMix: 1,
    opacity: 0.65,
    longitudinalRoughness: 0.18,
    azimuthalRoughness: 0.3,
    cuticleTilt: 0.07,
    diffuseWeight: 0.36,
    reflectionWeight: 0.19,
    transmissionWeight: 0.38,
    internalReflectionWeight: 0.08,
    rimWeight: 0.34,
    multipleScatteringFill: 0.15,
    glintStrength: 0.08,
  }),
  diffuse_coil: Object.freeze({
    id: "diffuse_coil",
    label: "Diffuse coil body",
    shadingMix: 1,
    opacity: 0.86,
    longitudinalRoughness: 0.5,
    azimuthalRoughness: 0.58,
    cuticleTilt: 0.055,
    diffuseWeight: 0.74,
    reflectionWeight: 0.1,
    transmissionWeight: 0.05,
    internalReflectionWeight: 0.12,
    rimWeight: 0.13,
    multipleScatteringFill: 0.24,
    glintStrength: 0.02,
  }),
  silver_glint: Object.freeze({
    id: "silver_glint",
    label: "Silver glint / broad scatter",
    shadingMix: 1,
    opacity: 0.74,
    longitudinalRoughness: 0.26,
    azimuthalRoughness: 0.44,
    cuticleTilt: 0.095,
    diffuseWeight: 0.5,
    reflectionWeight: 0.4,
    transmissionWeight: 0.14,
    internalReflectionWeight: 0.16,
    rimWeight: 0.3,
    multipleScatteringFill: 0.23,
    glintStrength: 0.22,
  }),
});

export const HAIR_COLOR_PROFILES = Object.freeze({
  blueprint: Object.freeze({
    id: "blueprint",
    label: "Cyan blueprint",
    baseColor: 0x32ccef,
    absorptionTint: Object.freeze([0.38, 0.86, 1]),
  }),
  deep_ebony: Object.freeze({
    id: "deep_ebony",
    label: "Deep ebony",
    baseColor: 0x170f18,
    absorptionTint: Object.freeze([0.34, 0.22, 0.3]),
  }),
  chestnut: Object.freeze({
    id: "chestnut",
    label: "Chestnut brown",
    baseColor: 0x55231e,
    absorptionTint: Object.freeze([0.78, 0.38, 0.3]),
  }),
  copper: Object.freeze({
    id: "copper",
    label: "Copper red",
    baseColor: 0x742817,
    absorptionTint: Object.freeze([1, 0.44, 0.2]),
  }),
  honey_blonde: Object.freeze({
    id: "honey_blonde",
    label: "Honey blonde",
    baseColor: 0x9b6835,
    absorptionTint: Object.freeze([1, 0.76, 0.4]),
  }),
  silver: Object.freeze({
    id: "silver",
    label: "Silver / low pigment",
    baseColor: 0xa9a3a4,
    absorptionTint: Object.freeze([0.92, 0.96, 1]),
  }),
});

export const HAIR_DETAIL_PROFILES = Object.freeze({
  groom_clean: Object.freeze({
    id: "groom_clean",
    label: "Clean groom",
    curlAmplitude: 0,
    curlFrequency: 4,
    frizzAmplitude: 0,
    flyawayAmplitude: 0,
  }),
  natural_variation: Object.freeze({
    id: "natural_variation",
    label: "Natural variation",
    curlAmplitude: 0.008,
    curlFrequency: 6,
    frizzAmplitude: 0.006,
    flyawayAmplitude: 0.02,
  }),
  soft_wave: Object.freeze({
    id: "soft_wave",
    label: "Soft S-wave",
    curlAmplitude: 0.032,
    curlFrequency: 8,
    frizzAmplitude: 0.007,
    flyawayAmplitude: 0.025,
  }),
  tight_coil: Object.freeze({
    id: "tight_coil",
    label: "Tight coil spectrum",
    curlAmplitude: 0.05,
    curlFrequency: 18,
    frizzAmplitude: 0.012,
    flyawayAmplitude: 0.022,
  }),
  flyaway_frizz: Object.freeze({
    id: "flyaway_frizz",
    label: "Flyaway + frizz layer",
    curlAmplitude: 0.014,
    curlFrequency: 10,
    frizzAmplitude: 0.025,
    flyawayAmplitude: 0.075,
  }),
  wet_grouped: Object.freeze({
    id: "wet_grouped",
    label: "Wet grouped detail",
    curlAmplitude: 0.004,
    curlFrequency: 5,
    frizzAmplitude: 0.001,
    flyawayAmplitude: 0,
  }),
});

export const HAIR_BREADTH_TOUR = Object.freeze([
  Object.freeze({
    id: "flat_blueprint",
    label: "flat blueprint ribbons",
    geometryId: "diagnostic_ribbons",
    opticalId: "diagnostic_flat",
    colorId: "blueprint",
    detailId: "groom_clean",
  }),
  Object.freeze({
    id: "fine_transmission",
    label: "fine transmitted layers",
    geometryId: "fine_layers",
    opticalId: "backlit_silk",
    colorId: "honey_blonde",
    detailId: "groom_clean",
  }),
  Object.freeze({
    id: "natural_full",
    label: "natural full hierarchy",
    geometryId: "balanced_full",
    opticalId: "artist_dual",
    colorId: "chestnut",
    detailId: "natural_variation",
  }),
  Object.freeze({
    id: "coarse_matte",
    label: "coarse matte clusters",
    geometryId: "coarse_clusters",
    opticalId: "diffuse_coil",
    colorId: "deep_ebony",
    detailId: "groom_clean",
  }),
  Object.freeze({
    id: "ebony_near_field",
    label: "ebony R / TT / TRT",
    geometryId: "balanced_full",
    opticalId: "near_field_proxy",
    colorId: "deep_ebony",
    detailId: "natural_variation",
  }),
  Object.freeze({
    id: "copper_artist_dual",
    label: "copper dual highlight",
    geometryId: "balanced_full",
    opticalId: "artist_dual",
    colorId: "copper",
    detailId: "natural_variation",
  }),
  Object.freeze({
    id: "blonde_backlight",
    label: "blonde backlight",
    geometryId: "fine_layers",
    opticalId: "backlit_silk",
    colorId: "honey_blonde",
    detailId: "natural_variation",
  }),
  Object.freeze({
    id: "silver_glint",
    label: "silver glint",
    geometryId: "fine_layers",
    opticalId: "silver_glint",
    colorId: "silver",
    detailId: "groom_clean",
  }),
  Object.freeze({
    id: "soft_wave",
    label: "soft S-wave detail",
    geometryId: "balanced_full",
    opticalId: "artist_dual",
    colorId: "chestnut",
    detailId: "soft_wave",
  }),
  Object.freeze({
    id: "tight_coil",
    label: "tight coil spectrum",
    geometryId: "coarse_clusters",
    opticalId: "diffuse_coil",
    colorId: "deep_ebony",
    detailId: "tight_coil",
  }),
  Object.freeze({
    id: "flyaway_frizz",
    label: "flyaway + frizz layer",
    geometryId: "balanced_full",
    opticalId: "artist_dual",
    colorId: "copper",
    detailId: "flyaway_frizz",
  }),
  Object.freeze({
    id: "wet_locks",
    label: "wet grouped locks",
    geometryId: "wet_locks",
    opticalId: "near_field_proxy",
    colorId: "deep_ebony",
    detailId: "wet_grouped",
  }),
]);

export const HAIR_BREADTH_TOUR_ORDER = Object.freeze(HAIR_BREADTH_TOUR.map((state) => state.id));
export const HAIR_HYDRATION_COMPOSITION_COUNT =
  Object.keys(HAIR_GEOMETRY_PROFILES).length *
  Object.keys(HAIR_OPTICAL_MODELS).length *
  Object.keys(HAIR_COLOR_PROFILES).length *
  Object.keys(HAIR_DETAIL_PROFILES).length;

export const FULL_GROOM_HYDRATION_STEPS = Object.freeze({
  physicsEndStep: 120,
  groomVolumesEndStep: 210,
  ownerGuidesEndStep: 300,
  clumpLocksEndStep: 390,
  microfiberFillEndStep: 480,
  flyawayFillEndStep: 570,
  materialAuditionEndStep: 1290,
  guideFadeEndStep: 1350,
  auditionRecipeStepCount: 60,
});
export const NATIVE_HYDRATION_PRE_ROLL_SECONDS = FULL_GROOM_HYDRATION_STEPS.guideFadeEndStep / 60;

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function wrappedAngleDistance(left, right) {
  const direct = Math.abs(left - right) % (Math.PI * 2);
  return Math.min(direct, Math.PI * 2 - direct);
}

const ROOT_COVER_FRACTIONS = Object.freeze([0, 0.34, 0.7, 1]);
const ROOT_COVER_LIFTS = Object.freeze([0, 0.055, 0.085, 0.065]);

export function catmullRomScalar(p0, p1, p2, p3, t, tangentScale = 0.5) {
  const clamped = Math.max(0, Math.min(1, t));
  const t2 = clamped * clamped;
  const t3 = t2 * clamped;
  const m1 = (p2 - p0) * tangentScale;
  const m2 = (p3 - p1) * tangentScale;
  return (
    (2 * t3 - 3 * t2 + 1) * p1 +
    (t3 - 2 * t2 + clamped) * m1 +
    (-2 * t3 + 3 * t2) * p2 +
    (t3 - t2) * m2
  );
}

export function blendRootCoverageFlow(
  normalX,
  normalY,
  normalZ,
  authoredX,
  authoredY,
  authoredZ,
  liveX,
  liveY,
  liveZ,
  liveWeight = LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT,
  output = []
) {
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const nz = normalZ / normalLength;
  const authoredOutward = authoredX * nx + authoredY * ny + authoredZ * nz;
  let authoredTangentX = authoredX - authoredOutward * nx;
  let authoredTangentY = authoredY - authoredOutward * ny;
  let authoredTangentZ = authoredZ - authoredOutward * nz;
  let authoredLength = Math.hypot(authoredTangentX, authoredTangentY, authoredTangentZ);
  if (authoredLength < 1e-8) {
    authoredTangentX = nz;
    authoredTangentY = 0;
    authoredTangentZ = -nx;
    authoredLength = Math.hypot(authoredTangentX, authoredTangentY, authoredTangentZ) || 1;
  }
  authoredTangentX /= authoredLength;
  authoredTangentY /= authoredLength;
  authoredTangentZ /= authoredLength;
  const liveOutward = liveX * nx + liveY * ny + liveZ * nz;
  let liveTangentX = liveX - liveOutward * nx;
  let liveTangentY = liveY - liveOutward * ny;
  let liveTangentZ = liveZ - liveOutward * nz;
  let liveLength = Math.hypot(liveTangentX, liveTangentY, liveTangentZ);
  if (liveLength < 1e-8) {
    liveTangentX = authoredTangentX;
    liveTangentY = authoredTangentY;
    liveTangentZ = authoredTangentZ;
    liveLength = 1;
  }
  liveTangentX /= liveLength;
  liveTangentY /= liveLength;
  liveTangentZ /= liveLength;
  const weight = Math.max(0, Math.min(1, liveWeight));
  let flowX = authoredTangentX * (1 - weight) + liveTangentX * weight;
  let flowY = authoredTangentY * (1 - weight) + liveTangentY * weight;
  let flowZ = authoredTangentZ * (1 - weight) + liveTangentZ * weight;
  const flowLength = Math.hypot(flowX, flowY, flowZ) || 1;
  flowX /= flowLength;
  flowY /= flowLength;
  flowZ /= flowLength;
  const authoredDot =
    flowX * authoredTangentX + flowY * authoredTangentY + flowZ * authoredTangentZ;
  if (authoredDot < LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT) {
    let perpendicularX = flowX - authoredDot * authoredTangentX;
    let perpendicularY = flowY - authoredDot * authoredTangentY;
    let perpendicularZ = flowZ - authoredDot * authoredTangentZ;
    let perpendicularLength = Math.hypot(perpendicularX, perpendicularY, perpendicularZ);
    if (perpendicularLength < 1e-8) {
      perpendicularX = ny * authoredTangentZ - nz * authoredTangentY;
      perpendicularY = nz * authoredTangentX - nx * authoredTangentZ;
      perpendicularZ = nx * authoredTangentY - ny * authoredTangentX;
      perpendicularLength = Math.hypot(perpendicularX, perpendicularY, perpendicularZ) || 1;
    }
    const perpendicularScale =
      Math.sqrt(1 - LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT ** 2) / perpendicularLength;
    flowX =
      authoredTangentX * LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT +
      perpendicularX * perpendicularScale;
    flowY =
      authoredTangentY * LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT +
      perpendicularY * perpendicularScale;
    flowZ =
      authoredTangentZ * LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT +
      perpendicularZ * perpendicularScale;
  }
  output[0] = flowX;
  output[1] = flowY;
  output[2] = flowZ;
  return output;
}

export function buildRootCoverageCurve(
  rootX,
  rootY,
  rootZ,
  normalX,
  normalY,
  normalZ,
  targetX,
  targetY,
  targetZ,
  strand,
  copy,
  length,
  output = new Float64Array(12)
) {
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const nz = normalZ / normalLength;
  const outward = targetX * nx + targetY * ny + targetZ * nz;
  let tx = targetX - outward * nx;
  let ty = targetY - outward * ny;
  let tz = targetZ - outward * nz;
  let tangentLength = Math.hypot(tx, ty, tz);
  if (tangentLength < 1e-8) {
    tx = nz;
    ty = 0;
    tz = -nx;
    tangentLength = Math.hypot(tx, ty, tz) || 1;
  }
  tx /= tangentLength;
  ty /= tangentLength;
  tz /= tangentLength;
  let bx = ny * tz - nz * ty;
  let by = nz * tx - nx * tz;
  let bz = nx * ty - ny * tx;
  const binormalLength = Math.hypot(bx, by, bz) || 1;
  bx /= binormalLength;
  by /= binormalLength;
  bz /= binormalLength;

  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  const unsigned = hash >>> 0;
  const spreadAngle = (((unsigned & 0x3ff) / 1023) * 2 - 1) * 0.42;
  const spreadCos = Math.cos(spreadAngle);
  const spreadSin = Math.sin(spreadAngle);
  const directionX = tx * spreadCos + bx * spreadSin;
  const directionY = ty * spreadCos + by * spreadSin;
  const directionZ = tz * spreadCos + bz * spreadSin;
  const span = Math.max(0, length) * (0.84 + (((unsigned >>> 10) & 0xff) / 255) * 0.32);
  const sideWave = ((((unsigned >>> 18) & 0xff) / 255) * 2 - 1) * span * 0.035;
  for (let point = 0; point < 4; point += 1) {
    const fraction = ROOT_COVER_FRACTIONS[point];
    const wave = Math.sin(Math.PI * fraction) * sideWave;
    const cursor = point * 3;
    output[cursor] =
      rootX + directionX * span * fraction + bx * wave + nx * span * ROOT_COVER_LIFTS[point];
    output[cursor + 1] =
      rootY + directionY * span * fraction + by * wave + ny * span * ROOT_COVER_LIFTS[point];
    output[cursor + 2] =
      rootZ + directionZ * span * fraction + bz * wave + nz * span * ROOT_COVER_LIFTS[point];
  }
  return output;
}

export function buildUndercoatCoverageProfile(
  rootNormals,
  guideSections,
  slices = 96,
  sectionCount = 8
) {
  const guideCount = rootNormals.length / 3;
  if (
    !Number.isInteger(guideCount) ||
    guideSections.length !== guideCount ||
    !Number.isInteger(slices) ||
    slices < 8 ||
    !Number.isInteger(sectionCount) ||
    sectionCount < 1
  ) {
    throw new Error("undercoat coverage inputs are invalid");
  }
  const sectionEdgeDensity = new Float64Array(sectionCount);
  const guidePhis = new Float64Array(guideCount);
  const guideEdgeWeights = new Float64Array(guideCount);
  for (let guide = 0; guide < guideCount; guide += 1) {
    const normalX = rootNormals[guide * 3];
    const normalY = rootNormals[guide * 3 + 1];
    const normalZ = rootNormals[guide * 3 + 2];
    const section = guideSections[guide] % sectionCount;
    const edgeWeight = smoothStep01((0.9 - normalY) / 0.48);
    guidePhis[guide] = Math.atan2(normalZ, normalX);
    guideEdgeWeights[guide] = edgeWeight;
    sectionEdgeDensity[section] += edgeWeight;
  }
  const maximumSectionDensity = Math.max(1e-9, ...sectionEdgeDensity);
  const localDensity = new Float32Array(slices);
  let maximumLocalDensity = 1e-9;
  for (let slice = 0; slice < slices; slice += 1) {
    const phi = (slice / slices) * Math.PI * 2;
    let density = 0;
    for (let guide = 0; guide < guideCount; guide += 1) {
      const distance = wrappedAngleDistance(phi, guidePhis[guide]);
      const angularWeight = Math.max(0, 1 - distance / 0.34);
      density += angularWeight * angularWeight * guideEdgeWeights[guide];
    }
    localDensity[slice] = density;
    maximumLocalDensity = Math.max(maximumLocalDensity, density);
  }
  const fadeStarts = new Float32Array(slices);
  const densityScales = new Float32Array(slices);
  let minimumFadeStart = 1;
  let maximumFadeStart = 0;
  let densitySum = 0;
  for (let slice = 0; slice < slices; slice += 1) {
    const phi = (slice / slices) * Math.PI * 2;
    const section = Math.min(
      sectionCount - 1,
      Math.floor(((phi + Math.PI) / (Math.PI * 2)) * sectionCount) % sectionCount
    );
    const density = localDensity[slice] / maximumLocalDensity;
    const sectionDensity = sectionEdgeDensity[section] / maximumSectionDensity;
    let hash = Math.imul(slice + 1, 0x45d9f3b) ^ Math.imul(section + 1, 0x27d4eb2d);
    hash ^= hash >>> 16;
    const jitter = ((hash >>> 0) % 101) / 100 - 0.5;
    const fadeStart = Math.max(
      0.64,
      Math.min(0.88, 0.68 + density * 0.13 + sectionDensity * 0.035 + jitter * 0.04)
    );
    fadeStarts[slice] = fadeStart;
    densityScales[slice] = 0.72 + density * 0.22 + sectionDensity * 0.06;
    minimumFadeStart = Math.min(minimumFadeStart, fadeStart);
    maximumFadeStart = Math.max(maximumFadeStart, fadeStart);
    densitySum += density;
  }
  return {
    slices,
    sectionCount,
    fadeStarts,
    densityScales,
    minimumFadeStart,
    maximumFadeStart,
    meanNormalizedDensity: densitySum / slices,
  };
}

export function undercoatCoverageAt(profile, ringFraction, slice) {
  const index = ((slice % profile.slices) + profile.slices) % profile.slices;
  const fraction = Math.max(0, Math.min(1, ringFraction));
  const fadeStart = profile.fadeStarts[index];
  const edgeFade = 1 - smoothStep01((fraction - fadeStart) / Math.max(1e-6, 1 - fadeStart));
  return profile.densityScales[index] * edgeFade;
}

export function physicsSkeletonDepthWriteAt(phase, opacity) {
  return (
    phase === "mechanical_skeleton" || opacity >= PHYSICS_SKELETON_STYLE.depthWriteMinimumOpacity
  );
}

export function presentationLoopOpacityAtStep(
  step,
  { fadeInEndStep = 30, fadeOutStartStep = 990, endStep = 1020 } = {}
) {
  if (!(0 < fadeInEndStep && fadeInEndStep < fadeOutStartStep && fadeOutStartStep < endStep)) {
    throw new Error("presentation loop steps are invalid");
  }
  if (step < fadeInEndStep) return smoothStep01(step / fadeInEndStep);
  if (step < fadeOutStartStep) return 1;
  return 1 - smoothStep01((step - fadeOutStartStep) / (endStep - fadeOutStartStep));
}

function hydrationStage(
  phase,
  stageProgress,
  hairHydration,
  guideOpacity,
  tubeOpacity,
  populationFraction,
  widthScale,
  shadingMix,
  undercoatHydration,
  ownerHydration,
  clumpHydration,
  microfiberHydration,
  flyawayHydration,
  auditionStateId = null
) {
  return {
    phase,
    stageProgress,
    hairHydration,
    guideOpacity,
    tubeOpacity,
    populationFraction,
    widthScale,
    shadingMix,
    undercoatHydration,
    ownerHydration,
    clumpHydration,
    microfiberHydration,
    flyawayHydration,
    auditionStateId,
  };
}

export function fullGroomHydrationAtStep(step, stages = FULL_GROOM_HYDRATION_STEPS) {
  const {
    physicsEndStep,
    groomVolumesEndStep,
    ownerGuidesEndStep,
    clumpLocksEndStep,
    microfiberFillEndStep,
    flyawayFillEndStep,
    materialAuditionEndStep,
    guideFadeEndStep,
    auditionRecipeStepCount,
  } = stages;
  if (
    !Number.isFinite(step) ||
    !(
      0 < physicsEndStep &&
      physicsEndStep < groomVolumesEndStep &&
      groomVolumesEndStep < ownerGuidesEndStep &&
      ownerGuidesEndStep < clumpLocksEndStep &&
      clumpLocksEndStep < microfiberFillEndStep &&
      microfiberFillEndStep < flyawayFillEndStep &&
      flyawayFillEndStep < materialAuditionEndStep &&
      materialAuditionEndStep < guideFadeEndStep &&
      auditionRecipeStepCount > 0
    )
  ) {
    throw new Error("full groom hydration steps are invalid");
  }
  if (step < physicsEndStep) {
    return hydrationStage(
      "mechanical_skeleton",
      step / physicsEndStep,
      0,
      0.92,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    );
  }
  if (step < groomVolumesEndStep) {
    const progress = smoothStep01((step - physicsEndStep) / (groomVolumesEndStep - physicsEndStep));
    return hydrationStage(
      "groom_volumes",
      progress,
      0,
      0.92 - 0.6 * progress,
      0.08 + 0.38 * progress,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0
    );
  }
  if (step < ownerGuidesEndStep) {
    const progress = smoothStep01(
      (step - groomVolumesEndStep) / (ownerGuidesEndStep - groomVolumesEndStep)
    );
    return hydrationStage(
      "owner_guides",
      progress,
      progress,
      0.32 * (1 - progress),
      0.46 * (1 - progress),
      0.035,
      0.34 + 0.3 * progress,
      0,
      0,
      progress,
      0,
      0,
      0
    );
  }
  if (step < clumpLocksEndStep) {
    const progress = smoothStep01(
      (step - ownerGuidesEndStep) / (clumpLocksEndStep - ownerGuidesEndStep)
    );
    return hydrationStage(
      "clump_locks",
      progress,
      1,
      0.5 * (1 - progress),
      0,
      0.035 + 0.265 * progress,
      0.64 + 0.16 * progress,
      0.12 * progress,
      0.08 * progress,
      1,
      progress,
      0,
      0
    );
  }
  if (step < microfiberFillEndStep) {
    const progress = smoothStep01(
      (step - clumpLocksEndStep) / (microfiberFillEndStep - clumpLocksEndStep)
    );
    return hydrationStage(
      "microfiber_fill",
      progress,
      1,
      0,
      0,
      0.3 + 0.7 * progress,
      0.8 + 0.2 * progress,
      0.12 + 0.43 * progress,
      0.08 + 0.52 * progress,
      1,
      1,
      progress,
      0
    );
  }
  if (step < flyawayFillEndStep) {
    const progress = smoothStep01(
      (step - microfiberFillEndStep) / (flyawayFillEndStep - microfiberFillEndStep)
    );
    return hydrationStage(
      "flyaway_frizz_layer",
      progress,
      1,
      0,
      0,
      1,
      1,
      0.55 + 0.2 * progress,
      0.6 + 0.4 * progress,
      1,
      1,
      1,
      progress
    );
  }
  if (step < materialAuditionEndStep) {
    const progress = (step - flyawayFillEndStep) / (materialAuditionEndStep - flyawayFillEndStep);
    const stateIndex = Math.min(
      HAIR_BREADTH_TOUR.length - 1,
      Math.floor((step - flyawayFillEndStep) / auditionRecipeStepCount)
    );
    return hydrationStage(
      "material_audition",
      progress,
      1,
      0,
      0,
      1,
      1,
      0.55 + 0.45 * smoothStep01(progress),
      0.6 + 0.4 * smoothStep01(progress),
      1,
      1,
      1,
      1,
      HAIR_BREADTH_TOUR[stateIndex].id
    );
  }
  if (step < guideFadeEndStep) {
    const progress = smoothStep01(
      (step - materialAuditionEndStep) / (guideFadeEndStep - materialAuditionEndStep)
    );
    return hydrationStage("selected_composition_settle", progress, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1);
  }
  return hydrationStage("hydrated", 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1);
}

export function hydrationRecipe(recipeId) {
  return HAIR_HYDRATION_RECIPES[recipeId] ?? HAIR_HYDRATION_RECIPES.natural_balanced;
}

export function hydrationRecipeAtStep(step, selectedRecipeId, auditionEnabled = true) {
  const presentation = fullGroomHydrationAtStep(step);
  const auditionState = HAIR_BREADTH_TOUR.find(
    (candidate) => candidate.id === presentation.auditionStateId
  );
  if (!auditionEnabled || !auditionState) return hydrationRecipe(selectedRecipeId).id;
  return (
    HAIR_HYDRATION_RECIPE_ORDER.find((recipeId) => {
      const recipe = hydrationRecipe(recipeId);
      return (
        recipe.geometryId === auditionState.geometryId &&
        recipe.opticalId === auditionState.opticalId &&
        recipe.colorId === auditionState.colorId &&
        recipe.detailId === auditionState.detailId
      );
    }) ?? hydrationRecipe(selectedRecipeId).id
  );
}

export function hydrationRecipeSelection(recipeOrId) {
  const recipe = typeof recipeOrId === "string" ? hydrationRecipe(recipeOrId) : recipeOrId;
  return {
    geometryId: recipe.geometryId,
    opticalId: recipe.opticalId,
    colorId: recipe.colorId,
    detailId: recipe.detailId,
  };
}

export function resolveHairHydrationState(selection = {}) {
  const geometry =
    HAIR_GEOMETRY_PROFILES[selection.geometryId] ?? HAIR_GEOMETRY_PROFILES.balanced_full;
  const optical = HAIR_OPTICAL_MODELS[selection.opticalId] ?? HAIR_OPTICAL_MODELS.artist_dual;
  const color = HAIR_COLOR_PROFILES[selection.colorId] ?? HAIR_COLOR_PROFILES.chestnut;
  const detail = HAIR_DETAIL_PROFILES[selection.detailId] ?? HAIR_DETAIL_PROFILES.natural_variation;
  return {
    geometry,
    optical,
    color,
    detail,
    ...geometry,
    ...optical,
    baseColor: color.baseColor,
    absorptionTint: color.absorptionTint,
    id: `${geometry.id}__${optical.id}__${color.id}__${detail.id}`,
    label: `${geometry.label} · ${optical.label} · ${color.label} · ${detail.label}`,
  };
}

export function hydrationSelectionAtStep(step, selectedSelection, auditionEnabled = true) {
  const presentation = fullGroomHydrationAtStep(step);
  if (!auditionEnabled || !presentation.auditionStateId) return { ...selectedSelection };
  const audition = HAIR_BREADTH_TOUR.find(
    (candidate) => candidate.id === presentation.auditionStateId
  );
  return audition ? { ...audition } : { ...selectedSelection };
}

export function hydrationRecipeWidthScaleAt(recipeOrId, rootFraction) {
  const recipe = typeof recipeOrId === "string" ? hydrationRecipe(recipeOrId) : recipeOrId;
  const fraction = smoothStep01(Math.max(0, Math.min(1, rootFraction)));
  return recipe.rootWidthScale + (recipe.tipWidthScale - recipe.rootWidthScale) * fraction;
}

export function hydrationFiberFamilyScale(copy, copies, presentation, hydrationState) {
  if (
    !Number.isInteger(copy) ||
    !Number.isInteger(copies) ||
    copy < 0 ||
    copy >= copies ||
    copies < 1
  ) {
    throw new Error("hydration fiber family indices are invalid");
  }
  const clumpEnd = Math.max(2, Math.floor(copies * 0.29));
  const flyawayStart = Math.max(clumpEnd + 1, Math.floor(copies * 0.86));
  const family =
    copy === 0
      ? "owner"
      : copy < clumpEnd
        ? "clump"
        : copy < flyawayStart
          ? "microfiber"
          : "flyaway";
  const hydration = presentation?.[`${family}Hydration`] ?? 1;
  const densityKey = family === "microfiber" ? "microfiberDensity" : `${family}Density`;
  return Math.max(0, Math.min(1, hydration * (hydrationState?.[densityKey] ?? 1)));
}

export function hydrationFiberPopulationScale(copy, copies, visibleFraction) {
  if (
    !Number.isInteger(copy) ||
    !Number.isInteger(copies) ||
    copy < 0 ||
    copy >= copies ||
    copies < 1
  ) {
    throw new Error("hydration fiber population indices are invalid");
  }
  const visible = Math.max(0, Math.min(1, visibleFraction));
  if (visible <= 0) return 0;
  if (visible >= 1) return 1;
  if (copy === 0 || copies === 1) return 1;
  const rank = copy / (copies - 1);
  const feather = Math.max(0.025, 1 / Math.max(8, copies * 1.5));
  return smoothStep01((visible - rank + feather) / (feather * 2));
}

export function nativeClipPresentationAtTime(
  elapsedSeconds,
  clipDurationSeconds,
  preRollSeconds = NATIVE_HYDRATION_PRE_ROLL_SECONDS,
  resetFadeSeconds = 0.6
) {
  if (
    !Number.isFinite(elapsedSeconds) ||
    !(clipDurationSeconds > 0 && preRollSeconds > resetFadeSeconds && resetFadeSeconds > 0)
  ) {
    throw new Error("native clip presentation timing is invalid");
  }
  const cycleDuration = preRollSeconds + clipDurationSeconds + resetFadeSeconds;
  const cycleElapsed = ((elapsedSeconds % cycleDuration) + cycleDuration) % cycleDuration;
  if (cycleElapsed < preRollSeconds) {
    return {
      phase: "hydration_pre_roll",
      cycleDuration,
      cycleElapsed,
      sampleTime: 0,
      opacity: smoothStep01(cycleElapsed / resetFadeSeconds),
    };
  }
  const clipElapsed = cycleElapsed - preRollSeconds;
  if (clipElapsed <= clipDurationSeconds) {
    return {
      phase: "wind_clip",
      cycleDuration,
      cycleElapsed,
      sampleTime: clipElapsed,
      opacity: 1,
    };
  }
  return {
    phase: "reset_fade",
    cycleDuration,
    cycleElapsed,
    sampleTime: clipDurationSeconds,
    opacity: 1 - smoothStep01((clipElapsed - clipDurationSeconds) / resetFadeSeconds),
  };
}

export function hairFiberColorAt(baseColor, strand, copy, rootFraction, target = {}) {
  const fraction = Math.max(0, Math.min(1, rootFraction));
  const variation = fatlineColorScale(strand, copy);
  const rootToTip = 0.72 + 0.3 * smoothStep01(fraction);
  target.r = Math.min(1, baseColor.r * variation * rootToTip * (1 + 0.08 * fraction));
  target.g = Math.min(1, baseColor.g * variation * rootToTip * (1 + 0.025 * fraction));
  target.b = Math.min(1, baseColor.b * variation * rootToTip * (1 - 0.035 * fraction));
  return target;
}

export function fiberEmergenceScaleAt(strand, copy, particle, activeSegments, rootNormalY = 0) {
  const fraction = Math.max(0, Math.min(1, particle / Math.max(1, activeSegments)));
  if (copy === 0) return smoothStep01(fraction / 0.085);
  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  const unsigned = hash >>> 0;
  const crown = smoothStep01((rootNormalY - 0.68) / 0.26);
  const start = (0.035 + (unsigned % 7) * 0.011) * (1 - crown * 0.58);
  const end = start + (0.12 + ((unsigned >>> 4) % 5) * 0.012) * (1 - crown * 0.42);
  return smoothStep01((fraction - start) / Math.max(0.001, end - start));
}

export function lockAwareFiberEmergenceScaleAt(
  strand,
  copy,
  particle,
  activeSegments,
  rootNormalY = 0
) {
  const fraction = Math.max(0, Math.min(1, particle / Math.max(1, activeSegments)));
  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  const unsigned = hash >>> 0;
  const crown = smoothStep01((rootNormalY - 0.68) / 0.26);
  const end =
    copy === 0 ? 0.055 - crown * 0.012 : (0.024 + (unsigned % 7) * 0.004) * (1 - crown * 0.3);
  const rootCoverage = copy === 0 ? 0.08 : 0.16;
  return rootCoverage + (1 - rootCoverage) * smoothStep01(fraction / Math.max(0.001, end));
}

export function reelCameraPoseAtStep(step, shot, loopSteps = 1020) {
  if (!Number.isFinite(step) || !(loopSteps > 0)) throw new Error("reel camera step is invalid");
  if (!["beauty", "control", "cut"].includes(shot)) return null;
  const cycleStep = ((step % loopSteps) + loopSteps) % loopSteps;
  const phase = cycleStep / loopSteps;
  let azimuth;
  let radius;
  let height;
  let targetHeight;
  if (shot === "beauty") {
    azimuth = 0.08 + 0.2 * Math.sin(phase * Math.PI * 2 - 0.5);
    radius = 6.15 - 0.42 * Math.sin(phase * Math.PI);
    height = 1.42 + 0.12 * Math.sin(phase * Math.PI * 2);
    targetHeight = 1.18;
  } else if (shot === "control") {
    azimuth = -0.24;
    radius = 6.35;
    height = 1.72;
    targetHeight = 1.42;
  } else {
    const cutProgress = smoothStep01((cycleStep - 285) / 105);
    azimuth = -0.22 + 0.5 * cutProgress;
    radius = 6.05 - 0.52 * cutProgress;
    height = 1.35 - 0.16 * cutProgress;
    targetHeight = 1.08 - 0.3 * cutProgress;
  }
  return {
    shot,
    cycleStep,
    position: [Math.sin(azimuth) * radius, height, Math.cos(azimuth) * radius],
    target: [0, targetHeight, 0],
  };
}

export function sectionPosePresentationAtStep(step, cycle) {
  if (!cycle) return { phase: "static_control", hydration: 1, tubeOpacity: 0.14 };
  const startStep = cycle.startStep ?? 30;
  const peakStep = cycle.peakStep ?? 90;
  const holdEndStep = cycle.holdEndStep ?? 170;
  const endStep = cycle.endStep ?? 255;
  const authorLeadSteps = Math.max(1, cycle.authorLeadSteps ?? 30);
  const authorStartStep = Math.max(0, startStep - authorLeadSteps);
  const fadeEndStep = Math.min(endStep, cycle.fadeEndStep ?? holdEndStep + 45);
  if (!(authorStartStep <= startStep && startStep < peakStep && peakStep <= holdEndStep)) {
    throw new Error("section pose presentation steps are invalid");
  }
  if (step < authorStartStep) return { phase: "waiting", hydration: 0.08, tubeOpacity: 0 };
  if (step < startStep) {
    return {
      phase: "authoring",
      hydration: 0.08,
      tubeOpacity:
        0.18 * smoothStep01((step - authorStartStep) / Math.max(1, startStep - authorStartStep)),
    };
  }
  if (step < peakStep) {
    const progress = smoothStep01((step - startStep) / (peakStep - startStep));
    return {
      phase: "hydrating",
      hydration: 0.08 + 0.92 * progress,
      tubeOpacity: 0.18 * (1 - 0.7 * progress),
    };
  }
  if (step < holdEndStep) return { phase: "hydrated", hydration: 1, tubeOpacity: 0.055 };
  if (step < fadeEndStep) {
    return {
      phase: "dissolving",
      hydration: 1,
      tubeOpacity: 0.055 * (1 - smoothStep01((step - holdEndStep) / (fadeEndStep - holdEndStep))),
    };
  }
  return { phase: "simulation", hydration: 1, tubeOpacity: 0 };
}

export function fatlineHalfWidthAt(
  particle,
  activeSegments,
  rootWidth = FATLINE_ROOT_HALF_WIDTH_PX,
  tipWidth = FATLINE_TIP_HALF_WIDTH_PX
) {
  const fraction = Math.max(0, Math.min(1, particle / Math.max(1, activeSegments)));
  return rootWidth + (tipWidth - rootWidth) * fraction;
}

export function fatlineColorScale(strand, copy) {
  let hash = Math.imul(strand + 1, 0x45d9f3b) ^ Math.imul(copy + 1, 0x27d4eb2d);
  hash ^= hash >>> 16;
  return 0.9 + ((hash >>> 0) % 21) / 100;
}

export function summarizeGeometryTimings(samples, warmupFrames = 60) {
  const measured = samples.slice(Math.min(warmupFrames, samples.length));
  if (measured.length === 0) {
    return { measured_frames: 0, max_ms: null, p99_ms: null, mean_ms: null };
  }
  const sorted = [...measured].sort((left, right) => left - right);
  const p99Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1);
  return {
    measured_frames: measured.length,
    max_ms: sorted.at(-1),
    p99_ms: sorted[p99Index],
    mean_ms: measured.reduce((sum, value) => sum + value, 0) / measured.length,
  };
}

export function float32BufferDigest(values, usedLength = values.length) {
  const view = new DataView(new ArrayBuffer(4));
  let hash = 0x811c9dc5;
  for (let index = 0; index < usedLength; index += 1) {
    view.setFloat32(0, values[index], false);
    for (let byte = 0; byte < 4; byte += 1) {
      hash ^= view.getUint8(byte);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
