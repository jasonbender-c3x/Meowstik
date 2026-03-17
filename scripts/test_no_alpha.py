import usb.core
import usb.util
import time
import sys

def test_no_alpha():
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

    print("Testing Index 2 (Green) WITHOUT Index 4 (Intensity).")
    print("Setting [0x01, 0x1B, 255, 0, 0, 0...]")
    
    # 0=ID, 1=CMD, 2=G, 3=B, 4=I, 5=R
    data = [0x01, 0x1B] + [0]*60
    data[2] = 255 # Green
    data[4] = 0   # NO INTENSITY
    
    try:
        ep.write(bytearray(data))
        print("Packet sent.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_no_alpha()
