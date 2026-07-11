#!/usr/bin/env python3
"""Tests for deterministic groom generation and cutting."""

from __future__ import annotations

import unittest

from haircut_math import apply_displacement, cut_curve, rest_curve, scalp_fibers


class HaircutMathTests(unittest.TestCase):
    def test_scalp_generation_is_deterministic_and_on_shell(self) -> None:
        first = scalp_fibers(32)
        self.assertEqual(first, scalp_fibers(32))
        self.assertEqual(len(first), 32)
        self.assertTrue(all(fiber.root[2] > 8.35 for fiber in first))
        self.assertTrue(any(fiber.bangs for fiber in first))

    def test_rest_curve_starts_at_root_and_descends(self) -> None:
        fiber = scalp_fibers(16)[0]
        points = rest_curve(fiber, 18)
        self.assertEqual(points[0], fiber.root)
        self.assertLess(points[-1][2], points[0][2])

    def test_cut_collapses_attached_tail_and_keeps_severed_piece(self) -> None:
        points = [(0.0, 0.0, 9.0 - index) for index in range(6)]
        attached, severed, crossing = cut_curve(points, 6.5)
        self.assertEqual(crossing, 3)
        self.assertTrue(all(point[2] == 6.5 for point in attached[crossing:]))
        self.assertEqual(severed[0][2], 6.5)
        self.assertLess(severed[-1][2], 6.5)

    def test_root_is_fixed_under_guide_displacement(self) -> None:
        points = [(0.0, 0.0, float(index)) for index in range(4)]
        moved = apply_displacement(points, [(2.0, 0.0, 0.0)] * 4)
        self.assertEqual(moved[0], points[0])
        self.assertGreater(moved[-1][0], 1.0)


if __name__ == "__main__":
    unittest.main()
