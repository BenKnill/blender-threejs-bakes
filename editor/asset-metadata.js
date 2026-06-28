import { defaultDropScale } from "./default-scale.js";

const SIZE_THRESHOLDS = [
  [0.5, "tiny"],
  [2.5, "human"],
  [10, "building"],
];

const CATEGORY_KEYWORDS = [
  ["medieval", ["medieval", "shrine", "temple", "castle"]],
  ["space", ["space", "nasa", "sls", "spacex", "starship", "rocket", "asteroid"]],
  ["creature", ["alien", "octopus", "creature", "bone"]],
  ["nature", ["mushroom", "plant", "crystal", "lava", "tree", "rock"]],
  ["environment", ["cave", "ruins", "wall", "roof", "stairs", "fence"]],
  ["prop", ["prop", "crate", "wagon", "oiler", "statue", "chimney", "window", "door"]],
];

export function withAgentMetadata(asset) {
  const metadata = {
    category: explicitValue(asset, "category") || inferCategory(asset),
    size_class: explicitValue(asset, "size_class") || inferSizeClass(asset),
    starter_scale: defaultDropScale(asset),
    health_labels: explicitHealthLabels(asset) || inferHealthLabels(asset),
  };
  return {
    ...asset,
    ...metadata,
    agent_metadata: metadata,
  };
}

function explicitValue(asset, key) {
  const value = asset?.[key];
  if (typeof value === "string" && value) return value;
  const nested = asset?.metadata?.[key];
  return typeof nested === "string" && nested ? nested : null;
}

function explicitHealthLabels(asset) {
  const labels = Array.isArray(asset?.health_labels)
    ? asset.health_labels
    : Array.isArray(asset?.metadata?.health_labels)
      ? asset.metadata.health_labels
      : null;
  if (!labels) return null;
  return labels.filter((item) => typeof item === "string" && item);
}

function inferCategory(asset) {
  const text = manifestText(asset);
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return "prop";
}

function inferSizeClass(asset) {
  const maxAxis = maxBboxAxis(asset);
  for (const [threshold, label] of SIZE_THRESHOLDS) {
    if (maxAxis < threshold) return label;
  }
  return "environment";
}

function inferHealthLabels(asset) {
  const labels = [];
  const proxyMode = asset?.proxy?.mode;
  if (proxyMode === "lightweight") labels.push("lightweight proxy");
  else if (asset?.glb) labels.push("full proxy");
  else labels.push("bbox preview");

  if (!asset?.source_blend) labels.push("missing source");

  const fullSizeMb = numeric(asset?.proxy?.full_size_mb);
  const proxySizeMb = numeric(asset?.proxy?.size_mb);
  const triangles = numeric(asset?.proxy?.triangles_before);
  if ((fullSizeMb && fullSizeMb >= 50) || (proxySizeMb && proxySizeMb >= 25)) {
    labels.push("heavy source");
  } else if (triangles && triangles >= 500000) {
    labels.push("heavy source");
  }

  if (isFlatOrPortalPlane(asset)) labels.push("flat/portal plane");
  return labels;
}

function manifestText(asset) {
  return [asset?.id, asset?.name, asset?.collection, asset?.source_blend, asset?.source_asset]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function maxBboxAxis(asset) {
  if (!Array.isArray(asset?.bbox)) return 1;
  const values = asset.bbox.map((value) => Math.abs(Number(value) || 0));
  return values.length ? Math.max(...values) : 1;
}

function isFlatOrPortalPlane(asset) {
  const text = manifestText(asset);
  if (text.includes("portal") || text.includes("plane")) return true;
  if (!Array.isArray(asset?.bbox) || asset.bbox.length < 3) return false;
  const values = asset.bbox.map((value) => Math.abs(Number(value) || 0));
  const maxAxis = Math.max(...values);
  const minAxis = Math.min(...values);
  return maxAxis > 0 && minAxis / maxAxis < 0.03;
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
