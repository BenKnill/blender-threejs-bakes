from __future__ import annotations

import json
import math
import unittest
from pathlib import Path

from compile_scene import compile_layout, manifest_asset_ids
from scene_math import compose_pose, look_at_quaternion, rotate_vec, vertical_fov_deg

ROOT = Path(__file__).resolve().parents[1]


class SceneMathTests(unittest.TestCase):
    def test_parent_pose_rotates_child_translation(self) -> None:
        half_turn = math.sqrt(0.5)
        position, orientation = compose_pose(
            (1, 0, 0),
            (0, half_turn, 0, half_turn),
            (0, 0, -2),
            (0, 0, 0, 1),
        )
        self.assertAlmostEqual(position[0], -1)
        self.assertAlmostEqual(position[1], 0)
        self.assertAlmostEqual(position[2], 0)
        self.assertAlmostEqual(sum(value * value for value in orientation), 1)

    def test_physical_lens_to_vertical_fov(self) -> None:
        self.assertAlmostEqual(vertical_fov_deg(50, 36, 16 / 9), 22.8951925)

    def test_look_at_quaternion_points_local_minus_z_at_target(self) -> None:
        position = (5, 4, 6)
        target = (0, 0.8, 0)
        orientation = look_at_quaternion(position, target, (0, 1, 0))
        forward = rotate_vec(orientation, (0, 0, -1))
        expected = tuple(target[index] - position[index] for index in range(3))
        expected_length = math.sqrt(sum(value * value for value in expected))
        for actual, value in zip(forward, expected, strict=True):
            self.assertAlmostEqual(actual, value / expected_length, places=7)


class CompileTests(unittest.TestCase):
    def test_example_compiles_to_existing_layout_contract(self) -> None:
        scene = json.loads((ROOT / "scenes/example.scene.json").read_text())
        job = json.loads((ROOT / "jobs/example.render.json").read_text())
        manifest = json.loads((ROOT / "assets/manifest.json").read_text())
        layout = compile_layout(scene, job, manifest_asset_ids(manifest))

        self.assertEqual(layout["schema"], 1)
        self.assertEqual(layout["space"], "threejs_yup")
        self.assertEqual(len(layout["instances"]), 3)
        self.assertEqual(layout["camera"]["position"], [5.0, 4.0, 6.0])
        for actual, expected in zip(layout["camera"]["target"], [0, 0.8, 0], strict=True):
            self.assertAlmostEqual(actual, expected, places=7)
        self.assertAlmostEqual(layout["camera"]["fov_deg"], 22.8951925)
        self.assertEqual(layout["render"], {"width": 1920, "height": 1080, "samples": 256})
        self.assertNotIn("fps", layout)

    def test_active_camera_must_reference_camera(self) -> None:
        scene = json.loads((ROOT / "scenes/example.scene.json").read_text())
        job = json.loads((ROOT / "jobs/example.render.json").read_text())
        job["active_camera"] = "hero_plant"
        with self.assertRaisesRegex(ValueError, "is not a camera entity"):
            compile_layout(scene, job)

    def test_missing_manifest_asset_fails_before_render(self) -> None:
        scene = json.loads((ROOT / "scenes/example.scene.json").read_text())
        job = json.loads((ROOT / "jobs/example.render.json").read_text())
        with self.assertRaisesRegex(ValueError, "missing from manifest"):
            compile_layout(scene, job, {"japanese_zen_shrine_asian_temple", "medieval_prop_crate"})

    def test_authored_scale_reaches_layout(self) -> None:
        scene = json.loads((ROOT / "scenes/example.scene.json").read_text())
        job = json.loads((ROOT / "jobs/example.render.json").read_text())
        scene["entities"][1]["pose"]["scale_xyz"] = [2, 0.5, 1.25]
        layout = compile_layout(scene, job)
        self.assertEqual(layout["instances"][1]["scale"], [2, 0.5, 1.25])

    def test_non_positive_scale_is_rejected(self) -> None:
        scene = json.loads((ROOT / "scenes/example.scene.json").read_text())
        job = json.loads((ROOT / "jobs/example.render.json").read_text())
        scene["entities"][0]["pose"]["scale_xyz"] = [1, 0, 1]
        with self.assertRaisesRegex(ValueError, "scale_xyz.*positive"):
            compile_layout(scene, job)


if __name__ == "__main__":
    unittest.main()
