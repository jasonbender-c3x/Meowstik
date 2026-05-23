import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./middleware";
import { publishingManager } from "../services/publishing-manager";

const router = Router();

const overviewQuerySchema = z.object({
  repoId: z.string().trim().min(1).optional(),
});

function requireAuthenticated(req: any, res: any): boolean {
  if (!req.authStatus?.userId || req.authStatus?.isGuest) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

function respondDeploymentsError(res: any, error: unknown): void {
  const message = error instanceof Error ? error.message : "Deployments action failed";
  res.status(400).json({ error: message });
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
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid deployments overview query" });
    }

    try {
      const overview = await publishingManager.getDeploymentsOverview(parsed.data.repoId);
      res.json(overview);
    } catch (error) {
      respondDeploymentsError(res, error);
    }
  })
);

router.post(
  "/projects/:repoId/deployments/:deploymentId/activate",
  asyncHandler(async (req, res) => {
    try {
      const overview = await publishingManager.activateDeployment(req.params.repoId, req.params.deploymentId);
      res.json(overview);
    } catch (error) {
      respondDeploymentsError(res, error);
    }
  })
);

export default router;
