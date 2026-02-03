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

// ============================================================================
// RAG TRACEABILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/debug/rag/traceability/traces
 * Get persistent traces from database with filtering
 */
router.get("/traceability/traces", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const result = await storage.getRagTraces({
      type: req.query.type as string,
      userId: req.query.userId as string,
      documentId: req.query.documentId as string,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    });
    res.json(result);
  } catch (error) {
    console.error("Error fetching traces:", error);
    res.status(500).json({ error: "Failed to fetch traces" });
  }
});

/**
 * GET /api/debug/rag/traceability/traces/:traceId
 * Get all events for a specific trace ID from database
 */
router.get("/traceability/traces/:traceId", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const events = await storage.getRagTracesByTraceId(req.params.traceId);
    
    if (events.length === 0) {
      return res.status(404).json({ error: "Trace not found" });
    }
    
    // Build summary
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    
    const summary = {
      traceId: req.params.traceId,
      type: firstEvent.traceType,
      query: firstEvent.queryText,
      documentId: firstEvent.documentId,
      results: firstEvent.searchResults,
      duration: lastEvent.durationMs,
      success: !events.some(e => e.errorMessage),
      startTime: firstEvent.timestamp,
      endTime: lastEvent.timestamp,
    };
    
    res.json({
      traceId: req.params.traceId,
      type: firstEvent.traceType,
      summary,
      events: events.map(e => ({
        stage: e.stage,
        timestamp: e.timestamp,
        durationMs: e.durationMs,
        chunksCreated: e.chunksCreated,
        searchResults: e.searchResults,
        scores: e.scores,
        tokensUsed: e.tokensUsed,
        errorMessage: e.errorMessage,
      })),
    });
  } catch (error) {
    console.error("Error fetching trace details:", error);
    res.status(500).json({ error: "Failed to fetch trace details" });
  }
});

/**
 * GET /api/debug/rag/traceability/lineage/:chunkId
 * Get chunk lineage information
 */
router.get("/traceability/lineage/:chunkId", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const lineage = await storage.getChunkLineage(req.params.chunkId);
    
    if (!lineage) {
      return res.status(404).json({ error: "Chunk not found" });
    }
    
    // Get ingestion trace if available
    let ingestionTrace = null;
    if (lineage.ingestionTraceId) {
      const traces = await storage.getRagTracesByTraceId(lineage.ingestionTraceId);
      if (traces.length > 0) {
        ingestionTrace = {
          traceId: lineage.ingestionTraceId,
          timestamp: traces[0].timestamp,
          events: traces.map(t => ({
            stage: t.stage,
            timestamp: t.timestamp,
            durationMs: t.durationMs,
          })),
        };
      }
    }
    
    // Get recent retrievals
    const retrievals = await storage.getRetrievalResultsByChunk(req.params.chunkId, 10);
    
    res.json({
      chunk: {
        id: lineage.chunkId,
        documentId: lineage.documentId,
        source: {
          type: lineage.sourceType,
          id: lineage.sourceId,
          filename: lineage.filename,
        },
        ingestedAt: lineage.ingestedAt,
        contentPreview: lineage.contentPreview,
        contentLength: lineage.contentLength,
        retrievalCount: lineage.retrievalCount,
        lastRetrievedAt: lineage.lastRetrievedAt,
        avgSimilarityScore: lineage.avgSimilarityScore,
      },
      ingestionTrace,
      retrievals: retrievals.map(r => ({
        traceId: r.traceId,
        query: r.queryText,
        score: r.similarityScore,
        rank: r.rank,
        timestamp: r.retrievedAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching lineage:", error);
    res.status(500).json({ error: "Failed to fetch lineage" });
  }
});

/**
 * GET /api/debug/rag/traceability/metrics
 * Get aggregated metrics for a time period
 */
router.get("/traceability/metrics", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    
    // Default to last 24 hours if not specified
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const from = req.query.from 
      ? new Date(req.query.from as string) 
      : new Date(to.getTime() - 24 * 60 * 60 * 1000);
    
    const metrics = await storage.getRagMetrics(from, to);
    
    res.json({
      period: req.query.period || "hour",
      from,
      to,
      metrics,
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// ============================================================================
// ATTACHMENTS & INGESTION VISIBILITY
// ============================================================================

/**
 * GET /api/debug/rag/attachments
 * Get all attachments that have been ingested into RAG with details
 */
router.get("/attachments", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const { documents } = await import("@shared/schema");
    const { desc, sql, count } = await import("drizzle-orm");
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Get documents (ingested files/content)
    const db = storage.getDb();
    const docs = await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(documents);
    
    // For each document, get chunk count and last retrieval
    const enrichedDocs = await Promise.all(
      docs.map(async (doc) => {
        // Get chunk count for this document
        const chunkQuery = await db.execute(
          sql`SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ${doc.id}`
        );
        const chunkCount = parseInt((chunkQuery.rows[0] as any)?.count || "0");
        
        // Get last retrieval from traces
        const lastRetrievalQuery = await db.execute(
          sql`SELECT MAX(timestamp) as last_retrieved FROM rag_traces WHERE document_id = ${doc.id} AND trace_type = 'query'`
        );
        const lastRetrieved = (lastRetrievalQuery.rows[0] as any)?.last_retrieved;
        
        // Get retrieval count
        const retrievalCountQuery = await db.execute(
          sql`SELECT COUNT(DISTINCT trace_id) as count FROM rag_traces WHERE document_id = ${doc.id} AND trace_type = 'query'`
        );
        const retrievalCount = parseInt((retrievalCountQuery.rows[0] as any)?.count || "0");
        
        return {
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          size: doc.size,
          createdAt: doc.createdAt,
          userId: doc.userId,
          attachmentId: doc.attachmentId,
          chunkCount,
          retrievalCount,
          lastRetrieved,
          contentPreview: doc.content?.slice(0, 200),
        };
      })
    );
    
    res.json({
      attachments: enrichedDocs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

/**
 * GET /api/debug/rag/attachments/:documentId
 * Get detailed information about a specific attachment
 */
router.get("/attachments/:documentId", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const { documents } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");
    
    const db = storage.getDb();
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, req.params.documentId))
      .limit(1);
    
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    // Get all chunks for this document
    const chunksQuery = await db.execute(
      sql`SELECT id, content, metadata, embedding IS NOT NULL as has_embedding 
          FROM document_chunks WHERE document_id = ${req.params.documentId}`
    );
    const chunks = chunksQuery.rows.map((row: any) => ({
      id: row.id,
      content: row.content?.slice(0, 200),
      metadata: row.metadata,
      hasEmbedding: row.has_embedding,
    }));
    
    // Get ingestion traces
    const ingestionTraces = await db.execute(
      sql`SELECT trace_id, stage, timestamp, duration_ms, chunks_created, error_message
          FROM rag_traces 
          WHERE document_id = ${req.params.documentId} AND trace_type = 'ingestion'
          ORDER BY timestamp DESC
          LIMIT 20`
    );
    
    // Get retrieval traces
    const retrievalTraces = await db.execute(
      sql`SELECT trace_id, query_text, timestamp, search_results, scores, tokens_used
          FROM rag_traces 
          WHERE document_id = ${req.params.documentId} AND trace_type = 'query'
          ORDER BY timestamp DESC
          LIMIT 20`
    );
    
    res.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        createdAt: doc.createdAt,
        userId: doc.userId,
        attachmentId: doc.attachmentId,
        content: doc.content?.slice(0, 500),
      },
      chunks: chunks,
      ingestionTraces: ingestionTraces.rows,
      retrievalTraces: retrievalTraces.rows,
      stats: {
        totalChunks: chunks.length,
        chunksWithEmbeddings: chunks.filter((c: any) => c.hasEmbedding).length,
        ingestionCount: ingestionTraces.rows.length,
        retrievalCount: retrievalTraces.rows.length,
      },
    });
  } catch (error) {
    console.error("Error fetching attachment details:", error);
    res.status(500).json({ error: "Failed to fetch attachment details" });
  }
});

/**
 * GET /api/debug/rag/ingestion-log
 * Get chronological log of all ingestion attempts
 */
router.get("/ingestion-log", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const { sql } = await import("drizzle-orm");
    
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const db = storage.getDb();
    
    // Get ingestion traces grouped by trace_id
    const traces = await db.execute(
      sql`SELECT 
            trace_id,
            document_id,
            filename,
            content_type,
            content_length,
            MIN(timestamp) as started_at,
            MAX(timestamp) as completed_at,
            SUM(chunks_created) as total_chunks,
            MAX(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as has_error,
            MAX(error_message) as error_message,
            user_id
          FROM rag_traces
          WHERE trace_type = 'ingestion'
          GROUP BY trace_id, document_id, filename, content_type, content_length, user_id
          ORDER BY started_at DESC
          LIMIT ${limit} OFFSET ${offset}`
    );
    
    res.json({
      ingestions: traces.rows.map((row: any) => ({
        traceId: row.trace_id,
        documentId: row.document_id,
        filename: row.filename,
        contentType: row.content_type,
        contentLength: row.content_length,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        totalChunks: row.total_chunks,
        success: !row.has_error,
        errorMessage: row.error_message,
        userId: row.user_id,
      })),
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching ingestion log:", error);
    res.status(500).json({ error: "Failed to fetch ingestion log" });
  }
});

/**
 * GET /api/debug/rag/retrieval-log
 * Get chronological log of all retrieval attempts
 */
router.get("/retrieval-log", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const { sql } = await import("drizzle-orm");
    
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const db = storage.getDb();
    
    // Get retrieval traces grouped by trace_id
    const traces = await db.execute(
      sql`SELECT 
            trace_id,
            query_text,
            MIN(timestamp) as started_at,
            MAX(timestamp) as completed_at,
            MAX(search_results) as total_results,
            MAX(tokens_used) as tokens_used,
            MAX(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as has_error,
            MAX(error_message) as error_message,
            user_id,
            chat_id
          FROM rag_traces
          WHERE trace_type = 'query'
          GROUP BY trace_id, query_text, user_id, chat_id
          ORDER BY started_at DESC
          LIMIT ${limit} OFFSET ${offset}`
    );
    
    res.json({
      retrievals: traces.rows.map((row: any) => ({
        traceId: row.trace_id,
        query: row.query_text,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        totalResults: row.total_results,
        tokensUsed: row.tokens_used,
        success: !row.has_error,
        errorMessage: row.error_message,
        userId: row.user_id,
        chatId: row.chat_id,
      })),
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("Error fetching retrieval log:", error);
    res.status(500).json({ error: "Failed to fetch retrieval log" });
  }
});

export default router;
