import { objectToInstance } from "./layout-io.js";
import { defaultDropScale } from "./default-scale.js";

export function createInstanceStore({
  scene,
  transform,
  assetMap,
  effectMap,
  createProxyObject,
  createEffectObject,
  onChange,
}) {
  const instances = new Map();
  let selected = null;
  let instanceCounter = 1;

  async function add(assetId, transformData = null, preferredId = null) {
    const asset = assetMap.get(assetId);
    if (!asset) return null;

    const object = await createProxyObject(asset);
    const id = preferredId || nextInstanceId(asset.id);
    object.name = id;
    object.userData = { instanceId: id, assetId: asset.id, kind: "asset" };

    if (transformData) {
      applyInitialTransform(object, transformData);
    } else {
      const scale = defaultDropScale(asset);
      object.scale.setScalar(scale);
    }

    instances.set(id, object);
    scene.add(object);
    select(id);
    onChange();
    return object;
  }

  async function addEffect(effectId, transformData = null, preferredId = null) {
    const effect = effectMap.get(effectId);
    if (!effect) return null;

    const object = await createEffectObject(effect);
    const id = preferredId || nextInstanceId(effect.id);
    object.name = id;
    object.userData = { instanceId: id, effectId: effect.id, kind: "effect" };

    applyInitialTransform(object, transformData, effect.defaultScale || [1, 1, 1]);

    instances.set(id, object);
    scene.add(object);
    select(id);
    onChange();
    return object;
  }

  function select(id) {
    selected = instances.get(id) || null;
    transform.detach();
    if (selected) transform.attach(selected);
    onChange();
  }

  function duplicateSelected() {
    if (!selected) return;
    const data = objectToInstance(selected);
    data.position[0] += 0.75;
    data.position[2] += 0.75;
    if (selected.userData.kind === "effect") {
      addEffect(selected.userData.effectId, data);
    } else {
      add(selected.userData.assetId, data);
    }
  }

  function deleteSelected() {
    if (!selected) return;
    const id = selected.userData.instanceId;
    scene.remove(selected);
    transform.detach();
    instances.delete(id);
    selected = null;
    onChange();
  }

  async function restore(layout) {
    for (const object of instances.values()) scene.remove(object);
    instances.clear();
    transform.detach();
    selected = null;

    for (const item of layout.instances || []) {
      if (item.effect_id) {
        await addEffect(item.effect_id, item, item.instance_id);
      } else {
        await add(item.asset_id, item, item.instance_id);
      }
    }
    onChange();
  }

  function applyInitialTransform(object, transformData, defaultScale = null) {
    if (transformData) {
      object.position.fromArray(transformData.position);
      object.quaternion.fromArray(transformData.quaternion);
      object.scale.fromArray(transformData.scale);
    } else if (defaultScale) {
      object.scale.fromArray(defaultScale);
    }
  }

  function nextInstanceId(assetId) {
    let id = "";
    do {
      id = `${assetId}_${String(instanceCounter).padStart(3, "0")}`;
      instanceCounter += 1;
    } while (instances.has(id));
    return id;
  }

  return {
    instances,
    add,
    addEffect,
    select,
    duplicateSelected,
    deleteSelected,
    restore,
    selected: () => selected,
  };
}
