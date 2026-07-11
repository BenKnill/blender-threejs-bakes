#!/usr/bin/env python3
"""Package Box3D wind-garden traces into replay JSON, preview SVG, and receipt."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

FRAME_PICKS = (0, 36, 72, 108, 144, 180)
EDGE_COLORS = {
    "trunk": "#7f5539",
    "tree_bend": "#b08968",
    "branch": "#a7c957",
    "hair": "#ffb703",
    "hair_bend": "#fb8500",
}
NODE_COLORS = {
    "trunk": "#ddb892",
    "branch": "#90be6d",
    "leaf": "#43aa8b",
    "hair_root": "#ff477e",
    "hair": "#ffd166",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as source:
        return list(csv.DictReader(source))


def build_motion(rows: list[dict[str, str]], edge_rows: list[dict[str, str]]) -> dict:
    frames: dict[int, list[dict]] = defaultdict(list)
    times: dict[int, float] = {}
    for row in rows:
        frame = int(row["frame"])
        times[frame] = float(row["time_s"])
        frames[frame].append(
            {
                "id": int(row["node"]),
                "kind": row["kind"],
                "pinned": row["pinned"] == "1",
                "radius_m": float(row["radius_m"]),
                "position_m": [float(row["x_m"]), float(row["y_m"]), float(row["z_m"])],
            }
        )
    return {
        "schema": "box3d-wind-garden-motion/1",
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
            for edge in edge_rows
        ],
        "frames": [
            {
                "index": frame,
                "time_s": times[frame],
                "nodes": sorted(frames[frame], key=lambda node: node["id"]),
            }
            for frame in sorted(frames)
        ],
    }


def hair_tip_ids(motion: dict) -> list[int]:
    kinds = {node["id"]: node["kind"] for node in motion["frames"][0]["nodes"]}
    degree: dict[int, int] = defaultdict(int)
    for edge in motion["edges"]:
        if edge["kind"] in {"hair", "hair_bend"}:
            degree[edge["a"]] += 1
            degree[edge["b"]] += 1
    # Bend edges raise the internal degree; tips remain the only dynamic hair
    # nodes with one adjacent structural hair edge. Count that subset directly.
    structural_degree: dict[int, int] = defaultdict(int)
    for edge in motion["edges"]:
        if edge["kind"] == "hair":
            structural_degree[edge["a"]] += 1
            structural_degree[edge["b"]] += 1
    return sorted(
        node_id
        for node_id, kind in kinds.items()
        if kind == "hair" and structural_degree[node_id] == 1
    )


def wave_metrics(motion: dict) -> dict:
    tips = hair_tip_ids(motion)
    initial = {node["id"]: node["position_m"] for node in motion["frames"][0]["nodes"]}
    peak_frames = []
    spans = []
    for tip in tips:
        series = []
        for frame in motion["frames"]:
            node = next(item for item in frame["nodes"] if item["id"] == tip)
            series.append(node["position_m"][0] - initial[tip][0])
        spans.append(max(series) - min(series))
        mean = sum(series) / len(series)
        peak_frames.append(max(range(len(series)), key=lambda index: abs(series[index] - mean)))
    return {
        "hair_tip_ids": tips,
        "hair_tip_lateral_span_min_m": min(spans),
        "hair_tip_lateral_span_max_m": max(spans),
        "hair_tip_peak_frame_range": max(peak_frames) - min(peak_frames),
    }


def write_svg(path: Path, motion: dict) -> None:
    width, height = 1200, 560
    panel_width = width / len(FRAME_PICKS)
    frames = {frame["index"]: frame for frame in motion["frames"]}
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#06121e"/>',
        '<text x="600" y="34" text-anchor="middle" fill="#f1faee" font-family="sans-serif" font-size="22">Box3D wind garden — crown sway and fiber waves</text>',
    ]
    for panel, frame_index in enumerate(FRAME_PICKS):
        frame = frames[frame_index]
        x0 = panel * panel_width
        positions = {node["id"]: node["position_m"] for node in frame["nodes"]}

        def project(position: list[float], origin: float = x0) -> tuple[float, float]:
            x = origin + panel_width / 2 + position[0] * 19 + position[2] * 5
            y = 500 - position[1] * 68 - position[2] * 2
            return x, y

        parts.append(
            f'<rect x="{x0 + 6:.1f}" y="52" width="{panel_width - 12:.1f}" height="458" rx="12" fill="#0b2233" stroke="#17445e"/>'
        )
        parts.append(
            f'<line x1="{x0 + 10:.1f}" y1="500" x2="{x0 + panel_width - 10:.1f}" y2="500" stroke="#315b63" stroke-width="3"/>'
        )
        for edge in motion["edges"]:
            a = project(positions[edge["a"]])
            b = project(positions[edge["b"]])
            opacity = "0.30" if "bend" in edge["kind"] else "0.90"
            parts.append(
                f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{EDGE_COLORS[edge["kind"]]}" stroke-opacity="{opacity}" stroke-width="1.4"/>'
            )
        for node in frame["nodes"]:
            x, y = project(node["position_m"])
            radius = 3.0 if node["kind"] in {"leaf", "hair_root"} else 2.2
            parts.append(
                f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{radius}" fill="{NODE_COLORS[node["kind"]]}"/>'
            )
        parts.append(
            f'<text x="{x0 + panel_width / 2:.1f}" y="540" text-anchor="middle" fill="#f1faee" font-family="monospace" font-size="15">t={frame["time_s"]:.1f}s</text>'
        )
    parts.append("</svg>")
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("motion_csv", type=Path)
    parser.add_argument("topology_csv", type=Path)
    parser.add_argument("--metrics", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--preview", type=Path, required=True)
    args = parser.parse_args()

    motion = build_motion(read_csv(args.motion_csv), read_csv(args.topology_csv))
    metrics = json.loads(args.metrics.read_text(encoding="utf-8"))
    waves = wave_metrics(motion)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.preview.parent.mkdir(parents=True, exist_ok=True)
    motion_path = args.output_dir / "wind_garden.motion.json"
    motion_path.write_text(json.dumps(motion, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    write_svg(args.preview, motion)

    all_positions = [node["position_m"] for frame in motion["frames"] for node in frame["nodes"]]
    receipt = {
        "schema": "box3d-wind-garden-receipt/1",
        "engine": "Box3D public C API",
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
            "wind_exceeds_calm_hair_m": metrics["wind_max_hair_tip_displacement_m"]
            - metrics["calm_max_hair_tip_displacement_m"],
            "wind_exceeds_calm_crown_m": metrics["wind_max_crown_displacement_m"]
            - metrics["calm_max_crown_displacement_m"],
        },
        "metrics": metrics,
        "waves": waves,
        "artifacts": {
            "motion": {"path": motion_path.name, "sha256": sha256(motion_path)},
            "preview": {"path": args.preview.name, "sha256": sha256(args.preview)},
        },
        "non_claims": [
            "not rod, hair, or FEM continuum mechanics",
            "not fluid dynamics or two-way aerodynamic coupling",
            "not strand self-contact or friction",
            "not a production hair groom or tree biomechanics model",
        ],
    }
    (args.output_dir / "receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    healthy = (
        receipt["checks"]["all_finite"]
        and receipt["checks"]["wind_exceeds_calm_hair_m"] > 0.35
        and receipt["checks"]["wind_exceeds_calm_crown_m"] > 0.25
        and waves["hair_tip_lateral_span_min_m"] > 0.2
    )
    return 0 if healthy else 1


if __name__ == "__main__":
    raise SystemExit(main())
