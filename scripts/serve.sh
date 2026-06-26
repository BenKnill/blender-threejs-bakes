#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8091}"
HOST="127.0.0.1"
RUN_DIR=".run"
PID_FILE="$RUN_DIR/editor-server-$PORT.pid"
LOG_FILE="$RUN_DIR/editor-server-$PORT.log"
URL="http://$HOST:$PORT/editor/"
HEALTH_URL="http://$HOST:$PORT/api/health"
ROOT="$(pwd)"
LABEL="local.blender-threejs-bakes.editor.$PORT"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3)}"

mkdir -p "$RUN_DIR"

health_ok() {
  curl -fsS "$HEALTH_URL" >/dev/null 2>&1
}

listener_pids() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

stop_server() {
  if [[ "$(uname -s)" == "Darwin" && -f "$PLIST" ]]; then
    launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || true
  fi

  local stopped=0
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(<"$PID_FILE")"
    if pid_alive "$pid"; then
      kill "$pid" 2>/dev/null || true
      stopped=1
    fi
    rm -f "$PID_FILE"
  fi

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" 2>/dev/null || true
    stopped=1
  done < <(listener_pids)

  if [[ "$stopped" -eq 1 ]]; then
    sleep 0.3
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      kill -9 "$pid" 2>/dev/null || true
    done < <(listener_pids)
  fi
}

start_server() {
  if health_ok; then
    echo "Editor already healthy: $URL"
    return
  fi

  local existing
  existing="$(listener_pids)"
  if [[ -n "$existing" ]]; then
    echo "Replacing stale listener on port $PORT"
    stop_server
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    start_launch_agent
    return
  fi

  : >"$LOG_FILE"
  nohup python3 scripts/editor_server.py --port "$PORT" >>"$LOG_FILE" 2>&1 &
  local pid="$!"
  echo "$pid" >"$PID_FILE"

  for _ in {1..50}; do
    if health_ok; then
      echo "Editor running: $URL"
      echo "PID: $pid"
      echo "Log: $LOG_FILE"
      return
    fi
    sleep 0.1
  done

  echo "Editor failed to become healthy. Log follows:" >&2
  tail -80 "$LOG_FILE" >&2 || true
  exit 1
}

start_launch_agent() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$ROOT/scripts/editor_server.py</string>
    <string>--port</string>
    <string>$PORT</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$ROOT/$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/$LOG_FILE</string>
</dict>
</plist>
PLIST

  launchctl bootout "$DOMAIN" "$PLIST" >/dev/null 2>&1 || true
  launchctl bootstrap "$DOMAIN" "$PLIST"
  launchctl kickstart -k "$DOMAIN/$LABEL" >/dev/null 2>&1 || true

  for _ in {1..50}; do
    if health_ok; then
      local pid
      pid="$(listener_pids | head -1)"
      if [[ -n "$pid" ]]; then echo "$pid" >"$PID_FILE"; fi
      echo "Editor running: $URL"
      if [[ -n "$pid" ]]; then echo "PID: $pid"; fi
      echo "Log: $LOG_FILE"
      echo "LaunchAgent: $PLIST"
      return
    fi
    sleep 0.1
  done

  echo "Editor failed to become healthy. Log follows:" >&2
  tail -80 "$LOG_FILE" >&2 || true
  exit 1
}

status_server() {
  if health_ok; then
    echo "healthy: $URL"
    if [[ -f "$PID_FILE" ]]; then echo "pid: $(<"$PID_FILE")"; fi
    if [[ "$(uname -s)" == "Darwin" && -f "$PLIST" ]]; then echo "launchagent: $PLIST"; fi
    return
  fi

  local existing
  existing="$(listener_pids)"
  if [[ -n "$existing" ]]; then
    echo "stale listener on port $PORT: $existing"
    return 1
  fi

  echo "stopped: $URL"
  return 1
}

case "${1:-start}" in
  start)
    start_server
    ;;
  stop)
    stop_server
    echo "Editor stopped: $URL"
    ;;
  restart|wake)
    stop_server
    start_server
    ;;
  status)
    status_server
    ;;
  foreground)
    stop_server
    python3 scripts/editor_server.py --port "$PORT"
    ;;
  *)
    echo "Usage: PORT=$PORT $0 [start|stop|restart|wake|status|foreground]" >&2
    exit 2
    ;;
esac
