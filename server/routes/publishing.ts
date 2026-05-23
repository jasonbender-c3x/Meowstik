import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./middleware";
import { publishingManager } from "../services/publishing-manager";

const router = Router();

const overviewQuerySchema = z.object({
  repoId: z.string().trim().min(1).optional(),
});

const launchSchema = z.object({
  launchScript: z.enum(["preview", "start", "dev"]).optional(),
  serviceName: z.string().trim().min(1).max(100).nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  healthCheckPath: z.string().trim().max(200).nullable().optional(),
  logPaths: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  runBuildFirst: z.boolean().optional(),
  forceRestart: z.boolean().optional(),
});

function requireAuthenticated(req: any, res: any): boolean {
  if (!req.authStatus?.userId || req.authStatus?.isGuest) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

function respondPublishingError(res: any, error: unknown): void {
  const message = error instanceof Error ? error.message : "Publishing action failed";
  const status = message.includes("forceRestart enabled") ? 409 : 400;
  res.status(status).json({ error: message });
}

router.use((req, res, next) => {
  if (!requireAuthenticated(req, res)) {
    return;
  }
  next();
});

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const parsed = overviewQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid publishing overview query" });
    }

    try {
      const overview = await publishingManager.getOverview(parsed.data.repoId);
      res.json(overview);
    } catch (error) {
      respondPublishingError(res, error);
    }
  })
);

router.post(
  "/starter-site/create",
  asyncHandler(async (_req, res) => {
    try {
      const overview = await publishingManager.createStarterSite();
      res.status(201).json(overview);
    } catch (error) {
      respondPublishingError(res, error);
    }
  })
);

router.post(
  "/projects/:repoId/build",
  asyncHandler(async (req, res) => {
    try {
      const overview = await publishingManager.runBuild(req.params.repoId);
      res.json(overview);
    } catch (error) {
      respondPublishingError(res, error);
    }
  })
);

router.post(
  "/projects/:repoId/launch",
  asyncHandler(async (req, res) => {
    const parsed = launchSchema.safeParse({
      ...req.body,
      port:
        req.body?.port === "" || req.body?.port === undefined || req.body?.port === null
          ? req.body?.port ?? undefined
          : Number(req.body.port),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid launch request" });
    }

    try {
      const overview = await publishingManager.launchProject(req.params.repoId, parsed.data);
      res.json(overview);
    } catch (error) {
      respondPublishingError(res, error);
    }
  })
);

router.post(
  "/projects/:repoId/stop",
  asyncHandler(async (req, res) => {
    try {
      const overview = await publishingManager.stopProject(req.params.repoId);
      res.json(overview);
    } catch (error) {
      respondPublishingError(res, error);
    }
  })
);

router.post(
  "/projects/:repoId/restart",
  asyncHandler(async (req, res) => {
    try {
      const overview = await publishingManager.restartProject(req.params.repoId);
      res.json(overview);
    } catch (error) {
      respondPublishingError(res, error);
    }
  })
);

export default router;
