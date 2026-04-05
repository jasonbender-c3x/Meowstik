
import { Router, Request, Response } from "express";
import { playbookService } from "../services/playbook-executor";

const router = Router();

/**
 * List available playbooks
 */
router.get("/", (req: Request, res: Response) => {
  const playbooks = playbookService.getPlaybooks();
  res.json({ playbooks });
});

/**
 * Get specific playbook
 */
router.get("/:id", (req: Request, res: Response) => {
  const playbook = playbookService.getPlaybook(req.params.id);
  if (!playbook) {
    return res.status(404).json({ error: "Playbook not found" });
  }
  res.json(playbook);
});

/**
 * Start a playbook session
 */
router.post("/:id/start", (req: Request, res: Response) => {
  try {
    const { variables } = req.body;
    const session = playbookService.startSession(req.params.id, variables);
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute next step in session
 */
router.post("/sessions/:sessionId/next", async (req: Request, res: Response) => {
  try {
    const { desktopSessionId } = req.body;
    if (!desktopSessionId) {
      return res.status(400).json({ error: "desktopSessionId is required" });
    }

    const result = await playbookService.executeCurrentStep(req.params.sessionId, desktopSessionId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Confirm current step (advance)
 */
router.post("/sessions/:sessionId/confirm", async (req: Request, res: Response) => {
  try {
    await playbookService.confirmStep(req.params.sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
