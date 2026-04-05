#!/usr/bin/env bash
set -euo pipefail

DEVICE_NAME="Nextwindow Fermi Touchscreen"

find_event_device() {
  awk -v name="$DEVICE_NAME" '
    /^N: / && index($0, name) { found = 1; next }
    /^H: / && found {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^event/) {
          print "/dev/input/" $i
          exit
        }
      }
    }
  ' /proc/bus/input/devices
}

device="${1:-$(find_event_device)}"

if [[ -z "$device" ]]; then
  echo "Unable to locate the $DEVICE_NAME device in /proc/bus/input/devices." >&2
  exit 1
fi

echo "Using device: $device"
read -rp "Hit ENTER, then touch the screen (Ctrl+C to stop evtest)..." _

sudo evtest "$device"
