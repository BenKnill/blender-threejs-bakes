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
    if schema not in (1, 2, 3):
        errors.append("/schema: expected 1, 2, or 3")
    require_string(layout, "/name", "name", errors)
    require_const(layout, "/space", "space", "threejs_yup", errors)
    require_array(layout, "/instances", "instances", errors)
    require_object_member(layout, "/camera", "camera", errors)
    if "render" in layout:
        validate_render(layout["render"], "/render", errors)
    if schema in (2, 3):
        require_object_member(layout, "/lighting", "lighting", errors)
    if "lighting" in layout:
        validate_lighting(layout["lighting"], "/lighting", errors)
    if "keyframes" in layout:
        validate_keyframes(layout["keyframes"], "/keyframes", errors)

    for index, instance in enumerate(layout.get("instances", [])):
        validate_instance(instance, f"/instances/{index}", errors)
    validate_camera(layout.get("camera"), "/camera", errors)
    raise_if_errors(errors)


def validate_manifest(
    manifest: dict[str, Any],
    manifest_path: Path | None = None,
    check_proxy_files: bool = False,
) -> None:
    load_schema("manifest")
    errors: list[str] = []
    require_object(manifest, "", errors)
    require_string(manifest, "/generated", "generated", errors)
    require_array(manifest, "/assets", "assets", errors)
    for index, asset in enumerate(manifest.get("assets", [])):
        validate_asset(asset, f"/assets/{index}", errors)
        if check_proxy_files:
            validate_asset_proxy(asset, f"/assets/{index}", errors, manifest_path)
    raise_if_errors(errors)


def validate_shot(shot: dict[str, Any]) -> None:
    load_schema("shot")
    errors: list[str] = []
    require_object(shot, "", errors)
    if shot.get("schema") != 1:
        errors.append("/schema: expected 1")
    require_string(shot, "/shot_id", "shot_id", errors)
    require_string(shot, "/prompt", "prompt", errors)
    if not isinstance(shot.get("negative"), str):
        errors.append("/negative: expected string")
    require_number(shot, "/duration_s", "duration_s", errors, low=0.000001)
    require_int(shot, "/fps_target", "fps_target", errors, low=1)
    require_string(shot, "/model_hint", "model_hint", errors)
    require_array(shot, "/source_layouts", "source_layouts", errors)
    for index, source in enumerate(shot.get("source_layouts", [])):
        if not isinstance(source, str) or not source:
            errors.append(f"/source_layouts/{index}: expected non-empty string")
    frames = shot.get("frames")
    if require_object(frames, "/frames", errors):
        validate_shot_frame(frames.get("first"), "/frames/first", errors, required=True)
        if "last" in frames:
            validate_shot_frame(frames["last"], "/frames/last", errors, required=False)
    render_metadata = shot.get("render_metadata")
    if require_object(render_metadata, "/render_metadata", errors):
        require_string(render_metadata, "/render_metadata/generated_at", "generated_at", errors)
        require_string(render_metadata, "/render_metadata/generator", "generator", errors)
        require_string(render_metadata, "/render_metadata/shot_dir", "shot_dir", errors)
        require_string(render_metadata, "/render_metadata/manifest", "manifest", errors)
        require_array(render_metadata, "/render_metadata/renders", "renders", errors)
    validate_shot_paths(shot, errors)
    raise_if_errors(errors)


def validate_shot_frame(value: Any, pointer: str, errors: list[str], *, required: bool) -> None:
    if value is None:
        if required:
            errors.append(f"{pointer}: missing required object")
        return
    if not require_object(value, pointer, errors):
        return
    require_string(value, f"{pointer}/path", "path", errors)
    if value.get("pose") not in ("base", "a", "b"):
        errors.append(f"{pointer}/pose: expected base, a, or b")
    require_int(value, f"{pointer}/bytes", "bytes", errors, low=0)


def validate_shot_paths(shot: dict[str, Any], errors: list[str]) -> None:
    source_layouts = shot.get("source_layouts", [])
    if isinstance(source_layouts, list):
        for index, source in enumerate(source_layouts):
            require_existing_path(source, f"/source_layouts/{index}", errors)
    frames = shot.get("frames")
    if isinstance(frames, dict):
        for name, frame in frames.items():
            if isinstance(frame, dict):
                require_existing_path(frame.get("path"), f"/frames/{name}/path", errors)

    render_metadata = shot.get("render_metadata")
    if not isinstance(render_metadata, dict):
        return
    require_existing_path(render_metadata.get("shot_dir"), "/render_metadata/shot_dir", errors)
    require_existing_path(render_metadata.get("manifest"), "/render_metadata/manifest", errors)
    renders = render_metadata.get("renders", [])
    if isinstance(renders, list):
        for index, receipt in enumerate(renders):
            if not isinstance(receipt, dict):
                continue
            for key in ("layout", "manifest", "output"):
                require_existing_path(
                    receipt.get(key),
                    f"/render_metadata/renders/{index}/{key}",
                    errors,
                )


def require_existing_path(value: Any, pointer: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value:
        return
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    if not path.exists():
        errors.append(f"{pointer}: path does not exist: {value}")


def validate_instance(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    require_string(value, f"{pointer}/instance_id", "instance_id", errors)
    has_asset = "asset_id" in value
    has_effect = "effect_id" in value
    if has_asset == has_effect:
        errors.append(f"{pointer}: expected exactly one of asset_id or effect_id")
    if has_asset:
        require_string(value, f"{pointer}/asset_id", "asset_id", errors)
    if has_effect:
        require_string(value, f"{pointer}/effect_id", "effect_id", errors)
        if value.get("effect_id") not in (
            "cuda_flame",
            "cuda_blue_plume",
            "cuda_cloud_billow",
            "cuda_chromosphere_lace",
            "cuda_spark_shower",
        ):
            errors.append(f"{pointer}/effect_id: expected known CUDA effect id")
        if "effect_params" in value and not isinstance(value["effect_params"], dict):
            errors.append(f"{pointer}/effect_params: expected object")
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


def validate_keyframes(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    for pose_name in ("a", "b"):
        if pose_name in value:
            validate_pose(value[pose_name], f"{pointer}/{pose_name}", errors)


def validate_pose(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    if "camera" in value:
        validate_camera_override(value["camera"], f"{pointer}/camera", errors)
    if "camera_move" in value:
        validate_camera_move(value["camera_move"], f"{pointer}/camera_move", errors)
    if "instances" in value:
        if not require_object(value["instances"], f"{pointer}/instances", errors):
            return
        for instance_id, transform in value["instances"].items():
            if not isinstance(instance_id, str) or not instance_id:
                errors.append(f"{pointer}/instances: instance ids must be non-empty strings")
                continue
            validate_transform_override(transform, f"{pointer}/instances/{instance_id}", errors)


def validate_camera_move(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    if value.get("preset") not in (
        "push_in",
        "pull_out",
        "orbit_left",
        "orbit_right",
        "crane_up",
        "dolly",
        "whip",
    ):
        errors.append(f"{pointer}/preset: expected known camera move preset")
    for key in ("amount", "degrees"):
        if key in value:
            require_number(value, f"{pointer}/{key}", key, errors)


def validate_camera_override(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    if "position" in value:
        require_vec(value, f"{pointer}/position", "position", 3, errors)
    if "target" in value:
        require_vec(value, f"{pointer}/target", "target", 3, errors)
    if "up" in value:
        require_vec(value, f"{pointer}/up", "up", 3, errors)
    if "fov_deg" in value:
        require_number(value, f"{pointer}/fov_deg", "fov_deg", errors, low=1, high=179)


def validate_transform_override(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    if "position" in value:
        require_vec(value, f"{pointer}/position", "position", 3, errors)
    if "quaternion" in value:
        require_vec(value, f"{pointer}/quaternion", "quaternion", 4, errors)
    if "scale" in value:
        require_vec(value, f"{pointer}/scale", "scale", 3, errors)


def validate_asset(value: Any, pointer: str, errors: list[str]) -> None:
    if not require_object(value, pointer, errors):
        return
    for key in ("id", "name", "glb", "source_blend", "collection"):
        require_string(value, f"{pointer}/{key}", key, errors)
    require_vec(value, f"{pointer}/bbox", "bbox", 3, errors)
    if "default_scale" in value:
        require_number(value, f"{pointer}/default_scale", "default_scale", errors, low=0.000001)
    if value.get("up_axis") not in ("Y", "Z"):
        errors.append(f"{pointer}/up_axis: expected Y or Z")


def validate_asset_proxy(
    value: Any,
    pointer: str,
    errors: list[str],
    manifest_path: Path | None,
) -> None:
    if not isinstance(value, dict) or manifest_path is None:
        return
    glb = value.get("glb")
    if not isinstance(glb, str) or not glb:
        return
    if Path(glb).is_absolute() or ".." in Path(glb).parts:
        errors.append(f"{pointer}/glb: expected repo-relative path under assets/")
        return
    assets_dir = manifest_path.resolve().parent
    proxy_path = assets_dir / glb
    if not proxy_path.is_file():
        errors.append(f"{pointer}/glb: missing proxy file assets/{glb}")


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
