#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BOX3D_SOURCE_DIR=${BOX3D_SOURCE_DIR:-/Users/boxer/box3d}
ASSEMBLY="$ROOT/recipes/seedthree_tree_assembly.json"
B3SCENE="$ROOT/physics/outputs/seedthree_tree_assembly.b3scene"
MOTION="$ROOT/physics/outputs/seedthree_tree_assembly.motion.json"
RECORDING="$ROOT/physics/outputs/seedthree_tree_assembly.b3rec"
OUTPUT_STEM="$ROOT/renders/seedthree_tree_assembly"
FRAME_DIR="${OUTPUT_STEM}_frames"
BLENDER_LOG="$ROOT/physics/outputs/seedthree_tree_assembly-blender.log"

mkdir -p "$ROOT/physics/outputs" "$ROOT/renders"

cmake -S "$ROOT/physics" -B "$ROOT/physics/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release -DBOX3D_SOURCE_DIR="$BOX3D_SOURCE_DIR"
cmake --build "$ROOT/physics/build" --parallel

python3 "$ROOT/scripts/compile_tree_assembly.py" "$ASSEMBLY" --output "$B3SCENE"
"$ROOT/physics/build/box3d_scene_runner" "$B3SCENE" "$MOTION" "$RECORDING"

rm -rf "$FRAME_DIR"
rm -f "${OUTPUT_STEM}.mp4" "${OUTPUT_STEM}.receipt.json" "${OUTPUT_STEM}_contact.png" "$BLENDER_LOG"

"$ROOT/scripts/blender.sh" --background --python "$ROOT/scripts/render_tree_assembly.py" -- \
  "$ASSEMBLY" "$MOTION" --output "${OUTPUT_STEM}.mp4" 2>&1 | tee "$BLENDER_LOG"

if rg -q "Traceback \(most recent call last\)" "$BLENDER_LOG"; then
  echo "Blender reported a Python traceback" >&2
  exit 1
fi

test -s "$FRAME_DIR/frame_0001.png"
test -s "$FRAME_DIR/frame_0097.png"
test -s "${OUTPUT_STEM}.receipt.json"
test -s "${MOTION}.events.json"

ffmpeg -y -hide_banner -loglevel error -framerate 24 \
  -i "$FRAME_DIR/frame_%04d.png" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart \
  "${OUTPUT_STEM}.mp4"

ffmpeg -y -hide_banner -loglevel error -i "${OUTPUT_STEM}.mp4" \
  -vf "select='eq(n,0)+eq(n,39)+eq(n,79)+eq(n,96)',scale=480:-1,tile=2x2" \
  -frames:v 1 "${OUTPUT_STEM}_contact.png"

test -s "${OUTPUT_STEM}.mp4"
test -s "${OUTPUT_STEM}_contact.png"
echo "animation: ${OUTPUT_STEM}.mp4"
echo "contact: ${OUTPUT_STEM}_contact.png"
echo "receipt: ${OUTPUT_STEM}.receipt.json"
echo "events: ${MOTION}.events.json"
