export async function loadManifest() {
  const response = await fetch("../assets/manifest.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Manifest request failed: ${response.status}`);
  }
  const manifest = await response.json();
  if (!Array.isArray(manifest.assets)) {
    throw new Error("Manifest must contain an assets array");
  }
  return manifest;
}
