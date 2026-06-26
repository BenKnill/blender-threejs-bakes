import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { installUniformScale } from "./uniform-scale.js";

export function createEditorScene(viewport, onTransformChange) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171a18);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 1000);
  camera.position.set(5, 4, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.appendChild(renderer.domElement);

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 0.8, 0);
  orbit.enableDamping = true;

  const transform = new TransformControls(camera, renderer.domElement);
  transform.setMode("translate");
  // Bigger gizmo so the center (uniform) scale box and the per-axis scale boxes aren't
  // crowded together at the origin — makes it easy to grab the handle you actually mean.
  transform.setSize(1.35);

  // Floor scale at a fraction of where it was when the handle was grabbed, so dragging
  // a scale handle inward stops cleanly *before* the near-zero zone where TransformControls
  // gets numerically unstable (the "few stops then infinitesimally small" jitter) and where
  // crossing zero would mirror-flip the object. Relative (not absolute) so it behaves the
  // same for assets with very different base scales (e.g. the medieval wagon).
  const SCALE_FLOOR_RATIO = 0.05;
  const SCALE_FLOOR_EPS = 0.0005;
  let scaleFloor = null;

  transform.addEventListener("dragging-changed", (event) => {
    orbit.enabled = !event.value;
    if (event.value && transform.object) {
      const s = transform.object.scale;
      scaleFloor = {
        x: Math.max(s.x * SCALE_FLOOR_RATIO, SCALE_FLOOR_EPS),
        y: Math.max(s.y * SCALE_FLOOR_RATIO, SCALE_FLOOR_EPS),
        z: Math.max(s.z * SCALE_FLOOR_RATIO, SCALE_FLOOR_EPS),
      };
    } else {
      scaleFloor = null;
    }
  });

  transform.addEventListener("objectChange", () => {
    const target = transform.object;
    if (target && scaleFloor) {
      target.scale.set(
        Math.max(target.scale.x, scaleFloor.x),
        Math.max(target.scale.y, scaleFloor.y),
        Math.max(target.scale.z, scaleFloor.z)
      );
    }
    onTransformChange();
  });

  // Make the center (uniform) scale handle respond to vertical drag instead of stock
  // radial-distance-with-90°-flip, so sideways motion no longer collapses the object.
  installUniformScale(transform, { floorRatio: SCALE_FLOOR_RATIO });

  scene.add(transform);

  setupSceneGuides(scene);

  function resize() {
    const bounds = viewport.getBoundingClientRect();
    camera.aspect = Math.max(1, bounds.width) / Math.max(1, bounds.height);
    camera.updateProjectionMatrix();
    renderer.setSize(bounds.width, bounds.height, false);
  }

  function animate() {
    orbit.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize);

  return { scene, camera, renderer, orbit, transform, resize, animate };
}

function setupSceneGuides(scene) {
  const hemi = new THREE.HemisphereLight(0xf4efe0, 0x2d332e, 1.8);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1c4, 1.5);
  key.position.set(3, 6, 2);
  scene.add(key);

  const grid = new THREE.GridHelper(20, 20, 0x596054, 0x30372f);
  grid.position.y = -0.02;
  scene.add(grid);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x242923, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.5;
  ground.receiveShadow = true;
  scene.add(ground);
}
