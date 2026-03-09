#!/bin/bash
echo "🔍 Scanning local network for cameras..."

# Determine local subnet (naive approach for Linux/macOS)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  SUBNET=$(ip route | grep default | awk '{print $3}' | cut -d'.' -f1-3).0/24
  # Fallback if default route is not IP
  if [[ -z "$SUBNET" ]]; then
    SUBNET=$(hostname -I | awk '{print $1}' | cut -d'.' -f1-3).0/24
  fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
  SUBNET=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -n 1 | awk '{print $2}' | cut -d'.' -f1-3).0/24
else
  echo "⚠️  Unsupported OS. Please manually specify subnet (e.g., 192.168.1.0/24)"
  exit 1
fi

echo "🌐 Detected Subnet: $SUBNET"

if ! command -v nmap &> /dev/null; then
    echo "❌ 'nmap' is not installed. Please install it first:"
    echo "  - Ubuntu/Debian: sudo apt install nmap"
    echo "  - macOS: brew install nmap"
    exit 1
fi

echo "🚀 Starting scan (this may take a minute)..."
# Scan for common camera ports: 80 (HTTP), 554 (RTSP), 8080 (Alt HTTP), 8000 (Common), 1935 (RTMP)
nmap -p 80,554,8080,8000,1935 --open -T4 $SUBNET -oG - | grep "/open" > camera_scan.txt

if [ -s camera_scan.txt ]; then
  echo ""
  echo "✅ Found potential devices:"
  cat camera_scan.txt | while read line; do
      IP=$(echo $line | awk '{print $2}')
      PORTS=$(echo $line | grep -oP '\d+/open' | cut -d'/' -f1 | tr '\n' ',' | sed 's/,$//')
      echo "  📷 Device at $IP (Open ports: $PORTS)"
  done
  echo ""
  echo "Try connecting to these IPs in your browser or RTSP player."
else
  echo "❌ No devices found with common camera ports."
fi
rm camera_scan.txt
