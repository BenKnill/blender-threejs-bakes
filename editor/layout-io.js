export function currentLayout({ nameInput, renderInputs, instances, camera, orbit, savedCamera }) {
  return {
    name: slug(nameInput.value || "composition"),
    schema: 1,
    space: "threejs_yup",
    instances: [...instances.values()].map(objectToInstance),
    camera: savedCamera || cameraSnapshot(camera, orbit),
    render: {
      width: intValue(renderInputs.width, 1920),
      height: intValue(renderInputs.height, 1080),
      samples: intValue(renderInputs.samples, 256),
    },
  };
}

export function objectToInstance(object) {
  return {
    instance_id: object.userData.instanceId,
    asset_id: object.userData.assetId,
    position: object.position.toArray(),
    quaternion: object.quaternion.toArray(),
    scale: object.scale.toArray(),
  };
}

export function cameraSnapshot(camera, orbit) {
  return {
    position: camera.position.toArray(),
    target: orbit.target.toArray(),
    fov_deg: camera.fov,
    up: [0, 1, 0],
  };
}

export function downloadLayout(layout) {
  const blob = new Blob([`${JSON.stringify(layout, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${layout.name}.layout.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function applyLayoutFields(layout, { nameInput, renderInputs, camera, orbit }) {
  nameInput.value = layout.name || "loaded_composition";
  renderInputs.width.value = layout.render?.width || 1920;
  renderInputs.height.value = layout.render?.height || 1080;
  renderInputs.samples.value = layout.render?.samples || 256;

  if (layout.camera) {
    camera.position.fromArray(layout.camera.position);
    orbit.target.fromArray(layout.camera.target);
    camera.fov = layout.camera.fov_deg || 45;
    camera.updateProjectionMatrix();
    orbit.update();
  }
}

function slug(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "composition"
  );
}

function intValue(input, fallback) {
  const parsed = Number.parseInt(input.value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
