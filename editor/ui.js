export function renderAssetPalette(assetPalette, assets, onAdd) {
  assetPalette.replaceChildren();
  for (const asset of assets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "assetButton";
    const proxyLabel = asset.glb ? asset.id : `${asset.id} · bbox proxy`;
    button.innerHTML = `<strong>${escapeHtml(asset.name || asset.id)}</strong><span>${escapeHtml(
      proxyLabel
    )}</span>`;
    button.addEventListener("click", () => onAdd(asset.id));
    assetPalette.appendChild(button);
  }
}

export function renderInstanceList(instanceList, instances, selected, assetMap, onSelect) {
  instanceList.replaceChildren();
  for (const [id, object] of instances) {
    const asset = assetMap.get(object.userData.assetId);
    const pos = object.position;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `instanceButton${object === selected ? " selected" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(id)}</strong><span>${escapeHtml(
      asset?.name || object.userData.assetId
    )} · ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}</span>`;
    button.addEventListener("click", () => onSelect(id));
    instanceList.appendChild(button);
  }
}

export function setModeButtons(mode) {
  document.querySelector("#modeTranslate").classList.toggle("active", mode === "translate");
  document.querySelector("#modeRotate").classList.toggle("active", mode === "rotate");
  document.querySelector("#modeScale").classList.toggle("active", mode === "scale");
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
