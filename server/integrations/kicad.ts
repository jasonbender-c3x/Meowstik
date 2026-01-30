/**
 * =============================================================================
 * KICAD INTEGRATION SERVICE
 * =============================================================================
 * 
 * Provides tools for electronic board design using KiCad.
 * Supports generating PCB design files, schematics, and Gerber files.
 * 
 * DEPENDENCIES:
 * - KiCad must be installed on the system
 * - Install from: https://www.kicad.org/download/
 * 
 * CAPABILITIES:
 * - Create new KiCad projects
 * - Generate schematic files (.kicad_sch)
 * - Generate PCB layout files (.kicad_pcb)
 * - Export Gerber files for manufacturing
 * - Export drill files
 * - Generate bill of materials (BOM)
 * - Validate designs
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
 * Check if KiCad is installed
 */
export async function isKiCadInstalled(): Promise<boolean> {
  try {
    // Try multiple possible KiCad CLI names
    const commands = [
      "kicad-cli --version",
      "kicad --version",
      "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli --version",
    ];
    
    for (const cmd of commands) {
      try {
        await execPromise(cmd);
        return true;
      } catch {
        continue;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get KiCad installation instructions
 */
export function getInstallInstructions(): string {
  return `KiCad is not installed or not in PATH. Please install it from:
  
https://www.kicad.org/download/

Installation:
- Linux: sudo apt install kicad or use your package manager
- macOS: Download DMG from website or use 'brew install --cask kicad'
- Windows: Download installer from website

After installation, ensure 'kicad-cli' is in your PATH.`;
}

/**
 * Create a new KiCad project
 */
export async function createProject(
  projectName: string,
  outputDir?: string
): Promise<{ success: boolean; projectPath: string; output: string }> {
  if (!(await isKiCadInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const projectDir = outputDir || path.join(os.tmpdir(), "kicad-projects", projectName);
    await fs.mkdir(projectDir, { recursive: true });
    
    const projectFile = path.join(projectDir, `${projectName}.kicad_pro`);
    const schematicFile = path.join(projectDir, `${projectName}.kicad_sch`);
    const pcbFile = path.join(projectDir, `${projectName}.kicad_pcb`);
    
    // Create basic project file
    const projectContent = {
      "board": {
        "design_settings": {
          "defaults": {
            "board_outline_line_width": 0.1,
            "copper_line_width": 0.2
          }
        }
      },
      "schematic": {
        "drawing": {
          "default_line_thickness": 6.0
        }
      }
    };
    
    await fs.writeFile(projectFile, JSON.stringify(projectContent, null, 2));
    
    // Create empty schematic
    const schematicContent = `(kicad_sch (version 20230121) (generator eeschema)
  (uuid ${generateUUID()})
  (paper "A4")
  (title_block
    (title "${projectName}")
    (date "${new Date().toISOString().split('T')[0]}")
  )
)`;
    
    await fs.writeFile(schematicFile, schematicContent);
    
    // Create empty PCB
    const pcbContent = `(kicad_pcb (version 20221018) (generator pcbnew)
  (general
    (thickness 1.6)
  )
  (paper "A4")
  (title_block
    (title "${projectName}")
    (date "${new Date().toISOString().split('T')[0]}")
  )
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user)
    (33 "F.Adhes" user)
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user)
    (37 "F.SilkS" user)
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user)
    (41 "Cmts.User" user)
    (42 "Eco1.User" user)
    (43 "Eco2.User" user)
    (44 "Edge.Cuts" user)
  )
)`;
    
    await fs.writeFile(pcbFile, pcbContent);
    
    return {
      success: true,
      projectPath: projectDir,
      output: `Project created at: ${projectDir}\nFiles:\n- ${projectFile}\n- ${schematicFile}\n- ${pcbFile}`,
    };
  } catch (error: any) {
    return {
      success: false,
      projectPath: "",
      output: error.message,
    };
  }
}

/**
 * Generate Gerber files from PCB
 */
export async function generateGerber(
  pcbFilePath: string,
  outputDir?: string
): Promise<{ success: boolean; gerberDir: string; files: string[]; output: string }> {
  if (!(await isKiCadInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const gerberDir = outputDir || path.join(path.dirname(pcbFilePath), "gerber");
    await fs.mkdir(gerberDir, { recursive: true });
    
    // Use KiCad CLI to export Gerber files
    const { stdout, stderr } = await execPromise(
      `kicad-cli pcb export gerber "${pcbFilePath}" -o "${gerberDir}"`,
      { timeout: 30000 }
    );
    
    // List generated files
    const files = await fs.readdir(gerberDir);
    
    return {
      success: true,
      gerberDir,
      files,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      gerberDir: "",
      files: [],
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Generate drill files
 */
export async function generateDrill(
  pcbFilePath: string,
  outputDir?: string
): Promise<{ success: boolean; drillFile: string; output: string }> {
  if (!(await isKiCadInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const drillDir = outputDir || path.join(path.dirname(pcbFilePath), "drill");
    await fs.mkdir(drillDir, { recursive: true });
    
    const { stdout, stderr } = await execPromise(
      `kicad-cli pcb export drill "${pcbFilePath}" -o "${drillDir}"`,
      { timeout: 30000 }
    );
    
    return {
      success: true,
      drillFile: drillDir,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      drillFile: "",
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Export PCB as PDF
 */
export async function exportPDF(
  pcbFilePath: string,
  outputPath?: string
): Promise<{ success: boolean; pdfPath: string; output: string }> {
  if (!(await isKiCadInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const pdfPath = outputPath || pcbFilePath.replace(/\.kicad_pcb$/, ".pdf");
    
    const { stdout, stderr } = await execPromise(
      `kicad-cli pcb export pdf "${pcbFilePath}" -o "${pdfPath}"`,
      { timeout: 30000 }
    );
    
    return {
      success: true,
      pdfPath,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      pdfPath: "",
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Generate Bill of Materials (BOM)
 */
export async function generateBOM(
  schematicFilePath: string,
  outputPath?: string
): Promise<{ success: boolean; bomPath: string; output: string }> {
  if (!(await isKiCadInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    const bomPath = outputPath || schematicFilePath.replace(/\.kicad_sch$/, "_bom.csv");
    
    const { stdout, stderr } = await execPromise(
      `kicad-cli sch export bom "${schematicFilePath}" -o "${bomPath}"`,
      { timeout: 30000 }
    );
    
    return {
      success: true,
      bomPath,
      output: stdout + stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      bomPath: "",
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Validate PCB design
 */
export async function validatePCB(
  pcbFilePath: string
): Promise<{ success: boolean; errors: string[]; warnings: string[]; output: string }> {
  if (!(await isKiCadInstalled())) {
    throw new Error(getInstallInstructions());
  }

  try {
    // Run DRC (Design Rule Check)
    const { stdout, stderr } = await execPromise(
      `kicad-cli pcb drc "${pcbFilePath}"`,
      { timeout: 30000 }
    );
    
    // Parse output for errors and warnings
    const output = stdout + stderr;
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.toLowerCase().includes("error")) {
        errors.push(line.trim());
      } else if (line.toLowerCase().includes("warning")) {
        warnings.push(line.trim());
      }
    }
    
    return {
      success: errors.length === 0,
      errors,
      warnings,
      output,
    };
  } catch (error: any) {
    return {
      success: false,
      errors: ["Validation failed: " + error.message],
      warnings: [],
      output: error.stdout + error.stderr || error.message,
    };
  }
}

/**
 * Create a simple LED circuit schematic
 */
export function createSimpleLEDCircuit(projectName: string): string {
  return `(kicad_sch (version 20230121) (generator eeschema)
  (uuid ${generateUUID()})
  (paper "A4")
  (title_block
    (title "${projectName} - Simple LED Circuit")
    (date "${new Date().toISOString().split('T')[0]}")
    (comment 1 "Basic LED with current limiting resistor")
  )
  
  (symbol (lib_id "Device:LED") (at 100 100 0) (unit 1)
    (uuid ${generateUUID()})
    (property "Reference" "D1" (id 0) (at 100 95 0))
    (property "Value" "LED" (id 1) (at 100 105 0))
  )
  
  (symbol (lib_id "Device:R") (at 80 100 0) (unit 1)
    (uuid ${generateUUID()})
    (property "Reference" "R1" (id 0) (at 80 95 0))
    (property "Value" "220R" (id 1) (at 80 105 0))
  )
  
  (symbol (lib_id "power:+5V") (at 60 100 0) (unit 1)
    (uuid ${generateUUID()})
  )
  
  (symbol (lib_id "power:GND") (at 120 100 0) (unit 1)
    (uuid ${generateUUID()})
  )
)`;
}

/**
 * Get common PCB design parameters
 */
export function getDesignParameters(): {
  traceWidths: Array<{ current: number; width: number; description: string }>;
  viaTypes: Array<{ name: string; drill: number; diameter: number; description: string }>;
  clearances: Array<{ name: string; value: number; description: string }>;
} {
  return {
    traceWidths: [
      { current: 0.5, width: 0.2, description: "Signal traces (0.5A)" },
      { current: 1.0, width: 0.4, description: "Low power (1A)" },
      { current: 2.0, width: 0.8, description: "Medium power (2A)" },
      { current: 3.0, width: 1.5, description: "High power (3A)" },
    ],
    viaTypes: [
      { name: "Standard", drill: 0.3, diameter: 0.6, description: "Standard through-hole via" },
      { name: "Small", drill: 0.2, diameter: 0.45, description: "Small via for dense routing" },
      { name: "Large", drill: 0.6, diameter: 1.2, description: "Large via for high current" },
    ],
    clearances: [
      { name: "Track to track", value: 0.2, description: "Minimum clearance between traces" },
      { name: "Track to pad", value: 0.2, description: "Minimum clearance trace to pad" },
      { name: "Pad to pad", value: 0.2, description: "Minimum clearance between pads" },
    ],
  };
}

/**
 * Helper to generate UUID for KiCad objects
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get supported export formats
 */
export function getSupportedFormats(): Array<{
  format: string;
  extension: string;
  description: string;
  usage: string;
}> {
  return [
    { format: "Gerber", extension: ".gbr", description: "Manufacturing files", usage: "PCB fabrication" },
    { format: "Drill", extension: ".drl", description: "Drill/hole data", usage: "PCB drilling" },
    { format: "PDF", extension: ".pdf", description: "Visual documentation", usage: "Review and documentation" },
    { format: "SVG", extension: ".svg", description: "Vector graphics", usage: "Documentation and web" },
    { format: "BOM", extension: ".csv", description: "Bill of materials", usage: "Parts ordering" },
    { format: "Netlist", extension: ".net", description: "Circuit connectivity", usage: "Simulation and verification" },
  ];
}
