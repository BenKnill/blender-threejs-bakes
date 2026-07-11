from __future__ import annotations

import json
import unittest
from pathlib import Path

from compile_physics import compile_runner_input, three_dimensions

ROOT = Path(__file__).resolve().parents[1]


def load(path: str) -> dict:
    return json.loads((ROOT / path).read_text())


class PhysicsCompileTests(unittest.TestCase):
    def test_basic_crate_scene_compiles_at_five_steps_per_frame(self) -> None:
        text = compile_runner_input(
            load("scenes/basic_crate_drop.scene.json"),
            load("jobs/basic_crate.simulation.json"),
            load("jobs/basic_crate.render.json"),
            load("assets/manifest.json"),
        )
        lines = text.splitlines()
        self.assertEqual(lines[0], "B3SCENE 5")
        world = lines[1].split()
        self.assertEqual(world[0], "world")
        self.assertEqual(int(world[7]), 5)
        self.assertEqual(int(world[12]), 3)
        self.assertEqual(int(world[13]), 0)
        self.assertEqual(len([line for line in lines if line.startswith("body ")]), 3)
        self.assertEqual(len(next(line for line in lines if line.startswith("body ")).split()), 38)

    def test_z_up_manifest_bounds_are_reordered_to_three_space(self) -> None:
        asset = {"id": "crate", "bbox": [1, 2, 3], "up_axis": "Z"}
        self.assertEqual(three_dimensions(asset), [1, 3, 2])

    def test_render_sample_interval_must_divide_fixed_step(self) -> None:
        render_job = load("jobs/basic_crate.render.json")
        render_job["fps"] = 25
        with self.assertRaisesRegex(ValueError, "integer ratio"):
            compile_runner_input(
                load("scenes/basic_crate_drop.scene.json"),
                load("jobs/basic_crate.simulation.json"),
                render_job,
                load("assets/manifest.json"),
            )

    def test_authored_scale_sizes_first_pass_box_collider(self) -> None:
        scene = load("scenes/basic_crate_drop.scene.json")
        scene["entities"][0]["pose"]["scale_xyz"] = [2, 0.5, 1.25]
        text = compile_runner_input(
            scene,
            load("jobs/basic_crate.simulation.json"),
            load("jobs/basic_crate.render.json"),
            load("assets/manifest.json"),
        )
        body = next(line for line in text.splitlines() if line.startswith("body crate_left "))
        fields = body.split()
        for actual, expected in zip(
            [float(fields[index]) for index in (3, 4, 5)], [1.0836, 0.2649, 0.67725], strict=True
        ):
            self.assertAlmostEqual(actual, expected, places=6)

    def test_kinematic_body_is_rejected_instead_of_silently_becoming_static(self) -> None:
        scene = load("scenes/basic_crate_drop.scene.json")
        scene["entities"][0]["physics"]["body_type"] = "kinematic"
        with self.assertRaisesRegex(ValueError, "kinematic bodies"):
            compile_runner_input(
                scene,
                load("jobs/basic_crate.simulation.json"),
                load("jobs/basic_crate.render.json"),
                load("assets/manifest.json"),
            )

    def test_dynamic_body_requires_positive_density(self) -> None:
        scene = load("scenes/basic_crate_drop.scene.json")
        del scene["entities"][0]["physics"]["density_kg_m3"]
        with self.assertRaisesRegex(ValueError, "density_kg_m3.*positive"):
            compile_runner_input(
                scene,
                load("jobs/basic_crate.simulation.json"),
                load("jobs/basic_crate.render.json"),
                load("assets/manifest.json"),
            )

    def test_native_body_options_are_serialized(self) -> None:
        scene = load("scenes/basic_crate_drop.scene.json")
        scene["entities"][0]["physics"].update(
            {
                "linear_damping": 0.25,
                "angular_damping": 0.5,
                "gravity_scale": 0.75,
                "sleep_threshold_m_s": 0.02,
                "enable_sleep": False,
                "is_awake": False,
                "is_bullet": True,
                "is_enabled": True,
                "allow_fast_rotation": True,
                "enable_contact_recycling": False,
                "motion_locks": {"linear_y": True, "angular_z": True},
            }
        )
        body = next(
            line
            for line in compile_runner_input(
                scene,
                load("jobs/basic_crate.simulation.json"),
                load("jobs/basic_crate.render.json"),
                load("assets/manifest.json"),
            ).splitlines()
            if line.startswith("body crate_left ")
        )
        fields = body.split()
        self.assertEqual(
            [float(fields[index]) for index in (22, 23, 24, 25)], [0.25, 0.5, 0.75, 0.02]
        )
        self.assertEqual(
            [int(fields[index]) for index in range(26, 38)], [0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1]
        )

    def test_native_world_options_are_serialized(self) -> None:
        simulation = load("jobs/basic_crate.simulation.json")
        simulation.update(
            {
                "restitution_threshold_m_s": 0.5,
                "hit_event_threshold_m_s": 2.0,
                "contact_hertz": 45.0,
                "contact_damping_ratio": 4.0,
                "contact_speed_m_s": 5.0,
                "maximum_linear_speed_m_s": 120.0,
                "enable_sleep": False,
                "enable_continuous": False,
            }
        )
        world = (
            compile_runner_input(
                load("scenes/basic_crate_drop.scene.json"),
                simulation,
                load("jobs/basic_crate.render.json"),
                load("assets/manifest.json"),
            )
            .splitlines()[1]
            .split()
        )
        self.assertEqual(
            [float(world[index]) for index in range(14, 20)],
            [0.5, 2.0, 45.0, 4.0, 5.0, 120.0],
        )
        self.assertEqual([int(world[index]) for index in (20, 21)], [0, 0])


if __name__ == "__main__":
    unittest.main()
