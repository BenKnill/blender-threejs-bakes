import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function createProxyLoader({ onProxyStatus } = {}) {
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
        (gltf) => {
          onProxyStatus?.(asset.id, {
            previewable: true,
            proxyStatus: "ready",
            proxyMessage: "Browser proxy ready",
          });
          resolve(prepareProxy(gltf.scene, asset));
        },
        undefined,
        () => {
          onProxyStatus?.(asset.id, {
            previewable: false,
            proxyStatus: "failed",
            proxyMessage: `Proxy load failed: assets/${asset.glb}`,
          });
          resolve(makePlaceholder(asset));
        }
      );
    });

    proxyCache.set(asset.id, loadPromise);
    return loadPromise;
  }

  return { createProxyObject };
}

export function createEffectProxyObject(effect) {
  const bbox = Array.isArray(effect.bbox) ? effect.bbox : [3.5, 0.75, 0.75];
  const geometry = new THREE.BoxGeometry(
    Math.max(0.05, bbox[0] || 1),
    Math.max(0.05, bbox[1] || 1),
    Math.max(0.05, bbox[2] || 1)
  );
  const material = new THREE.MeshStandardMaterial({
    color: 0xff7a2a,
    transparent: true,
    opacity: 0.32,
    roughness: 0.7,
    metalness: 0.0,
    emissive: 0x401000,
    emissiveIntensity: 0.8,
  });
  const box = new THREE.Mesh(geometry, material);
  box.name = `${effect.id} placeholder box`;

  const arrow = makeDirectionArrow(bbox[0]);
  const group = new THREE.Group();
  group.add(box, arrow);
  return group;
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

function makeDirectionArrow(length) {
  const group = new THREE.Group();
  const shaftLength = Math.max(0.2, length * 0.42);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffd27a,
    emissive: 0x7a2c00,
    emissiveIntensity: 0.7,
    roughness: 0.55,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, shaftLength, 16), material);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.x = -length * 0.22;

  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 24), material.clone());
  tip.rotation.z = Math.PI / 2;
  tip.position.x = -length * 0.46;

  group.add(shaft, tip);
  return group;
}
