
import { Router } from "express";
import { db } from "../db";
import { cameras, insertCameraSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const onvif = require("node-onvif");
import { spawn } from "child_process";

const router = Router();

// List cameras
router.get("/", async (req, res) => {
  try {
    const allCameras = await db.select().from(cameras);
    res.json(allCameras);
  } catch (error) {
    console.error("Error listing cameras:", error);
    res.status(500).json({ error: "Failed to list cameras" });
  }
});

// Add camera
router.post("/", async (req, res) => {
  try {
    const result = insertCameraSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const [camera] = await db.insert(cameras).values(result.data).returning();
    res.json(camera);
  } catch (error) {
    console.error("Error adding camera:", error);
    res.status(500).json({ error: "Failed to add camera" });
  }
});

// Delete camera
router.delete("/:id", async (req, res) => {
  try {
    await db.delete(cameras).where(eq(cameras.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting camera:", error);
    res.status(500).json({ error: "Failed to delete camera" });
  }
});

// PTZ Control
router.post("/:id/ptz", async (req, res) => {
  const { action, speed = 0.5 } = req.body;
  try {
    const [camera] = await db.select().from(cameras).where(eq(cameras.id, req.params.id));
    
    if (!camera) return res.status(404).json({ error: "Camera not found" });

    const device = new onvif.OnvifDevice({
      xaddr: `http://${camera.ip}:${camera.onvifPort}/onvif/device_service`,
      user: camera.username || "admin",
      pass: camera.password || "admin"
    });

    console.log(`Initializing ONVIF device at ${camera.ip}...`);
    await device.init();

    let x = 0, y = 0, z = 0;
    switch(action) {
      case "left": x = -speed; break;
      case "right": x = speed; break;
      case "up": y = speed; break;
      case "down": y = -speed; break;
      case "in": z = speed; break; // Zoom In
      case "out": z = -speed; break; // Zoom Out
      case "stop": break;
      default: return res.status(400).json({ error: "Invalid action" });
    }

    console.log(`Sending PTZ move: x=${x}, y=${y}, z=${z}`);
    await device.ptzMove({ speed: { x, y, z }, timeout: 1 });
    res.json({ success: true });
  } catch (error) {
    console.error("PTZ Error:", error);
    res.status(500).json({ error: "PTZ command failed: " + (error instanceof Error ? error.message : String(error)) });
  }
});

// Snapshot (via ffmpeg from RTSP)
router.get("/:id/snapshot", async (req, res) => {
  try {
    const [camera] = await db.select().from(cameras).where(eq(cameras.id, req.params.id));
    if (!camera) return res.status(404).send("Camera not found");

    const rtspUrl = `rtsp://${camera.username}:${camera.password}@${camera.ip}:${camera.rtspPort}/onvif1`;
    console.log(`Fetching snapshot from ${rtspUrl}`);
    
    // Use ffmpeg to grab a single frame
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-rtsp_transport", "tcp",
      "-i", rtspUrl,
      "-frames:v", "1",
      "-f", "image2",
      "-", // Output to stdout
    ]);

    res.setHeader("Content-Type", "image/jpeg");
    ffmpeg.stdout.pipe(res);
    
    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
        if (code !== 0) {
            console.error(`ffmpeg exited with code ${code}`);
            console.error(stderr);
            if (!res.headersSent) res.status(500).send("Failed to capture snapshot");
        }
    });

  } catch (error) {
    console.error("Snapshot Error:", error);
    if (!res.headersSent) res.status(500).send("Snapshot failed");
  }
});

export default router;
