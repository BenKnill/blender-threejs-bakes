import * as THREE from "three";

const DEFAULT_VIEW_DIRECTION = new THREE.Vector3(5, 4, 6).normalize();
const MIN_DISTANCE = 0.1;
const FRAME_PADDING = 1.35;

const box = new THREE.Box3();
const center = new THREE.Vector3();
const size = new THREE.Vector3();
const direction = new THREE.Vector3();

export function frameObjectsWithCamera(objects, { camera, orbit, renderAspect }) {
  const bounds = boundsForObjects(objects);
  if (!bounds) return false;

  bounds.getCenter(center);
  bounds.getSize(size);

  const radius = Math.max(size.length() / 2, 0.001);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(renderAspect, 0.001));
  const fitFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max(MIN_DISTANCE, (radius / Math.tan(fitFov / 2)) * FRAME_PADDING);

  direction.subVectors(camera.position, orbit.target);
  if (direction.lengthSq() < 0.000001) direction.copy(DEFAULT_VIEW_DIRECTION);
  direction.normalize();

  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.updateProjectionMatrix();
  orbit.update();
  return true;
}

export function renderAspectFromInputs(renderInputs) {
  const width = Number.parseFloat(renderInputs.width.value);
  const height = Number.parseFloat(renderInputs.height.value);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 16 / 9;
  }
  return width / height;
}

export function updateSafeFrameOverlay({ viewport, safeFrame, renderInputs }) {
  const bounds = viewport.getBoundingClientRect();
  const aspect = renderAspectFromInputs(renderInputs);
  if (!safeFrame || bounds.width <= 0 || bounds.height <= 0 || !Number.isFinite(aspect)) return;

  let width = bounds.width;
  let height = width / aspect;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * aspect;
  }
  safeFrame.style.width = `${width}px`;
  safeFrame.style.height = `${height}px`;
}

function boundsForObjects(objects) {
  box.makeEmpty();
  for (const object of objects) {
    if (!object) continue;
    object.updateMatrixWorld(true);
    box.expandByObject(object);
  }
  return box.isEmpty() ? null : box;
}
