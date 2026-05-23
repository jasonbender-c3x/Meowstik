import { Router } from "express";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { getDb } from "../db";
import { agentWorkers } from "@shared/schema";
import jobDispatcher from "../services/job-dispatcher";
import { asyncHandler } from "./middleware";
import { runtimeManager } from "../services/runtime-manager";

const router = Router();

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  command: z.string().trim().min(1, "Command is required").max(2000, "Command is too long"),
  cwd: z.string().trim().min(1, "Working directory is required").max(500, "Working directory is too long"),
  port: z
    .number()
    .int()
    .min(1, "Port must be greater than 0")
    .max(65535, "Port must be less than 65536")
    .nullable()
    .optional(),
  healthCheckPath: z.string().trim().max(200, "Health check path is too long").nullable().optional(),
  healthCheckUrl: z.string().trim().max(500, "Health check URL is too long").nullable().optional(),
  logPaths: z.array(z.string().trim().min(1).max(500, "Log path is too long")).max(20).optional(),
});

const serviceUpdateSchema = serviceSchema.partial();

function requireAuthenticated(req: any, res: any): boolean {
  if (!req.authStatus?.userId || req.authStatus?.isGuest) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

router.use((req, res, next) => {
  if (!requireAuthenticated(req, res)) {
    return;
  }
  next();
});

router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [services, listeners, dispatcherStats, workers] = await Promise.all([
      runtimeManager.listServices(),
      runtimeManager.listListeners(),
      jobDispatcher.getDispatcherStats(),
      getDb().select().from(agentWorkers).orderBy(desc(agentWorkers.lastHeartbeat)),
    ]);

    res.json({
      cwd: process.cwd(),
      processInfo: {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
      },
      services,
      listeners,
      dispatcher: {
        stats: dispatcherStats,
        workers,
      },
    });
  })
);

router.post(
  "/services",
  asyncHandler(async (req, res) => {
    const parsed = serviceSchema.safeParse({
      ...req.body,
      port: req.body?.port === "" || req.body?.port === undefined ? null : Number(req.body.port),
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid service definition" });
    }

    const service = await runtimeManager.createService(parsed.data);
    res.status(201).json(service);
  })
);

router.put(
  "/services/:id",
  asyncHandler(async (req, res) => {
    const parsed = serviceUpdateSchema.safeParse({
      ...req.body,
      port:
        req.body?.port === "" || req.body?.port === undefined || req.body?.port === null
          ? req.body?.port ?? undefined
          : Number(req.body.port),
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid service update" });
    }

    const service = await runtimeManager.updateService(req.params.id, parsed.data);
    res.json(service);
  })
);

router.delete(
  "/services/:id",
  asyncHandler(async (req, res) => {
    await runtimeManager.deleteService(req.params.id);
    res.json({ success: true });
  })
);

router.post(
  "/services/:id/start",
  asyncHandler(async (req, res) => {
    const service = await runtimeManager.startService(req.params.id);
    res.json(service);
  })
);

router.post(
  "/services/:id/stop",
  asyncHandler(async (req, res) => {
    const service = await runtimeManager.stopService(req.params.id);
    res.json(service);
  })
);

router.post(
  "/services/:id/restart",
  asyncHandler(async (req, res) => {
    const service = await runtimeManager.restartService(req.params.id);
    res.json(service);
  })
);

router.post(
  "/dispatcher/start",
  asyncHandler(async (_req, res) => {
    await jobDispatcher.start();
    res.json({ success: true });
  })
);

router.post(
  "/dispatcher/stop",
  asyncHandler(async (_req, res) => {
    await jobDispatcher.stop();
    res.json({ success: true });
  })
);

export default router;
