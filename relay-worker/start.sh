#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
mkdir -p "${USER_DATA_DIR:-/data/chrome-profile}" /tmp/relay

Xvfb "$DISPLAY" -screen 0 1280x800x24 -ac +extension GLX +render -noreset >/tmp/relay/xvfb.log 2>&1 &
XVFB_PID=$!

for _ in $(seq 1 50); do
  if xdpyinfo -display "$DISPLAY" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

fluxbox >/tmp/relay/fluxbox.log 2>&1 &

if [[ -n "${VNC_PASSWORD:-}" ]]; then
  x11vnc -storepasswd "$VNC_PASSWORD" /root/.vnc/passwd >/dev/null
  x11vnc -display "$DISPLAY" -forever -shared -rfbauth /root/.vnc/passwd -rfbport 5900 >/tmp/relay/x11vnc.log 2>&1 &
  websockify --web=/usr/share/novnc/ 6080 localhost:5900 >/tmp/relay/novnc.log 2>&1 &
  echo "[relay-start] noVNC enabled on port 6080"
else
  echo "[relay-start] noVNC disabled; set VNC_PASSWORD to enable manual verification UI"
fi

cleanup() {
  kill "$XVFB_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

exec node src/worker.js
