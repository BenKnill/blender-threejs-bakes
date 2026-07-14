export const CURATED_HAIR_SCENE_FIELD_ID = "three_authored_hair_scenes_v1";

const COMMON_PARAMETERS = Object.freeze({
  physicsClip: "box3d-scalp-256",
  showcase: "1",
  groomHydration: "1",
  hydrationTour: "0",
  guides: "256",
  iterations: "6",
  preset: "wavy",
  hairRender: "fatline",
  hairShade: "fiber",
  fibers: "21",
  groomVolume: "1",
  rootField: "styled-side-part",
  rootStrength: "0.22",
  faceClear: "1",
  mannequin: "realistic",
  renderReceipt: "1",
});

function scene(id, title, description, cue, parameters) {
  return Object.freeze({
    id,
    title,
    description,
    cue,
    parameters: Object.freeze({ ...COMMON_PARAMETERS, ...parameters }),
  });
}

export const CURATED_HAIR_SCENES = Object.freeze([
  scene(
    "rig-becomes-hair",
    "Rig Becomes Hair",
    "Uniform Box3D rods become groom volumes, locks, and a bounded chestnut mass.",
    "mechanics → hydration",
    {
      hydrationRecipe: "natural-balanced",
      hydrationGeometry: "balanced-full",
      hydrationOptical: "artist-dual",
      hydrationColor: "chestnut",
      hydrationDetail: "natural-variation",
      groomEnvelope: "cinematic-mass",
      envelopeScale: "1.25",
      massFill: "cinematic-deep",
      massDensity: "1.25",
      wetness: "0.35",
      product: "0.45",
      reel: "control",
      nativeStart: "0",
      scenario: "curated-rig-becomes-hair",
    }
  ),
  scene(
    "copper-gale",
    "Copper Gale",
    "A warm, wide copper groom begins fully hydrated as the strong breeze circles once.",
    "strong 360° orbit",
    {
      hydrationRecipe: "glossy-cinematic",
      hydrationGeometry: "balanced-full",
      hydrationOptical: "artist-dual",
      hydrationColor: "copper",
      hydrationDetail: "soft-wave",
      groomEnvelope: "storybook-volume",
      envelopeScale: "1.1",
      massFill: "cinematic-deep",
      massDensity: "1.45",
      wetness: "0.2",
      product: "0.35",
      reel: "beauty",
      nativeStart: "22.5",
      scenario: "curated-copper-gale",
    }
  ),
  scene(
    "after-the-rain",
    "After the Rain",
    "Compact near-black locks carry a quieter, cohesive response through the moderate orbit.",
    "moderate 360° orbit",
    {
      hydrationRecipe: "wet-clumped",
      hydrationGeometry: "wet-locks",
      hydrationOptical: "near-field-proxy",
      hydrationColor: "deep-ebony",
      hydrationDetail: "wet-grouped",
      groomEnvelope: "salon-full",
      envelopeScale: "1.1",
      massFill: "wet-compact",
      massDensity: "1.6",
      wetness: "0.85",
      product: "0.65",
      reel: "cut",
      nativeStart: "28.5",
      scenario: "curated-after-the-rain",
    }
  ),
]);

export const CURATED_HAIR_SCENE_ORDER = Object.freeze(
  CURATED_HAIR_SCENES.map((candidate) => candidate.id)
);

export function resolveCuratedHairScene(sceneId) {
  return CURATED_HAIR_SCENES.find((candidate) => candidate.id === sceneId) ?? null;
}

export function nextCuratedHairSceneId(sceneId) {
  const index = CURATED_HAIR_SCENE_ORDER.indexOf(sceneId);
  return CURATED_HAIR_SCENE_ORDER[
    (index + 1 + CURATED_HAIR_SCENE_ORDER.length) % CURATED_HAIR_SCENE_ORDER.length
  ];
}

export function curatedHairSceneParameters(sceneOrId) {
  const resolved = typeof sceneOrId === "string" ? resolveCuratedHairScene(sceneOrId) : sceneOrId;
  if (!resolved) throw new Error(`unknown curated hair scene: ${sceneOrId}`);
  return new URLSearchParams(Object.entries(resolved.parameters));
}
