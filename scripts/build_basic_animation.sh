#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}
OUTPUT_STEM="$ROOT/renders/box3d_crate_drop"
FRAME_DIR="${OUTPUT_STEM}_frames"
BLENDER_LOG="$ROOT/physics/outputs/blender-motion-render.log"

mkdir -p "$ROOT/physics/outputs" "$ROOT/renders"

cmake -S "$ROOT/physics" -B "$ROOT/physics/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$ROOT/physics/build" --parallel

python3 "$ROOT/scripts/validate_scene.py" "$ROOT/scenes/basic_crate_drop.scene.json"
python3 "$ROOT/scripts/compile_scene.py" \
  "$ROOT/scenes/basic_crate_drop.scene.json" \
  "$ROOT/jobs/basic_crate.render.json" \
  --output "$ROOT/physics/outputs/basic_crate.layout.json"
python3 "$ROOT/scripts/compile_physics.py" \
  "$ROOT/scenes/basic_crate_drop.scene.json" \
  "$ROOT/jobs/basic_crate.simulation.json" \
  "$ROOT/jobs/basic_crate.render.json" \
  --output "$ROOT/physics/outputs/basic_crate.b3scene"

"$ROOT/physics/build/box3d_scene_runner" \
  "$ROOT/physics/outputs/basic_crate.b3scene" \
  "$ROOT/physics/outputs/basic_crate.motion.json" \
  "$ROOT/physics/outputs/basic_crate.b3rec"

# These are generated, gitignored outputs with fixed names. Clear them so a
# Blender traceback cannot be hidden by artifacts from an earlier successful run.
rm -rf "$FRAME_DIR"
rm -f "${OUTPUT_STEM}.mp4" "${OUTPUT_STEM}.receipt.json" "$BLENDER_LOG"

"$ROOT/scripts/blender.sh" --background --python "$ROOT/scripts/render_motion.py" -- \
  "$ROOT/physics/outputs/basic_crate.layout.json" \
  "$ROOT/physics/outputs/basic_crate.motion.json" \
  "$ROOT/scenes/basic_crate_drop.scene.json" \
  --output "${OUTPUT_STEM}.mp4" 2>&1 | tee "$BLENDER_LOG"

if rg -q "Traceback \(most recent call last\)" "$BLENDER_LOG"; then
  echo "Blender reported a Python traceback" >&2
  exit 1
fi

test -s "$FRAME_DIR/frame_0001.png"
test -s "$FRAME_DIR/frame_0097.png"
test -s "${OUTPUT_STEM}.receipt.json"
test -s "$ROOT/physics/outputs/basic_crate.motion.json.events.json"

ffmpeg -y -hide_banner -loglevel error -framerate 24 \
  -i "$FRAME_DIR/frame_%04d.png" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart \
  "${OUTPUT_STEM}.mp4"

test -s "${OUTPUT_STEM}.mp4"
echo "animation: ${OUTPUT_STEM}.mp4"
echo "receipt: ${OUTPUT_STEM}.receipt.json"
echo "events: $ROOT/physics/outputs/basic_crate.motion.json.events.json"
