#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_ROOT="${OUTPUT_ROOT:-$ROOT/renders/parametric_rescue_ship}"
RECEIPT="$OUTPUT_ROOT/job.telemetry.json"
LOG="$OUTPUT_ROOT/job.log"
MODE="${1:-start}"

mkdir -p "$OUTPUT_ROOT"

run_job() {
  local background_flag=()
  if [[ "$1" == "background" ]]; then
    background_flag=(--background)
  fi
  python3 "$ROOT/scripts/bake_telemetry.py" \
    "${background_flag[@]}" \
    --label "parametric rescue ship conditioning renders" \
    --receipt "$RECEIPT" \
    --log "$LOG" \
    --artifact "$OUTPUT_ROOT" \
    -- "$ROOT/scripts/blender.sh" --background \
      --python "$ROOT/scripts/render_parametric_rescue_ship.py" -- \
      --output-dir "$OUTPUT_ROOT" --views hero,side,top
}

case "$MODE" in
  start|background)
    run_job background
    echo "Status: python3 scripts/bake_telemetry.py --status $RECEIPT"
    ;;
  foreground)
    run_job foreground
    ;;
  status)
    python3 "$ROOT/scripts/bake_telemetry.py" --status "$RECEIPT"
    ;;
  log)
    tail -80 "$LOG"
    ;;
  *)
    echo "Usage: $0 [start|background|foreground|status|log]" >&2
    exit 2
    ;;
esac
