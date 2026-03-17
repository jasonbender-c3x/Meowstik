import usb.core
import usb.util
import time
import sys

def test_deep_channels():
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

    print("Testing Deep Channels (Indices 8-12) with Index 4 as Intensity (255)")
    
    for i in range(8, 13):
        print(f"\nTesting Index {i}...")
        data = [0x01, 0x1B] + [0]*60
        data[4] = 255 # INTENSITY
        data[i] = 255
        
        try:
            ep.write(bytearray(data))
            input("Press Enter to continue...")
        except Exception as e:
            print(f"Error: {e}")

    print("Turning off.")
    ep.write(bytearray([0x01, 0x1B] + [0]*60))

if __name__ == "__main__":
    test_deep_channels()
