import usb.core
import usb.util
import time
import sys

def test_zones_cyan():
    dev = usb.core.find(idVendor=0x03f0, idProduct=0x150c)
    if dev is None:
        print("Device not found")
        return

    try:
        dev.reset()
    except:
        pass

    if dev.is_kernel_driver_active(0):
        try:
            dev.detach_kernel_driver(0)
        except:
            pass
    try:
        dev.set_configuration(1)
        usb.util.claim_interface(dev, 0)
    except:
        pass

    cfg = dev.get_active_configuration()
    intf = cfg[(0,0)]
    ep = usb.util.find_descriptor(intf, custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT)

    print("Testing Possible Zone IDs with Cyan Payload (255, 255, 255)")
    print("Looking for a different color response than Cyan (e.g. BLUE or RED).")
    
    # We will send [0x01, CMD, 255, 255, 255, 255]
    # If 0x1B gives Cyan. Maybe 0x1A gives Blue?
    
    test_cmds = [0x1A, 0x1C, 0x1D, 0x1E, 0x1F, 0x20, 0x21, 0x2B, 0x00]
    
    for cmd in test_cmds:
        print(f"\nTesting Command Byte: {cmd:#02x}...")
        
        # [0x01, CMD, 255, 255, 255, 255] (All ON + Intensity)
        data = [0x01, cmd, 255, 255, 255, 255] + [0]*58
        
        try:
            ep.write(bytearray(data))
            input(f"Is it different? (Press Enter)...")
        except Exception as e:
            print(f"Error: {e}")

    print("Turning off.")
    ep.write(bytearray([0x01, 0x1B] + [0]*60))

if __name__ == "__main__":
    test_zones_cyan()
