/**
 * =============================================================================
 * ANDROID DEBUG BRIDGE (ADB) INTEGRATION SERVICE
 * =============================================================================
 * 
 * Provides tools for interacting with Android devices via ADB.
 * Supports device management, app installation, file transfer,
 * and shell command execution.
 * 
 * DEPENDENCIES:
 * - Android SDK Platform Tools (includes ADB)
 * - Install via: https://developer.android.com/tools/releases/platform-tools
 * 
 * CAPABILITIES:
 * - Detect connected Android devices
 * - Install/uninstall apps (APK files)
 * - Execute shell commands on device
 * - Transfer files to/from device
 * - Capture screenshots
 * - View device logs (logcat)
 * - Reboot device
 * 
 * =============================================================================
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execPromise = promisify(exec);

/**
 * Check if ADB is installed and available
 */
export async function isADBInstalled(): Promise<boolean> {
  try {
    await execPromise("adb version");
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get ADB installation instructions
 */
export function getInstallInstructions(): string {
  return `ADB is not installed. Please install Android SDK Platform Tools:
  
Download from: https://developer.android.com/tools/releases/platform-tools

Installation steps:
1. Download the platform-tools package for your OS
2. Extract the package
3. Add the platform-tools directory to your PATH

Verify installation with: adb version`;
}

/**
 * List all connected Android devices
 */
export async function listDevices(): Promise<{
  devices: Array<{
    serial: string;
    state: string;
    model?: string;
    device?: string;
  }>;
  output: string;
}> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const { stdout } = await execPromise("adb devices -l");
    const lines = stdout.split("\n").slice(1).filter(line => line.trim());
    
    const devices = lines.map(line => {
      const parts = line.split(/\s+/);
      const device: any = {
        serial: parts[0],
        state: parts[1],
      };
      
      // Parse additional properties
      parts.slice(2).forEach(part => {
        const [key, value] = part.split(":");
        if (key && value) {
          device[key] = value;
        }
      });
      
      return device;
    });
    
    return {
      devices,
      output: stdout,
    };
  } catch (error) {
    throw new Error(`Failed to list devices: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Install an APK on a device
 * 
 * @param apkPath - Path to the APK file
 * @param deviceSerial - Optional device serial (uses default if not specified)
 */
export async function installApp(
  apkPath: string,
  deviceSerial?: string
): Promise<{ success: boolean; output: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const { stdout, stderr } = await execPromise(`adb ${deviceFlag} install "${apkPath}"`);
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
 * Uninstall an app from a device
 * 
 * @param packageName - Package name (e.g., "com.example.app")
 * @param deviceSerial - Optional device serial
 */
export async function uninstallApp(
  packageName: string,
  deviceSerial?: string
): Promise<{ success: boolean; output: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const { stdout, stderr } = await execPromise(`adb ${deviceFlag} uninstall ${packageName}`);
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
 * Execute a shell command on the device
 * 
 * @param command - Shell command to execute
 * @param deviceSerial - Optional device serial
 */
export async function executeShell(
  command: string,
  deviceSerial?: string
): Promise<{ output: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const { stdout, stderr } = await execPromise(`adb ${deviceFlag} shell ${command}`);
    return {
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Push a file to the device
 * 
 * @param localPath - Path to local file
 * @param remotePath - Destination path on device
 * @param deviceSerial - Optional device serial
 */
export async function pushFile(
  localPath: string,
  remotePath: string,
  deviceSerial?: string
): Promise<{ success: boolean; output: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const { stdout, stderr } = await execPromise(
      `adb ${deviceFlag} push "${localPath}" "${remotePath}"`
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
 * Pull a file from the device
 * 
 * @param remotePath - Path on device
 * @param localPath - Destination path on local machine
 * @param deviceSerial - Optional device serial
 */
export async function pullFile(
  remotePath: string,
  localPath: string,
  deviceSerial?: string
): Promise<{ success: boolean; output: string; content?: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const { stdout, stderr } = await execPromise(
      `adb ${deviceFlag} pull "${remotePath}" "${localPath}"`
    );
    
    // Try to read the file content if it's text
    let content: string | undefined;
    try {
      content = await fs.readFile(localPath, "utf-8");
    } catch {
      // File might be binary, skip reading content
    }
    
    return {
      success: true,
      output: stdout + stderr,
      content,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Capture a screenshot from the device
 * 
 * @param outputPath - Local path to save screenshot
 * @param deviceSerial - Optional device serial
 */
export async function captureScreenshot(
  outputPath: string,
  deviceSerial?: string
): Promise<{ success: boolean; output: string; path: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  const remotePath = "/sdcard/screenshot.png";
  
  try {
    // Capture screenshot on device
    await execPromise(`adb ${deviceFlag} shell screencap -p ${remotePath}`);
    
    // Pull to local machine
    const { stdout, stderr } = await execPromise(
      `adb ${deviceFlag} pull ${remotePath} "${outputPath}"`
    );
    
    // Clean up device
    await execPromise(`adb ${deviceFlag} shell rm ${remotePath}`);
    
    return {
      success: true,
      output: stdout + stderr,
      path: outputPath,
    };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout + error.stderr || error.message,
      path: outputPath,
    };
  }
}

/**
 * Get device logcat output
 * 
 * @param lines - Number of lines to retrieve (default: 100)
 * @param filter - Optional filter expression
 * @param deviceSerial - Optional device serial
 */
export async function getLogcat(
  lines: number = 100,
  filter?: string,
  deviceSerial?: string
): Promise<{ output: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  const filterStr = filter ? ` ${filter}` : "";
  
  try {
    const { stdout } = await execPromise(
      `adb ${deviceFlag} logcat -d -t ${lines}${filterStr}`
    );
    return {
      output: stdout,
    };
  } catch (error: any) {
    return {
      output: error.stdout || error.message,
    };
  }
}

/**
 * Reboot the device
 * 
 * @param mode - Reboot mode: "normal", "recovery", or "bootloader"
 * @param deviceSerial - Optional device serial
 */
export async function rebootDevice(
  mode: "normal" | "recovery" | "bootloader" = "normal",
  deviceSerial?: string
): Promise<{ success: boolean; output: string }> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  const modeArg = mode === "normal" ? "" : ` ${mode}`;
  
  try {
    const { stdout, stderr } = await execPromise(`adb ${deviceFlag} reboot${modeArg}`);
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
 * Get device information
 * 
 * @param deviceSerial - Optional device serial
 */
export async function getDeviceInfo(deviceSerial?: string): Promise<{
  model?: string;
  androidVersion?: string;
  sdk?: string;
  manufacturer?: string;
  serialNumber?: string;
  output: string;
}> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const commands = [
      "getprop ro.product.model",
      "getprop ro.build.version.release",
      "getprop ro.build.version.sdk",
      "getprop ro.product.manufacturer",
      "getprop ro.serialno",
    ];
    
    const results = await Promise.all(
      commands.map(cmd => execPromise(`adb ${deviceFlag} shell ${cmd}`).catch(() => ({ stdout: "unknown" })))
    );
    
    return {
      model: results[0].stdout.trim(),
      androidVersion: results[1].stdout.trim(),
      sdk: results[2].stdout.trim(),
      manufacturer: results[3].stdout.trim(),
      serialNumber: results[4].stdout.trim(),
      output: results.map(r => r.stdout).join("\n"),
    };
  } catch (error) {
    throw new Error(`Failed to get device info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List installed packages on device
 * 
 * @param deviceSerial - Optional device serial
 */
export async function listPackages(deviceSerial?: string): Promise<{
  packages: string[];
  output: string;
}> {
  if (!(await isADBInstalled())) {
    throw new Error(getInstallInstructions());
  }

  const deviceFlag = deviceSerial ? `-s ${deviceSerial}` : "";
  
  try {
    const { stdout } = await execPromise(`adb ${deviceFlag} shell pm list packages`);
    const packages = stdout
      .split("\n")
      .filter(line => line.startsWith("package:"))
      .map(line => line.replace("package:", "").trim())
      .filter(Boolean);
    
    return {
      packages,
      output: stdout,
    };
  } catch (error) {
    throw new Error(`Failed to list packages: ${error instanceof Error ? error.message : String(error)}`);
  }
}
