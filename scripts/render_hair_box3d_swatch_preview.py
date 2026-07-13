#!/usr/bin/env python3
"""Render deterministic rod snapshots from the native Box3D swatch CSV."""

from __future__ import annotations

import argparse
import csv
import html
import math
from pathlib import Path

HALF_LENGTH = 0.14
GUIDE_COLORS = ("#54d6ff", "#a78bfa", "#f472b6", "#facc15")
TARGET_TIMES = (0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0)


def rotate_y_axis(qx: float, qy: float, qz: float, qw: float) -> tuple[float, float, float]:
    """Rotate the local +Y unit vector by a normalized quaternion."""
    # v + 2*s*(qv cross v) + 2*(qv cross (qv cross v)), specialized for v=(0,1,0).
    cross_x = -qz
    cross_y = 0.0
    cross_z = qx
    second_x = qy * cross_z - qz * cross_y
    second_y = qz * cross_x - qx * cross_z
    second_z = qx * cross_y - qy * cross_x
    return (
        2.0 * qw * cross_x + 2.0 * second_x,
        1.0 + 2.0 * qw * cross_y + 2.0 * second_y,
        2.0 * qw * cross_z + 2.0 * second_z,
    )


def load_frames(path: Path) -> dict[float, list[dict[str, float | int]]]:
    frames: dict[float, list[dict[str, float | int]]] = {}
    with path.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            time_s = round(float(row["time_s"]), 6)
            frames.setdefault(time_s, []).append(
                {
                    "guide": int(row["guide"]),
                    "link": int(row["link"]),
                    "x": float(row["x_m"]),
                    "y": float(row["y_m"]),
                    "z": float(row["z_m"]),
                    "qx": float(row["qx"]),
                    "qy": float(row["qy"]),
                    "qz": float(row["qz"]),
                    "qw": float(row["qw"]),
                    "wind_x": float(row["wind_x_m_s"]),
                    "wind_z": float(row["wind_z_m_s"]),
                }
            )
    return frames


def project(point: tuple[float, float, float], center_x: float) -> tuple[float, float]:
    x, y, z = point
    return center_x + 39.0 * (x + 0.48 * z), 58.0 + 76.0 * (2.62 - y) + 8.0 * z


def line(x1: float, y1: float, x2: float, y2: float, color: str, opacity: float) -> str:
    return (
        f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
        f'stroke="{color}" stroke-width="2.2" stroke-linecap="round" opacity="{opacity:.3f}"/>'
    )


def render(input_path: Path, output_path: Path) -> None:
    frames = load_frames(input_path)
    available = sorted(frames)
    selected = [min(available, key=lambda value: abs(value - target)) for target in TARGET_TIMES]
    panel_width = 230
    width = panel_width * len(selected)
    height = 310
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
        '<title id="title">Box3D spherical-chain hair swatch through two rotating wind orbits</title>',
        '<desc id="desc">Seven time samples show sixteen colored eight-link capsule chains hanging at rest, following strong rotating wind, and then following moderate rotating wind.</desc>',
        '<rect width="100%" height="100%" fill="#070912"/>',
    ]

    for panel, time_s in enumerate(selected):
        center_x = panel * panel_width + panel_width / 2
        phase = "strong" if time_s < 6.0 else "moderate"
        if math.isclose(time_s, 0.0):
            phase = "rest"
        parts.append(
            f'<text x="{center_x:.1f}" y="24" fill="#f8fafc" text-anchor="middle" '
            f'font-family="ui-monospace, monospace" font-size="13">{time_s:.0f}s · {html.escape(phase)}</text>'
        )
        parts.append(
            f'<line x1="{panel * panel_width + 10}" y1="38" '
            f'x2="{panel * panel_width + panel_width - 10}" y2="38" stroke="#334155"/>'
        )
        rows = sorted(frames[time_s], key=lambda row: (int(row["guide"]), int(row["link"])))
        for row in rows:
            axis = rotate_y_axis(
                float(row["qx"]), float(row["qy"]), float(row["qz"]), float(row["qw"])
            )
            center = (float(row["x"]), float(row["y"]), float(row["z"]))
            endpoint_a = tuple(center[index] - HALF_LENGTH * axis[index] for index in range(3))
            endpoint_b = tuple(center[index] + HALF_LENGTH * axis[index] for index in range(3))
            x1, y1 = project(endpoint_a, center_x)
            x2, y2 = project(endpoint_b, center_x)
            guide = int(row["guide"])
            color = GUIDE_COLORS[guide // 4]
            parts.append(line(x1, y1, x2, y2, color, 0.82))
            parts.append(f'<circle cx="{x1:.2f}" cy="{y1:.2f}" r="1.35" fill="{color}"/>')
            if int(row["link"]) == 0:
                parts.append(f'<circle cx="{x2:.2f}" cy="{y2:.2f}" r="1.35" fill="{color}"/>')

        wind_x = float(rows[0]["wind_x"])
        wind_z = float(rows[0]["wind_z"])
        wind_length = math.hypot(wind_x, wind_z)
        if wind_length > 0.01:
            arrow_x = 30.0 * (wind_x + 0.48 * wind_z) / wind_length
            arrow_y = 6.0 * wind_z / wind_length
            start_x = center_x - arrow_x * 0.5
            start_y = 283.0 - arrow_y * 0.5
            end_x = center_x + arrow_x * 0.5
            end_y = 283.0 + arrow_y * 0.5
            parts.append(line(start_x, start_y, end_x, end_y, "#e2e8f0", 0.9))
            parts.append(f'<circle cx="{end_x:.2f}" cy="{end_y:.2f}" r="3" fill="#e2e8f0"/>')
        parts.append(
            f'<text x="{center_x:.1f}" y="302" fill="#94a3b8" text-anchor="middle" '
            f'font-family="ui-sans-serif, sans-serif" font-size="11">wind direction</text>'
        )

    parts.append("</svg>\n")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(parts), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    render(args.input, args.output)


if __name__ == "__main__":
    main()
