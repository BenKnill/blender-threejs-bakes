from __future__ import annotations

import json
import unittest
from pathlib import Path

from compile_tree_assembly import compile_spec

ROOT = Path(__file__).resolve().parents[1]


class TreeAssemblyCompileTests(unittest.TestCase):
    def test_native_recipe_emits_full_joint_frames_and_impulse(self) -> None:
        spec = json.loads((ROOT / "recipes/seedthree_tree_assembly.json").read_text())
        lines = compile_spec(spec).splitlines()
        self.assertEqual(lines[0], "B3SCENE 3")
        joint = next(line for line in lines if line.startswith("joint root_hinge "))
        self.assertEqual(len(joint.split()), 31)
        self.assertEqual(joint.split()[-4:], ["30000.0", "0.0", "1", "0"])

    def test_native_recipe_rejects_non_normalized_frame_quaternion(self) -> None:
        spec = json.loads((ROOT / "recipes/seedthree_tree_assembly.json").read_text())
        spec["joints"][0]["frame_a_quaternion"] = [0, 0, 0, 2]
        with self.assertRaisesRegex(ValueError, "normalized"):
            compile_spec(spec)

    def test_native_recipe_rejects_separated_world_anchors(self) -> None:
        spec = json.loads((ROOT / "recipes/seedthree_tree_assembly.json").read_text())
        spec["joints"][0]["anchor_b"] = [0.0, -2.5, 0.0]
        with self.assertRaisesRegex(ValueError, "anchor separation"):
            compile_spec(spec)

    def test_native_recipe_rejects_misaligned_world_axes(self) -> None:
        spec = json.loads((ROOT / "recipes/seedthree_tree_assembly.json").read_text())
        root_half = 2**-0.5
        spec["joints"][0]["frame_a_quaternion"] = [root_half, 0.0, 0.0, root_half]
        with self.assertRaisesRegex(ValueError, "axis misalignment"):
            compile_spec(spec)

    def test_legacy_recipe_still_emits_velocity_release_v2(self) -> None:
        spec = json.loads((ROOT / "recipes/seedthree_tree_assembly.json").read_text())
        spec["schema"] = "tree-assembly/1"
        for body in spec["bodies"]:
            body["dynamic"] = body.pop("body_type") == "dynamic"
        for joint in spec["joints"]:
            joint["release_angular_velocity"] = joint.pop(
                "release_angular_impulse", [0.0, 0.0, 0.0]
            )
            joint.pop("target_angle", None)
            joint.pop("enable_limit", None)
            joint.pop("collide_connected", None)
        lines = compile_spec(spec).splitlines()
        self.assertEqual(lines[0], "B3SCENE 2")
        self.assertEqual(
            len(next(line for line in lines if line.startswith("joint root_hinge ")).split()), 20
        )


if __name__ == "__main__":
    unittest.main()
