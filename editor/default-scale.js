const LARGE_ASSET_AXIS = 30;
const LARGE_ASSET_TARGET_AXIS = 6.5;
const MAX_DEFAULT_SCALE = 30;

export function defaultDropScale(asset) {
  const manifestScale = Number(asset?.default_scale);
  if (Number.isFinite(manifestScale) && manifestScale > 0) {
    return manifestScale;
  }

  const bbox = Array.isArray(asset?.bbox) ? asset.bbox : [1, 1, 1];
  const maxAxis = Math.max(...bbox.map((value) => Math.abs(Number(value) || 0)));
  if (maxAxis <= 0) return 1;

  if (maxAxis > LARGE_ASSET_AXIS) {
    return Math.min(MAX_DEFAULT_SCALE, LARGE_ASSET_TARGET_AXIS / maxAxis);
  }

  return Math.min(MAX_DEFAULT_SCALE, Math.max(1, 1.5 / maxAxis));
}
