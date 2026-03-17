import usb.core
import usb.util
import time
import sys

def test_colors():
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

    print("Testing hypothesis: Index 4 is INTENSITY.")
    print("We will set Index 4 to 255, and cycle 2, 3, 5.")

    tests = [
        ("Index 2 (Blue?)", 2),
        ("Index 3 (Green?)", 3),
        ("Index 5 (Red?)", 5),
    ]

    for name, idx in tests:
        print(f"\nTesting {name}...")
        # Packet structure: [0x01, 0x1B, ...]
        data = [0x01, 0x1B] + [0]*60
        
        data[4] = 255 # INTENSITY
        data[idx] = 255 # COLOR CHANNEL
        
        try:
            ep.write(bytearray(data))
            input("Press Enter to continue...")
        except Exception as e:
            print(f"Error: {e}")

    print("Turning off.")
    ep.write(bytearray([0x01, 0x1B] + [0]*60))

if __name__ == "__main__":
    test_colors()
