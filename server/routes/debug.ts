/**
 * Debug & LLM-usage API routes
 *
 * Mounted at /api by createApiRouter() so all paths here are relative to that.
 * Note: Specific sub-paths (/llm/persistent, /llm/stats, /llm/persistent/:id)
 * MUST be registered before the parameterised /llm/:id — Express matches in order.
 */

import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// /debug/logs
// ─────────────────────────────────────────────────────────────────────────────

router.get("/debug/logs", async (_req, res) => {
  try {
    const { logBuffer } = await import("../services/log-buffer");
    res.json(logBuffer.getLogs(50));
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /debug/database
// ─────────────────────────────────────────────────────────────────────────────

router.get("/debug/database", async (_req, res) => {
  try {
    res.json(await storage.getDebugDatabaseInfo());
  } catch (error) {
    console.error("Error fetching database info:", error);
    res.status(500).json({ error: "Failed to fetch database info" });
  }
});

router.get("/debug/database/:tableName", async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    res.json(await storage.getTableData(tableName, limit, offset));
  } catch (error) {
    console.error("Error fetching table data:", error);
    res.status(500).json({ error: "Failed to fetch table data" });
  }
});

router.put("/debug/database/:tableName/:recordId", async (req, res) => {
  try {
    const { tableName, recordId } = req.params;
    const success = await storage.updateTableRecord(tableName, recordId, req.body);
    if (!success) return res.status(404).json({ error: "Table not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating record:", error);
    res.status(500).json({ error: "Failed to update record" });
  }
});

router.delete("/debug/database/:tableName/:recordId", async (req, res) => {
  try {
    const { tableName, recordId } = req.params;
    const success = await storage.deleteTableRecord(tableName, recordId);
    if (!success) return res.status(404).json({ error: "Table not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting record:", error);
    res.status(500).json({ error: "Failed to delete record" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /debug/llm — in-memory buffer  (SPECIFIC routes before /:id)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/debug/llm", async (req, res) => {
  try {
    const { llmDebugBuffer } = await import("../services/llm-debug-buffer");
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(llmDebugBuffer.getAll(limit));
  } catch (error) {
    console.error("Error fetching LLM debug data:", error);
    res.status(500).json({ error: "Failed to fetch LLM debug data" });
  }
});

router.delete("/debug/llm", async (_req, res) => {
  try {
    const { llmDebugBuffer } = await import("../services/llm-debug-buffer");
    llmDebugBuffer.clear();
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing LLM debug data:", error);
    res.status(500).json({ error: "Failed to clear LLM debug data" });
  }
});

// Persistent interactions — MUST come before /debug/llm/:id
router.get("/debug/llm/persistent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId as string | undefined;
    const interactions = await storage.getRecentLlmInteractions(
      limit,
      userId === "null" ? null : userId,
    );
    res.json(interactions);
  } catch (error) {
    console.error("Error fetching persistent LLM interactions:", error);
    res.status(500).json({ error: "Failed to fetch persistent LLM interactions" });
  }
});

router.get("/debug/llm/persistent/:id", async (req, res) => {
  try {
    const interaction = await storage.getLlmInteractionById(req.params.id);
    if (!interaction) return res.status(404).json({ error: "Interaction not found" });
    res.json(interaction);
  } catch (error) {
    console.error("Error fetching persistent LLM interaction:", error);
    res.status(500).json({ error: "Failed to fetch persistent LLM interaction" });
  }
});

router.get("/debug/llm/persistent/chat/:chatId", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(await storage.getLlmInteractionsByChat(req.params.chatId, limit));
  } catch (error) {
    console.error("Error fetching chat LLM interactions:", error);
    res.status(500).json({ error: "Failed to fetch chat LLM interactions" });
  }
});

// stats — MUST come before /debug/llm/:id
router.get("/debug/llm/stats", async (_req, res) => {
  try {
    res.json(await storage.getLlmInteractionStats());
  } catch (error) {
    console.error("Error fetching LLM interaction stats:", error);
    res.status(500).json({ error: "Failed to fetch LLM interaction statistics" });
  }
});

// Cleanup — MUST come before /debug/llm/:id
router.delete("/debug/llm/persistent/cleanup", async (req, res) => {
  try {
    const daysOld = parseInt(req.query.daysOld as string) || 30;
    const deletedCount = await storage.deleteOldLlmInteractions(daysOld);
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Error cleaning up old LLM interactions:", error);
    res.status(500).json({ error: "Failed to cleanup old LLM interactions" });
  }
});

// Parameterised route — after all specific /debug/llm/* routes
router.get("/debug/llm/:id", async (req, res) => {
  try {
    const { llmDebugBuffer } = await import("../services/llm-debug-buffer");
    const interaction = llmDebugBuffer.getById(req.params.id);
    if (!interaction) return res.status(404).json({ error: "Interaction not found" });
    res.json(interaction);
  } catch (error) {
    console.error("Error fetching LLM interaction:", error);
    res.status(500).json({ error: "Failed to fetch LLM interaction" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /debug/io-logs
// ─────────────────────────────────────────────────────────────────────────────

router.get("/debug/io-logs", async (_req, res) => {
  try {
    const { ioLogger } = await import("../services/io-logger");
    res.json(ioLogger.listLogs());
  } catch (error) {
    console.error("Error listing IO logs:", error);
    res.status(500).json({ error: "Failed to list IO logs" });
  }
});

router.get("/debug/io-logs/:filename", async (req, res) => {
  try {
    const { ioLogger } = await import("../services/io-logger");
    const { filename } = req.params;

    if (!filename.startsWith("input-") && !filename.startsWith("output-")) {
      return res.status(400).json({ error: "Invalid log file name" });
    }

    const content = ioLogger.getLog(filename);
    if (!content) return res.status(404).json({ error: "Log file not found" });

    res.setHeader("Content-Type", "text/markdown");
    res.send(content);
  } catch (error) {
    console.error("Error fetching IO log:", error);
    res.status(500).json({ error: "Failed to fetch IO log" });
  }
});

router.delete("/debug/io-logs/cleanup", async (req, res) => {
  try {
    const { ioLogger } = await import("../services/io-logger");
    const keepLast = parseInt(req.query.keepLast as string) || 50;
    ioLogger.cleanup(keepLast);
    res.json({ success: true, message: `Cleaned up old logs, kept last ${keepLast}` });
  } catch (error) {
    console.error("Error cleaning up IO logs:", error);
    res.status(500).json({ error: "Failed to cleanup IO logs" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /debug/system-prompt-breakdown
// ─────────────────────────────────────────────────────────────────────────────

router.get("/debug/system-prompt-breakdown", async (_req, res) => {
  try {
    const { promptComposer } = await import("../services/prompt-composer");
    res.json(promptComposer.getSystemPromptBreakdown());
  } catch (error) {
    console.error("Error getting system prompt breakdown:", error);
    res.status(500).json({ error: "Failed to get system prompt breakdown" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /debug/errors
// ─────────────────────────────────────────────────────────────────────────────

router.get("/debug/errors", async (req, res) => {
  try {
    const { llmErrorBuffer } = await import("../services/llm-error-buffer");
    const limit = parseInt(req.query.limit as string) || 50;
    const service = req.query.service as string | undefined;
    res.json(service ? llmErrorBuffer.getByService(service as any, limit) : llmErrorBuffer.getAll(limit));
  } catch (error) {
    console.error("Error fetching LLM errors:", error);
    res.status(500).json({ error: "Failed to fetch LLM errors" });
  }
});

router.get("/debug/errors/summary", async (_req, res) => {
  try {
    const { llmErrorBuffer } = await import("../services/llm-error-buffer");
    res.json({ summary: llmErrorBuffer.getSummaryForAnalysis(), count: llmErrorBuffer.getCount() });
  } catch (error) {
    console.error("Error fetching error summary:", error);
    res.status(500).json({ error: "Failed to fetch error summary" });
  }
});

router.post("/debug/errors/analyze", async (_req, res) => {
  try {
    const { llmErrorBuffer } = await import("../services/llm-error-buffer");
    const summary = llmErrorBuffer.getSummaryForAnalysis();

    if (llmErrorBuffer.getCount() === 0) {
      return res.json({ analysis: "No errors to analyze. The error log is empty.", errorCount: 0 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a debugging assistant. Analyze these LLM-related errors and provide:
1. A summary of the most common issues
2. Potential root causes
3. Suggested fixes or workarounds
4. Priority ranking (which errors to fix first)

Be concise but thorough. Format your response in markdown.

${summary}`,
            },
          ],
        },
      ],
    });

    res.json({
      analysis: response.text || "Unable to generate analysis",
      errorCount: llmErrorBuffer.getCount(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error analyzing errors:", error);
    res.status(500).json({ error: "Failed to analyze errors" });
  }
});

router.delete("/debug/errors", async (_req, res) => {
  try {
    const { llmErrorBuffer } = await import("../services/llm-error-buffer");
    llmErrorBuffer.clear();
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing LLM errors:", error);
    res.status(500).json({ error: "Failed to clear LLM errors" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// /llm/usage
// ─────────────────────────────────────────────────────────────────────────────

router.get("/llm/usage", async (_req, res) => {
  try {
    res.json(await storage.getLlmUsageStats());
  } catch (error) {
    console.error("Error fetching LLM usage stats:", error);
    res.status(500).json({ error: "Failed to fetch LLM usage statistics" });
  }
});

router.get("/llm/usage/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(await storage.getRecentLlmUsage(limit));
  } catch (error) {
    console.error("Error fetching recent LLM usage:", error);
    res.status(500).json({ error: "Failed to fetch recent LLM usage" });
  }
});

router.get("/llm/usage/chat/:chatId", async (req, res) => {
  try {
    res.json(await storage.getLlmUsageByChat(req.params.chatId));
  } catch (error) {
    console.error("Error fetching chat LLM usage:", error);
    res.status(500).json({ error: "Failed to fetch chat LLM usage" });
  }
});

export default router;
