import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { HairSolver } from "./solver.js";
import { advanceHairReplay, createReplayState, digestHairState } from "./replay.js";

let renderFibersPerGuide = 9;

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

let solver;
let hair;
let hairPositions;
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
};
const deterministicReplay = {
  enabled: false,
  autoplay: false,
  targetStep: 0,
  collectiveRulesEnabled: true,
  state: createReplayState(),
  config: { dt: 1 / 60, baseWind: 0.18, gust: 0, cut: "none", cutAt: 2.5, cutDuration: 1.4 },
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

function rebuildHairObject() {
  if (hair) {
    scene.remove(hair);
    hair.geometry.dispose();
    hair.material.dispose();
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
  });
  filmDirection.startTime = null;
  filmDirection.cutDone = false;
  filmDirection.cutStrands.clear();
  deterministicReplay.state = createReplayState();
  applyMaterialControls();
  rebuildHairObject();
  status.textContent = `Running deterministic ${preset} preset.`;
}

function startCombPass(condition) {
  const wet = condition === "wet";
  document.querySelector("#moisture").value = wet ? "0.85" : "0.05";
  document.querySelector("#product").value = wet ? "0.2" : "0";
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
    comb: { startStep: 30, endStep: 150, startX: -1.35, endX: 1.35 },
  };
  rebuildSolver();
  document.querySelector("#scenario-label").textContent = `Comb-through instrument · ${condition}`;
  status.textContent = `${condition} comb pass: settling, then measuring steps 30–150.`;
}

function applyMaterialControls() {
  solver.setMoisture(Number(document.querySelector("#moisture").value));
  solver.setProduct(Number(document.querySelector("#product").value));
  solver.setSectionLift(Number(document.querySelector("#lift").value));
  solver.wind = Number(document.querySelector("#wind").value);
}

function updateHairGeometry() {
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
  document.querySelector("#metric-cohesion").textContent =
    receipt.cohesion_corrections_last_iteration.toLocaleString();
  document.querySelector("#metric-bonds").textContent =
    receipt.persistent_clump_bonds.toLocaleString();
  document.querySelector("#metric-hysteresis").textContent =
    `${receipt.clump_captures_last_step} / ${receipt.clump_releases_last_step} · pass ${receipt.comb.clump_captures_during_window} / ${receipt.comb.clump_releases_during_window}`;
  document.querySelector("#metric-pressure").textContent =
    receipt.crowd_pressure_corrections_last_iteration.toLocaleString();
  document.querySelector("#metric-solver").textContent = `${smoothedSolverMs.toFixed(2)} ms`;
  document.querySelector("#metric-fps").textContent = smoothedFps.toFixed(0);
  document.querySelector("#metric-stretch").textContent = `${(
    receipt.max_relative_stretch_error * 100
  ).toFixed(2)}%`;
  document.querySelector("#metric-cuts").textContent = receipt.cut_count.toLocaleString();
  document.querySelector("#metric-comb-force").textContent =
    receipt.comb.peak_reaction_proxy.toFixed(0);
  document.querySelector("#metric-comb-work").textContent =
    receipt.comb.accumulated_work_proxy.toFixed(0);
  document.querySelector("#metric-comb-travel").textContent =
    `${receipt.comb.accumulated_travel.toFixed(2)} m`;
  document.querySelector("#metric-trace-samples").textContent =
    `${receipt.comb.force_displacement_trace.length} @ ${receipt.comb.trace_sample_stride}`;
  const assumptionMetric = document.querySelector("#metric-assumptions");
  assumptionMetric.textContent = receipt.assumption_receipt.status;
  assumptionMetric.dataset.status = receipt.assumption_receipt.status;
  drawCombTrace(receipt.comb.force_displacement_trace);
  if (performance.memory) {
    document.querySelector("#metric-memory").textContent = `${(
      performance.memory.usedJSHeapSize /
      1024 /
      1024
    ).toFixed(1)} MiB`;
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
  const maxDisplacement = Math.max(...trace.map((sample) => sample.displacement), 1e-9);
  const maxReaction = Math.max(...trace.map((sample) => sample.reaction_proxy), 1e-9);
  context.strokeStyle = "#63e6ff";
  context.lineWidth = 2;
  context.beginPath();
  for (let index = 0; index < trace.length; index += 1) {
    const sample = trace[index];
    const x = 28 + (sample.displacement / maxDisplacement) * (canvas.width - 38);
    const y = canvas.height - 20 - (sample.reaction_proxy / maxReaction) * (canvas.height - 32);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
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
      }
    } else {
      updateFilmDirection(now);
      solver.step(frameDt);
    }
    smoothedSolverMs = smoothedSolverMs * 0.9 + (performance.now() - start) * 0.1;
  }
  updateHairGeometry();
  comb.visible = Boolean(deterministicReplay.config.comb);
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
}

function applyQueryConfiguration() {
  const params = new URLSearchParams(window.location.search);
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
  if (params.has("fibers")) {
    renderFibersPerGuide = Math.max(1, Math.min(21, Number(params.get("fibers")) || 9));
  }
  if (params.get("film") === "1") {
    filmDirection.enabled = true;
    filmDirection.baseWind = Number(params.get("wind") ?? 0.18);
    filmDirection.gust = Math.max(0, Number(params.get("gust") ?? 0));
    filmDirection.cut = ["none", "bob", "diagonal"].includes(params.get("cut"))
      ? params.get("cut")
      : "none";
    filmDirection.cutAt = Math.max(0, Number(params.get("cutAt") ?? 2.5));
    filmDirection.cutDuration = Math.max(0.2, Number(params.get("cutDuration") ?? 1.4));
    controls.autoRotate = true;
    controls.autoRotateSpeed = Number(params.get("orbit") ?? 0.8);
  }
  if (params.get("replay") === "1") {
    deterministicReplay.enabled = true;
    deterministicReplay.autoplay = params.get("autoplay") === "1";
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
      comb:
        params.get("comb") === "1"
          ? {
              startStep: Math.max(0, Number(params.get("combStart") ?? 30)),
              endStep: Math.max(1, Number(params.get("combEnd") ?? 150)),
              startX: -1.35,
              endX: 1.35,
            }
          : undefined,
    };
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
};
