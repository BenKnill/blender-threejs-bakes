"""Select only live devices belonging to the requested Cycles backend."""

import os

CYCLES_BACKENDS = ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI")


def configure_cycles_device(context) -> dict:
    """Pick a Cycles compute device.

    ``BT_CYCLES_DEVICE`` may be ``CPU``, ``GPU`` (fail if none), or ``auto``
    (default: use the first backend with a non-CPU device, else CPU). Without
    this Blender silently renders on the CPU even when a CUDA GPU is present.
    """

    requested = os.environ.get("BT_CYCLES_DEVICE", "auto").strip().upper() or "AUTO"
    if requested not in {"AUTO", "CPU", "GPU"}:
        raise ValueError("BT_CYCLES_DEVICE must be auto, CPU, or GPU")
    scene = context.scene
    scene.cycles.device = "CPU"
    result = {"requested": requested.lower(), "device": "CPU", "backend": None, "names": []}
    if requested == "CPU":
        scene.cycles.device = "CPU"
        return result
    prefs = context.preferences.addons.get("cycles")
    if prefs is None:
        if requested == "GPU":
            raise RuntimeError("BT_CYCLES_DEVICE=GPU but the Cycles add-on is unavailable")
        return result
    prefs = prefs.preferences
    for backend in CYCLES_BACKENDS:
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        devices = prefs.get_devices_for_type(backend)
        gpus = [d for d in devices if d.type == backend]
        if not gpus:
            continue
        for device in prefs.devices:
            device.use = device in gpus
        scene.cycles.device = "GPU"
        result.update({"device": "GPU", "backend": backend, "names": [d.name for d in gpus]})
        return result
    if requested == "GPU":
        raise RuntimeError("BT_CYCLES_DEVICE=GPU but Cycles found no GPU device")
    scene.cycles.device = "CPU"
    return result
