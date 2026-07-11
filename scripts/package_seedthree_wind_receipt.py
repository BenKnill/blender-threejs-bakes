#!/usr/bin/env python3
"""Publish a compact tracked summary from SeedThree bake telemetry receipts."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stage(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    artifacts = [
        {**artifact, "path": Path(artifact["path"]).name} for artifact in data["artifacts"]
    ]
    return {
        "label": data["label"],
        "wall_seconds": data["wall_seconds"],
        "peak_rss_bytes": data["memory"]["peak_rss_bytes"],
        "sample_count": data["memory"]["sample_count"],
        "sample_interval_seconds": data["memory"]["sample_interval_seconds"],
        "artifacts": artifacts,
        "source_sha256": sha256(path),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", type=Path, required=True)
    parser.add_argument("--blender-telemetry", type=Path, required=True)
    parser.add_argument("--video-telemetry", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    render = json.loads(args.render.read_text(encoding="utf-8"))
    blender = stage(args.blender_telemetry)
    video = stage(args.video_telemetry)
    receipt = {
        "schema": "seedthree-wind-canopy-bake-summary/1",
        "platform_scope": "observed on the primary M5 Mac; not a portable benchmark",
        "fixture": {
            "frames": render["frames"],
            "resolution": [960, 540],
            "tree_guides": render["tree_guide_count"],
            "branch_vertices": render["branch_vertex_count"],
            "foliage_objects": render["foliage_object_count"],
            "physical_hair_guides": render["physical_hair_guides"],
            "render_hairs": render["render_hairs"],
        },
        "stages": {"blender_frames": blender, "video_packaging": video},
        "headroom_gates": {
            "blender_under_120_seconds": blender["wall_seconds"] < 120,
            "blender_peak_under_2_gib": blender["peak_rss_bytes"] < 2 * 1024**3,
            "all_97_frames_present": blender["artifacts"][0].get("file_count") == 97,
        },
        "scale_decision": "127 render hairs at 960x540 remained comfortably laptop-safe",
        "render_receipt_sha256": sha256(args.render),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if all(receipt["headroom_gates"].values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
