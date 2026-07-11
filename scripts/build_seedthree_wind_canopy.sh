#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MOTION="$ROOT/physics/labs/wind_garden/outputs/wind_garden.motion.json"
OUTPUT="$ROOT/renders/seedthree_wind_canopy.mp4"
FRAME_DIR="$ROOT/renders/seedthree_wind_canopy_frames"
CONTACT="$ROOT/renders/seedthree_wind_canopy_contact.png"
RENDER_RECEIPT="$ROOT/renders/seedthree_wind_canopy.receipt.json"
TELEMETRY_DIR="$ROOT/physics/outputs/seedthree_wind_canopy_telemetry"

test -s "$MOTION" || bash "$ROOT/scripts/build_wind_garden.sh"
mkdir -p "$ROOT/renders" "$TELEMETRY_DIR" "$ROOT/docs/images"
rm -rf "$FRAME_DIR"
rm -f "$OUTPUT" "$CONTACT" "$RENDER_RECEIPT"

python3 "$ROOT/scripts/bake_telemetry.py" \
  --label "SeedThree wind canopy Blender frames" \
  --receipt "$TELEMETRY_DIR/blender.telemetry.json" \
  --artifact "$FRAME_DIR" \
  --artifact "$RENDER_RECEIPT" \
  -- "$ROOT/scripts/blender.sh" --background \
    --python "$ROOT/scripts/render_seedthree_wind_canopy.py" -- \
    "$MOTION" --output "$OUTPUT" --fps 24 --duration 4 --fibers-per-gap 21

python3 "$ROOT/scripts/bake_telemetry.py" \
  --label "SeedThree wind canopy video packaging" \
  --receipt "$TELEMETRY_DIR/video.telemetry.json" \
  --artifact "$OUTPUT" \
  --artifact "$CONTACT" \
  -- "$ROOT/scripts/package_seedthree_wind_video.sh" \
    "$FRAME_DIR" "$OUTPUT" "$CONTACT" 24

cp "$CONTACT" "$ROOT/docs/images/seedthree_wind_canopy_preview.png"
python3 "$ROOT/scripts/package_seedthree_wind_receipt.py" \
  --render "$RENDER_RECEIPT" \
  --blender-telemetry "$TELEMETRY_DIR/blender.telemetry.json" \
  --video-telemetry "$TELEMETRY_DIR/video.telemetry.json" \
  --output "$ROOT/docs/receipts/seedthree_wind_canopy.telemetry.json"
test -s "$OUTPUT"
test -s "$CONTACT"
test -s "$RENDER_RECEIPT"
test -s "$TELEMETRY_DIR/blender.telemetry.json"
test -s "$TELEMETRY_DIR/video.telemetry.json"
test -s "$ROOT/docs/receipts/seedthree_wind_canopy.telemetry.json"
echo "animation: $OUTPUT"
echo "contact sheet: $CONTACT"
echo "render telemetry: $TELEMETRY_DIR/blender.telemetry.json"
echo "video telemetry: $TELEMETRY_DIR/video.telemetry.json"
