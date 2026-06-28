"""Pure lighting presets shared by CLI-authored schema-v2 layouts."""

from __future__ import annotations

from copy import deepcopy

LIGHTING_PRESETS = {
    "golden_hour": {
        "sun": {
            "azimuth_deg": 120,
            "elevation_deg": 8,
            "color": [1, 0.86, 0.68],
            "strength": 2.4,
            "angle_deg": 2.6,
        },
        "world": {
            "type": "sky",
            "strength": 0.45,
            "color": [0.055, 0.058, 0.065],
            "rotation_deg": 0,
        },
        "exposure": 0,
    },
    "noon": {
        "sun": {
            "azimuth_deg": 160,
            "elevation_deg": 62,
            "color": [1, 0.96, 0.88],
            "strength": 3.2,
            "angle_deg": 0.7,
        },
        "world": {
            "type": "sky",
            "strength": 1.1,
            "color": [0.08, 0.095, 0.12],
            "rotation_deg": 0,
        },
        "exposure": 0,
    },
    "overcast": {
        "sun": {
            "azimuth_deg": 90,
            "elevation_deg": 70,
            "color": [0.76, 0.82, 1],
            "strength": 0.5,
            "angle_deg": 8,
        },
        "world": {
            "type": "color",
            "strength": 1.4,
            "color": [0.42, 0.46, 0.5],
            "rotation_deg": 0,
        },
        "exposure": 0.15,
    },
    "studio": {
        "sun": {
            "azimuth_deg": 35,
            "elevation_deg": 38,
            "color": [1, 0.95, 0.86],
            "strength": 2.4,
            "angle_deg": 5,
        },
        "world": {
            "type": "color",
            "strength": 0.65,
            "color": [0.12, 0.12, 0.12],
            "rotation_deg": 0,
        },
        "exposure": 0,
    },
    "night_biolume": {
        "sun": {
            "azimuth_deg": 235,
            "elevation_deg": 9,
            "color": [0.42, 0.58, 1],
            "strength": 0.8,
            "angle_deg": 3,
        },
        "world": {
            "type": "color",
            "strength": 0.18,
            "color": [0.015, 0.02, 0.035],
            "rotation_deg": 0,
        },
        "exposure": -0.2,
    },
}

DEFAULT_PRESET = "golden_hour"


def preset_lighting(name: str = DEFAULT_PRESET) -> dict:
    if name not in LIGHTING_PRESETS:
        raise ValueError(f"unknown lighting preset: {name}")
    return {"preset": name, **deepcopy(LIGHTING_PRESETS[name])}


def merge_lighting(lighting: dict | None) -> dict:
    preset = (lighting or {}).get("preset", DEFAULT_PRESET)
    base = preset_lighting(preset)
    if not lighting:
        return base
    return {
        "preset": preset,
        "sun": {**base["sun"], **lighting.get("sun", {})},
        "world": {**base["world"], **lighting.get("world", {})},
        "exposure": lighting.get("exposure", base["exposure"]),
    }
