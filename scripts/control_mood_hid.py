import hid
import sys
import time

# HP Mood Lighting VID/PID
VID = 0x03f0
PID = 0x150c

def list_devices():
    print("Enumerating HID devices...")
    for d in hid.enumerate():
        keys = list(d.keys())
        keys.sort()
        # for key in keys:
        #     print("%s : %s" % (key, d[key]))
        if d['vendor_id'] == VID and d['product_id'] == PID:
            path = d['path']
            # Decode if it's bytes
            if isinstance(path, bytes):
                path = path.decode('utf-8')
            print(f"FOUND HP DEVICE: {path}")
            return path
    return None

def set_mood_light(red, green, blue):
    path = list_devices()
    
    if path is None:
        print("HP Mood Lighting device not found via HIDAPI enumeration")
        # Try opening by VID/PID directly
        try:
            h = hid.device()
            h.open(VID, PID)
            print("Opened device by VID/PID")
        except IOError as ex:
            print(f"Failed to open device by VID/PID: {ex}")
            return
    else:
        try:
            h = hid.device()
            # hidapi open_path usually expects bytes on Linux/Mac sometimes, let's keep it as is if open_path requires it
            # But the previous error suggested 'open failed'
            # Let's try passing the path directly as returned (bytes or string)
            # Re-encoding to bytes if it was decoded might be needed for some bindings
            if isinstance(path, str):
                 path = path.encode('utf-8')
            
            h.open_path(path)
            print(f"Opened device by path: {path}")
        except IOError as ex:
            print(f"Failed to open device by path: {ex}")
            # Fallback to VID/PID
            try:
                h = hid.device()
                h.open(VID, PID)
                print("Fallback: Opened device by VID/PID")
            except Exception as e2:
                print(f"Fallback failed: {e2}")
                return

    try:
        # HP Mood Lighting Protocol Exploration
        # Based on common simple HID LED controllers
        
        # Method 1: Feature Report (ID 0)
        # Often used for configuration
        # Data: [ReportID, R, G, B, 0, 0, 0, 0]
        data = [0x00, red, green, blue, 0x00, 0x00, 0x00, 0x00]
        try:
            # Send Feature Report
            # Note: The first byte is the Report ID
            h.send_feature_report(data)
            print(f"Sent Feature Report: {data}")
        except Exception as e:
            print(f"Feature Report failed: {e}")

        # Method 2: Output Report (write)
        # Some devices take commands via standard write
        # Packet usually needs to match the endpoint size (64 bytes typically)
        
        # Try various Report IDs if 0 fails implicitly
        # [ReportID, R, G, B, ...]
        
        # Packet A: Report ID 0 (Common)
        packet_a = [0x00, red, green, blue] + [0x00] * 60
        try:
            h.write(packet_a)
            print("Sent Packet A (Report ID 0)")
        except Exception as e:
            print(f"Packet A failed: {e}")

        # Packet B: No Report ID (Direct data)
        packet_b = [red, green, blue] + [0x00] * 61
        try:
            h.write(packet_b)
            print("Sent Packet B (Direct)")
        except Exception as e:
             print(f"Packet B failed: {e}")
             
        # Method 3: 'Set Report' Control Transfer via HIDAPI (if supported/wrapped)
        # HIDAPI mostly exposes send_feature_report for this.
        
    except Exception as e:
        print(f"Error during communication: {e}")
    finally:
        h.close()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 mood_hid.py <red> <green> <blue>")
        sys.exit(1)
        
    r = int(sys.argv[1])
    g = int(sys.argv[2])
    b = int(sys.argv[3])
    
    set_mood_light(r, g, b)
