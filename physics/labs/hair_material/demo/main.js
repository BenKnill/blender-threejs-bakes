import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { HairSolver } from "./solver.js";

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
  const vertexCapacity = solver.guideCount * solver.segments * 3 * 2;
  hairPositions = new Float32Array(vertexCapacity * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(hairPositions, 3));
  const material = new THREE.LineBasicMaterial({
    color: hairColor(),
    transparent: true,
    opacity: 0.92,
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
  solver = new HairSolver({ guideCount, segments: 12, iterations, preset });
  applyMaterialControls();
  rebuildHairObject();
  status.textContent = `Running deterministic ${preset} preset.`;
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
    for (let copy = 0; copy < 3; copy += 1) {
      const offset = (copy - 1) * 0.012;
      const phase = strand * 1.618 + copy * 2.094;
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

function updateTelemetry(now) {
  if (now - telemetryClock < 220) return;
  telemetryClock = now;
  const receipt = solver.receipt();
  document.querySelector("#metric-guides").textContent = receipt.guide_count.toLocaleString();
  document.querySelector("#metric-fibers").textContent =
    receipt.render_fiber_count.toLocaleString();
  document.querySelector("#metric-particles").textContent = solver.particleCount.toLocaleString();
  document.querySelector("#metric-solver").textContent = `${smoothedSolverMs.toFixed(2)} ms`;
  document.querySelector("#metric-fps").textContent = smoothedFps.toFixed(0);
  document.querySelector("#metric-stretch").textContent = `${(
    receipt.max_relative_stretch_error * 100
  ).toFixed(2)}%`;
  document.querySelector("#metric-cuts").textContent = receipt.cut_count.toLocaleString();
  if (performance.memory) {
    document.querySelector("#metric-memory").textContent = `${(
      performance.memory.usedJSHeapSize /
      1024 /
      1024
    ).toFixed(1)} MiB`;
  }
}

function animate(now) {
  const frameDt = Math.min(1 / 30, Math.max(1 / 240, (now - lastFrame) / 1000));
  lastFrame = now;
  smoothedFps = smoothedFps * 0.92 + (1 / frameDt) * 0.08;
  if (!paused) {
    const start = performance.now();
    solver.step(frameDt);
    smoothedSolverMs = smoothedSolverMs * 0.9 + (performance.now() - start) * 0.1;
  }
  updateHairGeometry();
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
    document.querySelector(`#${output}`).textContent = format(Number(input.value));
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
