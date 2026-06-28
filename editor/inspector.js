import * as THREE from "three";

const ROTATION_ORDER = "XYZ";

export function createInspector({
  instanceFields,
  cameraFields,
  getSelected,
  transform,
  camera,
  orbit,
  onInstanceEdit,
  onCameraEdit,
}) {
  const euler = new THREE.Euler(0, 0, 0, ROTATION_ORDER);

  for (const [key, input] of Object.entries(instanceFields)) {
    input.addEventListener("input", () => {
      writeInstanceValue(key, input.value);
      onInstanceEdit();
      updateInstance();
    });
  }

  for (const [key, input] of Object.entries(cameraFields)) {
    input.addEventListener("input", () => {
      writeCameraValue(key, input.value);
      onCameraEdit();
      updateCamera();
    });
  }

  function update() {
    updateInstance();
    updateCamera();
  }

  function updateInstance() {
    const selected = getSelected();
    const hasSelection = Boolean(selected);
    setDisabled(instanceFields, !hasSelection);
    if (!selected) {
      setValues(instanceFields, {});
      return;
    }

    euler.setFromQuaternion(selected.quaternion, ROTATION_ORDER);
    const scale = selected.scale;
    setValues(instanceFields, {
      positionX: selected.position.x,
      positionY: selected.position.y,
      positionZ: selected.position.z,
      rotationX: radiansToDegrees(euler.x),
      rotationY: radiansToDegrees(euler.y),
      rotationZ: radiansToDegrees(euler.z),
      uniformScale: averageScale(scale),
      scaleX: scale.x,
      scaleY: scale.y,
      scaleZ: scale.z,
    });
  }

  function updateCamera() {
    setValues(cameraFields, {
      positionX: camera.position.x,
      positionY: camera.position.y,
      positionZ: camera.position.z,
      targetX: orbit.target.x,
      targetY: orbit.target.y,
      targetZ: orbit.target.z,
      fov: camera.fov,
    });
  }

  function writeInstanceValue(key, rawValue) {
    const selected = getSelected();
    if (!selected) return;
    const value = numeric(rawValue);
    if (value === null) return;

    if (key.startsWith("position")) {
      selected.position[axisName(key)] = value;
    } else if (key.startsWith("rotation")) {
      euler.setFromQuaternion(selected.quaternion, ROTATION_ORDER);
      euler[axisName(key)] = degreesToRadians(value);
      selected.quaternion.setFromEuler(euler);
      selected.rotation.setFromQuaternion(selected.quaternion, ROTATION_ORDER);
    } else if (key === "uniformScale") {
      selected.scale.setScalar(Math.max(0.0005, value));
    } else if (key.startsWith("scale")) {
      selected.scale[axisName(key)] = Math.max(0.0005, value);
    }
    selected.updateMatrixWorld(true);
    if (transform?.object === selected) transform.updateMatrixWorld(true);
  }

  function writeCameraValue(key, rawValue) {
    const value = numeric(rawValue);
    if (value === null) return;

    if (key.startsWith("position")) {
      camera.position[axisName(key)] = value;
    } else if (key.startsWith("target")) {
      orbit.target[axisName(key)] = value;
    } else if (key === "fov") {
      camera.fov = Math.min(160, Math.max(1, value));
      camera.updateProjectionMatrix();
    }
    orbit.update();
  }

  update();
  return { update, updateInstance, updateCamera };
}

function setValues(fields, values) {
  for (const [key, input] of Object.entries(fields)) {
    const value = values[key];
    if (document.activeElement === input) continue;
    input.value = Number.isFinite(value) ? formatNumber(value) : "";
  }
}

function setDisabled(fields, disabled) {
  for (const input of Object.values(fields)) {
    input.disabled = disabled;
  }
}

function axisName(key) {
  return key.at(-1).toLowerCase();
}

function numeric(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function averageScale(scale) {
  return (scale.x + scale.y + scale.z) / 3;
}

function formatNumber(value) {
  const rounded = Math.abs(value) < 0.000001 ? 0 : value;
  return Number.parseFloat(rounded.toFixed(4)).toString();
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}
