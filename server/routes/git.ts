import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./middleware";
import { gitManager } from "../services/git-manager";

const router = Router();

const overviewQuerySchema = z.object({
  repoId: z.string().trim().min(1).optional(),
});

const addRepositorySchema = z.object({
  path: z.string().trim().min(1, "Repository path is required").max(1000, "Repository path is too long"),
});

const cloneRepositorySchema = z.object({
  url: z.string().trim().min(1, "Clone URL is required").max(2000, "Clone URL is too long"),
  targetPath: z.string().trim().min(1, "Target path is required").max(1000, "Target path is too long"),
});

const checkoutSchema = z.object({
  branchName: z.string().trim().min(1, "Branch name is required").max(255, "Branch name is too long"),
  create: z.boolean().optional(),
  startPoint: z.string().trim().max(255, "Start point is too long").nullable().optional(),
});

const commitSchema = z.object({
  message: z.string().trim().min(1, "Commit message is required").max(500, "Commit message is too long"),
});

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
  asyncHandler(async (req, res) => {
    const parsed = overviewQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid overview query" });
    }

    const overview = await gitManager.getOverview(parsed.data.repoId);
    res.json(overview);
  })
);

router.post(
  "/repositories/add",
  asyncHandler(async (req, res) => {
    const parsed = addRepositorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid repository path" });
    }

    const repository = await gitManager.addExistingRepository(parsed.data.path);
    res.status(201).json(repository);
  })
);

router.post(
  "/repositories/clone",
  asyncHandler(async (req, res) => {
    const parsed = cloneRepositorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid clone request" });
    }

    const repository = await gitManager.cloneRepository(parsed.data.url, parsed.data.targetPath);
    res.status(201).json(repository);
  })
);

router.delete(
  "/repositories/:id",
  asyncHandler(async (req, res) => {
    await gitManager.removeTrackedRepository(req.params.id);
    res.json({ success: true });
  })
);

router.post(
  "/repositories/:id/checkout",
  asyncHandler(async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid checkout request" });
    }

    const result = await gitManager.checkoutRepository(req.params.id, parsed.data);
    res.json(result);
  })
);

router.post(
  "/repositories/:id/commit",
  asyncHandler(async (req, res) => {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid commit request" });
    }

    const result = await gitManager.commitAllChanges(req.params.id, parsed.data.message);
    res.json(result);
  })
);

router.post(
  "/repositories/:id/pull",
  asyncHandler(async (req, res) => {
    const result = await gitManager.pullRepository(req.params.id);
    res.json(result);
  })
);

router.post(
  "/repositories/:id/push",
  asyncHandler(async (req, res) => {
    const result = await gitManager.pushRepository(req.params.id);
    res.json(result);
  })
);

export default router;
