#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
MOTION="$ROOT/physics/labs/wind_garden/outputs/wind_garden.motion.json"
OUTPUT="$ROOT/renders/mannequin_haircut.mp4"
FRAME_DIR="$ROOT/renders/mannequin_haircut_frames"
CONTACT="$ROOT/renders/mannequin_haircut_contact.png"
RENDER_RECEIPT="$ROOT/renders/mannequin_haircut.receipt.json"
TELEMETRY_DIR="$ROOT/physics/outputs/mannequin_haircut_telemetry"

test -s "$MOTION" || bash "$ROOT/scripts/build_wind_garden.sh"
mkdir -p "$ROOT/renders" "$TELEMETRY_DIR" "$ROOT/docs/images"
rm -rf "$FRAME_DIR"
rm -f "$OUTPUT" "$CONTACT" "$RENDER_RECEIPT"

python3 "$ROOT/scripts/bake_telemetry.py" \
  --label "Mannequin haircut Blender frames" \
  --receipt "$TELEMETRY_DIR/blender.telemetry.json" \
  --artifact "$FRAME_DIR" \
  --artifact "$RENDER_RECEIPT" \
  -- "$ROOT/scripts/blender.sh" --background \
    --python "$ROOT/scripts/render_mannequin_haircut.py" -- \
    "$MOTION" --output "$OUTPUT" --fps 24 --duration 4 --fibers 1200

python3 "$ROOT/scripts/bake_telemetry.py" \
  --label "Mannequin haircut video packaging" \
  --receipt "$TELEMETRY_DIR/video.telemetry.json" \
  --artifact "$OUTPUT" \
  --artifact "$CONTACT" \
  -- "$ROOT/scripts/package_mannequin_haircut_video.sh" \
    "$FRAME_DIR" "$OUTPUT" "$CONTACT" 24

cp "$CONTACT" "$ROOT/docs/images/mannequin_haircut_preview.png"
python3 "$ROOT/scripts/package_mannequin_haircut_receipt.py" \
  --render "$RENDER_RECEIPT" \
  --blender-telemetry "$TELEMETRY_DIR/blender.telemetry.json" \
  --video-telemetry "$TELEMETRY_DIR/video.telemetry.json" \
  --output "$ROOT/docs/receipts/mannequin_haircut.telemetry.json"
test -s "$OUTPUT"
test -s "$CONTACT"
test -s "$RENDER_RECEIPT"
test -s "$ROOT/docs/receipts/mannequin_haircut.telemetry.json"
echo "animation: $OUTPUT"
echo "contact sheet: $CONTACT"
echo "telemetry: $TELEMETRY_DIR"
