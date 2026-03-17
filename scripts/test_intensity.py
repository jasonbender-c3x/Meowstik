import usb.core
import usb.util
import time
import sys

def test_intensity_levels():
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

    print("Testing Intensity Levels (Index 4) with BLUE (Index 3) fixed at 255.")
    
    levels = [0, 1, 10, 50, 100, 128, 200, 255]
    
    for lvl in levels:
        print(f"\nTesting Intensity (Index 4) = {lvl}...")
        
        # [0x01, 1B, 0(G), 255(B), lvl(I), 0(R)]
        data = [0x01, 0x1B, 0, 0, 0, 0] + [0]*58
        data[3] = 255 # Blue
        data[4] = lvl # Intensity
        data[5] = 0   # Red
        
        try:
            ep.write(bytearray(data))
            input("Look for color change (Press Enter)...")
        except Exception as e:
            print(f"Error: {e}")

    print("Turning off.")
    ep.write(bytearray([0x01, 0x1B] + [0]*60))

if __name__ == "__main__":
    test_intensity_levels()
