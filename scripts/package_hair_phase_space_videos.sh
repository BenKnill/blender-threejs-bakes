#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:?usage: package_hair_phase_space_videos.sh OUTPUT_ROOT}"
CAPTURE_FPS="${CAPTURE_FPS:-12}"
OUTPUT_FPS="${OUTPUT_FPS:-24}"
COLUMNS="${COLUMNS:-5}"
OUTPUT_NAME="${OUTPUT_NAME:-hair_phase_space_contact_sheet.mp4}"
KEEP_SOURCE_FRAMES="${KEEP_SOURCE_FRAMES:-0}"
RETAIN_SCENARIO="${RETAIN_SCENARIO:-}"

dirs=("$ROOT"/[0-9][0-9]_*)
if [[ ! -d "${dirs[0]}" ]]; then
  echo "no numbered scenario directories under $ROOT" >&2
  exit 2
fi
if [[ -n "$RETAIN_SCENARIO" && ! -d "$ROOT/$RETAIN_SCENARIO" ]]; then
  echo "RETAIN_SCENARIO is not a numbered scenario: $RETAIN_SCENARIO" >&2
  exit 2
fi

for dir in "${dirs[@]}"; do
  id="$(basename "$dir")"
  ffmpeg -y -hide_banner -loglevel error \
    -f image2 -c:v mjpeg -framerate "$CAPTURE_FPS" \
    -i "$dir/frame_%04d.jpg" -vf "fps=$OUTPUT_FPS" \
    -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
    "$dir/$id.mp4"
done

inputs=()
filters=""
streams=""
layout=""
for index in "${!dirs[@]}"; do
  dir="${dirs[$index]}"
  id="$(basename "$dir")"
  inputs+=( -i "$dir/$id.mp4" )
  filters+="[$index:v]scale=384:216[v$index];"
  streams+="[v$index]"
  x=$((index % COLUMNS * 384))
  y=$((index / COLUMNS * 216))
  [[ -n "$layout" ]] && layout+="|"
  layout+="${x}_${y}"
done

ffmpeg -y -hide_banner -loglevel error "${inputs[@]}" \
  -filter_complex "${filters}${streams}xstack=inputs=${#dirs[@]}:layout=${layout}[v]" \
  -map "[v]" -c:v libx264 -crf 20 -preset medium -pix_fmt yuv420p \
  "$ROOT/$OUTPUT_NAME"

for dir in "${dirs[@]}"; do
  id="$(basename "$dir")"
  if [[ "$KEEP_SOURCE_FRAMES" != "1" ]]; then
    find "$dir" -maxdepth 1 -type f \
      \( -name 'frame_*.jpg' -o -name 'frame_*.jpeg' -o -name 'frame_*.png' \) \
      -delete
  fi
  if [[ "$id" != "$RETAIN_SCENARIO" ]]; then
    rm -f "$dir/$id.mp4"
  fi
done

retained_bytes="$(du -sk "$ROOT" | awk '{print $1 * 1024}')"
retained_files="$(find "$ROOT" -type f | wc -l | tr -d ' ')"
echo "videos: $ROOT"
echo "retained: ${retained_files} files, ${retained_bytes} bytes"
if [[ "$KEEP_SOURCE_FRAMES" == "1" ]]; then
  echo "source frames: retained by KEEP_SOURCE_FRAMES=1"
else
  echo "source frames: pruned after successful encode"
fi
if [[ -n "$RETAIN_SCENARIO" ]]; then
  echo "individual clip: $RETAIN_SCENARIO"
else
  echo "individual clips: pruned; comparison retained"
fi
