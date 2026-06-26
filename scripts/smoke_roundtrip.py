#!/usr/bin/env python3
"""Create a tiny .blend asset and prove a Three.js layout transform reaches Blender."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_layout


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_fixture_blend(tmpdir: Path) -> Path:
    reset_scene()
    collection = bpy.data.collections.new("fixture_asset")
    bpy.context.scene.collection.children.link(collection)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    cube = bpy.context.object
    for existing in cube.users_collection:
        existing.objects.unlink(cube)
    collection.objects.link(cube)
    source_blend = tmpdir / "fixture_asset.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(source_blend))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return source_blend


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="blender-threejs-roundtrip.") as tmp:
        tmpdir = Path(tmp)
        source_blend = make_fixture_blend(tmpdir)
        manifest_path = tmpdir / "manifest.json"
        layout_path = tmpdir / "translated.layout.json"
        output_dir = tmpdir / "renders"

        manifest_path.write_text(
            json.dumps(
                {
                    "generated": "smoke",
                    "assets": [
                        {
                            "id": "fixture_asset",
                            "name": "Fixture Asset",
                            "glb": "glb/fixture_asset.glb",
                            "source_blend": str(source_blend),
                            "collection": "fixture_asset",
                            "bbox": [1, 1, 1],
                            "up_axis": "Z",
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        layout_path.write_text(
            json.dumps(
                {
                    "name": "translated",
                    "schema": 1,
                    "space": "threejs_yup",
                    "instances": [
                        {
                            "instance_id": "fixture_asset_001",
                            "asset_id": "fixture_asset",
                            "position": [2, 0, 0],
                            "quaternion": [0, 0, 0, 1],
                            "scale": [1, 1, 1],
                        }
                    ],
                    "camera": {
                        "position": [4, 3, 6],
                        "target": [2, 0, 0],
                        "fov_deg": 45,
                        "up": [0, 1, 0],
                    },
                    "render": {"width": 48, "height": 48, "samples": 1},
                }
            ),
            encoding="utf-8",
        )

        receipt = render_layout.render_layout(layout_path, manifest_path, output_dir)
        matrix = receipt["placements"][0]["root_objects"][0]["matrix_world"]
        actual = [matrix[0][3], matrix[1][3], matrix[2][3]]
        expected = [2, 0, 0]
        if actual != expected:
            raise AssertionError(
                f"Root object did not inherit layout transform: {actual} != {expected}"
            )
        print(f"roundtrip ok: root object location {actual}, render {receipt['output']}")


if __name__ == "__main__":
    main()
