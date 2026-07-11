import { frameObjectsWithCamera, renderAspectFromInputs } from "./framing.js";

export function createCameraActions({ store, editorScene, renderInputs, saveCamera, flashButton }) {
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

  return { frameSelected, frameAll };
}
