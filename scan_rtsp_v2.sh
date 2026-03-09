#!/bin/bash

TARGET="192.168.0.5"
PORTS=("10000" "554")
PATHS=(
  "/live/ch0"
  "/live/ch1"
  "/live/main"
  "/live/ch00_1"
  "/h264/ch1/main/av_stream"
  "/cam/realmonitor?channel=1&subtype=0"
  "/stream1"
  "/onvif1"
  "/"
)

USERS=("admin")
PASSWORDS=("clear")

echo "🔍 Scanning RTSP URLs on $TARGET (Timeout: 2s)..."

for PORT in "${PORTS[@]}"; do
  echo "  Checking port $PORT..."
  for USER in "${USERS[@]}"; do
    for PASS in "${PASSWORDS[@]}"; do
      for PATH_STR in "${PATHS[@]}"; do
        if [ -z "$PASS" ]; then
          URL="rtsp://$USER@$TARGET:$PORT$PATH_STR"
          display_pass="(empty)"
        else
          URL="rtsp://$USER:$PASS@$TARGET:$PORT$PATH_STR"
          display_pass="$PASS"
        fi
        
        echo -n "    Trying $USER:$display_pass @ :$PORT$PATH_STR ... "
        
        # Capture stderr to check for specific errors
        OUTPUT=$(timeout 2s ffprobe -v error -rtsp_transport tcp -i "$URL" -t 0.5 -f null - 2>&1)
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
          echo "✅ FOUND!"
          echo "    🔗 Stream URL: $URL"
          exit 0
        elif [[ "$OUTPUT" == *"401 Unauthorized"* ]]; then
           echo "🔐 401 Unauthorized (Auth required)"
        elif [[ "$OUTPUT" == *"Connection refused"* ]]; then
           echo "❌ Connection Refused"
           break 3 # Skip this port if refused
        else
           echo "❌"
        fi
      done
    done
  done
done

echo "🏁 Scan complete."
