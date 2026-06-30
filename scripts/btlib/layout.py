"""Shared layout and manifest helpers for local agent tooling."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from btlib.lighting import preset_lighting
from btlib.validate import validate_layout, validate_manifest

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LAYOUT = ROOT / "layouts" / "live.layout.json"
DEFAULT_MANIFEST = ROOT / "assets" / "manifest.json"
DEFAULT_RENDERS = ROOT / "renders"
BLENDER = ROOT / "scripts" / "blender.sh"
RENDER_SCRIPT = ROOT / "scripts" / "render_layout.py"
TEXTURE_REPORT_SCRIPT = ROOT / "scripts" / "asset_texture_report.py"
COMPUTE_EFFECTS = {
    "cuda_flame": {
        "id": "cuda_flame",
        "name": "CUDA Flame",
        "bbox": [1, 1, 1],
        "default_scale": [3.5, 0.75, 0.75],
    },
    "cuda_blue_plume": {
        "id": "cuda_blue_plume",
        "name": "CUDA Blue Plume",
        "bbox": [1, 1, 1],
        "default_scale": [3.2, 0.55, 0.55],
    },
    "cuda_cloud_billow": {
        "id": "cuda_cloud_billow",
        "name": "CUDA Cloud Billow",
        "bbox": [1, 1, 1],
        "default_scale": [2.4, 1.3, 1.0],
    },
    "cuda_chromosphere_lace": {
        "id": "cuda_chromosphere_lace",
        "name": "CUDA Chromosphere Lace",
        "bbox": [1, 1, 1],
        "default_scale": [3.0, 1.8, 0.35],
    },
    "cuda_spark_shower": {
        "id": "cuda_spark_shower",
        "name": "CUDA Spark Shower",
        "bbox": [1, 1, 1],
        "default_scale": [2.2, 0.75, 0.45],
    },
}


def resolve_repo_path(path: str | Path) -> Path:
    raw = Path(path)
    if raw.is_absolute():
        return raw
    return ROOT / raw


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_manifest(path: Path = DEFAULT_MANIFEST) -> dict[str, Any]:
    manifest = load_json(path)
    validate_manifest(manifest)
    return manifest


def load_layout(path: Path = DEFAULT_LAYOUT) -> dict[str, Any]:
    layout = load_json(path)
    validate_layout(layout)
    return layout


def write_layout(path: Path, layout: dict[str, Any]) -> None:
    validate_layout(layout)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(layout, indent=2) + "\n", encoding="utf-8")


def new_layout(name: str) -> dict[str, Any]:
    return {
        "name": slug(name),
        "schema": 2,
        "space": "threejs_yup",
        "instances": [],
        "camera": {
            "position": [4, 3, 6],
            "target": [0, 0.8, 0],
            "fov_deg": 45,
            "up": [0, 1, 0],
        },
        "render": {"width": 1920, "height": 1080, "samples": 256},
        "lighting": preset_lighting(),
    }


def asset_by_id(manifest: dict[str, Any], asset_id: str) -> dict[str, Any]:
    for asset in manifest["assets"]:
        if asset["id"] == asset_id:
            return asset
    raise ValueError(f"unknown asset_id: {asset_id}")


def effect_by_id(effect_id: str) -> dict[str, Any]:
    if effect_id not in COMPUTE_EFFECTS:
        raise ValueError(f"unknown effect_id: {effect_id}")
    return COMPUTE_EFFECTS[effect_id]


def instance_by_id(layout: dict[str, Any], instance_id: str) -> dict[str, Any]:
    for instance in layout["instances"]:
        if instance["instance_id"] == instance_id:
            return instance
    raise ValueError(f"unknown instance_id: {instance_id}")


def unique_instance_id(layout: dict[str, Any], base_id: str) -> str:
    used = {instance["instance_id"] for instance in layout["instances"]}
    index = 1
    while True:
        candidate = f"{base_id}_{index:03d}"
        if candidate not in used:
            return candidate
        index += 1


def slug(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "_" for char in value.strip())
    return cleaned.strip("_") or "composition"
