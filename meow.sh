#!/bin/bash

# ==========================================
# MEOWSTIK STARTUP SCRIPT (Project Meow)
# ==========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="/home/runner/logs"
PORT=5000
FRONTEND_PORT=5173

# Screen recording helper (optional).
SCREEN_RECORD_HELPER="${SCRIPT_DIR}/scripts/screen-record.sh"
SCREEN_RECORD_HELPER_LOADED=0
if [ -r "$SCREEN_RECORD_HELPER" ]; then
    # shellcheck source=/dev/null
    source "$SCREEN_RECORD_HELPER"
    SCREEN_RECORD_HELPER_LOADED=1
else
    echo "⚠️  Screen recording helper missing at $SCREEN_RECORD_HELPER"
fi

mkdir -p "$LOG_DIR"

echo "🐱 MEOW: Waking up Meowstik..."

# 1. Kill any existing processes on port 5000 (Backend) and 5173 (Frontend)
echo "🧹 MEOW: Clearing ports..."
fuser -k -n tcp "$PORT" 2>/dev/null || true
fuser -k -n tcp "$FRONTEND_PORT" 2>/dev/null || true
# Force kill any lingering node processes related to server
pkill -f "tsx server/index.ts" 2>/dev/null || true

# 2. Check for Screen Recording (ffmpeg)
RECORD_DISPLAY="${DISPLAY:-:0}"
RECORD_OUTPUT_DIR="${MEOW_RECORD_DIR:-/mnt/scrnrec}"
if [ ! -d "$RECORD_OUTPUT_DIR" ] || ! touch "$RECORD_OUTPUT_DIR/.meowstik-write-test" >/dev/null 2>&1; then
    RECORD_OUTPUT_DIR="$LOG_DIR"
else
    rm -f "$RECORD_OUTPUT_DIR/.meowstik-write-test" >/dev/null 2>&1
fi

if pgrep -x "ffmpeg" > /dev/null; then
    echo "🎥 MEOW: Screen recording is already active."
elif [ "$SCREEN_RECORD_HELPER_LOADED" -eq 1 ]; then
    start_screen_recording "$RECORD_DISPLAY" "$RECORD_OUTPUT_DIR" "$LOG_DIR"
else
    echo "🎥 MEOW: Screen recording helper unavailable; skipping."
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

# 4. Open a log terminal window (larger font)
if command -v qterminal >/dev/null 2>&1; then
    echo "📟 MEOW: Opening qterminal for server logs..."
    nohup qterminal \
        --title "Meowstik Server Logs" \
        --font "Monospace,14" \
        --profile "MeowLogs" \
        -e "tail -f $LOG_DIR/server.log" \
        > /dev/null 2>&1 &
elif command -v xterm >/dev/null 2>&1; then
    echo "📟 MEOW: Opening xterm for server logs..."
    nohup xterm \
        -T "Meowstik Server Logs" \
        -fa "Monospace" \
        -fs 14 \
        -e "tail -f $LOG_DIR/server.log" \
        > /dev/null 2>&1 &
else
    echo "📟 MEOW: No supported terminal (qterminal/xterm) found for logs."
fi

# 4. Start the Server
echo "🚀 MEOW: Launching Meowstik Core..."
NODE_OPTIONS="--max-old-space-size=2048" PORT="$PORT" pnpm run dev 2>&1 | tee -a "$LOG_DIR/server.log"
