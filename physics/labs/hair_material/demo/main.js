import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { loadBox3dGuideClip, sampleQuantizedGuideClip } from "./box3d_clip.js?v=125";
import { HairSolver } from "./solver.js?v=124";
import {
  advanceHairReplay,
  COMB_MATERIAL_CONDITIONS,
  createReplayState,
  digestHairState,
  PREVIEW_WIND_PROGRAM,
  PREVIEW_WIND_PROGRAM_ID,
  previewWindProgramAtStep,
  resolvePreviewWindMagnitudes,
  summarizeCombReceipt,
} from "./replay.js?v=114";
import {
  buildUndercoatCoverageProfile,
  buildRootCoverageCurve,
  blendRootCoverageFlow,
  catmullRomScalar,
  FATLINE_ROOT_HALF_WIDTH_PX,
  fatlineHalfWidthAt,
  fiberEmergenceScaleAt,
  float32BufferDigest,
  fullGroomHydrationAtStep,
  FULL_GROOM_HYDRATION_ID,
  HAIR_BREADTH_TOUR,
  HAIR_BREADTH_TOUR_ORDER,
  HAIR_COLOR_PROFILES,
  HAIR_DETAIL_PROFILES,
  HAIR_GEOMETRY_PROFILES,
  HAIR_HYDRATION_BREADTH_ID,
  HAIR_HYDRATION_COMPOSITION_COUNT,
  HAIR_HYDRATION_RECIPE_ID,
  HAIR_HYDRATION_RECIPE_ORDER,
  HAIR_OPTICAL_MODELS,
  hairFiberColorAt,
  HAIR_FIBER_SHADING_ID,
  HAIR_PRESENTATION_LOOP_ID,
  LOCK_AWARE_COVERAGE_ID,
  lockAwareFiberEmergenceScaleAt,
  LOCK_AWARE_RENDER_SUBDIVISIONS,
  LOCK_AWARE_ROOT_COVER_LENGTH_METERS,
  LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT,
  LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT,
  LOCK_AWARE_ROOT_COVER_PROBE_PARTICLE,
  LOCK_AWARE_ROOT_COVER_SEGMENTS,
  hydrationFiberFamilyScale,
  hydrationRecipe,
  hydrationRecipeSelection,
  hydrationRecipeWidthScaleAt,
  hydrationSelectionAtStep,
  nativeClipPresentationAtTime,
  NATIVE_HYDRATION_PRE_ROLL_SECONDS,
  physicsSkeletonDepthWriteAt,
  PHYSICS_SKELETON_STYLE,
  PHYSICS_SKELETON_STYLE_ID,
  presentationLoopOpacityAtStep,
  reelCameraPoseAtStep,
  REEL_CAMERA_FIELD_ID,
  resolveHairHydrationState,
  rootCoverageFiberCopies,
  sectionPosePresentationAtStep,
  summarizeGeometryTimings,
} from "./rendering.js?v=132";
import {
  buildGroomInterpolationBindings,
  groomDonorShapeTransferAt,
  groomBindingActiveSegments,
  groomBindingDigest,
  groomInterpolationReceipt,
  groomSecondaryWeightAt,
  interpolateGroomScalar,
  PATCH_LOCK_CONVERGENCE_END,
  PATCH_LOCK_CONVERGENCE_START,
  PATCH_LOCK_FIELD_ID,
  PATCH_LOCK_LATERAL_RADIUS_METERS,
  PATCH_LOCK_OUTWARD_RADIUS_METERS,
  transportGroomPoint,
} from "./groom_interpolation.js?v=118";
import {
  GROOM_ENVELOPE_PROFILES,
  GROOM_ENVELOPE_PROFILE_ORDER,
  groomEnvelopeDiskSample,
  groomEnvelopeRadiiAt,
  resolveGroomEnvelopeProfile,
  summarizeGroomEnvelope,
} from "./groom_envelope.js?v=1";
import {
  HAIR_MASS_FILL_PROFILES,
  HAIR_MASS_FILL_PROFILE_ORDER,
  HAIR_MASS_SECTION_OPACITY,
  hairMassFamilyWidthScale,
  hairMassLayerOpacity,
  hairMassMinimumHalfWidth,
  resolveHairMassFillProfile,
  summarizeHairMassFill,
} from "./hair_mass_fill.js?v=2";
import {
  CURATED_HAIR_SCENE_FIELD_ID,
  CURATED_HAIR_SCENES,
  curatedHairSceneParameters,
  nextCuratedHairSceneId,
  resolveCuratedHairScene,
} from "./curated_scenes.js?v=2";
import {
  AUTHORED_GROOM_FIELD_ID,
  AUTHORED_GROOM_LATERAL_RADIUS_METERS,
  AUTHORED_GROOM_OUTWARD_RADIUS_METERS,
  AUTHORED_ROOT_EMERGENCE_RANGE_METERS,
  AUTHORED_ROOT_HANDOFF_FRACTION,
  AUTHORED_ROOT_HANDOFF_STATION_FRACTION,
  AUTHORED_ROOT_LAYDOWN_FIELD_ID,
  AUTHORED_ROOT_LAYDOWN_RANGE_METERS,
  authoredGroomCrossSectionScaleAt,
  authoredGroomDisplacementTransferAt,
  authoredGroomLaydownDisplacementTransferAt,
  authoredGroomLaydownRestPoint,
  authoredGroomLaydownSampleFractionAt,
  authoredGroomRestPoint,
} from "./authored_groom.js?v=1";
import {
  HAIRLINE_FLOW_FIELD_ID,
  HAIRLINE_FLOW_SURFACE_FRACTION,
  HAIRLINE_FLOW_SURFACE_LENGTH_METERS,
  authoredHairlineFlowRestPoint,
} from "./hairline_flow.js?v=1";
import {
  SPARSE_GROOM_CAGE_ID,
  SPARSE_GROOM_CORRELATED_HIERARCHY_ID,
  SPARSE_GROOM_OCCUPANCY_REMAP_ID,
  SPARSE_GROOM_CORE_WIDTH_FIELD_ID,
  SPARSE_GROOM_HEROES,
  sparseGroomCorrelatedResidual,
  sparseGroomCoreBodyWidthMultiplier,
  sparseGroomHeroForRoot,
  sparseGroomOffsetRetentionAt,
  sparseGroomOccupancyRemap,
  sparseGroomRestPoint,
  sparseGroomSublockPhase,
  sparseGroomWidthMultiplierAt,
} from "./sparse_groom_cage.js?v=1";
import {
  buildIndependentDisplayFollicles,
  DISPLAY_FOLLICLE_LAYOUT_ID,
} from "./display_follicles.js?v=1";
import {
  LAYERED_HAIRCUT_FIELD_ID,
  LAYERED_HAIRCUT_ZONE_NAMES,
  layeredHaircutSample,
  layeredHaircutTipWidthScaleAt,
} from "./layered_haircut.js?v=1";
import {
  LOCK_LAMINAE_FIELD_ID,
  buildLockLaminaAssignments,
  lockLaminaHalfWidthAt,
  lockLaminaOffset,
  lockLaminaOverlapRatioAt,
  summarizeLockLaminaAssignments,
} from "./lock_laminae.js?v=1";
import {
  projectPointToScalpShell,
  scalpPolarLimit,
  SCALP_CENTER,
  SCALP_LAYOUT_ID,
  SCALP_RADII,
  SCALP_ROOT_PROJECTION_ID,
  SCALP_ROOT_OFFSET,
} from "./scalp_layout.js?v=116";

let renderFibersPerGuide = 9;
let hairRenderMode = "lines";
let groomMode = "radial_xz";
let groomBindings = null;
let groomBindingBuildCount = 0;
let patchLockEnabled = false;
let patchDebugColors = false;
let authoredRestGroomEnabled = false;
let authoredDebugColors = false;
let authoredLaydownEnabled = false;
let authoredRootZoneColors = false;
let hairlineFlowEnabled = false;
let sparseGroomCageEnabled = false;
let sparseGroomCageColors = false;
let sparseGroomHeroByGuide = new Uint8Array(0);
let independentDisplayFolliclesEnabled = false;
let displayFollicleGuideColors = false;
let displayFollicleRootDiagnostic = false;
let correlatedRestHierarchyEnabled = false;
let sublockPhaseColors = false;
const correlatedResidualScratch = new Float64Array(3);
let maximumCorrelatedResidual = 0;
let occupancyRemapEnabled = false;
const occupancyRemapScratch = new Float64Array(3);
let maximumOccupancyRemap = 0;
let occupancyCoreTelemetryCache = null;
let coreWidthHierarchyEnabled = false;
let coreWidthDiagnostic = false;
let layeredHaircutEnabled = false;
let layeredHaircutDiagnostic = false;
let lockLaminaeEnabled = false;
let lockLaminaeDiagnostic = false;
const lockLaminaOffsetScratch = new Float64Array(3);
let maximumLockLaminaRootDisplacement = 0;
let rootDirectorMode = "free";
let rootDirectorStrength = 0.22;
let faceClearGroomEnabled = true;
let renderReceiptEnabled = false;
let sectionControlTubeEnabled = false;
let fullGroomHydrationEnabled = false;
let hairShadingMode = "fiber_lobes";
let hydrationRecipeId = "natural_balanced";
let hydrationGeometryId = "balanced_full";
let hydrationOpticalId = "artist_dual";
let hydrationColorId = "chestnut";
let hydrationDetailId = "natural_variation";
let groomEnvelopeId = "cinematic_mass";
let groomEnvelopeScale = 1.25;
let hairMassFillId = "cinematic_deep";
let hairMassDensity = 1.25;
let activeHydrationSelection = hydrationRecipeSelection(hydrationRecipeId);
let activeHydrationState = resolveHairHydrationState(activeHydrationSelection);
let hydrationTourEnabled = true;
let presentationLoopEnabled = false;
let presentationLoopRestarts = 0;
let mannequinMode = "primitive";
let mannequinStatus = "primitive_ready";
let heroMannequin;
let reelShot = "free";
let activeCuratedScene = null;
const nativeClipPlayback = {
  enabled: false,
  asset: null,
  clip: null,
  elapsed: 0,
  sampleTime: 0,
  presentationPhase: "loading",
  opacity: 1,
  restarts: 0,
  loopStartSeconds: 0,
  error: null,
};
const NATIVE_CLIP_RESET_FADE_SECONDS = 0.6;
const PRESENTATION_LOOP_END_STEP = PREVIEW_WIND_PROGRAM.loopEndStep;
const FATLINE_DYNAMIC_ATTRIBUTES = Object.freeze([
  "instanceStart",
  "instanceEnd",
  "instanceColor",
  "instanceWidthStart",
  "instanceWidthEnd",
]);

const viewport = document.querySelector("#viewport");
const status = document.querySelector("#status");
const cutCursor = document.querySelector("#cut-cursor");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setAnimationLoop(animate);
viewport.append(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080913, 0.045);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 100);
camera.position.set(0.2, 1.3, 7.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.7, 0);
controls.enableDamping = true;
controls.minDistance = 3.6;
controls.maxDistance = 11;

scene.add(new THREE.HemisphereLight(0x8da8ff, 0x1a0711, 2.0));
const key = new THREE.DirectionalLight(0xffa0ad, 3.8);
key.position.set(4, 6, 5);
scene.add(key);
const rim = new THREE.PointLight(0x477dff, 45, 12);
rim.position.set(-3, 1, 3);
scene.add(rim);
const physicsKey = new THREE.DirectionalLight(0xdffcff, 0);
physicsKey.position.set(-4, 5, 6);
scene.add(physicsKey);
const physicsFill = new THREE.PointLight(0x63e6ff, 0, 10);
physicsFill.position.set(3, 1.8, 4);
scene.add(physicsFill);

const porcelain = new THREE.MeshStandardMaterial({
  color: 0xb77569,
  roughness: 0.42,
  metalness: 0.03,
});
const primitiveHeadGroup = new THREE.Group();
scene.add(primitiveHeadGroup);
const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), porcelain);
head.scale.set(0.9, 1.12, 0.82);
head.position.set(0, 1.35, 0);
primitiveHeadGroup.add(head);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 1.3, 32), porcelain);
neck.position.set(0, -0.03, 0);
primitiveHeadGroup.add(neck);
const bustMaterial = new THREE.MeshStandardMaterial({
  color: 0x172452,
  roughness: 0.68,
  transparent: true,
});
const bust = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), bustMaterial);
bust.scale.set(2.15, 0.58, 0.86);
bust.position.set(0, -0.9, 0.12);
scene.add(bust);
for (const x of [-0.31, 0.31]) {
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x12090d, roughness: 0.2 })
  );
  eye.position.set(x, 1.56, 0.77);
  primitiveHeadGroup.add(eye);
}

const mannequinLoader = new GLTFLoader();
const heroSkinMaterial = new THREE.MeshStandardMaterial({
  color: 0xb96f5f,
  roughness: 0.58,
  metalness: 0,
});
const heroScleraMaterial = new THREE.MeshStandardMaterial({
  color: 0xe9d8cf,
  roughness: 0.42,
  metalness: 0,
});
const heroIrisMaterial = new THREE.MeshStandardMaterial({
  color: 0x263d48,
  roughness: 0.28,
  metalness: 0,
});

function showLoadedMannequin() {
  primitiveHeadGroup.visible = mannequinMode !== "realistic" || !heroMannequin;
  if (heroMannequin) heroMannequin.visible = mannequinMode === "realistic";
}

function loadRealisticMannequin() {
  if (heroMannequin) {
    mannequinStatus = "realistic_ready";
    showLoadedMannequin();
    return;
  }
  if (mannequinStatus === "realistic_loading") {
    showLoadedMannequin();
    return;
  }
  mannequinStatus = "realistic_loading";
  mannequinLoader.load(
    "./assets/realistic-head-animation.glb",
    (gltf) => {
      heroMannequin = gltf.scene;
      heroMannequin.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        const name = object.name.toLowerCase();
        object.material = name.includes("iris")
          ? heroIrisMaterial
          : name.includes("sclera")
            ? heroScleraMaterial
            : heroSkinMaterial;
      });
      const sourceBox = new THREE.Box3().setFromObject(heroMannequin);
      const sourceSize = sourceBox.getSize(new THREE.Vector3());
      const scale = 2.55 / Math.max(0.001, sourceSize.y);
      heroMannequin.scale.setScalar(scale);
      heroMannequin.updateMatrixWorld(true);
      const fittedBox = new THREE.Box3().setFromObject(heroMannequin);
      const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
      heroMannequin.position.set(-fittedCenter.x, 1.18 - fittedCenter.y, -fittedCenter.z);
      scene.add(heroMannequin);
      mannequinStatus = mannequinMode === "realistic" ? "realistic_ready" : "primitive_ready";
      showLoadedMannequin();
    },
    undefined,
    () => {
      if (mannequinMode !== "realistic") {
        mannequinStatus = "primitive_ready";
        showLoadedMannequin();
        return;
      }
      mannequinStatus = "realistic_failed_primitive_fallback";
      mannequinMode = "primitive";
      document.querySelector("#mannequin").value = "primitive";
      showLoadedMannequin();
      status.textContent = "CC0 hero head failed to load; restored the primitive mannequin.";
    }
  );
}

function setMannequinMode(mode) {
  mannequinMode = mode === "realistic" ? "realistic" : "primitive";
  if (mannequinMode === "realistic") loadRealisticMannequin();
  else {
    mannequinStatus = "primitive_ready";
    showLoadedMannequin();
  }
}

const guideLine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.75, -0.12, 0.92),
    new THREE.Vector3(1.75, -0.12, 0.92),
  ]),
  new THREE.LineDashedMaterial({ color: 0xff6f91, dashSize: 0.09, gapSize: 0.055 })
);
guideLine.computeLineDistances();
scene.add(guideLine);

const comb = new THREE.Group();
const combMaterial = new THREE.MeshStandardMaterial({
  color: 0x63e6ff,
  emissive: 0x0b3951,
  roughness: 0.24,
  metalness: 0.5,
});
const combSpine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.75), combMaterial);
combSpine.position.y = 1.42;
comb.add(combSpine);
for (let tooth = 0; tooth < 13; tooth += 1) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.65, 0.045), combMaterial);
  mesh.position.set(0, 0.56, -0.72 + tooth * 0.12);
  comb.add(mesh);
}
comb.visible = false;
scene.add(comb);

const windCompass = new THREE.Group();
const windRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.45, 0.012, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0x63e6ff, transparent: true, opacity: 0.32 })
);
windRing.rotation.x = Math.PI * 0.5;
windCompass.add(windRing);
const windArrow = new THREE.ArrowHelper(
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, 0),
  1.35,
  0x63e6ff,
  0.24,
  0.14
);
windCompass.add(windArrow);
windCompass.position.y = 2.95;
windCompass.visible = false;
scene.add(windCompass);

const windStreakCount = 36;
const windStreakPositions = new Float32Array(windStreakCount * 2 * 3);
const windStreaks = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.BufferAttribute(windStreakPositions, 3)
  ),
  new THREE.LineBasicMaterial({ color: 0x63e6ff, transparent: true, opacity: 0.38 })
);
windStreaks.visible = false;
scene.add(windStreaks);

let solver;
let hair;
let hairUndercoat;
let hairUndercoatCoverageProfile = null;
const lockCurvePoints = new Float64Array(12);
const lockRootCoveragePoints = new Float64Array(12);
const lockRootCoverageProbe = new Float64Array(3);
const lockRootCoverageFlow = new Float64Array(3);
const LOCK_ROOT_COVER_WIDTH_PROFILE = Object.freeze([0.56, 0.46, 0.34, 0.24]);
const LOCK_UNDERCOAT_LAYER_OPACITIES = Object.freeze([0.5, 0.16, 0.05]);
let hairPositions;
let hairDrawCount = 0;
let hairGeometryTimings = [];
let hydrationDetailOffsets = new Float32Array();
let hydrationDetailOffsetCacheKey = "";
let hydrationFamilyScales = new Float32Array();
let sectionControlTube;
let sectionControlTubeTimings = [];
let groomEnvelopeBoundaryMeshes = [];
let groomEnvelopeBoundaryTimings = [];
let hairMassMeshes = [];
let hairMassGeometryTimings = [];
let hairMassAlphaTextures = null;
let groomEnvelopeCenters = new Float64Array();
let groomEnvelopeTangents = new Float64Array();
let groomEnvelopeOutwards = new Float64Array();
let groomEnvelopeLaterals = new Float64Array();
let groomOwnerTangents = new Float64Array();
let groomOwnerOutwards = new Float64Array();
let groomOwnerLaterals = new Float64Array();
let groomPatchCenters = new Float64Array();
let groomPatchTangents = new Float64Array();
let groomPatchOutwards = new Float64Array();
let groomPatchLaterals = new Float64Array();
let groomPatchFrameCounts = new Uint16Array();
let patchLockTelemetry = null;
let authoredRestCenters = new Float64Array();
let authoredLiveCenters = new Float64Array();
let authoredMechanicalReference = new Float64Array();
let authoredTangents = new Float64Array();
let authoredOutwards = new Float64Array();
let authoredLaterals = new Float64Array();
let displayFollicleRestCenters = new Float64Array();
let authoredReferenceReady = false;
let authoredTopologyDigest = null;
let groomEnvelopeSamples = new Float32Array();
let groomEnvelopeCurvePointCache = new Float64Array();
let groomEnvelopeFrameCounts = new Uint16Array();
let groomEnvelopeClampedPoints = 0;
let groomEnvelopeProjectedPoints = 0;
let groomEnvelopeMaximumOutputRadius = 0;
let groomEnvelopeFaceClearCorrections = 0;
let groomEnvelopeFaceClearMaximumDistance = 0;
const groomEnvelopeSampleScratch = new Float64Array(2);
let sectionPresentation = { phase: "off", hydration: 1, tubeOpacity: 0 };
let fullGroomPresentation = {
  phase: "hair_only",
  stageProgress: 1,
  hairHydration: 1,
  guideOpacity: 0,
  tubeOpacity: 0,
  populationFraction: 1,
  widthScale: 1,
  shadingMix: 1,
  undercoatHydration: 1,
  ownerHydration: 1,
  clumpHydration: 1,
  microfiberHydration: 1,
  flyawayHydration: 1,
  auditionStateId: null,
};
let physicsGuideCage;
let physicsJointMesh;
let physicsGuidePositions = new Float32Array();
let physicsGuideCageTimings = [];
let physicsSkeletonGuides = [];
const SECTION_CONTROL_TUBE_RADIAL_SEGMENTS = 10;
const GROOM_ENVELOPE_SECTION_COUNT = 8;
const GROOM_ENVELOPE_RADIAL_SEGMENTS = 14;
const HAIR_MASS_RADIAL_SEGMENTS = 20;
const GROOM_ENVELOPE_FACE_CLEAR_ID = "front_aperture_display_projection_v1";
const GROOM_ENVELOPE_PART_X = -0.18;
const SECTION_CONTROL_TUBE_COLOR = new THREE.Color(0x63e6ff);
const PHYSICS_CAGE_SECTION_COLORS = Object.freeze([
  0x63e6ff, 0x9b87ff, 0xe879f9, 0xfb7185, 0xfbbf24, 0x86efac, 0x22d3ee, 0xc4b5fd,
]);
const physicsRodStart = new THREE.Vector3();
const physicsRodEnd = new THREE.Vector3();

function setHydrationSelection(selection, syncControls = true) {
  hydrationGeometryId = HAIR_GEOMETRY_PROFILES[selection.geometryId]
    ? selection.geometryId
    : "balanced_full";
  hydrationOpticalId = HAIR_OPTICAL_MODELS[selection.opticalId]
    ? selection.opticalId
    : "artist_dual";
  hydrationColorId = HAIR_COLOR_PROFILES[selection.colorId] ? selection.colorId : "chestnut";
  hydrationDetailId = HAIR_DETAIL_PROFILES[selection.detailId]
    ? selection.detailId
    : "natural_variation";
  activeHydrationSelection = {
    geometryId: hydrationGeometryId,
    opticalId: hydrationOpticalId,
    colorId: hydrationColorId,
    detailId: hydrationDetailId,
  };
  activeHydrationState = resolveHairHydrationState(activeHydrationSelection);
  if (!syncControls) return;
  document.querySelector("#hydration-geometry").value = hydrationGeometryId;
  document.querySelector("#hydration-optical").value = hydrationOpticalId;
  document.querySelector("#hydration-color").value = hydrationColorId;
  document.querySelector("#hydration-detail").value = hydrationDetailId;
}

function setHydrationRecipe(recipeId, syncControls = true) {
  hydrationRecipeId = hydrationRecipe(recipeId).id;
  setHydrationSelection(hydrationRecipeSelection(hydrationRecipeId), syncControls);
  if (syncControls) document.querySelector("#hydration-recipe").value = hydrationRecipeId;
}

function ensureHydrationDetailOffsets() {
  const cacheKey = `${solver.guideCount}:${solver.segments}:${renderFibersPerGuide}:${activeHydrationState.detail.id}`;
  if (cacheKey === hydrationDetailOffsetCacheKey) return;
  const particlesPerGuide = solver.segments + 1;
  const stride = renderFibersPerGuide * particlesPerGuide;
  hydrationDetailOffsets = new Float32Array(solver.guideCount * stride * 3);
  const detail = activeHydrationState.detail;
  const flyawayStart = Math.max(2, Math.floor(renderFibersPerGuide * 0.86));
  for (let owner = 0; owner < solver.guideCount; owner += 1) {
    const normalOffset = owner * 3;
    const nx = solver.rootNormals[normalOffset];
    const ny = solver.rootNormals[normalOffset + 1];
    const nz = solver.rootNormals[normalOffset + 2];
    const horizontalLength = Math.hypot(nx, nz) || 1;
    const tangentX = -nz / horizontalLength;
    const tangentZ = nx / horizontalLength;
    const binormalX = ny * tangentZ;
    const binormalY = nz * tangentX - nx * tangentZ;
    const binormalZ = -ny * tangentX;
    for (let copy = 0; copy < renderFibersPerGuide; copy += 1) {
      const phase = owner * 1.61803398875 + copy * 2.39996322973;
      const flyawayVariation = 0.72 + 0.28 * Math.sin(phase * 5.7);
      for (let particle = 1; particle <= solver.segments; particle += 1) {
        const fraction = particle / solver.segments;
        const rootFade = fraction * fraction * (3 - 2 * fraction);
        const curlAngle = phase + fraction * detail.curlFrequency * Math.PI * 2;
        const curlOffset = detail.curlAmplitude * rootFade;
        const frizz =
          detail.frizzAmplitude *
          rootFade *
          Math.sin(phase * 3.1 + fraction * 43.7 + Math.sin(fraction * 17.3 + phase));
        const flyaway =
          copy >= flyawayStart
            ? detail.flyawayAmplitude * Math.pow(fraction, 1.35) * flyawayVariation
            : 0;
        const tangentOffset = Math.cos(curlAngle) * curlOffset + frizz + flyaway;
        const binormalOffset = Math.sin(curlAngle) * curlOffset + frizz * 0.48 - flyaway * 0.32;
        const offset = (owner * stride + copy * particlesPerGuide + particle) * 3;
        hydrationDetailOffsets[offset] = tangentX * tangentOffset + binormalX * binormalOffset;
        hydrationDetailOffsets[offset + 1] = binormalY * binormalOffset + ny * flyaway * 0.18;
        hydrationDetailOffsets[offset + 2] = tangentZ * tangentOffset + binormalZ * binormalOffset;
      }
    }
  }
  hydrationDetailOffsetCacheKey = cacheKey;
}

function activeGroomEnvelopeScale() {
  return groomEnvelopeScale * (activeHydrationState.geometry.envelopeScale ?? 1);
}

function ensureGroomEnvelopeStorage() {
  const stations = solver.segments + 1;
  const frameValues = GROOM_ENVELOPE_SECTION_COUNT * stations * 3;
  const frameCount = GROOM_ENVELOPE_SECTION_COUNT * stations;
  if (groomEnvelopeCenters.length !== frameValues) {
    groomEnvelopeCenters = new Float64Array(frameValues);
    groomEnvelopeTangents = new Float64Array(frameValues);
    groomEnvelopeOutwards = new Float64Array(frameValues);
    groomEnvelopeLaterals = new Float64Array(frameValues);
    groomEnvelopeFrameCounts = new Uint16Array(frameCount);
  }
  const ownerFrameValues = solver.guideCount * stations * 3;
  if (groomOwnerTangents.length !== ownerFrameValues) {
    groomOwnerTangents = new Float64Array(ownerFrameValues);
    groomOwnerOutwards = new Float64Array(ownerFrameValues);
    groomOwnerLaterals = new Float64Array(ownerFrameValues);
  }
  const patchFrameValues = (groomBindings?.patchCount ?? 0) * stations * 3;
  const patchFrameCount = (groomBindings?.patchCount ?? 0) * stations;
  if (groomPatchCenters.length !== patchFrameValues) {
    groomPatchCenters = new Float64Array(patchFrameValues);
    groomPatchTangents = new Float64Array(patchFrameValues);
    groomPatchOutwards = new Float64Array(patchFrameValues);
    groomPatchLaterals = new Float64Array(patchFrameValues);
    groomPatchFrameCounts = new Uint16Array(patchFrameCount);
  }
  const sampleCount = solver.guideCount * renderFibersPerGuide * 2;
  if (groomEnvelopeSamples.length !== sampleCount) {
    groomEnvelopeSamples = new Float32Array(sampleCount);
    for (let owner = 0; owner < solver.guideCount; owner += 1) {
      const section = solver.guideSections[owner] % GROOM_ENVELOPE_SECTION_COUNT;
      for (let copy = 0; copy < renderFibersPerGuide; copy += 1) {
        groomEnvelopeDiskSample(
          owner,
          copy,
          renderFibersPerGuide,
          section,
          groomEnvelopeSampleScratch
        );
        const sample = (owner * renderFibersPerGuide + copy) * 2;
        groomEnvelopeSamples[sample] = groomEnvelopeSampleScratch[0];
        groomEnvelopeSamples[sample + 1] = groomEnvelopeSampleScratch[1];
      }
    }
  }
}

function updateGroomEnvelopeFrames() {
  ensureGroomEnvelopeStorage();
  groomEnvelopeCenters.fill(0);
  groomEnvelopeFrameCounts.fill(0);
  const stations = solver.segments + 1;
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    const section = solver.guideSections[guide] % GROOM_ENVELOPE_SECTION_COUNT;
    for (let particle = 0; particle <= solver.activeSegments[guide]; particle += 1) {
      const source = solver.index(guide, particle);
      const frame = (section * stations + particle) * 3;
      const count = section * stations + particle;
      groomEnvelopeCenters[frame] += solver.positions[source];
      groomEnvelopeCenters[frame + 1] += solver.positions[source + 1];
      groomEnvelopeCenters[frame + 2] += solver.positions[source + 2];
      groomEnvelopeFrameCounts[count] += 1;
    }
  }

  for (let section = 0; section < GROOM_ENVELOPE_SECTION_COUNT; section += 1) {
    let referenceX = 0;
    let referenceY = 0;
    let referenceZ = 0;
    for (let guide = 0; guide < solver.guideCount; guide += 1) {
      if (solver.guideSections[guide] % GROOM_ENVELOPE_SECTION_COUNT !== section) continue;
      const normal = guide * 3;
      referenceX += solver.rootNormals[normal];
      referenceY += solver.rootNormals[normal + 1];
      referenceZ += solver.rootNormals[normal + 2];
    }
    const referenceLength = Math.hypot(referenceX, referenceY, referenceZ) || 1;
    referenceX /= referenceLength;
    referenceY /= referenceLength;
    referenceZ /= referenceLength;

    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (section * stations + particle) * 3;
      const count = groomEnvelopeFrameCounts[section * stations + particle];
      if (count > 0) {
        groomEnvelopeCenters[frame] /= count;
        groomEnvelopeCenters[frame + 1] /= count;
        groomEnvelopeCenters[frame + 2] /= count;
      } else if (particle > 0) {
        groomEnvelopeCenters[frame] = groomEnvelopeCenters[frame - 3];
        groomEnvelopeCenters[frame + 1] = groomEnvelopeCenters[frame - 2];
        groomEnvelopeCenters[frame + 2] = groomEnvelopeCenters[frame - 1];
      }
    }

    let priorOutwardX = 0;
    let priorOutwardY = 0;
    let priorOutwardZ = 0;
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (section * stations + particle) * 3;
      const prior = (section * stations + Math.max(0, particle - 1)) * 3;
      const next = (section * stations + Math.min(stations - 1, particle + 1)) * 3;
      let tangentX = groomEnvelopeCenters[next] - groomEnvelopeCenters[prior];
      let tangentY = groomEnvelopeCenters[next + 1] - groomEnvelopeCenters[prior + 1];
      let tangentZ = groomEnvelopeCenters[next + 2] - groomEnvelopeCenters[prior + 2];
      const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
      tangentX /= tangentLength;
      tangentY /= tangentLength;
      tangentZ /= tangentLength;
      groomEnvelopeTangents[frame] = tangentX;
      groomEnvelopeTangents[frame + 1] = tangentY;
      groomEnvelopeTangents[frame + 2] = tangentZ;

      const tangentProjection =
        referenceX * tangentX + referenceY * tangentY + referenceZ * tangentZ;
      let outwardX = referenceX - tangentX * tangentProjection;
      let outwardY = referenceY - tangentY * tangentProjection;
      let outwardZ = referenceZ - tangentZ * tangentProjection;
      let outwardLength = Math.hypot(outwardX, outwardY, outwardZ);
      if (outwardLength < 1e-6) {
        const fallbackX = Math.abs(tangentY) > 0.9 ? 1 : 0;
        const fallbackY = Math.abs(tangentY) > 0.9 ? 0 : 1;
        outwardX = tangentY * 0 - tangentZ * fallbackY;
        outwardY = tangentZ * fallbackX - tangentX * 0;
        outwardZ = tangentX * fallbackY - tangentY * fallbackX;
        outwardLength = Math.hypot(outwardX, outwardY, outwardZ) || 1;
      }
      outwardX /= outwardLength;
      outwardY /= outwardLength;
      outwardZ /= outwardLength;
      if (
        particle > 0 &&
        outwardX * priorOutwardX + outwardY * priorOutwardY + outwardZ * priorOutwardZ < 0
      ) {
        outwardX *= -1;
        outwardY *= -1;
        outwardZ *= -1;
      }
      priorOutwardX = outwardX;
      priorOutwardY = outwardY;
      priorOutwardZ = outwardZ;
      groomEnvelopeOutwards[frame] = outwardX;
      groomEnvelopeOutwards[frame + 1] = outwardY;
      groomEnvelopeOutwards[frame + 2] = outwardZ;
      groomEnvelopeLaterals[frame] = tangentY * outwardZ - tangentZ * outwardY;
      groomEnvelopeLaterals[frame + 1] = tangentZ * outwardX - tangentX * outwardZ;
      groomEnvelopeLaterals[frame + 2] = tangentX * outwardY - tangentY * outwardX;
    }
  }

  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    const normal = guide * 3;
    const referenceX = solver.rootNormals[normal];
    const referenceY = solver.rootNormals[normal + 1];
    const referenceZ = solver.rootNormals[normal + 2];
    const activeSegments = solver.activeSegments[guide];
    let priorOutwardX = 0;
    let priorOutwardY = 0;
    let priorOutwardZ = 0;
    for (let particle = 0; particle < stations; particle += 1) {
      const clamped = Math.min(activeSegments, particle);
      const prior = solver.index(guide, Math.max(0, clamped - 1));
      const next = solver.index(guide, Math.min(activeSegments, clamped + 1));
      const frame = (guide * stations + particle) * 3;
      let tangentX = solver.positions[next] - solver.positions[prior];
      let tangentY = solver.positions[next + 1] - solver.positions[prior + 1];
      let tangentZ = solver.positions[next + 2] - solver.positions[prior + 2];
      const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
      tangentX /= tangentLength;
      tangentY /= tangentLength;
      tangentZ /= tangentLength;
      const tangentProjection =
        referenceX * tangentX + referenceY * tangentY + referenceZ * tangentZ;
      let outwardX = referenceX - tangentX * tangentProjection;
      let outwardY = referenceY - tangentY * tangentProjection;
      let outwardZ = referenceZ - tangentZ * tangentProjection;
      let outwardLength = Math.hypot(outwardX, outwardY, outwardZ);
      if (outwardLength < 1e-6) {
        outwardX = Math.abs(tangentY) > 0.9 ? 1 : 0;
        outwardY = Math.abs(tangentY) > 0.9 ? 0 : 1;
        outwardZ = 0;
        outwardLength = 1;
      }
      outwardX /= outwardLength;
      outwardY /= outwardLength;
      outwardZ /= outwardLength;
      if (
        particle > 0 &&
        outwardX * priorOutwardX + outwardY * priorOutwardY + outwardZ * priorOutwardZ < 0
      ) {
        outwardX *= -1;
        outwardY *= -1;
        outwardZ *= -1;
      }
      priorOutwardX = outwardX;
      priorOutwardY = outwardY;
      priorOutwardZ = outwardZ;
      groomOwnerTangents[frame] = tangentX;
      groomOwnerTangents[frame + 1] = tangentY;
      groomOwnerTangents[frame + 2] = tangentZ;
      groomOwnerOutwards[frame] = outwardX;
      groomOwnerOutwards[frame + 1] = outwardY;
      groomOwnerOutwards[frame + 2] = outwardZ;
      groomOwnerLaterals[frame] = tangentY * outwardZ - tangentZ * outwardY;
      groomOwnerLaterals[frame + 1] = tangentZ * outwardX - tangentX * outwardZ;
      groomOwnerLaterals[frame + 2] = tangentX * outwardY - tangentY * outwardX;
    }
  }
  updatePatchLockFrames();
  updateAuthoredGroomFrames();
  groomEnvelopeClampedPoints = 0;
  groomEnvelopeProjectedPoints = 0;
  groomEnvelopeMaximumOutputRadius = 0;
  groomEnvelopeFaceClearCorrections = 0;
  groomEnvelopeFaceClearMaximumDistance = 0;
}

function updatePatchLockFrames() {
  if (!groomBindings?.patchLockEnabled) return;
  const stations = solver.segments + 1;
  groomPatchCenters.fill(0);
  groomPatchFrameCounts.fill(0);
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    const patch = groomBindings.guidePatchIds[guide];
    for (let particle = 0; particle <= solver.activeSegments[guide]; particle += 1) {
      const source = solver.index(guide, particle);
      const frame = (patch * stations + particle) * 3;
      const count = patch * stations + particle;
      groomPatchCenters[frame] += solver.positions[source];
      groomPatchCenters[frame + 1] += solver.positions[source + 1];
      groomPatchCenters[frame + 2] += solver.positions[source + 2];
      groomPatchFrameCounts[count] += 1;
    }
  }
  for (let patch = 0; patch < groomBindings.patchCount; patch += 1) {
    let referenceX = 0;
    let referenceY = 0;
    let referenceZ = 0;
    for (let guide = 0; guide < solver.guideCount; guide += 1) {
      if (groomBindings.guidePatchIds[guide] !== patch) continue;
      const normal = guide * 3;
      referenceX += solver.rootNormals[normal];
      referenceY += solver.rootNormals[normal + 1];
      referenceZ += solver.rootNormals[normal + 2];
    }
    const referenceLength = Math.hypot(referenceX, referenceY, referenceZ) || 1;
    referenceX /= referenceLength;
    referenceY /= referenceLength;
    referenceZ /= referenceLength;
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (patch * stations + particle) * 3;
      const count = groomPatchFrameCounts[patch * stations + particle];
      if (count > 0) {
        groomPatchCenters[frame] /= count;
        groomPatchCenters[frame + 1] /= count;
        groomPatchCenters[frame + 2] /= count;
      } else if (particle > 0) {
        groomPatchCenters[frame] = groomPatchCenters[frame - 3];
        groomPatchCenters[frame + 1] = groomPatchCenters[frame - 2];
        groomPatchCenters[frame + 2] = groomPatchCenters[frame - 1];
      }
    }
    let priorOutwardX = referenceX;
    let priorOutwardY = referenceY;
    let priorOutwardZ = referenceZ;
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (patch * stations + particle) * 3;
      const prior = (patch * stations + Math.max(0, particle - 1)) * 3;
      const next = (patch * stations + Math.min(stations - 1, particle + 1)) * 3;
      let tangentX = groomPatchCenters[next] - groomPatchCenters[prior];
      let tangentY = groomPatchCenters[next + 1] - groomPatchCenters[prior + 1];
      let tangentZ = groomPatchCenters[next + 2] - groomPatchCenters[prior + 2];
      const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
      tangentX /= tangentLength;
      tangentY /= tangentLength;
      tangentZ /= tangentLength;
      groomPatchTangents[frame] = tangentX;
      groomPatchTangents[frame + 1] = tangentY;
      groomPatchTangents[frame + 2] = tangentZ;
      const projection = referenceX * tangentX + referenceY * tangentY + referenceZ * tangentZ;
      let outwardX = referenceX - tangentX * projection;
      let outwardY = referenceY - tangentY * projection;
      let outwardZ = referenceZ - tangentZ * projection;
      let outwardLength = Math.hypot(outwardX, outwardY, outwardZ);
      if (outwardLength < 1e-6) {
        outwardX = priorOutwardX;
        outwardY = priorOutwardY;
        outwardZ = priorOutwardZ;
        outwardLength = Math.hypot(outwardX, outwardY, outwardZ) || 1;
      }
      outwardX /= outwardLength;
      outwardY /= outwardLength;
      outwardZ /= outwardLength;
      if (
        particle > 0 &&
        outwardX * priorOutwardX + outwardY * priorOutwardY + outwardZ * priorOutwardZ < 0
      ) {
        outwardX *= -1;
        outwardY *= -1;
        outwardZ *= -1;
      }
      priorOutwardX = outwardX;
      priorOutwardY = outwardY;
      priorOutwardZ = outwardZ;
      groomPatchOutwards[frame] = outwardX;
      groomPatchOutwards[frame + 1] = outwardY;
      groomPatchOutwards[frame + 2] = outwardZ;
      groomPatchLaterals[frame] = tangentY * outwardZ - tangentZ * outwardY;
      groomPatchLaterals[frame + 1] = tangentZ * outwardX - tangentX * outwardZ;
      groomPatchLaterals[frame + 2] = tangentX * outwardY - tangentY * outwardX;
    }
  }
}

function ensureAuthoredGroomReference() {
  if (!groomBindings || !authoredRestGroomEnabled) return false;
  if (nativeClipPlayback.enabled && !nativeClipPlayback.clip) return false;
  const stations = solver.segments + 1;
  const values = solver.guideCount * stations * 3;
  if (authoredRestCenters.length !== values) {
    authoredRestCenters = new Float64Array(values);
    authoredLiveCenters = new Float64Array(values);
    authoredMechanicalReference = new Float64Array(values);
    authoredTangents = new Float64Array(values);
    authoredOutwards = new Float64Array(values);
    authoredLaterals = new Float64Array(values);
    authoredReferenceReady = false;
  }
  if (authoredReferenceReady) return true;
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    const rootOffset = guide * 3;
    const targetOffset = guide * solver.rootDirector.zoneSegments * 3;
    const root = solver.roots.subarray(rootOffset, rootOffset + 3);
    const normal = solver.rootNormals.subarray(rootOffset, rootOffset + 3);
    const direction = solver.rootDirectorTargets.subarray(targetOffset, targetOffset + 3);
    let guideLength = 0;
    for (let segment = 0; segment < solver.segments; segment += 1) {
      guideLength += solver.restLengths[guide * solver.segments + segment];
    }
    for (let particle = 0; particle < stations; particle += 1) {
      const writeRestPoint = authoredLaydownEnabled
        ? authoredGroomLaydownRestPoint
        : authoredGroomRestPoint;
      const stationFraction = particle / solver.segments;
      const groomFraction = authoredLaydownEnabled
        ? authoredGroomLaydownSampleFractionAt(stationFraction)
        : stationFraction;
      if (sparseGroomCageEnabled) {
        sparseGroomRestPoint(
          root,
          groomFraction,
          authoredRestCenters,
          (guide * stations + particle) * 3
        );
      } else if (hairlineFlowEnabled) {
        authoredHairlineFlowRestPoint(
          root,
          normal,
          groomFraction,
          guideLength,
          authoredRestCenters,
          (guide * stations + particle) * 3
        );
      } else {
        writeRestPoint(
          root,
          normal,
          direction,
          groomFraction,
          guideLength,
          authoredRestCenters,
          (guide * stations + particle) * 3
        );
      }
    }
  }
  authoredMechanicalReference.set(solver.positions);
  if (independentDisplayFolliclesEnabled && groomBindings?.independentDisplayFollicles) {
    maximumCorrelatedResidual = 0;
    maximumOccupancyRemap = 0;
    maximumLockLaminaRootDisplacement = 0;
    const displayValues = groomBindings.bindingCount * stations * 3;
    if (displayFollicleRestCenters.length !== displayValues) {
      displayFollicleRestCenters = new Float64Array(displayValues);
    }
    for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
      const rootOffset = binding * 3;
      const root = groomBindings.displayRoots.subarray(rootOffset, rootOffset + 3);
      const laminaSample = {
        laminaId: groomBindings.displayLaminaIds[binding],
        coordinate: groomBindings.displayLaminaCoordinates[binding],
        role: groomBindings.displayLaminaRoles[binding],
      };
      if (lockLaminaeEnabled) {
        for (const rootFraction of [0, 0.04, 0.08]) {
          lockLaminaOffset(
            root,
            groomBindings.displayHeroIds[binding],
            laminaSample,
            rootFraction,
            lockLaminaOffsetScratch
          );
          maximumLockLaminaRootDisplacement = Math.max(
            maximumLockLaminaRootDisplacement,
            Math.hypot(...lockLaminaOffsetScratch)
          );
        }
      }
      for (let particle = 0; particle < stations; particle += 1) {
        sparseGroomRestPoint(
          root,
          particle / solver.segments,
          displayFollicleRestCenters,
          (binding * stations + particle) * 3
        );
        const point = (binding * stations + particle) * 3;
        if (lockLaminaeEnabled) {
          const fraction = particle / solver.segments;
          lockLaminaOffset(
            root,
            groomBindings.displayHeroIds[binding],
            laminaSample,
            fraction,
            lockLaminaOffsetScratch
          );
          displayFollicleRestCenters[point] += lockLaminaOffsetScratch[0];
          displayFollicleRestCenters[point + 1] += lockLaminaOffsetScratch[1];
          displayFollicleRestCenters[point + 2] += lockLaminaOffsetScratch[2];
        }
        if (occupancyRemapEnabled) {
          sparseGroomOccupancyRemap(
            root,
            groomBindings.displayHeroIds[binding],
            particle / solver.segments,
            displayFollicleRestCenters.subarray(point, point + 3),
            occupancyRemapScratch
          );
          maximumOccupancyRemap = Math.max(
            maximumOccupancyRemap,
            Math.hypot(...occupancyRemapScratch)
          );
          displayFollicleRestCenters[point] += occupancyRemapScratch[0];
          displayFollicleRestCenters[point + 1] += occupancyRemapScratch[1];
          displayFollicleRestCenters[point + 2] += occupancyRemapScratch[2];
        }
        if (correlatedRestHierarchyEnabled) {
          const fraction = particle / solver.segments;
          sparseGroomCorrelatedResidual(
            root,
            groomBindings.displayHeroIds[binding],
            fraction,
            correlatedResidualScratch
          );
          maximumCorrelatedResidual = Math.max(
            maximumCorrelatedResidual,
            Math.hypot(...correlatedResidualScratch)
          );
          displayFollicleRestCenters[point] += correlatedResidualScratch[0];
          displayFollicleRestCenters[point + 1] += correlatedResidualScratch[1];
          displayFollicleRestCenters[point + 2] += correlatedResidualScratch[2];
        }
      }
    }
  } else {
    displayFollicleRestCenters = new Float64Array();
    maximumCorrelatedResidual = 0;
    maximumOccupancyRemap = 0;
    maximumLockLaminaRootDisplacement = 0;
  }
  occupancyCoreTelemetryCache = occupancyRemapEnabled ? summarizeOccupancyCores() : null;
  authoredTopologyDigest = float32BufferDigest(Float32Array.from(authoredRestCenters));
  authoredReferenceReady = true;
  return true;
}

function updateAuthoredGroomFrames() {
  if (!ensureAuthoredGroomReference()) return;
  const stations = solver.segments + 1;
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (guide * stations + particle) * 3;
      const stationFraction = particle / solver.segments;
      const fraction = authoredLaydownEnabled
        ? authoredGroomLaydownSampleFractionAt(stationFraction)
        : stationFraction;
      const transfer = authoredLaydownEnabled
        ? authoredGroomLaydownDisplacementTransferAt(fraction)
        : authoredGroomDisplacementTransferAt(fraction);
      for (let axis = 0; axis < 3; axis += 1) {
        authoredLiveCenters[frame + axis] =
          authoredRestCenters[frame + axis] +
          (solver.positions[frame + axis] - authoredMechanicalReference[frame + axis]) * transfer;
      }
    }
    const normal = guide * 3;
    const referenceX = solver.rootNormals[normal];
    const referenceY = solver.rootNormals[normal + 1];
    const referenceZ = solver.rootNormals[normal + 2];
    let priorOutwardX = referenceX;
    let priorOutwardY = referenceY;
    let priorOutwardZ = referenceZ;
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (guide * stations + particle) * 3;
      const prior = (guide * stations + Math.max(0, particle - 1)) * 3;
      const next = (guide * stations + Math.min(stations - 1, particle + 1)) * 3;
      let tangentX = authoredLiveCenters[next] - authoredLiveCenters[prior];
      let tangentY = authoredLiveCenters[next + 1] - authoredLiveCenters[prior + 1];
      let tangentZ = authoredLiveCenters[next + 2] - authoredLiveCenters[prior + 2];
      const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
      tangentX /= tangentLength;
      tangentY /= tangentLength;
      tangentZ /= tangentLength;
      authoredTangents[frame] = tangentX;
      authoredTangents[frame + 1] = tangentY;
      authoredTangents[frame + 2] = tangentZ;
      const projection = referenceX * tangentX + referenceY * tangentY + referenceZ * tangentZ;
      let outwardX = referenceX - tangentX * projection;
      let outwardY = referenceY - tangentY * projection;
      let outwardZ = referenceZ - tangentZ * projection;
      let outwardLength = Math.hypot(outwardX, outwardY, outwardZ);
      if (outwardLength < 1e-6) {
        outwardX = priorOutwardX;
        outwardY = priorOutwardY;
        outwardZ = priorOutwardZ;
        outwardLength = Math.hypot(outwardX, outwardY, outwardZ) || 1;
      }
      outwardX /= outwardLength;
      outwardY /= outwardLength;
      outwardZ /= outwardLength;
      if (
        particle > 0 &&
        outwardX * priorOutwardX + outwardY * priorOutwardY + outwardZ * priorOutwardZ < 0
      ) {
        outwardX *= -1;
        outwardY *= -1;
        outwardZ *= -1;
      }
      priorOutwardX = outwardX;
      priorOutwardY = outwardY;
      priorOutwardZ = outwardZ;
      authoredOutwards[frame] = outwardX;
      authoredOutwards[frame + 1] = outwardY;
      authoredOutwards[frame + 2] = outwardZ;
      authoredLaterals[frame] = tangentY * outwardZ - tangentZ * outwardY;
      authoredLaterals[frame + 1] = tangentZ * outwardX - tangentX * outwardZ;
      authoredLaterals[frame + 2] = tangentX * outwardY - tangentY * outwardX;
    }
  }
}

function envelopeSmoothStep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function applyGroomEnvelopeFaceClear(target, targetOffset, owner, fraction) {
  if (!faceClearGroomEnabled) return;
  const root = owner * 3;
  const normalX = solver.rootNormals[root];
  const normalZ = solver.rootNormals[root + 2];
  if (normalZ <= 0.28 || Math.abs(normalX) >= 0.72) return;
  const enter = envelopeSmoothStep((fraction - 0.1) / 0.22);
  const leave = 1 - envelopeSmoothStep((fraction - 0.64) / 0.2);
  const center = 1 - envelopeSmoothStep((Math.abs(normalX) - 0.18) / 0.54);
  const front = envelopeSmoothStep((normalZ - 0.28) / 0.5);
  const strength = enter * leave * center * front;
  if (strength <= 1e-6) return;
  const sideSign = solver.roots[root] < GROOM_ENVELOPE_PART_X ? -1 : 1;
  const minimumSignedX = 0.36 + 0.34 * strength;
  const maximumZ = 0.5 - 0.32 * strength;
  const priorX = target[targetOffset];
  const priorZ = target[targetOffset + 2];
  const clearSign = Math.abs(priorX) > 0.14 ? Math.sign(priorX) : sideSign;
  if (Math.abs(priorX) < minimumSignedX) {
    target[targetOffset] = clearSign * minimumSignedX;
  }
  if (priorZ > maximumZ) target[targetOffset + 2] = maximumZ;
  const correction = Math.hypot(target[targetOffset] - priorX, target[targetOffset + 2] - priorZ);
  if (correction <= 1e-9) return;
  groomEnvelopeFaceClearCorrections += 1;
  groomEnvelopeFaceClearMaximumDistance = Math.max(
    groomEnvelopeFaceClearMaximumDistance,
    correction
  );
}

function applyGroomEnvelopeToPoint(target, targetOffset, owner, copy, particle, activeSegments) {
  const profile = resolveGroomEnvelopeProfile(groomEnvelopeId);
  const clampedParticle = Math.max(0, Math.min(activeSegments, particle));
  if (profile.id === "off" || clampedParticle === 0 || activeSegments <= 0) return;
  const section = solver.guideSections[owner] % GROOM_ENVELOPE_SECTION_COUNT;
  const stations = solver.segments + 1;
  const frame = (section * stations + Math.min(solver.segments, clampedParticle)) * 3;
  const radii = groomEnvelopeRadiiAt(
    profile,
    section,
    clampedParticle / Math.max(1, activeSegments),
    activeGroomEnvelopeScale()
  );
  if (radii.outward < 1e-8 || radii.lateral < 1e-8) return;

  const ownerFrame = (owner * stations + Math.min(solver.segments, clampedParticle)) * 3;
  const sample = (owner * renderFibersPerGuide + copy) * 2;
  const sampleOutward = groomEnvelopeSamples[sample] * profile.fillStrength * radii.outward;
  const sampleLateral = groomEnvelopeSamples[sample + 1] * profile.fillStrength * radii.lateral;
  target[targetOffset] +=
    groomOwnerOutwards[ownerFrame] * sampleOutward + groomOwnerLaterals[ownerFrame] * sampleLateral;
  target[targetOffset + 1] +=
    groomOwnerOutwards[ownerFrame + 1] * sampleOutward +
    groomOwnerLaterals[ownerFrame + 1] * sampleLateral;
  target[targetOffset + 2] +=
    groomOwnerOutwards[ownerFrame + 2] * sampleOutward +
    groomOwnerLaterals[ownerFrame + 2] * sampleLateral;
  applyGroomEnvelopeFaceClear(
    target,
    targetOffset,
    owner,
    clampedParticle / Math.max(1, activeSegments)
  );
  const projectedDx = target[targetOffset] - groomEnvelopeCenters[frame];
  const projectedDy = target[targetOffset + 1] - groomEnvelopeCenters[frame + 1];
  const projectedDz = target[targetOffset + 2] - groomEnvelopeCenters[frame + 2];
  const projectedAlong =
    projectedDx * groomEnvelopeTangents[frame] +
    projectedDy * groomEnvelopeTangents[frame + 1] +
    projectedDz * groomEnvelopeTangents[frame + 2];
  let normalizedOutward =
    (projectedDx * groomEnvelopeOutwards[frame] +
      projectedDy * groomEnvelopeOutwards[frame + 1] +
      projectedDz * groomEnvelopeOutwards[frame + 2]) /
    radii.outward;
  let normalizedLateral =
    (projectedDx * groomEnvelopeLaterals[frame] +
      projectedDy * groomEnvelopeLaterals[frame + 1] +
      projectedDz * groomEnvelopeLaterals[frame + 2]) /
    radii.lateral;
  const inputRadius = Math.hypot(normalizedOutward, normalizedLateral);
  if (inputRadius > 1) {
    normalizedOutward /= inputRadius;
    normalizedLateral /= inputRadius;
    const outward = normalizedOutward * radii.outward;
    const lateral = normalizedLateral * radii.lateral;
    target[targetOffset] =
      groomEnvelopeCenters[frame] +
      groomEnvelopeTangents[frame] * projectedAlong +
      groomEnvelopeOutwards[frame] * outward +
      groomEnvelopeLaterals[frame] * lateral;
    target[targetOffset + 1] =
      groomEnvelopeCenters[frame + 1] +
      groomEnvelopeTangents[frame + 1] * projectedAlong +
      groomEnvelopeOutwards[frame + 1] * outward +
      groomEnvelopeLaterals[frame + 1] * lateral;
    target[targetOffset + 2] =
      groomEnvelopeCenters[frame + 2] +
      groomEnvelopeTangents[frame + 2] * projectedAlong +
      groomEnvelopeOutwards[frame + 2] * outward +
      groomEnvelopeLaterals[frame + 2] * lateral;
    groomEnvelopeClampedPoints += 1;
  }
  groomEnvelopeProjectedPoints += 1;
  groomEnvelopeMaximumOutputRadius = Math.max(
    groomEnvelopeMaximumOutputRadius,
    Math.min(1, inputRadius)
  );
}

function applyPatchLockToPoint(target, targetOffset, owner, copy, particle, activeSegments) {
  if (!groomBindings?.patchLockEnabled || particle <= 0 || activeSegments <= 0) return;
  const fraction = particle / Math.max(1, activeSegments);
  const convergence = envelopeSmoothStep(
    (fraction - PATCH_LOCK_CONVERGENCE_START) /
      (PATCH_LOCK_CONVERGENCE_END - PATCH_LOCK_CONVERGENCE_START)
  );
  if (convergence <= 1e-8) return;
  const patch = groomBindings.guidePatchIds[owner];
  const stations = solver.segments + 1;
  const clampedParticle = Math.min(solver.segments, particle);
  const frame = (patch * stations + clampedParticle) * 3;
  const sample = (owner * renderFibersPerGuide + copy) * 2;
  const targetOutward = groomEnvelopeSamples[sample] * PATCH_LOCK_OUTWARD_RADIUS_METERS;
  const targetLateral = groomEnvelopeSamples[sample + 1] * PATCH_LOCK_LATERAL_RADIUS_METERS;
  const lockX =
    groomPatchCenters[frame] +
    groomPatchOutwards[frame] * targetOutward +
    groomPatchLaterals[frame] * targetLateral;
  const lockY =
    groomPatchCenters[frame + 1] +
    groomPatchOutwards[frame + 1] * targetOutward +
    groomPatchLaterals[frame + 1] * targetLateral;
  const lockZ =
    groomPatchCenters[frame + 2] +
    groomPatchOutwards[frame + 2] * targetOutward +
    groomPatchLaterals[frame + 2] * targetLateral;
  target[targetOffset] += (lockX - target[targetOffset]) * convergence;
  target[targetOffset + 1] += (lockY - target[targetOffset + 1]) * convergence;
  target[targetOffset + 2] += (lockZ - target[targetOffset + 2]) * convergence;
}
const physicsRodMidpoint = new THREE.Vector3();
const physicsRodDirection = new THREE.Vector3();
const physicsRodQuaternion = new THREE.Quaternion();
const physicsRodScale = new THREE.Vector3();
const physicsJointScale = new THREE.Vector3();
const physicsInstanceMatrix = new THREE.Matrix4();
const physicsUp = new THREE.Vector3(0, 1, 0);
const fatlineBaseColor = new THREE.Color();
const undercoatColorScratch = new THREE.Color();
const undercoatShadowTarget = new THREE.Color(0x08070a);
const hairFiberColorScratch = { r: 0, g: 0, b: 0 };
const patchDebugColorScratch = new THREE.Color();
let paused = false;
let cutting = false;
let cuttingPointer = false;
let lastFrame = performance.now();
let smoothedSolverMs = 0;
let smoothedFps = 60;
let telemetryClock = 0;
const projected = new THREE.Vector3();
const filmDirection = {
  enabled: false,
  startTime: null,
  baseWind: 0.18,
  gust: 0,
  cut: "none",
  cutAt: 2.5,
  cutDuration: 1.4,
  cutDone: false,
  cutStrands: new Set(),
  windRotationRate: 0,
};
const deterministicReplay = {
  enabled: false,
  autoplay: false,
  targetStep: 0,
  collectiveRulesEnabled: true,
  spatialFrictionEnabled: false,
  state: createReplayState(),
  config: { dt: 1 / 60, baseWind: 0.18, gust: 0, cut: "none", cutAt: 2.5, cutDuration: 1.4 },
};
const materialStudy = {
  enabled: false,
  conditions: Object.keys(COMB_MATERIAL_CONDITIONS),
  index: 0,
  results: {},
};

function hairColor() {
  const colors = {
    straight: 0x33130d,
    wavy: 0x6d2616,
    curly: 0x35130d,
    coily: 0x171116,
  };
  return colors[solver.preset];
}

function createSectionControlTubeGeometry(segments, radialSegments) {
  const positions = new Float32Array((segments + 1) * radialSegments * 3);
  const uvs = new Float32Array((segments + 1) * radialSegments * 2);
  const indices = [];
  for (let segment = 0; segment <= segments; segment += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const vertex = segment * radialSegments + radial;
      uvs[vertex * 2] = radial / radialSegments;
      uvs[vertex * 2 + 1] = segment / Math.max(1, segments);
    }
  }
  for (let segment = 0; segment < segments; segment += 1) {
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const nextRadial = (radial + 1) % radialSegments;
      const a = segment * radialSegments + radial;
      const b = segment * radialSegments + nextRadial;
      const c = (segment + 1) * radialSegments + radial;
      const d = (segment + 1) * radialSegments + nextRadial;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function rebuildSectionControlTube() {
  if (sectionControlTube) {
    scene.remove(sectionControlTube);
    sectionControlTube.geometry.dispose();
    sectionControlTube.material.dispose();
  }
  sectionControlTubeTimings = [];
  const geometry = createSectionControlTubeGeometry(
    solver.segments,
    SECTION_CONTROL_TUBE_RADIAL_SEGMENTS
  );
  const material = new THREE.MeshBasicMaterial({
    color: SECTION_CONTROL_TUBE_COLOR,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.forceSinglePass = true;
  sectionControlTube = new THREE.Mesh(geometry, material);
  sectionControlTube.frustumCulled = false;
  sectionControlTube.renderOrder = 8;
  sectionControlTube.visible = false;
  scene.add(sectionControlTube);
}

function rebuildGroomEnvelopeBoundaryMeshes() {
  for (const mesh of groomEnvelopeBoundaryMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  groomEnvelopeBoundaryMeshes = [];
  groomEnvelopeBoundaryTimings = [];
  for (let section = 0; section < GROOM_ENVELOPE_SECTION_COUNT; section += 1) {
    const geometry = createSectionControlTubeGeometry(
      solver.segments,
      GROOM_ENVELOPE_RADIAL_SEGMENTS
    );
    const material = new THREE.MeshBasicMaterial({
      color: PHYSICS_CAGE_SECTION_COLORS[section],
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.forceSinglePass = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 7;
    mesh.visible = false;
    mesh.userData.section = section;
    groomEnvelopeBoundaryMeshes.push(mesh);
    scene.add(mesh);
  }
}

function createHairMassAlphaTexture(layer) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const isCore = layer === "core";
  const background = isCore ? 84 : 10;
  context.fillStyle = `rgb(${background}, ${background}, ${background})`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const lineCount = isCore ? 84 : 52;
  for (let line = 0; line < lineCount; line += 1) {
    const baseX = ((line + 0.5) / lineCount) * canvas.width;
    const phase = line * 2.39996322973;
    const brightness = Math.round((isCore ? 132 : 104) + 80 * (0.5 + 0.5 * Math.sin(phase * 1.7)));
    context.strokeStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
    context.lineWidth = (isCore ? 0.55 : 0.42) + ((line * 17) % 7) * 0.08;
    context.beginPath();
    for (let step = 0; step <= 16; step += 1) {
      const fraction = step / 16;
      const x =
        baseX +
        Math.sin(phase + fraction * Math.PI * (isCore ? 1.7 : 2.4)) *
          (isCore ? 1.8 : 3.1) *
          Math.sin(Math.PI * fraction);
      const y = fraction * canvas.height;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.globalCompositeOperation = "multiply";
  const taper = context.createLinearGradient(0, 0, 0, canvas.height);
  taper.addColorStop(0, "rgb(255,255,255)");
  taper.addColorStop(0.72, "rgb(255,255,255)");
  taper.addColorStop(1, isCore ? "rgb(128,128,128)" : "rgb(72,72,72)");
  context.fillStyle = taper;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(isCore ? 2.6 : 3.2, 1);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function ensureHairMassAlphaTextures() {
  if (hairMassAlphaTextures) return hairMassAlphaTextures;
  hairMassAlphaTextures = {
    core: createHairMassAlphaTexture("core"),
    middle: createHairMassAlphaTexture("middle"),
  };
  return hairMassAlphaTextures;
}

function rebuildHairMassMeshes() {
  for (const mesh of hairMassMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  hairMassMeshes = [];
  hairMassGeometryTimings = [];
  const alphaTextures = ensureHairMassAlphaTextures();
  for (let section = 0; section < GROOM_ENVELOPE_SECTION_COUNT; section += 1) {
    for (const layer of ["core", "middle"]) {
      const geometry = createSectionControlTubeGeometry(solver.segments, HAIR_MASS_RADIAL_SEGMENTS);
      const material = new THREE.MeshStandardMaterial({
        color: 0x120b0d,
        emissive: 0x080405,
        emissiveIntensity: 0.08,
        roughness: 0.82,
        metalness: 0,
        transparent: true,
        opacity: 0,
        alphaMap: alphaTextures[layer],
        alphaTest: 0.012,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      material.forceSinglePass = true;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      mesh.renderOrder = layer === "core" ? -5 : -4;
      mesh.visible = false;
      mesh.userData.section = section;
      mesh.userData.layer = layer;
      hairMassMeshes.push(mesh);
      scene.add(mesh);
    }
  }
}

function updateGroomEnvelopeBoundaryMeshes() {
  if (!groomEnvelopeBoundaryMeshes.length) return;
  const started = performance.now();
  const profile = resolveGroomEnvelopeProfile(groomEnvelopeId);
  const visible =
    Boolean(groomBindings) &&
    profile.id !== "off" &&
    fullGroomHydrationEnabled &&
    fullGroomPresentation.tubeOpacity > 0.002;
  const stations = solver.segments + 1;
  for (let section = 0; section < GROOM_ENVELOPE_SECTION_COUNT; section += 1) {
    const mesh = groomEnvelopeBoundaryMeshes[section];
    mesh.visible = visible;
    mesh.material.opacity = fullGroomPresentation.tubeOpacity * 0.92;
    if (!visible) continue;
    const positions = mesh.geometry.attributes.position.array;
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (section * stations + particle) * 3;
      const radii = groomEnvelopeRadiiAt(
        profile,
        section,
        particle / Math.max(1, solver.segments),
        activeGroomEnvelopeScale()
      );
      for (let radial = 0; radial < GROOM_ENVELOPE_RADIAL_SEGMENTS; radial += 1) {
        const angle = (radial / GROOM_ENVELOPE_RADIAL_SEGMENTS) * Math.PI * 2;
        const outward = Math.cos(angle) * radii.outward;
        const lateral = Math.sin(angle) * radii.lateral;
        const target = (particle * GROOM_ENVELOPE_RADIAL_SEGMENTS + radial) * 3;
        positions[target] =
          groomEnvelopeCenters[frame] +
          groomEnvelopeOutwards[frame] * outward +
          groomEnvelopeLaterals[frame] * lateral;
        positions[target + 1] =
          groomEnvelopeCenters[frame + 1] +
          groomEnvelopeOutwards[frame + 1] * outward +
          groomEnvelopeLaterals[frame + 1] * lateral;
        positions[target + 2] =
          groomEnvelopeCenters[frame + 2] +
          groomEnvelopeOutwards[frame + 2] * outward +
          groomEnvelopeLaterals[frame + 2] * lateral;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }
  if (visible) {
    groomEnvelopeBoundaryTimings.push(performance.now() - started);
    if (groomEnvelopeBoundaryTimings.length > 660) groomEnvelopeBoundaryTimings.shift();
  }
}

function updateHairMassMeshes() {
  if (!hairMassMeshes.length) return;
  const started = performance.now();
  const massProfile = resolveHairMassFillProfile(hairMassFillId);
  const envelopeProfile = resolveGroomEnvelopeProfile(groomEnvelopeId);
  const presentation = fullGroomHydrationEnabled ? fullGroomPresentation.microfiberHydration : 1;
  const visible =
    Boolean(groomBindings) &&
    massProfile.id !== "off" &&
    envelopeProfile.id !== "off" &&
    presentation > 0.002;
  const stations = solver.segments + 1;
  for (const mesh of hairMassMeshes) {
    const section = mesh.userData.section;
    const layer = mesh.userData.layer;
    const sectionOpacity = HAIR_MASS_SECTION_OPACITY[section];
    const layerScale = layer === "core" ? massProfile.coreScale : massProfile.middleScale;
    mesh.visible = visible && sectionOpacity > 0.002 && layerScale > 0.002;
    mesh.material.opacity =
      hairMassLayerOpacity(massProfile, layer, hairMassDensity) * sectionOpacity * presentation;
    mesh.material.color
      .setHex(activeHydrationState.baseColor)
      .lerp(undercoatShadowTarget, layer === "core" ? 0.32 : 0.18)
      .multiplyScalar(layer === "core" ? 0.9 : 1);
    mesh.material.emissive.copy(mesh.material.color).multiplyScalar(0.07);
    if (!mesh.visible) continue;
    const positions = mesh.geometry.attributes.position.array;
    for (let particle = 0; particle < stations; particle += 1) {
      const frame = (section * stations + particle) * 3;
      const radii = groomEnvelopeRadiiAt(
        envelopeProfile,
        section,
        particle / Math.max(1, solver.segments),
        activeGroomEnvelopeScale()
      );
      for (let radial = 0; radial < HAIR_MASS_RADIAL_SEGMENTS; radial += 1) {
        const angle = (radial / HAIR_MASS_RADIAL_SEGMENTS) * Math.PI * 2;
        const outward = Math.cos(angle) * radii.outward * layerScale;
        const lateral = Math.sin(angle) * radii.lateral * layerScale;
        const target = (particle * HAIR_MASS_RADIAL_SEGMENTS + radial) * 3;
        positions[target] =
          groomEnvelopeCenters[frame] +
          groomEnvelopeOutwards[frame] * outward +
          groomEnvelopeLaterals[frame] * lateral;
        positions[target + 1] =
          groomEnvelopeCenters[frame + 1] +
          groomEnvelopeOutwards[frame + 1] * outward +
          groomEnvelopeLaterals[frame + 1] * lateral;
        positions[target + 2] =
          groomEnvelopeCenters[frame + 2] +
          groomEnvelopeOutwards[frame + 2] * outward +
          groomEnvelopeLaterals[frame + 2] * lateral;
      }
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }
  if (visible) {
    hairMassGeometryTimings.push(performance.now() - started);
    if (hairMassGeometryTimings.length > 660) hairMassGeometryTimings.shift();
  }
}

function rebuildPhysicsGuideCage() {
  if (physicsGuideCage) {
    scene.remove(physicsGuideCage);
    physicsGuideCage.geometry.dispose();
    physicsGuideCage.material.dispose();
  }
  if (physicsJointMesh) {
    scene.remove(physicsJointMesh);
    physicsJointMesh.geometry.dispose();
    physicsJointMesh.material.dispose();
  }
  physicsGuideCageTimings = [];
  const sampleCount = Math.min(PHYSICS_SKELETON_STYLE.guideLimit, solver.guideCount);
  physicsSkeletonGuides = Array.from({ length: sampleCount }, (_, sample) =>
    Math.min(solver.guideCount - 1, Math.floor(((sample + 0.5) * solver.guideCount) / sampleCount))
  );
  physicsGuidePositions = new Float32Array(sampleCount * (solver.segments + 1) * 3);
  const rodCount = sampleCount * solver.segments;
  const jointCount = sampleCount * (solver.segments + 1);
  const rodGeometry = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const jointGeometry = new THREE.SphereGeometry(1, 10, 7);
  const rodMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.26,
    metalness: 0.14,
    emissive: 0x12242b,
    emissiveIntensity: 0.72,
    transparent: true,
    opacity: 0,
    depthWrite: true,
  });
  const jointMaterial = rodMaterial.clone();
  physicsGuideCage = new THREE.InstancedMesh(rodGeometry, rodMaterial, rodCount);
  physicsJointMesh = new THREE.InstancedMesh(jointGeometry, jointMaterial, jointCount);
  physicsGuideCage.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  physicsJointMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.Color();
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const guide = physicsSkeletonGuides[sample];
    color.setHex(PHYSICS_CAGE_SECTION_COLORS[solver.guideSections[guide] % 8]);
    for (let segment = 0; segment < solver.segments; segment += 1) {
      physicsGuideCage.setColorAt(sample * solver.segments + segment, color);
    }
    for (let particle = 0; particle <= solver.segments; particle += 1) {
      physicsJointMesh.setColorAt(sample * (solver.segments + 1) + particle, color);
    }
  }
  physicsGuideCage.instanceColor.needsUpdate = true;
  physicsJointMesh.instanceColor.needsUpdate = true;
  physicsGuideCage.frustumCulled = false;
  physicsJointMesh.frustumCulled = false;
  physicsGuideCage.renderOrder = 9;
  physicsJointMesh.renderOrder = 10;
  physicsGuideCage.visible = false;
  physicsJointMesh.visible = false;
  scene.add(physicsGuideCage);
  scene.add(physicsJointMesh);
}

function updateFullGroomPresentation() {
  const step = nativeClipPlayback.enabled
    ? Math.floor(nativeClipPlayback.elapsed * 60)
    : deterministicReplay.enabled
      ? deterministicReplay.state.step
      : Math.floor(solver.time * 60);
  fullGroomPresentation = fullGroomHydrationEnabled
    ? fullGroomHydrationAtStep(step)
    : {
        phase: "hair_only",
        stageProgress: 1,
        hairHydration: 1,
        guideOpacity: 0,
        tubeOpacity: 0,
        populationFraction: 1,
        widthScale: 1,
        shadingMix: 1,
        undercoatHydration: 1,
        ownerHydration: 1,
        clumpHydration: 1,
        microfiberHydration: 1,
        flyawayHydration: 1,
        auditionStateId: null,
      };
  activeHydrationSelection = hydrationSelectionAtStep(
    step,
    {
      geometryId: hydrationGeometryId,
      opticalId: hydrationOpticalId,
      colorId: hydrationColorId,
      detailId: hydrationDetailId,
    },
    fullGroomHydrationEnabled && hydrationTourEnabled
  );
  activeHydrationState = resolveHairHydrationState(activeHydrationSelection);
  fatlineBaseColor.setHex(activeHydrationState.baseColor);
  ensureHydrationDetailOffsets();
  if (hydrationFamilyScales.length !== renderFibersPerGuide) {
    hydrationFamilyScales = new Float32Array(renderFibersPerGuide);
  }
  for (let copy = 0; copy < renderFibersPerGuide; copy += 1) {
    hydrationFamilyScales[copy] = fullGroomHydrationEnabled
      ? hydrationFiberFamilyScale(
          copy,
          renderFibersPerGuide,
          fullGroomPresentation,
          activeHydrationState
        )
      : 1;
  }
  if (hairRenderMode === "fatline" && hair?.material.uniforms?.presentationHydration) {
    const uniforms = hair.material.uniforms;
    uniforms.presentationHydration.value =
      fullGroomPresentation.hairHydration * activeHydrationState.opacity;
    const massProfile = resolveHairMassFillProfile(hairMassFillId);
    uniforms.fiberOpacityScale.value = Math.max(
      0.2,
      Math.min(1.8, 1 + (massProfile.fiberOpacityScale - 1) * hairMassDensity)
    );
    uniforms.shadingEnabled.value =
      hairShadingMode === "fiber_lobes"
        ? fullGroomPresentation.shadingMix * activeHydrationState.shadingMix
        : 0;
    uniforms.longitudinalRoughness.value = activeHydrationState.longitudinalRoughness;
    uniforms.azimuthalRoughness.value = activeHydrationState.azimuthalRoughness;
    uniforms.cuticleTilt.value = activeHydrationState.cuticleTilt;
    uniforms.diffuseWeight.value = activeHydrationState.diffuseWeight;
    uniforms.reflectionWeight.value = activeHydrationState.reflectionWeight;
    uniforms.transmissionWeight.value = activeHydrationState.transmissionWeight;
    uniforms.internalReflectionWeight.value = activeHydrationState.internalReflectionWeight;
    uniforms.rimWeight.value = activeHydrationState.rimWeight;
    uniforms.multipleScatteringFill.value = activeHydrationState.multipleScatteringFill;
    uniforms.glintStrength.value = activeHydrationState.glintStrength;
    uniforms.absorptionTint.value.fromArray(activeHydrationState.absorptionTint);
  } else if (hair?.material) {
    const baseOpacity = hair.material.userData.baseOpacity ?? 1;
    hair.material.opacity = baseOpacity * fullGroomPresentation.hairHydration;
  }
  if (hairUndercoat) {
    for (const layer of hairUndercoat.children) {
      layer.material.opacity =
        layer.material.userData.baseOpacity *
        fullGroomPresentation.undercoatHydration *
        activeHydrationState.undercoatScale;
      layer.material.color
        .copy(undercoatColorScratch.setHex(activeHydrationState.baseColor))
        .lerp(undercoatShadowTarget, 0.48)
        .multiplyScalar(0.72 + layer.userData.hydrationLayer * 0.06);
    }
    hairUndercoat.visible = fullGroomPresentation.undercoatHydration > 0.002;
  }
  const mechanicalWeight = fullGroomHydrationEnabled
    ? Math.max(0, Math.min(1, fullGroomPresentation.guideOpacity / 0.92))
    : 0;
  key.intensity = 3.8 - mechanicalWeight * 1.4;
  rim.intensity = 45 - mechanicalWeight * 18;
  physicsKey.intensity = mechanicalWeight * 5.2;
  physicsFill.intensity = mechanicalWeight * 34;
  for (const material of [porcelain, heroSkinMaterial, heroScleraMaterial, heroIrisMaterial]) {
    material.transparent = mechanicalWeight > 0.002;
    material.opacity = 1 - mechanicalWeight * 0.68;
    material.depthWrite = mechanicalWeight < 0.002;
  }
  bustMaterial.opacity = 1 - mechanicalWeight * 0.78;
  bustMaterial.depthWrite = mechanicalWeight < 0.002;
}

function updatePhysicsGuideCage() {
  if (!physicsGuideCage || !physicsJointMesh) return;
  const opacity = fullGroomPresentation.guideOpacity;
  physicsGuideCage.visible = fullGroomHydrationEnabled && opacity > 0.002;
  physicsJointMesh.visible = physicsGuideCage.visible;
  physicsGuideCage.material.opacity = opacity;
  physicsJointMesh.material.opacity = Math.min(1, opacity + 0.06);
  const depthWrite = physicsSkeletonDepthWriteAt(fullGroomPresentation.phase, opacity);
  physicsGuideCage.material.depthWrite = depthWrite;
  physicsJointMesh.material.depthWrite = depthWrite;
  if (!physicsGuideCage.visible) return;
  const started = performance.now();
  let positionCursor = 0;
  for (let sample = 0; sample < physicsSkeletonGuides.length; sample += 1) {
    const guide = physicsSkeletonGuides[sample];
    const activeSegments = solver.activeSegments[guide];
    for (let particle = 0; particle <= solver.segments; particle += 1) {
      const displayedParticle = Math.min(particle, activeSegments);
      const point = solver.index(guide, displayedParticle);
      physicsRodStart.fromArray(solver.positions, point);
      physicsGuidePositions[positionCursor] = physicsRodStart.x;
      physicsGuidePositions[positionCursor + 1] = physicsRodStart.y;
      physicsGuidePositions[positionCursor + 2] = physicsRodStart.z;
      positionCursor += 3;
      const jointVisible =
        particle <= activeSegments ? PHYSICS_SKELETON_STYLE.jointRadiusMeters : 0.0001;
      physicsJointScale.setScalar(jointVisible);
      physicsInstanceMatrix.compose(
        physicsRodStart,
        physicsRodQuaternion.identity(),
        physicsJointScale
      );
      physicsJointMesh.setMatrixAt(
        sample * (solver.segments + 1) + particle,
        physicsInstanceMatrix
      );
      if (particle === solver.segments) continue;
      const nextParticle = Math.min(particle + 1, activeSegments);
      const nextPoint = solver.index(guide, nextParticle);
      physicsRodEnd.fromArray(solver.positions, nextPoint);
      physicsRodDirection.subVectors(physicsRodEnd, physicsRodStart);
      const length = physicsRodDirection.length();
      physicsRodMidpoint.addVectors(physicsRodStart, physicsRodEnd).multiplyScalar(0.5);
      physicsRodQuaternion.setFromUnitVectors(
        physicsUp,
        length > 1e-7 ? physicsRodDirection.multiplyScalar(1 / length) : physicsUp
      );
      physicsRodScale.set(
        PHYSICS_SKELETON_STYLE.rodRadiusMeters,
        particle < activeSegments ? Math.max(length, 0.0001) : 0.0001,
        PHYSICS_SKELETON_STYLE.rodRadiusMeters
      );
      physicsInstanceMatrix.compose(physicsRodMidpoint, physicsRodQuaternion, physicsRodScale);
      physicsGuideCage.setMatrixAt(sample * solver.segments + particle, physicsInstanceMatrix);
    }
  }
  physicsGuideCage.instanceMatrix.needsUpdate = true;
  physicsJointMesh.instanceMatrix.needsUpdate = true;
  physicsGuideCageTimings.push(performance.now() - started);
  if (physicsGuideCageTimings.length > 660) physicsGuideCageTimings.shift();
}

function updateSectionPresentation() {
  if (fullGroomHydrationEnabled) {
    sectionPresentation = {
      phase: fullGroomPresentation.phase,
      hydration: fullGroomPresentation.hairHydration,
      tubeOpacity: fullGroomPresentation.tubeOpacity,
    };
    return;
  }
  if (!sectionControlTubeEnabled || solver.sectionPose.section < 0) {
    sectionPresentation = { phase: "off", hydration: 1, tubeOpacity: 0 };
    return;
  }
  sectionPresentation = sectionPosePresentationAtStep(
    deterministicReplay.enabled ? deterministicReplay.state.step : 0,
    deterministicReplay.enabled ? deterministicReplay.config.sectionPoseCycle : undefined
  );
}

function sectionHydrationForGuide(guide) {
  if (fullGroomHydrationEnabled) return fullGroomPresentation.hairHydration;
  return sectionControlTubeEnabled && solver.guideSections[guide] === solver.sectionPose.section
    ? sectionPresentation.hydration
    : 1;
}

function writeHydratedFiberStyle(
  colors,
  widthsStart,
  widthsEnd,
  instance,
  cursor,
  guide,
  copy,
  startParticle,
  endParticle,
  activeSegments,
  binding = -1
) {
  const hydration = sectionHydrationForGuide(guide);
  const familyScale = hydrationFamilyScales[copy];
  const middleParticle = (startParticle + endParticle) * 0.5;
  const hairColorAtSegment = hairFiberColorAt(
    fatlineBaseColor,
    guide,
    copy,
    middleParticle / Math.max(1, activeSegments),
    hairFiberColorScratch
  );
  const proxy = 1 - hydration;
  const hairContribution = 0.32 + 0.68 * hydration;
  const bodyWidthMultiplier =
    binding < 0
      ? 1
      : lockLaminaeEnabled
        ? groomBindings.displayLaminaWidthMultipliers[binding]
        : coreWidthHierarchyEnabled
          ? groomBindings.displayBodyWidthMultipliers[binding]
          : 1;
  const middleWidthMultiplier = sparseGroomWidthMultiplierAt(
    bodyWidthMultiplier,
    middleParticle / Math.max(1, activeSegments)
  );
  if (lockLaminaeDiagnostic && binding >= 0) {
    patchDebugColorScratch.setHex(
      [0x63e6ff, 0xff5fb7, 0xffd35a][groomBindings.displayLaminaIds[binding]]
    );
    patchDebugColorScratch.multiplyScalar(
      groomBindings.displayLaminaRoles[binding] === 0 ? 0.68 : 1
    );
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (layeredHaircutDiagnostic && binding >= 0) {
    patchDebugColorScratch.setHex(
      [0xf7d154, 0xff6f91, 0x63e6ff, 0x8f7cff][groomBindings.displayLengthZones[binding]]
    );
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (coreWidthDiagnostic && binding >= 0) {
    const value = Math.max(0, Math.min(1, middleWidthMultiplier / 3.5));
    colors[cursor] = value;
    colors[cursor + 1] = value;
    colors[cursor + 2] = value;
  } else if (sublockPhaseColors && binding >= 0) {
    patchDebugColorScratch.setHex(
      [0x49d6ff, 0xff5fb7, 0xffd35a][groomBindings.displaySublockPhases[binding]]
    );
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (authoredRootZoneColors && authoredLaydownEnabled) {
    const fraction = authoredGroomLaydownSampleFractionAt(
      middleParticle / Math.max(1, activeSegments)
    );
    patchDebugColorScratch.setHex(
      fraction < 0.045 ? 0xff4fa3 : fraction < AUTHORED_ROOT_HANDOFF_FRACTION ? 0x4fe4ff : 0xf8c45c
    );
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (displayFollicleGuideColors && independentDisplayFolliclesEnabled) {
    patchDebugColorScratch.setHSL((guide * 0.61803398875) % 1, 0.72, 0.58);
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (sparseGroomCageColors && sparseGroomCageEnabled) {
    patchDebugColorScratch.setHSL((sparseGroomHeroByGuide[guide] * 0.61803398875) % 1, 0.72, 0.58);
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (authoredDebugColors && authoredRestGroomEnabled) {
    patchDebugColorScratch.setHex(PHYSICS_CAGE_SECTION_COLORS[solver.guideSections[guide] % 8]);
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else if (patchDebugColors && groomBindings?.patchLockEnabled) {
    const patch = groomBindings.guidePatchIds[guide];
    patchDebugColorScratch.setHSL((patch * 0.61803398875) % 1, 0.78, 0.62);
    colors[cursor] = patchDebugColorScratch.r;
    colors[cursor + 1] = patchDebugColorScratch.g;
    colors[cursor + 2] = patchDebugColorScratch.b;
  } else {
    colors[cursor] = Math.min(
      1,
      hairColorAtSegment.r * hairContribution + SECTION_CONTROL_TUBE_COLOR.r * proxy * 0.72
    );
    colors[cursor + 1] = Math.min(
      1,
      hairColorAtSegment.g * hairContribution + SECTION_CONTROL_TUBE_COLOR.g * proxy * 0.72
    );
    colors[cursor + 2] = Math.min(
      1,
      hairColorAtSegment.b * hairContribution + SECTION_CONTROL_TUBE_COLOR.b * proxy * 0.72
    );
  }
  const presentationWidthScale = fullGroomHydrationEnabled
    ? fullGroomPresentation.widthScale
    : 0.12 + 0.88 * hydration;
  const emergenceScaleAt = groomBindings ? lockAwareFiberEmergenceScaleAt : fiberEmergenceScaleAt;
  const massFamilyScale = hairMassFamilyWidthScale(
    hairMassFillId,
    copy,
    renderFibersPerGuide,
    hairMassDensity
  );
  const sectionMassScale = HAIR_MASS_SECTION_OPACITY[solver.guideSections[guide]] ?? 1;
  const minimumHalfWidth =
    hairMassMinimumHalfWidth(hairMassFillId, copy, renderFibersPerGuide, hairMassDensity) *
    sectionMassScale;
  const startEmergence = emergenceScaleAt(
    guide,
    copy,
    startParticle,
    activeSegments,
    solver.rootNormals[guide * 3 + 1]
  );
  const endEmergence = emergenceScaleAt(
    guide,
    copy,
    endParticle,
    activeSegments,
    solver.rootNormals[guide * 3 + 1]
  );
  const startWidth =
    fatlineHalfWidthAt(startParticle, activeSegments) *
    presentationWidthScale *
    familyScale *
    massFamilyScale *
    hydrationRecipeWidthScaleAt(activeHydrationState, startParticle / Math.max(1, activeSegments));
  const endWidth =
    fatlineHalfWidthAt(endParticle, activeSegments) *
    presentationWidthScale *
    familyScale *
    massFamilyScale *
    hydrationRecipeWidthScaleAt(activeHydrationState, endParticle / Math.max(1, activeSegments));
  const startWidthMultiplier = sparseGroomWidthMultiplierAt(
    bodyWidthMultiplier,
    startParticle / Math.max(1, activeSegments)
  );
  const endWidthMultiplier = sparseGroomWidthMultiplierAt(
    bodyWidthMultiplier,
    endParticle / Math.max(1, activeSegments)
  );
  const roleTipTaperEnabled =
    layeredHaircutEnabled ||
    (lockLaminaeEnabled && binding >= 0 && groomBindings.displayLaminaRoles[binding] !== 0);
  const startTipScale = roleTipTaperEnabled
    ? layeredHaircutTipWidthScaleAt(startParticle / Math.max(1, activeSegments))
    : 1;
  const endTipScale = roleTipTaperEnabled
    ? layeredHaircutTipWidthScaleAt(endParticle / Math.max(1, activeSegments))
    : 1;
  widthsStart[instance] =
    Math.max(minimumHalfWidth, startWidth) * startEmergence * startWidthMultiplier * startTipScale;
  widthsEnd[instance] =
    Math.max(minimumHalfWidth, endWidth) * endEmergence * endWidthMultiplier * endTipScale;
}

function updateSectionControlTube() {
  if (!sectionControlTube) return;
  const started = performance.now();
  const section = solver.sectionPose.section;
  sectionControlTube.material.opacity = sectionPresentation.tubeOpacity;
  sectionControlTube.visible =
    sectionControlTubeEnabled && section >= 0 && sectionPresentation.tubeOpacity > 0.002;
  if (!sectionControlTube.visible) return;
  const radialSegments = SECTION_CONTROL_TUBE_RADIAL_SEGMENTS;
  const positions = sectionControlTube.geometry.attributes.position.array;
  const centers = new Float64Array((solver.segments + 1) * 3);
  let priorNx = 0;
  let priorNy = 0;
  let priorNz = 0;
  for (let particle = 0; particle <= solver.segments; particle += 1) {
    let count = 0;
    for (let guide = 0; guide < solver.guideCount; guide += 1) {
      if (solver.guideSections[guide] !== section || particle > solver.activeSegments[guide])
        continue;
      const point = solver.index(guide, particle);
      centers[particle * 3] += solver.positions[point];
      centers[particle * 3 + 1] += solver.positions[point + 1];
      centers[particle * 3 + 2] += solver.positions[point + 2];
      count += 1;
    }
    if (count > 0) {
      centers[particle * 3] /= count;
      centers[particle * 3 + 1] /= count;
      centers[particle * 3 + 2] /= count;
    } else if (particle > 0) {
      centers[particle * 3] = centers[(particle - 1) * 3];
      centers[particle * 3 + 1] = centers[(particle - 1) * 3 + 1];
      centers[particle * 3 + 2] = centers[(particle - 1) * 3 + 2];
    }
  }
  for (let particle = 0; particle <= solver.segments; particle += 1) {
    const prior = Math.max(0, particle - 1) * 3;
    const next = Math.min(solver.segments, particle + 1) * 3;
    let tx = centers[next] - centers[prior];
    let ty = centers[next + 1] - centers[prior + 1];
    let tz = centers[next + 2] - centers[prior + 2];
    const tangentLength = Math.hypot(tx, ty, tz) || 1;
    tx /= tangentLength;
    ty /= tangentLength;
    tz /= tangentLength;
    const referenceX = Math.abs(ty) > 0.9 ? 1 : 0;
    const referenceY = Math.abs(ty) > 0.9 ? 0 : 1;
    let nx = ty * 0 - tz * referenceY;
    let ny = tz * referenceX - tx * 0;
    let nz = tx * referenceY - ty * referenceX;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    nx /= normalLength;
    ny /= normalLength;
    nz /= normalLength;
    if (particle > 0 && nx * priorNx + ny * priorNy + nz * priorNz < 0) {
      nx *= -1;
      ny *= -1;
      nz *= -1;
    }
    priorNx = nx;
    priorNy = ny;
    priorNz = nz;
    const bx = ty * nz - tz * ny;
    const by = tz * nx - tx * nz;
    const bz = tx * ny - ty * nx;
    const fraction = particle / Math.max(1, solver.segments);
    const radius = (0.19 + 0.07 * Math.sin(Math.PI * fraction)) * (1 - 0.3 * fraction);
    for (let radial = 0; radial < radialSegments; radial += 1) {
      const angle = (radial / radialSegments) * Math.PI * 2;
      const radialNormal = Math.cos(angle) * radius;
      const radialBinormal = Math.sin(angle) * radius;
      const target = (particle * radialSegments + radial) * 3;
      positions[target] = centers[particle * 3] + nx * radialNormal + bx * radialBinormal;
      positions[target + 1] = centers[particle * 3 + 1] + ny * radialNormal + by * radialBinormal;
      positions[target + 2] = centers[particle * 3 + 2] + nz * radialNormal + bz * radialBinormal;
    }
  }
  sectionControlTube.geometry.attributes.position.needsUpdate = true;
  sectionControlTube.geometry.computeBoundingSphere();
  sectionControlTubeTimings.push(performance.now() - started);
  if (sectionControlTubeTimings.length > 660) sectionControlTubeTimings.shift();
}

function createFatlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      shadingEnabled: { value: hairShadingMode === "fiber_lobes" ? 1 : 0 },
      presentationHydration: { value: fullGroomHydrationEnabled ? 0 : 1 },
      fiberOpacityScale: { value: 1 },
      keyDirectionWorld: { value: new THREE.Vector3(4, 6, 5).normalize() },
      rimDirectionWorld: { value: new THREE.Vector3(-3, 1, 3).normalize() },
      keyColor: { value: new THREE.Color(0xffddcf) },
      rimColor: { value: new THREE.Color(0x667dd8) },
      longitudinalRoughness: { value: 0.34 },
      azimuthalRoughness: { value: 0.38 },
      cuticleTilt: { value: 0.085 },
      diffuseWeight: { value: 0.62 },
      reflectionWeight: { value: 0.23 },
      transmissionWeight: { value: 0.1 },
      internalReflectionWeight: { value: 0.09 },
      rimWeight: { value: 0.16 },
      multipleScatteringFill: { value: 0.11 },
      glintStrength: { value: 0.04 },
      absorptionTint: { value: new THREE.Color(0.78, 0.38, 0.3) },
    },
    vertexShader: `
      uniform vec2 resolution;
      attribute vec3 instanceStart;
      attribute vec3 instanceEnd;
      attribute vec3 instanceColor;
      attribute float instanceWidthStart;
      attribute float instanceWidthEnd;
      varying vec3 vColor;
      varying vec3 vTangentView;
      varying vec3 vPositionView;
      varying float vAcross;
      varying float vAlong;

      void main() {
        float along = position.x;
        float sideSign = position.y;
        vec4 startClip = projectionMatrix * modelViewMatrix * vec4(instanceStart, 1.0);
        vec4 endClip = projectionMatrix * modelViewMatrix * vec4(instanceEnd, 1.0);
        vec2 startScreen = (startClip.xy / startClip.w) * resolution * 0.5;
        vec2 endScreen = (endClip.xy / endClip.w) * resolution * 0.5;
        vec2 delta = endScreen - startScreen;
        vec2 direction = dot(delta, delta) < 0.0001 ? vec2(0.0, 1.0) : normalize(delta);
        vec2 side = vec2(-direction.y, direction.x);
        float width = mix(instanceWidthStart, instanceWidthEnd, along);
        float capSign = along * 2.0 - 1.0;
        vec2 offsetPixels = side * sideSign * width + direction * capSign * min(width, 0.35);
        vec2 offsetNdc = offsetPixels * 2.0 / resolution;
        vec4 clipPosition = mix(startClip, endClip, along);
        clipPosition.xy += offsetNdc * clipPosition.w;
        gl_Position = clipPosition;
        vColor = instanceColor;
        vec4 startView = modelViewMatrix * vec4(instanceStart, 1.0);
        vec4 endView = modelViewMatrix * vec4(instanceEnd, 1.0);
        vTangentView = normalize(endView.xyz - startView.xyz);
        vPositionView = mix(startView.xyz, endView.xyz, along);
        vAcross = sideSign;
        vAlong = along;
      }
    `,
    fragmentShader: `
      uniform float shadingEnabled;
      uniform float presentationHydration;
      uniform float fiberOpacityScale;
      uniform vec3 keyDirectionWorld;
      uniform vec3 rimDirectionWorld;
      uniform vec3 keyColor;
      uniform vec3 rimColor;
      uniform float longitudinalRoughness;
      uniform float azimuthalRoughness;
      uniform float cuticleTilt;
      uniform float diffuseWeight;
      uniform float reflectionWeight;
      uniform float transmissionWeight;
      uniform float internalReflectionWeight;
      uniform float rimWeight;
      uniform float multipleScatteringFill;
      uniform float glintStrength;
      uniform vec3 absorptionTint;
      varying vec3 vColor;
      varying vec3 vTangentView;
      varying vec3 vPositionView;
      varying float vAcross;
      varying float vAlong;

      float strandDiffuse(vec3 tangent, vec3 lightDirection) {
        float cosine = clamp(dot(tangent, lightDirection), -1.0, 1.0);
        return sqrt(max(0.0, 1.0 - cosine * cosine));
      }

      float longitudinalLobe(float tangentHalf, float shift, float width) {
        float offset = (tangentHalf - shift) / max(0.001, width);
        return exp(-offset * offset);
      }

      void main() {
        float crossSection = sqrt(max(0.0, 1.0 - vAcross * vAcross));
        float fiberCoverage = 1.0 - smoothstep(0.58, 1.0, abs(vAcross));
        float jointCoverage = 0.5 + 0.5 * sin(3.14159265 * clamp(vAlong, 0.0, 1.0));
        float fiberAlpha = clamp(
          fiberCoverage *
            jointCoverage *
            (0.72 + 0.22 * crossSection) *
            presentationHydration *
            fiberOpacityScale,
          0.0,
          1.0
        );
        vec3 tangent = normalize(vTangentView);
        vec3 viewDirection = normalize(-vPositionView);
        vec3 keyDirection = normalize((viewMatrix * vec4(keyDirectionWorld, 0.0)).xyz);
        vec3 rimDirection = normalize((viewMatrix * vec4(rimDirectionWorld, 0.0)).xyz);
        vec3 keyHalf = normalize(keyDirection + viewDirection);
        vec3 rimHalf = normalize(rimDirection + viewDirection);
        float tangentKeyHalf = dot(tangent, keyHalf);
        float tangentRimHalf = dot(tangent, rimHalf);

        float diffuse = strandDiffuse(tangent, keyDirection);
        float reflection = longitudinalLobe(
          tangentKeyHalf,
          cuticleTilt,
          longitudinalRoughness
        );
        float transmission = longitudinalLobe(
          tangentKeyHalf,
          -cuticleTilt * 0.7,
          longitudinalRoughness * 1.65
        );
        float internalReflection = longitudinalLobe(
          tangentKeyHalf,
          cuticleTilt * 1.8,
          longitudinalRoughness * 1.32
        );
        float rimPrimary = longitudinalLobe(
          tangentRimHalf,
          cuticleTilt * 0.9,
          longitudinalRoughness * 1.15
        );
        float azimuthalWidth = mix(7.5, 1.2, clamp(azimuthalRoughness, 0.0, 1.0));
        float azimuthal = exp(-abs(vAcross) * azimuthalWidth);
        float cylinderEdge = mix(0.62 + 0.38 * abs(vAcross), 1.0, azimuthal);
        vec3 scatteringTint = pow(max(vColor * absorptionTint, vec3(0.0)), vec3(0.42));
        float glint = pow(max(0.0, sin(vAlong * 71.0 + vAcross * 19.0)), 18.0);

        vec3 color = vColor * (0.34 + diffuseWeight * diffuse);
        color += keyColor * reflection * cylinderEdge * reflectionWeight;
        color += scatteringTint * keyColor * transmission * transmissionWeight;
        color += scatteringTint * rimColor * internalReflection * internalReflectionWeight;
        color += rimColor * rimPrimary * cylinderEdge * rimWeight;
        color += scatteringTint * multipleScatteringFill * (0.72 + 0.28 * diffuse);
        color += keyColor * glint * glintStrength;
        color *= 0.9 + 0.1 * crossSection;
        color = color / (vec3(0.94) + color);
        gl_FragColor = vec4(mix(vColor, color, clamp(shadingEnabled, 0.0, 1.0)), fiberAlpha);
      }
    `,
    depthTest: true,
    depthWrite: false,
    transparent: true,
  });
}

function createHairlineUndercoatGeometry(layer, rings = 12, slices = 96) {
  const shellOffset = SCALP_ROOT_OFFSET - 0.009 + layer * 0.0015;
  const positions = [
    SCALP_CENTER[0],
    SCALP_CENTER[1] + SCALP_RADII[1] + shellOffset,
    SCALP_CENTER[2],
  ];
  const indices = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    const ringFraction = ring / rings;
    for (let slice = 0; slice < slices; slice += 1) {
      const phi = (slice / slices) * Math.PI * 2;
      const normalizedDensity = Math.max(
        0,
        Math.min(1, (hairUndercoatCoverageProfile.densityScales[slice] - 0.72) / 0.28)
      );
      const sectionVariation =
        (hairUndercoatCoverageProfile.fadeStarts[slice] - 0.64) / (0.88 - 0.64);
      const edgeFraction =
        layer === 0
          ? 0.78 + normalizedDensity * 0.045
          : layer === 1
            ? 0.87 + normalizedDensity * 0.045 + sectionVariation * 0.012
            : Math.min(0.995, 0.93 + normalizedDensity * 0.035 + sectionVariation * 0.025);
      const theta = 0.035 + (scalpPolarLimit(phi) - 0.035) * ringFraction * edgeFraction;
      const sinTheta = Math.sin(theta);
      const normalX = sinTheta * Math.cos(phi);
      const normalY = Math.cos(theta);
      const normalZ = sinTheta * Math.sin(phi);
      positions.push(
        SCALP_CENTER[0] + (SCALP_RADII[0] + shellOffset) * normalX,
        SCALP_CENTER[1] + (SCALP_RADII[1] + shellOffset) * normalY,
        SCALP_CENTER[2] + (SCALP_RADII[2] + shellOffset) * normalZ
      );
    }
  }
  for (let slice = 0; slice < slices; slice += 1) {
    indices.push(0, 1 + ((slice + 1) % slices), 1 + slice);
  }
  for (let ring = 1; ring < rings; ring += 1) {
    const prior = 1 + (ring - 1) * slices;
    const next = prior + slices;
    for (let slice = 0; slice < slices; slice += 1) {
      const nextSlice = (slice + 1) % slices;
      indices.push(
        prior + slice,
        prior + nextSlice,
        next + slice,
        prior + nextSlice,
        next + nextSlice,
        next + slice
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createHairlineUndercoat() {
  const group = new THREE.Group();
  const shadowColor = fatlineBaseColor.clone().lerp(new THREE.Color(0x08070a), 0.48);
  for (let layer = 0; layer < LOCK_UNDERCOAT_LAYER_OPACITIES.length; layer += 1) {
    const opacity = LOCK_UNDERCOAT_LAYER_OPACITIES[layer];
    const material = new THREE.MeshStandardMaterial({
      color: shadowColor.clone().multiplyScalar(0.72 + layer * 0.06),
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: fullGroomHydrationEnabled ? 0 : opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1 - layer,
      polygonOffsetUnits: -1 - layer,
    });
    material.userData.baseOpacity = opacity;
    const mesh = new THREE.Mesh(createHairlineUndercoatGeometry(layer), material);
    mesh.userData.hydrationLayer = layer;
    mesh.renderOrder = -3 + layer;
    group.add(mesh);
  }
  return group;
}

function rebuildFatlineObject() {
  const renderSubdivisions = groomBindings ? LOCK_AWARE_RENDER_SUBDIVISIONS : 1;
  const instanceCapacity =
    solver.guideCount * solver.segments * renderFibersPerGuide * renderSubdivisions +
    (groomBindings?.bindingCount ?? 0) * LOCK_AWARE_ROOT_COVER_SEGMENTS;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3)
  );
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  const attributes = {
    instanceStart: new THREE.InstancedBufferAttribute(new Float32Array(instanceCapacity * 3), 3),
    instanceEnd: new THREE.InstancedBufferAttribute(new Float32Array(instanceCapacity * 3), 3),
    instanceColor: new THREE.InstancedBufferAttribute(new Float32Array(instanceCapacity * 3), 3),
    instanceWidthStart: new THREE.InstancedBufferAttribute(new Float32Array(instanceCapacity), 1),
    instanceWidthEnd: new THREE.InstancedBufferAttribute(new Float32Array(instanceCapacity), 1),
  };
  for (const [name, attribute] of Object.entries(attributes)) {
    attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
  }
  geometry.instanceCount = 0;
  hairPositions = attributes.instanceStart.array;
  fatlineBaseColor.setHex(hairColor());
  hair = new THREE.Mesh(geometry, createFatlineMaterial());
  hair.frustumCulled = false;
  scene.add(hair);
  hairUndercoatCoverageProfile = buildUndercoatCoverageProfile(
    solver.rootNormals,
    solver.guideSections,
    96
  );
  hairUndercoat = createHairlineUndercoat();
  scene.add(hairUndercoat);
}

function rebuildHairObject() {
  if (hair) {
    scene.remove(hair);
    hair.geometry.dispose();
    hair.material.dispose();
  }
  if (hairUndercoat) {
    scene.remove(hairUndercoat);
    for (const layer of hairUndercoat.children) {
      layer.geometry.dispose();
      layer.material.dispose();
    }
    hairUndercoat = null;
    hairUndercoatCoverageProfile = null;
  }
  hairGeometryTimings = [];
  hairDrawCount = 0;
  if (hairRenderMode === "fatline") {
    rebuildFatlineObject();
    updateHairGeometry();
    return;
  }
  const vertexCapacity = solver.guideCount * solver.segments * renderFibersPerGuide * 2;
  hairPositions = new Float32Array(vertexCapacity * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(hairPositions, 3));
  const lineOpacity = Math.max(0.42, 0.78 - renderFibersPerGuide * 0.02);
  const material = new THREE.LineBasicMaterial({
    color: hairColor(),
    transparent: true,
    opacity: lineOpacity,
  });
  material.userData.baseOpacity = lineOpacity;
  hair = new THREE.LineSegments(geometry, material);
  hair.frustumCulled = false;
  scene.add(hair);
  updateHairGeometry();
}

function rebuildSolver() {
  const guideCount = Number(document.querySelector("#guides").value);
  const iterations = Number(document.querySelector("#iterations").value);
  const preset = document.querySelector("#preset").value;
  solver = new HairSolver({
    guideCount,
    segments: 12,
    iterations,
    preset,
    renderFibersPerGuide,
    collectiveRulesEnabled: deterministicReplay.collectiveRulesEnabled,
    spatialFrictionEnabled: deterministicReplay.spatialFrictionEnabled,
    rootDirectorMode,
    rootDirectorStrength,
    faceClearGroomEnabled,
  });
  hydrationDetailOffsetCacheKey = "";
  groomBindings = groomMode.startsWith("section_")
    ? buildGroomInterpolationBindings(solver.roots, solver.guideCount, renderFibersPerGuide, {
        parentCount: [
          "section_volume",
          "section_patch_lock",
          "section_authored_rest",
          "section_hairline_flow",
          "section_sparse_cage",
        ].includes(groomMode)
          ? 3
          : 2,
        patchLockEnabled,
      })
    : null;
  if (groomBindings && independentDisplayFolliclesEnabled) {
    const display = buildIndependentDisplayFollicles(solver.roots, groomBindings.bindingCount);
    const displayHeroIds = Uint8Array.from({ length: groomBindings.bindingCount }, (_, binding) =>
      sparseGroomHeroForRoot(display.roots.subarray(binding * 3, binding * 3 + 3))
    );
    const displaySublockPhases = Uint8Array.from(
      { length: groomBindings.bindingCount },
      (_, binding) => sparseGroomSublockPhase(display.roots.subarray(binding * 3, binding * 3 + 3))
    );
    const displayBodyWidthMultipliers = Float32Array.from(
      { length: groomBindings.bindingCount },
      (_, binding) =>
        sparseGroomCoreBodyWidthMultiplier(
          display.roots.subarray(binding * 3, binding * 3 + 3),
          displayHeroIds[binding],
          displaySublockPhases[binding]
        )
    );
    const displayLengthSamples = Array.from({ length: groomBindings.bindingCount }, (_, binding) =>
      layeredHaircutSample(
        display.roots.subarray(binding * 3, binding * 3 + 3),
        displayHeroIds[binding],
        displaySublockPhases[binding]
      )
    );
    const displayLaminaSamples = lockLaminaeEnabled
      ? buildLockLaminaAssignments(display.roots, displayHeroIds)
      : [];
    const displayLaminaAssignmentTelemetry = lockLaminaeEnabled
      ? summarizeLockLaminaAssignments(display.roots, displayHeroIds, displayLaminaSamples)
      : null;
    Object.assign(groomBindings, {
      owners: display.owners,
      neighbors: display.neighbors,
      secondaryNeighbors: display.secondaryNeighbors,
      neighborWeights: display.neighborWeights,
      secondaryNeighborWeights: display.secondaryNeighborWeights,
      displayRoots: display.roots,
      displayNormals: display.normals,
      displayFollicleTelemetry: display.telemetry,
      displayHeroIds,
      displaySublockPhases,
      displayBodyWidthMultipliers,
      displayLengthRatios: Float32Array.from(
        displayLengthSamples,
        (sample) => sample.retainedRatio
      ),
      displayLengthZones: Uint8Array.from(displayLengthSamples, (sample) => sample.zone),
      displayLaminaCoordinates: Float32Array.from(
        displayLaminaSamples,
        (sample) => sample.coordinate
      ),
      displayLaminaRoles: Uint8Array.from(displayLaminaSamples, (sample) => sample.role),
      displayLaminaIds: Uint8Array.from(displayLaminaSamples, (sample) => sample.laminaId),
      displayLaminaWidthMultipliers: Float32Array.from(
        displayLaminaSamples,
        (sample) => sample.bodyWidthMultiplier
      ),
      displayLaminaRetainedLengths: Float32Array.from(
        displayLaminaSamples,
        (sample) => sample.retainedLength
      ),
      displayLaminaAssignmentTelemetry,
      independentDisplayFollicles: true,
      displayFollicleLayoutId: DISPLAY_FOLLICLE_LAYOUT_ID,
    });
    groomBindings.bindingDigest = groomBindingDigest(groomBindings);
  }
  authoredReferenceReady = false;
  authoredTopologyDigest = null;
  sparseGroomHeroByGuide = sparseGroomCageEnabled
    ? Uint8Array.from({ length: solver.guideCount }, (_, guide) =>
        sparseGroomHeroForRoot(solver.roots.subarray(guide * 3, guide * 3 + 3))
      )
    : new Uint8Array(0);
  if (groomBindings) groomBindingBuildCount += 1;
  filmDirection.startTime = null;
  filmDirection.cutDone = false;
  filmDirection.cutStrands.clear();
  deterministicReplay.state = createReplayState();
  applyMaterialControls();
  rebuildHairObject();
  rebuildSectionControlTube();
  rebuildGroomEnvelopeBoundaryMeshes();
  rebuildHairMassMeshes();
  rebuildPhysicsGuideCage();
  const activeExperiments = [
    solver.spatialFriction.enabled ? "spatial friction" : null,
    solver.rootDirector.enabled ? solver.rootDirector.mode.replaceAll("_", " ") : null,
  ].filter(Boolean);
  status.textContent = `Running deterministic ${preset} preset${activeExperiments.length ? ` with experimental ${activeExperiments.join(" + ")}` : ""}.`;
}

function startCombPass(condition, cycle = false) {
  const material = COMB_MATERIAL_CONDITIONS[condition];
  if (!material) throw new Error(`unknown comb material condition: ${condition}`);
  document.querySelector("#moisture").value = String(material.moisture);
  document.querySelector("#product").value = String(material.product);
  document.querySelector("#moisture").dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("#product").dispatchEvent(new Event("input", { bubbles: true }));
  deterministicReplay.enabled = true;
  deterministicReplay.autoplay = true;
  deterministicReplay.targetStep = 0;
  deterministicReplay.config = {
    dt: 1 / 60,
    baseWind: 0.08,
    gust: 0.08,
    cut: "none",
    comb: {
      startStep: 30,
      endStep: 150,
      startX: -1.35,
      endX: 1.35,
      ...(cycle ? { returnStartStep: 165, returnEndStep: 285, returnX: -1.35 } : {}),
    },
  };
  rebuildSolver();
  document.querySelector("#scenario-label").textContent =
    `Comb-through instrument · ${condition}${cycle ? " cycle" : ""}`;
  status.textContent = cycle
    ? `${material.label} comb cycle: outward pass, pause, then visible return.`
    : `${material.label} comb pass: settling, then measuring steps 30–150.`;
}

function updateMaterialStudyTable() {
  for (const condition of materialStudy.conditions) {
    const row = document.querySelector(`[data-study-condition="${condition}"]`);
    const summary = materialStudy.results[condition];
    if (!summary) {
      row.textContent =
        condition === materialStudy.conditions[materialStudy.index] ? "running" : "—";
      continue;
    }
    row.textContent = `${summary.peak_reaction_proxy.toFixed(0)} · ${summary.accumulated_work_proxy.toFixed(0)} · ${summary.clump_releases} · ${summary.persistent_clump_bonds} · ${summary.maximum_clump_age_steps} · ${(summary.peak_relative_stretch_error * 100).toFixed(2)}%`;
  }
}

function startMaterialStudy() {
  document.querySelector("#guides").value = "256";
  document.querySelector("#iterations").value = "6";
  document.querySelector("#guides").dispatchEvent(new Event("input", { bubbles: true }));
  document.querySelector("#iterations").dispatchEvent(new Event("input", { bubbles: true }));
  materialStudy.enabled = true;
  materialStudy.index = 0;
  materialStudy.results = {};
  updateMaterialStudyTable();
  startCombPass(materialStudy.conditions[0]);
  status.textContent = "Material study 1/3: dry comb pass.";
}

function advanceMaterialStudy() {
  if (!materialStudy.enabled || deterministicReplay.state.step < 180) return;
  const condition = materialStudy.conditions[materialStudy.index];
  materialStudy.results[condition] = summarizeCombReceipt(solver.receipt());
  materialStudy.index += 1;
  updateMaterialStudyTable();
  if (materialStudy.index >= materialStudy.conditions.length) {
    materialStudy.enabled = false;
    deterministicReplay.autoplay = false;
    status.textContent = "Three-condition material study complete; comparison table is live.";
    return;
  }
  const next = materialStudy.conditions[materialStudy.index];
  startCombPass(next);
  updateMaterialStudyTable();
  status.textContent = `Material study ${materialStudy.index + 1}/3: ${COMB_MATERIAL_CONDITIONS[next].label.toLowerCase()} comb pass.`;
}

function applyMaterialControls() {
  solver.setMoisture(Number(document.querySelector("#moisture").value));
  solver.setProduct(Number(document.querySelector("#product").value));
  solver.setSectionLift(Number(document.querySelector("#lift").value));
  solver.setSectionPose({
    section: Number(document.querySelector("#pose-section").value),
    lift: Number(document.querySelector("#pose-lift").value),
    sweep: Number(document.querySelector("#pose-sweep").value),
  });
  solver.wind = Number(document.querySelector("#wind").value);
}

function updateHairGeometry() {
  updateFullGroomPresentation();
  updateSectionPresentation();
  if (groomBindings) updateGroomEnvelopeFrames();
  const geometryStart = performance.now();
  if (hairRenderMode === "fatline") {
    updateFatlineGeometry();
    hairGeometryTimings.push(performance.now() - geometryStart);
    if (hairGeometryTimings.length > 660) hairGeometryTimings.shift();
    updatePhysicsGuideCage();
    updateSectionControlTube();
    updateGroomEnvelopeBoundaryMeshes();
    updateHairMassMeshes();
    return;
  }
  let cursor = 0;
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    for (let copy = 0; copy < renderFibersPerGuide; copy += 1) {
      const phase =
        strand * 1.618 + ((copy - 1) * Math.PI * 2) / Math.max(1, renderFibersPerGuide - 1);
      const offset = copy === 0 ? 0 : 0.009 + (strand % 3) * 0.0018;
      const offsetX = Math.cos(phase) * offset;
      const offsetZ = Math.sin(phase) * offset;
      for (let segment = 0; segment < solver.activeSegments[strand]; segment += 1) {
        for (const particle of [segment, segment + 1]) {
          const source = solver.index(strand, particle);
          hairPositions[cursor] = solver.positions[source] + offsetX;
          hairPositions[cursor + 1] = solver.positions[source + 1];
          hairPositions[cursor + 2] = solver.positions[source + 2] + offsetZ;
          cursor += 3;
        }
      }
    }
  }
  hair.geometry.setDrawRange(0, cursor / 3);
  hair.geometry.attributes.position.needsUpdate = true;
  hair.geometry.computeBoundingSphere();
  hairDrawCount = cursor / 6;
  updatePhysicsGuideCage();
  updateSectionControlTube();
  updateGroomEnvelopeBoundaryMeshes();
  updateHairMassMeshes();
}

function updateFatlineGeometry() {
  if (groomBindings) {
    updateSectionInterpolatedFatlineGeometry();
    return;
  }
  const { geometry } = hair;
  const starts = geometry.attributes.instanceStart.array;
  const ends = geometry.attributes.instanceEnd.array;
  const colors = geometry.attributes.instanceColor.array;
  const widthsStart = geometry.attributes.instanceWidthStart.array;
  const widthsEnd = geometry.attributes.instanceWidthEnd.array;
  let instance = 0;
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    const activeSegments = solver.activeSegments[strand];
    for (let copy = 0; copy < renderFibersPerGuide; copy += 1) {
      const phase =
        strand * 1.618 + ((copy - 1) * Math.PI * 2) / Math.max(1, renderFibersPerGuide - 1);
      const offset = copy === 0 ? 0 : 0.009 + (strand % 3) * 0.0018;
      const offsetX = Math.cos(phase) * offset;
      const offsetZ = Math.sin(phase) * offset;
      for (let segment = 0; segment < activeSegments; segment += 1) {
        const start = solver.index(strand, segment);
        const end = solver.index(strand, segment + 1);
        const cursor = instance * 3;
        starts[cursor] = solver.positions[start] + offsetX;
        starts[cursor + 1] = solver.positions[start + 1];
        starts[cursor + 2] = solver.positions[start + 2] + offsetZ;
        ends[cursor] = solver.positions[end] + offsetX;
        ends[cursor + 1] = solver.positions[end + 1];
        ends[cursor + 2] = solver.positions[end + 2] + offsetZ;
        writeHydratedFiberStyle(
          colors,
          widthsStart,
          widthsEnd,
          instance,
          cursor,
          strand,
          copy,
          segment,
          segment + 1,
          activeSegments
        );
        instance += 1;
      }
    }
  }
  geometry.instanceCount = instance;
  for (const name of FATLINE_DYNAMIC_ATTRIBUTES) {
    geometry.attributes[name].needsUpdate = true;
  }
  hairDrawCount = instance;
}

function writeBlendedGroomCurvePointUncached(
  target,
  targetOffset,
  binding,
  owner,
  neighbor,
  secondaryNeighbor,
  copy,
  particle,
  activeSegments,
  neighborWeight,
  secondaryNeighborWeight,
  secondaryActiveSegments
) {
  const clampedParticle = Math.max(0, Math.min(activeSegments, particle));
  if (
    independentDisplayFolliclesEnabled &&
    sparseGroomCageEnabled &&
    groomBindings.independentDisplayFollicles
  ) {
    const displayRootOffset = binding * 3;
    const displayRoot = groomBindings.displayRoots.subarray(
      displayRootOffset,
      displayRootOffset + 3
    );
    if (clampedParticle === 0) {
      target[targetOffset] = displayRoot[0];
      target[targetOffset + 1] = displayRoot[1];
      target[targetOffset + 2] = displayRoot[2];
      return;
    }
    const fraction = clampedParticle / Math.max(1, activeSegments);
    const stations = solver.segments + 1;
    const displayFrame = (binding * stations + clampedParticle) * 3;
    target[targetOffset] = displayFollicleRestCenters[displayFrame];
    target[targetOffset + 1] = displayFollicleRestCenters[displayFrame + 1];
    target[targetOffset + 2] = displayFollicleRestCenters[displayFrame + 2];
    const ownerFrame = (owner * stations + clampedParticle) * 3;
    const neighborFrame = (neighbor * stations + clampedParticle) * 3;
    const secondaryFrame = (secondaryNeighbor * stations + clampedParticle) * 3;
    const transfer = authoredGroomDisplacementTransferAt(fraction);
    const ownerWeight = 1 - neighborWeight - secondaryNeighborWeight;
    for (let axis = 0; axis < 3; axis += 1) {
      const deformation =
        ownerWeight *
          (authoredLiveCenters[ownerFrame + axis] - authoredRestCenters[ownerFrame + axis]) +
        neighborWeight *
          (authoredLiveCenters[neighborFrame + axis] - authoredRestCenters[neighborFrame + axis]) +
        secondaryNeighborWeight *
          (authoredLiveCenters[secondaryFrame + axis] - authoredRestCenters[secondaryFrame + axis]);
      target[targetOffset + axis] += deformation * transfer;
    }
    const crossSectionScale = authoredGroomCrossSectionScaleAt(fraction);
    const sample = binding * 2;
    const outward =
      groomEnvelopeSamples[sample] * AUTHORED_GROOM_OUTWARD_RADIUS_METERS * crossSectionScale;
    const lateral =
      groomEnvelopeSamples[sample + 1] * AUTHORED_GROOM_LATERAL_RADIUS_METERS * crossSectionScale;
    for (let axis = 0; axis < 3; axis += 1) {
      target[targetOffset + axis] +=
        authoredOutwards[ownerFrame + axis] * outward +
        authoredLaterals[ownerFrame + axis] * lateral;
    }
    return;
  }
  if (authoredRestGroomEnabled && authoredReferenceReady) {
    const ownerRoot = owner * 3;
    const neighborRoot = neighbor * 3;
    const secondaryRoot = secondaryNeighbor * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      target[targetOffset + axis] = interpolateGroomScalar(
        solver.roots[ownerRoot + axis],
        solver.roots[neighborRoot + axis],
        neighborWeight,
        solver.roots[secondaryRoot + axis],
        0
      );
    }
    projectPointToScalpShell(
      target[targetOffset],
      target[targetOffset + 1],
      target[targetOffset + 2],
      target,
      targetOffset
    );
    if (clampedParticle === 0) return;
    const fraction = clampedParticle / Math.max(1, activeSegments);
    const stations = solver.segments + 1;
    const frame = (owner * stations + Math.min(solver.segments, clampedParticle)) * 3;
    const rootAnchor = 1 - envelopeSmoothStep(fraction / 0.26);
    const crossSectionScale = authoredGroomCrossSectionScaleAt(fraction);
    const sample = (owner * renderFibersPerGuide + copy) * 2;
    const outward =
      groomEnvelopeSamples[sample] * AUTHORED_GROOM_OUTWARD_RADIUS_METERS * crossSectionScale;
    const lateral =
      groomEnvelopeSamples[sample + 1] * AUTHORED_GROOM_LATERAL_RADIUS_METERS * crossSectionScale;
    for (let axis = 0; axis < 3; axis += 1) {
      const rootDelta = target[targetOffset + axis] - solver.roots[ownerRoot + axis];
      target[targetOffset + axis] =
        authoredLiveCenters[frame + axis] +
        rootDelta * rootAnchor +
        authoredOutwards[frame + axis] * outward +
        authoredLaterals[frame + axis] * lateral;
    }
    return;
  }
  const secondaryWeight = groomSecondaryWeightAt(
    clampedParticle,
    activeSegments,
    secondaryNeighborWeight,
    secondaryActiveSegments
  );
  const ownerPoint = solver.index(owner, clampedParticle);
  const neighborPoint = solver.index(neighbor, clampedParticle);
  const secondaryPoint = solver.index(secondaryNeighbor, clampedParticle);
  transportGroomPoint(
    target,
    targetOffset,
    solver.positions,
    solver.index(owner, 0),
    ownerPoint,
    solver.index(neighbor, 0),
    neighborPoint,
    neighborWeight,
    solver.index(secondaryNeighbor, 0),
    secondaryPoint,
    secondaryWeight,
    groomDonorShapeTransferAt(clampedParticle / Math.max(1, activeSegments))
  );
  if (clampedParticle === 0) {
    projectPointToScalpShell(
      target[targetOffset],
      target[targetOffset + 1],
      target[targetOffset + 2],
      target,
      targetOffset
    );
    return;
  }
  const particlesPerGuide = solver.segments + 1;
  const detailOffset =
    (owner * renderFibersPerGuide * particlesPerGuide +
      copy * particlesPerGuide +
      Math.min(solver.segments, clampedParticle)) *
    3;
  target[targetOffset] += hydrationDetailOffsets[detailOffset];
  target[targetOffset + 1] += hydrationDetailOffsets[detailOffset + 1];
  target[targetOffset + 2] += hydrationDetailOffsets[detailOffset + 2];
  applyGroomEnvelopeToPoint(target, targetOffset, owner, copy, clampedParticle, activeSegments);
  applyPatchLockToPoint(target, targetOffset, owner, copy, clampedParticle, activeSegments);
}

function rebuildGroomCurvePointCache() {
  const stations = solver.segments + 1;
  const requiredValues = groomBindings.bindingCount * stations * 3;
  if (groomEnvelopeCurvePointCache.length !== requiredValues) {
    groomEnvelopeCurvePointCache = new Float64Array(requiredValues);
  }
  const displaySpread = activeHydrationState.spreadScale ?? 1;
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const owner = groomBindings.owners[binding];
    const neighbor = groomBindings.neighbors[binding];
    const secondaryNeighbor = groomBindings.secondaryNeighbors[binding];
    const neighborWeight = groomBindings.neighborWeights[binding];
    const secondaryNeighborWeight = groomBindings.secondaryNeighborWeights[binding];
    const displayNeighborWeight = Math.max(0, Math.min(1, neighborWeight * displaySpread));
    const displaySecondaryWeight = Math.max(
      0,
      Math.min(1 - displayNeighborWeight, secondaryNeighborWeight * displaySpread)
    );
    const boundActiveSegments = groomBindingActiveSegments(
      solver.activeSegments,
      owner,
      neighbor,
      neighborWeight
    );
    const activeSegments = displayFollicleRootDiagnostic
      ? Math.min(2, boundActiveSegments)
      : boundActiveSegments;
    const secondaryActiveSegments = solver.activeSegments[secondaryNeighbor];
    const copy = binding % renderFibersPerGuide;
    for (let particle = 0; particle <= activeSegments; particle += 1) {
      const target = (binding * stations + particle) * 3;
      writeBlendedGroomCurvePointUncached(
        groomEnvelopeCurvePointCache,
        target,
        binding,
        owner,
        neighbor,
        secondaryNeighbor,
        copy,
        particle,
        activeSegments,
        displayNeighborWeight,
        displaySecondaryWeight,
        secondaryActiveSegments
      );
    }
  }
}

function patchLockDistanceTelemetry() {
  if (!groomBindings?.patchLockEnabled) return null;
  const fractions = [0.25, 0.6, 0.9];
  const distances = fractions.map(() => []);
  let maximumRootShellError = 0;
  const stations = solver.segments + 1;
  const radiusX = SCALP_RADII[0] + SCALP_ROOT_OFFSET;
  const radiusY = SCALP_RADII[1] + SCALP_ROOT_OFFSET;
  const radiusZ = SCALP_RADII[2] + SCALP_ROOT_OFFSET;
  const patchGuideCounts = new Uint16Array(groomBindings.patchCount);
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    patchGuideCounts[groomBindings.guidePatchIds[guide]] += 1;
  }
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const owner = groomBindings.owners[binding];
    const neighbor = groomBindings.neighbors[binding];
    const activeSegments = groomBindingActiveSegments(
      solver.activeSegments,
      owner,
      neighbor,
      groomBindings.neighborWeights[binding]
    );
    const root = binding * stations * 3;
    const dx = (groomEnvelopeCurvePointCache[root] - SCALP_CENTER[0]) / radiusX;
    const dy = (groomEnvelopeCurvePointCache[root + 1] - SCALP_CENTER[1]) / radiusY;
    const dz = (groomEnvelopeCurvePointCache[root + 2] - SCALP_CENTER[2]) / radiusZ;
    maximumRootShellError = Math.max(maximumRootShellError, Math.abs(Math.hypot(dx, dy, dz) - 1));
    const patch = groomBindings.guidePatchIds[owner];
    for (let sampleIndex = 0; sampleIndex < fractions.length; sampleIndex += 1) {
      const particle = Math.max(1, Math.round(activeSegments * fractions[sampleIndex]));
      const point = (binding * stations + particle) * 3;
      const center = (patch * stations + particle) * 3;
      distances[sampleIndex].push(
        Math.hypot(
          groomEnvelopeCurvePointCache[point] - groomPatchCenters[center],
          groomEnvelopeCurvePointCache[point + 1] - groomPatchCenters[center + 1],
          groomEnvelopeCurvePointCache[point + 2] - groomPatchCenters[center + 2]
        )
      );
    }
  }
  const summarize = (values) => {
    values.sort((left, right) => left - right);
    const quantile = (fraction) =>
      values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
    return { median_m: quantile(0.5), p90_m: quantile(0.9) };
  };
  return {
    enabled: true,
    field_identity: PATCH_LOCK_FIELD_ID,
    topology_digest: groomBindings.bindingDigest,
    patch_count: groomBindings.patchCount,
    guides_per_patch: {
      minimum: Math.min(...patchGuideCounts),
      maximum: Math.max(...patchGuideCounts),
    },
    convergence_fraction: [PATCH_LOCK_CONVERGENCE_START, PATCH_LOCK_CONVERGENCE_END],
    cross_section_radii_m: [PATCH_LOCK_OUTWARD_RADIUS_METERS, PATCH_LOCK_LATERAL_RADIUS_METERS],
    maximum_root_shell_error: maximumRootShellError,
    child_to_patch_center: Object.fromEntries(
      fractions.map((fraction, index) => [String(fraction), summarize(distances[index])])
    ),
    debug_patch_colors: patchDebugColors,
    physics_authority: "none_renderer_only",
  };
}

function summarizeOccupancyCores() {
  const stations = solver.segments + 1;
  const summarize = (values) => {
    values.sort((left, right) => left - right);
    return {
      minimum: values[0],
      p50: values[Math.floor(values.length * 0.5)],
      maximum: values.at(-1),
    };
  };
  return Object.fromEntries(
    [0.35, 0.6, 0.85].map((fraction) => {
      const particle = Math.round(solver.segments * fraction);
      const groups = Array.from({ length: SPARSE_GROOM_HEROES.length * 3 }, () => []);
      for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
        const group =
          groomBindings.displayHeroIds[binding] * 3 + groomBindings.displaySublockPhases[binding];
        const point = (binding * stations + particle) * 3;
        groups[group].push([
          displayFollicleRestCenters[point],
          displayFollicleRestCenters[point + 1],
          displayFollicleRestCenters[point + 2],
        ]);
      }
      const centroids = groups.map((points) => {
        if (points.length === 0) return null;
        return [0, 1, 2].map(
          (axis) => points.reduce((sum, point) => sum + point[axis], 0) / points.length
        );
      });
      const heroTangents = SPARSE_GROOM_HEROES.map((hero) => {
        const before = sparseGroomRestPoint(
          hero.root,
          Math.max(0, fraction - 0.001),
          new Float64Array(3)
        );
        const after = sparseGroomRestPoint(
          hero.root,
          Math.min(1, fraction + 0.001),
          new Float64Array(3)
        );
        const tangent = [after[0] - before[0], after[1] - before[1], after[2] - before[2]];
        const length = Math.hypot(...tangent) || 1;
        return tangent.map((value) => value / length);
      });
      const radii = [];
      for (let group = 0; group < groups.length; group += 1) {
        const centroid = centroids[group];
        if (!centroid || groups[group].length < 2) continue;
        const tangent = heroTangents[Math.floor(group / 3)];
        const squared =
          groups[group].reduce((sum, point) => {
            const delta = [point[0] - centroid[0], point[1] - centroid[1], point[2] - centroid[2]];
            const along = delta[0] * tangent[0] + delta[1] * tangent[1] + delta[2] * tangent[2];
            return sum + Math.max(0, delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2 - along ** 2);
          }, 0) / groups[group].length;
        radii.push(Math.sqrt(squared));
      }
      const separations = [];
      for (let hero = 0; hero < SPARSE_GROOM_HEROES.length; hero += 1) {
        for (const [left, right] of [
          [0, 1],
          [1, 2],
        ]) {
          const a = centroids[hero * 3 + left];
          const b = centroids[hero * 3 + right];
          if (!a || !b) continue;
          const tangent = heroTangents[hero];
          const delta = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
          const along = delta[0] * tangent[0] + delta[1] * tangent[1] + delta[2] * tangent[2];
          separations.push(
            Math.sqrt(Math.max(0, delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2 - along ** 2))
          );
        }
      }
      return [
        String(fraction),
        {
          within_core_rms_radius_m: summarize(radii),
          adjacent_core_centroid_separation_m: summarize(separations),
        },
      ];
    })
  );
}

function independentDisplayFollicleTelemetry() {
  const stations = solver.segments + 1;
  const outwardDots = [];
  const heroCounts = new Uint16Array(SPARSE_GROOM_HEROES.length);
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const rootOffset = binding * 3;
    const curveRoot = binding * stations * 3;
    const dx =
      groomEnvelopeCurvePointCache[curveRoot + 3] - groomEnvelopeCurvePointCache[curveRoot];
    const dy =
      groomEnvelopeCurvePointCache[curveRoot + 4] - groomEnvelopeCurvePointCache[curveRoot + 1];
    const dz =
      groomEnvelopeCurvePointCache[curveRoot + 5] - groomEnvelopeCurvePointCache[curveRoot + 2];
    const length = Math.hypot(dx, dy, dz) || 1;
    outwardDots.push(
      (dx * groomBindings.displayNormals[rootOffset] +
        dy * groomBindings.displayNormals[rootOffset + 1] +
        dz * groomBindings.displayNormals[rootOffset + 2]) /
        length
    );
    heroCounts[groomBindings.displayHeroIds[binding]] += 1;
  }
  const sortedHeroCounts = Array.from(heroCounts).sort((left, right) => left - right);
  const summarizeWidthAt = (fraction) => {
    const values = Array.from(groomBindings.displayBodyWidthMultipliers, (bodyMultiplier) =>
      sparseGroomWidthMultiplierAt(bodyMultiplier, fraction)
    ).sort((left, right) => left - right);
    const quantile = (value) =>
      values[Math.min(values.length - 1, Math.floor(value * values.length))];
    return {
      mean: values.reduce((sum, value) => sum + value, 0) / values.length,
      p10: quantile(0.1),
      p50: quantile(0.5),
      p90: quantile(0.9),
      maximum: values.at(-1),
    };
  };
  return {
    ...groomBindings.displayFollicleTelemetry,
    hero_occupancy: {
      minimum: sortedHeroCounts[0],
      median: sortedHeroCounts[Math.floor(sortedHeroCounts.length * 0.5)],
      maximum: sortedHeroCounts.at(-1),
    },
    initial_tangent_outward_dot: {
      minimum: Math.min(...outwardDots),
      mean: outwardDots.reduce((sum, value) => sum + value, 0) / outwardDots.length,
    },
    motion_transfer_contract: {
      center_deformation_operator: "same_three_guide_weighted_deformation_applied_to_rest_curve",
      cross_section_frame_motion_also_applied: true,
      final_rendered_point_ratio_and_cosine: "not_measured",
    },
    debug_nearest_guide_colors: displayFollicleGuideColors,
    root_diagnostic_first_two_segments_only: displayFollicleRootDiagnostic,
    correlated_rest_hierarchy: correlatedRestHierarchyEnabled
      ? {
          field_identity: SPARSE_GROOM_CORRELATED_HIERARCHY_ID,
          sublock_phase_count: 3,
          root_zero_through_fraction: 0.12,
          maximum_observed_residual_m: maximumCorrelatedResidual,
          debug_sublock_phase_colors: sublockPhaseColors,
        }
      : null,
    cross_section_occupancy_remap: occupancyRemapEnabled
      ? {
          field_identity: SPARSE_GROOM_OCCUPANCY_REMAP_ID,
          core_count: 3,
          root_zero_through_fraction: 0.15,
          maximum_observed_remap_m: maximumOccupancyRemap,
          core_statistics: occupancyCoreTelemetryCache,
        }
      : null,
    core_width_hierarchy: coreWidthHierarchyEnabled
      ? {
          field_identity: SPARSE_GROOM_CORE_WIDTH_FIELD_ID,
          root_ramp_end_fraction: 0.18,
          multiplier_at_fraction: {
            0: summarizeWidthAt(0),
            0.4: summarizeWidthAt(0.4),
            0.8: summarizeWidthAt(0.8),
          },
          debug_grayscale_width: coreWidthDiagnostic,
        }
      : null,
    layered_haircut: layeredHaircutEnabled ? layeredHaircutTelemetry() : null,
    overlapping_lock_laminae: lockLaminaeEnabled ? lockLaminaTelemetry() : null,
    physics_authority: "none_renderer_only",
  };
}

function lockLaminaTelemetry() {
  const roleCounts = new Uint32Array(3);
  const laminaCounts = new Uint32Array(3);
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    roleCounts[groomBindings.displayLaminaRoles[binding]] += 1;
    laminaCounts[groomBindings.displayLaminaIds[binding]] += 1;
  }
  const surfaceAt = (fraction) => ({
    full_width_m: lockLaminaHalfWidthAt(fraction) * 2,
    adjacent_overlap_ratio: lockLaminaOverlapRatioAt(fraction),
  });
  return {
    field_identity: LOCK_LAMINAE_FIELD_ID,
    lamina_count_per_hero: 3,
    role_counts: {
      interior: roleCounts[0],
      left_edge: roleCounts[1],
      right_edge: roleCounts[2],
    },
    lamina_counts: Array.from(laminaCounts),
    root_zero_through_fraction: 0.08,
    surface_ramp_end_fraction: 0.18,
    maximum_root_zone_displacement_m: maximumLockLaminaRootDisplacement,
    surface_at_fraction: {
      0.4: surfaceAt(0.4),
      0.7: surfaceAt(0.7),
    },
    maximum_role_boundary_position_gap_m:
      groomBindings.displayLaminaAssignmentTelemetry.evaluated_role_boundary_position_gap_m,
    role_boundary_contract: "continuous_surface_coordinate_and_zero_edge_feather_at_72pct",
    per_frame_neighbor_search: false,
    debug_role_colors: lockLaminaeDiagnostic,
    assignment: groomBindings.displayLaminaAssignmentTelemetry,
  };
}

function layeredHaircutTelemetry() {
  const byZone = Object.fromEntries(LAYERED_HAIRCUT_ZONE_NAMES.map((name) => [name, []]));
  let belowFloor = 0;
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const ratio = groomBindings.displayLengthRatios[binding];
    const zone = LAYERED_HAIRCUT_ZONE_NAMES[groomBindings.displayLengthZones[binding]];
    byZone[zone].push(ratio);
    if (ratio < 0.7) belowFloor += 1;
  }
  const summarize = (values) => {
    values.sort((left, right) => left - right);
    const quantile = (fraction) =>
      values[Math.min(values.length - 1, Math.floor(fraction * values.length))];
    return {
      count: values.length,
      p10: quantile(0.1),
      p50: quantile(0.5),
      p90: quantile(0.9),
    };
  };
  return {
    field_identity: LAYERED_HAIRCUT_FIELD_ID,
    retained_length_by_zone: Object.fromEntries(
      Object.entries(byZone).map(([zone, values]) => [zone, summarize(values)])
    ),
    below_seventy_percent: belowFloor,
    taper_fraction_of_new_length: 0.12,
    debug_endpoint_zone_colors: layeredHaircutDiagnostic,
    curve_sampling: "full_rest_curve_reparameterized_to_retained_fraction",
  };
}

function authoredGroomTelemetry() {
  if (!authoredRestGroomEnabled || !authoredReferenceReady) return null;
  const stations = solver.segments + 1;
  const outwardDots = [];
  const turningAngles = [];
  const rootTurningAngles = [];
  const handoffFlowDots = [];
  const laydownClearances = [];
  const handoffTangentAngles = [];
  const transferFractions = [0.6, 0.9];
  const transferRatios = transferFractions.map(() => []);
  const transferCosines = transferFractions.map(() => []);
  let maximumRootShellError = 0;
  const radiusX = SCALP_RADII[0] + SCALP_ROOT_OFFSET;
  const radiusY = SCALP_RADII[1] + SCALP_ROOT_OFFSET;
  const radiusZ = SCALP_RADII[2] + SCALP_ROOT_OFFSET;
  for (let guide = 0; guide < solver.guideCount; guide += 1) {
    const root = guide * stations * 3;
    let firstX = authoredRestCenters[root + 3] - authoredRestCenters[root];
    let firstY = authoredRestCenters[root + 4] - authoredRestCenters[root + 1];
    let firstZ = authoredRestCenters[root + 5] - authoredRestCenters[root + 2];
    const firstLength = Math.hypot(firstX, firstY, firstZ) || 1;
    firstX /= firstLength;
    firstY /= firstLength;
    firstZ /= firstLength;
    outwardDots.push(
      firstX * solver.rootNormals[guide * 3] +
        firstY * solver.rootNormals[guide * 3 + 1] +
        firstZ * solver.rootNormals[guide * 3 + 2]
    );
    let priorTangent = null;
    for (let particle = 0; particle < solver.segments; particle += 1) {
      const left = (guide * stations + particle) * 3;
      const right = left + 3;
      const dx = authoredRestCenters[right] - authoredRestCenters[left];
      const dy = authoredRestCenters[right + 1] - authoredRestCenters[left + 1];
      const dz = authoredRestCenters[right + 2] - authoredRestCenters[left + 2];
      const length = Math.hypot(dx, dy, dz) || 1;
      const tangent = [dx / length, dy / length, dz / length];
      if (priorTangent) {
        const turningAngle =
          (Math.acos(
            Math.max(
              -1,
              Math.min(
                1,
                tangent[0] * priorTangent[0] +
                  tangent[1] * priorTangent[1] +
                  tangent[2] * priorTangent[2]
              )
            )
          ) *
            180) /
          Math.PI;
        turningAngles.push(turningAngle);
        if ((particle + 1) / solver.segments <= 0.2) rootTurningAngles.push(turningAngle);
      }
      priorTangent = tangent;
    }
    if (authoredLaydownEnabled) {
      const handoffParticle = Math.max(
        1,
        Math.min(
          solver.segments - 1,
          Math.round(AUTHORED_ROOT_HANDOFF_STATION_FRACTION * solver.segments)
        )
      );
      const before = (guide * stations + handoffParticle - 1) * 3;
      const handoff = (guide * stations + handoffParticle) * 3;
      const after = (guide * stations + handoffParticle + 1) * 3;
      const beforeVector = [
        authoredRestCenters[handoff] - authoredRestCenters[before],
        authoredRestCenters[handoff + 1] - authoredRestCenters[before + 1],
        authoredRestCenters[handoff + 2] - authoredRestCenters[before + 2],
      ];
      const afterVector = [
        authoredRestCenters[after] - authoredRestCenters[handoff],
        authoredRestCenters[after + 1] - authoredRestCenters[handoff + 1],
        authoredRestCenters[after + 2] - authoredRestCenters[handoff + 2],
      ];
      const beforeLength = Math.hypot(...beforeVector) || 1;
      const afterLength = Math.hypot(...afterVector) || 1;
      const tangentDot =
        (beforeVector[0] * afterVector[0] +
          beforeVector[1] * afterVector[1] +
          beforeVector[2] * afterVector[2]) /
        (beforeLength * afterLength);
      handoffTangentAngles.push((Math.acos(Math.max(-1, Math.min(1, tangentDot))) * 180) / Math.PI);
      const normalOffset = guide * 3;
      const targetOffset = guide * solver.rootDirector.zoneSegments * 3;
      const targetDotNormal =
        solver.rootDirectorTargets[targetOffset] * solver.rootNormals[normalOffset] +
        solver.rootDirectorTargets[targetOffset + 1] * solver.rootNormals[normalOffset + 1] +
        solver.rootDirectorTargets[targetOffset + 2] * solver.rootNormals[normalOffset + 2];
      const flow = [
        solver.rootDirectorTargets[targetOffset] -
          solver.rootNormals[normalOffset] * targetDotNormal,
        solver.rootDirectorTargets[targetOffset + 1] -
          solver.rootNormals[normalOffset + 1] * targetDotNormal,
        solver.rootDirectorTargets[targetOffset + 2] -
          solver.rootNormals[normalOffset + 2] * targetDotNormal,
      ];
      const flowLength = Math.hypot(...flow) || 1;
      handoffFlowDots.push(
        (afterVector[0] * flow[0] + afterVector[1] * flow[1] + afterVector[2] * flow[2]) /
          (afterLength * flowLength)
      );
      for (let particle = 1; particle <= handoffParticle; particle += 1) {
        const point = (guide * stations + particle) * 3;
        const shellRadius = Math.hypot(
          (authoredRestCenters[point] - SCALP_CENTER[0]) / radiusX,
          (authoredRestCenters[point + 1] - SCALP_CENTER[1]) / radiusY,
          (authoredRestCenters[point + 2] - SCALP_CENTER[2]) / radiusZ
        );
        laydownClearances.push((shellRadius - 1) * Math.min(radiusX, radiusY, radiusZ));
      }
    }
    for (let index = 0; index < transferFractions.length; index += 1) {
      const particle = Math.round(solver.segments * transferFractions[index]);
      const frame = (guide * stations + particle) * 3;
      const guideDx = solver.positions[frame] - authoredMechanicalReference[frame];
      const guideDy = solver.positions[frame + 1] - authoredMechanicalReference[frame + 1];
      const guideDz = solver.positions[frame + 2] - authoredMechanicalReference[frame + 2];
      const groomDx = authoredLiveCenters[frame] - authoredRestCenters[frame];
      const groomDy = authoredLiveCenters[frame + 1] - authoredRestCenters[frame + 1];
      const groomDz = authoredLiveCenters[frame + 2] - authoredRestCenters[frame + 2];
      const guideMagnitude = Math.hypot(guideDx, guideDy, guideDz);
      const groomMagnitude = Math.hypot(groomDx, groomDy, groomDz);
      if (guideMagnitude > 1e-7 && groomMagnitude > 1e-7) {
        transferRatios[index].push(groomMagnitude / guideMagnitude);
        transferCosines[index].push(
          (guideDx * groomDx + guideDy * groomDy + guideDz * groomDz) /
            (guideMagnitude * groomMagnitude)
        );
      }
    }
  }
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const root = binding * stations * 3;
    const dx = (groomEnvelopeCurvePointCache[root] - SCALP_CENTER[0]) / radiusX;
    const dy = (groomEnvelopeCurvePointCache[root + 1] - SCALP_CENTER[1]) / radiusY;
    const dz = (groomEnvelopeCurvePointCache[root + 2] - SCALP_CENTER[2]) / radiusZ;
    maximumRootShellError = Math.max(maximumRootShellError, Math.abs(Math.hypot(dx, dy, dz) - 1));
  }
  const quantiles = (values) => {
    values.sort((left, right) => left - right);
    if (values.length === 0) return { p50: null, p90: null };
    return {
      p50: values[Math.min(values.length - 1, Math.floor(values.length * 0.5))],
      p90: values[Math.min(values.length - 1, Math.floor(values.length * 0.9))],
    };
  };
  return {
    enabled: true,
    field_identity: sparseGroomCageEnabled
      ? SPARSE_GROOM_CAGE_ID
      : hairlineFlowEnabled
        ? HAIRLINE_FLOW_FIELD_ID
        : AUTHORED_GROOM_FIELD_ID,
    topology_digest: authoredTopologyDigest,
    root_outward_dot: {
      minimum: Math.min(...outwardDots),
      mean: outwardDots.reduce((a, b) => a + b, 0) / outwardDots.length,
    },
    turning_angle_degrees: quantiles(turningAngles),
    maximum_cross_section_radius_m: AUTHORED_GROOM_OUTWARD_RADIUS_METERS,
    maximum_root_shell_error: maximumRootShellError,
    displacement_transfer: Object.fromEntries(
      transferFractions.map((fraction, index) => [
        String(fraction),
        {
          magnitude_ratio: quantiles(transferRatios[index]),
          direction_cosine: quantiles(transferCosines[index]),
        },
      ])
    ),
    debug_section_colors: authoredDebugColors,
    root_operator: authoredLaydownEnabled
      ? {
          field_identity: AUTHORED_ROOT_LAYDOWN_FIELD_ID,
          digest: authoredTopologyDigest,
          emergence_length_range_m: AUTHORED_ROOT_EMERGENCE_RANGE_METERS,
          laydown_length_range_m: AUTHORED_ROOT_LAYDOWN_RANGE_METERS,
          handoff_curve_fraction: AUTHORED_ROOT_HANDOFF_FRACTION,
          handoff_station_fraction: AUTHORED_ROOT_HANDOFF_STATION_FRACTION,
          initial_tangent_outward_dot: {
            minimum: Math.min(...outwardDots),
            mean: outwardDots.reduce((a, b) => a + b, 0) / outwardDots.length,
          },
          handoff_styled_flow_dot: {
            minimum: Math.min(...handoffFlowDots),
            mean: handoffFlowDots.reduce((a, b) => a + b, 0) / handoffFlowDots.length,
          },
          laydown_shell_clearance_m: {
            minimum: Math.min(...laydownClearances),
            ...quantiles(laydownClearances),
            maximum: Math.max(...laydownClearances),
          },
          first_20pct_turning_angle_degrees: quantiles(rootTurningAngles),
          shaft_handoff: {
            maximum_position_discontinuity_m: 0,
            maximum_tangent_angle_degrees: Math.max(...handoffTangentAngles),
          },
          debug_zone_colors: authoredRootZoneColors,
        }
      : null,
    hairline_flow: hairlineFlowEnabled
      ? {
          field_identity: HAIRLINE_FLOW_FIELD_ID,
          surface_fraction: HAIRLINE_FLOW_SURFACE_FRACTION,
          surface_length_m: HAIRLINE_FLOW_SURFACE_LENGTH_METERS,
        }
      : null,
    sparse_groom_cage: sparseGroomCageEnabled
      ? {
          field_identity: SPARSE_GROOM_CAGE_ID,
          hero_lock_count: SPARSE_GROOM_HEROES.length,
          roots_per_lock: Array.from({ length: SPARSE_GROOM_HEROES.length }, (_, hero) =>
            sparseGroomHeroByGuide.reduce((count, value) => count + Number(value === hero), 0)
          ),
          offset_retention: Object.fromEntries(
            [0, 0.25, 0.6, 0.9].map((fraction) => [
              String(fraction),
              sparseGroomOffsetRetentionAt(fraction),
            ])
          ),
          debug_hero_colors: sparseGroomCageColors,
          display_follicles:
            independentDisplayFolliclesEnabled && groomBindings.independentDisplayFollicles
              ? independentDisplayFollicleTelemetry()
              : null,
        }
      : null,
    physics_authority: "none_renderer_only",
  };
}

function readCachedGroomCurvePoint(target, targetOffset, binding, particle, activeSegments) {
  const clampedParticle = Math.max(0, Math.min(activeSegments, particle));
  const lowerParticle = Math.floor(clampedParticle);
  const upperParticle = Math.min(activeSegments, lowerParticle + 1);
  const blend = clampedParticle - lowerParticle;
  const stations = solver.segments + 1;
  const lower = (binding * stations + lowerParticle) * 3;
  const upper = (binding * stations + upperParticle) * 3;
  for (let axis = 0; axis < 3; axis += 1) {
    target[targetOffset + axis] =
      groomEnvelopeCurvePointCache[lower + axis] * (1 - blend) +
      groomEnvelopeCurvePointCache[upper + axis] * blend;
  }
}

function updateSectionInterpolatedFatlineGeometry() {
  const { geometry } = hair;
  const starts = geometry.attributes.instanceStart.array;
  const ends = geometry.attributes.instanceEnd.array;
  const colors = geometry.attributes.instanceColor.array;
  const widthsStart = geometry.attributes.instanceWidthStart.array;
  const widthsEnd = geometry.attributes.instanceWidthEnd.array;
  const owners = groomBindings.owners;
  const neighbors = groomBindings.neighbors;
  const secondaryNeighbors = groomBindings.secondaryNeighbors;
  const weights = groomBindings.neighborWeights;
  const secondaryWeights = groomBindings.secondaryNeighborWeights;
  const rootCoverageCopies = independentDisplayFolliclesEnabled
    ? 0
    : rootCoverageFiberCopies(renderFibersPerGuide);
  rebuildGroomCurvePointCache();
  let instance = 0;
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const owner = owners[binding];
    const neighbor = neighbors[binding];
    const secondaryNeighbor = secondaryNeighbors[binding];
    const neighborWeight = weights[binding];
    const secondaryNeighborWeight = secondaryWeights[binding];
    const fullActiveSegments = groomBindingActiveSegments(
      solver.activeSegments,
      owner,
      neighbor,
      neighborWeight
    );
    const activeSegments = displayFollicleRootDiagnostic
      ? Math.min(2, fullActiveSegments)
      : fullActiveSegments;
    const retainedLength = lockLaminaeEnabled
      ? groomBindings.displayLaminaRetainedLengths[binding]
      : layeredHaircutEnabled
        ? groomBindings.displayLengthRatios[binding]
        : 1;
    const copy = binding % renderFibersPerGuide;
    readCachedGroomCurvePoint(lockCurvePoints, 0, binding, 0, activeSegments);
    const ownerNormal = owner * 3;
    const neighborNormal = neighbor * 3;
    const secondaryNormal = secondaryNeighbor * 3;
    let normalX = interpolateGroomScalar(
      solver.rootNormals[ownerNormal],
      solver.rootNormals[neighborNormal],
      neighborWeight,
      solver.rootNormals[secondaryNormal],
      secondaryNeighborWeight
    );
    let normalY = interpolateGroomScalar(
      solver.rootNormals[ownerNormal + 1],
      solver.rootNormals[neighborNormal + 1],
      neighborWeight,
      solver.rootNormals[secondaryNormal + 1],
      secondaryNeighborWeight
    );
    let normalZ = interpolateGroomScalar(
      solver.rootNormals[ownerNormal + 2],
      solver.rootNormals[neighborNormal + 2],
      neighborWeight,
      solver.rootNormals[secondaryNormal + 2],
      secondaryNeighborWeight
    );
    const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
    normalX /= normalLength;
    normalY /= normalLength;
    normalZ /= normalLength;
    const targetStride = solver.rootDirector.zoneSegments * 3;
    const ownerTarget = owner * targetStride;
    const neighborTarget = neighbor * targetStride;
    const secondaryTarget = secondaryNeighbor * targetStride;
    const targetX = interpolateGroomScalar(
      solver.rootDirectorTargets[ownerTarget],
      solver.rootDirectorTargets[neighborTarget],
      neighborWeight,
      solver.rootDirectorTargets[secondaryTarget],
      secondaryNeighborWeight
    );
    const targetY = interpolateGroomScalar(
      solver.rootDirectorTargets[ownerTarget + 1],
      solver.rootDirectorTargets[neighborTarget + 1],
      neighborWeight,
      solver.rootDirectorTargets[secondaryTarget + 1],
      secondaryNeighborWeight
    );
    const targetZ = interpolateGroomScalar(
      solver.rootDirectorTargets[ownerTarget + 2],
      solver.rootDirectorTargets[neighborTarget + 2],
      neighborWeight,
      solver.rootDirectorTargets[secondaryTarget + 2],
      secondaryNeighborWeight
    );
    readCachedGroomCurvePoint(
      lockRootCoverageProbe,
      0,
      binding,
      Math.min(LOCK_AWARE_ROOT_COVER_PROBE_PARTICLE, activeSegments) * retainedLength,
      activeSegments
    );
    blendRootCoverageFlow(
      normalX,
      normalY,
      normalZ,
      targetX,
      targetY,
      targetZ,
      lockRootCoverageProbe[0] - lockCurvePoints[0],
      lockRootCoverageProbe[1] - lockCurvePoints[1],
      lockRootCoverageProbe[2] - lockCurvePoints[2],
      LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT,
      lockRootCoverageFlow
    );
    let cursor;
    if (copy < rootCoverageCopies) {
      buildRootCoverageCurve(
        lockCurvePoints[0],
        lockCurvePoints[1],
        lockCurvePoints[2],
        normalX,
        normalY,
        normalZ,
        lockRootCoverageFlow[0],
        lockRootCoverageFlow[1],
        lockRootCoverageFlow[2],
        owner,
        copy,
        LOCK_AWARE_ROOT_COVER_LENGTH_METERS,
        lockRootCoveragePoints
      );
      for (let coverSegment = 0; coverSegment < LOCK_AWARE_ROOT_COVER_SEGMENTS; coverSegment += 1) {
        cursor = instance * 3;
        const coverStart = coverSegment * 3;
        const coverEnd = coverStart + 3;
        for (let axis = 0; axis < 3; axis += 1) {
          starts[cursor + axis] = lockRootCoveragePoints[coverStart + axis];
          ends[cursor + axis] = lockRootCoveragePoints[coverEnd + axis];
        }
        writeHydratedFiberStyle(
          colors,
          widthsStart,
          widthsEnd,
          instance,
          cursor,
          owner,
          copy,
          0.45 + coverSegment * 0.38,
          0.83 + coverSegment * 0.38,
          activeSegments,
          binding
        );
        const familyScale = hydrationFamilyScales[copy];
        const hydration = fullGroomHydrationEnabled
          ? fullGroomPresentation.widthScale
          : 0.12 + 0.88 * sectionHydrationForGuide(owner);
        const rootRecipeScale = hydrationRecipeWidthScaleAt(activeHydrationState, 0);
        widthsStart[instance] =
          FATLINE_ROOT_HALF_WIDTH_PX *
          LOCK_ROOT_COVER_WIDTH_PROFILE[coverSegment] *
          hydration *
          familyScale *
          rootRecipeScale;
        widthsEnd[instance] =
          FATLINE_ROOT_HALF_WIDTH_PX *
          LOCK_ROOT_COVER_WIDTH_PROFILE[coverSegment + 1] *
          hydration *
          familyScale *
          rootRecipeScale;
        instance += 1;
      }
    }
    for (let segment = 0; segment < activeSegments; segment += 1) {
      for (let controlPoint = 0; controlPoint < 4; controlPoint += 1) {
        readCachedGroomCurvePoint(
          lockCurvePoints,
          controlPoint * 3,
          binding,
          (segment + controlPoint - 1) * retainedLength,
          activeSegments
        );
      }
      const tangentScale = segment === 0 ? 0.34 : 0.5;
      for (let subdivision = 0; subdivision < LOCK_AWARE_RENDER_SUBDIVISIONS; subdivision += 1) {
        const startFraction = subdivision / LOCK_AWARE_RENDER_SUBDIVISIONS;
        const endFraction = (subdivision + 1) / LOCK_AWARE_RENDER_SUBDIVISIONS;
        cursor = instance * 3;
        for (let axis = 0; axis < 3; axis += 1) {
          starts[cursor + axis] = catmullRomScalar(
            lockCurvePoints[axis],
            lockCurvePoints[3 + axis],
            lockCurvePoints[6 + axis],
            lockCurvePoints[9 + axis],
            startFraction,
            tangentScale
          );
          ends[cursor + axis] = catmullRomScalar(
            lockCurvePoints[axis],
            lockCurvePoints[3 + axis],
            lockCurvePoints[6 + axis],
            lockCurvePoints[9 + axis],
            endFraction,
            tangentScale
          );
        }
        writeHydratedFiberStyle(
          colors,
          widthsStart,
          widthsEnd,
          instance,
          cursor,
          owner,
          copy,
          segment + startFraction,
          segment + endFraction,
          activeSegments,
          binding
        );
        instance += 1;
      }
    }
  }
  geometry.instanceCount = instance;
  for (const name of FATLINE_DYNAMIC_ATTRIBUTES) {
    geometry.attributes[name].needsUpdate = true;
  }
  hairDrawCount = instance;
}

function cutAtPointer(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointerX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  const pointerY = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  let cuts = 0;
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    let nearest = null;
    for (let segment = 1; segment < solver.activeSegments[strand]; segment += 1) {
      const a = solver.index(strand, segment);
      const b = solver.index(strand, segment + 1);
      projected
        .set(
          (solver.positions[a] + solver.positions[b]) * 0.5,
          (solver.positions[a + 1] + solver.positions[b + 1]) * 0.5,
          (solver.positions[a + 2] + solver.positions[b + 2]) * 0.5
        )
        .project(camera);
      const distance = Math.hypot(projected.x - pointerX, projected.y - pointerY);
      if (distance < 0.035 && (!nearest || distance < nearest.distance)) {
        nearest = { segment, distance };
      }
    }
    if (nearest && solver.cutStrand(strand, nearest.segment)) cuts += 1;
  }
  if (cuts) status.textContent = `Scissors severed ${cuts} guide strand${cuts === 1 ? "" : "s"}.`;
}

function cutToGuideLine() {
  let cuts = 0;
  const height = guideLine.position.y - 0.12;
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    for (let segment = 1; segment < solver.activeSegments[strand]; segment += 1) {
      const a = solver.index(strand, segment);
      const b = solver.index(strand, segment + 1);
      if (solver.positions[a + 1] >= height && solver.positions[b + 1] < height) {
        if (solver.cutStrand(strand, segment)) cuts += 1;
        break;
      }
    }
  }
  status.textContent = `Guide-line cut shortened ${cuts} mechanical strands.`;
}

function updateFilmDirection(now) {
  if (!filmDirection.enabled) return;
  if (filmDirection.startTime === null) filmDirection.startTime = now;
  const elapsed = (now - filmDirection.startTime) / 1000;
  const gustWave = 0.5 + 0.5 * Math.sin(elapsed * 2.4 - Math.PI * 0.5);
  solver.wind = filmDirection.baseWind + filmDirection.gust * gustWave;
  if (filmDirection.windRotationRate) {
    solver.setWindDirection(elapsed * filmDirection.windRotationRate);
  }
  if (elapsed < filmDirection.cutAt || filmDirection.cutDone) return;
  if (filmDirection.cut === "bob") {
    cutToGuideLine();
    filmDirection.cutDone = true;
    return;
  }
  if (filmDirection.cut !== "diagonal") return;
  const progress = Math.min(1, (elapsed - filmDirection.cutAt) / filmDirection.cutDuration);
  const sweepX = -0.92 + progress * 1.84;
  let newCuts = 0;
  for (let strand = 0; strand < solver.guideCount; strand += 1) {
    if (filmDirection.cutStrands.has(strand)) continue;
    const rootX = solver.roots[strand * 3];
    if (rootX > sweepX) continue;
    const normalizedX = Math.max(0, Math.min(1, (rootX + 0.92) / 1.84));
    const segment = Math.round(solver.segments * (0.78 - normalizedX * 0.38));
    if (solver.cutStrand(strand, segment)) newCuts += 1;
    filmDirection.cutStrands.add(strand);
  }
  if (newCuts > 0) {
    status.textContent = `Traveling diagonal cut: ${filmDirection.cutStrands.size} guides visited.`;
  }
  if (progress >= 1) filmDirection.cutDone = true;
}

function updateTelemetry(now) {
  if (now - telemetryClock < 220) return;
  telemetryClock = now;
  const receipt = solver.receipt();
  const rootDirectorReceipt = rootDirectorReceiptForDisplay(receipt.root_director);
  document.querySelector("#metric-guides").textContent = receipt.guide_count.toLocaleString();
  document.querySelector("#metric-fibers").textContent =
    receipt.render_fiber_count.toLocaleString();
  document.querySelector("#metric-particles").textContent = solver.particleCount.toLocaleString();
  document.querySelector("#metric-neighbors").textContent =
    receipt.root_neighbor_pairs.toLocaleString();
  document.querySelector("#metric-contacts").textContent =
    receipt.active_neighbor_contacts.toLocaleString();
  document.querySelector("#metric-spatial-contacts").textContent = receipt.spatial_friction.enabled
    ? `${receipt.spatial_friction.active_contacts_last_step.toLocaleString()} / ${receipt.spatial_friction.selected_pairs.toLocaleString()}`
    : "off";
  document.querySelector("#metric-spatial-jaccard").textContent =
    receipt.spatial_friction.minimum_active_jaccard === null
      ? "—"
      : receipt.spatial_friction.minimum_active_jaccard.toFixed(3);
  document.querySelector("#metric-spatial-impulse").textContent =
    receipt.spatial_friction.friction_impulse_proxy_total.toFixed(3);
  document.querySelector("#metric-cohesion").textContent =
    receipt.cohesion_corrections_last_iteration.toLocaleString();
  document.querySelector("#metric-bonds").textContent =
    receipt.persistent_clump_bonds.toLocaleString();
  document.querySelector("#metric-contact-age").textContent =
    `${receipt.persistent_contact_memory.mean_age_steps.toFixed(1)} / ${receipt.persistent_contact_memory.maximum_age_steps}`;
  document.querySelector("#metric-service-gap").textContent =
    `${receipt.contact_service.maximum_observed_gap_steps} / ${receipt.contact_service.service_gap_bound_steps}`;
  document.querySelector("#metric-hysteresis").textContent =
    `${receipt.clump_captures_last_step} / ${receipt.clump_releases_last_step} · pass ${receipt.comb.clump_captures_during_window} / ${receipt.comb.clump_releases_during_window}`;
  document.querySelector("#metric-pressure").textContent =
    receipt.crowd_pressure_corrections_last_iteration.toLocaleString();
  document.querySelector("#metric-solver").textContent = `${smoothedSolverMs.toFixed(2)} ms`;
  const geometryTiming = summarizeGeometryTimings(hairGeometryTimings);
  document.querySelector("#metric-render-mode").textContent = hairRenderMode;
  document.querySelector("#metric-groom-mode").textContent = groomMode;
  document.querySelector("#metric-hair-surface").textContent =
    `${hairShadingMode.replaceAll("_", " ")} · ${presentationLoopEnabled ? `loop ${presentationLoopRestarts + 1}` : "continuous"}`;
  document.querySelector("#metric-hydration-recipe").textContent =
    `${activeHydrationState.geometry.label} · ${activeHydrationState.optical.label} · ${activeHydrationState.color.label} · ${activeHydrationState.detail.label}`;
  document.querySelector("#metric-reel-presentation").textContent =
    `${mannequinStatus.replaceAll("_", " ")} · ${reelShot.replaceAll("_", " ")}`;
  document.querySelector("#metric-root-director").textContent = rootDirectorReceipt.enabled
    ? `${rootDirectorReceipt.mode.replaceAll("_", " ")} · ${rootDirectorReceipt.strength.toFixed(2)}`
    : "off";
  document.querySelector("#metric-root-alignment").textContent =
    `${rootDirectorReceipt.minimum_first_segment_normal_dot.toFixed(3)} / ${rootDirectorReceipt.mean_first_segment_normal_dot.toFixed(3)}`;
  document.querySelector("#metric-root-field-alignment").textContent =
    `${rootDirectorReceipt.minimum_first_segment_target_dot.toFixed(3)} / ${rootDirectorReceipt.mean_first_segment_target_dot.toFixed(3)}`;
  document.querySelector("#metric-root-field-outward").textContent =
    `${rootDirectorReceipt.minimum_target_outward_dot.toFixed(3)} / ${rootDirectorReceipt.mean_target_tangential_magnitude.toFixed(3)}`;
  document.querySelector("#metric-section-lift").textContent =
    `${receipt.section_lift.phase} · ${receipt.section_lift.target_meters.toFixed(2)} m`;
  document.querySelector("#metric-section-pose").textContent =
    receipt.section_pose.selected_section === null
      ? "off"
      : `${receipt.section_pose.phase} · s${receipt.section_pose.selected_section} · ${receipt.section_pose.affected_guides} guides · ${receipt.section_pose.lift_meters.toFixed(2)} / ${receipt.section_pose.tangential_sweep_meters.toFixed(2)} m`;
  document.querySelector("#metric-control-tube").textContent = fullGroomHydrationEnabled
    ? `${fullGroomPresentation.phase.replaceAll("_", " ")} · O/C/M/F ${Math.round(fullGroomPresentation.ownerHydration * 100)}/${Math.round(fullGroomPresentation.clumpHydration * 100)}/${Math.round(fullGroomPresentation.microfiberHydration * 100)}/${Math.round(fullGroomPresentation.flyawayHydration * 100)}% · ${(fullGroomPresentation.guideOpacity * 100).toFixed(0)}% rods`
    : sectionControlTubeEnabled
      ? `${sectionPresentation.phase} · ${(sectionPresentation.hydration * 100).toFixed(0)}% hair · ${(sectionPresentation.tubeOpacity * 100).toFixed(0)}% tube`
      : "off";
  document.querySelector("#metric-geometry").textContent =
    geometryTiming.p99_ms === null
      ? "warming"
      : `${geometryTiming.p99_ms.toFixed(2)} / ${geometryTiming.max_ms.toFixed(2)} ms`;
  if (renderReceiptEnabled) {
    document.documentElement.dataset.hairRenderReceipt = JSON.stringify(createRenderReceipt());
  }
  document.querySelector("#metric-fps").textContent = smoothedFps.toFixed(0);
  document.querySelector("#metric-stretch").textContent = `${(
    receipt.max_relative_stretch_error * 100
  ).toFixed(2)}%`;
  document.querySelector("#metric-cuts").textContent = receipt.cut_count.toLocaleString();
  const windDegrees = ((((receipt.wind.angle_radians * 180) / Math.PI) % 360) + 360) % 360;
  document.querySelector("#metric-wind-direction").textContent = receipt.wind.mode.startsWith(
    "directional"
  )
    ? `${windDegrees.toFixed(0)}°`
    : "legacy";
  document.querySelector("#metric-comb-force").textContent =
    receipt.comb.peak_reaction_proxy.toFixed(0);
  document.querySelector("#metric-comb-work").textContent =
    receipt.comb.accumulated_work_proxy.toFixed(0);
  document.querySelector("#metric-cycle-work").textContent =
    `${receipt.comb.forward_work_proxy.toFixed(0)} / ${receipt.comb.return_work_proxy.toFixed(0)}`;
  document.querySelector("#metric-comb-travel").textContent =
    `${receipt.comb.accumulated_travel.toFixed(2)} m`;
  document.querySelector("#metric-trace-samples").textContent =
    `${receipt.comb.force_displacement_trace.length} @ ${receipt.comb.trace_sample_stride}`;
  const assumptionMetric = document.querySelector("#metric-assumptions");
  assumptionMetric.textContent = receipt.assumption_receipt.status;
  assumptionMetric.dataset.status = receipt.assumption_receipt.status;
  drawCombTrace(receipt.comb.force_displacement_trace);
  const previewWind = deterministicReplay.config.previewWindProgram
    ? previewWindProgramAtStep(
        Math.max(0, deterministicReplay.state.step - 1),
        deterministicReplay.config.previewWindProgram === true
          ? undefined
          : deterministicReplay.config.previewWindProgram
      )
    : null;
  const nativeWind =
    nativeClipPlayback.enabled &&
    nativeClipPlayback.clip &&
    nativeClipPlayback.presentationPhase === "wind_clip"
      ? nativeClipWindAtTime(nativeClipPlayback.sampleTime)
      : null;
  document.querySelector("#showcase-material").textContent =
    `${activeHydrationState.geometry.label} · ${activeHydrationState.optical.label} · ${activeHydrationState.color.label} · ${activeHydrationState.detail.label}`;
  document.querySelector("#showcase-phase").textContent =
    fullGroomHydrationEnabled && fullGroomPresentation.phase !== "hydrated"
      ? fullGroomPresentation.phase === "mechanical_skeleton"
        ? `mechanical rods · ${physicsSkeletonGuides.length} guides / ${physicsSkeletonGuides.length * solver.segments} links`
        : fullGroomPresentation.phase === "material_audition"
          ? `breadth lab · ${Math.max(1, HAIR_BREADTH_TOUR_ORDER.indexOf(fullGroomPresentation.auditionStateId) + 1)}/${HAIR_BREADTH_TOUR.length} · ${HAIR_BREADTH_TOUR.find((state) => state.id === fullGroomPresentation.auditionStateId)?.label ?? "selected composition"}`
          : `groom hydration · ${fullGroomPresentation.phase.replaceAll("_", " ")}`
      : previewWind?.phase === "strong_orbit"
        ? `STRONG breeze · orbit ${Math.round(previewWind.orbitProgress * 100)}%`
        : nativeClipPlayback.enabled && nativeClipPlayback.presentationPhase === "reset_fade"
          ? "two complete Box3D wind orbits · resetting"
          : nativeWind?.phase === "strong_orbit"
            ? `STRONG native breeze · orbit ${Math.round(nativeWind.orbitProgress * 100)}%`
            : nativeWind?.phase === "moderate_orbit"
              ? `MODERATE native breeze · orbit ${Math.round(nativeWind.orbitProgress * 100)}%`
              : previewWind?.phase === "moderate_orbit"
                ? `MODERATE breeze · orbit ${Math.round(previewWind.orbitProgress * 100)}%`
                : previewWind?.phase === "orbit_complete"
                  ? "two complete wind orbits · resetting"
                  : previewWind?.phase === "calm_setup"
                    ? "calm setup · wind begins after hydration"
                    : sectionControlTubeEnabled && sectionPresentation.phase !== "simulation"
                      ? `control tube · ${sectionPresentation.phase}`
                      : solver.comb.enabled
                        ? `${solver.comb.phase} comb pass`
                        : receipt.assumption_receipt.measurement_window === "comb_cycle"
                          ? "two-pass complete · wind orbit continues"
                          : receipt.assumption_receipt.measurement_window.replaceAll("_", " ");
  const windStrength =
    previewWind?.phase === "strong_orbit"
      ? "STRONG"
      : previewWind?.phase === "moderate_orbit" || previewWind?.phase === "orbit_complete"
        ? "MODERATE"
        : "setup";
  document.querySelector("#showcase-wind").textContent = previewWind
    ? `${windStrength} · ${windDegrees.toFixed(0)}° · force ${receipt.wind.magnitude.toFixed(2)}`
    : nativeWind
      ? `${nativeWind.speed.toFixed(2)} m/s · ${windDegrees.toFixed(0)}° · native clip`
      : nativeClipPlayback.enabled
        ? "calm material setup · Box3D clip held at t=0"
        : `wind ${windDegrees.toFixed(0)}° · ${receipt.wind.magnitude.toFixed(2)}`;
  const stretchWindow = receipt.assumption_receipt.measurement_window;
  const stretchQualifier =
    stretchWindow === "full_simulation"
      ? "live"
      : `gate ${receipt.assumption_receipt.stretch.satisfied ? "pass" : "fail"}`;
  const settledJointGap =
    nativeClipPlayback.clip?.metadata.accepted_metrics?.max_settled_joint_gap_m;
  document.querySelector("#showcase-stretch").textContent = nativeClipPlayback.enabled
    ? settledJointGap
      ? `joint gap ${(settledJointGap * 1000).toFixed(1)} mm · native gate pass`
      : "native Box3D clip · loading gate receipt"
    : `stretch ${(receipt.max_relative_stretch_error * 100).toFixed(2)}% · ${stretchQualifier}`;
  if (performance.memory) {
    document.querySelector("#metric-memory").textContent = `${(
      performance.memory.usedJSHeapSize /
      1024 /
      1024
    ).toFixed(1)} MiB`;
  }
}

function rootDirectorReceiptForDisplay(rootDirectorReceipt) {
  const accepted = nativeClipPlayback.clip?.metadata.accepted_metrics;
  if (!nativeClipPlayback.enabled || !accepted) return rootDirectorReceipt;
  return {
    ...rootDirectorReceipt,
    minimum_first_segment_normal_dot: accepted.minimum_settled_root_outward_dot,
    mean_first_segment_normal_dot: accepted.mean_settled_root_outward_dot,
    minimum_first_segment_target_dot: accepted.minimum_settled_root_target_dot,
    mean_first_segment_target_dot: accepted.mean_settled_root_target_dot,
    measurement_window: "native_box3d_settled_2s_to_12s",
    physics_authority: "native_box3d_precomputed_capsule_transforms",
  };
}

function updateWindVisual() {
  windCompass.visible = solver.directionalWind;
  windStreaks.visible = solver.directionalWind;
  if (!solver.directionalWind) return;
  const direction = new THREE.Vector3(solver.windDirection[0], 0, solver.windDirection[2]);
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
  windArrow.setDirection(direction);
  windArrow.setLength(1.35, 0.24, 0.14);
  for (let index = 0; index < windStreakCount; index += 1) {
    const phase = (solver.time * (0.35 + solver.wind) + index * 0.173) % 1;
    const along = (phase - 0.5) * 6.2;
    const lateral = (((index * 0.61803398875) % 1) - 0.5) * 4.2;
    const y = -0.55 + ((index * 0.38196601125) % 1) * 4.4;
    const centerX = direction.x * along + perpendicular.x * lateral;
    const centerZ = direction.z * along + perpendicular.z * lateral;
    const cursor = index * 6;
    windStreakPositions[cursor] = centerX - direction.x * 0.12;
    windStreakPositions[cursor + 1] = y;
    windStreakPositions[cursor + 2] = centerZ - direction.z * 0.12;
    windStreakPositions[cursor + 3] = centerX + direction.x * 0.12;
    windStreakPositions[cursor + 4] = y;
    windStreakPositions[cursor + 5] = centerZ + direction.z * 0.12;
  }
  windStreaks.geometry.attributes.position.needsUpdate = true;
}

function nativeClipWindAtTime(timeSeconds) {
  const strong = timeSeconds < 6;
  const phaseTime = strong ? timeSeconds : Math.max(0, timeSeconds - 6);
  const angle = (phaseTime / 6) * Math.PI * 2;
  return {
    phase: strong ? "strong_orbit" : "moderate_orbit",
    speed: strong ? 6 : 3.25,
    angle,
    orbitProgress: Math.max(0, Math.min(1, phaseTime / 6)),
  };
}

function advanceNativeClip(frameDt) {
  if (!nativeClipPlayback.enabled || !nativeClipPlayback.clip) return false;
  const { metadata, quantized } = nativeClipPlayback.clip;
  nativeClipPlayback.elapsed += frameDt;
  let presentation = nativeClipPresentationAtTime(
    nativeClipPlayback.elapsed,
    metadata.duration_s,
    NATIVE_HYDRATION_PRE_ROLL_SECONDS,
    NATIVE_CLIP_RESET_FADE_SECONDS
  );
  if (nativeClipPlayback.elapsed >= presentation.cycleDuration) {
    const loopStart = Math.min(
      presentation.cycleDuration - NATIVE_CLIP_RESET_FADE_SECONDS,
      nativeClipPlayback.loopStartSeconds
    );
    const loopDuration = presentation.cycleDuration - loopStart;
    nativeClipPlayback.elapsed =
      loopStart + ((nativeClipPlayback.elapsed - loopStart) % loopDuration);
    nativeClipPlayback.restarts += 1;
    presentation = nativeClipPresentationAtTime(
      nativeClipPlayback.elapsed,
      metadata.duration_s,
      NATIVE_HYDRATION_PRE_ROLL_SECONDS,
      NATIVE_CLIP_RESET_FADE_SECONDS
    );
  }
  nativeClipPlayback.sampleTime = presentation.sampleTime;
  nativeClipPlayback.opacity = presentation.opacity;
  nativeClipPlayback.presentationPhase = presentation.phase;
  solver.previous.set(solver.positions);
  sampleQuantizedGuideClip(metadata, quantized, nativeClipPlayback.sampleTime, solver.positions);
  solver.time = nativeClipPlayback.sampleTime;
  deterministicReplay.state.step = Math.round(nativeClipPlayback.sampleTime * 60);
  const wind = nativeClipWindAtTime(nativeClipPlayback.sampleTime);
  const windIsPlaying = presentation.phase === "wind_clip";
  solver.wind = windIsPlaying ? wind.speed : 0;
  solver.windAngle = windIsPlaying ? wind.angle : 0;
  solver.windDirection = [Math.cos(solver.windAngle), 0, Math.sin(solver.windAngle)];
  solver.directionalWind = true;
  return true;
}

async function initializeNativeClipPlayback() {
  if (!nativeClipPlayback.enabled) return;
  try {
    const clip = await loadBox3dGuideClip(nativeClipPlayback.asset);
    if (
      clip.metadata.guide_count !== solver.guideCount ||
      clip.metadata.segments !== solver.segments
    ) {
      throw new Error(
        `Box3D clip expects ${clip.metadata.guide_count} × ${clip.metadata.segments}; ` +
          `solver is ${solver.guideCount} × ${solver.segments}`
      );
    }
    nativeClipPlayback.clip = clip;
    nativeClipPlayback.elapsed = nativeClipPlayback.loopStartSeconds;
    authoredReferenceReady = false;
    advanceNativeClip(0);
    updateHairGeometry();
    status.textContent =
      "Playing native Box3D scalp groom · recorded mechanics, live browser hydration.";
  } catch (error) {
    nativeClipPlayback.error = String(error);
    status.textContent = `Native Box3D clip failed: ${error}`;
    console.error(error);
  }
}

function drawCombTrace(trace) {
  const canvas = document.querySelector("#comb-trace");
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#080913";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#314165";
  context.beginPath();
  context.moveTo(28, 8);
  context.lineTo(28, canvas.height - 20);
  context.lineTo(canvas.width - 8, canvas.height - 20);
  context.stroke();
  if (trace.length < 2) return;
  const minX = Math.min(...trace.map((sample) => sample.x));
  const maxX = Math.max(...trace.map((sample) => sample.x));
  const xSpan = Math.max(maxX - minX, 1e-9);
  const maxReaction = Math.max(...trace.map((sample) => sample.reaction_proxy), 1e-9);
  context.lineWidth = 2;
  for (let index = 1; index < trace.length; index += 1) {
    const prior = trace[index - 1];
    const sample = trace[index];
    const x0 = 28 + ((prior.x - minX) / xSpan) * (canvas.width - 38);
    const x1 = 28 + ((sample.x - minX) / xSpan) * (canvas.width - 38);
    const y0 = canvas.height - 20 - (prior.reaction_proxy / maxReaction) * (canvas.height - 32);
    const y1 = canvas.height - 20 - (sample.reaction_proxy / maxReaction) * (canvas.height - 32);
    context.strokeStyle = sample.phase === "return" ? "#ff6f91" : "#63e6ff";
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  }
}

function animate(now) {
  const frameDt = Math.min(1 / 30, Math.max(1 / 240, (now - lastFrame) / 1000));
  lastFrame = now;
  smoothedFps = smoothedFps * 0.92 + (1 / frameDt) * 0.08;
  if (!paused) {
    const start = performance.now();
    if (nativeClipPlayback.enabled) {
      advanceNativeClip(frameDt);
    } else if (deterministicReplay.enabled) {
      if (deterministicReplay.autoplay) {
        if (
          presentationLoopEnabled &&
          deterministicReplay.state.step >= PRESENTATION_LOOP_END_STEP
        ) {
          rebuildSolver();
          presentationLoopRestarts += 1;
        }
        advanceHairReplay(
          solver,
          deterministicReplay.config,
          deterministicReplay.state,
          deterministicReplay.state.step + 1
        );
        advanceMaterialStudy();
      }
    } else {
      updateFilmDirection(now);
      solver.step(frameDt);
    }
    smoothedSolverMs = smoothedSolverMs * 0.9 + (performance.now() - start) * 0.1;
  }
  renderer.domElement.style.opacity = nativeClipPlayback.enabled
    ? String(nativeClipPlayback.opacity)
    : presentationLoopEnabled
      ? String(presentationLoopOpacityAtStep(deterministicReplay.state.step))
      : "1";
  updateHairGeometry();
  updateWindVisual();
  comb.visible = Boolean(deterministicReplay.config.comb && solver.comb.enabled);
  comb.position.x = solver.comb.currentX;
  if (reelShot !== "free") {
    const pose = reelCameraPoseAtStep(deterministicReplay.state.step, reelShot);
    camera.position.fromArray(pose.position);
    controls.target.fromArray(pose.target);
  }
  controls.update();
  renderer.render(scene, camera);
  updateTelemetry(now);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  if (hairRenderMode === "fatline" && hair) {
    hair.material.uniforms.resolution.value.set(width, height);
  }
}

function applyQueryConfiguration() {
  const rawParams = new URLSearchParams(window.location.search);
  activeCuratedScene = resolveCuratedHairScene(rawParams.get("scene"));
  const labMode = rawParams.get("lab") === "1";
  const params = activeCuratedScene
    ? curatedHairSceneParameters(activeCuratedScene)
    : new URLSearchParams(rawParams);
  if (activeCuratedScene) {
    for (const [key, value] of rawParams) {
      if (key !== "scene" && key !== "lab") params.set(key, value);
    }
    const sceneIndex = CURATED_HAIR_SCENES.indexOf(activeCuratedScene);
    document.body.dataset.curatedScene = activeCuratedScene.id;
    document.body.classList.toggle("curated", !labMode);
    document.querySelector("#scene-count").textContent =
      `${sceneIndex + 1} / ${CURATED_HAIR_SCENES.length}`;
    document.querySelector("#scene-title").textContent = activeCuratedScene.title;
    document.querySelector("#scene-description").textContent = activeCuratedScene.description;
    document.querySelector("#scene-cue").textContent = activeCuratedScene.cue;
    const nextScene = resolveCuratedHairScene(nextCuratedHairSceneId(activeCuratedScene.id));
    document
      .querySelector("#scene-next")
      .setAttribute("aria-label", `Next scene: ${nextScene?.title ?? "curated hair scene"}`);
  } else {
    delete document.body.dataset.curatedScene;
    document.body.classList.remove("curated");
  }
  const physicsClip = params.get("physicsClip");
  const nativeClipGuides =
    physicsClip === "box3d-scalp-256" ? 256 : physicsClip === "box3d-scalp-64" ? 64 : null;
  nativeClipPlayback.enabled = nativeClipGuides !== null;
  nativeClipPlayback.asset = nativeClipPlayback.enabled
    ? `./assets/box3d_scalp_groom_${nativeClipGuides}.meta.json`
    : null;
  nativeClipPlayback.loopStartSeconds = Math.max(0, Number(params.get("nativeStart") ?? 0) || 0);
  if (nativeClipPlayback.enabled) {
    document.querySelector("#guides").min = "64";
    if (!params.has("guides")) document.querySelector("#guides").value = String(nativeClipGuides);
  }
  const showcase = params.get("showcase") === "1" && !labMode;
  document.body.classList.toggle("showcase", showcase);
  const controlsByParameter = {
    guides: "guides",
    iterations: "iterations",
    wetness: "moisture",
    product: "product",
    lift: "lift",
    poseSection: "pose-section",
    poseLift: "pose-lift",
    poseSweep: "pose-sweep",
    wind: "wind",
  };
  const preset = params.get("preset");
  if (["straight", "wavy", "curly", "coily"].includes(preset)) {
    document.querySelector("#preset").value = preset;
  }
  for (const [parameter, id] of Object.entries(controlsByParameter)) {
    if (!params.has(parameter)) continue;
    const input = document.querySelector(`#${id}`);
    input.value = params.get(parameter);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (params.has("scenario")) {
    document.querySelector("#scenario-label").textContent =
      `Hair phase film · ${params.get("scenario")}`;
  }
  deterministicReplay.spatialFrictionEnabled = params.get("spatialFriction") === "1";
  const requestedRootField = params.get("rootField")?.replaceAll("-", "_");
  rootDirectorMode = ["free", "scalp_normal", "styled_side_part"].includes(requestedRootField)
    ? requestedRootField
    : params.get("rootDirector") === "1"
      ? "scalp_normal"
      : "free";
  document.querySelector("#root-field").value = rootDirectorMode;
  document.querySelector("#showcase-groom").textContent =
    rootDirectorMode === "styled_side_part" ? "Styled side-part groom" : "Rotating-wind groom";
  rootDirectorStrength = Math.max(0, Math.min(1, Number(params.get("rootStrength") ?? 0.22)));
  faceClearGroomEnabled = params.get("faceClear") !== "0";
  if (deterministicReplay.spatialFrictionEnabled && !params.has("scenario")) {
    document.querySelector("#scenario-label").textContent =
      "Hair material study · experimental k=1 spatial friction";
  }
  if (params.has("fibers")) {
    const maximumFiberCopies = nativeClipPlayback.enabled ? 84 : 21;
    renderFibersPerGuide = Math.max(
      1,
      Math.min(maximumFiberCopies, Number(params.get("fibers")) || 9)
    );
  }
  hairRenderMode = params.get("hairRender") === "fatline" ? "fatline" : "lines";
  patchLockEnabled = params.get("lockTopology") === "patch";
  hairlineFlowEnabled = params.get("lockTopology") === "hairline";
  sparseGroomCageEnabled = params.get("lockTopology") === "cage";
  independentDisplayFolliclesEnabled =
    sparseGroomCageEnabled && params.get("displayFollicles") === "independent";
  displayFollicleGuideColors =
    independentDisplayFolliclesEnabled && params.get("follicleGuideColors") === "1";
  displayFollicleRootDiagnostic =
    independentDisplayFolliclesEnabled && params.get("follicleRootsOnly") === "1";
  correlatedRestHierarchyEnabled =
    independentDisplayFolliclesEnabled && params.get("restHierarchy") === "correlated";
  occupancyRemapEnabled =
    independentDisplayFolliclesEnabled && params.get("occupancyRemap") === "three-core";
  coreWidthHierarchyEnabled =
    independentDisplayFolliclesEnabled && params.get("widthHierarchy") === "core";
  coreWidthDiagnostic = coreWidthHierarchyEnabled && params.get("widthDiagnostic") === "1";
  layeredHaircutEnabled =
    independentDisplayFolliclesEnabled && params.get("lengthField") === "layered";
  layeredHaircutDiagnostic = layeredHaircutEnabled && params.get("lengthDiagnostic") === "1";
  lockLaminaeEnabled =
    independentDisplayFolliclesEnabled && params.get("lockSurface") === "laminae";
  lockLaminaeDiagnostic = lockLaminaeEnabled && params.get("laminaDiagnostic") === "1";
  sublockPhaseColors =
    (correlatedRestHierarchyEnabled || occupancyRemapEnabled) &&
    params.get("sublockColors") === "1";
  authoredRestGroomEnabled =
    params.get("lockTopology") === "authored" || hairlineFlowEnabled || sparseGroomCageEnabled;
  authoredDebugColors = authoredRestGroomEnabled && params.get("sectionColors") === "1";
  authoredLaydownEnabled = authoredRestGroomEnabled && params.get("rootOperator") === "laydown";
  authoredRootZoneColors = authoredLaydownEnabled && params.get("rootZones") === "1";
  sparseGroomCageColors = sparseGroomCageEnabled && params.get("cageColors") === "1";
  patchDebugColors = patchLockEnabled && params.get("patchColors") === "1";
  groomMode =
    hairRenderMode !== "fatline"
      ? "radial_xz"
      : authoredRestGroomEnabled
        ? sparseGroomCageEnabled
          ? "section_sparse_cage"
          : hairlineFlowEnabled
            ? "section_hairline_flow"
            : "section_authored_rest"
        : patchLockEnabled
          ? "section_patch_lock"
          : params.get("groomVolume") === "1"
            ? "section_volume"
            : params.get("groomSections") === "1"
              ? "section_interp"
              : "radial_xz";
  document.querySelector("#groom-display").value = hairRenderMode === "lines" ? "lines" : groomMode;
  hairShadingMode = params.get("hairShade") === "flat" ? "flat" : "fiber_lobes";
  document.querySelector("#hair-surface").value = hairShadingMode;
  const requestedHydrationRecipe = params.get("hydrationRecipe")?.replaceAll("-", "_");
  hydrationRecipeId = HAIR_HYDRATION_RECIPE_ORDER.includes(requestedHydrationRecipe)
    ? requestedHydrationRecipe
    : "natural_balanced";
  const recipeSelection = hydrationRecipeSelection(hydrationRecipeId);
  setHydrationSelection(
    {
      geometryId:
        params.get("hydrationGeometry")?.replaceAll("-", "_") ?? recipeSelection.geometryId,
      opticalId: params.get("hydrationOptical")?.replaceAll("-", "_") ?? recipeSelection.opticalId,
      colorId: params.get("hydrationColor")?.replaceAll("-", "_") ?? recipeSelection.colorId,
      detailId: params.get("hydrationDetail")?.replaceAll("-", "_") ?? recipeSelection.detailId,
    },
    false
  );
  const requestedGroomEnvelope = params.get("groomEnvelope")?.replaceAll("-", "_");
  groomEnvelopeId = GROOM_ENVELOPE_PROFILE_ORDER.includes(requestedGroomEnvelope)
    ? requestedGroomEnvelope
    : "cinematic_mass";
  groomEnvelopeScale = Math.max(
    0.5,
    Math.min(2.5, Number(params.get("envelopeScale") ?? 1.25) || 1.25)
  );
  const requestedMassFill = params.get("massFill")?.replaceAll("-", "_");
  hairMassFillId = HAIR_MASS_FILL_PROFILE_ORDER.includes(requestedMassFill)
    ? requestedMassFill
    : "cinematic_deep";
  hairMassDensity = Math.max(0, Math.min(2, Number(params.get("massDensity") ?? 1.25)));
  hydrationTourEnabled = params.get("hydrationTour") !== "0";
  document.querySelector("#hydration-recipe").value = hydrationRecipeId;
  document.querySelector("#hydration-geometry").value = hydrationGeometryId;
  document.querySelector("#hydration-optical").value = hydrationOpticalId;
  document.querySelector("#hydration-color").value = hydrationColorId;
  document.querySelector("#hydration-detail").value = hydrationDetailId;
  document.querySelector("#groom-envelope").value = groomEnvelopeId;
  document.querySelector("#envelope-breadth").value = String(groomEnvelopeScale);
  document.querySelector("#envelope-breadth-output").textContent =
    `${groomEnvelopeScale.toFixed(2)}×`;
  document.querySelector("#mass-fill").value = hairMassFillId;
  document.querySelector("#mass-density").value = String(hairMassDensity);
  document.querySelector("#mass-density-output").textContent = `${hairMassDensity.toFixed(2)}×`;
  document.querySelector("#hydration-tour").checked = hydrationTourEnabled;
  setMannequinMode(params.get("mannequin") === "realistic" ? "realistic" : "primitive");
  document.querySelector("#mannequin").value = mannequinMode;
  reelShot = ["beauty", "control", "cut"].includes(params.get("reel"))
    ? params.get("reel")
    : "free";
  document.querySelector("#reel-shot").value = reelShot;
  if (reelShot !== "free") controls.autoRotate = false;
  fullGroomHydrationEnabled = params.get("groomHydration") === "1";
  sectionControlTubeEnabled = !fullGroomHydrationEnabled && params.get("controlTube") === "1";
  document.querySelector("#pose-visual").value = fullGroomHydrationEnabled
    ? "full_groom_hydration"
    : sectionControlTubeEnabled
      ? "control_tube"
      : "hair_only";
  renderReceiptEnabled = params.get("renderReceipt") === "1";
  presentationLoopEnabled = params.get("presentationLoop") === "1";
  if (params.get("film") === "1") {
    filmDirection.enabled = true;
    filmDirection.baseWind = Number(params.get("wind") ?? 0.18);
    filmDirection.gust = Math.max(0, Number(params.get("gust") ?? 0));
    filmDirection.cut = ["none", "bob", "diagonal"].includes(params.get("cut"))
      ? params.get("cut")
      : "none";
    filmDirection.cutAt = Math.max(0, Number(params.get("cutAt") ?? 2.5));
    filmDirection.cutDuration = Math.max(0.2, Number(params.get("cutDuration") ?? 1.4));
    filmDirection.windRotationRate = Number(params.get("windRotation") ?? 0);
    controls.autoRotate = reelShot === "free";
    controls.autoRotateSpeed = Number(params.get("orbit") ?? 0.8);
  }
  if (params.get("replay") === "1") {
    const previewWindMagnitudes = resolvePreviewWindMagnitudes(
      params.get("strongWind"),
      params.get("moderateWind")
    );
    deterministicReplay.enabled = true;
    deterministicReplay.autoplay =
      params.get("autoplay") === "1" || (showcase && params.get("autoplay") !== "0");
    deterministicReplay.targetStep = Math.max(
      0,
      Math.floor(Number(params.get("replaySteps") ?? 0))
    );
    deterministicReplay.collectiveRulesEnabled = params.get("operators") !== "off";
    deterministicReplay.config = {
      dt: 1 / Math.max(1, Number(params.get("simulationFps") ?? 60)),
      baseWind: Number(params.get("wind") ?? 0.18),
      gust: Math.max(0, Number(params.get("gust") ?? 0)),
      cut: params.get("cut") === "diagonal" ? "diagonal" : "none",
      cutAt: Math.max(0, Number(params.get("cutAt") ?? 2.5)),
      cutDuration: Math.max(0.2, Number(params.get("cutDuration") ?? 1.4)),
      windAngle: Number(params.get("windAngle") ?? 0),
      windRotationRate: Number(params.get("windRotation") ?? 0),
      previewWindProgram:
        params.get("windProgram") === "strong-then-moderate-orbits"
          ? previewWindMagnitudes
          : undefined,
      sectionLiftCycle:
        params.get("liftCycle") === "1"
          ? {
              startStep: 30,
              peakStep: 90,
              holdEndStep: 155,
              endStep: 230,
              height: Math.max(0, Math.min(1.4, Number(params.get("liftPeak") ?? 0.24))),
            }
          : undefined,
      sectionPoseCycle:
        params.get("poseCycle") === "1"
          ? {
              startStep: 30,
              peakStep: 90,
              holdEndStep: 170,
              endStep: 255,
              section: Math.max(0, Math.min(7, Number(params.get("poseSection") ?? 7))),
              lift: Math.max(0, Math.min(1.4, Number(params.get("poseLift") ?? 0.32))),
              sweep: Math.max(-1.4, Math.min(1.4, Number(params.get("poseSweep") ?? 0.34))),
            }
          : undefined,
      comb:
        params.get("comb") === "1"
          ? {
              startStep: Math.max(0, Number(params.get("combStart") ?? 30)),
              endStep: Math.max(1, Number(params.get("combEnd") ?? 150)),
              startX: -1.35,
              endX: 1.35,
              ...(params.get("cycle") === "1"
                ? { returnStartStep: 165, returnEndStep: 285, returnX: -1.35 }
                : {}),
            }
          : undefined,
    };
    if (showcase) {
      controls.autoRotate = reelShot === "free";
      controls.autoRotateSpeed = Number(params.get("orbit") ?? 0.35);
    }
  }
  if (nativeClipPlayback.enabled) {
    deterministicReplay.enabled = false;
    deterministicReplay.autoplay = false;
    filmDirection.enabled = false;
    fullGroomHydrationEnabled = true;
    sectionControlTubeEnabled = false;
    presentationLoopEnabled = false;
    document.querySelector("#pose-visual").value = "full_groom_hydration";
    document.querySelector("#scenario-label").textContent =
      "Native Box3D scalp groom · recorded mechanics + live hydration";
    document.querySelector("#showcase-groom").textContent = "Box3D styled scalp groom";
  }
  if (activeCuratedScene) {
    document.querySelector("#scenario-label").textContent =
      `Curated hair film · ${activeCuratedScene.title}`;
    document.querySelector("#showcase-groom").textContent = activeCuratedScene.title;
  }
}

for (const [id, output, format] of [
  ["guides", "guide-output", (value) => value],
  ["iterations", "iteration-output", (value) => value],
  ["moisture", "moisture-output", (value) => `${Math.round(value * 100)}%`],
  ["product", "product-output", (value) => `${Math.round(value * 100)}%`],
  ["lift", "lift-output", (value) => `${Number(value).toFixed(2)} m`],
  ["pose-lift", "pose-lift-output", (value) => `${Number(value).toFixed(2)} m`],
  ["pose-sweep", "pose-sweep-output", (value) => `${Number(value).toFixed(2)} m`],
  ["envelope-breadth", "envelope-breadth-output", (value) => `${Number(value).toFixed(2)}×`],
  ["mass-density", "mass-density-output", (value) => `${Number(value).toFixed(2)}×`],
  ["wind", "wind-output", (value) => Number(value).toFixed(2)],
]) {
  const input = document.querySelector(`#${id}`);
  input.addEventListener("input", () => {
    const outputElement = document.querySelector(`#${output}`);
    const formattedValue = format(Number(input.value));
    outputElement.textContent = formattedValue;
    const controlLabel = input.closest("label")?.querySelector("span")?.textContent ?? id;
    outputElement.setAttribute("aria-label", `${controlLabel} ${formattedValue}`);
    if (["moisture", "product", "lift", "pose-lift", "pose-sweep", "wind"].includes(id)) {
      applyMaterialControls();
    }
    if (id === "envelope-breadth") groomEnvelopeScale = Number(input.value);
    if (id === "mass-density") hairMassDensity = Number(input.value);
  });
  if (["guides", "iterations"].includes(id)) input.addEventListener("change", rebuildSolver);
}

document.querySelector("#preset").addEventListener("change", rebuildSolver);
document.querySelector("#pose-visual").addEventListener("change", (event) => {
  const mode = event.currentTarget.value;
  sectionControlTubeEnabled = mode === "control_tube";
  fullGroomHydrationEnabled = mode === "full_groom_hydration";
  sectionControlTubeTimings = [];
  physicsGuideCageTimings = [];
  rebuildSolver();
});
document.querySelector("#pose-section").addEventListener("input", applyMaterialControls);
document.querySelector("#root-field").addEventListener("change", (event) => {
  rootDirectorMode = event.currentTarget.value;
  rebuildSolver();
});
document.querySelector("#groom-display").addEventListener("change", (event) => {
  const requestedMode = event.currentTarget.value;
  hairRenderMode = requestedMode === "lines" ? "lines" : "fatline";
  groomMode = requestedMode === "lines" ? "radial_xz" : requestedMode;
  patchLockEnabled = requestedMode === "section_patch_lock";
  authoredRestGroomEnabled = requestedMode === "section_authored_rest";
  hairlineFlowEnabled = requestedMode === "section_hairline_flow";
  sparseGroomCageEnabled = requestedMode === "section_sparse_cage";
  independentDisplayFolliclesEnabled = false;
  displayFollicleGuideColors = false;
  displayFollicleRootDiagnostic = false;
  correlatedRestHierarchyEnabled = false;
  occupancyRemapEnabled = false;
  coreWidthHierarchyEnabled = false;
  coreWidthDiagnostic = false;
  layeredHaircutEnabled = false;
  layeredHaircutDiagnostic = false;
  lockLaminaeEnabled = false;
  lockLaminaeDiagnostic = false;
  sublockPhaseColors = false;
  authoredRestGroomEnabled ||= hairlineFlowEnabled || sparseGroomCageEnabled;
  authoredDebugColors = false;
  authoredLaydownEnabled = false;
  authoredRootZoneColors = false;
  sparseGroomCageColors = false;
  patchDebugColors = false;
  rebuildSolver();
});
document.querySelector("#hair-surface").addEventListener("change", (event) => {
  hairShadingMode = event.currentTarget.value === "flat" ? "flat" : "fiber_lobes";
  if (hairRenderMode === "fatline") {
    hair.material.uniforms.shadingEnabled.value = hairShadingMode === "fiber_lobes" ? 1 : 0;
  }
});
document.querySelector("#groom-envelope").addEventListener("change", (event) => {
  groomEnvelopeId = GROOM_ENVELOPE_PROFILES[event.currentTarget.value]
    ? event.currentTarget.value
    : "cinematic_mass";
  groomEnvelopeBoundaryTimings = [];
});
document.querySelector("#mass-fill").addEventListener("change", (event) => {
  hairMassFillId = HAIR_MASS_FILL_PROFILES[event.currentTarget.value]
    ? event.currentTarget.value
    : "studio_dense";
  hairMassGeometryTimings = [];
});
document.querySelector("#hydration-recipe").addEventListener("change", (event) => {
  setHydrationRecipe(event.currentTarget.value);
});
for (const [selector, key] of [
  ["#hydration-geometry", "geometryId"],
  ["#hydration-optical", "opticalId"],
  ["#hydration-color", "colorId"],
  ["#hydration-detail", "detailId"],
]) {
  document.querySelector(selector).addEventListener("change", (event) => {
    setHydrationSelection({
      geometryId: hydrationGeometryId,
      opticalId: hydrationOpticalId,
      colorId: hydrationColorId,
      detailId: hydrationDetailId,
      [key]: event.currentTarget.value,
    });
  });
}
document.querySelector("#hydration-tour").addEventListener("change", (event) => {
  hydrationTourEnabled = event.currentTarget.checked;
});
document.querySelector("#mannequin").addEventListener("change", (event) => {
  setMannequinMode(event.currentTarget.value);
});
document.querySelector("#reel-shot").addEventListener("change", (event) => {
  reelShot = ["beauty", "control", "cut"].includes(event.currentTarget.value)
    ? event.currentTarget.value
    : "free";
  controls.autoRotate = false;
});
document.querySelector("#scene-next").addEventListener("click", () => {
  if (!activeCuratedScene) return;
  const nextSceneId = nextCuratedHairSceneId(activeCuratedScene.id);
  const nextScene = resolveCuratedHairScene(nextSceneId);
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ scene: nextSceneId }).toString();
  document
    .querySelector("#scene-next")
    .setAttribute("aria-label", `Loading next scene: ${nextScene?.title ?? nextSceneId}`);
  window.location.assign(url);
});
document.querySelector("#reset").addEventListener("click", rebuildSolver);
document.querySelector("#pause").addEventListener("click", (event) => {
  paused = !paused;
  event.currentTarget.textContent = paused ? "Resume" : "Pause";
});
document.querySelector("#scissors").addEventListener("click", (event) => {
  cutting = !cutting;
  document.body.classList.toggle("cutting", cutting);
  event.currentTarget.setAttribute("aria-pressed", String(cutting));
  event.currentTarget.textContent = `Scissors: ${cutting ? "on" : "off"}`;
  controls.enabled = !cutting;
  status.textContent = cutting
    ? "Paint across visible fibers to cut them."
    : "Orbit control restored.";
});
document.querySelector("#plane-cut").addEventListener("click", cutToGuideLine);
document.querySelector("#comb-dry").addEventListener("click", () => startCombPass("dry"));
document.querySelector("#comb-wet").addEventListener("click", () => startCombPass("wet"));
document.querySelector("#comb-product").addEventListener("click", () => startCombPass("product"));
document.querySelector("#comb-cycle").addEventListener("click", () => startCombPass("wet", true));
document.querySelector("#material-study").addEventListener("click", startMaterialStudy);
document.querySelector("#receipt").addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(solver.receipt(), null, 2));
  status.textContent = "Copied the current material and solver receipt.";
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!cutting) return;
  cuttingPointer = true;
  renderer.domElement.setPointerCapture(event.pointerId);
  cutAtPointer(event);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  cutCursor.style.left = `${event.clientX}px`;
  cutCursor.style.top = `${event.clientY}px`;
  if (cutting && cuttingPointer) cutAtPointer(event);
});
renderer.domElement.addEventListener("pointerup", () => {
  cuttingPointer = false;
});

window.addEventListener("resize", resize);
resize();
rebuildSolver();
applyQueryConfiguration();
rebuildSolver();
initializeNativeClipPlayback();

if (deterministicReplay.enabled && deterministicReplay.targetStep > 0) {
  const replayResult = advanceHairReplay(
    solver,
    deterministicReplay.config,
    deterministicReplay.state,
    deterministicReplay.targetStep
  );
  updateHairGeometry();
  status.textContent = `Replay step ${replayResult.step} · ${replayResult.state_digest}`;
}

window.hairMaterialReplay = {
  advanceToStep(targetStep) {
    if (!deterministicReplay.enabled) throw new Error("add replay=1 to enable fixed-step replay");
    const result = advanceHairReplay(
      solver,
      deterministicReplay.config,
      deterministicReplay.state,
      targetStep
    );
    updateHairGeometry();
    renderer.render(scene, camera);
    return result;
  },
  digest() {
    return digestHairState(solver);
  },
  receipt() {
    return solver.receipt();
  },
  renderReceipt() {
    return createRenderReceipt();
  },
  seekPresentation(seconds) {
    if (!nativeClipPlayback.clip) throw new Error("native Box3D clip is not ready");
    paused = true;
    nativeClipPlayback.elapsed = Math.max(0, Number(seconds) || 0);
    advanceNativeClip(0);
    updateHairGeometry();
    if (reelShot !== "free") {
      const pose = reelCameraPoseAtStep(deterministicReplay.state.step, reelShot);
      camera.position.fromArray(pose.position);
      controls.target.fromArray(pose.target);
      controls.update();
    }
    renderer.render(scene, camera);
    telemetryClock = -Infinity;
    updateTelemetry(performance.now());
    return {
      elapsed: nativeClipPlayback.elapsed,
      phase: fullGroomPresentation.phase,
      composition: activeHydrationState.id,
    };
  },
};

function createRenderReceipt() {
  const lockCoverageEnabled = hairRenderMode === "fatline" && Boolean(groomBindings);
  const rootCoverageCopies = rootCoverageFiberCopies(renderFibersPerGuide);
  const rootCoverageStrands = lockCoverageEnabled ? solver.guideCount * rootCoverageCopies : 0;
  const selectedHydrationRecipe = hydrationRecipe(hydrationRecipeId);
  const selectedHydrationState = resolveHairHydrationState({
    geometryId: hydrationGeometryId,
    opticalId: hydrationOpticalId,
    colorId: hydrationColorId,
    detailId: hydrationDetailId,
  });
  const tubePositions =
    sectionControlTube?.geometry.attributes.position.array ?? new Float32Array();
  const hairAttributes = hair?.geometry.attributes;
  const hairColors = hairAttributes?.instanceColor?.array ?? new Float32Array();
  const hairWidthsStart = hairAttributes?.instanceWidthStart?.array ?? new Float32Array();
  const hairWidthsEnd = hairAttributes?.instanceWidthEnd?.array ?? new Float32Array();
  const groomEnvelopeSummary = summarizeGroomEnvelope(groomEnvelopeId, activeGroomEnvelopeScale());
  const hairMassSummary = summarizeHairMassFill(hairMassFillId, hairMassDensity);
  return {
    schema: "hair-render/1",
    curated_scene: activeCuratedScene
      ? {
          field_identity: CURATED_HAIR_SCENE_FIELD_ID,
          id: activeCuratedScene.id,
          title: activeCuratedScene.title,
          description: activeCuratedScene.description,
          cue: activeCuratedScene.cue,
          index: CURATED_HAIR_SCENES.indexOf(activeCuratedScene),
          scene_count: CURATED_HAIR_SCENES.length,
          next_scene_id: nextCuratedHairSceneId(activeCuratedScene.id),
          parameters: activeCuratedScene.parameters,
          physics_authority: "none_composition_and_timeline_selection_only",
        }
      : null,
    native_box3d_clip: {
      enabled: nativeClipPlayback.enabled,
      status: nativeClipPlayback.error ? "error" : nativeClipPlayback.clip ? "playing" : "loading",
      error: nativeClipPlayback.error,
      metadata: nativeClipPlayback.clip?.metadata ?? null,
      sample_time_s: nativeClipPlayback.sampleTime,
      loop_elapsed_s: nativeClipPlayback.elapsed,
      presentation_phase: nativeClipPlayback.presentationPhase,
      hydration_pre_roll_s: NATIVE_HYDRATION_PRE_ROLL_SECONDS,
      loop_opacity: nativeClipPlayback.opacity,
      restarts: nativeClipPlayback.restarts,
      loop_start_s: nativeClipPlayback.loopStartSeconds,
      browser_role: "linear_interpolation_plus_display_hydration_only",
      physics_authority: nativeClipPlayback.clip?.metadata.physics_authority ?? null,
    },
    hair_render_mode: hairRenderMode,
    groom_mode: groomMode,
    groom_interpolation: groomInterpolationReceipt(groomBindings, groomBindingBuildCount),
    patch_lock_hydration: patchLockDistanceTelemetry(),
    authored_rest_hydration: authoredGroomTelemetry(),
    groom_envelope: {
      enabled: Boolean(groomBindings) && groomEnvelopeId !== "off",
      ...groomEnvelopeSummary,
      selected_profile_id: groomEnvelopeId,
      selected_breadth_scale: groomEnvelopeScale,
      active_geometry_scale: activeHydrationState.geometry.envelopeScale ?? 1,
      fill_strength: resolveGroomEnvelopeProfile(groomEnvelopeId).fillStrength,
      sample_distribution: "deterministic_low_discrepancy_ellipse_disk",
      projected_points: groomEnvelopeProjectedPoints,
      clamped_points: groomEnvelopeClampedPoints,
      clamped_fraction:
        groomEnvelopeProjectedPoints > 0
          ? groomEnvelopeClampedPoints / groomEnvelopeProjectedPoints
          : 0,
      maximum_normalized_output_radius: groomEnvelopeMaximumOutputRadius,
      face_clear: {
        enabled: faceClearGroomEnabled,
        field_identity: GROOM_ENVELOPE_FACE_CLEAR_ID,
        corrected_points: groomEnvelopeFaceClearCorrections,
        maximum_correction_meters: groomEnvelopeFaceClearMaximumDistance,
        front_normal_threshold: 0.28,
        center_side_normal_limit: 0.72,
        active_fraction_window: [0.1, 0.84],
        minimum_signed_side_clearance_meters: [0.36, 0.7],
        maximum_front_z_meters: [0.18, 0.5],
        boundary_order: "face_aperture_then_final_radius_one_envelope_projection",
        physics_authority: "none_renderer_hydration_only",
      },
      exact_root_count: solver.guideCount * renderFibersPerGuide,
      boundary_mesh_count: groomEnvelopeBoundaryMeshes.length,
      boundary_radial_segments: GROOM_ENVELOPE_RADIAL_SEGMENTS,
      boundary_geometry_update: summarizeGeometryTimings(groomEnvelopeBoundaryTimings),
      boundary_position_digests: groomEnvelopeBoundaryMeshes.map((mesh) =>
        float32BufferDigest(mesh.geometry.attributes.position.array)
      ),
      mechanical_digest_impact: "none_display_projection_after_solver_state",
    },
    hair_mass_fill: {
      enabled: Boolean(groomBindings) && hairMassFillId !== "off" && groomEnvelopeId !== "off",
      ...hairMassSummary,
      mesh_count: hairMassMeshes.length,
      radial_segments: HAIR_MASS_RADIAL_SEGMENTS,
      alpha_texture_identity: "deterministic_longitudinal_card_bands_v1",
      alpha_texture_resolution: [128, 256],
      alpha_texture_layers: ["dense_core", "sparse_middle"],
      visible_mesh_count: hairMassMeshes.filter((mesh) => mesh.visible).length,
      geometry_update: summarizeGeometryTimings(hairMassGeometryTimings),
      position_digests: hairMassMeshes.map((mesh) =>
        float32BufferDigest(mesh.geometry.attributes.position.array)
      ),
      presentation_source: fullGroomHydrationEnabled
        ? "microfiber_hydration_phase"
        : "fully_hydrated",
      mechanical_digest_impact: "none_display_meshes_read_live_section_frames",
    },
    hair_shading: {
      mode: hairShadingMode,
      field_identity: HAIR_FIBER_SHADING_ID,
      geometry: groomBindings ? "screen_aligned_lock_curve_spans" : "screen_aligned_strand_ribbons",
      model: activeHydrationState.optical,
      lobe_boundary: "real_time_R_TT_TRT_inspired_proxy_not_a_path_traced_BFSDF",
      longitudinal_roughness: activeHydrationState.longitudinalRoughness,
      azimuthal_roughness: activeHydrationState.azimuthalRoughness,
      cuticle_tilt_proxy: activeHydrationState.cuticleTilt,
      diffuse_weight: activeHydrationState.diffuseWeight,
      reflection_weight: activeHydrationState.reflectionWeight,
      transmission_weight: activeHydrationState.transmissionWeight,
      internal_reflection_weight: activeHydrationState.internalReflectionWeight,
      rim_weight: activeHydrationState.rimWeight,
      multiple_scattering_fill: activeHydrationState.multipleScatteringFill,
      glint_strength: activeHydrationState.glintStrength,
      absorption_tint: activeHydrationState.absorptionTint,
      color_variation: "deterministic_fiber_plus_root_tip_v1",
      root_emergence: groomBindings
        ? "distributed_parent_roots_plus_owner_clump_root_transitions"
        : "one tapered owner plus deterministic child fade over first 4-27pct",
      cross_section_coverage: "soft analytic alpha across each screen-space fiber",
      joint_coverage: groomBindings
        ? "two_catmull_rom_spans_per_solver_link"
        : "half-coverage endpoints reconstruct adjacent segment continuity",
      undercoat: groomBindings
        ? "three_layer_density_broken_scalp_shadow"
        : "hairline-masked ellipsoid cap",
      scalp_layout_identity: SCALP_LAYOUT_ID,
      distributed_root_projection_identity: groomBindings ? SCALP_ROOT_PROJECTION_ID : null,
      physics_authority: "none_renderer_only",
    },
    lock_aware_coverage: {
      enabled: lockCoverageEnabled,
      field_identity: LOCK_AWARE_COVERAGE_ID,
      render_subdivisions_per_solver_link: groomBindings ? LOCK_AWARE_RENDER_SUBDIVISIONS : 1,
      curve_interpolation: groomBindings ? "shared_parent_catmull_rom" : "none",
      distributed_root_emergence: groomBindings
        ? "distributed_8_to_16pct_root_width_then_full_width_within_first_half_link"
        : "none",
      root_coverage_fiber_copies_per_guide: lockCoverageEnabled ? rootCoverageCopies : 0,
      root_coverage_strands: rootCoverageStrands,
      root_coverage_span_primitives: rootCoverageStrands * LOCK_AWARE_ROOT_COVER_SEGMENTS,
      root_coverage_segments_per_strand: lockCoverageEnabled ? LOCK_AWARE_ROOT_COVER_SEGMENTS : 0,
      root_coverage_nominal_length_meters: lockCoverageEnabled
        ? LOCK_AWARE_ROOT_COVER_LENGTH_METERS
        : 0,
      root_coverage_live_tangent_weight: lockCoverageEnabled
        ? LOCK_AWARE_ROOT_COVER_LIVE_WEIGHT
        : 0,
      root_coverage_live_probe_particle: lockCoverageEnabled
        ? LOCK_AWARE_ROOT_COVER_PROBE_PARTICLE
        : 0,
      root_coverage_minimum_authored_direction_dot: lockCoverageEnabled
        ? LOCK_AWARE_ROOT_COVER_MIN_AUTHORED_DOT
        : 0,
      root_coverage_motion_source: lockCoverageEnabled
        ? "live_midshaft_tangent_blended_with_authored_root_field"
        : "none",
      undercoat_layer_opacities: lockCoverageEnabled ? LOCK_UNDERCOAT_LAYER_OPACITIES : [],
      root_tangent_scale: 0.34,
      shaft_tangent_scale: 0.5,
      undercoat_profile: hairUndercoatCoverageProfile
        ? {
            slices: hairUndercoatCoverageProfile.slices,
            section_count: hairUndercoatCoverageProfile.sectionCount,
            minimum_fade_start_fraction: hairUndercoatCoverageProfile.minimumFadeStart,
            maximum_fade_start_fraction: hairUndercoatCoverageProfile.maximumFadeStart,
            mean_normalized_edge_density: hairUndercoatCoverageProfile.meanNormalizedDensity,
          }
        : null,
      physics_authority: "none_renderer_only_reads_guide_positions_and_root_layout",
    },
    presentation_loop: {
      enabled: presentationLoopEnabled,
      field_identity: HAIR_PRESENTATION_LOOP_ID,
      end_step: PRESENTATION_LOOP_END_STEP,
      current_step: deterministicReplay.state.step,
      opacity: presentationLoopEnabled
        ? presentationLoopOpacityAtStep(deterministicReplay.state.step)
        : 1,
      restarts: presentationLoopRestarts,
      physics_authority: "restarts_same_deterministic_fixture_only",
    },
    wind_program: deterministicReplay.config.previewWindProgram
      ? {
          field_identity: PREVIEW_WIND_PROGRAM_ID,
          ...PREVIEW_WIND_PROGRAM,
          ...deterministicReplay.config.previewWindProgram,
          current: previewWindProgramAtStep(
            Math.max(0, deterministicReplay.state.step - 1),
            deterministicReplay.config.previewWindProgram
          ),
          strong_orbit_angle_delta_radians: Math.PI * 2,
          moderate_orbit_angle_delta_radians: Math.PI * 2,
          physics_authority: "writes_solver_wind_magnitude_and_direction_only",
        }
      : null,
    mannequin: {
      requested_mode: mannequinMode,
      status: mannequinStatus,
      asset: mannequinMode === "realistic" ? "assets/realistic-head-animation.glb" : null,
      asset_sha256:
        mannequinMode === "realistic"
          ? "d1ef943ef0b0081ed5b9d655f6b6bce419190ab754ad7aa0659bfa58e3566b78"
          : null,
      license: mannequinMode === "realistic" ? "CC0-1.0" : "in_repo_primitive",
      collision_proxy: "analytic_ellipsoid_unchanged",
      physics_authority: "none_visual_plate_only",
    },
    reel_camera: {
      shot: reelShot,
      field_identity: REEL_CAMERA_FIELD_ID,
      cycle_steps: PRESENTATION_LOOP_END_STEP,
      pose:
        reelShot === "free" ? null : reelCameraPoseAtStep(deterministicReplay.state.step, reelShot),
      physics_authority: "none_camera_only",
    },
    root_director: rootDirectorReceiptForDisplay(solver.receipt().root_director),
    scalp_layout: solver.receipt().scalp_layout,
    face_clear_groom: solver.receipt().face_clear_groom,
    section_lift: solver.receipt().section_lift,
    section_pose: solver.receipt().section_pose,
    full_groom_hydration: {
      enabled: fullGroomHydrationEnabled,
      field_identity: FULL_GROOM_HYDRATION_ID,
      phase: fullGroomPresentation.phase,
      stage_progress: fullGroomPresentation.stageProgress,
      hair_hydration: fullGroomPresentation.hairHydration,
      guide_opacity: fullGroomPresentation.guideOpacity,
      tube_opacity: fullGroomPresentation.tubeOpacity,
      population_fraction: fullGroomPresentation.populationFraction,
      width_scale: fullGroomPresentation.widthScale,
      shading_mix: fullGroomPresentation.shadingMix,
      undercoat_hydration: fullGroomPresentation.undercoatHydration,
      fiber_family_hydration: {
        owner: fullGroomPresentation.ownerHydration,
        clump: fullGroomPresentation.clumpHydration,
        microfiber: fullGroomPresentation.microfiberHydration,
        flyaway: fullGroomPresentation.flyawayHydration,
      },
      breadth_lab: {
        field_identity: HAIR_HYDRATION_RECIPE_ID,
        architecture_identity: HAIR_HYDRATION_BREADTH_ID,
        composition_count: HAIR_HYDRATION_COMPOSITION_COUNT,
        selected_recipe_shortcut: selectedHydrationRecipe,
        selected_composition: selectedHydrationState,
        active_composition: activeHydrationState,
        audition_enabled: hydrationTourEnabled,
        audition_order: HAIR_BREADTH_TOUR,
        active_audition_state: fullGroomPresentation.auditionStateId,
      },
      solver_guide_count: solver.guideCount,
      displayed_guide_count: physicsSkeletonGuides.length,
      rod_count: physicsSkeletonGuides.length * solver.segments,
      joint_count: physicsSkeletonGuides.length * (solver.segments + 1),
      style_identity: PHYSICS_SKELETON_STYLE_ID,
      rod_radius_meters: PHYSICS_SKELETON_STYLE.rodRadiusMeters,
      joint_radius_meters: PHYSICS_SKELETON_STYLE.jointRadiusMeters,
      root_joint_scale: PHYSICS_SKELETON_STYLE.rootJointScale,
      uniform_size_contract: "one_active_rod_radius_and_one_active_joint_radius",
      size_encodes: "display_role_only_not_mass_stiffness_or_constraint_type",
      mechanical_hold_depth_write: true,
      mannequin_opacity:
        1 -
        (fullGroomHydrationEnabled
          ? Math.max(0, Math.min(1, fullGroomPresentation.guideOpacity / 0.92))
          : 0) *
          0.68,
      dedicated_lighting: {
        enabled: fullGroomHydrationEnabled && fullGroomPresentation.guideOpacity > 0.002,
        rig: "cool_key_plus_cyan_fill",
      },
      section_color_count: PHYSICS_CAGE_SECTION_COLORS.length,
      geometry_update: summarizeGeometryTimings(physicsGuideCageTimings),
      position_buffer_fnv1a32: float32BufferDigest(physicsGuidePositions),
      physics_authority: "none_renderer_only_reads_mechanical_guides",
    },
    section_control_tube: {
      enabled: sectionControlTubeEnabled,
      suppressed_by_full_groom: fullGroomHydrationEnabled,
      field_identity: "mean_guide_tube_hydration_v1",
      phase: sectionPresentation.phase,
      hydration: sectionPresentation.hydration,
      opacity: sectionPresentation.tubeOpacity,
      selected_section: solver.sectionPose.section >= 0 ? solver.sectionPose.section : null,
      affected_guides: solver.sectionPose.affectedGuideCount,
      radial_segments: SECTION_CONTROL_TUBE_RADIAL_SEGMENTS,
      force_single_pass: sectionControlTube?.material.forceSinglePass ?? false,
      vertex_count: tubePositions.length / 3,
      triangle_count: sectionControlTube ? sectionControlTube.geometry.index.count / 3 : 0,
      geometry_update: summarizeGeometryTimings(sectionControlTubeTimings),
      position_buffer_fnv1a32: float32BufferDigest(tubePositions),
      physics_authority: "none_renderer_only",
    },
    guide_count: solver.guideCount,
    fiber_copies: renderFibersPerGuide,
    segments_per_guide: solver.segments,
    active_draw_primitives: hairDrawCount,
    geometry_update: summarizeGeometryTimings(hairGeometryTimings),
    renderer_draw_calls: renderer.info.render.calls,
    position_buffer_fnv1a32: float32BufferDigest(hairPositions),
    color_buffer_fnv1a32: float32BufferDigest(hairColors),
    width_start_buffer_fnv1a32: float32BufferDigest(hairWidthsStart),
    width_end_buffer_fnv1a32: float32BufferDigest(hairWidthsEnd),
    physics_state_digest: digestHairState(solver),
  };
}
