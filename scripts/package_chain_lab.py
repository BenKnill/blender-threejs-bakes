#!/usr/bin/env python3
"""Package deterministic chain-lab traces into a receipt and SVG preview."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

COLORS = {
    "jacobi": "#d95f02",
    "neumann_r2": "#7570b3",
    "schur_window_r2_ls": "#1b9e77",
    "red_black_gs": "#e6ab02",
    "exact_oracle": "#333333",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_trace(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as source:
        return list(csv.DictReader(source))


def write_svg(path: Path, rows: list[dict[str, str]]) -> None:
    by_method: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for row in rows:
        if row["fixture"] != "fixed_end_chain":
            continue
        residual = max(float(row["residual_l2"]), 1e-18)
        by_method[row["method"]].append((int(row["iteration"]), math.log10(residual)))

    width, height = 960, 540
    left, right, top, bottom = 90, 30, 120, 70
    plot_width = width - left - right
    plot_height = height - top - bottom
    max_iteration = max(iteration for points in by_method.values() for iteration, _ in points)
    values = [value for points in by_method.values() for _, value in points]
    low = math.floor(min(values))
    high = math.ceil(max(values))
    if high == low:
        high += 1

    def sx(iteration: int) -> float:
        return left + plot_width * iteration / max_iteration

    def sy(value: float) -> float:
        return top + plot_height * (high - value) / (high - low)

    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="#fbfbf7"/>',
        '<text x="480" y="28" text-anchor="middle" font-family="sans-serif" font-size="20">Tether-chain residual by solver</text>',
        f'<line x1="{left}" y1="{top}" x2="{left}" y2="{top + plot_height}" stroke="#222"/>',
        f'<line x1="{left}" y1="{top + plot_height}" x2="{left + plot_width}" y2="{top + plot_height}" stroke="#222"/>',
    ]
    for exponent in range(low, high + 1):
        y = sy(exponent)
        svg.append(
            f'<line x1="{left}" y1="{y:.2f}" x2="{left + plot_width}" y2="{y:.2f}" stroke="#ddd"/>'
        )
        svg.append(
            f'<text x="{left - 12}" y="{y + 5:.2f}" text-anchor="end" font-family="monospace" font-size="13">1e{exponent}</text>'
        )
    for iteration in range(0, max_iteration + 1, 4):
        x = sx(iteration)
        svg.append(
            f'<text x="{x:.2f}" y="{top + plot_height + 24}" text-anchor="middle" font-family="monospace" font-size="13">{iteration}</text>'
        )
    svg.append(
        f'<text x="{left + plot_width / 2:.2f}" y="{height - 18}" text-anchor="middle" font-family="sans-serif" font-size="14">iteration</text>'
    )
    svg.append(
        f'<text x="22" y="{top + plot_height / 2:.2f}" transform="rotate(-90 22 {top + plot_height / 2:.2f})" text-anchor="middle" font-family="sans-serif" font-size="14">residual L2 (log scale)</text>'
    )

    for legend_index, (method, points) in enumerate(by_method.items()):
        color = COLORS.get(method, "#000000")
        coordinates = " ".join(f"{sx(i):.2f},{sy(v):.2f}" for i, v in points)
        svg.append(
            f'<polyline points="{coordinates}" fill="none" stroke="{color}" stroke-width="2.5"/>'
        )
        legend_x = left + 12 + (legend_index % 2) * 400
        legend_y = 55 + (legend_index // 2) * 22
        svg.append(
            f'<line x1="{legend_x}" y1="{legend_y}" x2="{legend_x + 24}" y2="{legend_y}" stroke="{color}" stroke-width="3"/>'
        )
        svg.append(
            f'<text x="{legend_x + 31}" y="{legend_y + 5}" font-family="monospace" font-size="13">{method}</text>'
        )
    svg.append("</svg>")
    path.write_text("\n".join(svg) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", type=Path)
    parser.add_argument("--box3d-reference", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    rows = read_trace(args.trace)
    terminal: dict[str, dict[str, float | int]] = {}
    for row in rows:
        if row["fixture"] != "fixed_end_chain":
            continue
        terminal[row["method"]] = {
            "iteration": int(row["iteration"]),
            "energy_gap": float(row["energy_gap"]),
            "residual_l2": float(row["residual_l2"]),
        }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = args.output_dir / "convergence.svg"
    write_svg(svg_path, rows)
    box3d_rows = sum(1 for _ in args.box3d_reference.open(encoding="utf-8")) - 1
    receipt = {
        "schema": "jgs2-compliance-chain-lab/1",
        "model": "idealized fixed-end implicit quadratic chain",
        "methods": list(terminal),
        "terminal": terminal,
        "trace": {"path": args.trace.name, "rows": len(rows), "sha256": sha256(args.trace)},
        "plot": {"path": svg_path.name, "sha256": sha256(svg_path)},
        "box3d_reference": {
            "path": args.box3d_reference.name,
            "rows": box3d_rows,
            "sha256": sha256(args.box3d_reference),
            "role": "observational public-API distance-joint trace",
        },
        "formal_seed": "exact-real two-variable Schur/decomposition theorem only",
        "non_claims": [
            "not Box3D internal energy or residual",
            "not floating-point program verification",
            "not nonlinear FEM or contact",
            "not JGS2, Cubature, or a GPU kernel",
        ],
    }
    (args.output_dir / "receipt.json").write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
