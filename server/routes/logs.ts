import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "./middleware";
import { logManager } from "../services/log-manager";

const router = Router();

const overviewQuerySchema = z.object({
  sourceId: z.string().trim().min(1).optional(),
  serviceId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
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
      return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid log query" });
    }

    const overview = await logManager.getOverview(parsed.data);
    res.json(overview);
  })
);

router.get(
  "/sources/:sourceId/export",
  asyncHandler(async (req, res) => {
    const query = overviewQuerySchema.pick({ limit: true }).safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({ error: query.error.errors[0]?.message || "Invalid export query" });
    }

    const exported = await logManager.exportSource(req.params.sourceId, query.data.limit);
    res.setHeader("Content-Type", exported.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(req.params.sourceId)}.log"`);
    res.setHeader("X-Meowstik-Truncated", exported.truncated ? "true" : "false");
    res.send(exported.content);
  })
);

export default router;
