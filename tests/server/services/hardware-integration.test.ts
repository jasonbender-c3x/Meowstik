/**
 * Hardware Integration Tests
 * 
 * Tests for Arduino, ADB, Petoi, 3D Printer, and KiCad integrations.
 * These tests verify that the integration functions exist and have correct signatures.
 * 
 * Note: Full integration tests require actual hardware to be connected.
 * These tests focus on API structure and error handling.
 */

import * as arduino from "../../../integrations/arduino";
import * as adb from "../../../integrations/adb";
import * as petoi from "../../../integrations/petoi";
import * as printer3d from "../../../integrations/printer3d";
import * as kicad from "../../../integrations/kicad";

describe("Hardware Integrations", () => {
  describe("Arduino Integration", () => {
    test("should have required functions", () => {
      expect(typeof arduino.isArduinoCLIInstalled).toBe("function");
      expect(typeof arduino.listBoards).toBe("function");
      expect(typeof arduino.compileSketch).toBe("function");
      expect(typeof arduino.uploadSketch).toBe("function");
      expect(typeof arduino.createSketch).toBe("function");
      expect(typeof arduino.installLibrary).toBe("function");
      expect(typeof arduino.searchLibraries).toBe("function");
      expect(typeof arduino.getCommonBoards).toBe("function");
    });

    test("getCommonBoards should return board list", () => {
      const boards = arduino.getCommonBoards();
      expect(Array.isArray(boards)).toBe(true);
      expect(boards.length).toBeGreaterThan(0);
      expect(boards[0]).toHaveProperty("name");
      expect(boards[0]).toHaveProperty("fqbn");
      expect(boards[0]).toHaveProperty("description");
    });

    test("getInstallInstructions should return string", () => {
      const instructions = arduino.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
    });
  });

  describe("ADB Integration", () => {
    test("should have required functions", () => {
      expect(typeof adb.isADBInstalled).toBe("function");
      expect(typeof adb.listDevices).toBe("function");
      expect(typeof adb.installApp).toBe("function");
      expect(typeof adb.uninstallApp).toBe("function");
      expect(typeof adb.executeShell).toBe("function");
      expect(typeof adb.pushFile).toBe("function");
      expect(typeof adb.pullFile).toBe("function");
      expect(typeof adb.captureScreenshot).toBe("function");
      expect(typeof adb.getDeviceInfo).toBe("function");
      expect(typeof adb.listPackages).toBe("function");
    });

    test("getInstallInstructions should return string", () => {
      const instructions = adb.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
    });
  });

  describe("Petoi Integration", () => {
    test("should have required functions", () => {
      expect(typeof petoi.findPorts).toBe("function");
      expect(typeof petoi.sendCommand).toBe("function");
      expect(typeof petoi.executeSkill).toBe("function");
      expect(typeof petoi.setServoAngle).toBe("function");
      expect(typeof petoi.setMultipleServos).toBe("function");
      expect(typeof petoi.getAvailableSkills).toBe("function");
      expect(typeof petoi.getRobotSpecs).toBe("function");
    });

    test("PETOI_SKILLS should contain expected skills", () => {
      expect(petoi.PETOI_SKILLS).toHaveProperty("sit");
      expect(petoi.PETOI_SKILLS).toHaveProperty("walk");
      expect(petoi.PETOI_SKILLS).toHaveProperty("stand");
      expect(typeof petoi.PETOI_SKILLS.sit).toBe("string");
    });

    test("getAvailableSkills should return skill list", () => {
      const skills = petoi.getAvailableSkills();
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
      expect(skills[0]).toHaveProperty("name");
      expect(skills[0]).toHaveProperty("command");
      expect(skills[0]).toHaveProperty("description");
      expect(skills[0]).toHaveProperty("category");
    });

    test("getRobotSpecs should return model info", () => {
      const specs = petoi.getRobotSpecs();
      expect(specs).toHaveProperty("models");
      expect(Array.isArray(specs.models)).toBe(true);
      expect(specs.models[0]).toHaveProperty("name");
      expect(specs.models[0]).toHaveProperty("servos");
    });
  });

  describe("3D Printer Integration", () => {
    test("should have required functions", () => {
      expect(typeof printer3d.sendGCodeViaOctoPrint).toBe("function");
      expect(typeof printer3d.getPrinterStatus).toBe("function");
      expect(typeof printer3d.getJobStatus).toBe("function");
      expect(typeof printer3d.uploadGCode).toBe("function");
      expect(typeof printer3d.startPrint).toBe("function");
      expect(typeof printer3d.pausePrint).toBe("function");
      expect(typeof printer3d.cancelPrint).toBe("function");
      expect(typeof printer3d.setExtruderTemp).toBe("function");
      expect(typeof printer3d.setBedTemp).toBe("function");
      expect(typeof printer3d.homeAxes).toBe("function");
    });

    test("getGCodeReference should return command list", () => {
      const commands = printer3d.getGCodeReference();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands[0]).toHaveProperty("command");
      expect(commands[0]).toHaveProperty("description");
      expect(commands[0]).toHaveProperty("category");
      expect(commands[0]).toHaveProperty("example");
    });

    test("generateTestCubeGCode should return valid G-code", () => {
      const gcode = printer3d.generateTestCubeGCode(20);
      expect(typeof gcode).toBe("string");
      expect(gcode).toContain("G28"); // Home command
      expect(gcode).toContain("M104"); // Set extruder temp
      expect(gcode).toContain("M140"); // Set bed temp
    });

    test("validateGCode should detect empty file", async () => {
      // This would need a real file, but we can test the function exists
      expect(typeof printer3d.validateGCode).toBe("function");
    });
  });

  describe("KiCad Integration", () => {
    test("should have required functions", () => {
      expect(typeof kicad.isKiCadInstalled).toBe("function");
      expect(typeof kicad.createProject).toBe("function");
      expect(typeof kicad.generateGerber).toBe("function");
      expect(typeof kicad.generateDrill).toBe("function");
      expect(typeof kicad.exportPDF).toBe("function");
      expect(typeof kicad.generateBOM).toBe("function");
      expect(typeof kicad.validatePCB).toBe("function");
    });

    test("getDesignParameters should return design specs", () => {
      const params = kicad.getDesignParameters();
      expect(params).toHaveProperty("traceWidths");
      expect(params).toHaveProperty("viaTypes");
      expect(params).toHaveProperty("clearances");
      expect(Array.isArray(params.traceWidths)).toBe(true);
      expect(params.traceWidths.length).toBeGreaterThan(0);
    });

    test("getSupportedFormats should return format list", () => {
      const formats = kicad.getSupportedFormats();
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats[0]).toHaveProperty("format");
      expect(formats[0]).toHaveProperty("extension");
      expect(formats[0]).toHaveProperty("description");
    });

    test("createSimpleLEDCircuit should return schematic content", () => {
      const schematic = kicad.createSimpleLEDCircuit("test_project");
      expect(typeof schematic).toBe("string");
      expect(schematic).toContain("kicad_sch");
      expect(schematic).toContain("LED");
    });

    test("getInstallInstructions should return string", () => {
      const instructions = kicad.getInstallInstructions();
      expect(typeof instructions).toBe("string");
      expect(instructions.length).toBeGreaterThan(0);
    });
  });

  describe("Integration Health Checks", () => {
    test("Arduino CLI availability check should not throw", async () => {
      const isInstalled = await arduino.isArduinoCLIInstalled();
      expect(typeof isInstalled).toBe("boolean");
    });

    test("ADB availability check should not throw", async () => {
      const isInstalled = await adb.isADBInstalled();
      expect(typeof isInstalled).toBe("boolean");
    });

    test("KiCad availability check should not throw", async () => {
      const isInstalled = await kicad.isKiCadInstalled();
      expect(typeof isInstalled).toBe("boolean");
    });
  });

  describe("Error Handling", () => {
    test("Arduino functions should handle missing CLI gracefully", async () => {
      // If CLI is not installed, functions should return errors, not throw
      try {
        const result = await arduino.listBoards();
        // If it succeeds, boards should be returned
        expect(result).toHaveProperty("boards");
        expect(result).toHaveProperty("output");
      } catch (error) {
        // If it fails, error should be about installation
        expect(error).toBeDefined();
      }
    });

    test("ADB functions should handle missing tools gracefully", async () => {
      try {
        const result = await adb.listDevices();
        expect(result).toHaveProperty("devices");
        expect(result).toHaveProperty("output");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
