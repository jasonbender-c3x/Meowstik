# HP Mood Lighting (03f0:150c) Control

## Summary
The HP Mood Lighting device (VID 03f0, PID 150c) lacks a standard Linux kernel driver, so `/dev/hidraw` devices are not created. We successfully reverse-engineered the USB protocol and created a userspace driver using `pyusb`.

## Key Findings
- **Protocol:** USB HID (Vendor Specific).
- **Packet Structure:** 64 bytes. Header `[0x01, 0x1B]`.
- **Channel Mapping:**
  - **Index 2:** Green (Reliable)
  - **Index 3:** Blue (Appears Purple due to Red tint/bias)
  - **Index 4:** Intensity (Required, controls overall brightness)
  - **Index 5:** Red (Reliable)
- **Quirks:**
  - Pure Blue (Index 3) looks Purple.
  - Cyan (Green + Index 3) looks like a good Blue.
  - Red is controlled by Index 5 and Index 4 (Intensity).

## Scripts
- **`scripts/mood.py <color>`**: User-friendly wrapper. Accepts color names (red, green, blue, cyan, purple, white, off).
  - Maps `blue` to Cyan (0, 255, 255) for better visual accuracy.
- **`scripts/control_mood_pyusb.py <r> <g> <b> [intensity]`**: Low-level control script.
- **`scripts/test_*.py`**: Various debugging scripts used to identify channels.

## Usage
```bash
# Turn on Blue (Cyan)
./scripts/mood.py blue

# Turn on Red
./scripts/mood.py red

# Turn Off
./scripts/mood.py off
```

## Troubleshooting
If `pyusb` fails with "Access denied", ensure you run with `sudo` or add a udev rule for the device.
