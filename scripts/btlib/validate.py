"""Shared contract validation for layouts and manifests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = ROOT / "schemas"


class ContractError(ValueError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


def load_schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def validate_layout(layout: dict[str, Any]) -> None:
    load_schema("layout")
    errors: list[str] = []
    require_object(layout, "", errors)
    schema = layout.get("schema")
    if schema not in (1, 2):
        errors.append("/schema: expected 1 or 2")
    require_string(layout, "/name", "name", errors)
    require_const(layout, "/space", "space", "threejs_yup", errors)
    require_array(layout, "/instances", "instances", errors)
    require_object_member(layout, "/camera", "camera", errors)
    if "render" in layout:
        validate_render(layout["render"], "/render", errors)
    if schema == 2:
        require_object_member(layout, "/lighting", "lighting", errors)
    if "lighting" in layout:
        validate_lighting(layout["lighting"], "/lighting", errors)

    for index, instance in enumerate(layout.get("instances", [])):
        validate_instance(instance, f"/instances/{index}", errors)
    validate_camera(layout.get("camera"), "/camera", errors)
    raise_if_errors(errors)


def validate_manifest(manifest: dict[str, Any]) -> None:
    load_schema("manifest")
    errors: list[str] = []
    require_object(manifest, "", errors)
    require_string(manifest, "/generated", "generated", errors)
    require_array(manifest, "/assets", "assets", errors)
    for index, asset in enumerate(manifest.get("assets", [])):
        validate_asset(asset, f"/assets/{index}", errors)
    raise_if_errors(errors)


def validate_instance(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    require_string(value, f"{pointer}/instance_id", "instance_id", errors)
    require_string(value, f"{pointer}/asset_id", "asset_id", errors)
    require_vec(value, f"{pointer}/position", "position", 3, errors)
    require_vec(value, f"{pointer}/quaternion", "quaternion", 4, errors)
    require_vec(value, f"{pointer}/scale", "scale", 3, errors)


def validate_camera(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    require_vec(value, f"{pointer}/position", "position", 3, errors)
    require_vec(value, f"{pointer}/target", "target", 3, errors)
    if "up" in value:
        require_vec(value, f"{pointer}/up", "up", 3, errors)
    require_number(value, f"{pointer}/fov_deg", "fov_deg", errors, low=1, high=179)


def validate_render(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    for key in ("width", "height", "samples"):
        if key in value:
            require_int(value, f"{pointer}/{key}", key, errors, low=1)


def validate_lighting(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    require_string(value, f"{pointer}/preset", "preset", errors)
    sun = value.get("sun")
    world = value.get("world")
    if require_object(sun, f"{pointer}/sun", errors):
        require_number(sun, f"{pointer}/sun/azimuth_deg", "azimuth_deg", errors)
        require_number(sun, f"{pointer}/sun/elevation_deg", "elevation_deg", errors)
        require_rgb(sun, f"{pointer}/sun/color", "color", errors)
        require_number(sun, f"{pointer}/sun/strength", "strength", errors, low=0)
        require_number(sun, f"{pointer}/sun/angle_deg", "angle_deg", errors, low=0.000001)
    if require_object(world, f"{pointer}/world", errors):
        if world.get("type") not in ("color", "sky", "hdri"):
            errors.append(f"{pointer}/world/type: expected color, sky, or hdri")
        require_number(world, f"{pointer}/world/strength", "strength", errors, low=0)
        require_rgb(world, f"{pointer}/world/color", "color", errors)
        if "rotation_deg" in world:
            require_number(world, f"{pointer}/world/rotation_deg", "rotation_deg", errors)
    require_number(value, f"{pointer}/exposure", "exposure", errors)


def validate_asset(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    for key in ("id", "name", "glb", "source_blend", "collection"):
        require_string(value, f"{pointer}/{key}", key, errors)
    require_vec(value, f"{pointer}/bbox", "bbox", 3, errors)
    if value.get("up_axis") not in ("Y", "Z"):
        errors.append(f"{pointer}/up_axis: expected Y or Z")


def require_object(value: Any, pointer: str, errors: list[str]) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{pointer or '/'}: expected object")
        return False
    return True


def require_object_member(obj: dict, pointer: str, key: str, errors: list[str]) -> bool:
    if key not in obj:
        errors.append(f"{pointer}: required")
        return False
    return require_object(obj[key], pointer, errors)


def require_array(obj: dict, pointer: str, key: str, errors: list[str]) -> bool:
    if key not in obj:
        errors.append(f"{pointer}: required")
        return False
    if not isinstance(obj[key], list):
        errors.append(f"{pointer}: expected array")
        return False
    return True


def require_string(obj: dict, pointer: str, key: str, errors: list[str]) -> bool:
    value = obj.get(key)
    if not isinstance(value, str) or not value:
        errors.append(f"{pointer}: expected non-empty string")
        return False
    return True


def require_const(obj: dict, pointer: str, key: str, expected: Any, errors: list[str]) -> None:
    if obj.get(key) != expected:
        errors.append(f"{pointer}: expected {expected!r}")


def require_vec(obj: dict, pointer: str, key: str, length: int, errors: list[str]) -> bool:
    value = obj.get(key)
    if not isinstance(value, list) or len(value) != length:
        errors.append(f"{pointer}: expected {length} numbers")
        return False
    for index, item in enumerate(value):
        if not is_number(item):
            errors.append(f"{pointer}/{index}: expected number")
            return False
    return True


def require_rgb(obj: dict, pointer: str, key: str, errors: list[str]) -> bool:
    if not require_vec(obj, pointer, key, 3, errors):
        return False
    for index, value in enumerate(obj[key]):
        if value < 0 or value > 1:
            errors.append(f"{pointer}/{index}: expected number between 0 and 1")
            return False
    return True


def require_number(
    obj: dict,
    pointer: str,
    key: str,
    errors: list[str],
    low: float | None = None,
    high: float | None = None,
) -> bool:
    value = obj.get(key)
    if not is_number(value):
        errors.append(f"{pointer}: expected number")
        return False
    if low is not None and value < low:
        errors.append(f"{pointer}: expected number >= {low}")
        return False
    if high is not None and value > high:
        errors.append(f"{pointer}: expected number <= {high}")
        return False
    return True


def require_int(obj: dict, pointer: str, key: str, errors: list[str], low: int) -> bool:
    value = obj.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        errors.append(f"{pointer}: expected integer")
        return False
    if value < low:
        errors.append(f"{pointer}: expected integer >= {low}")
        return False
    return True


def is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def raise_if_errors(errors: list[str]) -> None:
    if errors:
        raise ContractError(errors)
