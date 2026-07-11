import { createEditorScene } from "./scene.js";
import { COMPUTE_EFFECTS, computeEffectMap } from "./effects.js";
import {
  frameObjectsWithCamera,
  renderAspectFromInputs,
  updateSafeFrameOverlay,
} from "./framing.js";
import { createInstanceStore } from "./instances.js";
import { createInspector } from "./inspector.js";
import { applyLightingToControls, createLightingControls, currentLighting } from "./lighting.js";
import { applyLayoutFields, cameraSnapshot, currentLayout, downloadLayout } from "./layout-io.js";
import { loadManifest } from "./manifest-loader.js";
import { createMotionPlayer } from "./motion-player.js";
import { createEffectProxyObject, createProxyLoader } from "./proxies.js";
import { createSelection } from "./selection.js";
import { renderAssetPalette, renderInstanceList, setModeButtons } from "./ui.js";

const MODE_LABELS = { translate: "Move", rotate: "Rotate", scale: "Scale" };

const viewport = document.querySelector("#viewport");
const safeFrame = document.querySelector("#safeFrame");
const assetPalette = document.querySelector("#assetPalette");
const instanceList = document.querySelector("#instanceList");
const renderGallery = document.querySelector("#renderGallery");
const renderStatus = document.querySelector("#renderStatus");
const motionStatus = document.querySelector("#motionStatus");
const manifestStatus = document.querySelector("#manifestStatus");
const layoutNameInput = document.querySelector("#layoutName");
const renderInputs = {
  width: document.querySelector("#renderWidth"),
  height: document.querySelector("#renderHeight"),
  samples: document.querySelector("#renderSamples"),
};
const lightingInputs = {
  preset: document.querySelector("#lightingPreset"),
  azimuth: document.querySelector("#sunAzimuth"),
  elevation: document.querySelector("#sunElevation"),
  sunColor: document.querySelector("#sunColor"),
  sunStrength: document.querySelector("#sunStrength"),
  sunAngle: document.querySelector("#sunAngle"),
  worldType: document.querySelector("#worldType"),
  worldStrength: document.querySelector("#worldStrength"),
  worldColor: document.querySelector("#worldColor"),
  exposure: document.querySelector("#exposure"),
};
const instanceFields = {
  positionX: document.querySelector("#instancePositionX"),
  positionY: document.querySelector("#instancePositionY"),
  positionZ: document.querySelector("#instancePositionZ"),
  rotationX: document.querySelector("#instanceRotationX"),
  rotationY: document.querySelector("#instanceRotationY"),
  rotationZ: document.querySelector("#instanceRotationZ"),
  uniformScale: document.querySelector("#instanceUniformScale"),
  scaleX: document.querySelector("#instanceScaleX"),
  scaleY: document.querySelector("#instanceScaleY"),
  scaleZ: document.querySelector("#instanceScaleZ"),
};
const cameraFields = {
  positionX: document.querySelector("#cameraPositionX"),
  positionY: document.querySelector("#cameraPositionY"),
  positionZ: document.querySelector("#cameraPositionZ"),
  targetX: document.querySelector("#cameraTargetX"),
  targetY: document.querySelector("#cameraTargetY"),
  targetZ: document.querySelector("#cameraTargetZ"),
  fov: document.querySelector("#cameraFov"),
};

let savedCamera = null;
let inspector = null;
let motionPlayer = null;
let manifestAssets = [];
const assetMap = new Map();
const editorScene = createEditorScene(
  viewport,
  renderInstances,
  () => inspector?.updateCamera(),
  (deltaSeconds) => motionPlayer?.update(deltaSeconds)
);
const proxyLoader = createProxyLoader({ onProxyStatus: updateAssetHealth });
const store = createInstanceStore({
  scene: editorScene.scene,
  transform: editorScene.transform,
  assetMap,
  effectMap: computeEffectMap,
  createProxyObject: proxyLoader.createProxyObject,
  createEffectObject: createEffectProxyObject,
  onChange: renderInstances,
});
inspector = createInspector({
  instanceFields,
  cameraFields,
  getSelected: store.selected,
  transform: editorScene.transform,
  camera: editorScene.camera,
  orbit: editorScene.orbit,
  onInstanceEdit: renderInstances,
  onCameraEdit: saveCamera,
});
createLightingControls({
  elements: lightingInputs,
  onChange: editorScene.applyLighting,
});
motionPlayer = createMotionPlayer({
  getInstances: () => store.instances,
  onStateChange: updateMotionControls,
});

createSelection({
  renderer: editorScene.renderer,
  camera: editorScene.camera,
  transform: editorScene.transform,
  getRoots: () => [...store.instances.values()],
  onPick: (id) => store.select(id),
  onHover: (id) => {
    editorScene.renderer.domElement.style.cursor = id ? "pointer" : "";
  },
});

wireControls();
await loadAssets();
await loadLiveLayout();
await refreshRenders();
editorScene.animate();

async function loadAssets() {
  try {
    const manifest = await loadManifest();
    manifestAssets = manifest.assets;
    manifest.assets.forEach((asset) => assetMap.set(asset.id, asset));
    renderAssetPalette(assetPalette, manifest.assets, COMPUTE_EFFECTS, store.add, store.addEffect);
    updateManifestStatus();
  } catch (error) {
    manifestStatus.textContent = error.message;
  }
}

function updateAssetHealth(assetId, patch) {
  const asset = assetMap.get(assetId);
  if (!asset) return;
  asset.health = { ...(asset.health || {}), ...patch };
  renderAssetPalette(assetPalette, manifestAssets, COMPUTE_EFFECTS, store.add, store.addEffect);
  renderInstances();
  updateManifestStatus();
}

function updateManifestStatus() {
  const total = manifestAssets.length;
  const renderable = manifestAssets.filter((asset) => asset.health?.renderable).length;
  const previewable = manifestAssets.filter((asset) => asset.health?.previewable).length;
  const badPreviews = manifestAssets.filter(
    (asset) => asset.health && !asset.health.previewable
  ).length;
  manifestStatus.textContent =
    badPreviews > 0
      ? `${renderable}/${total} renderable · ${previewable}/${total} previewable · ${badPreviews} proxy warnings`
      : `${renderable}/${total} renderable · ${previewable}/${total} previewable · ${COMPUTE_EFFECTS.length} effects`;
}

function wireControls() {
  document.querySelector("#modeTranslate").addEventListener("click", () => setMode("translate"));
  document.querySelector("#modeRotate").addEventListener("click", () => setMode("rotate"));
  document.querySelector("#modeScale").addEventListener("click", () => setMode("scale"));
  document.querySelector("#saveCamera").addEventListener("click", saveCamera);
  document.querySelector("#frameSelected").addEventListener("click", frameSelected);
  document.querySelector("#frameAll").addEventListener("click", frameAll);
  for (const input of Object.values(renderInputs)) input.addEventListener("input", updateSafeFrame);
  document.querySelector("#duplicateInstance").addEventListener("click", store.duplicateSelected);
  document.querySelector("#deleteInstance").addEventListener("click", store.deleteSelected);
  document.querySelector("#exportLayout").addEventListener("click", exportLayout);
  document.querySelector("#saveForBake").addEventListener("click", () => {
    saveForBake().catch((error) => setRenderStatus(error.message));
  });
  document.querySelector("#bakeLayout").addEventListener("click", bakeLayout);
  document.querySelector("#refreshRenders").addEventListener("click", refreshRenders);
  document.querySelector("#loadLayout").addEventListener("change", loadLayoutFromFile);
  document.querySelector("#motionClipFile").addEventListener("change", loadMotionClip);
  document.querySelector("#motionPlay").addEventListener("click", () => motionPlayer.toggle());
  document.querySelector("#motionReset").addEventListener("click", () => motionPlayer.reset());

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        store.duplicateSelected();
      }
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "g" || key === "w") setMode("translate");
    if (key === "r" || key === "e") setMode("rotate");
    if (key === "s") setMode("scale");
    if (event.key === "Escape") store.select(null);
    if (event.key === "Delete" || event.key === "Backspace") store.deleteSelected();
  });

  window.addEventListener("resize", updateSafeFrame);

  setMode("translate");
  updateSafeFrame();
}

function setMode(mode) {
  editorScene.transform.setMode(mode);
  setModeButtons(mode);
  document.querySelector("#hudMode").textContent = MODE_LABELS[mode] || mode;
}

async function loadMotionClip(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    motionPlayer.load(JSON.parse(await file.text()));
    motionStatus.textContent = `Loaded ${file.name}`;
  } catch (error) {
    motionStatus.textContent = error.message;
  } finally {
    event.target.value = "";
  }
}

function updateMotionControls(state) {
  const play = document.querySelector("#motionPlay");
  const reset = document.querySelector("#motionReset");
  play.disabled = !state.loaded;
  reset.disabled = !state.loaded;
  play.textContent = state.playing ? "Pause" : "Play";
  if (state.loaded) {
    motionStatus.textContent = `${state.time_s.toFixed(2)} / ${state.duration_s.toFixed(2)} s · ${state.frame_count} frames`;
  }
}

function renderInstances() {
  renderInstanceList(
    instanceList,
    store.instances,
    store.selected(),
    assetMap,
    computeEffectMap,
    store.select
  );
  const selected = store.selected();
  document.querySelector("#hudSelection").textContent = selected
    ? selected.userData.instanceId
    : "nothing selected";
  inspector?.updateInstance();
}

function saveCamera() {
  savedCamera = cameraSnapshot(editorScene.camera, editorScene.orbit);
  inspector?.updateCamera();
  const button = document.querySelector("#saveCamera");
  button.textContent = "Camera Saved";
  window.setTimeout(() => {
    button.textContent = "Save Camera";
  }, 1200);
}

function frameSelected() {
  const selected = store.selected();
  if (!selected) {
    flashButton("#frameSelected", "No Selection");
    return;
  }
  frameCamera([selected], "#frameSelected", "Framed");
}

function frameAll() {
  const objects = [...store.instances.values()];
  if (!objects.length) {
    flashButton("#frameAll", "No Instances");
    return;
  }
  frameCamera(objects, "#frameAll", "Framed");
}

function frameCamera(objects, selector, label) {
  const framed = frameObjectsWithCamera(objects, {
    camera: editorScene.camera,
    orbit: editorScene.orbit,
    renderAspect: renderAspectFromInputs(renderInputs),
  });
  if (!framed) return;
  saveCamera();
  flashButton(selector, label);
}

function exportLayout() {
  captureCurrentCamera();
  downloadLayout(readCurrentLayout());
}

async function saveForBake() {
  captureCurrentCamera();
  setRenderStatus("Sending layout...");
  const response = await fetch("/api/save-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readCurrentLayout()),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Save failed");
  setRenderStatus("Layout sent");
  flashButton("#saveForBake", "Sent");
  return result;
}

async function bakeLayout() {
  const button = document.querySelector("#bakeLayout");
  button.disabled = true;
  try {
    const saveResult = await saveForBake();
    button.textContent = "Baking...";
    setRenderStatus("Baking...");
    const response = await fetch("/api/render-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: saveResult.layout_relative }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Bake failed");
    renderRenderGallery(result.renders || []);
    setRenderStatus(result.new?.[0]?.name ? `Baked ${result.new[0].name}` : "Baked");
    button.textContent = "Baked";
  } catch (error) {
    setRenderStatus(error.message);
    button.textContent = "Bake failed";
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = "Bake";
    }, 1600);
  }
}

async function refreshRenders() {
  const response = await fetch("/api/renders", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Render list failed");
  renderRenderGallery(result.renders || []);
  setRenderStatus(result.renders?.length ? `${result.renders.length} renders` : "No renders yet");
}

async function loadLiveLayout() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (response.ok) await applyLayout(await response.json());
  } catch {}
}

function updateSafeFrame() {
  updateSafeFrameOverlay({ viewport, safeFrame, renderInputs });
}

function renderRenderGallery(renders) {
  renderGallery.replaceChildren();
  if (!renders.length) {
    const empty = document.createElement("p");
    empty.textContent = "No renders yet";
    empty.dataset.testid = "render-empty";
    renderGallery.appendChild(empty);
    return;
  }
  for (const render of renders.slice(0, 6)) {
    const link = document.createElement("a");
    link.className = "renderTile";
    link.href = render.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", `Open render ${render.name}`);
    link.dataset.testid = `render-tile:${render.name}`;
    link.innerHTML = `<img src="${render.url}?v=${render.mtime}" alt="${render.name}" loading="lazy" /><span>${render.name}</span>`;
    renderGallery.appendChild(link);
  }
}

function readCurrentLayout() {
  return currentLayout({
    nameInput: layoutNameInput,
    renderInputs,
    lighting: currentLighting(lightingInputs),
    instances: store.instances,
    camera: editorScene.camera,
    orbit: editorScene.orbit,
    savedCamera,
  });
}

function captureCurrentCamera() {
  savedCamera = cameraSnapshot(editorScene.camera, editorScene.orbit);
}

function flashButton(selector, text) {
  const button = document.querySelector(selector);
  const oldText = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = oldText;
  }, 1200);
}

function setRenderStatus(message) {
  renderStatus.textContent = message;
}

async function loadLayoutFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  await applyLayout(JSON.parse(await file.text()));
  event.target.value = "";
}

async function applyLayout(layout) {
  applyLayoutFields(layout, {
    nameInput: layoutNameInput,
    renderInputs,
    lightingControls: {
      apply(lighting) {
        applyLightingToControls(lightingInputs, lighting);
        editorScene.applyLighting(currentLighting(lightingInputs));
      },
    },
    camera: editorScene.camera,
    orbit: editorScene.orbit,
  });
  updateSafeFrame();
  savedCamera = layout.camera || null;
  await store.restore(layout);
  inspector.update();
}
