import { objectToInstance } from "./layout-io.js";

export function createInstanceStore({ scene, transform, assetMap, createProxyObject, onChange }) {
  const instances = new Map();
  let selected = null;
  let instanceCounter = 1;

  async function add(assetId, transformData = null, preferredId = null) {
    const asset = assetMap.get(assetId);
    if (!asset) return null;

    const object = await createProxyObject(asset);
    const id = preferredId || nextInstanceId(asset.id);
    object.name = id;
    object.userData = { instanceId: id, assetId: asset.id };

    if (transformData) {
      object.position.fromArray(transformData.position);
      object.quaternion.fromArray(transformData.quaternion);
      object.scale.fromArray(transformData.scale);
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
    add(selected.userData.assetId, data);
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
      await add(item.asset_id, item, item.instance_id);
    }
    onChange();
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
    select,
    duplicateSelected,
    deleteSelected,
    restore,
    selected: () => selected,
  };
}

function defaultDropScale(asset) {
  const bbox = Array.isArray(asset.bbox) ? asset.bbox : [1, 1, 1];
  const maxAxis = Math.max(...bbox.map((value) => Math.abs(value || 0)));
  if (maxAxis <= 0) return 1;
  return Math.min(30, Math.max(1, 1.5 / maxAxis));
}
