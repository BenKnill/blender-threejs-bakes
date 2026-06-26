import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function createProxyLoader() {
  const gltfLoader = new GLTFLoader();
  const proxyCache = new Map();

  async function createProxyObject(asset) {
    const cached = await loadProxy(asset);
    const object = cached.clone(true);
    object.traverse((child) => {
      if (child.isMesh) child.material = child.material.clone();
    });
    return object;
  }

  async function loadProxy(asset) {
    if (proxyCache.has(asset.id)) return proxyCache.get(asset.id);

    if (!asset.source_blend || !asset.glb) {
      const placeholder = Promise.resolve(makePlaceholder(asset));
      proxyCache.set(asset.id, placeholder);
      return placeholder;
    }

    const loadPromise = new Promise((resolve) => {
      gltfLoader.load(
        `../assets/${asset.glb}`,
        (gltf) => resolve(prepareProxy(gltf.scene, asset)),
        undefined,
        () => resolve(makePlaceholder(asset))
      );
    });

    proxyCache.set(asset.id, loadPromise);
    return loadPromise;
  }

  return { createProxyObject };
}

function prepareProxy(root, asset) {
  const group = new THREE.Group();
  group.add(root);
  tintProxy(group, asset.id);
  return group;
}

function makePlaceholder(asset) {
  const bbox = threeBbox(asset);
  const geometry = new THREE.BoxGeometry(
    Math.max(0.05, bbox[0] || 1),
    Math.max(0.05, bbox[1] || 1),
    Math.max(0.05, bbox[2] || 1)
  );
  const material = new THREE.MeshStandardMaterial({
    color: colorFromId(asset.id),
    roughness: 0.85,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = geometry.parameters.height / 2;

  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

function threeBbox(asset) {
  const bbox = Array.isArray(asset.bbox) ? asset.bbox : [1, 1, 1];
  return asset.up_axis === "Z" ? [bbox[0], bbox[2], bbox[1]] : bbox;
}

function tintProxy(group, id) {
  const color = colorFromId(id);
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.color?.lerp(color, 0.2);
      child.material.roughness = Math.max(child.material.roughness ?? 0.6, 0.65);
    }
  });
}

function colorFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = (hash % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.38, 0.58);
}
