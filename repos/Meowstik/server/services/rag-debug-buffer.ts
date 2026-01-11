/**
 * =============================================================================
 * MEOWSTIK - RAG DEBUG BUFFER
 * =============================================================================
 * 
 * Circular buffer for RAG pipeline tracing and debugging.
 * Captures ingestion and query events with timing and metadata.
 * =============================================================================
 */

export type RagEventStage = 
  | "ingest_start"
  | "chunk"
  | "embed"
  | "store"
  | "ingest_complete"
  | "ingest_filtered"
  | "query_start"
  | "query_embed"
  | "search"
  | "retrieve"
  | "inject"
  | "query_complete"
  | "error";

export interface RagTraceEvent {
  id: string;
  traceId: string;
  timestamp: string;
  stage: RagEventStage;
  
  // Content info
  documentId?: string;
  filename?: string;
  contentType?: "document" | "message" | "file";
  contentLength?: number;
  
  // Chunking info
  chunksCreated?: number;
  chunksFiltered?: number;
  chunkingStrategy?: string;
  
  // Query info
  query?: string;
  queryLength?: number;
  
  // Search results
  searchResults?: number;
  threshold?: number;
  topK?: number;
  scores?: number[];
  chunkIds?: string[];
  chunkPreviews?: string[];
  
  // Context injection
  tokensUsed?: number;
  sourcesCount?: number;
  
  // Timing
  durationMs: number;
  
  // Errors
  error?: string;
  
  // Metadata
  userId?: string;
  chatId?: string;
  role?: "user" | "ai";
}

export interface RagTraceGroup {
  traceId: string;
  type: "ingestion" | "query";
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  events: RagTraceEvent[];
  success: boolean;
  summary: {
    documentId?: string;
    filename?: string;
    query?: string;
    chunksCreated?: number;
    chunksFiltered?: number;
    searchResults?: number;
    tokensUsed?: number;
  };
}

class RagDebugBuffer {
  private events: RagTraceEvent[] = [];
  private readonly maxSize: number = 200;
  private eventId: number = 0;

  generateTraceId(): string {
    return `rag-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  private generateEventId(): string {
    return `evt-${++this.eventId}`;
  }

  addEvent(event: Omit<RagTraceEvent, "id" | "timestamp">): void {
    const fullEvent: RagTraceEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    // Circular buffer - remove oldest when full
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
  }

  // Convenience methods for common events
  logIngestStart(traceId: string, documentId: string, filename: string, contentLength: number, contentType: "document" | "message" | "file" = "document"): void {
    this.addEvent({
      traceId,
      stage: "ingest_start",
      documentId,
      filename,
      contentLength,
      contentType,
      durationMs: 0,
    });
  }

  logChunk(traceId: string, documentId: string, chunksCreated: number, chunksFiltered: number, strategy: string, durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "chunk",
      documentId,
      chunksCreated,
      chunksFiltered,
      chunkingStrategy: strategy,
      durationMs,
    });
  }

  logEmbed(traceId: string, documentId: string, chunksCreated: number, durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "embed",
      documentId,
      chunksCreated,
      durationMs,
    });
  }

  logStore(traceId: string, documentId: string, chunksCreated: number, durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "store",
      documentId,
      chunksCreated,
      durationMs,
    });
  }

  logIngestComplete(traceId: string, documentId: string, chunksCreated: number, totalDurationMs: number): void {
    this.addEvent({
      traceId,
      stage: "ingest_complete",
      documentId,
      chunksCreated,
      durationMs: totalDurationMs,
    });
  }

  logIngestFiltered(traceId: string, documentId: string, reason: string): void {
    this.addEvent({
      traceId,
      stage: "ingest_filtered",
      documentId,
      error: reason,
      durationMs: 0,
    });
  }

  logQueryStart(traceId: string, query: string, chatId?: string, userId?: string): void {
    this.addEvent({
      traceId,
      stage: "query_start",
      query,
      queryLength: query.length,
      chatId,
      userId,
      durationMs: 0,
    });
  }

  logQueryEmbed(traceId: string, query: string, durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "query_embed",
      query,
      durationMs,
    });
  }

  logSearch(traceId: string, query: string, searchResults: number, threshold: number, topK: number, scores: number[], durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "search",
      query,
      searchResults,
      threshold,
      topK,
      scores: scores.slice(0, 10), // Only keep top 10 scores
      durationMs,
    });
  }

  logRetrieve(traceId: string, query: string, chunkIds: string[], chunkPreviews: string[], durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "retrieve",
      query,
      chunkIds: chunkIds.slice(0, 10),
      chunkPreviews: chunkPreviews.slice(0, 10).map(p => p.slice(0, 100)),
      durationMs,
    });
  }

  logInject(traceId: string, query: string, tokensUsed: number, sourcesCount: number, durationMs: number): void {
    this.addEvent({
      traceId,
      stage: "inject",
      query,
      tokensUsed,
      sourcesCount,
      durationMs,
    });
  }

  logQueryComplete(traceId: string, query: string, searchResults: number, tokensUsed: number, totalDurationMs: number): void {
    this.addEvent({
      traceId,
      stage: "query_complete",
      query,
      searchResults,
      tokensUsed,
      durationMs: totalDurationMs,
    });
  }

  logError(traceId: string, stage: RagEventStage, error: string): void {
    this.addEvent({
      traceId,
      stage: "error",
      error: `[${stage}] ${error}`,
      durationMs: 0,
    });
  }

  // Query methods
  getEvents(limit: number = 50): RagTraceEvent[] {
    return this.events.slice(-limit).reverse();
  }

  getEventsByTraceId(traceId: string): RagTraceEvent[] {
    return this.events.filter(e => e.traceId === traceId);
  }

  getIngestionEvents(limit: number = 20): RagTraceEvent[] {
    const ingestionStages: RagEventStage[] = ["ingest_start", "chunk", "embed", "store", "ingest_complete", "ingest_filtered"];
    return this.events
      .filter(e => ingestionStages.includes(e.stage))
      .slice(-limit)
      .reverse();
  }

  getQueryEvents(limit: number = 20): RagTraceEvent[] {
    const queryStages: RagEventStage[] = ["query_start", "query_embed", "search", "retrieve", "inject", "query_complete"];
    return this.events
      .filter(e => queryStages.includes(e.stage))
      .slice(-limit)
      .reverse();
  }

  getTraceGroups(limit: number = 20): RagTraceGroup[] {
    // Group events by traceId
    const groupMap = new Map<string, RagTraceEvent[]>();
    
    for (const event of this.events) {
      if (!groupMap.has(event.traceId)) {
        groupMap.set(event.traceId, []);
      }
      groupMap.get(event.traceId)!.push(event);
    }

    // Convert to groups
    const groups: RagTraceGroup[] = [];
    
    const entries = Array.from(groupMap.entries());
    for (const [traceId, events] of entries) {
      const sortedEvents = events.sort((a: RagTraceEvent, b: RagTraceEvent) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const firstEvent = sortedEvents[0];
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      
      const isIngestion = firstEvent.stage === "ingest_start" || firstEvent.stage === "ingest_filtered";
      const isQuery = firstEvent.stage === "query_start";
      
      const success = !events.some((e: RagTraceEvent) => e.stage === "error" || e.stage === "ingest_filtered");
      
      // Build summary
      const summary: RagTraceGroup["summary"] = {};
      for (const e of events) {
        if (e.documentId) summary.documentId = e.documentId;
        if (e.filename) summary.filename = e.filename;
        if (e.query) summary.query = e.query;
        if (e.chunksCreated !== undefined) summary.chunksCreated = e.chunksCreated;
        if (e.chunksFiltered !== undefined) summary.chunksFiltered = e.chunksFiltered;
        if (e.searchResults !== undefined) summary.searchResults = e.searchResults;
        if (e.tokensUsed !== undefined) summary.tokensUsed = e.tokensUsed;
      }
      
      groups.push({
        traceId,
        type: isIngestion ? "ingestion" : isQuery ? "query" : "ingestion",
        startTime: firstEvent.timestamp,
        endTime: lastEvent.timestamp,
        totalDurationMs: lastEvent.durationMs,
        events: sortedEvents,
        success,
        summary,
      });
    }

    // Sort by start time descending and limit
    return groups
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  getStats(): {
    totalEvents: number;
    ingestionCount: number;
    queryCount: number;
    errorCount: number;
    avgIngestionDuration: number;
    avgQueryDuration: number;
  } {
    const ingestionCompletes = this.events.filter(e => e.stage === "ingest_complete");
    const queryCompletes = this.events.filter(e => e.stage === "query_complete");
    const errors = this.events.filter(e => e.stage === "error");

    const avgIngestionDuration = ingestionCompletes.length > 0
      ? ingestionCompletes.reduce((sum, e) => sum + e.durationMs, 0) / ingestionCompletes.length
      : 0;

    const avgQueryDuration = queryCompletes.length > 0
      ? queryCompletes.reduce((sum, e) => sum + e.durationMs, 0) / queryCompletes.length
      : 0;

    return {
      totalEvents: this.events.length,
      ingestionCount: ingestionCompletes.length,
      queryCount: queryCompletes.length,
      errorCount: errors.length,
      avgIngestionDuration: Math.round(avgIngestionDuration),
      avgQueryDuration: Math.round(avgQueryDuration),
    };
  }

  clear(): void {
    this.events = [];
    this.eventId = 0;
  }
}

export const ragDebugBuffer = new RagDebugBuffer();
