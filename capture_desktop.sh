#!/bin/bash
# Captures a screenshot of the virtual display :101 (where the desktop app runs)
# Usage: ./capture_desktop.sh [output_filename]

OUTPUT_FILE="${1:-desktop_snapshot.jpg}"

# Try to find the Xvfb process for display :101
PID=$(pgrep -f "Xvfb :101")
if [ -z "$PID" ]; then
    echo "Error: Xvfb display :101 not found."
    exit 1
fi

# Extract the auth file path from the command line arguments
XAUTH=$(ps -p $PID -o args= | grep -oP '\-auth \K\S+')

if [ -z "$XAUTH" ]; then
    echo "Error: Could not find Xauthority file for display :101"
    exit 1
fi

echo "Using Xauthority: $XAUTH"
DISPLAY=:101 XAUTHORITY="$XAUTH" ffmpeg -y -f x11grab -video_size 1280x1024 -i :101 -vframes 1 "$OUTPUT_FILE" >/dev/null 2>&1

echo "Snapshot saved to $OUTPUT_FILE"
