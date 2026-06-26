import * as THREE from "three";

// Click-to-select in the viewport. Casts a ray at the instance roots and reports
// the hit instance id (or null for empty space). Distinguishes a real click from an
// orbit-drag (pointer moved) and from grabbing the transform gizmo.
export function createSelection({ renderer, camera, transform, getRoots, onPick, onHover }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const canvas = renderer.domElement;

  let gizmoActive = false;
  transform.addEventListener("dragging-changed", (event) => {
    gizmoActive = event.value;
  });

  let downX = 0;
  let downY = 0;
  let downTime = 0;

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    downX = event.clientX;
    downY = event.clientY;
    downTime = performance.now();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || gizmoActive || transform.axis) return;
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    if (moved > 5 || performance.now() - downTime > 400) return; // orbit-drag, not a click
    onPick(pickId(event));
  });

  if (onHover) {
    canvas.addEventListener("pointermove", (event) => {
      if (event.buttons !== 0 || gizmoActive) return; // skip while orbiting / dragging
      onHover(pickId(event));
    });
  }

  function pickId(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(getRoots(), true)) {
      const id = instanceIdOf(hit.object);
      if (id) return id;
    }
    return null;
  }
}

// Walk up from a hit mesh to the instance root that carries the id.
function instanceIdOf(object) {
  let node = object;
  while (node) {
    if (node.userData?.instanceId) return node.userData.instanceId;
    node = node.parent;
  }
  return null;
}
