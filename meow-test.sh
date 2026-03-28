#!/bin/bash

# ==========================================
# MEOWSTIK TEST STARTUP SCRIPT
# ==========================================

echo "🐱 MEOW-TEST: Waking up Meowstik..."

# 1. Kill any existing processes on port 5000 (Backend) and 5173 (Frontend)
echo "🧹 MEOW-TEST: Clearing ports 5000 and 5173..."
fuser -k -n tcp 5000 2>/dev/null
fuser -k -n tcp 5173 2>/dev/null
# Force kill any lingering node processes related to server
pkill -f "tsx server/index.ts" 2>/dev/null
pkill -f "vite" 2>/dev/null

# 2. Kill zombie processes
echo "🧟 MEOW-TEST: Hunting zombie processes..."
ZOMBIES=$(ps -ef | grep defunct | grep -v grep | awk '{print $2}')
if [ ! -z "$ZOMBIES" ]; then
    echo "Killing zombies: $ZOMBIES"
    echo "$ZOMBIES" | xargs kill -9 2>/dev/null
else
    echo "No zombies found."
fi

# 3. Check for Screen Recording (ffmpeg)
# We'll try to record to /home/runner/logs/ if /mnt/scrnrec is unavailable
RECORD_DIR="/home/runner/logs"
mkdir -p "$RECORD_DIR"

if pgrep -x "ffmpeg" > /dev/null; then
    echo "🎥 MEOW-TEST: Screen recording is already active."
else
    echo "🎥 MEOW-TEST: Starting screen recording on display :0..."
    # We use a slightly more robust ffmpeg command.
    # We'll save it to the logs directory.
    nohup ffmpeg -f x11grab -video_size 1920x1200 -i :0 -r 15 -f mp4 "$RECORD_DIR/meowstik_recording_$(date +%s).mp4" > /tmp/ffmpeg.log 2>&1 &
    sleep 2
    if pgrep -x "ffmpeg" > /dev/null; then
        echo "🎥 MEOW-TEST: ffmpeg started successfully."
    else
        echo "⚠️  MEOW-TEST: ffmpeg failed to start. Check /tmp/ffmpeg.log"
    fi
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
echo "📊 Logs will be saved to /home/runner/logs/server.log"

# We use tee to show in current terminal AND save to log file
pnpm run dev 2>&1 | tee /home/runner/logs/server.log
