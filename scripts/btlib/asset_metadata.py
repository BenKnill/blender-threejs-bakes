"""Agent-facing asset metadata derived from manifest entries."""

from __future__ import annotations

from typing import Any

from btlib.default_scale import default_drop_scale

SIZE_THRESHOLDS = (
    (0.5, "tiny"),
    (2.5, "human"),
    (10.0, "building"),
)

CATEGORY_KEYWORDS = (
    ("medieval", ("medieval", "shrine", "temple", "castle")),
    ("space", ("space", "nasa", "sls", "spacex", "starship", "rocket", "asteroid")),
    ("creature", ("alien", "octopus", "creature", "bone")),
    ("nature", ("mushroom", "plant", "crystal", "lava", "tree", "rock")),
    ("environment", ("cave", "ruins", "wall", "roof", "stairs", "fence")),
    ("prop", ("prop", "crate", "wagon", "oiler", "statue", "chimney", "window", "door")),
)


def agent_asset_metadata(asset: dict[str, Any]) -> dict[str, Any]:
    """Return stable metadata for editor rows and agent CLI consumers."""

    starter_scale = default_drop_scale(asset)
    return {
        "category": explicit_value(asset, "category") or infer_category(asset),
        "size_class": explicit_value(asset, "size_class") or infer_size_class(asset),
        "starter_scale": starter_scale,
        "health_labels": explicit_health_labels(asset) or infer_health_labels(asset),
    }


def explicit_value(asset: dict[str, Any], key: str) -> str | None:
    value = asset.get(key)
    if isinstance(value, str) and value:
        return value
    metadata = asset.get("metadata")
    if isinstance(metadata, dict):
        nested = metadata.get(key)
        if isinstance(nested, str) and nested:
            return nested
    return None


def explicit_health_labels(asset: dict[str, Any]) -> list[str]:
    labels = asset.get("health_labels")
    if labels is None and isinstance(asset.get("metadata"), dict):
        labels = asset["metadata"].get("health_labels")
    if not isinstance(labels, list):
        return []
    return [item for item in labels if isinstance(item, str) and item]


def infer_category(asset: dict[str, Any]) -> str:
    text = manifest_text(asset)
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in text for keyword in keywords):
            return category
    return "prop"


def infer_size_class(asset: dict[str, Any]) -> str:
    max_axis = max_bbox_axis(asset)
    for threshold, label in SIZE_THRESHOLDS:
        if max_axis < threshold:
            return label
    return "environment"


def infer_health_labels(asset: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    proxy = asset.get("proxy") if isinstance(asset.get("proxy"), dict) else {}
    proxy_mode = proxy.get("mode")
    if proxy_mode == "lightweight":
        labels.append("lightweight proxy")
    elif asset.get("glb"):
        labels.append("full proxy")
    else:
        labels.append("bbox preview")

    if not asset.get("source_blend"):
        labels.append("missing source")

    full_size_mb = numeric(proxy.get("full_size_mb"))
    proxy_size_mb = numeric(proxy.get("size_mb"))
    triangles = numeric(proxy.get("triangles_before"))
    if (
        (full_size_mb and full_size_mb >= 50)
        or (proxy_size_mb and proxy_size_mb >= 25)
        or (triangles and triangles >= 500_000)
    ):
        labels.append("heavy source")

    if is_flat_or_portal_plane(asset):
        labels.append("flat/portal plane")

    return labels


def manifest_text(asset: dict[str, Any]) -> str:
    parts = [
        asset.get("id"),
        asset.get("name"),
        asset.get("collection"),
        asset.get("source_blend"),
        asset.get("source_asset"),
    ]
    return " ".join(str(part).lower() for part in parts if part)


def max_bbox_axis(asset: dict[str, Any]) -> float:
    bbox = asset.get("bbox")
    if not isinstance(bbox, list):
        return 1.0
    values = [abs(numeric(value) or 0.0) for value in bbox]
    return max(values) if values else 1.0


def is_flat_or_portal_plane(asset: dict[str, Any]) -> bool:
    text = manifest_text(asset)
    if "portal" in text or "plane" in text:
        return True
    bbox = asset.get("bbox")
    if not isinstance(bbox, list) or len(bbox) < 3:
        return False
    values = [abs(numeric(value) or 0.0) for value in bbox]
    max_axis = max(values)
    min_axis = min(values)
    return max_axis > 0 and min_axis / max_axis < 0.03


def numeric(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    return None
