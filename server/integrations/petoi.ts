/**
 * =============================================================================
 * PETOI ROBOT INTEGRATION SERVICE
 * =============================================================================
 * 
 * Provides tools for controlling Petoi robot pets (Bittle, Nybble).
 * Supports movement control, action sequences, and status monitoring.
 * 
 * DEPENDENCIES:
 * - Petoi robot connected via USB or Bluetooth
 * - Serial port communication (using serialport library if needed)
 * 
 * CAPABILITIES:
 * - Control robot movements (walk, run, turn, etc.)
 * - Execute predefined action sequences
 * - Send custom skill commands
 * - Monitor robot status and sensor data
 * - Calibrate servos
 * 
 * PROTOCOL:
 * Petoi robots use a simple serial command protocol
 * Commands are typically single characters or short strings
 * 
 * =============================================================================
 */

import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * Petoi skill commands (single character commands)
 */
export const PETOI_SKILLS = {
  // Basic movements
  sit: "ksit",
  stand: "kup",
  rest: "krest",
  
  // Gaits
  walk: "kwkF",
  walkBackward: "kwkL",
  trot: "ktrF",
  trotBackward: "ktrL",
  
  // Turns
  turnLeft: "kvtL",
  turnRight: "kvtR",
  
  // Special actions
  pushUp: "kpu",
  pee: "kpee",
  stretch: "kstr",
  shake: "kwkL",
  
  // Behaviors
  check: "kck",
  sniff: "ksn",
  scratch: "kscrh",
  
  // Calibration
  calibrate: "c",
  
  // Reset
  reset: "d",
} as const;

/**
 * Petoi joint commands for servo control
 */
export interface ServoPosition {
  joint: number;  // Joint index (0-15)
  angle: number;  // Angle in degrees (-125 to 125)
}

/**
 * Find available serial ports (potential Petoi devices)
 */
export async function findPorts(): Promise<{
  ports: Array<{
    path: string;
    manufacturer?: string;
    serialNumber?: string;
  }>;
  output: string;
}> {
  try {
    // Try to list serial ports using various methods
    let stdout = "";
    
    if (process.platform === "linux" || process.platform === "darwin") {
      // Unix-like systems
      const result = await execPromise("ls /dev/tty* 2>/dev/null | grep -E 'ttyUSB|ttyACM|cu.usb' || echo ''");
      stdout = result.stdout;
    } else if (process.platform === "win32") {
      // Windows
      try {
        const result = await execPromise("powershell -Command \"[System.IO.Ports.SerialPort]::getportnames()\"");
        stdout = result.stdout;
      } catch {
        stdout = "Unable to detect ports on Windows. Try specifying port manually (e.g., COM3)";
      }
    }
    
    const portPaths = stdout.split("\n").filter(p => p.trim());
    const ports = portPaths.map(path => ({ path: path.trim() }));
    
    return {
      ports,
      output: stdout,
    };
  } catch (error) {
    return {
      ports: [],
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send a command to Petoi robot via serial port
 * This is a simplified version - production code should use serialport library
 * 
 * @param port - Serial port (e.g., "/dev/ttyUSB0", "COM3")
 * @param command - Command string to send
 */
export async function sendCommand(
  port: string,
  command: string
): Promise<{ success: boolean; output: string }> {
  try {
    // Use echo with serial port redirection (works on Linux/Mac)
    // For Windows and robust implementation, should use serialport library
    if (process.platform === "linux" || process.platform === "darwin") {
      const { stdout, stderr } = await execPromise(
        `echo -n "${command}" > ${port}`,
        { timeout: 5000 }
      );
      return {
        success: true,
        output: `Command "${command}" sent to ${port}\n${stdout}${stderr}`,
      };
    } else {
      return {
        success: false,
        output: "Direct serial port writing not supported on Windows. Please use a serial communication library.",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      output: error.message,
    };
  }
}

/**
 * Execute a predefined skill on the robot
 * 
 * @param port - Serial port
 * @param skillName - Name of the skill from PETOI_SKILLS
 */
export async function executeSkill(
  port: string,
  skillName: keyof typeof PETOI_SKILLS
): Promise<{ success: boolean; output: string; command: string }> {
  const command = PETOI_SKILLS[skillName];
  
  if (!command) {
    return {
      success: false,
      output: `Unknown skill: ${skillName}`,
      command: "",
    };
  }
  
  const result = await sendCommand(port, command);
  
  return {
    ...result,
    command,
  };
}

/**
 * Control a specific servo/joint
 * 
 * @param port - Serial port
 * @param joint - Joint index (0-15)
 * @param angle - Target angle (-125 to 125)
 */
export async function setServoAngle(
  port: string,
  joint: number,
  angle: number
): Promise<{ success: boolean; output: string; command: string }> {
  // Validate inputs
  if (joint < 0 || joint > 15) {
    return {
      success: false,
      output: "Joint index must be between 0 and 15",
      command: "",
    };
  }
  
  if (angle < -125 || angle > 125) {
    return {
      success: false,
      output: "Angle must be between -125 and 125",
      command: "",
    };
  }
  
  // Format: i<joint> <angle>
  const command = `i${joint} ${angle}`;
  const result = await sendCommand(port, command);
  
  return {
    ...result,
    command,
  };
}

/**
 * Set multiple servo positions at once
 * 
 * @param port - Serial port
 * @param positions - Array of servo positions
 */
export async function setMultipleServos(
  port: string,
  positions: ServoPosition[]
): Promise<{ success: boolean; output: string; commands: string[] }> {
  const commands: string[] = [];
  const outputs: string[] = [];
  let allSuccess = true;
  
  for (const pos of positions) {
    const result = await setServoAngle(port, pos.joint, pos.angle);
    commands.push(result.command);
    outputs.push(result.output);
    
    if (!result.success) {
      allSuccess = false;
    }
    
    // Small delay between commands
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return {
    success: allSuccess,
    output: outputs.join("\n"),
    commands,
  };
}

/**
 * Execute a custom command string
 * 
 * @param port - Serial port
 * @param customCommand - Custom command string
 */
export async function sendCustomCommand(
  port: string,
  customCommand: string
): Promise<{ success: boolean; output: string }> {
  return sendCommand(port, customCommand);
}

/**
 * Perform servo calibration
 * 
 * @param port - Serial port
 */
export async function calibrate(port: string): Promise<{ success: boolean; output: string }> {
  return sendCommand(port, "c");
}

/**
 * Reset the robot to default pose
 * 
 * @param port - Serial port
 */
export async function reset(port: string): Promise<{ success: boolean; output: string }> {
  return sendCommand(port, "d");
}

/**
 * Create a custom gait sequence
 * A gait is a series of servo positions that define movement
 * 
 * @param name - Name for the gait
 * @param frames - Array of frames, each frame is an array of 16 servo angles
 */
export function createGait(
  name: string,
  frames: number[][]
): { name: string; frames: number[][]; command: string } {
  // Validate frames
  const validFrames = frames.filter(frame => frame.length === 16);
  
  if (validFrames.length !== frames.length) {
    console.warn("Some frames were invalid (not 16 servos) and were filtered out");
  }
  
  // Format gait command (this is a simplified version)
  // Real implementation would need proper Petoi gait format
  const command = `k${name.substring(0, 3)}`;
  
  return {
    name,
    frames: validFrames,
    command,
  };
}

/**
 * Get list of available skills with descriptions
 */
export function getAvailableSkills(): Array<{
  name: string;
  command: string;
  description: string;
  category: string;
}> {
  return [
    // Postures
    { name: "sit", command: "ksit", description: "Sit down", category: "posture" },
    { name: "stand", command: "kup", description: "Stand up", category: "posture" },
    { name: "rest", command: "krest", description: "Lie down to rest", category: "posture" },
    
    // Movement
    { name: "walk", command: "kwkF", description: "Walk forward", category: "movement" },
    { name: "walkBackward", command: "kwkL", description: "Walk backward", category: "movement" },
    { name: "trot", command: "ktrF", description: "Trot forward", category: "movement" },
    { name: "trotBackward", command: "ktrL", description: "Trot backward", category: "movement" },
    
    // Turning
    { name: "turnLeft", command: "kvtL", description: "Turn left", category: "turning" },
    { name: "turnRight", command: "kvtR", description: "Turn right", category: "turning" },
    
    // Actions
    { name: "pushUp", command: "kpu", description: "Do a push-up", category: "action" },
    { name: "pee", command: "kpee", description: "Lift leg (pee motion)", category: "action" },
    { name: "stretch", command: "kstr", description: "Stretch", category: "action" },
    
    // Behaviors
    { name: "check", command: "kck", description: "Look around", category: "behavior" },
    { name: "sniff", command: "ksn", description: "Sniff the ground", category: "behavior" },
    { name: "scratch", command: "kscrh", description: "Scratch", category: "behavior" },
    
    // System
    { name: "calibrate", command: "c", description: "Calibrate servos", category: "system" },
    { name: "reset", command: "d", description: "Reset to default pose", category: "system" },
  ];
}

/**
 * Get robot specifications
 */
export function getRobotSpecs(): {
  models: Array<{
    name: string;
    servos: number;
    description: string;
  }>;
} {
  return {
    models: [
      {
        name: "Bittle",
        servos: 12,
        description: "Quadruped robot dog with 12 servos"
      },
      {
        name: "Nybble",
        servos: 12,
        description: "Cat-like quadruped robot with 12 servos"
      },
      {
        name: "Bittle X",
        servos: 16,
        description: "Advanced version with 16 servos including head movement"
      },
    ],
  };
}
