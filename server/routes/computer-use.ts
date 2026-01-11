/**
 * Computer Use API Routes (Project Ghost)
 * 
 * Endpoints for AI-directed computer control using Gemini Computer Use:
 * - Vision analysis of screenshots
 * - Action planning with official Computer Use API
 * - Action execution via desktop agent or browser extension
 * - Element finding and interaction
 * - Progress assessment
 * - Safety confirmations for destructive actions
 */

import { Router, Request, Response } from "express";
import { computerUseService, ComputerAction } from "../services/computer-use";
import { sendToExtension, getConnectedExtensions } from "./extension";
import { desktopRelayService } from "../services/desktop-relay-service";

const router = Router();

/**
 * Analyze a screenshot using vision AI
 */
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { screenshot, context } = req.body;

    if (!screenshot) {
      return res.status(400).json({ error: "Screenshot required" });
    }

    const analysis = await computerUseService.analyzeScreen(screenshot, context);
    res.json(analysis);
  } catch (error: any) {
    console.error("[ComputerUse] Analyze error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Plan actions to achieve a goal
 */
router.post("/plan", async (req: Request, res: Response) => {
  try {
    const { goal, screenshot, url, title, elements } = req.body;

    if (!goal || !screenshot) {
      return res.status(400).json({ error: "Goal and screenshot required" });
    }

    const actions = await computerUseService.planActions(goal, {
      screenshot,
      url,
      title,
      elements
    });

    res.json({ actions });
  } catch (error: any) {
    console.error("[ComputerUse] Plan error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Plan actions using official Gemini Computer Use API
 * This uses the native Computer Use function calling capabilities
 */
router.post("/plan-with-gemini", async (req: Request, res: Response) => {
  try {
    const { goal, screenshot, url, title, conversationHistory } = req.body;

    if (!goal || !screenshot) {
      return res.status(400).json({ error: "Goal and screenshot required" });
    }

    const result = await computerUseService.planActionsWithComputerUse(
      goal,
      { screenshot, url, title },
      conversationHistory
    );

    res.json(result);
  } catch (error: any) {
    console.error("[ComputerUse] Plan with Gemini error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute an action via desktop agent (Project Ghost)
 * This is the primary endpoint for hands-free desktop control
 */
router.post("/execute-desktop", async (req: Request, res: Response) => {
  try {
    const { action, sessionId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action required" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "Desktop session ID required" });
    }

    const session = desktopRelayService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        error: "Desktop session not found",
        hint: "Start a desktop collaboration session first"
      });
    }

    // Convert ComputerAction to InputEvent format for desktop agent
    const inputEvent = convertActionToInputEvent(action);
    
    if (!inputEvent) {
      return res.status(400).json({ error: "Invalid action type" });
    }

    // Send action to desktop agent
    desktopRelayService.sendInputToAgent(sessionId, inputEvent);

    res.json({ 
      success: true, 
      message: "Action sent to desktop agent",
      action 
    });
  } catch (error: any) {
    console.error("[ComputerUse] Execute desktop error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to convert ComputerAction to desktop agent InputEvent
 */
function convertActionToInputEvent(action: ComputerAction): any {
  switch (action.type) {
    case 'click':
      if (typeof action.target === 'object' && 'x' in action.target) {
        return {
          type: 'mouse',
          action: 'click',
          x: action.target.x,
          y: action.target.y,
          button: action.button || 'left',
          source: 'ai'
        };
      }
      return null;

    case 'move':
      if (typeof action.target === 'object' && 'x' in action.target) {
        return {
          type: 'mouse',
          action: 'move',
          x: action.target.x,
          y: action.target.y,
          source: 'ai'
        };
      }
      return null;

    case 'type':
      return {
        type: 'keyboard',
        action: 'type',
        text: action.text,
        source: 'ai'
      };

    case 'key':
      return {
        type: 'keyboard',
        action: 'keydown',
        key: action.key,
        modifiers: action.modifiers, // Now properly typed
        source: 'ai'
      };

    case 'scroll':
      return {
        type: 'mouse',
        action: 'scroll',
        direction: action.direction,
        delta: action.amount || 300,
        source: 'ai'
      };

    default:
      return null;
  }
}

/**
 * Execute an action via connected extension
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { action, connectionId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action required" });
    }

    const connections = getConnectedExtensions();
    
    if (connections.length === 0) {
      return res.status(503).json({ 
        error: "No extension connected",
        hint: "Open the Meowstik browser extension and connect to the server"
      });
    }

    const targetConnection = connectionId || connections[0].id;
    
    const sent = sendToExtension(targetConnection, {
      type: "execute_command",
      command: action.type,
      params: action
    });

    if (!sent) {
      return res.status(503).json({ error: "Failed to send to extension" });
    }

    res.json({ 
      success: true, 
      message: "Action sent to extension",
      action 
    });
  } catch (error: any) {
    console.error("[ComputerUse] Execute error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find an element on screen by description
 */
router.post("/find-element", async (req: Request, res: Response) => {
  try {
    const { screenshot, description } = req.body;

    if (!screenshot || !description) {
      return res.status(400).json({ error: "Screenshot and description required" });
    }

    const result = await computerUseService.findElement(screenshot, description);
    res.json(result);
  } catch (error: any) {
    console.error("[ComputerUse] Find element error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Assess progress toward a goal
 */
router.post("/assess", async (req: Request, res: Response) => {
  try {
    const { goal, screenshot, actions } = req.body;

    if (!goal || !screenshot) {
      return res.status(400).json({ error: "Goal and screenshot required" });
    }

    const assessment = await computerUseService.assessProgress(
      goal,
      screenshot,
      actions || []
    );

    res.json(assessment);
  } catch (error: any) {
    console.error("[ComputerUse] Assess error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get action history
 */
router.get("/history", (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const actions = computerUseService.getRecentActions(limit);
  res.json({ actions });
});

/**
 * Clear action history
 */
router.delete("/history", (req: Request, res: Response) => {
  computerUseService.clearHistory();
  res.json({ success: true });
});

/**
 * Run a complete desktop task with Gemini Computer Use (Project Ghost)
 * This endpoint uses the official Computer Use API in a loop
 */
router.post("/run-desktop-task", async (req: Request, res: Response) => {
  try {
    const { goal, sessionId, maxSteps = 10 } = req.body;

    if (!goal) {
      return res.status(400).json({ error: "Goal required" });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "Desktop session ID required" });
    }

    const session = desktopRelayService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        error: "Desktop session not found",
        hint: "Start a desktop collaboration session first"
      });
    }

    if (!session.lastFrame) {
      return res.status(400).json({ 
        error: "No screen frame available",
        hint: "Desktop agent must be streaming screen frames"
      });
    }

    res.json({
      started: true,
      goal,
      maxSteps,
      message: "Task started with Computer Use API - use WebSocket for real-time updates",
      sessionId
    });

    // Execute task asynchronously (client will receive updates via WebSocket)
    executeDesktopTask(goal, sessionId, maxSteps).catch(error => {
      console.error("[ComputerUse] Task execution failed:", error);
    });
  } catch (error: any) {
    console.error("[ComputerUse] Run desktop task error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Configuration for Computer Use task execution
 */
const COMPUTER_USE_CONFIG = {
  ACTION_DELAY_MS: 500, // Delay between action execution (configurable based on system performance)
  PROGRESS_CHECK_INTERVAL: 3, // Check progress every N steps
};

/**
 * Execute a desktop task using the Computer Use API in a loop
 */
async function executeDesktopTask(goal: string, sessionId: string, maxSteps: number): Promise<void> {
  const conversationHistory: any[] = [];
  const actionsPerformed: ComputerAction[] = [];
  let stepCount = 0;

  console.log(`[ComputerUse] Starting desktop task: "${goal}" for session ${sessionId}`);

  while (stepCount < maxSteps) {
    stepCount++;
    
    const session = desktopRelayService.getSession(sessionId);
    if (!session || !session.lastFrame) {
      console.error("[ComputerUse] Session or frame lost during execution");
      break;
    }

    // Get the current screen state
    const screenshot = `data:image/png;base64,${session.lastFrame.data}`;
    
    // Use Computer Use API to plan next action
    const result = await computerUseService.planActionsWithComputerUse(
      goal,
      { screenshot },
      conversationHistory
    );

    // Broadcast reasoning to browsers
    if (result.reasoning) {
      desktopRelayService.broadcastToBrowsers(session, {
        type: 'computer_use_reasoning',
        data: { reasoning: result.reasoning, step: stepCount }
      });
    }

    // Check if confirmation required
    if (result.requiresConfirmation) {
      desktopRelayService.broadcastToBrowsers(session, {
        type: 'computer_use_confirmation_required',
        data: { actions: result.actions, step: stepCount }
      });
      console.log("[ComputerUse] Awaiting user confirmation for destructive action");
      // In a real implementation, we'd wait for user confirmation via WebSocket
      // For now, we'll just pause
      break;
    }

    // Execute actions
    if (result.actions.length === 0) {
      console.log("[ComputerUse] No actions returned - task may be complete");
      break;
    }

    for (const action of result.actions) {
      const inputEvent = convertActionToInputEvent(action);
      if (inputEvent) {
        desktopRelayService.sendInputToAgent(sessionId, inputEvent);
        actionsPerformed.push(action);
        
        // Broadcast action to browsers
        desktopRelayService.broadcastToBrowsers(session, {
          type: 'computer_use_action',
          data: { action, step: stepCount }
        });

        // Wait a bit for action to complete
        await new Promise(resolve => setTimeout(resolve, COMPUTER_USE_CONFIG.ACTION_DELAY_MS));
      }
    }

    // Update conversation history for context
    conversationHistory.push({
      role: "user",
      parts: [{ text: `Action executed: ${JSON.stringify(result.actions)}` }]
    });

    // Assess progress periodically
    if (stepCount % COMPUTER_USE_CONFIG.PROGRESS_CHECK_INTERVAL === 0) {
      const assessment = await computerUseService.assessProgress(
        goal,
        screenshot,
        actionsPerformed
      );

      desktopRelayService.broadcastToBrowsers(session, {
        type: 'computer_use_progress',
        data: { assessment, step: stepCount }
      });

      if (assessment.complete) {
        console.log("[ComputerUse] Task completed successfully");
        desktopRelayService.broadcastToBrowsers(session, {
          type: 'computer_use_complete',
          data: { goal, actionsPerformed: actionsPerformed.length }
        });
        break;
      }
    }
  }

  if (stepCount >= maxSteps) {
    console.log("[ComputerUse] Max steps reached without completion");
    const session = desktopRelayService.getSession(sessionId);
    if (session) {
      desktopRelayService.broadcastToBrowsers(session, {
        type: 'computer_use_max_steps',
        data: { goal, steps: stepCount }
      });
    }
  }
}

/**
 * Run a complete task with visual feedback loop
 */
router.post("/run-task", async (req: Request, res: Response) => {
  try {
    const { goal, maxSteps = 10 } = req.body;

    if (!goal) {
      return res.status(400).json({ error: "Goal required" });
    }

    const connections = getConnectedExtensions();
    if (connections.length === 0) {
      return res.status(503).json({ 
        error: "No extension connected",
        hint: "Open the Meowstik browser extension and connect to the server"
      });
    }

    res.json({
      started: true,
      goal,
      maxSteps,
      message: "Task started - use WebSocket for real-time updates",
      connectionId: connections[0].id
    });
  } catch (error: any) {
    console.error("[ComputerUse] Run task error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
