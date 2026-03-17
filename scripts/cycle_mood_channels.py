import usb.core
import usb.util
import time
import sys

def cycle_channels():
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

    print("Cycling channels (Indices 4, 5, 6, 7)...")
    
    # We suspect Byte 4 is Red.
    # What are 5, 6, 7?
    
    for i in range(4, 8):
        print(f"Testing Byte {i} = 255 (All others 0)...")
        data = [0x01, 0x1B] + [0]*60
        data[i] = 255
        try:
            ep.write(bytearray(data))
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(2)

    print("Done. Turning off.")
    ep.write(bytearray([0x01, 0x1B] + [0]*60))

if __name__ == "__main__":
    cycle_channels()
