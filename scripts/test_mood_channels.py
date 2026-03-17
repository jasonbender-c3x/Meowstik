import usb.core
import usb.util
import time
import sys

def test_channels():
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

    print("Sending RAW packet sequence to test positions...")
    
    # Standard format was: [0x01, 0x1B, R, G, B, 255]
    # B=255 -> Red. (So pos 4 controls Red?)
    # G=255 -> Cyan (Green+Blue?) (So pos 3 controls Green AND Blue?)
    # R=255 -> Off (So pos 2 controls nothing?)

    # Let's test each position individually with 255
    # Pos 0 is Report ID (1)
    # Pos 1 is Command (0x1B)
    
    positions = range(2, 8) # Test bytes 2 through 7
    
    for i in positions:
        print(f"\nTesting byte at index {i} = 255 (all others 0)...")
        data = [0x01, 0x1B] + [0]*60
        data[i] = 255
        try:
            ep.write(bytearray(data))
            input(f"Look at the light. What changed? (Press Enter for next)")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_channels()
