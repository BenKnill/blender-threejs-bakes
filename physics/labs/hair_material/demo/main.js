import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { HairSolver } from "./solver.js?v=113";
import {
  advanceHairReplay,
  COMB_MATERIAL_CONDITIONS,
  createReplayState,
  digestHairState,
  summarizeCombReceipt,
} from "./replay.js?v=111";
import {
  fatlineColorScale,
  fatlineHalfWidthAt,
  float32BufferDigest,
  summarizeGeometryTimings,
} from "./rendering.js?v=107";
import {
  buildGroomInterpolationBindings,
  groomBindingActiveSegments,
  groomInterpolationReceipt,
  groomSecondaryWeightAt,
  interpolateGroomScalar,
} from "./groom_interpolation.js?v=117";

let renderFibersPerGuide = 9;
let hairRenderMode = "lines";
let groomMode = "radial_xz";
let groomBindings = null;
let groomBindingBuildCount = 0;
let rootDirectorMode = "free";
let rootDirectorStrength = 0.22;
let renderReceiptEnabled = false;
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

const porcelain = new THREE.MeshStandardMaterial({
  color: 0xb77569,
  roughness: 0.42,
  metalness: 0.03,
});
const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), porcelain);
head.scale.set(0.9, 1.12, 0.82);
head.position.set(0, 1.35, 0);
scene.add(head);
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 1.3, 32), porcelain);
neck.position.set(0, -0.03, 0);
scene.add(neck);
const bust = new THREE.Mesh(
  new THREE.SphereGeometry(1, 40, 20),
  new THREE.MeshStandardMaterial({ color: 0x172452, roughness: 0.68 })
);
bust.scale.set(2.15, 0.58, 0.86);
bust.position.set(0, -0.9, 0.12);
scene.add(bust);
for (const x of [-0.31, 0.31]) {
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x12090d, roughness: 0.2 })
  );
  eye.position.set(x, 1.56, 0.77);
  scene.add(eye);
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
let hairPositions;
let hairDrawCount = 0;
let hairGeometryTimings = [];
const fatlineBaseColor = new THREE.Color();
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

function createFatlineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader: `
      uniform vec2 resolution;
      attribute vec3 instanceStart;
      attribute vec3 instanceEnd;
      attribute vec3 instanceColor;
      attribute float instanceWidthStart;
      attribute float instanceWidthEnd;
      varying vec3 vColor;

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
        vec2 offsetPixels = side * sideSign * width + direction * capSign * min(width, 1.0);
        vec2 offsetNdc = offsetPixels * 2.0 / resolution;
        vec4 clipPosition = mix(startClip, endClip, along);
        clipPosition.xy += offsetNdc * clipPosition.w;
        gl_Position = clipPosition;
        vColor = instanceColor;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    depthTest: true,
    depthWrite: true,
  });
}

function rebuildFatlineObject() {
  const instanceCapacity = solver.guideCount * solver.segments * renderFibersPerGuide;
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
  const undercoatGeometry = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, 1.18);
  const undercoatMaterial = new THREE.MeshStandardMaterial({
    color: hairColor(),
    roughness: 0.88,
    metalness: 0,
  });
  hairUndercoat = new THREE.Mesh(undercoatGeometry, undercoatMaterial);
  hairUndercoat.scale.set(0.915, 1.138, 0.835);
  hairUndercoat.position.set(0, 1.35, 0);
  hairUndercoat.renderOrder = -1;
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
    hairUndercoat.geometry.dispose();
    hairUndercoat.material.dispose();
    hairUndercoat = null;
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
  const material = new THREE.LineBasicMaterial({
    color: hairColor(),
    transparent: true,
    opacity: Math.max(0.42, 0.78 - renderFibersPerGuide * 0.02),
  });
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
  solver.wind = Number(document.querySelector("#wind").value);
}

function updateHairGeometry() {
  const geometryStart = performance.now();
  if (hairRenderMode === "fatline") {
    updateFatlineGeometry();
    hairGeometryTimings.push(performance.now() - geometryStart);
    if (hairGeometryTimings.length > 660) hairGeometryTimings.shift();
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
      const colorScale = fatlineColorScale(strand, copy);
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
        colors[cursor] = Math.min(1, fatlineBaseColor.r * colorScale);
        colors[cursor + 1] = Math.min(1, fatlineBaseColor.g * colorScale);
        colors[cursor + 2] = Math.min(1, fatlineBaseColor.b * colorScale);
        widthsStart[instance] = fatlineHalfWidthAt(segment, activeSegments);
        widthsEnd[instance] = fatlineHalfWidthAt(segment + 1, activeSegments);
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
    const colorScale = fatlineColorScale(owner, copy);
    for (let segment = 0; segment < activeSegments; segment += 1) {
      const secondaryStartWeight = groomSecondaryWeightAt(
        segment,
        activeSegments,
        secondaryNeighborWeight,
        secondaryActiveSegments
      );
      const secondaryEndWeight = groomSecondaryWeightAt(
        segment + 1,
        activeSegments,
        secondaryNeighborWeight,
        secondaryActiveSegments
      );
      const ownerStart = solver.index(owner, segment);
      const neighborStart = solver.index(neighbor, segment);
      const secondaryNeighborStart = solver.index(secondaryNeighbor, segment);
      const ownerEnd = solver.index(owner, segment + 1);
      const neighborEnd = solver.index(neighbor, segment + 1);
      const secondaryNeighborEnd = solver.index(secondaryNeighbor, segment + 1);
      const cursor = instance * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        starts[cursor + axis] = interpolateGroomScalar(
          solver.positions[ownerStart + axis],
          solver.positions[neighborStart + axis],
          neighborWeight,
          solver.positions[secondaryNeighborStart + axis],
          secondaryStartWeight
        );
        ends[cursor + axis] = interpolateGroomScalar(
          solver.positions[ownerEnd + axis],
          solver.positions[neighborEnd + axis],
          neighborWeight,
          solver.positions[secondaryNeighborEnd + axis],
          secondaryEndWeight
        );
      }
      colors[cursor] = Math.min(1, fatlineBaseColor.r * colorScale);
      colors[cursor + 1] = Math.min(1, fatlineBaseColor.g * colorScale);
      colors[cursor + 2] = Math.min(1, fatlineBaseColor.b * colorScale);
      widthsStart[instance] = fatlineHalfWidthAt(segment, activeSegments);
      widthsEnd[instance] = fatlineHalfWidthAt(segment + 1, activeSegments);
      instance += 1;
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
  document.querySelector("#showcase-phase").textContent = solver.comb.enabled
    ? `${solver.comb.phase} comb pass`
    : receipt.assumption_receipt.measurement_window === "comb_cycle"
      ? "two-pass complete · wind orbit continues"
      : receipt.assumption_receipt.measurement_window.replaceAll("_", " ");
  document.querySelector("#showcase-wind").textContent =
    `wind ${windDegrees.toFixed(0)}° · ${receipt.wind.magnitude.toFixed(2)}`;
  document.querySelector("#showcase-stretch").textContent =
    `stretch ${(receipt.max_relative_stretch_error * 100).toFixed(2)}% · ${receipt.assumption_receipt.status}`;
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
  updateHairGeometry();
  updateWindVisual();
  comb.visible = Boolean(deterministicReplay.config.comb && solver.comb.enabled);
  comb.position.x = solver.comb.currentX;
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
  renderReceiptEnabled = params.get("renderReceipt") === "1";
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
    controls.autoRotate = true;
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
      controls.autoRotate = true;
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
  ["wind", "wind-output", (value) => Number(value).toFixed(2)],
]) {
  const input = document.querySelector(`#${id}`);
  input.addEventListener("input", () => {
    const outputElement = document.querySelector(`#${output}`);
    const formattedValue = format(Number(input.value));
    outputElement.textContent = formattedValue;
    const controlLabel = input.closest("label")?.querySelector("span")?.textContent ?? id;
    outputElement.setAttribute("aria-label", `${controlLabel} ${formattedValue}`);
    if (["moisture", "product", "lift", "wind"].includes(id)) applyMaterialControls();
  });
  if (["guides", "iterations"].includes(id)) input.addEventListener("change", rebuildSolver);
}

document.querySelector("#preset").addEventListener("change", rebuildSolver);
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
  return {
    schema: "hair-render/1",
    hair_render_mode: hairRenderMode,
    groom_mode: groomMode,
    groom_interpolation: groomInterpolationReceipt(groomBindings, groomBindingBuildCount),
    root_director: solver.receipt().root_director,
    section_lift: solver.receipt().section_lift,
    guide_count: solver.guideCount,
    fiber_copies: renderFibersPerGuide,
    segments_per_guide: solver.segments,
    active_draw_primitives: hairDrawCount,
    geometry_update: summarizeGeometryTimings(hairGeometryTimings),
    renderer_draw_calls: renderer.info.render.calls,
    position_buffer_fnv1a32: float32BufferDigest(hairPositions),
    physics_state_digest: digestHairState(solver),
  };
}
