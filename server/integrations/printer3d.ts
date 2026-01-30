/**
 * =============================================================================
 * 3D PRINTER INTEGRATION SERVICE
 * =============================================================================
 * 
 * Provides tools for controlling 3D printers via G-code.
 * Supports OctoPrint API, direct serial connection, and file-based printing.
 * 
 * CAPABILITIES:
 * - Send G-code commands to printer
 * - Monitor print status and progress
 * - Control printer temperature
 * - Home printer axes
 * - Start/pause/cancel prints
 * - Upload G-code files
 * 
 * SUPPORTED INTERFACES:
 * - OctoPrint REST API (recommended)
 * - Direct serial connection
 * - File-based (SD card)
 * 
 * =============================================================================
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execPromise = promisify(exec);

/**
 * OctoPrint connection configuration
 */
export interface OctoPrintConfig {
  host: string;       // e.g., "http://octopi.local"
  apiKey: string;     // API key from OctoPrint settings
  port?: number;      // Default: 80
}

/**
 * Printer status information
 */
export interface PrinterStatus {
  state: string;
  temperature?: {
    tool0?: { actual: number; target: number };
    bed?: { actual: number; target: number };
  };
  progress?: {
    completion: number;
    printTime: number;
    printTimeLeft: number;
  };
  file?: {
    name: string;
    size: number;
  };
}

/**
 * Send a G-code command to OctoPrint
 */
export async function sendGCodeViaOctoPrint(
  config: OctoPrintConfig,
  command: string
): Promise<{ success: boolean; output: string }> {
  try {
    const url = `${config.host}/api/printer/command`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({ command }),
    });

    const data = await response.text();
    
    return {
      success: response.ok,
      output: data || `G-code sent: ${command}`,
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get printer status from OctoPrint
 */
export async function getPrinterStatus(
  config: OctoPrintConfig
): Promise<{ success: boolean; status?: PrinterStatus; output: string }> {
  try {
    const url = `${config.host}/api/printer`;
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": config.apiKey,
      },
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      status: data as PrinterStatus,
      output: JSON.stringify(data, null, 2),
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get current print job status
 */
export async function getJobStatus(
  config: OctoPrintConfig
): Promise<{ success: boolean; job?: any; output: string }> {
  try {
    const url = `${config.host}/api/job`;
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": config.apiKey,
      },
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      job: data,
      output: JSON.stringify(data, null, 2),
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Upload a G-code file to OctoPrint
 */
export async function uploadGCode(
  config: OctoPrintConfig,
  filePath: string,
  select: boolean = false,
  print: boolean = false
): Promise<{ success: boolean; output: string }> {
  try {
    const fileContent = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    
    const formData = new FormData();
    formData.append("file", new Blob([fileContent]), fileName);
    if (select) formData.append("select", "true");
    if (print) formData.append("print", "true");

    const url = `${config.host}/api/files/local`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": config.apiKey,
      },
      body: formData,
    });

    const data = await response.text();
    
    return {
      success: response.ok,
      output: data || `File uploaded: ${fileName}`,
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Start a print job
 */
export async function startPrint(
  config: OctoPrintConfig
): Promise<{ success: boolean; output: string }> {
  try {
    const url = `${config.host}/api/job`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({ command: "start" }),
    });

    const data = await response.text();
    
    return {
      success: response.ok,
      output: data || "Print started",
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Pause a print job
 */
export async function pausePrint(
  config: OctoPrintConfig
): Promise<{ success: boolean; output: string }> {
  try {
    const url = `${config.host}/api/job`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({ command: "pause", action: "pause" }),
    });

    const data = await response.text();
    
    return {
      success: response.ok,
      output: data || "Print paused",
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Cancel a print job
 */
export async function cancelPrint(
  config: OctoPrintConfig
): Promise<{ success: boolean; output: string }> {
  try {
    const url = `${config.host}/api/job`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({ command: "cancel" }),
    });

    const data = await response.text();
    
    return {
      success: response.ok,
      output: data || "Print cancelled",
    };
  } catch (error) {
    return {
      success: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Set extruder temperature
 */
export async function setExtruderTemp(
  config: OctoPrintConfig,
  temperature: number,
  tool: number = 0
): Promise<{ success: boolean; output: string }> {
  const gcode = `M104 S${temperature} T${tool}`;
  return sendGCodeViaOctoPrint(config, gcode);
}

/**
 * Set bed temperature
 */
export async function setBedTemp(
  config: OctoPrintConfig,
  temperature: number
): Promise<{ success: boolean; output: string }> {
  const gcode = `M140 S${temperature}`;
  return sendGCodeViaOctoPrint(config, gcode);
}

/**
 * Home printer axes
 */
export async function homeAxes(
  config: OctoPrintConfig,
  axes: string = "XYZ"
): Promise<{ success: boolean; output: string }> {
  const gcode = `G28 ${axes}`;
  return sendGCodeViaOctoPrint(config, gcode);
}

/**
 * Move printer head
 */
export async function moveHead(
  config: OctoPrintConfig,
  x?: number,
  y?: number,
  z?: number,
  feedrate: number = 3000
): Promise<{ success: boolean; output: string }> {
  let gcode = "G1";
  if (x !== undefined) gcode += ` X${x}`;
  if (y !== undefined) gcode += ` Y${y}`;
  if (z !== undefined) gcode += ` Z${z}`;
  gcode += ` F${feedrate}`;
  
  return sendGCodeViaOctoPrint(config, gcode);
}

/**
 * Generate basic G-code for a test cube
 */
export function generateTestCubeGCode(size: number = 20): string {
  return `
; Test Cube ${size}mm
G21 ; Set units to millimeters
G90 ; Use absolute positioning
M82 ; Set extruder to absolute mode
M107 ; Turn off fan
G28 ; Home all axes
G1 Z15.0 F9000 ; Move the platform down 15mm

; Heat up
M104 S200 ; Set extruder temp
M140 S60 ; Set bed temp
M109 S200 ; Wait for extruder temp
M190 S60 ; Wait for bed temp

; Print square base
G1 Z0.3 F5000 ; First layer height
G1 X10 Y10 F1500 E5 ; Extrude to corner
G1 X${10 + size} Y10 E10
G1 X${10 + size} Y${10 + size} E15
G1 X10 Y${10 + size} E20
G1 X10 Y10 E25

; Print layers
G1 Z0.6 F5000
G1 X10 Y10 F1500 E30
G1 X${10 + size} Y10 E35
G1 X${10 + size} Y${10 + size} E40
G1 X10 Y${10 + size} E45
G1 X10 Y10 E50

; Finish
M104 S0 ; Turn off extruder
M140 S0 ; Turn off bed
G28 X0 ; Home X axis
M84 ; Disable motors
`.trim();
}

/**
 * Validate G-code file
 */
export async function validateGCode(filePath: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    lines: number;
    moves: number;
    extrusions: number;
  };
}> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    
    const errors: string[] = [];
    const warnings: string[] = [];
    let moves = 0;
    let extrusions = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith(";")) continue;
      
      // Count G1 moves
      if (line.startsWith("G1") || line.startsWith("G0")) {
        moves++;
        if (line.includes("E")) extrusions++;
      }
      
      // Basic validation
      if (line.length > 256) {
        warnings.push(`Line ${i + 1}: Very long command (${line.length} chars)`);
      }
    }
    
    if (moves === 0) {
      errors.push("No movement commands found in G-code");
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        lines: lines.length,
        moves,
        extrusions,
      },
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      stats: { lines: 0, moves: 0, extrusions: 0 },
    };
  }
}

/**
 * Get common G-code commands reference
 */
export function getGCodeReference(): Array<{
  command: string;
  description: string;
  category: string;
  example: string;
}> {
  return [
    // Motion
    { command: "G0/G1", description: "Linear move", category: "motion", example: "G1 X10 Y10 Z0.3 F1500" },
    { command: "G28", description: "Home axes", category: "motion", example: "G28 ; Home all" },
    { command: "G90", description: "Absolute positioning", category: "motion", example: "G90" },
    { command: "G91", description: "Relative positioning", category: "motion", example: "G91" },
    
    // Temperature
    { command: "M104", description: "Set extruder temp", category: "temperature", example: "M104 S200" },
    { command: "M109", description: "Wait for extruder temp", category: "temperature", example: "M109 S200" },
    { command: "M140", description: "Set bed temp", category: "temperature", example: "M140 S60" },
    { command: "M190", description: "Wait for bed temp", category: "temperature", example: "M190 S60" },
    
    // Fan
    { command: "M106", description: "Fan on", category: "fan", example: "M106 S255" },
    { command: "M107", description: "Fan off", category: "fan", example: "M107" },
    
    // Extrusion
    { command: "M82", description: "Absolute extrusion", category: "extrusion", example: "M82" },
    { command: "M83", description: "Relative extrusion", category: "extrusion", example: "M83" },
    
    // Motors
    { command: "M84", description: "Disable motors", category: "motors", example: "M84" },
    { command: "M17", description: "Enable motors", category: "motors", example: "M17" },
  ];
}
