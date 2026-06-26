import { createEditorScene } from "./scene.js";
import { createInstanceStore } from "./instances.js";
import { applyLayoutFields, cameraSnapshot, currentLayout, downloadLayout } from "./layout-io.js";
import { loadManifest } from "./manifest-loader.js";
import { createProxyLoader } from "./proxies.js";
import { createSelection } from "./selection.js";
import { renderAssetPalette, renderInstanceList, setModeButtons } from "./ui.js";

const MODE_LABELS = { translate: "Move", rotate: "Rotate", scale: "Scale" };

const viewport = document.querySelector("#viewport");
const assetPalette = document.querySelector("#assetPalette");
const instanceList = document.querySelector("#instanceList");
const renderGallery = document.querySelector("#renderGallery");
const manifestStatus = document.querySelector("#manifestStatus");
const layoutNameInput = document.querySelector("#layoutName");
const renderInputs = {
  width: document.querySelector("#renderWidth"),
  height: document.querySelector("#renderHeight"),
  samples: document.querySelector("#renderSamples"),
};

let savedCamera = null;
const assetMap = new Map();
const editorScene = createEditorScene(viewport, renderInstances);
const proxyLoader = createProxyLoader();
const store = createInstanceStore({
  scene: editorScene.scene,
  transform: editorScene.transform,
  assetMap,
  createProxyObject: proxyLoader.createProxyObject,
  onChange: renderInstances,
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
await refreshRenders();
editorScene.animate();

async function loadAssets() {
  try {
    const manifest = await loadManifest();
    manifest.assets.forEach((asset) => assetMap.set(asset.id, asset));
    renderAssetPalette(assetPalette, manifest.assets, store.add);
    manifestStatus.textContent = `${manifest.assets.length} assets ready`;
  } catch (error) {
    manifestStatus.textContent = error.message;
  }
}

function wireControls() {
  document.querySelector("#modeTranslate").addEventListener("click", () => setMode("translate"));
  document.querySelector("#modeRotate").addEventListener("click", () => setMode("rotate"));
  document.querySelector("#modeScale").addEventListener("click", () => setMode("scale"));
  document.querySelector("#saveCamera").addEventListener("click", saveCamera);
  document.querySelector("#duplicateInstance").addEventListener("click", store.duplicateSelected);
  document.querySelector("#deleteInstance").addEventListener("click", store.deleteSelected);
  document.querySelector("#exportLayout").addEventListener("click", exportLayout);
  document.querySelector("#saveForBake").addEventListener("click", saveForBake);
  document.querySelector("#bakeLayout").addEventListener("click", bakeLayout);
  document.querySelector("#refreshRenders").addEventListener("click", refreshRenders);
  document.querySelector("#loadLayout").addEventListener("change", loadLayoutFromFile);

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

  setMode("translate");
}

function setMode(mode) {
  editorScene.transform.setMode(mode);
  setModeButtons(mode);
  document.querySelector("#hudMode").textContent = MODE_LABELS[mode] || mode;
}

function renderInstances() {
  renderInstanceList(instanceList, store.instances, store.selected(), assetMap, store.select);
  const selected = store.selected();
  document.querySelector("#hudSelection").textContent = selected
    ? selected.userData.instanceId
    : "nothing selected";
}

function saveCamera() {
  savedCamera = cameraSnapshot(editorScene.camera, editorScene.orbit);
  const button = document.querySelector("#saveCamera");
  button.textContent = "Camera Saved";
  window.setTimeout(() => {
    button.textContent = "Save Camera";
  }, 1200);
}

function exportLayout() {
  captureCurrentCamera();
  downloadLayout(readCurrentLayout());
}

async function saveForBake() {
  captureCurrentCamera();
  const response = await fetch("/api/save-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readCurrentLayout()),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Save failed");
  flashButton("#saveForBake", "Sent");
  return result;
}

async function bakeLayout() {
  const saveResult = await saveForBake();
  const button = document.querySelector("#bakeLayout");
  button.disabled = true;
  button.textContent = "Baking...";
  try {
    const response = await fetch("/api/render-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: saveResult.layout_relative }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Bake failed");
    renderRenderGallery(result.renders || []);
    button.textContent = "Baked";
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
}

function renderRenderGallery(renders) {
  renderGallery.replaceChildren();
  if (!renders.length) {
    const empty = document.createElement("p");
    empty.textContent = "No renders yet";
    renderGallery.appendChild(empty);
    return;
  }
  for (const render of renders.slice(0, 6)) {
    const link = document.createElement("a");
    link.className = "renderTile";
    link.href = render.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<img src="${render.url}?v=${render.mtime}" alt="${render.name}" loading="lazy" /><span>${render.name}</span>`;
    renderGallery.appendChild(link);
  }
}

function readCurrentLayout() {
  return currentLayout({
    nameInput: layoutNameInput,
    renderInputs,
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

async function loadLayoutFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const layout = JSON.parse(await file.text());
  applyLayoutFields(layout, {
    nameInput: layoutNameInput,
    renderInputs,
    camera: editorScene.camera,
    orbit: editorScene.orbit,
  });
  savedCamera = layout.camera || null;
  await store.restore(layout);
  event.target.value = "";
}
