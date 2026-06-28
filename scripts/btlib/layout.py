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


def instance_by_id(layout: dict[str, Any], instance_id: str) -> dict[str, Any]:
    for instance in layout["instances"]:
        if instance["instance_id"] == instance_id:
            return instance
    raise ValueError(f"unknown instance_id: {instance_id}")


def unique_instance_id(layout: dict[str, Any], asset_id: str) -> str:
    used = {instance["instance_id"] for instance in layout["instances"]}
    index = 1
    while True:
        candidate = f"{asset_id}_{index:03d}"
        if candidate not in used:
            return candidate
        index += 1


def slug(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "_" for char in value.strip())
    return cleaned.strip("_") or "composition"
