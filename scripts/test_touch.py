import sys
import select
import os
import struct

DEVICES = [
    "/dev/input/event3",
    "/dev/input/event4",
    "/dev/input/event5",
    "/dev/hidraw0",
    "/dev/hidraw1",
    "/dev/hidraw2"
]

def test_touch():
    fds = []
    fd_map = {}
    
    print("Testing Touchscreen Input (Events and Raw HID)...")
    print("Please touch the screen NOW!")
    
    try:
        for path in DEVICES:
            if os.path.exists(path):
                try:
                    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
                    fds.append(fd)
                    fd_map[fd] = path
                    print(f"Opened {path}")
                except Exception as e:
                    print(f"Failed to open {path}: {e}")
            else:
                print(f"Skipping {path} (not found)")

        if not fds:
            print("No devices opened.")
            return

        print("Listening for 30 seconds...")
        timeout = 30
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            readable, _, _ = select.select(fds, [], [], 1.0)
            
            for fd in readable:
                try:
                    data = os.read(fd, 64)
                    if data:
                        path = fd_map[fd]
                        if "event" in path:
                            print(f"Event received on {path} ({len(data)} bytes)")
                        else:
                            # Hex dump for hidraw
                            hex_data = " ".join([f"{b:02x}" for b in data])
                            print(f"Raw data on {path}: {hex_data}")
                        return # Success!
                except OSError:
                    pass
                    
    finally:
        for fd in fds:
            try:
                os.close(fd)
            except:
                pass

import time
if __name__ == "__main__":
    test_touch()
