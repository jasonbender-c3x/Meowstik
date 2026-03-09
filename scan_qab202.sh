#!/bin/bash

TARGET="192.168.0.5"
PORTS=("554" "10000" "10554" "5000")
PATHS=(
  "/onvif1"
  "/onvif2"
  "/live/ch0"
  "/live/ch0.264"
  "/ch0_0.264"
  "/cam/realmonitor?channel=1&subtype=0"
  "/cam/realmonitor?channel=1&subtype=1"
  "/"
)

# QAB202 / Yoosee often uses:
# - User: admin
# - Pass: 123, 12345, 123456, 888888, 666666, (empty)

CREDENTIALS=(
  "admin:123"
  "admin:12345"
  "admin:123456"
  "admin:888888"
  "admin:666666"
  "admin:admin"
  "admin:"
)

echo "🔍 Scanning QAB202/Yoosee RTSP paths on $TARGET..."

for PORT in "${PORTS[@]}"; do
  echo "  Checking port $PORT..."
  for CRED in "${CREDENTIALS[@]}"; do
    for PATH_STR in "${PATHS[@]}"; do
      URL="rtsp://$CRED@$TARGET:$PORT$PATH_STR"
      
      # Use timeout to avoid hanging
      OUTPUT=$(timeout 2s ffprobe -v error -rtsp_transport tcp -i "$URL" -t 0.5 -f null - 2>&1)
      EXIT_CODE=$?
      
      if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ FOUND!"
        echo "    🔗 Stream URL: $URL"
        exit 0
      fi
    done
  done
done

echo "🏁 Scan complete. No stream found."
