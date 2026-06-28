#!/usr/bin/env python3
"""Diagnose and optionally relink material image paths in source .blend assets."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from btlib.texture_paths import (  # noqa: E402 -- Blender --python omits script dir.
    default_texture_roots,
    existing_unique_paths,
    index_texture_basenames,
)

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "manifest.json"


def image_file_path(image) -> Path | None:
    if image.source != "FILE" or image.packed_file:
        return None
    raw = image.filepath
    if not raw:
        return None
    return Path(bpy.path.abspath(raw, library=image.library))


def image_materials(image) -> list[str]:
    names = set()
    for material in bpy.data.materials:
        if not material.use_nodes or not material.node_tree:
            continue
        for node in material.node_tree.nodes:
            if getattr(node, "type", None) == "TEX_IMAGE" and getattr(node, "image", None) == image:
                names.add(material.name)
    return sorted(names)


def inspect_current_file(
    texture_index: dict[str, list[Path]],
    *,
    relink: bool,
    images_to_check: set | None = None,
) -> dict[str, Any]:
    images = []
    missing = []
    relinked = []
    for image in sorted(bpy.data.images, key=lambda item: item.name.lower()):
        if images_to_check is not None and image not in images_to_check:
            continue
        path = image_file_path(image)
        if path is None:
            continue
        exists = path.exists()
        item = {
            "name": image.name,
            "basename": path.name,
            "path": str(path),
            "exists": exists,
            "materials": image_materials(image),
        }
        if not exists:
            matches = texture_index.get(path.name.lower(), [])
            item["candidate_count"] = len(matches)
            item["candidate"] = str(matches[0]) if matches else None
            if relink and matches:
                image.filepath = str(matches[0])
                item["relinked_to"] = str(matches[0])
                relinked.append(item)
                exists = True
                item["exists"] = True
            else:
                missing.append(item)
        images.append(item)
    return {
        "image_count": len(images),
        "missing_count": len(missing),
        "relinked_count": len(relinked),
        "images": images,
        "missing": missing,
        "relinked": relinked,
    }


def inspect_blend(
    blend_path: Path,
    *,
    asset_id: str | None,
    texture_index: dict[str, list[Path]],
    relink: bool,
    save: bool,
) -> dict[str, Any]:
    if not blend_path.exists():
        return {
            "asset_id": asset_id,
            "source_blend": str(blend_path),
            "status": "missing_source_blend",
            "image_count": 0,
            "missing_count": 0,
            "relinked_count": 0,
            "missing": [],
            "relinked": [],
        }

    bpy.ops.wm.open_mainfile(filepath=str(blend_path), load_ui=False)
    result = inspect_current_file(texture_index, relink=relink)
    if relink and save and result["relinked_count"]:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    return {
        "asset_id": asset_id,
        "source_blend": str(blend_path),
        "status": "ok",
        **result,
    }


def manifest_assets(path: Path) -> list[dict[str, Any]]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    return manifest.get("assets", [])


def selected_assets(args: argparse.Namespace) -> list[dict[str, Any]]:
    assets = []
    if args.manifest:
        wanted = set(args.asset or [])
        for asset in manifest_assets(args.manifest):
            if wanted and asset.get("id") not in wanted:
                continue
            assets.append({"asset_id": asset.get("id"), "source_blend": asset["source_blend"]})
    for blend_path in args.source_blend:
        assets.append({"asset_id": None, "source_blend": str(blend_path)})
    return assets


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--asset", action="append", help="manifest asset id to inspect")
    parser.add_argument("--source-blend", type=Path, action="append", default=[])
    parser.add_argument("--texture-root", type=Path, action="append", default=[])
    parser.add_argument("--relink", action="store_true")
    parser.add_argument("--save", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser


def compact_text(report: dict[str, Any]) -> str:
    lines = [
        "Texture diagnostics: "
        f"{report['asset_count']} asset(s), "
        f"{report['missing_texture_count']} missing image link(s), "
        f"{report['relinked_texture_count']} relinked"
    ]
    for asset in report["assets"]:
        if asset["status"] != "ok":
            lines.append(f"{asset['asset_id'] or asset['source_blend']}: {asset['status']}")
            continue
        if asset["missing_count"] or asset["relinked_count"]:
            lines.append(
                f"{asset['asset_id'] or Path(asset['source_blend']).name}: "
                f"{asset['missing_count']} missing, {asset['relinked_count']} relinked"
            )
            for item in [*asset["missing"], *asset["relinked"]]:
                target = item.get("relinked_to") or item.get("candidate") or "no candidate"
                lines.append(f"  {item['basename']} -> {target}")
    return "\n".join(lines)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    parser = build_parser()
    args = parser.parse_args(argv)
    roots = existing_unique_paths(args.texture_root) or default_texture_roots(ROOT)
    texture_index = index_texture_basenames(roots)
    assets = selected_assets(args)
    if not assets:
        parser.error("no assets selected")

    asset_reports = [
        inspect_blend(
            Path(asset["source_blend"]).expanduser(),
            asset_id=asset["asset_id"],
            texture_index=texture_index,
            relink=args.relink,
            save=args.save,
        )
        for asset in assets
    ]
    report = {
        "generated": datetime.now(UTC).isoformat(),
        "texture_roots": [str(path) for path in roots],
        "relink": args.relink,
        "save": args.save,
        "asset_count": len(asset_reports),
        "missing_texture_count": sum(asset["missing_count"] for asset in asset_reports),
        "relinked_texture_count": sum(asset["relinked_count"] for asset in asset_reports),
        "missing_source_blend_count": sum(
            1 for asset in asset_reports if asset["status"] == "missing_source_blend"
        ),
        "assets": asset_reports,
    }
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(compact_text(report))


if __name__ == "__main__":
    main()
