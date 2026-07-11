#!/usr/bin/env python3
"""Deterministic scalp, fiber, and cutting geometry for the mannequin haircut demo."""

from __future__ import annotations

import math
from dataclasses import dataclass

Point3 = tuple[float, float, float]


@dataclass(frozen=True)
class Fiber:
    root: Point3
    normal: Point3
    length: float
    phase: float
    bangs: bool


def scalp_fibers(count: int, center: Point3 = (0.0, 0.0, 8.35)) -> list[Fiber]:
    if count < 8:
        raise ValueError("at least eight fibers are required")
    golden_angle = math.pi * (3.0 - math.sqrt(5.0))
    fibers = []
    for index in range(count):
        fraction = (index + 0.5) / count
        theta = 0.14 + 1.36 * math.sqrt(fraction)
        phi = index * golden_angle
        normal = (
            math.sin(theta) * math.cos(phi),
            math.sin(theta) * math.sin(phi),
            math.cos(theta),
        )
        root = (
            center[0] + 1.55 * normal[0],
            center[1] + 1.34 * normal[1],
            center[2] + 1.82 * normal[2],
        )
        bangs = normal[1] < -0.58 and abs(normal[0]) < 0.58
        length = (
            1.35 + 0.9 * abs(normal[0]) / 0.58
            if bangs
            else 3.8 + 1.65 * math.sin(theta) + 0.3 * math.cos(phi * 2.0)
        )
        fibers.append(Fiber(root, normal, length, phi, bangs))
    return fibers


def rest_curve(fiber: Fiber, point_count: int) -> list[Point3]:
    if point_count < 4:
        raise ValueError("a fiber needs at least four points")
    tangent = (-fiber.normal[1], fiber.normal[0], 0.0)
    points = []
    for index in range(point_count):
        u = index / (point_count - 1)
        flare = 0.62 * math.sin(0.5 * math.pi * u)
        curl = (0.05 if fiber.bangs else 0.11) * math.sin(3.0 * math.pi * u + fiber.phase) * u
        points.append(
            (
                fiber.root[0] + fiber.normal[0] * flare + tangent[0] * curl,
                fiber.root[1] + fiber.normal[1] * flare + tangent[1] * curl,
                fiber.root[2] - fiber.length * u,
            )
        )
    return points


def cut_curve(points: list[Point3], cut_height: float) -> tuple[list[Point3], list[Point3], int]:
    crossing = next((index for index, point in enumerate(points) if point[2] < cut_height), None)
    if crossing is None or crossing == 0:
        tip = points[-1]
        return list(points), [tip] * len(points), len(points)
    above = points[crossing - 1]
    below = points[crossing]
    alpha = (above[2] - cut_height) / max(above[2] - below[2], 1e-9)
    cut_point = tuple(above[axis] * (1 - alpha) + below[axis] * alpha for axis in range(3))
    attached = list(points)
    for index in range(crossing, len(attached)):
        attached[index] = cut_point
    severed_source = [cut_point, *points[crossing:]]
    severed = []
    for index in range(len(points)):
        source_index = min(index, len(severed_source) - 1)
        severed.append(severed_source[source_index])
    return attached, severed, crossing


def apply_displacement(
    points: list[Point3], displacements: list[Point3], scale: float = 0.72
) -> list[Point3]:
    if len(points) != len(displacements):
        raise ValueError("fiber and guide displacement counts must match")
    result = []
    for index, (point, displacement) in enumerate(zip(points, displacements, strict=True)):
        u = index / (len(points) - 1)
        weight = scale * u**1.35
        result.append(tuple(point[axis] + displacement[axis] * weight for axis in range(3)))
    return result
