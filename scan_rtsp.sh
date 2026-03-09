#!/bin/bash

TARGET="192.168.0.5"
PORTS=("10000" "554" "8554" "1935" "8000" "8080")
PATHS=(
  "/live/ch0"
  "/live/ch1"
  "/live/main"
  "/live/ch00_1"
  "/h264/ch1/main/av_stream"
  "/cam/realmonitor?channel=1&subtype=0"
  "/stream1"
  "/11"
  "/12"
  "/onvif1"
  "/ch0_0.264"
  "/"
)

USER="admin"
PASS=""

echo "🔍 Scanning RTSP URLs on $TARGET..."

for PORT in "${PORTS[@]}"; do
  # Check if port is open first to save time (nc is faster than ffprobe timeout)
  # nc -z -w 1 $TARGET $PORT &>/dev/null
  # if [ $? -eq 0 ]; then
    echo "  Checking port $PORT..."
    for PATH_STR in "${PATHS[@]}"; do
      URL="rtsp://$USER:$PASS@$TARGET:$PORT$PATH_STR"
      echo -n "    Trying $URL ... "
      
      # Use ffprobe to check stream. -t 2 to read 2 seconds.
      ffprobe -v error -rtsp_transport tcp -i "$URL" -t 0.5 -f null - &>/dev/null
      
      if [ $? -eq 0 ]; then
        echo "✅ FOUND!"
        echo "    🔗 Stream URL: $URL"
        exit 0
      else
        echo "❌"
      fi
    done
  # fi
done

echo "🏁 Scan complete. No stream found with common paths."
