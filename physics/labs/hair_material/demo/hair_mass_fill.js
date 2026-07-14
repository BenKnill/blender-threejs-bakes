export const HAIR_MASS_FILL_FIELD_ID = "layered_section_occupancy_v1";

const PROFILE_DEFINITIONS = {
  off: {
    label: "Fibers only / no interior mass",
    coreScale: 0,
    middleScale: 0,
    coreOpacity: 0,
    middleOpacity: 0,
    fiberOpacityScale: 1,
    minimumHalfWidthPixels: 0,
    ownerWidthScale: 1,
    clumpWidthScale: 1,
    microfiberWidthScale: 1,
    flyawayWidthScale: 1,
  },
  air_shell: {
    label: "Air shell / fine interior",
    coreScale: 0.42,
    middleScale: 0.68,
    coreOpacity: 0.045,
    middleOpacity: 0.022,
    fiberOpacityScale: 0.94,
    minimumHalfWidthPixels: 0.08,
    ownerWidthScale: 1.08,
    clumpWidthScale: 1,
    microfiberWidthScale: 0.78,
    flyawayWidthScale: 0.5,
  },
  studio_dense: {
    label: "Studio dense / layered body",
    coreScale: 0.52,
    middleScale: 0.78,
    coreOpacity: 0.22,
    middleOpacity: 0.09,
    fiberOpacityScale: 1.16,
    minimumHalfWidthPixels: 0.18,
    ownerWidthScale: 1.26,
    clumpWidthScale: 1.12,
    microfiberWidthScale: 0.86,
    flyawayWidthScale: 0.48,
  },
  cinematic_deep: {
    label: "Cinematic deep / opaque body",
    coreScale: 0.6,
    middleScale: 0.88,
    coreOpacity: 0.42,
    middleOpacity: 0.18,
    fiberOpacityScale: 1.32,
    minimumHalfWidthPixels: 0.32,
    ownerWidthScale: 1.46,
    clumpWidthScale: 1.28,
    microfiberWidthScale: 0.92,
    flyawayWidthScale: 0.42,
  },
  wet_compact: {
    label: "Wet compact / dark locks",
    coreScale: 0.44,
    middleScale: 0.66,
    coreOpacity: 0.38,
    middleOpacity: 0.08,
    fiberOpacityScale: 1.38,
    minimumHalfWidthPixels: 0.42,
    ownerWidthScale: 1.62,
    clumpWidthScale: 1.38,
    microfiberWidthScale: 0.58,
    flyawayWidthScale: 0.24,
  },
};

export const HAIR_MASS_FILL_PROFILES = Object.freeze(
  Object.fromEntries(
    Object.entries(PROFILE_DEFINITIONS).map(([id, profile]) => [
      id,
      Object.freeze({ id, ...profile }),
    ])
  )
);

export const HAIR_MASS_FILL_PROFILE_ORDER = Object.freeze(Object.keys(HAIR_MASS_FILL_PROFILES));

export const HAIR_MASS_SECTION_OPACITY = Object.freeze([1, 1, 1, 1, 0.62, 0, 0, 0.62]);

export function resolveHairMassFillProfile(profileId) {
  return HAIR_MASS_FILL_PROFILES[profileId] ?? HAIR_MASS_FILL_PROFILES.studio_dense;
}

export function hairMassDensityScale(value) {
  return Math.max(0, Math.min(2, Number(value) || 0));
}

export function hairMassLayerOpacity(profileOrId, layer, density = 1) {
  const profile =
    typeof profileOrId === "string"
      ? resolveHairMassFillProfile(profileOrId)
      : (profileOrId ?? HAIR_MASS_FILL_PROFILES.studio_dense);
  const base = layer === "core" ? profile.coreOpacity : profile.middleOpacity;
  return Math.max(0, Math.min(0.72, base * hairMassDensityScale(density)));
}

export function hairMassFamilyWidthScale(profileOrId, copy, copies, density = 1) {
  const profile =
    typeof profileOrId === "string"
      ? resolveHairMassFillProfile(profileOrId)
      : (profileOrId ?? HAIR_MASS_FILL_PROFILES.studio_dense);
  if (
    !Number.isInteger(copy) ||
    !Number.isInteger(copies) ||
    copies < 1 ||
    copy < 0 ||
    copy >= copies
  ) {
    throw new Error("hair mass family indices are invalid");
  }
  const clumpEnd = Math.max(2, Math.floor(copies * 0.29));
  const flyawayStart = Math.max(clumpEnd + 1, Math.floor(copies * 0.86));
  const familyScale =
    copy === 0
      ? profile.ownerWidthScale
      : copy < clumpEnd
        ? profile.clumpWidthScale
        : copy < flyawayStart
          ? profile.microfiberWidthScale
          : profile.flyawayWidthScale;
  const amount = hairMassDensityScale(density);
  return Math.max(0.12, 1 + (familyScale - 1) * amount);
}

export function hairMassMinimumHalfWidth(profileOrId, copy, copies, density = 1) {
  const profile =
    typeof profileOrId === "string"
      ? resolveHairMassFillProfile(profileOrId)
      : (profileOrId ?? HAIR_MASS_FILL_PROFILES.studio_dense);
  const amount = hairMassDensityScale(density);
  if (profile.minimumHalfWidthPixels <= 0 || amount <= 0) return 0;
  const familyScale = hairMassFamilyWidthScale(profile, copy, copies, amount);
  return profile.minimumHalfWidthPixels * (0.4 + 0.6 * amount) * familyScale;
}

export function summarizeHairMassFill(profileOrId, density = 1) {
  const profile =
    typeof profileOrId === "string"
      ? resolveHairMassFillProfile(profileOrId)
      : (profileOrId ?? HAIR_MASS_FILL_PROFILES.studio_dense);
  const resolvedDensity = hairMassDensityScale(density);
  return {
    field_identity: HAIR_MASS_FILL_FIELD_ID,
    profile_id: profile.id,
    profile_label: profile.label,
    density_scale: resolvedDensity,
    shell_layers: [
      {
        id: "core",
        envelope_radius_scale: profile.coreScale,
        opacity: hairMassLayerOpacity(profile, "core", resolvedDensity),
      },
      {
        id: "middle",
        envelope_radius_scale: profile.middleScale,
        opacity: hairMassLayerOpacity(profile, "middle", resolvedDensity),
      },
    ],
    fiber_opacity_scale: profile.fiberOpacityScale,
    minimum_half_width_pixels: profile.minimumHalfWidthPixels,
    family_width_scales: {
      owner: hairMassFamilyWidthScale(profile, 0, 21, resolvedDensity),
      clump: hairMassFamilyWidthScale(profile, 1, 21, resolvedDensity),
      microfiber: hairMassFamilyWidthScale(profile, 8, 21, resolvedDensity),
      flyaway: hairMassFamilyWidthScale(profile, 20, 21, resolvedDensity),
    },
    family_minimum_half_width_pixels: {
      owner: hairMassMinimumHalfWidth(profile, 0, 21, resolvedDensity),
      clump: hairMassMinimumHalfWidth(profile, 1, 21, resolvedDensity),
      microfiber: hairMassMinimumHalfWidth(profile, 8, 21, resolvedDensity),
      flyaway: hairMassMinimumHalfWidth(profile, 20, 21, resolvedDensity),
    },
    section_opacity_multipliers: HAIR_MASS_SECTION_OPACITY,
    front_section_contract: "sections_5_and_6_have_zero_shell_opacity_and_width_floor",
    physics_authority: "none_renderer_hydration_only",
  };
}
