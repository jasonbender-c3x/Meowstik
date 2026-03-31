# NextWindow 1900 Touchscreen Investigation

## Device Details
- **Model:** NextWindow 1900 HID Touchscreen
- **USB ID:** `1926:0003`
- **Interfaces:**
  - Interface 0: Keyboard (hidraw0)
  - Interface 1: Comms / Vendor Specific (hidraw1) - 64-byte transfers
  - Interface 2: Mouse / Digitizer (hidraw2)

## Status
- **Touchscreen Function:** Not working. No input events generated.
- **Driver Support:** 
  - The standard `hid-generic` driver binds to it but receives no data.
  - The `nwfermi` driver (NextWindow proprietary/open hybrid) explicitly **does not support** model `1926:0003`.
  - Online resources indicate this specific model uses a proprietary protocol ("bulk data" / raw sensor) that was never reverse-engineered for Linux.

## Tests Performed
1.  **Input Events:** Monitored `/dev/input/event3`, `4`, `5`. No events detected.
2.  **Raw HID:** Monitored `/dev/hidraw0`, `1`, `2`. No data received.
3.  **Initialization:** Attempted to send known "wake up" commands (used by other NextWindow models like `1926:1846`) to the Comms interface (`hidraw1`).
    - Sent: `00 43 02 F3 00` (and variants)
    - Result: Writes accepted, but device remained silent.

## Conclusion
The `1926:0003` model appears to be unsupported on Linux without the original proprietary Windows driver logic. The "missing hidraw" observation likely refers to the Mood Lighting device (which disappears from hidraw when `mood.py` takes control), as the Touchscreen's hidraw devices (`hidraw0-2`) are present and writable.
