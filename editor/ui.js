export function renderAssetPalette(assetPalette, assets, effects, onAddAsset, onAddEffect) {
  assetPalette.replaceChildren();
  for (const asset of assets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `assetButton ${assetHealthClass(asset)}`;
    button.setAttribute("aria-label", `Add asset ${asset.name || asset.id}`);
    button.dataset.testid = `asset-row:${asset.id}`;
    button.dataset.assetId = asset.id;
    button.dataset.assetCategory = asset.category || "prop";
    button.dataset.assetSizeClass = asset.size_class || "human";
    button.dataset.assetStarterScale = String(asset.starter_scale ?? "");
    button.dataset.assetProxyStatus = asset.health?.proxyStatus || "unknown";
    button.dataset.assetHealthLabels = assetHealthLabels(asset).join(",");
    const proxyLabel = assetProxyLabel(asset);
    const metadataLabel = assetMetadataLabel(asset);
    button.title = [metadataLabel, asset.health?.proxyMessage || proxyLabel]
      .filter(Boolean)
      .join(" · ");
    button.innerHTML = `<strong>${escapeHtml(asset.name || asset.id)}</strong><span>${escapeHtml(
      metadataLabel
    )}</span><span class="assetMetaDetail">${escapeHtml(proxyLabel)}</span>`;
    button.addEventListener("click", () => onAddAsset(asset.id));
    assetPalette.appendChild(button);
  }
  for (const effect of effects) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "assetButton effectButton";
    button.setAttribute("aria-label", `Add compute effect ${effect.name || effect.id}`);
    button.dataset.testid = `effect-row:${effect.id}`;
    button.innerHTML = `<strong>${escapeHtml(effect.name || effect.id)}</strong><span>${escapeHtml(
      effect.description || "compute effect placeholder"
    )}</span><span class="assetMetaDetail">${escapeHtml(effect.id)} · z-aware bake effect</span>`;
    button.addEventListener("click", () => onAddEffect(effect.id));
    assetPalette.appendChild(button);
  }
}

export function renderInstanceList(
  instanceList,
  instances,
  selected,
  assetMap,
  effectMap,
  onSelect
) {
  instanceList.replaceChildren();
  for (const [id, object] of instances) {
    const isEffect = object.userData.kind === "effect";
    const item = isEffect
      ? effectMap.get(object.userData.effectId)
      : assetMap.get(object.userData.assetId);
    const pos = object.position;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `instanceButton${object === selected ? " selected" : ""}`;
    button.setAttribute("aria-label", `Select instance ${id}`);
    button.setAttribute("aria-current", object === selected ? "true" : "false");
    button.dataset.testid = `instance-row:${id}`;
    const previewStatus = isEffect
      ? "effect placeholder"
      : item
        ? assetPreviewText(item)
        : "unknown asset";
    button.innerHTML = `<strong>${escapeHtml(id)}</strong><span>${escapeHtml(
      item?.name || object.userData.effectId || object.userData.assetId
    )} · ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)} · ${previewStatus}</span>`;
    button.addEventListener("click", () => onSelect(id));
    instanceList.appendChild(button);
  }
}

export function setModeButtons(mode) {
  setModeButton("#modeTranslate", mode === "translate");
  setModeButton("#modeRotate", mode === "rotate");
  setModeButton("#modeScale", mode === "scale");
}

function setModeButton(selector, active) {
  const button = document.querySelector(selector);
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
}

function assetHealthClass(asset) {
  if (asset.health?.previewable) return "previewReady";
  return "previewWarning";
}

function assetProxyLabel(asset) {
  return `${asset.id} · ${assetRenderableText(asset)} · ${assetPreviewText(asset)}`;
}

function assetMetadataLabel(asset) {
  return [asset.category || "prop", asset.size_class || "human", ...assetHealthLabels(asset)].join(
    " · "
  );
}

function assetHealthLabels(asset) {
  const labels = Array.isArray(asset.health_labels) ? [...asset.health_labels] : [];
  const previewText = assetPreviewText(asset);
  if (previewText && !labels.includes(previewText)) labels.push(previewText);
  return labels;
}

function assetRenderableText(asset) {
  return asset.health?.renderable ? "renderable" : "not renderable";
}

function assetPreviewText(asset) {
  const status = asset.health?.proxyStatus;
  if (status === "ready") return "preview ready";
  if (status === "missing") return "proxy missing";
  if (status === "failed") return "proxy load failed";
  if (status === "bbox") return "bbox preview";
  return asset.glb ? "preview unknown" : "bbox preview";
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]
  );
}
