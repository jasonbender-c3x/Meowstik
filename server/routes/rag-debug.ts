/**
 * RAG Debug Routes
 * 
 * API endpoints for monitoring and debugging the RAG pipeline.
 * Provides trace events, statistics, buffer management, and evaluation metrics.
 */

import { Router } from "express";
import { ragDebugBuffer } from "../services/rag-debug-buffer";
import { ragService } from "../services/rag-service";
import { ragEvaluator } from "../services/rag-evaluator";

const router = Router();

/**
 * GET /api/debug/rag/traces
 * Get trace groups (ingestion and query events grouped by trace ID)
 */
router.get("/traces", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const groups = ragDebugBuffer.getTraceGroups(limit);
    res.json(groups);
  } catch (error) {
    console.error("Error fetching RAG traces:", error);
    res.status(500).json({ error: "Failed to fetch traces" });
  }
});

/**
 * GET /api/debug/rag/events
 * Get raw trace events
 */
router.get("/events", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = ragDebugBuffer.getEvents(limit);
    res.json(events);
  } catch (error) {
    console.error("Error fetching RAG events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

/**
 * GET /api/debug/rag/stats
 * Get RAG pipeline statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = ragDebugBuffer.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching RAG stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/**
 * GET /api/debug/rag/trace/:traceId
 * Get events for a specific trace ID
 */
router.get("/trace/:traceId", async (req, res) => {
  try {
    const events = ragDebugBuffer.getEventsByTraceId(req.params.traceId);
    res.json(events);
  } catch (error) {
    console.error("Error fetching trace:", error);
    res.status(500).json({ error: "Failed to fetch trace" });
  }
});

/**
 * POST /api/debug/rag/clear
 * Clear the trace buffer
 */
router.post("/clear", async (req, res) => {
  try {
    ragDebugBuffer.clear();
    res.json({ success: true, message: "RAG debug buffer cleared" });
  } catch (error) {
    console.error("Error clearing RAG buffer:", error);
    res.status(500).json({ error: "Failed to clear buffer" });
  }
});

/**
 * POST /api/debug/rag/test-advanced
 * Test advanced retrieval with all Cognitive Architecture 2.0 features
 */
router.post("/test-advanced", async (req, res) => {
  try {
    const { query, userId, topK, maxTokens } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const result = await ragService.retrieveAdvanced(query, userId, {
      topK: topK || 20,
      useHybridSearch: true,
      useReranking: true,
      useContextSynthesis: true,
      maxTokens: maxTokens || 4000,
    });

    res.json({
      query,
      chunks: result.chunks.map((chunk, i) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content.slice(0, 200) + "...",
        score: result.scores[i],
        metadata: chunk.metadata,
      })),
      synthesizedContext: result.synthesizedContext?.slice(0, 500) + "...",
      tokenCount: result.tokenCount,
      totalChunks: result.chunks.length,
    });
  } catch (error) {
    console.error("Error testing advanced retrieval:", error);
    res.status(500).json({ error: "Failed to test advanced retrieval" });
  }
});

/**
 * GET /api/debug/rag/evaluation/metrics
 * Get evaluation metrics summary
 */
router.get("/evaluation/metrics", async (req, res) => {
  try {
    const summary = ragEvaluator.getMetricsSummary();
    res.json(summary);
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

/**
 * GET /api/debug/rag/evaluation/report
 * Get performance report for specified period
 */
router.get("/evaluation/report", async (req, res) => {
  try {
    const periodDays = parseInt(req.query.days as string) || 7;
    const report = ragEvaluator.generateReport(periodDays);
    res.json(report);
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

/**
 * POST /api/debug/rag/evaluation/tune
 * Auto-tune thresholds based on performance
 */
router.post("/evaluation/tune", async (req, res) => {
  try {
    const thresholds = ragEvaluator.autoTuneThresholds();
    res.json({
      success: true,
      thresholds,
      message: "Thresholds auto-tuned based on performance data",
    });
  } catch (error) {
    console.error("Error tuning thresholds:", error);
    res.status(500).json({ error: "Failed to tune thresholds" });
  }
});

/**
 * POST /api/debug/rag/evaluation/feedback
 * Record feedback signal
 */
router.post("/evaluation/feedback", async (req, res) => {
  try {
    const { queryId, responseUseful, sourcesCited, chunksRelevant, userFeedback } = req.body;
    
    if (!queryId) {
      return res.status(400).json({ error: "queryId is required" });
    }

    ragEvaluator.recordFeedback({
      queryId,
      responseUseful: responseUseful ?? true,
      sourcesCited: sourcesCited ?? false,
      chunksRelevant: chunksRelevant ?? true,
      userFeedback,
    });

    res.json({ success: true, message: "Feedback recorded" });
  } catch (error) {
    console.error("Error recording feedback:", error);
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

/**
 * POST /api/debug/rag/evaluation/reset
 * Reset evaluation metrics (for testing)
 */
router.post("/evaluation/reset", async (req, res) => {
  try {
    ragEvaluator.resetMetrics();
    res.json({ success: true, message: "Evaluation metrics reset" });
  } catch (error) {
    console.error("Error resetting metrics:", error);
    res.status(500).json({ error: "Failed to reset metrics" });
  }
});

export default router;
