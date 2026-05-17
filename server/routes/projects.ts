import { Router, Request, Response } from "express";

import { listProjectBrains } from "../services/project-brain-service";

const router = Router();

function getUserId(req: Request): string {
  return (req as any).authStatus?.userId || "guest";
}

router.get("/", async (req: Request, res: Response) => {
  try {
    getUserId(req);

    res.json({
      success: true,
      data: listProjectBrains(),
    });
  } catch (error) {
    console.error("[PROJECTS] Error listing project brains:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list projects",
    });
  }
});

export default router;
