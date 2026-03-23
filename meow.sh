#!/bin/bash

# ==========================================
# MEOWSTIK STARTUP SCRIPT (Project Meow)
# ==========================================

echo "🐱 MEOW: Waking up Meowstik..."

# 1. Kill any existing processes on port 5000 (Backend) and 5173 (Frontend)
echo "🧹 MEOW: Clearing ports..."
fuser -k -n tcp 5000 2>/dev/null
fuser -k -n tcp 5173 2>/dev/null
# Force kill any lingering node processes related to server
pkill -f "tsx server/index.ts" 2>/dev/null

# 2. Check for Screen Recording (ffmpeg)
if pgrep -x "ffmpeg" > /dev/null; then
    echo "🎥 MEOW: Screen recording is already active."
else
    echo "🎥 MEOW: Starting screen recording..."
    # Start ffmpeg in background, log to file. Adjust display (:0 or :1) as needed for environment.
    # This is a placeholder command - actual arguments depend on the specific environment display.
    nohup ffmpeg -f x11grab -i :0 -r 15 -s 1920x1200 /mnt/scrnrec/meowstik_recording_$(date +%s).mp4 > /tmp/ffmpeg.log 2>&1 &
fi

# 3. Check for Chrome (Debug Enabled)
if pgrep -f "google-chrome.*remote-debugging-port" > /dev/null; then
    echo "🌐 MEOW: Debug-enabled Chrome is already running."
else
    echo "🌐 MEOW: Starting Chrome with remote debugging..."
    # Start Chrome with remote debugging port 9222
    nohup google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=/tmp/chrome-debug > /dev/null 2>&1 &
fi

# 4. Start the Server
echo "🚀 MEOW: Launching Meowstik Core..."
# We use pnpm run dev which runs "tsx server/index.ts"
# We run it in the foreground so the terminal stays active with logs
pnpm run dev


#note to copilot see the directory i started to change for the video, please correct and finish that.  add a tee statement to the last step so logs show in my terminal and are recorder to /home/runner/logs/server.log