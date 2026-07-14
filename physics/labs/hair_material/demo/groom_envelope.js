export const GROOM_ENVELOPE_FIELD_ID = "live_section_ellipse_boundary_v1";

const SECTION_COUNT = 8;
const GOLDEN_RATIO_CONJUGATE = 0.6180339887498949;
const PLASTIC_CONJUGATE = 0.7548776662466927;

const PROFILE_DEFINITIONS = {
  off: {
    label: "Guide curves only / no envelope",
    outwardRadius: 0,
    lateralRadius: 0,
    rootRadius: 0,
    fillStrength: 0,
  },
  salon_full: {
    label: "Salon full / bounded",
    outwardRadius: 0.34,
    lateralRadius: 0.27,
    rootRadius: 0.012,
    fillStrength: 0.74,
  },
  cinematic_mass: {
    label: "Cinematic mass / wide",
    outwardRadius: 0.52,
    lateralRadius: 0.42,
    rootRadius: 0.014,
    fillStrength: 0.86,
  },
  storybook_volume: {
    label: "Storybook volume / extra wide",
    outwardRadius: 0.76,
    lateralRadius: 0.6,
    rootRadius: 0.016,
    fillStrength: 0.94,
  },
};

// The side-part stays deliberately asymmetric. These are section-space multipliers,
// not a smooth spherical shell, so pushing the envelope wide does not make a helmet.
const SECTION_OUTWARD_MULTIPLIERS = Object.freeze([1.22, 1.14, 0.98, 0.86, 0.82, 0.96, 1.18, 1.34]);
const SECTION_LATERAL_MULTIPLIERS = Object.freeze([1.12, 1.2, 1.08, 0.92, 0.86, 0.98, 1.16, 1.28]);

export const GROOM_ENVELOPE_PROFILES = Object.freeze(
  Object.fromEntries(
    Object.entries(PROFILE_DEFINITIONS).map(([id, profile]) => [
      id,
      Object.freeze({ id, ...profile }),
    ])
  )
);

export const GROOM_ENVELOPE_PROFILE_ORDER = Object.freeze(Object.keys(GROOM_ENVELOPE_PROFILES));

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothStep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function resolveGroomEnvelopeProfile(profileId) {
  return GROOM_ENVELOPE_PROFILES[profileId] ?? GROOM_ENVELOPE_PROFILES.cinematic_mass;
}

export function groomEnvelopeRadiiAt(profileOrId, section, fraction, breadthScale = 1) {
  const profile =
    typeof profileOrId === "string"
      ? resolveGroomEnvelopeProfile(profileOrId)
      : (profileOrId ?? GROOM_ENVELOPE_PROFILES.cinematic_mass);
  if (!Number.isInteger(section) || section < 0 || section >= SECTION_COUNT) {
    throw new Error("groom envelope section must be between 0 and 7");
  }
  const scale = Math.max(0, Math.min(2.5, Number(breadthScale) || 0));
  const along = clamp01(fraction);
  if (profile.id === "off" || scale === 0) {
    return { outward: 0, lateral: 0, rootGate: 0, tipTaper: 0 };
  }

  // Preserve scalp placement and the authored part, then grow a broad shoulder.
  // Tips keep meaningful breadth instead of collapsing to a narrow rope bundle.
  const rootGate = smoothStep01((along - 0.035) / 0.235);
  const tipTaper = 1 - 0.35 * smoothStep01((along - 0.72) / 0.28);
  const shoulder = 0.88 + 0.22 * Math.sin(Math.PI * clamp01((along - 0.06) / 0.78));
  const rootRadius = profile.rootRadius * (1 - rootGate);
  return {
    outward:
      (rootRadius +
        profile.outwardRadius *
          SECTION_OUTWARD_MULTIPLIERS[section] *
          rootGate *
          tipTaper *
          shoulder) *
      scale,
    lateral:
      (rootRadius +
        profile.lateralRadius *
          SECTION_LATERAL_MULTIPLIERS[section] *
          rootGate *
          tipTaper *
          shoulder) *
      scale,
    rootGate,
    tipTaper,
  };
}

export function groomEnvelopeDiskSample(owner, copy, fiberCopies, section = 0, output = [0, 0]) {
  if (!Number.isInteger(owner) || owner < 0 || !Number.isInteger(copy) || copy < 0) {
    throw new Error("groom envelope sample indices must be non-negative integers");
  }
  if (!Number.isInteger(fiberCopies) || fiberCopies < 1) {
    throw new Error("groom envelope fiber count must be a positive integer");
  }
  if (copy === 0 || fiberCopies === 1) {
    output[0] = 0;
    output[1] = 0;
    return output;
  }
  const sequence = owner * Math.max(1, fiberCopies - 1) + copy - 1;
  const radialSequence = (sequence * GOLDEN_RATIO_CONJUGATE + section * 0.137) % 1;
  const angleSequence = (sequence * PLASTIC_CONJUGATE + section * 0.271) % 1;
  const radius = Math.sqrt(0.08 + radialSequence * 0.88);
  const angle = angleSequence * Math.PI * 2;
  output[0] = Math.cos(angle) * radius;
  output[1] = Math.sin(angle) * radius;
  return output;
}

export function boundGroomEnvelopeCoordinates(
  baseOutward,
  baseLateral,
  sampleOutward,
  sampleLateral,
  fillStrength,
  output = [0, 0]
) {
  let outward = baseOutward + sampleOutward * Math.max(0, fillStrength);
  let lateral = baseLateral + sampleLateral * Math.max(0, fillStrength);
  const inputRadius = Math.hypot(outward, lateral);
  const scale = inputRadius > 1 ? 1 / inputRadius : 1;
  outward *= scale;
  lateral *= scale;
  output[0] = outward;
  output[1] = lateral;
  return {
    coordinates: output,
    inputRadius,
    outputRadius: Math.min(1, inputRadius),
    clamped: inputRadius > 1,
  };
}

export function summarizeGroomEnvelope(profileOrId, breadthScale = 1) {
  const profile =
    typeof profileOrId === "string"
      ? resolveGroomEnvelopeProfile(profileOrId)
      : (profileOrId ?? GROOM_ENVELOPE_PROFILES.cinematic_mass);
  let minimumOutward = Number.POSITIVE_INFINITY;
  let maximumOutward = 0;
  let minimumLateral = Number.POSITIVE_INFINITY;
  let maximumLateral = 0;
  let outwardSum = 0;
  let lateralSum = 0;
  let samples = 0;
  for (let section = 0; section < SECTION_COUNT; section += 1) {
    for (let station = 1; station <= 32; station += 1) {
      const radii = groomEnvelopeRadiiAt(profile, section, station / 32, breadthScale);
      minimumOutward = Math.min(minimumOutward, radii.outward);
      maximumOutward = Math.max(maximumOutward, radii.outward);
      minimumLateral = Math.min(minimumLateral, radii.lateral);
      maximumLateral = Math.max(maximumLateral, radii.lateral);
      outwardSum += radii.outward;
      lateralSum += radii.lateral;
      samples += 1;
    }
  }
  return {
    field_identity: GROOM_ENVELOPE_FIELD_ID,
    profile_id: profile.id,
    profile_label: profile.label,
    breadth_scale: Math.max(0, Math.min(2.5, Number(breadthScale) || 0)),
    section_count: SECTION_COUNT,
    outward_radius_meters: {
      min: minimumOutward === Number.POSITIVE_INFINITY ? 0 : minimumOutward,
      mean: samples ? outwardSum / samples : 0,
      max: maximumOutward,
    },
    lateral_radius_meters: {
      min: minimumLateral === Number.POSITIVE_INFINITY ? 0 : minimumLateral,
      mean: samples ? lateralSum / samples : 0,
      max: maximumLateral,
    },
    normalized_boundary_radius: 1,
    root_contract: "exact_roots_then_smoothstep_3.5pct_to_27pct",
    tip_contract: "retain_65pct_body_radius_at_tip",
    physics_authority: "none_renderer_hydration_only",
  };
}
