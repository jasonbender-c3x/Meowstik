/**
 * =============================================================================
 * ARDUINO INTEGRATION SERVICE
 * =============================================================================
 * 
 * Provides tools for interacting with Arduino boards via Arduino CLI.
 * Supports compiling sketches, uploading code, reading sensor data,
 * and controlling actuators.
 * 
 * DEPENDENCIES:
 * - Arduino CLI must be installed on the system
 * - Install via: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
 * 
 * CAPABILITIES:
 * - Compile Arduino sketches (.ino files)
 * - Upload code to connected boards
 * - Detect connected Arduino boards
 * - Read serial data from sensors
 * - Send commands to control actuators
 * - Manage Arduino libraries
 * 
 * =============================================================================
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execPromise = promisify(exec);

/**
 * Check if Arduino CLI is installed and available
 */
export async function isArduinoCLIInstalled(): Promise<boolean> {
  try {
    await execPromise("arduino-cli version");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Install Arduino CLI if not present
 * Returns installation instructions for the user
 */
export function getInstallInstructions(): string {
  return `Arduino CLI is not installed. Please install it using:
  
Linux/macOS:
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
  
Windows (PowerShell):
  iwr -useb https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | iex
  
After installation, add it to your PATH.`;
}

/**
 * List all connected Arduino boards
 */
export async function listBoards(): Promise<{
  boards: Array<{
    address: string;
    protocol: string;
    protocolLabel: string;
    boardName?: string;
    fqbn?: string;
  }>;
  output: string;
}> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout } = await execPromise("arduino-cli board list --format json");
    const result = JSON.parse(stdout);
    return {
      boards: result.detected_ports || [],
      output: stdout,
    };
  } catch (error) {
    throw new Error(`Failed to list boards: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Compile an Arduino sketch
 * 
 * @param sketchPath - Path to the .ino file or sketch directory
 * @param fqbn - Fully Qualified Board Name (e.g., "arduino:avr:uno")
 */
export async function compileSketch(
  sketchPath: string,
  fqbn: string
): Promise<{ success: boolean; output: string; hexPath?: string }> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout, stderr } = await execPromise(
      `arduino-cli compile --fqbn ${fqbn} "${sketchPath}"`
    );
    
    return {
      success: true,
      output: stdout + stderr,
      hexPath: undefined, // Path would be in the build directory
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Upload compiled sketch to Arduino board
 * 
 * @param sketchPath - Path to the .ino file or sketch directory
 * @param fqbn - Fully Qualified Board Name
 * @param port - Serial port (e.g., "/dev/ttyACM0" or "COM3")
 */
export async function uploadSketch(
  sketchPath: string,
  fqbn: string,
  port: string
): Promise<{ success: boolean; output: string }> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout, stderr } = await execPromise(
      `arduino-cli upload -p ${port} --fqbn ${fqbn} "${sketchPath}"`
    );
    
    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Create a new Arduino sketch file with boilerplate code
 * 
 * @param name - Name of the sketch (will create a directory with .ino file)
 * @param code - Optional custom code (defaults to basic template)
 */
export async function createSketch(
  name: string,
  code?: string
): Promise<{ path: string; content: string }> {
  const sketchDir = path.join(os.tmpdir(), "arduino-sketches", name);
  const sketchFile = path.join(sketchDir, `${name}.ino`);
  
  const defaultCode = code || `
void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Setup code here
}

void loop() {
  // Main code here
  
  delay(1000);
}
`.trim();

  await fs.mkdir(sketchDir, { recursive: true });
  await fs.writeFile(sketchFile, defaultCode, "utf-8");
  
  return {
    path: sketchFile,
    content: defaultCode,
  };
}

/**
 * Install an Arduino library
 * 
 * @param libraryName - Name of the library (e.g., "Servo", "DHT sensor library")
 */
export async function installLibrary(libraryName: string): Promise<{ success: boolean; output: string }> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout, stderr } = await execPromise(`arduino-cli lib install "${libraryName}"`);
    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Search for Arduino libraries
 * 
 * @param query - Search query (e.g., "servo", "temperature")
 */
export async function searchLibraries(query: string): Promise<{ libraries: any[]; output: string }> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout } = await execPromise(`arduino-cli lib search "${query}" --format json`);
    const result = JSON.parse(stdout);
    return {
      libraries: result.libraries || [],
      output: stdout,
    };
  } catch (error) {
    throw new Error(`Failed to search libraries: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Install Arduino core for a specific board type
 * 
 * @param core - Core identifier (e.g., "arduino:avr" for standard Arduino boards)
 */
export async function installCore(core: string): Promise<{ success: boolean; output: string }> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout, stderr } = await execPromise(`arduino-cli core install ${core}`);
    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Read serial data from Arduino
 * This is a simplified version - for production, use a serial port library
 * 
 * @param port - Serial port to monitor
 * @param duration - Duration to monitor in milliseconds (default: 5000)
 */
export async function readSerial(
  port: string,
  duration: number = 5000
): Promise<{ data: string }> {
  if (!(await isArduinoCLIInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    // Use timeout to limit monitoring duration
    const timeoutCmd = process.platform === 'win32' ? 'timeout' : 'timeout';
    const durationSec = Math.ceil(duration / 1000);
    
    const { stdout, stderr } = await execPromise(
      `timeout ${durationSec}s arduino-cli monitor -p ${port} || true`,
      { timeout: duration + 1000 }
    );
    
    return {
      data: stdout + stderr,
    };
  } catch (error: any) {
    // Timeout is expected behavior
    if (error.killed || error.signal === 'SIGTERM') {
      return {
        data: error.stdout || '',
      };
    }
    throw new Error(`Failed to read serial: ${error.message}`);
  }
}

/**
 * Get common FQBN values for popular Arduino boards
 */
export function getCommonBoards(): Array<{ name: string; fqbn: string; description: string }> {
  return [
    { name: "Arduino Uno", fqbn: "arduino:avr:uno", description: "Most common Arduino board" },
    { name: "Arduino Mega", fqbn: "arduino:avr:mega", description: "Arduino with more pins and memory" },
    { name: "Arduino Nano", fqbn: "arduino:avr:nano", description: "Compact Arduino board" },
    { name: "Arduino Leonardo", fqbn: "arduino:avr:leonardo", description: "Arduino with native USB" },
    { name: "Arduino Micro", fqbn: "arduino:avr:micro", description: "Small form factor Arduino" },
    { name: "ESP32", fqbn: "esp32:esp32:esp32", description: "ESP32 with WiFi and Bluetooth" },
    { name: "ESP8266", fqbn: "esp8266:esp8266:generic", description: "ESP8266 with WiFi" },
  ];
}
