#!/usr/bin/env python3
"""Dependency-light geometry helpers for guide-driven canopy and groom rendering."""

from __future__ import annotations

import math
from collections.abc import Sequence

Point3 = tuple[float, float, float]


def distance(a: Point3, b: Point3) -> float:
    return math.sqrt(sum((left - right) ** 2 for left, right in zip(a, b, strict=True)))


def resample_polyline(points: Sequence[Point3], count: int) -> list[Point3]:
    if count < 2:
        raise ValueError("resample count must be at least two")
    if len(points) < 2:
        raise ValueError("polyline must contain at least two points")
    lengths = [0.0]
    for left, right in zip(points, points[1:], strict=False):
        lengths.append(lengths[-1] + distance(left, right))
    total = lengths[-1]
    if total == 0:
        return [tuple(points[0])] * count
    result = []
    segment = 0
    for index in range(count):
        target = total * index / (count - 1)
        while segment + 1 < len(lengths) - 1 and lengths[segment + 1] < target:
            segment += 1
        start_distance = lengths[segment]
        end_distance = lengths[segment + 1]
        alpha = (target - start_distance) / (end_distance - start_distance)
        result.append(
            tuple(
                points[segment][axis] * (1 - alpha) + points[segment + 1][axis] * alpha
                for axis in range(3)
            )
        )
    return result


def blend_polylines(left: Sequence[Point3], right: Sequence[Point3], alpha: float) -> list[Point3]:
    if len(left) != len(right):
        raise ValueError("polylines must have equal sample counts")
    return [
        tuple(a[axis] * (1 - alpha) + b[axis] * alpha for axis in range(3))
        for a, b in zip(left, right, strict=True)
    ]


def nearest_weights(
    point: Point3, guides: Sequence[Point3], count: int = 3
) -> list[tuple[int, float]]:
    if not guides:
        raise ValueError("at least one guide is required")
    nearest = sorted(enumerate(guides), key=lambda item: distance(point, item[1]))[:count]
    if nearest[0][1] == point:
        return [(nearest[0][0], 1.0)]
    raw = [(index, 1.0 / max(distance(point, guide), 1e-9) ** 2) for index, guide in nearest]
    total = sum(weight for _, weight in raw)
    return [(index, weight / total) for index, weight in raw]


def weighted_displacement(
    weights: Sequence[tuple[int, float]], displacements: Sequence[Point3]
) -> Point3:
    return tuple(
        sum(displacements[index][axis] * weight for index, weight in weights) for axis in range(3)
    )
