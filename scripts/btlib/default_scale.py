"""Default placement scale shared by CLI inspection and authoring."""

from __future__ import annotations

from typing import Any

LARGE_ASSET_AXIS = 30.0
LARGE_ASSET_TARGET_AXIS = 6.5
MAX_DEFAULT_SCALE = 30.0


def default_drop_scale(asset: dict[str, Any]) -> float:
    manifest_scale = asset.get("default_scale")
    if (
        isinstance(manifest_scale, int | float)
        and not isinstance(manifest_scale, bool)
        and manifest_scale > 0
    ):
        return float(manifest_scale)

    bbox = asset.get("bbox") if isinstance(asset.get("bbox"), list) else [1, 1, 1]
    max_axis = max(abs(float(value or 0)) for value in bbox)
    if max_axis <= 0:
        return 1.0

    if max_axis > LARGE_ASSET_AXIS:
        return min(MAX_DEFAULT_SCALE, LARGE_ASSET_TARGET_AXIS / max_axis)

    return min(MAX_DEFAULT_SCALE, max(1.0, 1.5 / max_axis))
