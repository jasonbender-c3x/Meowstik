import usb.core
import usb.util
import time
import sys

def test_swap_4_5():
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

    print("Testing SWAP Hypothesis: Index 5 is INTENSITY, Index 4 is RED.")
    print("Trying to create PURE BLUE.")
    print("Packet: [0x01, 0x1B, G=0, B=255, Idx4(Red?)=0, Idx5(Int?)=255]")
    
    # Indices: 0=01, 1=1B, 2=G, 3=B, 4=R, 5=I
    data = [0x01, 0x1B, 0, 0, 0, 0] + [0]*58
    data[3] = 255 # Blue
    data[4] = 0   # Index 4 (Red?) -> 0
    data[5] = 255 # Index 5 (Intensity?) -> 255
    
    try:
        ep.write(bytearray(data))
        print("Packet sent.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_swap_4_5()
