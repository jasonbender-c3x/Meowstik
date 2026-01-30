# Hardware & IoT Device Integration Guide

This guide covers how to use Meowstik's hardware and IoT device interaction capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Arduino Integration](#arduino-integration)
3. [Android Debug Bridge (ADB)](#android-debug-bridge-adb)
4. [Petoi Robot Control](#petoi-robot-control)
5. [3D Printer Integration](#3d-printer-integration)
6. [Electronic Board Design (KiCad)](#electronic-board-design-kicad)
7. [Setup & Prerequisites](#setup--prerequisites)
8. [Examples](#examples)

---

## Overview

Meowstik provides comprehensive tools for interacting with hardware devices, IoT platforms, and electronic design tools. These capabilities enable you to:

- **Program microcontrollers** (Arduino boards)
- **Control Android devices** remotely via ADB
- **Control robotic platforms** (Petoi robot pets)
- **Manage 3D printers** and monitor prints
- **Design PCBs** and generate manufacturing files with KiCad

All tools are accessible through natural language commands to the AI assistant.

---

## Arduino Integration

### Features

- Compile and upload Arduino sketches
- Detect connected boards automatically
- Install and search for libraries
- Create new sketch templates
- Read sensor data via serial monitor

### Prerequisites

Install Arduino CLI:

```bash
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh

# Add to PATH
export PATH=$PATH:/path/to/arduino-cli
```

### Common Board FQBNs

| Board | FQBN |
|-------|------|
| Arduino Uno | `arduino:avr:uno` |
| Arduino Mega | `arduino:avr:mega` |
| Arduino Nano | `arduino:avr:nano` |
| Arduino Leonardo | `arduino:avr:leonardo` |
| ESP32 | `esp32:esp32:esp32` |
| ESP8266 | `esp8266:esp8266:generic` |

### Example Commands

**List connected boards:**
```
"List all connected Arduino boards"
```

**Compile a sketch:**
```
"Compile the sketch at ~/arduino/blink/blink.ino for Arduino Uno"
```

**Upload to board:**
```
"Upload the blink sketch to Arduino Uno on port /dev/ttyACM0"
```

**Install library:**
```
"Install the Servo library for Arduino"
```

---

## Android Debug Bridge (ADB)

### Features

- Detect connected Android devices
- Install/uninstall APK files
- Execute shell commands on device
- Transfer files to/from device
- Capture screenshots
- View device logs (logcat)
- Get device information

### Prerequisites

Install Android SDK Platform Tools:

1. Download from: https://developer.android.com/tools/releases/platform-tools
2. Extract the archive
3. Add `platform-tools` directory to your PATH

Enable USB debugging on your Android device:
1. Settings → About Phone → Tap "Build Number" 7 times
2. Settings → Developer Options → Enable "USB Debugging"

### Example Commands

**List devices:**
```
"Show all connected Android devices"
```

**Install app:**
```
"Install the app.apk on my Android device"
```

**Execute shell command:**
```
"Run 'ls /sdcard/Download' on my Android device"
```

**Capture screenshot:**
```
"Take a screenshot of my Android device and save it to ~/screenshots/device.png"
```

**Get device info:**
```
"What's the model and Android version of my connected device?"
```

---

## Petoi Robot Control

### Features

- Execute predefined skills (sit, walk, turn, etc.)
- Control individual servo motors
- Send custom movement commands
- List available skills and specifications

### Supported Robots

- **Bittle**: Quadruped robot dog (12 servos)
- **Nybble**: Cat-like quadruped (12 servos)
- **Bittle X**: Advanced version (16 servos with head movement)

### Prerequisites

1. Connect Petoi robot via USB
2. Ensure the robot is powered on
3. Find the serial port (usually `/dev/ttyUSB0` on Linux, `COM3` on Windows)

### Available Skills

| Category | Skills |
|----------|--------|
| **Postures** | sit, stand, rest |
| **Movement** | walk, walkBackward, trot, trotBackward |
| **Turning** | turnLeft, turnRight |
| **Actions** | pushUp, stretch, pee |
| **Behaviors** | check, sniff, scratch |
| **System** | calibrate, reset |

### Example Commands

**Make robot sit:**
```
"Make the Petoi robot on /dev/ttyUSB0 sit down"
```

**Walk forward:**
```
"Make the robot walk forward"
```

**Control specific servo:**
```
"Set servo 0 to 45 degrees on the Petoi robot"
```

**List available skills:**
```
"What skills can the Petoi robot perform?"
```

---

## 3D Printer Integration

### Features

- Send G-code commands to printer
- Monitor print status and progress
- Control temperatures (extruder and bed)
- Start, pause, and cancel prints
- Home printer axes
- Upload G-code files

### Prerequisites

**OctoPrint Setup:**

1. Install OctoPrint on Raspberry Pi or computer
2. Connect printer via USB
3. Get API key from OctoPrint settings
4. Note your OctoPrint URL (e.g., `http://octopi.local`)

### Common G-code Commands

| Command | Description |
|---------|-------------|
| `G28` | Home all axes |
| `G1 X10 Y10 Z0.3 F1500` | Move to position |
| `M104 S200` | Set extruder temperature to 200°C |
| `M140 S60` | Set bed temperature to 60°C |
| `M106 S255` | Turn fan on (full speed) |
| `M107` | Turn fan off |

### Example Commands

**Check printer status:**
```
"What's the status of my 3D printer? Host: http://octopi.local, API key: YOUR_KEY"
```

**Start a print:**
```
"Start the print job on my 3D printer"
```

**Set temperatures:**
```
"Set the extruder to 200°C and bed to 60°C"
```

**Home the printer:**
```
"Home all axes on the 3D printer"
```

---

## Electronic Board Design (KiCad)

### Features

- Create new PCB projects
- Generate Gerber files for manufacturing
- Generate drill files
- Export designs as PDF
- Create Bill of Materials (BOM)
- Validate PCB designs (DRC)

### Prerequisites

Install KiCad:

```bash
# Linux
sudo apt install kicad

# macOS
brew install --cask kicad

# Windows
# Download installer from https://www.kicad.org/download/
```

### Supported Export Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| Gerber | `.gbr` | PCB manufacturing |
| Drill | `.drl` | Drilling data |
| PDF | `.pdf` | Documentation |
| SVG | `.svg` | Web/graphics |
| BOM | `.csv` | Parts ordering |
| Netlist | `.net` | Simulation |

### Example Commands

**Create new project:**
```
"Create a new KiCad project named 'led_circuit'"
```

**Generate Gerber files:**
```
"Generate Gerber files from ~/kicad/led_circuit/led_circuit.kicad_pcb"
```

**Validate design:**
```
"Run design rule check on my PCB file"
```

**Generate BOM:**
```
"Create a bill of materials from ~/kicad/led_circuit/led_circuit.kicad_sch"
```

---

## Setup & Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows
- **Node.js**: 20+ (for running Meowstik server)
- **Hardware Tools**: Install based on features you need (see sections above)

### Environment Setup

1. **Install Meowstik** (if not already installed)
2. **Install hardware tools** you plan to use:
   - Arduino CLI
   - Android SDK Platform Tools
   - KiCad
   - OctoPrint (for 3D printing)

3. **Connect your devices**:
   - Arduino boards via USB
   - Android devices via USB (with debugging enabled)
   - Petoi robots via USB
   - 3D printer via OctoPrint network connection

### Troubleshooting

**Device not detected:**
- Check USB cable connection
- Verify device is powered on
- Check that drivers are installed (Windows)
- Verify device permissions (Linux: add user to `dialout` group)

**Permission denied errors:**
```bash
# Linux: Add user to dialout group for serial port access
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

**Arduino CLI not found:**
- Ensure Arduino CLI is in your PATH
- Verify installation: `arduino-cli version`

**ADB not found:**
- Ensure platform-tools directory is in your PATH
- Verify installation: `adb version`

---

## Examples

### Complete Arduino Workflow

```
User: "Create a new Arduino sketch called 'temperature_sensor' with code to read from a DHT22 sensor"

AI: [Creates sketch with DHT22 reading code]

User: "Install the DHT sensor library"

AI: [Installs DHT library]

User: "List my connected Arduino boards"

AI: [Shows boards on available ports]

User: "Compile and upload the sketch to Arduino Uno on /dev/ttyACM0"

AI: [Compiles and uploads the sketch]
```

### Android Device Management

```
User: "List all my connected Android devices"

AI: [Shows connected devices with serial numbers]

User: "Get detailed info about device ABC123"

AI: [Shows model, Android version, manufacturer, etc.]

User: "Install the app.apk file on this device"

AI: [Installs the APK]

User: "Capture a screenshot and save it to ~/screenshots/device.png"

AI: [Captures and saves screenshot]
```

### Petoi Robot Control Sequence

```
User: "Find available serial ports for Petoi robot"

AI: [Lists available ports]

User: "Make the robot on /dev/ttyUSB0 stand up"

AI: [Executes 'stand' skill]

User: "Now make it walk forward"

AI: [Executes 'walk' skill]

User: "Turn left"

AI: [Executes 'turnLeft' skill]

User: "Make it sit down"

AI: [Executes 'sit' skill]
```

### 3D Printing Workflow

```
User: "Check the status of my 3D printer at http://octopi.local with API key XYZ123"

AI: [Shows printer state, temperatures, current job]

User: "Set the bed temperature to 60°C and extruder to 200°C"

AI: [Sets temperatures]

User: "Start the print"

AI: [Starts the print job]

User: "What's the progress?"

AI: [Shows completion percentage and time remaining]
```

### PCB Design Workflow

```
User: "Create a new KiCad project called 'blink_led'"

AI: [Creates project files]

User: "Generate Gerber files from the PCB file"

AI: [Generates manufacturing files]

User: "Validate the PCB design"

AI: [Runs DRC and reports any errors or warnings]

User: "Create a bill of materials"

AI: [Generates BOM CSV file]

User: "Export the PCB as a PDF"

AI: [Creates PDF documentation]
```

---

## API Reference

All hardware tools are accessible via REST API endpoints:

- **Arduino**: `/api/hardware/arduino/*`
- **ADB**: `/api/hardware/adb/*`
- **Petoi**: `/api/hardware/petoi/*`
- **3D Printer**: `/api/hardware/printer/*`
- **KiCad**: `/api/hardware/kicad/*`

See the API documentation for detailed endpoint specifications.

---

## Security Considerations

- **Arduino/Serial**: Commands sent directly to serial ports can control hardware. Use caution.
- **ADB**: Shell commands execute with app permissions. Avoid destructive operations.
- **3D Printer**: G-code commands can damage printer if used incorrectly. Always verify commands.
- **Network Tools**: OctoPrint API keys should be kept secure and not shared.

---

## Support & Resources

- **Arduino Documentation**: https://docs.arduino.cc/
- **ADB Documentation**: https://developer.android.com/tools/adb
- **Petoi Documentation**: https://docs.petoi.com/
- **OctoPrint Documentation**: https://docs.octoprint.org/
- **KiCad Documentation**: https://docs.kicad.org/

---

## License

This feature is part of the Meowstik project. See main repository for license information.
