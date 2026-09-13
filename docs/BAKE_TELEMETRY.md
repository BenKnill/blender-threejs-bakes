# Bake jobs and live telemetry

Long Blender, browser-capture, ffmpeg, and packaging stages should run as
observable jobs. The wrapper writes a live receipt while the command runs and a
final receipt on success, failure, or interruption.

Launch a job without holding the calling terminal:

```sh
python3 scripts/bake_telemetry.py --background \
  --label "rescue ship hero render" \
  --receipt renders/rescue_ship/hero.telemetry.json \
  --log renders/rescue_ship/hero.log \
  --artifact renders/rescue_ship/hero.png \
  -- scripts/blender.sh --background --python scripts/render_parametric_rescue_ship.py -- \
    --output renders/rescue_ship/hero.png
```

Inspect it at any time without attaching to the child process:

```sh
python3 scripts/bake_telemetry.py \
  --status renders/rescue_ship/hero.telemetry.json
```

The live `bake-telemetry/2` receipt includes `status`, `pid`, `started_at`,
`updated_at`, `elapsed_seconds`, sampled process-tree RSS, log path, command,
and declared artifact presence. `--status` also computes
`live_elapsed_seconds` from the observation time, so elapsed time remains useful
even if a child has stopped updating unexpectedly.

On completion the same receipt records `succeeded`, `failed`, or `interrupted`,
the exit code, final wall time, sampled peak process-tree memory, and recursive
artifact byte/file counts. Peak memory remains an observational high-water
estimate sampled through `ps`; short spikes between samples can be missed.

Omit `--background` when live child output in the current terminal is useful.
The receipt is still updated while the job runs. Model-specific launchers should
use the background form by default and provide an explicit foreground/debug
override.
