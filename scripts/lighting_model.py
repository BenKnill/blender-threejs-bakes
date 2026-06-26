"""Pure lighting defaults and math for schema-v2 layouts."""

from __future__ import annotations

import math

LEGACY_SUN = dict(azimuth_deg=135, elevation_deg=48, color=[1.0, 0.94, 0.78], strength=1.8)
LEGACY_WORLD = dict(type="color", strength=0.35, color=[0.035, 0.04, 0.045], rotation_deg=0)


def default_lighting() -> dict:
    return {
        "preset": "legacy_soft_key",
        "sun": LEGACY_SUN | {"angle_deg": 6.0},
        "world": LEGACY_WORLD.copy(),
        "exposure": 0.0,
    }


def merge_lighting(layout: dict) -> dict:
    base = default_lighting()
    lighting = layout.get("lighting") or {}
    return {
        "preset": lighting.get("preset", base["preset"]),
        "sun": {**base["sun"], **lighting.get("sun", {})},
        "world": {**base["world"], **lighting.get("world", {})},
        "exposure": lighting.get("exposure", base["exposure"]),
    }


def sun_direction_three(sun: dict) -> list[float]:
    azimuth = math.radians(float(sun.get("azimuth_deg", 135)))
    elevation = math.radians(float(sun.get("elevation_deg", 48)))
    horizontal = math.cos(elevation)
    return [
        math.sin(azimuth) * horizontal,
        math.sin(elevation),
        math.cos(azimuth) * horizontal,
    ]


def color_tuple(values: list[float]) -> tuple[float, float, float]:
    return tuple(max(0.0, min(1.0, float(value))) for value in values[:3])
