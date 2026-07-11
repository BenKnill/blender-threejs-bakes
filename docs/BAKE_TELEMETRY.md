# Bake telemetry

Wrap an expensive Blender, ffmpeg, or packaging stage to record its elapsed
time, sampled peak process-tree memory, exit status, and output sizes:

```sh
python3 scripts/bake_telemetry.py \
  --label "wind canopy Blender frames" \
  --receipt physics/outputs/wind-canopy-blender.telemetry.json \
  --artifact renders/wind_canopy_frames \
  -- scripts/blender.sh --background --python scripts/render_wind_canopy.py -- ...
```

Child stdout and stderr remain live. The wrapper returns the child's exit code
and writes `bake-telemetry/1` JSON on success or failure. Peak memory is sampled
from the launched process and all descendants with `ps`; it is an observational
high-water estimate, not an allocator-level measurement. Short spikes between
samples can be missed. Directories report recursive file count and byte size.

The wrapper is opt-in in this first slice. Bake scripts should give Blender,
encoding, and other materially different stages separate receipts so the slow
or memory-heavy stage stays visible.
