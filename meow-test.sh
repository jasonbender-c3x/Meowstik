#!/bin/bash

# ==========================================
# MEOWSTIK TEST STARTUP SCRIPT
# ==========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCREEN_RECORD_HELPER="${SCRIPT_DIR}/scripts/screen-record.sh"
SCREEN_RECORD_HELPER_LOADED=0
if [ -r "$SCREEN_RECORD_HELPER" ]; then
    # shellcheck source=/dev/null
    source "$SCREEN_RECORD_HELPER"
    SCREEN_RECORD_HELPER_LOADED=1
else
    echo "⚠️  Screen recording helper missing at $SCREEN_RECORD_HELPER"
fi

echo "🐱 MEOW-TEST: Waking up Meowstik..."

# 1. Kill any existing processes on port 5000 (Backend) and 5173 (Frontend)
echo "🧹 MEOW-TEST: Clearing ports 5000 and 5173..."
fuser -k -n tcp 5000 2>/dev/null || true
fuser -k -n tcp 5173 2>/dev/null || true
# Force kill any lingering node processes related to server
pkill -f "tsx server/index.ts" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# 2. Kill zombie processes
echo "🧟 MEOW-TEST: Hunting zombie processes..."
ZOMBIES=$(ps -ef | grep defunct | grep -v grep | awk '{print $2}')
if [ -n "$ZOMBIES" ]; then
    echo "Killing zombies: $ZOMBIES"
    echo "$ZOMBIES" | xargs kill -9 2>/dev/null || true
else
    echo "No zombies found."
fi

# 3. Check for Screen Recording (ffmpeg)
LOG_DIR="/home/runner/logs"
mkdir -p "$LOG_DIR"
RECORD_DIR="${MEOW_RECORD_DIR:-/mnt/scrnrec}"
if [ ! -d "$RECORD_DIR" ]; then
    RECORD_DIR="$LOG_DIR"
fi

if pgrep -x "ffmpeg" > /dev/null; then
    echo "🎥 MEOW-TEST: Screen recording is already active."
elif [ "$SCREEN_RECORD_HELPER_LOADED" -eq 1 ]; then
    start_screen_recording "${DISPLAY:-:0}" "$RECORD_DIR" "$LOG_DIR"
else
    echo "🎥 MEOW-TEST: Screen recording helper unavailable; skipping."
fi

# 4. Check for Chrome (Debug Enabled)
if pgrep -f "google-chrome.*remote-debugging-port" > /dev/null; then
    echo "🌐 MEOW-TEST: Debug-enabled Chrome is already running."
else
    echo "🌐 MEOW-TEST: Starting Chrome with remote debugging..."
    nohup google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=/tmp/chrome-debug --display=:0 > /dev/null 2>&1 &
fi

# 5. Open a tail on display :0 if xterm is available (optional/best effort)
if command -v xterm > /dev/null; then
    echo "📟 MEOW-TEST: Opening log tail on display :0..."
    nohup xterm -display :0 -title "Meowstik Server Logs" -e "tail -f /home/runner/logs/server.log" > /dev/null 2>&1 &
fi

# 6. Start the Server
echo "🚀 MEOW-TEST: Launching Meowstik Core..."
echo "📊 Logs will be saved to $LOG_DIR/server.log"

pnpm run dev 2>&1 | tee "$LOG_DIR/server.log"
