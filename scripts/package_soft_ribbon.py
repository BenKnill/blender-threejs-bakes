#!/usr/bin/env python3
"""Package a native Box3D soft-ribbon trace into JSON, an SVG contact sheet, and a receipt."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

FRAME_PICKS = (0, 30, 60, 90, 120, 150)
EDGE_COLORS = {"warp": "#8be9fd", "weft": "#ffb86c", "shear": "#6272a4", "bend": "#bd93f9"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as source:
        return list(csv.DictReader(source))


def build_motion(rows: list[dict[str, str]], edges: list[dict[str, str]]) -> dict:
    frames: dict[int, list[dict]] = defaultdict(list)
    times: dict[int, float] = {}
    for row in rows:
        frame = int(row["frame"])
        times[frame] = float(row["time_s"])
        frames[frame].append(
            {
                "id": int(row["node"]),
                "pinned": row["pinned"] == "1",
                "position_m": [float(row["x_m"]), float(row["y_m"]), float(row["z_m"])],
            }
        )
    return {
        "schema": "box3d-soft-ribbon-motion/1",
        "space": "threejs_yup",
        "sample_interval_s": 1 / 30,
        "nodes": len(frames[0]),
        "edges": [
            {
                "a": int(edge["a"]),
                "b": int(edge["b"]),
                "kind": edge["kind"],
                "rest_length_m": float(edge["rest_length_m"]),
            }
            for edge in edges
        ],
        "frames": [
            {
                "index": frame,
                "time_s": times[frame],
                "nodes": sorted(frames[frame], key=lambda x: x["id"]),
            }
            for frame in sorted(frames)
        ],
    }


def write_svg(path: Path, motion: dict) -> None:
    width, height = 1200, 520
    panel_width = width / len(FRAME_PICKS)
    edge_lookup = motion["edges"]
    frames = {frame["index"]: frame for frame in motion["frames"]}
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#0b1020"/>',
        '<text x="600" y="34" text-anchor="middle" fill="#f8f8f2" font-family="sans-serif" font-size="22">Box3D soft ribbon — twist, fall, and floor contact</text>',
    ]
    for panel, frame_index in enumerate(FRAME_PICKS):
        frame = frames[frame_index]
        x0 = panel * panel_width
        positions = {node["id"]: node["position_m"] for node in frame["nodes"]}

        def project(position: list[float], panel_origin: float = x0) -> tuple[float, float]:
            # Oblique projection retains enough z to make the twist legible.
            x = panel_origin + 18 + (position[0] + 4.7) * 18 + position[2] * 10
            y = 448 - position[1] * 67 - position[2] * 7
            return x, y

        parts.append(
            f'<rect x="{x0 + 6:.1f}" y="54" width="{panel_width - 12:.1f}" height="414" rx="12" fill="#111831" stroke="#28365e"/>'
        )
        parts.append(
            f'<line x1="{x0 + 12:.1f}" y1="448" x2="{x0 + panel_width - 12:.1f}" y2="448" stroke="#6272a4" stroke-width="3"/>'
        )
        for edge in edge_lookup:
            a = project(positions[edge["a"]])
            b = project(positions[edge["b"]])
            color = EDGE_COLORS[edge["kind"]]
            opacity = "0.40" if edge["kind"] in {"shear", "bend"} else "0.92"
            parts.append(
                f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{color}" stroke-opacity="{opacity}" stroke-width="1.3"/>'
            )
        for node in frame["nodes"]:
            x, y = project(node["position_m"])
            fill = "#ff5555" if node["pinned"] else "#f8f8f2"
            parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="2.7" fill="{fill}"/>')
        parts.append(
            f'<text x="{x0 + panel_width / 2:.1f}" y="495" text-anchor="middle" fill="#f8f8f2" font-family="monospace" font-size="15">t={frame["time_s"]:.0f}s</text>'
        )
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("motion_csv", type=Path)
    parser.add_argument("topology_csv", type=Path)
    parser.add_argument("--performance", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()

    rows = read_csv(args.motion_csv)
    edges = read_csv(args.topology_csv)
    motion = build_motion(rows, edges)
    performance = json.loads(args.performance.read_text(encoding="utf-8"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    motion_path = args.output_dir / "soft_ribbon.motion.json"
    motion_path.write_text(json.dumps(motion, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    preview = args.preview or args.output_dir / "soft_ribbon_preview.svg"
    preview.parent.mkdir(parents=True, exist_ok=True)
    write_svg(preview, motion)

    all_positions = [node["position_m"] for frame in motion["frames"] for node in frame["nodes"]]
    max_radius = max(
        math.sqrt(sum(value * value for value in position)) for position in all_positions
    )
    receipt = {
        "schema": "box3d-soft-ribbon-receipt/1",
        "engine": "Box3D public C API",
        "performance": performance,
        "fixture": {
            "nodes": motion["nodes"],
            "edges": len(motion["edges"]),
            "frames": len(motion["frames"]),
            "duration_s": motion["frames"][-1]["time_s"],
        },
        "checks": {
            "all_finite": all(
                math.isfinite(value) for position in all_positions for value in position
            ),
            "max_position_radius_m": max_radius,
        },
        "artifacts": {
            "motion": {"path": motion_path.name, "sha256": sha256(motion_path)},
            "preview": {"path": preview.name, "sha256": sha256(preview)},
        },
        "non_claims": [
            "not FEM or JGS2",
            "not a continuum material model",
            "not an orbital tether solver",
            "not a Box3D production-solver modification",
        ],
    }
    (args.output_dir / "receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return 0 if receipt["checks"]["all_finite"] and max_radius < 20 else 1


if __name__ == "__main__":
    raise SystemExit(main())
