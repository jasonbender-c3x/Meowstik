#!/bin/bash

TARGET="192.168.0.5"
PORTS=("80" "10000" "8080")
PATHS=(
  "/snapshot.jpg"
  "/cgi-bin/snapshot.cgi"
  "/ISAPI/Streaming/channels/101/picture"
  "/web/auto/image1.jpg"
  "/snap.jpg"
  "/onvif/snapshot"
  "/jpeg/1"
  "/"
)

echo "🔍 Scanning Snapshot URLs on $TARGET..."

for PORT in "${PORTS[@]}"; do
  for PATH_STR in "${PATHS[@]}"; do
    URL="http://$TARGET:$PORT$PATH_STR"
    echo -n "  Checking $URL ... "
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$URL")
    
    if [ "$CODE" == "200" ]; then
      echo "✅ FOUND (200 OK)!"
      exit 0
    elif [ "$CODE" == "401" ]; then
      echo "🔐 FOUND (401 Auth Required)"
      exit 0
    else
      echo "❌ ($CODE)"
    fi
  done
done

echo "🏁 Scan complete."
