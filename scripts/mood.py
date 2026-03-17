#!/usr/bin/env python3
import sys
import subprocess
import os

# Path to the low-level control script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTROL_SCRIPT = os.path.join(SCRIPT_DIR, "control_mood_pyusb.py")

COLORS = {
    "red":    (255, 0, 0),
    "green":  (0, 255, 0),
    "blue":   (0, 255, 255),  # Using Cyan for Blue because pure Blue looks Purple
    "cyan":   (0, 255, 255),
    "purple": (0, 0, 255),    # Pure Blue channel looks Purple
    "yellow": (255, 255, 0),  # Green + Red
    "white":  (255, 255, 255),
    "off":    (0, 0, 0)
}

def set_color(color_name):
    color_name = color_name.lower()
    if color_name not in COLORS:
        print(f"Unknown color: {color_name}")
        print(f"Available colors: {', '.join(COLORS.keys())}")
        return

    r, g, b = COLORS[color_name]
    print(f"Setting {color_name} -> R={r}, G={g}, B={b}")
    
    cmd = ["sudo", "python3", CONTROL_SCRIPT, str(r), str(g), str(b)]
    subprocess.run(cmd)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: ./mood.py <color>")
        print(f"Colors: {', '.join(COLORS.keys())}")
        sys.exit(1)
    
    set_color(sys.argv[1])
