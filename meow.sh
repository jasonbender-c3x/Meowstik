#!/bin/bash

# ==========================================
# MEOWSTIK STARTUP SCRIPT (Project Meow)
# ==========================================

set -euo pipefail

LOG_DIR="/home/runner/logs"
PORT=5000
FRONTEND_PORT=5173

mkdir -p "$LOG_DIR"

echo "🐱 MEOW: Waking up Meowstik..."

# 1. Kill any existing processes on port 5000 (Backend) and 5173 (Frontend)
echo "🧹 MEOW: Clearing ports..."
fuser -k -n tcp "$PORT" 2>/dev/null || true
fuser -k -n tcp "$FRONTEND_PORT" 2>/dev/null || true
# Force kill any lingering node processes related to server
pkill -f "tsx server/index.ts" 2>/dev/null || true

# 2. Check for Screen Recording (ffmpeg)
if pgrep -x "ffmpeg" > /dev/null; then
    echo "🎥 MEOW: Screen recording is already active."
else
    echo "🎥 MEOW: Starting screen recording..."
    nohup ffmpeg -f x11grab -i :99 -r 15 -s 1920x1080 "$LOG_DIR/meowstik_recording_$(date +%s).mp4" > "$LOG_DIR/recorder.log" 2>&1 &
fi

# 3. Check for Chrome (Debug Enabled) and open Meowstik
CHROME_URL="http://localhost:$PORT"
if pgrep -f "google-chrome.*remote-debugging-port=9222" > /dev/null; then
    echo "🌐 MEOW: Debug-enabled Chrome is already running."
else
    echo "🌐 MEOW: Starting Chrome with remote debugging..."
    nohup google-chrome \
        --remote-debugging-port=9222 \
        --no-first-run \
        --no-default-browser-check \
        --no-sandbox \
        --disable-setuid-sandbox \
        --user-data-dir=/tmp/chrome-debug \
        --new-window "$CHROME_URL" \
        > "$LOG_DIR/chrome.log" 2>&1 &
fi

# 4. Start the Server
echo "🚀 MEOW: Launching Meowstik Core..."
NODE_OPTIONS="--max-old-space-size=2048" PORT="$PORT" pnpm run dev 2>&1 | tee -a "$LOG_DIR/server.log"
