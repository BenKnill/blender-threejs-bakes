import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { HairSolver } from "./solver.js?v=124";
import {
  advanceHairReplay,
  COMB_MATERIAL_CONDITIONS,
  createReplayState,
  digestHairState,
  summarizeCombReceipt,
} from "./replay.js?v=112";
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
  physicsSkeletonDepthWriteAt,
  PHYSICS_SKELETON_STYLE,
  PHYSICS_SKELETON_STYLE_ID,
  presentationLoopOpacityAtStep,
  reelCameraPoseAtStep,
  REEL_CAMERA_FIELD_ID,
  sectionPosePresentationAtStep,
  summarizeGeometryTimings,
} from "./rendering.js?v=119";
import {
  buildGroomInterpolationBindings,
  groomBindingActiveSegments,
  groomInterpolationReceipt,
  groomSecondaryWeightAt,
  interpolateGroomScalar,
} from "./groom_interpolation.js?v=117";
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
let rootDirectorMode = "free";
let rootDirectorStrength = 0.22;
let faceClearGroomEnabled = true;
let renderReceiptEnabled = false;
let sectionControlTubeEnabled = false;
let fullGroomHydrationEnabled = false;
let hairShadingMode = "fiber_lobes";
let presentationLoopEnabled = false;
let presentationLoopRestarts = 0;
let mannequinMode = "primitive";
let mannequinStatus = "primitive_ready";
let heroMannequin;
let reelShot = "free";
const PRESENTATION_LOOP_END_STEP = 450;
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
let sectionControlTube;
let sectionControlTubeTimings = [];
let sectionPresentation = { phase: "off", hydration: 1, tubeOpacity: 0 };
let fullGroomPresentation = {
  phase: "hair_only",
  hairHydration: 1,
  guideOpacity: 0,
  tubeOpacity: 0,
};
let physicsGuideCage;
let physicsJointMesh;
let physicsGuidePositions = new Float32Array();
let physicsGuideCageTimings = [];
let physicsSkeletonGuides = [];
const SECTION_CONTROL_TUBE_RADIAL_SEGMENTS = 10;
const SECTION_CONTROL_TUBE_COLOR = new THREE.Color(0x63e6ff);
const PHYSICS_CAGE_SECTION_COLORS = Object.freeze([
  0x63e6ff, 0x9b87ff, 0xe879f9, 0xfb7185, 0xfbbf24, 0x86efac, 0x22d3ee, 0xc4b5fd,
]);
const physicsRodStart = new THREE.Vector3();
const physicsRodEnd = new THREE.Vector3();
const physicsRodMidpoint = new THREE.Vector3();
const physicsRodDirection = new THREE.Vector3();
const physicsRodQuaternion = new THREE.Quaternion();
const physicsRodScale = new THREE.Vector3();
const physicsJointScale = new THREE.Vector3();
const physicsInstanceMatrix = new THREE.Matrix4();
const physicsUp = new THREE.Vector3(0, 1, 0);
const fatlineBaseColor = new THREE.Color();
const hairFiberColorScratch = { r: 0, g: 0, b: 0 };
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
  const indices = [];
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
  const step = deterministicReplay.enabled
    ? deterministicReplay.state.step
    : Math.floor(solver.time * 60);
  fullGroomPresentation = fullGroomHydrationEnabled
    ? fullGroomHydrationAtStep(step)
    : { phase: "hair_only", hairHydration: 1, guideOpacity: 0, tubeOpacity: 0 };
  if (hairRenderMode === "fatline" && hair?.material.uniforms?.presentationHydration) {
    hair.material.uniforms.presentationHydration.value = fullGroomPresentation.hairHydration;
  } else if (hair?.material) {
    const baseOpacity = hair.material.userData.baseOpacity ?? 1;
    hair.material.opacity = baseOpacity * fullGroomPresentation.hairHydration;
  }
  if (hairUndercoat) {
    for (const layer of hairUndercoat.children) {
      layer.material.opacity =
        layer.material.userData.baseOpacity * fullGroomPresentation.hairHydration;
    }
    hairUndercoat.visible = fullGroomPresentation.hairHydration > 0.002;
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
  activeSegments
) {
  const hydration = sectionHydrationForGuide(guide);
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
  const widthScale = 0.12 + 0.88 * hydration;
  const emergenceScaleAt = groomBindings ? lockAwareFiberEmergenceScaleAt : fiberEmergenceScaleAt;
  widthsStart[instance] =
    fatlineHalfWidthAt(startParticle, activeSegments) *
    widthScale *
    emergenceScaleAt(guide, copy, startParticle, activeSegments, solver.rootNormals[guide * 3 + 1]);
  widthsEnd[instance] =
    fatlineHalfWidthAt(endParticle, activeSegments) *
    widthScale *
    emergenceScaleAt(guide, copy, endParticle, activeSegments, solver.rootNormals[guide * 3 + 1]);
}

function updateSectionControlTube() {
  if (!sectionControlTube) return;
  const started = performance.now();
  const section = solver.sectionPose.section;
  sectionControlTube.material.opacity = sectionPresentation.tubeOpacity;
  sectionControlTube.visible =
    (sectionControlTubeEnabled || fullGroomHydrationEnabled) &&
    section >= 0 &&
    sectionPresentation.tubeOpacity > 0.002;
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
      keyDirectionWorld: { value: new THREE.Vector3(4, 6, 5).normalize() },
      rimDirectionWorld: { value: new THREE.Vector3(-3, 1, 3).normalize() },
      keyColor: { value: new THREE.Color(0xffddcf) },
      rimColor: { value: new THREE.Color(0x667dd8) },
      longitudinalRoughness: { value: 0.34 },
      multipleScatteringFill: { value: 0.11 },
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
      uniform vec3 keyDirectionWorld;
      uniform vec3 rimDirectionWorld;
      uniform vec3 keyColor;
      uniform vec3 rimColor;
      uniform float longitudinalRoughness;
      uniform float multipleScatteringFill;
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
        float fiberAlpha =
          fiberCoverage * jointCoverage * (0.72 + 0.22 * crossSection) * presentationHydration;
        if (shadingEnabled < 0.5) {
          gl_FragColor = vec4(vColor, fiberAlpha);
          return;
        }

        vec3 tangent = normalize(vTangentView);
        vec3 viewDirection = normalize(-vPositionView);
        vec3 keyDirection = normalize((viewMatrix * vec4(keyDirectionWorld, 0.0)).xyz);
        vec3 rimDirection = normalize((viewMatrix * vec4(rimDirectionWorld, 0.0)).xyz);
        vec3 keyHalf = normalize(keyDirection + viewDirection);
        vec3 rimHalf = normalize(rimDirection + viewDirection);
        float tangentKeyHalf = dot(tangent, keyHalf);
        float tangentRimHalf = dot(tangent, rimHalf);

        float diffuse = strandDiffuse(tangent, keyDirection);
        float primary = longitudinalLobe(tangentKeyHalf, 0.10, longitudinalRoughness);
        float transmission = longitudinalLobe(
          tangentKeyHalf,
          -0.16,
          longitudinalRoughness * 1.65
        );
        float rimPrimary = longitudinalLobe(
          tangentRimHalf,
          0.08,
          longitudinalRoughness * 1.15
        );
        float cylinderEdge = 0.68 + 0.32 * abs(vAcross);
        vec3 scatteringTint = pow(max(vColor, vec3(0.0)), vec3(0.46));

        vec3 color = vColor * (0.34 + 0.62 * diffuse);
        color += keyColor * primary * cylinderEdge * 0.23;
        color += scatteringTint * keyColor * transmission * 0.1;
        color += rimColor * rimPrimary * cylinderEdge * 0.16;
        color += scatteringTint * multipleScatteringFill * (0.72 + 0.28 * diffuse);
        color *= 0.9 + 0.1 * crossSection;
        color = color / (vec3(0.94) + color);
        gl_FragColor = vec4(color, fiberAlpha);
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
  groomBindings = groomMode.startsWith("section_")
    ? buildGroomInterpolationBindings(solver.roots, solver.guideCount, renderFibersPerGuide, {
        parentCount: groomMode === "section_volume" ? 3 : 2,
      })
    : null;
  if (groomBindings) groomBindingBuildCount += 1;
  filmDirection.startTime = null;
  filmDirection.cutDone = false;
  filmDirection.cutStrands.clear();
  deterministicReplay.state = createReplayState();
  applyMaterialControls();
  rebuildHairObject();
  rebuildSectionControlTube();
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
  const geometryStart = performance.now();
  if (hairRenderMode === "fatline") {
    updateFatlineGeometry();
    hairGeometryTimings.push(performance.now() - geometryStart);
    if (hairGeometryTimings.length > 660) hairGeometryTimings.shift();
    updatePhysicsGuideCage();
    updateSectionControlTube();
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

function writeBlendedGroomCurvePoint(
  target,
  targetOffset,
  owner,
  neighbor,
  secondaryNeighbor,
  particle,
  activeSegments,
  neighborWeight,
  secondaryNeighborWeight,
  secondaryActiveSegments
) {
  const clampedParticle = Math.max(0, Math.min(activeSegments, particle));
  const secondaryWeight = groomSecondaryWeightAt(
    clampedParticle,
    activeSegments,
    secondaryNeighborWeight,
    secondaryActiveSegments
  );
  const ownerPoint = solver.index(owner, clampedParticle);
  const neighborPoint = solver.index(neighbor, clampedParticle);
  const secondaryPoint = solver.index(secondaryNeighbor, clampedParticle);
  for (let axis = 0; axis < 3; axis += 1) {
    target[targetOffset + axis] = interpolateGroomScalar(
      solver.positions[ownerPoint + axis],
      solver.positions[neighborPoint + axis],
      neighborWeight,
      solver.positions[secondaryPoint + axis],
      secondaryWeight
    );
  }
  if (clampedParticle === 0) {
    projectPointToScalpShell(
      target[targetOffset],
      target[targetOffset + 1],
      target[targetOffset + 2],
      target,
      targetOffset
    );
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
  let instance = 0;
  for (let binding = 0; binding < groomBindings.bindingCount; binding += 1) {
    const owner = owners[binding];
    const neighbor = neighbors[binding];
    const secondaryNeighbor = secondaryNeighbors[binding];
    const neighborWeight = weights[binding];
    const secondaryNeighborWeight = secondaryWeights[binding];
    const activeSegments = groomBindingActiveSegments(
      solver.activeSegments,
      owner,
      neighbor,
      neighborWeight
    );
    const secondaryActiveSegments = solver.activeSegments[secondaryNeighbor];
    const copy = binding % renderFibersPerGuide;
    writeBlendedGroomCurvePoint(
      lockCurvePoints,
      0,
      owner,
      neighbor,
      secondaryNeighbor,
      0,
      activeSegments,
      neighborWeight,
      secondaryNeighborWeight,
      secondaryActiveSegments
    );
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
    writeBlendedGroomCurvePoint(
      lockRootCoverageProbe,
      0,
      owner,
      neighbor,
      secondaryNeighbor,
      Math.min(LOCK_AWARE_ROOT_COVER_PROBE_PARTICLE, activeSegments),
      activeSegments,
      neighborWeight,
      secondaryNeighborWeight,
      secondaryActiveSegments
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
    let cursor;
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
        activeSegments
      );
      const hydration = 0.12 + 0.88 * sectionHydrationForGuide(owner);
      widthsStart[instance] =
        FATLINE_ROOT_HALF_WIDTH_PX * LOCK_ROOT_COVER_WIDTH_PROFILE[coverSegment] * hydration;
      widthsEnd[instance] =
        FATLINE_ROOT_HALF_WIDTH_PX * LOCK_ROOT_COVER_WIDTH_PROFILE[coverSegment + 1] * hydration;
      instance += 1;
    }
    for (let segment = 0; segment < activeSegments; segment += 1) {
      for (let controlPoint = 0; controlPoint < 4; controlPoint += 1) {
        writeBlendedGroomCurvePoint(
          lockCurvePoints,
          controlPoint * 3,
          owner,
          neighbor,
          secondaryNeighbor,
          segment + controlPoint - 1,
          activeSegments,
          neighborWeight,
          secondaryNeighborWeight,
          secondaryActiveSegments
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
  document.querySelector("#metric-reel-presentation").textContent =
    `${mannequinStatus.replaceAll("_", " ")} · ${reelShot.replaceAll("_", " ")}`;
  document.querySelector("#metric-root-director").textContent = receipt.root_director.enabled
    ? `${receipt.root_director.mode.replaceAll("_", " ")} · ${receipt.root_director.strength.toFixed(2)}`
    : "off";
  document.querySelector("#metric-root-alignment").textContent =
    `${receipt.root_director.minimum_first_segment_normal_dot.toFixed(3)} / ${receipt.root_director.mean_first_segment_normal_dot.toFixed(3)}`;
  document.querySelector("#metric-root-field-alignment").textContent =
    `${receipt.root_director.minimum_first_segment_target_dot.toFixed(3)} / ${receipt.root_director.mean_first_segment_target_dot.toFixed(3)}`;
  document.querySelector("#metric-root-field-outward").textContent =
    `${receipt.root_director.minimum_target_outward_dot.toFixed(3)} / ${receipt.root_director.mean_target_tangential_magnitude.toFixed(3)}`;
  document.querySelector("#metric-section-lift").textContent =
    `${receipt.section_lift.phase} · ${receipt.section_lift.target_meters.toFixed(2)} m`;
  document.querySelector("#metric-section-pose").textContent =
    receipt.section_pose.selected_section === null
      ? "off"
      : `${receipt.section_pose.phase} · s${receipt.section_pose.selected_section} · ${receipt.section_pose.affected_guides} guides · ${receipt.section_pose.lift_meters.toFixed(2)} / ${receipt.section_pose.tangential_sweep_meters.toFixed(2)} m`;
  document.querySelector("#metric-control-tube").textContent = fullGroomHydrationEnabled
    ? `${fullGroomPresentation.phase.replaceAll("_", " ")} · ${(fullGroomPresentation.hairHydration * 100).toFixed(0)}% hair · ${(fullGroomPresentation.guideOpacity * 100).toFixed(0)}% guides`
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
  document.querySelector("#showcase-phase").textContent = fullGroomHydrationEnabled
    ? fullGroomPresentation.phase === "mechanical_skeleton"
      ? `mechanical rods · ${physicsSkeletonGuides.length} guides / ${physicsSkeletonGuides.length * solver.segments} links`
      : `groom hydration · ${fullGroomPresentation.phase.replaceAll("_", " ")}`
    : sectionControlTubeEnabled && sectionPresentation.phase !== "simulation"
      ? `control tube · ${sectionPresentation.phase}`
      : solver.comb.enabled
        ? `${solver.comb.phase} comb pass`
        : receipt.assumption_receipt.measurement_window === "comb_cycle"
          ? "two-pass complete · wind orbit continues"
          : receipt.assumption_receipt.measurement_window.replaceAll("_", " ");
  document.querySelector("#showcase-wind").textContent =
    `wind ${windDegrees.toFixed(0)}° · ${receipt.wind.magnitude.toFixed(2)}`;
  const stretchWindow = receipt.assumption_receipt.measurement_window;
  const stretchQualifier =
    stretchWindow === "full_simulation"
      ? "live"
      : `gate ${receipt.assumption_receipt.stretch.satisfied ? "pass" : "fail"}`;
  document.querySelector("#showcase-stretch").textContent =
    `stretch ${(receipt.max_relative_stretch_error * 100).toFixed(2)}% · ${stretchQualifier}`;
  if (performance.memory) {
    document.querySelector("#metric-memory").textContent = `${(
      performance.memory.usedJSHeapSize /
      1024 /
      1024
    ).toFixed(1)} MiB`;
  }
}

function updateWindVisual() {
  windCompass.visible = solver.directionalWind;
  windStreaks.visible = solver.directionalWind;
  if (!solver.directionalWind) return;
  const direction = new THREE.Vector3(solver.windDirection[0], 0, solver.windDirection[2]);
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
  windArrow.setDirection(direction);
  windArrow.setLength(0.9 + solver.wind * 0.9, 0.24, 0.14);
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
    if (deterministicReplay.enabled) {
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
  renderer.domElement.style.opacity = presentationLoopEnabled
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
  const params = new URLSearchParams(window.location.search);
  const showcase = params.get("showcase") === "1";
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
    renderFibersPerGuide = Math.max(1, Math.min(21, Number(params.get("fibers")) || 9));
  }
  hairRenderMode = params.get("hairRender") === "fatline" ? "fatline" : "lines";
  groomMode =
    hairRenderMode !== "fatline"
      ? "radial_xz"
      : params.get("groomVolume") === "1"
        ? "section_volume"
        : params.get("groomSections") === "1"
          ? "section_interp"
          : "radial_xz";
  document.querySelector("#groom-display").value = hairRenderMode === "lines" ? "lines" : groomMode;
  hairShadingMode = params.get("hairShade") === "flat" ? "flat" : "fiber_lobes";
  document.querySelector("#hair-surface").value = hairShadingMode;
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
}

for (const [id, output, format] of [
  ["guides", "guide-output", (value) => value],
  ["iterations", "iteration-output", (value) => value],
  ["moisture", "moisture-output", (value) => `${Math.round(value * 100)}%`],
  ["product", "product-output", (value) => `${Math.round(value * 100)}%`],
  ["lift", "lift-output", (value) => `${Number(value).toFixed(2)} m`],
  ["pose-lift", "pose-lift-output", (value) => `${Number(value).toFixed(2)} m`],
  ["pose-sweep", "pose-sweep-output", (value) => `${Number(value).toFixed(2)} m`],
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
  rebuildSolver();
});
document.querySelector("#hair-surface").addEventListener("change", (event) => {
  hairShadingMode = event.currentTarget.value === "flat" ? "flat" : "fiber_lobes";
  if (hairRenderMode === "fatline") {
    hair.material.uniforms.shadingEnabled.value = hairShadingMode === "fiber_lobes" ? 1 : 0;
  }
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
};

function createRenderReceipt() {
  const lockCoverageEnabled = hairRenderMode === "fatline" && Boolean(groomBindings);
  const tubePositions =
    sectionControlTube?.geometry.attributes.position.array ?? new Float32Array();
  const hairAttributes = hair?.geometry.attributes;
  const hairColors = hairAttributes?.instanceColor?.array ?? new Float32Array();
  const hairWidthsStart = hairAttributes?.instanceWidthStart?.array ?? new Float32Array();
  const hairWidthsEnd = hairAttributes?.instanceWidthEnd?.array ?? new Float32Array();
  return {
    schema: "hair-render/1",
    hair_render_mode: hairRenderMode,
    groom_mode: groomMode,
    groom_interpolation: groomInterpolationReceipt(groomBindings, groomBindingBuildCount),
    hair_shading: {
      mode: hairShadingMode,
      field_identity: HAIR_FIBER_SHADING_ID,
      geometry: groomBindings ? "screen_aligned_lock_curve_spans" : "screen_aligned_strand_ribbons",
      primary_lobe: "white_shifted_root_reflection",
      secondary_lobe: "hair_tinted_tip_transmission",
      longitudinal_roughness: 0.34,
      multiple_scattering_fill: 0.11,
      color_variation: "deterministic_fiber_plus_root_tip_v1",
      root_emergence: groomBindings
        ? "distributed_parent_roots_plus_short_styled_coverage_locks"
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
      root_coverage_strands: lockCoverageEnabled ? groomBindings.bindingCount : 0,
      root_coverage_span_primitives:
        (lockCoverageEnabled ? groomBindings.bindingCount : 0) * LOCK_AWARE_ROOT_COVER_SEGMENTS,
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
    root_director: solver.receipt().root_director,
    scalp_layout: solver.receipt().scalp_layout,
    face_clear_groom: solver.receipt().face_clear_groom,
    section_lift: solver.receipt().section_lift,
    section_pose: solver.receipt().section_pose,
    full_groom_hydration: {
      enabled: fullGroomHydrationEnabled,
      field_identity: FULL_GROOM_HYDRATION_ID,
      phase: fullGroomPresentation.phase,
      hair_hydration: fullGroomPresentation.hairHydration,
      guide_opacity: fullGroomPresentation.guideOpacity,
      tube_opacity: fullGroomPresentation.tubeOpacity,
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
