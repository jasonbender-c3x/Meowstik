# RAG Traceability - Implementation Guide

> **Step-by-Step Technical Implementation Reference**  
> Complete code examples, database schemas, and integration patterns

**Companion to**: RAG_TRACEABILITY_PROPOSAL.md  
**Status**: Implementation Ready  
**Date**: January 14, 2026

---

## Table of Contents

1. [Database Schema](#database-schema)
2. [TypeScript Types](#typescript-types)
3. [Storage Layer](#storage-layer)
4. [Trace Collector](#trace-collector)
5. [API Routes](#api-routes)
6. [UI Components](#ui-components)
7. [Configuration](#configuration)
8. [Testing](#testing)

---

## Database Schema

### Migration Script

Create `migrations/006_rag_traceability.sql`:

```sql
-- ============================================================================
-- RAG TRACEABILITY SCHEMA
-- ============================================================================
-- Version: 1.0
-- Date: 2026-01-14
-- Description: Comprehensive tracing for RAG pipeline operations
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Table: rag_traces
-- Purpose: Store all RAG pipeline events (ingestion and queries)
-- ----------------------------------------------------------------------------
CREATE TABLE rag_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Trace identification
  trace_id VARCHAR(255) NOT NULL,
  trace_type VARCHAR(50) NOT NULL CHECK (trace_type IN ('ingestion', 'query')),
  
  -- Timing
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  duration_ms INTEGER,
  
  -- Stage tracking
  stage VARCHAR(50) NOT NULL,
  
  -- Content references
  document_id VARCHAR(255),
  chunk_ids TEXT[],
  message_id VARCHAR(255),
  chat_id VARCHAR(255),
  user_id VARCHAR(255),
  
  -- Query details
  query_text TEXT,
  query_length INTEGER,
  
  -- Ingestion details
  filename VARCHAR(500),
  content_type VARCHAR(100),
  content_length INTEGER,
  
  -- Chunking details
  chunks_created INTEGER,
  chunks_filtered INTEGER,
  chunking_strategy VARCHAR(50),
  
  -- Embedding details
  embedding_model VARCHAR(100),
  embedding_dimensions INTEGER,
  
  -- Search/retrieval details
  search_results INTEGER,
  threshold FLOAT,
  top_k INTEGER,
  scores FLOAT[],
  
  -- Context injection
  tokens_used INTEGER,
  sources_count INTEGER,
  context_length INTEGER,
  
  -- Error tracking
  error_message TEXT,
  error_stage VARCHAR(50),
  
  -- Metadata (flexible JSON storage)
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Performance indexes for common query patterns
CREATE INDEX idx_rag_traces_trace_id ON rag_traces(trace_id);
CREATE INDEX idx_rag_traces_timestamp ON rag_traces(timestamp DESC);
CREATE INDEX idx_rag_traces_type_stage ON rag_traces(trace_type, stage);
CREATE INDEX idx_rag_traces_user ON rag_traces(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_rag_traces_document ON rag_traces(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX idx_rag_traces_chunk_ids ON rag_traces USING GIN(chunk_ids) WHERE chunk_ids IS NOT NULL;
CREATE INDEX idx_rag_traces_error ON rag_traces(error_stage) WHERE error_message IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Table: rag_chunk_lineage
-- Purpose: Track chunk lifecycle from creation to retrieval
-- ----------------------------------------------------------------------------
CREATE TABLE rag_chunk_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chunk identification (links to document_chunks.id)
  chunk_id VARCHAR(255) NOT NULL UNIQUE,
  document_id VARCHAR(255) NOT NULL,
  
  -- Source tracking
  source_type VARCHAR(100) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  filename VARCHAR(500),
  
  -- Ingestion metadata
  ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ingestion_trace_id VARCHAR(255),
  
  -- Chunk details
  content_preview TEXT,
  content_length INTEGER,
  chunk_index INTEGER,
  
  -- Vector metadata
  embedding_model VARCHAR(100),
  vector_store VARCHAR(100),
  
  -- Usage tracking
  retrieval_count INTEGER DEFAULT 0,
  last_retrieved_at TIMESTAMP,
  avg_similarity_score FLOAT,
  
  -- Quality metrics
  importance_score FLOAT,
  is_verified BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  tags TEXT[],
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for lineage queries
CREATE INDEX idx_chunk_lineage_document ON rag_chunk_lineage(document_id);
CREATE INDEX idx_chunk_lineage_source ON rag_chunk_lineage(source_type, source_id);
CREATE INDEX idx_chunk_lineage_retrieval ON rag_chunk_lineage(retrieval_count DESC, last_retrieved_at DESC);
CREATE INDEX idx_chunk_lineage_tags ON rag_chunk_lineage USING GIN(tags);

-- ----------------------------------------------------------------------------
-- Table: rag_retrieval_results
-- Purpose: Detailed tracking of query results
-- ----------------------------------------------------------------------------
CREATE TABLE rag_retrieval_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Query identification
  trace_id VARCHAR(255) NOT NULL,
  query_text TEXT NOT NULL,
  user_id VARCHAR(255),
  chat_id VARCHAR(255),
  
  -- Result details
  chunk_id VARCHAR(255) NOT NULL,
  similarity_score FLOAT NOT NULL,
  rank INTEGER NOT NULL,
  
  -- Context inclusion
  included_in_context BOOLEAN DEFAULT FALSE,
  context_position INTEGER,
  
  -- Quality feedback
  was_relevant BOOLEAN,
  feedback_source VARCHAR(50),
  
  -- Timestamps
  retrieved_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for result queries
CREATE INDEX idx_retrieval_trace ON rag_retrieval_results(trace_id);
CREATE INDEX idx_retrieval_chunk ON rag_retrieval_results(chunk_id);
CREATE INDEX idx_retrieval_score ON rag_retrieval_results(similarity_score DESC);
CREATE INDEX idx_retrieval_feedback ON rag_retrieval_results(was_relevant) WHERE was_relevant IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Table: rag_metrics_hourly
-- Purpose: Pre-aggregated performance metrics
-- ----------------------------------------------------------------------------
CREATE TABLE rag_metrics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time bucket
  hour_start TIMESTAMP NOT NULL,
  
  -- Ingestion metrics
  documents_ingested INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,
  chunks_filtered INTEGER DEFAULT 0,
  avg_ingestion_duration_ms INTEGER,
  
  -- Query metrics
  queries_processed INTEGER DEFAULT 0,
  avg_query_duration_ms INTEGER,
  avg_search_results INTEGER,
  avg_context_tokens INTEGER,
  
  -- Quality metrics
  avg_similarity_score FLOAT,
  empty_result_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Cost tracking
  embedding_api_calls INTEGER DEFAULT 0,
  vector_search_operations INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure one record per hour
  UNIQUE(hour_start)
);

-- Index for metrics queries
CREATE INDEX idx_metrics_hour ON rag_metrics_hourly(hour_start DESC);

COMMIT;

-- ============================================================================
-- Optional: Create view for easier querying
-- ============================================================================

CREATE VIEW rag_trace_groups AS
SELECT 
  trace_id,
  trace_type,
  MIN(timestamp) as start_time,
  MAX(timestamp) as end_time,
  MAX(duration_ms) as total_duration,
  COUNT(*) as event_count,
  BOOL_AND(error_message IS NULL) as success
FROM rag_traces
GROUP BY trace_id, trace_type;

-- ============================================================================
-- Example queries for validation
-- ============================================================================

-- Get recent traces
-- SELECT * FROM rag_traces ORDER BY timestamp DESC LIMIT 10;

-- Get trace details
-- SELECT * FROM rag_traces WHERE trace_id = 'rag-xxxxx' ORDER BY timestamp;

-- Get chunk lineage
-- SELECT * FROM rag_chunk_lineage WHERE chunk_id = 'chunk-xxxxx';

-- Get hourly metrics
-- SELECT * FROM rag_metrics_hourly ORDER BY hour_start DESC LIMIT 24;
```

---

## TypeScript Types

Update `shared/schema.ts`:

```typescript
import { pgTable, varchar, timestamp, integer, text, jsonb, float, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// RAG TRACEABILITY TABLES
// ============================================================================

/**
 * rag_traces - Main trace table for all RAG events
 */
export const ragTraces = pgTable("rag_traces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Trace identification
  traceId: varchar("trace_id", { length: 255 }).notNull(),
  traceType: varchar("trace_type", { length: 50 }).notNull(),
  
  // Timing
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  durationMs: integer("duration_ms"),
  
  // Stage
  stage: varchar("stage", { length: 50 }).notNull(),
  
  // Content references
  documentId: varchar("document_id", { length: 255 }),
  chunkIds: text("chunk_ids").array(),
  messageId: varchar("message_id", { length: 255 }),
  chatId: varchar("chat_id", { length: 255 }),
  userId: varchar("user_id", { length: 255 }),
  
  // Query details
  queryText: text("query_text"),
  queryLength: integer("query_length"),
  
  // Ingestion details
  filename: varchar("filename", { length: 500 }),
  contentType: varchar("content_type", { length: 100 }),
  contentLength: integer("content_length"),
  
  // Chunking details
  chunksCreated: integer("chunks_created"),
  chunksFiltered: integer("chunks_filtered"),
  chunkingStrategy: varchar("chunking_strategy", { length: 50 }),
  
  // Embedding details
  embeddingModel: varchar("embedding_model", { length: 100 }),
  embeddingDimensions: integer("embedding_dimensions"),
  
  // Search/retrieval details
  searchResults: integer("search_results"),
  threshold: float("threshold"),
  topK: integer("top_k"),
  scores: float("scores").array(),
  
  // Context injection
  tokensUsed: integer("tokens_used"),
  sourcesCount: integer("sources_count"),
  contextLength: integer("context_length"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorStage: varchar("error_stage", { length: 50 }),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_rag_traces_trace_id").on(table.traceId),
  index("idx_rag_traces_timestamp").on(table.timestamp),
  index("idx_rag_traces_type_stage").on(table.traceType, table.stage),
]);

/**
 * rag_chunk_lineage - Track chunk lifecycle
 */
export const ragChunkLineage = pgTable("rag_chunk_lineage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Chunk identification
  chunkId: varchar("chunk_id", { length: 255 }).notNull().unique(),
  documentId: varchar("document_id", { length: 255 }).notNull(),
  
  // Source tracking
  sourceType: varchar("source_type", { length: 100 }).notNull(),
  sourceId: varchar("source_id", { length: 255 }).notNull(),
  filename: varchar("filename", { length: 500 }),
  
  // Ingestion metadata
  ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
  ingestionTraceId: varchar("ingestion_trace_id", { length: 255 }),
  
  // Chunk details
  contentPreview: text("content_preview"),
  contentLength: integer("content_length"),
  chunkIndex: integer("chunk_index"),
  
  // Vector metadata
  embeddingModel: varchar("embedding_model", { length: 100 }),
  vectorStore: varchar("vector_store", { length: 100 }),
  
  // Usage tracking
  retrievalCount: integer("retrieval_count").default(0),
  lastRetrievedAt: timestamp("last_retrieved_at"),
  avgSimilarityScore: float("avg_similarity_score"),
  
  // Quality metrics
  importanceScore: float("importance_score"),
  isVerified: boolean("is_verified").default(false),
  
  // Metadata
  tags: text("tags").array(),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_chunk_lineage_document").on(table.documentId),
  index("idx_chunk_lineage_source").on(table.sourceType, table.sourceId),
]);

/**
 * rag_retrieval_results - Detailed query results
 */
export const ragRetrievalResults = pgTable("rag_retrieval_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Query identification
  traceId: varchar("trace_id", { length: 255 }).notNull(),
  queryText: text("query_text").notNull(),
  userId: varchar("user_id", { length: 255 }),
  chatId: varchar("chat_id", { length: 255 }),
  
  // Result details
  chunkId: varchar("chunk_id", { length: 255 }).notNull(),
  similarityScore: float("similarity_score").notNull(),
  rank: integer("rank").notNull(),
  
  // Context inclusion
  includedInContext: boolean("included_in_context").default(false),
  contextPosition: integer("context_position"),
  
  // Quality feedback
  wasRelevant: boolean("was_relevant"),
  feedbackSource: varchar("feedback_source", { length: 50 }),
  
  // Timestamps
  retrievedAt: timestamp("retrieved_at").notNull().defaultNow(),
}, (table) => [
  index("idx_retrieval_trace").on(table.traceId),
  index("idx_retrieval_chunk").on(table.chunkId),
]);

/**
 * rag_metrics_hourly - Pre-aggregated metrics
 */
export const ragMetricsHourly = pgTable("rag_metrics_hourly", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Time bucket
  hourStart: timestamp("hour_start").notNull().unique(),
  
  // Ingestion metrics
  documentsIngested: integer("documents_ingested").default(0),
  chunksCreated: integer("chunks_created").default(0),
  chunksFiltered: integer("chunks_filtered").default(0),
  avgIngestionDurationMs: integer("avg_ingestion_duration_ms"),
  
  // Query metrics
  queriesProcessed: integer("queries_processed").default(0),
  avgQueryDurationMs: integer("avg_query_duration_ms"),
  avgSearchResults: integer("avg_search_results"),
  avgContextTokens: integer("avg_context_tokens"),
  
  // Quality metrics
  avgSimilarityScore: float("avg_similarity_score"),
  emptyResultCount: integer("empty_result_count").default(0),
  errorCount: integer("error_count").default(0),
  
  // Cost tracking
  embeddingApiCalls: integer("embedding_api_calls").default(0),
  vectorSearchOperations: integer("vector_search_operations").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const insertRagTraceSchema = createInsertSchema(ragTraces).omit({
  id: true,
  createdAt: true,
});

export const insertRagChunkLineageSchema = createInsertSchema(ragChunkLineage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRagRetrievalResultSchema = createInsertSchema(ragRetrievalResults).omit({
  id: true,
  retrievedAt: true,
});

export const insertRagMetricsHourlySchema = createInsertSchema(ragMetricsHourly).omit({
  id: true,
  createdAt: true,
});

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type InsertRagTrace = z.infer<typeof insertRagTraceSchema>;
export type RagTrace = typeof ragTraces.$inferSelect;

export type InsertRagChunkLineage = z.infer<typeof insertRagChunkLineageSchema>;
export type RagChunkLineage = typeof ragChunkLineage.$inferSelect;

export type InsertRagRetrievalResult = z.infer<typeof insertRagRetrievalResultSchema>;
export type RagRetrievalResult = typeof ragRetrievalResults.$inferSelect;

export type InsertRagMetricsHourly = z.infer<typeof insertRagMetricsHourlySchema>;
export type RagMetricsHourly = typeof ragMetricsHourly.$inferSelect;
```

---

## Storage Layer

Update `server/storage.ts` with trace persistence methods:

```typescript
import { ragTraces, ragChunkLineage, ragRetrievalResults, ragMetricsHourly } from "@shared/schema";
import type { 
  InsertRagTrace, RagTrace,
  InsertRagChunkLineage, RagChunkLineage,
  InsertRagRetrievalResult, RagRetrievalResult,
  InsertRagMetricsHourly, RagMetricsHourly
} from "@shared/schema";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";

// Add to IStorage interface
export interface IStorage {
  // ... existing methods ...
  
  // RAG Traceability
  createRagTrace(trace: InsertRagTrace): Promise<RagTrace>;
  createRagTraces(traces: InsertRagTrace[]): Promise<RagTrace[]>;
  getRagTraces(options: {
    type?: string;
    userId?: string;
    documentId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ traces: RagTrace[]; total: number }>;
  getRagTracesByTraceId(traceId: string): Promise<RagTrace[]>;
  
  createChunkLineage(lineage: InsertRagChunkLineage): Promise<RagChunkLineage>;
  getChunkLineage(chunkId: string): Promise<RagChunkLineage | null>;
  updateChunkLineageUsage(chunkId: string, score: number): Promise<void>;
  
  createRetrievalResult(result: InsertRagRetrievalResult): Promise<RagRetrievalResult>;
  createRetrievalResults(results: InsertRagRetrievalResult[]): Promise<RagRetrievalResult[]>;
  getRetrievalResultsByTrace(traceId: string): Promise<RagRetrievalResult[]>;
  getRetrievalResultsByChunk(chunkId: string, limit?: number): Promise<RagRetrievalResult[]>;
  
  upsertRagMetrics(metrics: InsertRagMetricsHourly): Promise<RagMetricsHourly>;
  getRagMetrics(from: Date, to: Date): Promise<RagMetricsHourly[]>;
  
  deleteOldRagTraces(olderThan: Date): Promise<number>;
}

// Implementation in PostgresStorage class
export class PostgresStorage implements IStorage {
  // ... existing methods ...
  
  // ========================================================================
  // RAG TRACEABILITY METHODS
  // ========================================================================
  
  async createRagTrace(trace: InsertRagTrace): Promise<RagTrace> {
    const [result] = await this.db.insert(ragTraces).values(trace).returning();
    return result;
  }
  
  async createRagTraces(traces: InsertRagTrace[]): Promise<RagTrace[]> {
    if (traces.length === 0) return [];
    return await this.db.insert(ragTraces).values(traces).returning();
  }
  
  async getRagTraces(options: {
    type?: string;
    userId?: string;
    documentId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ traces: RagTrace[]; total: number }> {
    const conditions = [];
    
    if (options.type) {
      conditions.push(eq(ragTraces.traceType, options.type));
    }
    if (options.userId) {
      conditions.push(eq(ragTraces.userId, options.userId));
    }
    if (options.documentId) {
      conditions.push(eq(ragTraces.documentId, options.documentId));
    }
    if (options.from) {
      conditions.push(gte(ragTraces.timestamp, options.from));
    }
    if (options.to) {
      conditions.push(lte(ragTraces.timestamp, options.to));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(ragTraces)
      .where(whereClause);
    
    // Get traces with pagination
    const traces = await this.db
      .select()
      .from(ragTraces)
      .where(whereClause)
      .orderBy(desc(ragTraces.timestamp))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
    
    return {
      traces,
      total: countResult.count,
    };
  }
  
  async getRagTracesByTraceId(traceId: string): Promise<RagTrace[]> {
    return await this.db
      .select()
      .from(ragTraces)
      .where(eq(ragTraces.traceId, traceId))
      .orderBy(ragTraces.timestamp);
  }
  
  async createChunkLineage(lineage: InsertRagChunkLineage): Promise<RagChunkLineage> {
    const [result] = await this.db.insert(ragChunkLineage).values(lineage).returning();
    return result;
  }
  
  async getChunkLineage(chunkId: string): Promise<RagChunkLineage | null> {
    const [result] = await this.db
      .select()
      .from(ragChunkLineage)
      .where(eq(ragChunkLineage.chunkId, chunkId));
    return result || null;
  }
  
  async updateChunkLineageUsage(chunkId: string, score: number): Promise<void> {
    await this.db
      .update(ragChunkLineage)
      .set({
        retrievalCount: sql`${ragChunkLineage.retrievalCount} + 1`,
        lastRetrievedAt: new Date(),
        avgSimilarityScore: sql`COALESCE(${ragChunkLineage.avgSimilarityScore}, 0) * 0.9 + ${score} * 0.1`,
        updatedAt: new Date(),
      })
      .where(eq(ragChunkLineage.chunkId, chunkId));
  }
  
  async createRetrievalResult(result: InsertRagRetrievalResult): Promise<RagRetrievalResult> {
    const [created] = await this.db.insert(ragRetrievalResults).values(result).returning();
    return created;
  }
  
  async createRetrievalResults(results: InsertRagRetrievalResult[]): Promise<RagRetrievalResult[]> {
    if (results.length === 0) return [];
    return await this.db.insert(ragRetrievalResults).values(results).returning();
  }
  
  async getRetrievalResultsByTrace(traceId: string): Promise<RagRetrievalResult[]> {
    return await this.db
      .select()
      .from(ragRetrievalResults)
      .where(eq(ragRetrievalResults.traceId, traceId))
      .orderBy(ragRetrievalResults.rank);
  }
  
  async getRetrievalResultsByChunk(chunkId: string, limit = 20): Promise<RagRetrievalResult[]> {
    return await this.db
      .select()
      .from(ragRetrievalResults)
      .where(eq(ragRetrievalResults.chunkId, chunkId))
      .orderBy(desc(ragRetrievalResults.retrievedAt))
      .limit(limit);
  }
  
  async upsertRagMetrics(metrics: InsertRagMetricsHourly): Promise<RagMetricsHourly> {
    const [result] = await this.db
      .insert(ragMetricsHourly)
      .values(metrics)
      .onConflictDoUpdate({
        target: ragMetricsHourly.hourStart,
        set: metrics,
      })
      .returning();
    return result;
  }
  
  async getRagMetrics(from: Date, to: Date): Promise<RagMetricsHourly[]> {
    return await this.db
      .select()
      .from(ragMetricsHourly)
      .where(
        and(
          gte(ragMetricsHourly.hourStart, from),
          lte(ragMetricsHourly.hourStart, to)
        )
      )
      .orderBy(ragMetricsHourly.hourStart);
  }
  
  async deleteOldRagTraces(olderThan: Date): Promise<number> {
    const result = await this.db
      .delete(ragTraces)
      .where(lte(ragTraces.createdAt, olderThan));
    return result.rowCount || 0;
  }
}
```

---

## Trace Collector

Update `server/services/rag-debug-buffer.ts` to persist traces:

```typescript
import { storage } from "../storage";
import type { InsertRagTrace } from "@shared/schema";

// Extend existing RagDebugBuffer class
export class RagDebugBuffer {
  private events: RagTraceEvent[] = [];
  private readonly maxSize: number = 200;
  private eventId: number = 0;
  
  // New: Batch write configuration
  private writeBuffer: InsertRagTrace[] = [];
  private readonly batchSize: number = 20;
  private readonly flushInterval: number = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  
  // New: Enable/disable persistence
  private readonly persistenceEnabled: boolean = process.env.RAG_TRACE_PERSISTENCE !== 'false';
  
  constructor() {
    // Start periodic flush
    if (this.persistenceEnabled) {
      this.startPeriodicFlush();
    }
  }
  
  /**
   * Add event to buffer and persist to database
   */
  addEvent(event: Omit<RagTraceEvent, "id" | "timestamp">): void {
    const fullEvent: RagTraceEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
    };

    // Add to in-memory circular buffer
    this.events.push(fullEvent);
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
    
    // Persist to database (async, non-blocking)
    if (this.persistenceEnabled) {
      this.queueForPersistence(fullEvent);
    }
  }
  
  /**
   * Queue event for batch persistence
   */
  private queueForPersistence(event: RagTraceEvent): void {
    const trace: InsertRagTrace = this.eventToTrace(event);
    this.writeBuffer.push(trace);
    
    // Flush if batch size reached
    if (this.writeBuffer.length >= this.batchSize) {
      this.flushToDatabase();
    }
  }
  
  /**
   * Convert RagTraceEvent to InsertRagTrace format
   */
  private eventToTrace(event: RagTraceEvent): InsertRagTrace {
    return {
      traceId: event.traceId,
      traceType: this.inferTraceType(event.stage),
      timestamp: new Date(event.timestamp),
      durationMs: event.durationMs,
      stage: event.stage,
      
      // Content references
      documentId: event.documentId,
      chunkIds: event.chunkIds,
      messageId: event.metadata?.messageId as string | undefined,
      chatId: event.chatId,
      userId: event.userId,
      
      // Query details
      queryText: event.query,
      queryLength: event.queryLength,
      
      // Ingestion details
      filename: event.filename,
      contentType: event.contentType,
      contentLength: event.contentLength,
      
      // Chunking details
      chunksCreated: event.chunksCreated,
      chunksFiltered: event.chunksFiltered,
      chunkingStrategy: event.chunkingStrategy,
      
      // Embedding details
      embeddingModel: event.metadata?.embeddingModel as string | undefined,
      embeddingDimensions: event.metadata?.embeddingDimensions as number | undefined,
      
      // Search/retrieval details
      searchResults: event.searchResults,
      threshold: event.threshold,
      topK: event.topK,
      scores: event.scores,
      
      // Context injection
      tokensUsed: event.tokensUsed,
      sourcesCount: event.sourcesCount,
      contextLength: event.metadata?.contextLength as number | undefined,
      
      // Error tracking
      errorMessage: event.error,
      errorStage: event.error ? event.stage : undefined,
      
      // Metadata
      metadata: event.metadata ? JSON.parse(JSON.stringify(event.metadata)) : undefined,
    };
  }
  
  /**
   * Infer trace type from stage
   */
  private inferTraceType(stage: RagEventStage): 'ingestion' | 'query' {
    const ingestionStages: RagEventStage[] = ['ingest_start', 'chunk', 'embed', 'store', 'ingest_complete', 'ingest_filtered'];
    return ingestionStages.includes(stage) ? 'ingestion' : 'query';
  }
  
  /**
   * Flush write buffer to database
   */
  private async flushToDatabase(): Promise<void> {
    if (this.writeBuffer.length === 0) return;
    
    const batch = [...this.writeBuffer];
    this.writeBuffer = [];
    
    try {
      await storage.createRagTraces(batch);
      console.log(`[RAG Trace] Persisted ${batch.length} traces to database`);
    } catch (error) {
      console.error('[RAG Trace] Failed to persist traces:', error);
      // Don't rethrow - tracing should not break the app
    }
  }
  
  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushToDatabase();
    }, this.flushInterval);
  }
  
  /**
   * Stop periodic flush and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushToDatabase();
  }
  
  // ... existing methods remain unchanged ...
}

export const ragDebugBuffer = new RagDebugBuffer();

// Graceful shutdown hook
process.on('SIGTERM', async () => {
  console.log('[RAG Trace] Shutting down gracefully...');
  await ragDebugBuffer.shutdown();
});
```

---

## API Routes

Create `server/routes/rag-traces.ts`:

```typescript
import { Router } from "express";
import { storage } from "../storage";
import { ragDebugBuffer } from "../services/rag-debug-buffer";
import { z } from "zod";

const router = Router();

// ============================================================================
// GET /api/rag/traces - List traces
// ============================================================================
router.get("/traces", async (req, res) => {
  try {
    const schema = z.object({
      type: z.enum(['ingestion', 'query']).optional(),
      userId: z.string().optional(),
      documentId: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.coerce.number().min(1).max(500).default(50),
      offset: z.coerce.number().min(0).default(0),
    });
    
    const params = schema.parse(req.query);
    
    const result = await storage.getRagTraces({
      type: params.type,
      userId: params.userId,
      documentId: params.documentId,
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(params.to) : undefined,
      limit: params.limit,
      offset: params.offset,
    });
    
    res.json({
      traces: result.traces,
      total: result.total,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    console.error('[RAG Traces] Error fetching traces:', error);
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

// ============================================================================
// GET /api/rag/traces/:traceId - Get trace details
// ============================================================================
router.get("/traces/:traceId", async (req, res) => {
  try {
    const { traceId } = req.params;
    
    const events = await storage.getRagTracesByTraceId(traceId);
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Trace not found' });
    }
    
    // Build summary
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    
    const summary = {
      traceId,
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
      traceId,
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
    console.error('[RAG Traces] Error fetching trace details:', error);
    res.status(500).json({ error: 'Failed to fetch trace details' });
  }
});

// ============================================================================
// GET /api/rag/lineage/:chunkId - Get chunk lineage
// ============================================================================
router.get("/lineage/:chunkId", async (req, res) => {
  try {
    const { chunkId } = req.params;
    
    const lineage = await storage.getChunkLineage(chunkId);
    
    if (!lineage) {
      return res.status(404).json({ error: 'Chunk not found' });
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
    const retrievals = await storage.getRetrievalResultsByChunk(chunkId, 10);
    
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
    console.error('[RAG Traces] Error fetching lineage:', error);
    res.status(500).json({ error: 'Failed to fetch lineage' });
  }
});

// ============================================================================
// GET /api/rag/metrics - Get aggregated metrics
// ============================================================================
router.get("/metrics", async (req, res) => {
  try {
    const schema = z.object({
      period: z.enum(['hour', 'day', 'week', 'month']).default('hour'),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    });
    
    const params = schema.parse(req.query);
    
    // Default to last 24 hours if not specified
    const to = params.to ? new Date(params.to) : new Date();
    const from = params.from ? new Date(params.from) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
    
    const metrics = await storage.getRagMetrics(from, to);
    
    res.json({
      period: params.period,
      from,
      to,
      metrics,
    });
  } catch (error) {
    console.error('[RAG Traces] Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ============================================================================
// GET /api/rag/stats - Get system statistics
// ============================================================================
router.get("/stats", async (req, res) => {
  try {
    // Get basic stats from in-memory buffer
    const bufferStats = ragDebugBuffer.getStats();
    
    // TODO: Add database-level stats
    // - Total chunks in system
    // - Total documents
    // - Top retrieved chunks
    // - Recent errors
    
    res.json({
      ...bufferStats,
      // TODO: Add more stats
    });
  } catch (error) {
    console.error('[RAG Traces] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
```

Register the routes in `server/routes/index.ts`:

```typescript
import ragTracesRouter from "./rag-traces";

// ... existing code ...

app.use("/api/rag", ragTracesRouter);
```

---

## Configuration

Add environment variables to `.env.example`:

```bash
# RAG Traceability Configuration
RAG_TRACE_ENABLED=true
RAG_TRACE_PERSISTENCE=true
RAG_TRACE_RETENTION_DAYS=30
RAG_TRACE_BUFFER_SIZE=200
RAG_TRACE_BATCH_SIZE=20
RAG_TRACE_ASYNC_WRITE=true
RAG_TRACE_MASK_PII=false
```

---

## Testing

Create `server/services/__tests__/rag-traceability.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { storage } from '../storage';
import { ragDebugBuffer } from '../rag-debug-buffer';

describe('RAG Traceability', () => {
  beforeEach(async () => {
    // Setup: Clear test data
  });
  
  afterEach(async () => {
    // Teardown: Clean up
  });
  
  describe('Trace Persistence', () => {
    it('should persist traces to database', async () => {
      // Generate trace
      const traceId = ragDebugBuffer.generateTraceId();
      ragDebugBuffer.logQueryStart(traceId, 'test query');
      
      // Wait for async persistence
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify in database
      const traces = await storage.getRagTracesByTraceId(traceId);
      expect(traces.length).toBeGreaterThan(0);
    });
  });
  
  describe('Chunk Lineage', () => {
    it('should track chunk lifecycle', async () => {
      // Create lineage
      const lineage = await storage.createChunkLineage({
        chunkId: 'test-chunk-123',
        documentId: 'test-doc-456',
        sourceType: 'document',
        sourceId: 'test-source-789',
        contentPreview: 'Test content',
        contentLength: 100,
        chunkIndex: 0,
      });
      
      expect(lineage.chunkId).toBe('test-chunk-123');
      
      // Update usage
      await storage.updateChunkLineageUsage('test-chunk-123', 0.85);
      
      // Verify update
      const updated = await storage.getChunkLineage('test-chunk-123');
      expect(updated?.retrievalCount).toBe(1);
      expect(updated?.lastRetrievedAt).toBeDefined();
    });
  });
  
  describe('Retrieval Results', () => {
    it('should track query results', async () => {
      const result = await storage.createRetrievalResult({
        traceId: 'test-trace-123',
        queryText: 'test query',
        chunkId: 'test-chunk-456',
        similarityScore: 0.92,
        rank: 1,
        includedInContext: true,
      });
      
      expect(result.similarityScore).toBe(0.92);
      expect(result.rank).toBe(1);
    });
  });
});
```

---

## Next Steps

1. **Apply database migration** - Run the SQL migration script
2. **Update dependencies** - Ensure Drizzle ORM is up to date
3. **Test locally** - Verify trace persistence works
4. **Deploy** - Roll out to production with monitoring
5. **Monitor** - Watch performance impact and storage growth
6. **Iterate** - Refine based on real-world usage

---

*Implementation Guide Version: 1.0*  
*Last Updated: January 14, 2026*  
*Companion Document: RAG_TRACEABILITY_PROPOSAL.md*
