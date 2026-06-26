// Replaces TransformControls' uniform-scale (center "XYZ" handle) behavior with a stable
// "drag up = bigger, drag down = smaller" exponential mapping.
//
// Why: stock TransformControls computes uniform scale as the RADIAL distance ratio of the
// pointer from the gizmo center (pointEnd.length() / pointStart.length()) and NEGATES it
// once the pointer passes 90° from the grab direction (pointEnd.dot(pointStart) < 0). That
// makes sideways motion change the scale and makes the object mirror/vanish in a "forbidden
// zone" — see TransformControls.js scale branch. We only override the 'XYZ' axis; per-axis
// (X/Y/Z) handles and translate/rotate keep the stock behavior.
//
// Coupling note: this composes with the vendored TransformControls at runtime (instance
// method override + the 'XYZ' axis name). If the vendored copy is upgraded, re-check that
// `pointerMove(pointer)` still receives NDC pointer coords and that the center axis is 'XYZ'.
export function installUniformScale(transform, { sensitivity = 2.5, floorRatio = 0.05 } = {}) {
  const originalPointerMove = transform.pointerMove.bind(transform);
  let startY = null;
  let startScale = null;

  transform.addEventListener("dragging-changed", (event) => {
    if (event.value && transform.mode === "scale" && transform.axis === "XYZ" && transform.object) {
      startY = null; // captured on the first move so factor starts at exactly 1
      startScale = transform.object.scale.clone();
    } else {
      startY = null;
      startScale = null;
    }
  });

  transform.pointerMove = function (pointer) {
    const drivingUniform =
      this.dragging &&
      this.mode === "scale" &&
      this.axis === "XYZ" &&
      this.object &&
      startScale &&
      pointer;
    if (!drivingUniform) return originalPointerMove(pointer);

    if (startY === null) startY = pointer.y; // NDC y: +1 top, -1 bottom
    const raw = Math.exp((pointer.y - startY) * sensitivity);
    const factor = Math.min(Math.max(raw, floorRatio), 50);
    this.object.scale.set(startScale.x * factor, startScale.y * factor, startScale.z * factor);
    this.dispatchEvent({ type: "objectChange" });
  };
}
