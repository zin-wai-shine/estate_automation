#!/bin/bash
set -e

# Clean any leftover X11 lock files from previous container runs
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

echo "[Browser Worker] Starting Xvfb on :99..."
Xvfb :99 -screen 0 1280x800x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for Xvfb display socket to be established
for i in $(seq 1 30); do
  if [ -e /tmp/.X11-unix/X99 ]; then
    echo "[Browser Worker] Xvfb is ready on :99"
    break
  fi
  sleep 0.1
done

echo "[Browser Worker] Starting fluxbox window manager..."
fluxbox &

echo "[Browser Worker] Starting x11vnc on port 5900..."
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -listen 0.0.0.0 &

echo "[Browser Worker] Starting websockify / noVNC on port 6080..."
websockify --web=/usr/share/novnc 6080 localhost:5900 &

echo "[Browser Worker] Starting Node.js browser_server.js on port 9223..."
exec node scripts/browser_server.js
