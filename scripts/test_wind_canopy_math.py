#!/usr/bin/env python3
"""Tests for wind-canopy guide interpolation."""

from __future__ import annotations

import unittest

from wind_canopy_math import (
    blend_polylines,
    nearest_weights,
    resample_polyline,
    weighted_displacement,
)


class WindCanopyMathTests(unittest.TestCase):
    def test_resample_polyline_uses_arc_length(self) -> None:
        result = resample_polyline([(0, 0, 0), (1, 0, 0), (1, 3, 0)], 5)
        self.assertEqual(result[0], (0.0, 0.0, 0.0))
        self.assertEqual(result[1], (1.0, 0.0, 0.0))
        self.assertEqual(result[-1], (1.0, 3.0, 0.0))

    def test_blend_polylines_preserves_endpoints_at_limits(self) -> None:
        left = [(0, 0, 0), (0, 1, 0)]
        right = [(2, 0, 0), (2, 1, 0)]
        self.assertEqual(blend_polylines(left, right, 0), left)
        self.assertEqual(blend_polylines(left, right, 1), right)
        self.assertEqual(blend_polylines(left, right, 0.5)[0], (1.0, 0.0, 0.0))

    def test_nearest_weight_exact_match_is_single_guide(self) -> None:
        self.assertEqual(nearest_weights((1, 0, 0), [(0, 0, 0), (1, 0, 0)]), [(1, 1.0)])

    def test_weighted_displacement_is_partition_of_unity(self) -> None:
        displacement = weighted_displacement([(0, 0.25), (1, 0.75)], [(4, 0, 0), (0, 4, 0)])
        self.assertEqual(displacement, (1.0, 3.0, 0.0))


if __name__ == "__main__":
    unittest.main()
