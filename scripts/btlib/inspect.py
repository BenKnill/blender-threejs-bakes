"""Pure scene inspection helpers for agent-readable layout diagnostics."""

from __future__ import annotations

from itertools import combinations
from typing import Any

from btlib.geometry import (
    Vec3,
    aabb_overlap,
    as_floats,
    bbox_center,
    bbox_corners,
    camera_basis,
    clipped_edges,
    distance,
    dot,
    project_point,
    round_float,
    rounded,
    sun_direction,
    three_point_to_blender,
)
from btlib.layout import asset_by_id
from btlib.lighting import merge_lighting

GROUND_EPSILON = 0.05
SCALE_OUTLIER_FACTOR = 10.0


def inspect_layout(layout: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    """Return stable JSON diagnostics for a validated layout and manifest."""

    instance_reports = [
        inspect_instance(instance, asset_by_id(manifest, instance["asset_id"]), layout)
        for instance in layout["instances"]
    ]
    lighting_report = inspect_lighting(layout)
    relationship_reports = inspect_relationships(instance_reports)
    warnings = summary_warnings(instance_reports, relationship_reports, lighting_report)
    return {
        "ok": True,
        "layout": {
            "name": layout["name"],
            "schema": layout["schema"],
            "space": layout["space"],
            "instance_count": len(instance_reports),
        },
        "camera": inspect_camera(layout),
        "lighting": lighting_report,
        "instances": instance_reports,
        "relationships": relationship_reports,
        "summary": {
            "instances": len(instance_reports),
            "in_frame": count_framing(instance_reports, "in-frame"),
            "partially_clipped": count_framing(instance_reports, "partially-clipped"),
            "off_screen": count_framing(instance_reports, "off-screen"),
            "total_tris_known": total_tris_known(instance_reports),
            "warnings": warnings,
        },
    }


def inspect_instance(
    instance: dict[str, Any], asset: dict[str, Any], layout: dict[str, Any]
) -> dict:
    bbox_three = three_bbox(asset)
    scale = as_floats(instance["scale"])
    size_three = [bbox_three[index] * abs(scale[index]) for index in range(3)]
    aabb = instance_aabb(instance["position"], size_three)
    scale_report = inspect_scale(scale, asset)
    ground = inspect_grounding(aabb)
    framing = inspect_framing(aabb, layout)
    warnings = [*scale_report["warnings"], *ground["warnings"], *framing["warnings"]]
    triangles = asset.get("proxy", {}).get("triangles_before")
    return {
        "instance_id": instance["instance_id"],
        "asset_id": instance["asset_id"],
        "asset_name": asset["name"],
        "positions": {
            "threejs_yup": rounded(instance["position"]),
            "blender_zup": rounded(three_point_to_blender(instance["position"])),
        },
        "size": {
            "threejs_yup": rounded(size_three),
            "blender_zup": rounded([size_three[0], size_three[2], size_three[1]]),
        },
        "scale": scale_report,
        "bbox": {
            "min": rounded(aabb["min"]),
            "max": rounded(aabb["max"]),
        },
        "ground": ground,
        "camera": framing,
        "triangles": triangles if isinstance(triangles, int) else None,
        "warnings": warnings,
    }


def inspect_camera(layout: dict[str, Any]) -> dict:
    camera = layout["camera"]
    render = layout.get("render", {})
    width = int(render.get("width", 1920))
    height = int(render.get("height", 1080))
    return {
        "position": rounded(camera["position"]),
        "target": rounded(camera["target"]),
        "fov_deg": round_float(float(camera["fov_deg"])),
        "aspect": round_float(width / height),
        "render_size": [width, height],
    }


def inspect_lighting(layout: dict[str, Any]) -> dict:
    if not layout.get("lighting"):
        return {
            "present": False,
            "description": "legacy layout has no lighting block",
            "warnings": ["layout has no lighting block; renderer will use legacy lighting"],
        }
    lighting = merge_lighting(layout["lighting"])
    direction = sun_direction(lighting["sun"])
    camera = camera_basis(layout["camera"])
    rightness = dot(direction, camera["right"])
    frontness = dot(direction, camera["forward"])
    horizontal_words = []
    horizontal_words.append(
        "front" if frontness > 0.25 else "back" if frontness < -0.25 else "side"
    )
    if abs(rightness) > 0.25:
        horizontal_words.append("right" if rightness > 0 else "left")
    elevation = float(lighting["sun"]["elevation_deg"])
    if elevation > 45:
        elevation_word = "high"
    elif elevation < 15:
        elevation_word = "low"
    else:
        elevation_word = "mid"
    warnings = lighting_warnings(lighting, elevation)
    return {
        "present": True,
        "preset": lighting["preset"],
        "sun_direction_threejs_yup": rounded(direction),
        "relative_to_camera": " ".join(horizontal_words),
        "elevation": elevation_word,
        "description": f"{elevation_word} sun from camera {'/'.join(horizontal_words)}",
        "warnings": warnings,
    }


def lighting_warnings(lighting: dict[str, Any], elevation: float) -> list[str]:
    warnings = []
    exposure = float(lighting.get("exposure", 0.0))
    sun = lighting["sun"]
    world = lighting["world"]
    sun_strength = float(sun.get("strength", 0.0))
    world_strength = float(world.get("strength", 0.0))
    if exposure > 0.25:
        warnings.append(f"exposure {exposure:g} may wash out whites and material identity")
    if elevation < 15 and sun_strength >= 3.5:
        warnings.append(
            f"low sun elevation {elevation:g} with strength {sun_strength:g} can overheat highlights"
        )
    if sun_strength >= 3.5 and world_strength >= 0.75:
        warnings.append(
            f"world fill {world_strength:g} plus sun strength {sun_strength:g} may flatten contrast"
        )
    return warnings


def inspect_scale(scale: Vec3, asset: dict[str, Any]) -> dict:
    default = default_drop_scale(asset)
    ratios = [abs(value) / default if default else 0.0 for value in scale]
    warnings = []
    max_ratio = max(ratios)
    min_ratio = min(ratios)
    if max_ratio >= SCALE_OUTLIER_FACTOR:
        warnings.append(f"scale is {max_ratio:.1f}x the default drop scale")
    if min_ratio > 0 and min_ratio <= 1 / SCALE_OUTLIER_FACTOR:
        warnings.append(f"scale is {1 / min_ratio:.1f}x smaller than the default drop scale")
    if any(value <= 0 for value in scale):
        warnings.append("scale has a zero or negative axis")
    return {
        "value": rounded(scale),
        "default_drop_scale": round_float(default),
        "ratio_to_default": rounded(ratios),
        "status": "warning" if warnings else "ok",
        "warnings": warnings,
    }


def inspect_grounding(aabb: dict[str, Vec3]) -> dict:
    bottom = aabb["min"][1]
    if bottom > GROUND_EPSILON:
        status = "floating"
        note = f"bottom is {bottom:.2f} above y=0"
    elif bottom < -GROUND_EPSILON:
        status = "sunken"
        note = f"bottom is {abs(bottom):.2f} below y=0"
    else:
        status = "grounded"
        note = "bottom is near y=0"
    return {
        "status": status,
        "bottom_y": round_float(bottom),
        "note": note,
        "warnings": [] if status == "grounded" else [note],
    }


def inspect_framing(aabb: dict[str, Vec3], layout: dict[str, Any]) -> dict:
    projected = [project_point(corner, layout) for corner in bbox_corners(aabb)]
    in_front = [item for item in projected if item["in_front"]]
    if not in_front:
        return {
            "status": "off-screen",
            "clip_edges": ["behind-camera"],
            "visible_fraction": 0.0,
            "screen_coverage": {"width": 0.0, "height": 0.0, "area": 0.0},
            "distance": round_float(distance(layout["camera"]["position"], bbox_center(aabb))),
            "warnings": ["instance bbox is behind the camera"],
        }

    xs = [item["ndc"][0] for item in in_front]
    ys = [item["ndc"][1] for item in in_front]
    ndc_min = [min(xs), min(ys)]
    ndc_max = [max(xs), max(ys)]
    clip_edges = clipped_edges(ndc_min, ndc_max)
    visible_width = max(0.0, min(ndc_max[0], 1.0) - max(ndc_min[0], -1.0))
    visible_height = max(0.0, min(ndc_max[1], 1.0) - max(ndc_min[1], -1.0))
    raw_width = max(0.0, ndc_max[0] - ndc_min[0])
    raw_height = max(0.0, ndc_max[1] - ndc_min[1])
    visible_area = visible_width * visible_height
    raw_area = raw_width * raw_height
    visible_fraction = visible_area / raw_area if raw_area > 0 else 0.0
    if visible_fraction <= 0:
        status = "off-screen"
    elif clip_edges:
        status = "partially-clipped"
    else:
        status = "in-frame"
    coverage = {
        "width": round_float(min(1.0, visible_width / 2.0)),
        "height": round_float(min(1.0, visible_height / 2.0)),
        "area": round_float(min(1.0, visible_area / 4.0)),
    }
    warnings = []
    if status == "partially-clipped":
        warnings.append(f"partially clipped on {', '.join(clip_edges)}")
    elif status == "off-screen":
        warnings.append("off-screen")
    return {
        "status": status,
        "clip_edges": clip_edges,
        "visible_fraction": round_float(visible_fraction),
        "screen_coverage": coverage,
        "ndc_bounds": {"min": rounded(ndc_min), "max": rounded(ndc_max)},
        "distance": round_float(distance(layout["camera"]["position"], bbox_center(aabb))),
        "warnings": warnings,
    }


def inspect_relationships(instances: list[dict]) -> dict:
    overlaps = []
    for left, right in combinations(instances, 2):
        overlap = aabb_overlap(left["bbox"], right["bbox"])
        if overlap["overlaps"]:
            overlaps.append(
                {
                    "a": left["instance_id"],
                    "b": right["instance_id"],
                    "overlap_size": rounded(overlap["size"]),
                    "note": "bbox overlap",
                }
            )
    return {"overlaps": overlaps}


def count_framing(instances: list[dict], status: str) -> int:
    return sum(1 for instance in instances if instance["camera"]["status"] == status)


def total_tris_known(instances: list[dict]) -> int | None:
    values = [instance["triangles"] for instance in instances]
    if any(value is None for value in values):
        return None
    return sum(values)


def summary_warnings(instances: list[dict], relationships: dict, lighting: dict) -> list[str]:
    warnings = []
    for warning in lighting["warnings"]:
        warnings.append(f"lighting: {warning}")
    for instance in instances:
        for warning in instance["warnings"]:
            warnings.append(f"{instance['instance_id']}: {warning}")
    for overlap in relationships["overlaps"]:
        warnings.append(f"{overlap['a']} overlaps {overlap['b']}")
    return warnings


def default_drop_scale(asset: dict[str, Any]) -> float:
    bbox = asset.get("bbox") if isinstance(asset.get("bbox"), list) else [1, 1, 1]
    max_axis = max(abs(float(value or 0)) for value in bbox)
    if max_axis <= 0:
        return 1.0
    return min(30.0, max(1.0, 1.5 / max_axis))


def three_bbox(asset: dict[str, Any]) -> Vec3:
    bbox = as_floats(asset.get("bbox", [1, 1, 1]))
    if asset.get("up_axis") == "Z":
        return [bbox[0], bbox[2], bbox[1]]
    return bbox


def instance_aabb(position: Vec3, size: Vec3) -> dict[str, Vec3]:
    x, y, z = as_floats(position)
    sx, sy, sz = size
    return {
        "min": [x - sx / 2, y, z - sz / 2],
        "max": [x + sx / 2, y + sy, z + sz / 2],
    }
