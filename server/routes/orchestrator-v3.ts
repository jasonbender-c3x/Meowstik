/**
 * =============================================================================
 * ORCHESTRATOR API ROUTES
 * =============================================================================
 * 
 * API endpoints for the multi-agent orchestrator system:
 * - Execute tasks with specialized agents
 * - Monitor execution progress
 * - Manage agent registry
 * - Stream progress updates via SSE
 */

import { Router, Request, Response } from "express";
import { getModelRouter, inferTaskCategory } from "../services/model-router";
import { asyncExecutionManager } from "../services/async-execution-manager";
import {
  SPECIALIZED_AGENTS,
  getAgentByDomain,
  getAgentsByCapability,
  hasToolAccess,
  validateDataAccess,
} from "../services/specialized-agents";

const router = Router();

// =============================================================================
// MODEL ROUTER ENDPOINTS
// =============================================================================

/**
 * GET /api/orchestrator/models
 * Get available models and their configurations
 */
router.get("/models", (req: Request, res: Response) => {
  try {
    const modelRouter = getModelRouter();
    const configs = modelRouter.getAllModelConfigs();
    res.json({ models: configs });
  } catch (error) {
    res.status(500).json({ error: "Failed to get model configurations" });
  }
});

/**
 * POST /api/orchestrator/models/select
 * Select the best model for a task
 * 
 * Body: {
 *   taskCategory: "planning" | "reasoning" | "code_generation" | ...,
 *   priority?: "quality" | "speed" | "cost" | "balanced",
 *   maxLatency?: number,
 *   maxCost?: number,
 *   requiresMultimodal?: boolean
 * }
 */
router.post("/models/select", (req: Request, res: Response) => {
  try {
    const modelRouter = getModelRouter();
    const selection = modelRouter.selectModel(req.body);
    res.json(selection);
  } catch (error) {
    res.status(400).json({ error: "Invalid model selection criteria" });
  }
});

/**
 * POST /api/orchestrator/models/infer
 * Infer task category from prompt
 * 
 * Body: { prompt: string }
 */
router.post("/models/infer", (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const category = inferTaskCategory(prompt);
    res.json({ category });
  } catch (error) {
    res.status(500).json({ error: "Failed to infer task category" });
  }
});

// =============================================================================
// SPECIALIZED AGENT ENDPOINTS
// =============================================================================

/**
 * GET /api/orchestrator/agents
 * List all specialized agents
 */
router.get("/agents", (req: Request, res: Response) => {
  try {
    const agents = Object.values(SPECIALIZED_AGENTS).map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      domain: agent.domain,
      status: agent.status,
      currentLoad: agent.currentLoad,
      maxLoad: agent.maxLoad,
      capabilities: agent.capabilities.map((cap) => cap.name),
      modelType: agent.modelType,
    }));

    res.json({ agents, count: agents.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to list agents" });
  }
});

/**
 * GET /api/orchestrator/agents/:agentId
 * Get detailed information about a specific agent
 */
router.get("/agents/:agentId", (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = Object.values(SPECIALIZED_AGENTS).find(
      (a) => a.id === agentId
    );

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: "Failed to get agent" });
  }
});

/**
 * GET /api/orchestrator/agents/by-domain/:domain
 * Find agent by domain
 */
router.get("/agents/by-domain/:domain", (req: Request, res: Response) => {
  try {
    const { domain } = req.params;
    const agent = getAgentByDomain(domain as any);

    if (!agent) {
      return res.status(404).json({ error: "No agent found for domain" });
    }

    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: "Failed to find agent by domain" });
  }
});

/**
 * GET /api/orchestrator/agents/by-capability/:capability
 * Find agents by capability
 */
router.get("/agents/by-capability/:capability", (req: Request, res: Response) => {
  try {
    const { capability } = req.params;
    const agents = getAgentsByCapability(capability);

    res.json({ agents, count: agents.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to find agents by capability" });
  }
});

/**
 * POST /api/orchestrator/agents/:agentId/validate-access
 * Validate if agent has access to a tool or data scope
 * 
 * Body: { 
 *   type: "tool" | "data",
 *   target: string (tool name or data scope)
 * }
 */
router.post("/agents/:agentId/validate-access", (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { type, target } = req.body;

    const agent = Object.values(SPECIALIZED_AGENTS).find(
      (a) => a.id === agentId
    );

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    let hasAccess = false;
    let reason = "";

    if (type === "tool") {
      hasAccess = hasToolAccess(agent, target);
      reason = hasAccess
        ? `Agent has access to tool: ${target}`
        : `Agent does not have access to tool: ${target}`;
    } else if (type === "data") {
      hasAccess = validateDataAccess(agent, target);
      reason = hasAccess
        ? `Agent has access to data scope: ${target}`
        : `Agent does not have access to data scope: ${target}`;
    } else {
      return res.status(400).json({ error: "Invalid validation type" });
    }

    res.json({ hasAccess, reason });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate access" });
  }
});

// =============================================================================
// ASYNC EXECUTION ENDPOINTS
// =============================================================================

/**
 * POST /api/orchestrator/execute
 * Execute a task asynchronously
 * 
 * Body: {
 *   taskId: string,
 *   taskData: unknown,
 *   userId: string,
 *   chatId?: string,
 *   async?: boolean,
 *   streamProgress?: boolean,
 *   priority?: number,
 *   timeout?: number
 * }
 */
router.post("/execute", async (req: Request, res: Response) => {
  try {
    const {
      taskId,
      taskData,
      userId,
      chatId,
      async = true,
      streamProgress = true,
      priority = 5,
      timeout,
    } = req.body;

    if (!taskId || !taskData || !userId) {
      return res.status(400).json({
        error: "taskId, taskData, and userId are required",
      });
    }

    const executionId = await asyncExecutionManager.executeTask(
      taskId,
      taskData,
      {
        userId,
        chatId,
        async,
        streamProgress,
        priority,
        timeout,
      }
    );

    res.json({
      executionId,
      status: async ? "queued" : "completed",
      message: async
        ? "Task queued for execution"
        : "Task completed synchronously",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to execute task" });
  }
});

/**
 * GET /api/orchestrator/executions/:executionId
 * Get execution status
 */
router.get("/executions/:executionId", (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = asyncExecutionManager.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }

    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: "Failed to get execution status" });
  }
});

/**
 * GET /api/orchestrator/executions/user/:userId
 * Get all executions for a user
 */
router.get("/executions/user/:userId", (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const executions = asyncExecutionManager.getUserExecutions(userId);

    res.json({ executions, count: executions.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user executions" });
  }
});

/**
 * DELETE /api/orchestrator/executions/:executionId
 * Cancel an execution
 */
router.delete("/executions/:executionId", async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;

    await asyncExecutionManager.cancelExecution(executionId, reason);

    res.json({ message: "Execution cancelled", executionId });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel execution" });
  }
});

/**
 * GET /api/orchestrator/executions/:executionId/progress
 * Stream execution progress via SSE
 */
router.get("/executions/:executionId/progress", (req: Request, res: Response) => {
  const { executionId } = req.params;

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send initial status
  const execution = asyncExecutionManager.getExecution(executionId);
  if (!execution) {
    res.write(`data: ${JSON.stringify({ error: "Execution not found" })}\n\n`);
    res.end();
    return;
  }

  // Progress listener
  const progressListener = (update: any) => {
    res.write(`data: ${JSON.stringify(update)}\n\n`);

    // Close stream when execution completes
    if (
      update.status === "completed" ||
      update.status === "failed" ||
      update.status === "cancelled"
    ) {
      res.end();
    }
  };

  // Register listener
  asyncExecutionManager.addProgressListener(executionId, progressListener);

  // Clean up on client disconnect
  req.on("close", () => {
    asyncExecutionManager.removeProgressListener(executionId, progressListener);
  });
});

// =============================================================================
// ORCHESTRATOR STATS
// =============================================================================

/**
 * GET /api/orchestrator/stats
 * Get orchestrator statistics
 */
router.get("/stats", (req: Request, res: Response) => {
  try {
    const agents = Object.values(SPECIALIZED_AGENTS);

    const stats = {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === "active").length,
      busyAgents: agents.filter((a) => a.currentLoad > 0).length,
      totalCapacity: agents.reduce((sum, a) => sum + a.maxLoad, 0),
      usedCapacity: agents.reduce((sum, a) => sum + a.currentLoad, 0),
      agentsByType: agents.reduce((acc, agent) => {
        acc[agent.type] = (acc[agent.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      agentsByDomain: agents.reduce((acc, agent) => {
        agent.domain.forEach((domain) => {
          acc[domain] = (acc[domain] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>),
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// =============================================================================
// EXPORTS
// =============================================================================

export default router;
