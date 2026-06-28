"""Composition preset loading and manifest checks."""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

from btlib.layout import ROOT, load_json
from btlib.validate import ContractError, load_schema, validate_layout

DEFAULT_PRESETS_DIR = ROOT / "presets"


def list_presets(presets_dir: Path = DEFAULT_PRESETS_DIR) -> list[dict[str, Any]]:
    return [load_preset(path) for path in sorted(presets_dir.glob("*.preset.json"))]


def load_preset(path: Path) -> dict[str, Any]:
    preset = load_json(path)
    validate_preset(preset)
    return preset


def find_preset(
    preset_id: str, presets_dir: Path = DEFAULT_PRESETS_DIR
) -> tuple[Path, dict[str, Any]]:
    candidates = [
        presets_dir / f"{preset_id}.preset.json",
        presets_dir / preset_id,
    ]
    for path in candidates:
        if path.exists():
            return path, load_preset(path)
    for path in sorted(presets_dir.glob("*.preset.json")):
        preset = load_preset(path)
        if preset["id"] == preset_id:
            return path, preset
    raise ValueError(f"unknown preset: {preset_id}")


def preset_layout(preset: dict[str, Any]) -> dict[str, Any]:
    validate_preset(preset)
    return deepcopy(preset["layout"])


def validate_preset(preset: dict[str, Any]) -> None:
    load_schema("composition-preset")
    errors: list[str] = []
    if not isinstance(preset, dict):
        raise ContractError(["/: expected object"])
    for key in ("id", "name", "description"):
        if not isinstance(preset.get(key), str) or not preset[key]:
            errors.append(f"/{key}: expected non-empty string")
    thumbnail = preset.get("thumbnail")
    if thumbnail is not None and not isinstance(thumbnail, str):
        errors.append("/thumbnail: expected string or null")
    required_assets = preset.get("required_assets")
    if not isinstance(required_assets, list) or not required_assets:
        errors.append("/required_assets: expected non-empty array")
        required_assets = []
    elif len(set(required_assets)) != len(required_assets):
        errors.append("/required_assets: expected unique asset ids")
    for index, asset_id in enumerate(required_assets):
        if not isinstance(asset_id, str) or not asset_id:
            errors.append(f"/required_assets/{index}: expected non-empty string")
    layout = preset.get("layout")
    try:
        validate_layout(layout)
    except ContractError as exc:
        errors.extend(f"/layout{error}" for error in exc.errors)
    else:
        if layout.get("schema") != 2:
            errors.append("/layout/schema: expected 2")
        layout_assets = {instance["asset_id"] for instance in layout.get("instances", [])}
        declared_assets = set(required_assets)
        missing = sorted(layout_assets - declared_assets)
        unused = sorted(declared_assets - layout_assets)
        for asset_id in missing:
            errors.append(f"/required_assets: missing layout asset {asset_id}")
        for asset_id in unused:
            errors.append(f"/required_assets: unused declared asset {asset_id}")
    if errors:
        raise ContractError(errors)


def check_preset_assets(preset: dict[str, Any], manifest: dict[str, Any]) -> list[str]:
    manifest_ids = {asset["id"] for asset in manifest["assets"]}
    layout_ids = {instance["asset_id"] for instance in preset["layout"]["instances"]}
    required_ids = set(preset["required_assets"])
    return sorted((layout_ids | required_ids) - manifest_ids)
