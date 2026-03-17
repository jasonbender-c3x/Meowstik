import os
import time
import struct
import select

# Path to the "Comms" interface (Interface 1)
# Based on lsusb/sysfs, this should be hidraw1, but let's check all
HID_DEVICES = ["/dev/hidraw0", "/dev/hidraw1", "/dev/hidraw2"]

# Magic messages from nwfermi/README.md for other models
MAGIC_MSGS = [
    b'\x00\x43\x02\xF3\x00', # 1926:1846
    b'\x00\x43\x02\xF0\x01', # 1926:1878
    b'\x00\x00\x00\x00\x00', # Generic empty
    b'\x01\x00\x00\x00\x00', # Try with 0x01
]

def monitor_devices(duration=5):
    print(f"Monitoring for {duration} seconds...")
    fds = []
    fd_map = {}
    try:
        for dev in HID_DEVICES:
            if os.path.exists(dev):
                try:
                    fd = os.open(dev, os.O_RDONLY | os.O_NONBLOCK)
                    fds.append(fd)
                    fd_map[fd] = dev
                except Exception as e:
                    print(f"Could not open {dev}: {e}")
        
        start = time.time()
        while time.time() - start < duration:
            r, _, _ = select.select(fds, [], [], 0.1)
            for fd in r:
                data = os.read(fd, 64)
                if data:
                    print(f"!!! DATA RECEIVED ON {fd_map[fd]} !!!")
                    print("Hex: " + " ".join([f"{b:02x}" for b in data]))
                    return True
    finally:
        for fd in fds:
            os.close(fd)
    return False

def try_send(path, msg):
    print(f"Attempting to write to {path}...")
    try:
        fd = os.open(path, os.O_RDWR | os.O_NONBLOCK)
    except Exception as e:
        print(f"Failed to open {path} for writing: {e}")
        return

    # Pad to 64 bytes
    padded = msg + b'\x00' * (64 - len(msg))
    
    try:
        # Try writing straight
        os.write(fd, padded)
        print(f"Wrote {len(padded)} bytes: {msg.hex()}")
    except Exception as e:
        print(f"Write failed: {e}")

    # Also try just the message length if padding fails (unlikely for hidraw)
    
    os.close(fd)

def main():
    print("Starting Initialization Attempt for NextWindow 1926:0003")
    
    # 1. Monitor first to see if anything is happening
    if monitor_devices(2):
        print("Device already active!")
        return

    # 2. Try sending magic to hidraw1 (Comms)
    target = "/dev/hidraw1"
    if not os.path.exists(target):
        print(f"{target} not found, checking others...")
        target = "/dev/hidraw0" # Fallback

    for msg in MAGIC_MSGS:
        print(f"\n--- Sending Magic: {msg.hex()} ---")
        try_send(target, msg)
        time.sleep(0.5)
        if monitor_devices(2):
            print("SUCCESS! Device started sending data.")
            break
        else:
            print("No response.")

if __name__ == "__main__":
    main()
