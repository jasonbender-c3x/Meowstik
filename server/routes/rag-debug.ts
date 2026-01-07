/**
 * RAG Debug Routes
 * 
 * API endpoints for monitoring and debugging the RAG pipeline.
 * Provides trace events, statistics, and buffer management.
 */

import { Router } from "express";
import { ragDebugBuffer } from "../services/rag-debug-buffer";

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

export default router;
