export async function loadManifest() {
  const response = await fetch("../assets/manifest.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifest request failed: ${response.status}`);
  }
  const manifest = await response.json();
  if (!Array.isArray(manifest.assets)) {
    throw new Error("Manifest must contain an assets array");
  }
  manifest.assets = await Promise.all(manifest.assets.map(withAssetHealth));
  return manifest;
}

async function withAssetHealth(asset) {
  const renderable = Boolean(asset.source_blend);
  if (!asset.glb) {
    return {
      ...asset,
      health: {
        renderable,
        previewable: false,
        proxyStatus: "bbox",
        proxyMessage: "No browser proxy; using bbox fallback",
      },
    };
  }

  try {
    const response = await fetch(`../assets/${asset.glb}`, { method: "HEAD", cache: "no-store" });
    if (response.ok) {
      return {
        ...asset,
        health: {
          renderable,
          previewable: true,
          proxyStatus: "ready",
          proxyMessage: "Browser proxy ready",
        },
      };
    }
    return {
      ...asset,
      health: {
        renderable,
        previewable: false,
        proxyStatus: "missing",
        proxyMessage: `Proxy missing: assets/${asset.glb}`,
      },
    };
  } catch (error) {
    return {
      ...asset,
      health: {
        renderable,
        previewable: false,
        proxyStatus: "failed",
        proxyMessage: error.message,
      },
    };
  }
}
