import usb.core
import usb.util
import sys

def set_mood(r, g, b, intensity=255):
    # Find device
    dev = usb.core.find(idVendor=0x03f0, idProduct=0x150c)
    if dev is None:
        print("Device not found")
        return

    try:
        dev.reset()
        print("Device reset")
    except usb.core.USBError as e:
        print(f"Reset failed: {e}")

    # Detach kernel driver if active
    if dev.is_kernel_driver_active(0):
        try:
            dev.detach_kernel_driver(0)
            print("Detached kernel driver")
        except usb.core.USBError as e:
            print(f"Could not detach kernel driver: {e}")

    # Finalized mapping (G=2, B=3, I=4, R=5)
    # Note: Index 3 (Blue) often appears Purple due to a Red tint/bias.
    # To get a "better" Blue, try mixing Green (Cyan): G=255, B=255.
    
    # Construct the data array [0x01, 0x1B, G, B, I, R]
    data = [0x01, 0x1B] + [0] * 60
    
    data[2] = g   # Green
    data[3] = b   # Blue (Purple-ish)
    data[4] = r   # Red (Mapped to Index 4)
    data[5] = intensity # Intensity (Mapped to Index 5)
    
    try:
        # Detach kernel driver if active (just in case)
        if dev.is_kernel_driver_active(0):
            try:
                dev.detach_kernel_driver(0)
            except:
                pass
                
        # Set configuration
        try:
            dev.set_configuration(1)
        except:
            pass
            
        # Claim interface
        try:
            usb.util.claim_interface(dev, 0)
        except:
            pass
            
        # Find endpoint
        cfg = dev.get_active_configuration()
        intf = cfg[(0,0)]
        ep = usb.util.find_descriptor(intf, custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT)
        
        print(f"Setting color R:{r} G:{g} B:{b} (Red mapped to Index 4, Intensity to Index 5)")
        ep.write(bytearray(data))
        print("Success!")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: sudo python3 control_mood_pyusb.py <r> <g> <b> [intensity]")
        sys.exit(1)
    
    r = int(sys.argv[1])
    g = int(sys.argv[2])
    b = int(sys.argv[3])
    
    intensity = 255
    if len(sys.argv) > 4:
        try:
            intensity = int(sys.argv[4])
        except ValueError:
            pass

    print(f"Setting Mood: R={r}, G={g}, B={b}, Intensity={intensity}")
    set_mood(r, g, b, intensity)

