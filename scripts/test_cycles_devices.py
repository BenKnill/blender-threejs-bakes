#!/usr/bin/env python3
"""GPU selection must ignore devices cached for other or unavailable backends."""

from __future__ import annotations

import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from btlib.cycles_devices import configure_cycles_device


class CyclesDeviceTests(unittest.TestCase):
    def context(self, available):
        cpu = SimpleNamespace(type="CPU", name="CPU", use=True)
        stale = SimpleNamespace(type="OPTIX", name="removed GPU", use=True)
        cuda = SimpleNamespace(type="CUDA", name="CUDA GPU", use=False)
        prefs = SimpleNamespace(
            devices=[cpu, stale, cuda],
            get_devices_for_type=lambda backend: [cuda, cpu] if backend == available else [],
        )
        return SimpleNamespace(
            scene=SimpleNamespace(cycles=SimpleNamespace(device="GPU")),
            preferences=SimpleNamespace(addons={"cycles": SimpleNamespace(preferences=prefs)}),
        )

    def test_auto_skips_unavailable_optix_even_with_cached_devices(self):
        context = self.context("CUDA")
        with patch.dict(os.environ, {"BT_CYCLES_DEVICE": "auto"}):
            result = configure_cycles_device(context)
        self.assertEqual(result["backend"], "CUDA")
        self.assertEqual(result["names"], ["CUDA GPU"])
        self.assertEqual(context.scene.cycles.device, "GPU")
        devices = context.preferences.addons["cycles"].preferences.devices
        self.assertEqual([device.use for device in devices], [False, False, True])

    def test_auto_without_live_gpu_uses_cpu(self):
        context = self.context(None)
        with patch.dict(os.environ, {"BT_CYCLES_DEVICE": "auto"}):
            self.assertEqual(configure_cycles_device(context)["device"], "CPU")
        self.assertEqual(context.scene.cycles.device, "CPU")

    def test_gpu_without_live_gpu_fails(self):
        with (
            patch.dict(os.environ, {"BT_CYCLES_DEVICE": "GPU"}),
            self.assertRaisesRegex(RuntimeError, "found no GPU"),
        ):
            configure_cycles_device(self.context(None))

    def test_cpu_does_not_probe_drivers(self):
        context = self.context("CUDA")
        context.preferences.addons["cycles"].preferences.get_devices_for_type = lambda backend: (
            self.fail("CPU must not probe GPU drivers")
        )
        with patch.dict(os.environ, {"BT_CYCLES_DEVICE": "CPU"}):
            self.assertEqual(configure_cycles_device(context)["device"], "CPU")

    def test_invalid_request_fails(self):
        with (
            patch.dict(os.environ, {"BT_CYCLES_DEVICE": "typo"}),
            self.assertRaises(ValueError),
        ):
            configure_cycles_device(self.context("CUDA"))


if __name__ == "__main__":
    unittest.main()
