"""Small pure-geometry helpers for agent diagnostics."""

from __future__ import annotations

import math
from typing import Any

Vec3 = list[float]


def bbox_corners(aabb: dict[str, Vec3]) -> list[Vec3]:
    mins = aabb["min"]
    maxs = aabb["max"]
    return [
        [x, y, z]
        for x in (mins[0], maxs[0])
        for y in (mins[1], maxs[1])
        for z in (mins[2], maxs[2])
    ]


def bbox_center(aabb: dict[str, Vec3]) -> Vec3:
    return [(aabb["min"][index] + aabb["max"][index]) / 2 for index in range(3)]


def project_point(point: Vec3, layout: dict[str, Any]) -> dict:
    basis = camera_basis(layout["camera"])
    delta = sub(point, layout["camera"]["position"])
    depth = dot(delta, basis["forward"])
    if depth <= 0.000001:
        return {"in_front": False, "ndc": [0.0, 0.0], "depth": round_float(depth)}
    render = layout.get("render", {})
    aspect = float(render.get("width", 1920)) / float(render.get("height", 1080))
    tan_y = math.tan(math.radians(float(layout["camera"]["fov_deg"])) / 2)
    ndc_x = dot(delta, basis["right"]) / (depth * tan_y * aspect)
    ndc_y = dot(delta, basis["up"]) / (depth * tan_y)
    return {"in_front": True, "ndc": [ndc_x, ndc_y], "depth": round_float(depth)}


def camera_basis(camera: dict[str, Any]) -> dict[str, Vec3]:
    forward = normalize(sub(camera["target"], camera["position"]))
    up_hint = normalize(camera.get("up", [0, 1, 0]))
    right = normalize(cross(forward, up_hint))
    if length(right) <= 0.000001:
        right = [1.0, 0.0, 0.0]
    up = normalize(cross(right, forward))
    return {"forward": forward, "right": right, "up": up}


def clipped_edges(ndc_min: Vec3, ndc_max: Vec3) -> list[str]:
    edges = []
    if ndc_min[0] < -1:
        edges.append("left")
    if ndc_max[0] > 1:
        edges.append("right")
    if ndc_min[1] < -1:
        edges.append("bottom")
    if ndc_max[1] > 1:
        edges.append("top")
    return edges


def aabb_overlap(left: dict[str, Vec3], right: dict[str, Vec3]) -> dict:
    mins = [max(left["min"][index], right["min"][index]) for index in range(3)]
    maxs = [min(left["max"][index], right["max"][index]) for index in range(3)]
    size = [maxs[index] - mins[index] for index in range(3)]
    return {"overlaps": all(value > 0 for value in size), "size": size}


def sun_direction(sun: dict[str, Any]) -> Vec3:
    azimuth = math.radians(float(sun["azimuth_deg"]))
    elevation = math.radians(float(sun["elevation_deg"]))
    horizontal = math.cos(elevation)
    return [
        math.sin(azimuth) * horizontal,
        math.sin(elevation),
        math.cos(azimuth) * horizontal,
    ]


def three_point_to_blender(values: Vec3) -> Vec3:
    return [values[0], -values[2], values[1]]


def as_floats(values: Any) -> Vec3:
    return [float(value) for value in values]


def sub(left: Vec3, right: Vec3) -> Vec3:
    return [left[index] - right[index] for index in range(3)]


def dot(left: Vec3, right: Vec3) -> float:
    return sum(left[index] * right[index] for index in range(3))


def cross(left: Vec3, right: Vec3) -> Vec3:
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ]


def length(values: Vec3) -> float:
    return math.sqrt(dot(values, values))


def normalize(values: Vec3) -> Vec3:
    size = length(values)
    if size <= 0.000001:
        return [0.0, 0.0, 0.0]
    return [value / size for value in values]


def distance(left: Vec3, right: Vec3) -> float:
    return length(sub(left, right))


def rounded(values: Vec3) -> Vec3:
    return [round_float(value) for value in values]


def round_float(value: float) -> float:
    rounded_value = round(float(value), 6)
    return 0.0 if rounded_value == 0 else rounded_value
