#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BLENDER_BIN:-}" ]; then
  if command -v blender >/dev/null 2>&1; then
    BLENDER_BIN="$(command -v blender)"
  elif [ -x "$HOME/.local/bin/blender" ]; then
    BLENDER_BIN="$HOME/.local/bin/blender"
  else
    BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"
  fi
fi
exec "$BLENDER_BIN" "$@"
