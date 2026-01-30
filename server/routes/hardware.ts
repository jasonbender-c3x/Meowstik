/**
 * =============================================================================
 * HARDWARE & IOT DEVICE ROUTES
 * =============================================================================
 * 
 * API routes for interacting with hardware and IoT devices.
 * Provides endpoints for Arduino, ADB, Petoi robots, 3D printers, and KiCad.
 * 
 * =============================================================================
 */

import { Router } from "express";
import { z } from "zod";
import * as arduino from "../integrations/arduino";
import * as adb from "../integrations/adb";
import * as petoi from "../integrations/petoi";
import * as printer3d from "../integrations/printer3d";
import * as kicad from "../integrations/kicad";

const router = Router();

// =============================================================================
// ARDUINO ROUTES
// =============================================================================

router.get("/arduino/boards", async (_req, res) => {
  try {
    const result = await arduino.listBoards();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/arduino/compile", async (req, res) => {
  try {
    const schema = z.object({
      sketchPath: z.string(),
      fqbn: z.string(),
    });
    const { sketchPath, fqbn } = schema.parse(req.body);
    
    const result = await arduino.compileSketch(sketchPath, fqbn);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/arduino/upload", async (req, res) => {
  try {
    const schema = z.object({
      sketchPath: z.string(),
      fqbn: z.string(),
      port: z.string(),
    });
    const { sketchPath, fqbn, port } = schema.parse(req.body);
    
    const result = await arduino.uploadSketch(sketchPath, fqbn, port);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/arduino/create-sketch", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string(),
      code: z.string().optional(),
    });
    const { name, code } = schema.parse(req.body);
    
    const result = await arduino.createSketch(name, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/arduino/library/install", async (req, res) => {
  try {
    const schema = z.object({
      libraryName: z.string(),
    });
    const { libraryName } = schema.parse(req.body);
    
    const result = await arduino.installLibrary(libraryName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/arduino/library/search", async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    
    const result = await arduino.searchLibraries(query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/arduino/boards/common", async (_req, res) => {
  res.json({ boards: arduino.getCommonBoards() });
});

// =============================================================================
// ADB (ANDROID) ROUTES
// =============================================================================

router.get("/adb/devices", async (_req, res) => {
  try {
    const result = await adb.listDevices();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/adb/install", async (req, res) => {
  try {
    const schema = z.object({
      apkPath: z.string(),
      deviceSerial: z.string().optional(),
    });
    const { apkPath, deviceSerial } = schema.parse(req.body);
    
    const result = await adb.installApp(apkPath, deviceSerial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/adb/uninstall", async (req, res) => {
  try {
    const schema = z.object({
      packageName: z.string(),
      deviceSerial: z.string().optional(),
    });
    const { packageName, deviceSerial } = schema.parse(req.body);
    
    const result = await adb.uninstallApp(packageName, deviceSerial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/adb/shell", async (req, res) => {
  try {
    const schema = z.object({
      command: z.string(),
      deviceSerial: z.string().optional(),
    });
    const { command, deviceSerial } = schema.parse(req.body);
    
    const result = await adb.executeShell(command, deviceSerial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/adb/screenshot", async (req, res) => {
  try {
    const schema = z.object({
      outputPath: z.string(),
      deviceSerial: z.string().optional(),
    });
    const { outputPath, deviceSerial } = schema.parse(req.body);
    
    const result = await adb.captureScreenshot(outputPath, deviceSerial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/adb/device-info", async (req, res) => {
  try {
    const deviceSerial = req.query.serial as string | undefined;
    const result = await adb.getDeviceInfo(deviceSerial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/adb/packages", async (req, res) => {
  try {
    const deviceSerial = req.query.serial as string | undefined;
    const result = await adb.listPackages(deviceSerial);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// =============================================================================
// PETOI ROBOT ROUTES
// =============================================================================

router.get("/petoi/ports", async (_req, res) => {
  try {
    const result = await petoi.findPorts();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/petoi/skill", async (req, res) => {
  try {
    const schema = z.object({
      port: z.string(),
      skillName: z.string(),
    });
    const { port, skillName } = schema.parse(req.body);
    
    const result = await petoi.executeSkill(port, skillName as keyof typeof petoi.PETOI_SKILLS);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/petoi/servo", async (req, res) => {
  try {
    const schema = z.object({
      port: z.string(),
      joint: z.number(),
      angle: z.number(),
    });
    const { port, joint, angle } = schema.parse(req.body);
    
    const result = await petoi.setServoAngle(port, joint, angle);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/petoi/command", async (req, res) => {
  try {
    const schema = z.object({
      port: z.string(),
      command: z.string(),
    });
    const { port, command } = schema.parse(req.body);
    
    const result = await petoi.sendCustomCommand(port, command);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/petoi/skills", async (_req, res) => {
  res.json({ skills: petoi.getAvailableSkills() });
});

router.get("/petoi/specs", async (_req, res) => {
  res.json(petoi.getRobotSpecs());
});

// =============================================================================
// 3D PRINTER ROUTES
// =============================================================================

router.post("/printer/gcode", async (req, res) => {
  try {
    const schema = z.object({
      host: z.string(),
      apiKey: z.string(),
      command: z.string(),
    });
    const { host, apiKey, command } = schema.parse(req.body);
    
    const result = await printer3d.sendGCodeViaOctoPrint({ host, apiKey }, command);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/printer/status", async (req, res) => {
  try {
    const schema = z.object({
      host: z.string(),
      apiKey: z.string(),
    });
    const { host, apiKey } = schema.parse(req.body);
    
    const result = await printer3d.getPrinterStatus({ host, apiKey });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/printer/job/start", async (req, res) => {
  try {
    const schema = z.object({
      host: z.string(),
      apiKey: z.string(),
    });
    const { host, apiKey } = schema.parse(req.body);
    
    const result = await printer3d.startPrint({ host, apiKey });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/printer/job/pause", async (req, res) => {
  try {
    const schema = z.object({
      host: z.string(),
      apiKey: z.string(),
    });
    const { host, apiKey } = schema.parse(req.body);
    
    const result = await printer3d.pausePrint({ host, apiKey });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/printer/job/cancel", async (req, res) => {
  try {
    const schema = z.object({
      host: z.string(),
      apiKey: z.string(),
    });
    const { host, apiKey } = schema.parse(req.body);
    
    const result = await printer3d.cancelPrint({ host, apiKey });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/printer/gcode/reference", async (_req, res) => {
  res.json({ commands: printer3d.getGCodeReference() });
});

// =============================================================================
// KICAD ROUTES
// =============================================================================

router.post("/kicad/project/create", async (req, res) => {
  try {
    const schema = z.object({
      projectName: z.string(),
      outputDir: z.string().optional(),
    });
    const { projectName, outputDir } = schema.parse(req.body);
    
    const result = await kicad.createProject(projectName, outputDir);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/kicad/gerber/generate", async (req, res) => {
  try {
    const schema = z.object({
      pcbFilePath: z.string(),
      outputDir: z.string().optional(),
    });
    const { pcbFilePath, outputDir } = schema.parse(req.body);
    
    const result = await kicad.generateGerber(pcbFilePath, outputDir);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/kicad/drill/generate", async (req, res) => {
  try {
    const schema = z.object({
      pcbFilePath: z.string(),
      outputDir: z.string().optional(),
    });
    const { pcbFilePath, outputDir } = schema.parse(req.body);
    
    const result = await kicad.generateDrill(pcbFilePath, outputDir);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/kicad/validate", async (req, res) => {
  try {
    const schema = z.object({
      pcbFilePath: z.string(),
    });
    const { pcbFilePath } = schema.parse(req.body);
    
    const result = await kicad.validatePCB(pcbFilePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/kicad/parameters", async (_req, res) => {
  res.json(kicad.getDesignParameters());
});

router.get("/kicad/formats", async (_req, res) => {
  res.json({ formats: kicad.getSupportedFormats() });
});

export default router;
