/**
 * =============================================================================
 * ORCHESTRATOR API ROUTES
 * =============================================================================
 * 
 * REST API for the multi-agent orchestration system.
 * Provides endpoints for:
 * - Starting orchestrated task execution
 * - Managing agents
 * - Monitoring session status
 * - Accessing logs and debugging information
 */

import { Router, Request, Response } from "express";
import { orchestrator } from "../services/orchestrator";
import { z } from "zod";

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const orchestrateRequestSchema = z.object({
  goal: z.string().min(1, "Goal is required"),
  userId: z.string().optional(),
  chatId: z.string().optional(),
  initialContext: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const registerAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["planner", "executor", "researcher", "coder", "reviewer", "specialist"]),
  description: z.string(),
  capabilities: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      domains: z.array(z.string()),
      tools: z.array(z.string()),
      maxConcurrency: z.number().optional(),
    })
  ),
  priority: z.number().default(5),
  status: z.enum(["active", "idle", "busy", "offline"]).default("active"),
  currentLoad: z.number().default(0),
  maxLoad: z.number().default(3),
  metadata: z.record(z.unknown()).optional(),
});

const updateContextSchema = z.object({
  updates: z.record(z.unknown()),
});

// =============================================================================
// ORCHESTRATION ENDPOINTS
// =============================================================================

/**
 * Start a new orchestrated task
 * POST /api/orchestrator/orchestrate
 */
router.post("/orchestrate", async (req: Request, res: Response) => {
  try {
    const validation = orchestrateRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { goal, userId, chatId, initialContext, metadata } = validation.data;

    const result = await orchestrator.orchestrate(goal, {
      userId,
      chatId,
      initialContext,
      metadata,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("[Orchestrator API] Orchestrate error:", error);
    res.status(500).json({
      error: "Failed to start orchestration",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get orchestration status
 * GET /api/orchestrator/sessions/:sessionId
 */
router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const status = await orchestrator.getOrchestrationStatus(sessionId);

    if (!status) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(status);
  } catch (error) {
    console.error("[Orchestrator API] Get status error:", error);
    res.status(500).json({ error: "Failed to get session status" });
  }
});

/**
 * Get session logs
 * GET /api/orchestrator/sessions/:sessionId/logs
 */
router.get("/sessions/:sessionId/logs", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const logs = orchestrator.getSessionLogs(sessionId);

    res.json({ sessionId, logs });
  } catch (error) {
    console.error("[Orchestrator API] Get logs error:", error);
    res.status(500).json({ error: "Failed to get session logs" });
  }
});

/**
 * Update session context
 * PATCH /api/orchestrator/sessions/:sessionId/context
 */
router.patch("/sessions/:sessionId/context", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const validation = updateContextSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    orchestrator.updateContext(sessionId, validation.data.updates);

    res.json({ success: true, message: "Context updated" });
  } catch (error) {
    console.error("[Orchestrator API] Update context error:", error);
    res.status(500).json({ error: "Failed to update context" });
  }
});

/**
 * Clean up a session
 * DELETE /api/orchestrator/sessions/:sessionId
 */
router.delete("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    orchestrator.cleanupSession(sessionId);

    res.json({ success: true, message: "Session cleaned up" });
  } catch (error) {
    console.error("[Orchestrator API] Cleanup error:", error);
    res.status(500).json({ error: "Failed to cleanup session" });
  }
});

// =============================================================================
// AGENT MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * Get all registered agents
 * GET /api/orchestrator/agents
 */
router.get("/agents", async (req: Request, res: Response) => {
  try {
    const agents = orchestrator.getAgents();
    res.json({ agents, count: agents.length });
  } catch (error) {
    console.error("[Orchestrator API] Get agents error:", error);
    res.status(500).json({ error: "Failed to get agents" });
  }
});

/**
 * Get a specific agent
 * GET /api/orchestrator/agents/:agentId
 */
router.get("/agents/:agentId", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = orchestrator.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json(agent);
  } catch (error) {
    console.error("[Orchestrator API] Get agent error:", error);
    res.status(500).json({ error: "Failed to get agent" });
  }
});

/**
 * Register a new agent
 * POST /api/orchestrator/agents
 */
router.post("/agents", async (req: Request, res: Response) => {
  try {
    const validation = registerAgentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid agent definition",
        details: validation.error.errors,
      });
    }

    orchestrator.registerAgent(validation.data);

    res.status(201).json({
      success: true,
      message: "Agent registered",
      agent: validation.data,
    });
  } catch (error) {
    console.error("[Orchestrator API] Register agent error:", error);
    res.status(500).json({ error: "Failed to register agent" });
  }
});

/**
 * Unregister an agent
 * DELETE /api/orchestrator/agents/:agentId
 */
router.delete("/agents/:agentId", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const success = orchestrator.unregisterAgent(agentId);

    if (!success) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json({ success: true, message: "Agent unregistered" });
  } catch (error) {
    console.error("[Orchestrator API] Unregister agent error:", error);
    res.status(500).json({ error: "Failed to unregister agent" });
  }
});

/**
 * Initialize the orchestrator with default agents
 * POST /api/orchestrator/initialize
 */
router.post("/initialize", async (req: Request, res: Response) => {
  try {
    await orchestrator.initialize();
    const agents = orchestrator.getAgents();

    res.json({
      success: true,
      message: "Orchestrator initialized",
      agentCount: agents.length,
    });
  } catch (error) {
    console.error("[Orchestrator API] Initialize error:", error);
    res.status(500).json({ error: "Failed to initialize orchestrator" });
  }
});

// =============================================================================
// DEBUGGING & MONITORING ENDPOINTS
// =============================================================================

/**
 * Get orchestrator statistics
 * GET /api/orchestrator/stats
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const agents = orchestrator.getAgents();
    
    const stats = {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === "active").length,
      busyAgents: agents.filter((a) => a.currentLoad > 0).length,
      totalCapacity: agents.reduce((sum, a) => sum + a.maxLoad, 0),
      usedCapacity: agents.reduce((sum, a) => sum + a.currentLoad, 0),
      agentsByType: agents.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    res.json(stats);
  } catch (error) {
    console.error("[Orchestrator API] Get stats error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

/**
 * Health check
 * GET /api/orchestrator/health
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const agents = orchestrator.getAgents();
    const activeAgents = agents.filter((a) => a.status === "active");

    res.json({
      status: "healthy",
      timestamp: new Date(),
      agents: {
        total: agents.length,
        active: activeAgents.length,
      },
    });
  } catch (error) {
    console.error("[Orchestrator API] Health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
